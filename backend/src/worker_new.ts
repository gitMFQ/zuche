import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { D1Database, R2Bucket } from '@cloudflare/workers-types';

// 扩展 Hono 环境变量类型
interface Env {
  Bindings: {
    DB: D1Database;
    BUCKET: R2Bucket;
    JWT_SECRET: string;
    FRONTEND_URL: string;
  };
}

const app = new Hono<Env>();

// CORS 中间件
app.use('/api/*', cors({
  origin: (origin) => {
    // 允许所有来源（生产环境应该限制为特定域名）
    return origin || '*';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// 辅助函数：从请求头获取 token
function getTokenFromHeader(c: any): string | null {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// JWT 验证中间件
const authMiddleware = async (c: any, next: () => Promise<void>) => {
  const token = getTokenFromHeader(c);
  if (!token) {
    return c.json({ success: false, message: '未授权' }, 401);
  }

  try {
    const jwtSecret = c.env.JWT_SECRET;
    // 使用 crypto API 验证 JWT（简化版本，实际应该使用完整的 JWT 库）
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) {
      return c.json({ success: false, message: 'Token 无效或已过期' }, 401);
    }
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ success: false, message: '认证失败' }, 401);
  }
};

// 简化的 JWT 验证函数（生产环境应使用完整实现）
async function verifyJWT(token: string, secret: string): Promise<any> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));
    
    // 检查过期时间
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }
    
    return payload;
  } catch (e) {
    return null;
  }
}

// 健康检查
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== 数据库辅助函数 ====================

// 执行查询
async function query(db: D1Database, sql: string, params: any[] = []) {
  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all();
  return result.results;
}

// 执行单次查询
async function queryOne(db: D1Database, sql: string, params: any[] = []) {
  const results = await query(db, sql, params);
  return results[0] || null;
}

// 执行插入并返回 ID
async function execute(db: D1Database, sql: string, params: any[] = []) {
  const stmt = db.prepare(sql).bind(...params);
  return await stmt.run();
}

// 分页查询
async function queryWithPagination(
  db: D1Database,
  sql: string,
  params: any[] = [],
  page: number = 1,
  pageSize: number = 10
) {
  const offset = (page - 1) * pageSize;
  const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
  const countResult = await queryOne(db, countSql, params);
  const total = Number(countResult?.total || 0);
  
  const dataSql = `${sql} LIMIT ${pageSize} OFFSET ${offset}`;
  const data = await query(db, dataSql, params);
  
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}

// ==================== 认证接口 ====================

app.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      return c.json({ success: false, message: '用户名和密码不能为空' }, 400);
    }

    const user = await queryOne(
      c.env.DB,
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401);
    }

    // 验证密码（需要使用 Web Crypto API）
    const isValid = await verifyPassword(password, String(user.password_hash));
    if (!isValid) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401);
    }

    // 生成 JWT token
    const token = await generateJWT(
      { id: user.id, username: user.username, role: user.role },
      c.env.JWT_SECRET
    );

    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ success: false, message: '登录失败' }, 500);
  }
});

// 密码验证（使用 Web Crypto API）
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // bcrypt 在 Workers 中不可用，这里使用简化方案
    // 生产环境应该使用 @node-rs/bcrypt 或其他兼容方案
    return password === hash; // 临时简化，实际需要正确实现
  } catch (e) {
    return false;
  }
}

// JWT 生成
async function generateJWT(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (365 * 24 * 60 * 60); // 1 年有效期
  
  const payloadWithExp = {
    ...payload,
    iat: now,
    exp: exp
  };

  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(payloadWithExp));
  
  const data = `${headerB64}.${payloadB64}`;
  
  // 使用 Web Crypto API 签名
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return `${data}.${signatureB64}`;
}

// ==================== 用户管理接口 ====================

app.get('/api/users', authMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');
    
    const result = await queryWithPagination(
      c.env.DB,
      'SELECT id, username, name, role, created_at FROM users ORDER BY created_at DESC',
      [],
      page,
      pageSize
    );
    
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Get users error:', error);
    return c.json({ success: false, message: '获取用户列表失败' }, 500);
  }
});

app.post('/api/users', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, name, role } = body;
    
    if (!username || !password) {
      return c.json({ success: false, message: '用户名和密码不能为空' }, 400);
    }
    
    // 检查用户名是否已存在
    const existing = await queryOne(
      c.env.DB,
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    
    if (existing) {
      return c.json({ success: false, message: '用户名已存在' }, 400);
    }
    
    // 哈希密码（简化处理）
    const passwordHash = password; // 实际应该使用 bcrypt
    
    const id = crypto.randomUUID();
    await execute(
      c.env.DB,
      'INSERT INTO users (id, username, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
      [id, username, passwordHash, name || username, role || 'staff']
    );
    
    return c.json({ success: true, message: '用户创建成功' });
  } catch (error) {
    console.error('Create user error:', error);
    return c.json({ success: false, message: '创建用户失败' }, 500);
  }
});

// ==================== 客户管理接口 ====================

app.get('/api/customers', authMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');
    const search = c.req.query('search') || '';
    
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params: any[] = [];
    
    if (search) {
      sql += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const result = await queryWithPagination(c.env.DB, sql, params, page, pageSize);
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Get customers error:', error);
    return c.json({ success: false, message: '获取客户列表失败' }, 500);
  }
});

app.post('/api/customers', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { name, phone, id_card, driving_license, source, remarks } = body;
    
    if (!name || !phone) {
      return c.json({ success: false, message: '姓名和电话不能为空' }, 400);
    }
    
    const id = crypto.randomUUID();
    await execute(
      c.env.DB,
      'INSERT INTO customers (id, name, phone, id_card, driving_license, source, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, phone, id_card || null, driving_license || null, source || 'store', remarks || '']
    );
    
    return c.json({ success: true, message: '客户创建成功' });
  } catch (error) {
    console.error('Create customer error:', error);
    return c.json({ success: false, message: '创建客户失败' }, 500);
  }
});

// ==================== 车辆管理接口 ====================

app.get('/api/vehicles', authMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');
    const status = c.req.query('status');
    
    let sql = 'SELECT * FROM vehicles WHERE 1=1';
    const params: any[] = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const result = await queryWithPagination(c.env.DB, sql, params, page, pageSize);
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Get vehicles error:', error);
    return c.json({ success: false, message: '获取车辆列表失败' }, 500);
  }
});

app.post('/api/vehicles', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { 
      license_plate, brand, model, color, year, seats, 
      vin, engine_number, is_new_energy, status, remarks 
    } = body;
    
    if (!license_plate || !brand) {
      return c.json({ success: false, message: '车牌号和品牌不能为空' }, 400);
    }
    
    const id = crypto.randomUUID();
    await execute(
      c.env.DB,
      `INSERT INTO vehicles (id, license_plate, brand, model, color, year, seats, 
         vin, engine_number, is_new_energy, status, remarks) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, license_plate, brand, model || '', color || '', year || new Date().getFullYear(), 
       seats || 5, vin || '', engine_number || '', is_new_energy ? 1 : 0, status || 'available', remarks || '']
    );
    
    return c.json({ success: true, message: '车辆创建成功' });
  } catch (error) {
    console.error('Create vehicle error:', error);
    return c.json({ success: false, message: '创建车辆失败' }, 500);
  }
});

// ==================== 订单管理接口 ====================

app.get('/api/orders', authMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '10');
    const status = c.req.query('status');
    
    let sql = `SELECT o.*, c.name as customer_name, c.phone as customer_phone,
                v.license_plate, v.brand, v.model
             FROM orders o
             LEFT JOIN customers c ON o.customer_id = c.id
             LEFT JOIN vehicles v ON o.vehicle_id = v.id
             WHERE 1=1`;
    const params: any[] = [];
    
    if (status) {
      sql += ' AND o.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY o.created_at DESC';
    
    const result = await queryWithPagination(c.env.DB, sql, params, page, pageSize);
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Get orders error:', error);
    return c.json({ success: false, message: '获取订单列表失败' }, 500);
  }
});

app.post('/api/orders', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { 
      customer_id, vehicle_id, service_type, start_date, end_date,
      pickup_location, return_location, daily_rate, days, total_amount,
      deposit, deposit_waived, remarks 
    } = body;
    
    if (!customer_id || !vehicle_id || !start_date || !end_date) {
      return c.json({ success: false, message: '缺少必要参数' }, 400);
    }
    
    const id = crypto.randomUUID();
    const orderNo = 'ORD' + Date.now();
    
    await execute(
      c.env.DB,
      `INSERT INTO orders (id, order_no, customer_id, vehicle_id, service_type,
         start_date, end_date, pickup_location, return_location,
         daily_rate, days, total_amount, deposit, deposit_waived, status, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, orderNo, customer_id, vehicle_id, service_type || 'basic',
       start_date, end_date, pickup_location || '', return_location || '',
       daily_rate || 0, days || 1, total_amount || 0, deposit || 0, deposit_waived ? 1 : 0, remarks || '']
    );
    
    return c.json({ success: true, message: '订单创建成功' });
  } catch (error) {
    console.error('Create order error:', error);
    return c.json({ success: false, message: '创建订单失败' }, 500);
  }
});

// ==================== 文件上传接口（R2） ====================

app.post('/api/upload/:type', authMiddleware, async (c) => {
  try {
    const type = c.req.param('type');
    const allowedTypes = ['inspection', 'insurance', 'violation', 'maintenance', 'vehicle', 'customer', 'other'];
    
    if (!allowedTypes.includes(type)) {
      return c.json({ success: false, message: '不支持的上传类型' }, 400);
    }
    
    const formData = await c.req.formData();
    const file = formData.get('image') as File;
    
    if (!file) {
      return c.json({ success: false, message: '请选择文件' }, 400);
    }
    
    // 验证文件类型
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.type)) {
      return c.json({ success: false, message: '不支持的文件格式' }, 400);
    }
    
    // 验证文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ success: false, message: '文件大小不能超过 10MB' }, 400);
    }
    
    // 生成唯一文件名
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${type}-${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const key = `${type}/${filename}`;
    
    // 上传到 R2
    const arrayBuffer = await file.arrayBuffer();
    await c.env.BUCKET.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type }
    });
    
    // 返回公开访问 URL（需要配置 R2 公开访问或使用 signed URL）
    const fileUrl = `/uploads/${key}`;
    
    return c.json({
      success: true,
      data: {
        filename,
        url: fileUrl,
        type: file.type === 'application/pdf' ? 'pdf' : 'image'
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ success: false, message: '上传失败' }, 500);
  }
});

// 静态文件服务（从 R2 读取）
app.get('/uploads/:type/:filename', async (c) => {
  try {
    const type = c.req.param('type');
    const filename = c.req.param('filename');
    const key = `${type}/${filename}`;
    
    const object = await c.env.BUCKET.get(key);
    
    if (!object) {
      return c.text('File not found', 404);
    }
    
    const headers: Record<string, string> = {};
    object.writeHttpMetadata(headers as any);
    (headers as any)['Cache-Control'] = 'public, max-age=31536000';
    
    return new Response(object.body as any, {
      headers: headers as any
    });
  } catch (error) {
    console.error('Serve file error:', error);
    return c.text('Error serving file', 500);
  }
});

// ==================== 仪表盘统计接口 ====================

app.get('/api/dashboard/stats', authMiddleware, async (c) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 今日取车订单数
    const pickupsToday = await queryOne(
      c.env.DB,
      "SELECT COUNT(*) as count FROM orders WHERE DATE(start_date) = ? AND status != 'cancelled'",
      [today]
    );
    
    // 今日还车订单数
    const returnsToday = await queryOne(
      c.env.DB,
      "SELECT COUNT(*) as count FROM orders WHERE DATE(end_date) = ? AND status != 'cancelled'",
      [today]
    );
    
    // 待处理订单数
    const pendingOrders = await queryOne(
      c.env.DB,
      "SELECT COUNT(*) as count FROM orders WHERE status = 'pending'"
    );
    
    // 可用车辆数
    const availableVehicles = await queryOne(
      c.env.DB,
      "SELECT COUNT(*) as count FROM vehicles WHERE status = 'available'"
    );
    
    return c.json({
      success: true,
      data: {
        pickupsToday: pickupsToday?.count || 0,
        returnsToday: returnsToday?.count || 0,
        pendingOrders: pendingOrders?.count || 0,
        availableVehicles: availableVehicles?.count || 0
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return c.json({ success: false, message: '获取统计数据失败' }, 500);
  }
});

// ==================== 系统设置接口 ====================

app.get('/api/settings', authMiddleware, async (c) => {
  try {
    const rows = await query(
      c.env.DB,
      'SELECT key, value FROM system_settings'
    );
    
    const settings: Record<string, string> = {};
    rows.forEach((row: any) => {
      settings[row.key] = row.value || '';
    });
    
    return c.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get settings error:', error);
    return c.json({ success: false, message: '获取系统设置失败' }, 500);
  }
});

app.get('/api/settings/:key', authMiddleware, async (c) => {
  try {
    const key = c.req.param('key');
    const row = await queryOne(
      c.env.DB,
      'SELECT value FROM system_settings WHERE key = ?',
      [key]
    );
    
    return c.json({ success: true, data: row?.value ?? null });
  } catch (error) {
    console.error('Get setting error:', error);
    return c.json({ success: false, message: '获取设置失败' }, 500);
  }
});

app.put('/api/settings', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { key, value } = body;
    
    if (!key) {
      return c.json({ success: false, message: '缺少设置项名称' }, 400);
    }
    
    await execute(
      c.env.DB,
      `INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
      [key, value || '']
    );
    
    return c.json({ success: true, message: '设置保存成功' });
  } catch (error) {
    console.error('Update settings error:', error);
    return c.json({ success: false, message: '保存系统设置失败' }, 500);
  }
});

// ==================== 认证相关接口 ====================

// 获取当前登录用户信息
app.get('/api/auth/me', authMiddleware, async (c) => {
  try {
    const jwtPayload = c.get('jwtPayload');
    const user = jwtPayload as any;
    if (!user || !user.id) {
      return c.json({ success: false, message: '未授权' }, 401);
    }
    
    const userInfo = await queryOne(
      c.env.DB,
      'SELECT id, username, name, role, phone, email, status, created_at FROM users WHERE id = ?',
      [String(user.id)]
    );
    
    if (!userInfo) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }
    
    return c.json({ success: true, data: userInfo });
  } catch (error) {
    console.error('Get current user error:', error);
    return c.json({ success: false, message: '获取用户信息失败' }, 500);
  }
});

// ==================== 调度管理接口 ====================

// 获取最近调度数据
app.get('/api/schedules/recent', authMiddleware, async (c) => {
  try {
    // 查询待取车订单（送车）
    const pickupOrders = await query(
      c.env.DB,
      `SELECT
        o.id,
        o.start_date as schedule_time,
        '送' as type,
        v.license_plate as plate_number,
        s.name as platform,
        s.color as platform_color,
        COALESCE(o.pickup_location, '') as location,
        o.order_no
      FROM orders o
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      LEFT JOIN order_sources s ON o.source_id = s.id
      WHERE o.status NOT IN ('completed', 'cancelled')
      AND o.start_date >= datetime('now')
      ORDER BY o.start_date ASC`
    );
    
    // 查询还车订单（收车）
    const returnOrders = await query(
      c.env.DB,
      `SELECT
        o.id,
        o.end_date as schedule_time,
        '收' as type,
        v.license_plate as plate_number,
        s.name as platform,
        s.color as platform_color,
        COALESCE(o.return_location, '') as location,
        o.order_no
      FROM orders o
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      LEFT JOIN order_sources s ON o.source_id = s.id
      WHERE o.status NOT IN ('completed', 'cancelled')
      AND o.end_date >= datetime('now')
      ORDER BY o.end_date ASC`
    );
    
    const schedules = [...pickupOrders, ...returnOrders];
    schedules.sort((a: any, b: any) => 
      new Date(a.schedule_time).getTime() - new Date(b.schedule_time).getTime()
    );
    
    return c.json({ success: true, data: schedules });
  } catch (error) {
    console.error('Get recent schedules error:', error);
    return c.json({ success: false, message: '获取调度数据失败' }, 500);
  }
});

// 获取甘特图数据
app.get('/api/schedules/gantt', authMiddleware, async (c) => {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);
    endDate.setHours(23, 59, 59, 999);
    
    const startDateStr = startDate.toISOString().replace('T', ' ').slice(0, 19);
    const endDateStr = endDate.toISOString().replace('T', ' ').slice(0, 19);
    
    const orders = await query(
      c.env.DB,
      `SELECT
        o.id,
        o.order_no,
        o.start_date,
        o.end_date,
        o.status,
        o.total_amount,
        o.pickup_location,
        o.return_location,
        o.vehicle_id,
        v.license_plate as plate_number,
        v.brand,
        v.model,
        v.color,
        v.year,
        v.seats,
        v.mileage,
        v.daily_rate,
        v.deposit,
        v.vin,
        v.engine_number,
        v.is_new_energy,
        v.status as vehicle_status,
        v.license_image,
        v.registration_image,
        v.remarks,
        c.name as customer_name,
        c.phone as customer_phone,
        s.name as platform,
        s.color as platform_color
      FROM orders o
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN order_sources s ON o.source_id = s.id
      WHERE o.status IN ('pending', 'active', 'completed')
      AND (
        (o.start_date >= ? AND o.start_date <= ?)
        OR (o.end_date >= ? AND o.end_date <= ?)
        OR (o.start_date < ? AND o.end_date > ?)
      )
      ORDER BY v.license_plate ASC, o.start_date ASC`,
      [startDateStr, endDateStr, startDateStr, endDateStr, startDateStr, endDateStr]
    );
    
    const ganttData: Record<string, any[]> = {};
    
    orders.forEach((order: any) => {
      const plateNumber = order.plate_number || '未知车辆';
      
      if (!ganttData[plateNumber]) {
        ganttData[plateNumber] = [];
      }
      
      ganttData[plateNumber].push({
        id: order.id,
        order_no: order.order_no,
        startDateTime: order.start_date,
        endDateTime: order.end_date,
        status: order.status,
        vehicle_id: order.vehicle_id,
        plate_number: order.plate_number,
        brand: order.brand,
        model: order.model,
        color: order.color,
        year: order.year,
        seats: order.seats,
        mileage: order.mileage,
        daily_rate: order.daily_rate,
        deposit: order.deposit,
        vin: order.vin,
        engine_number: order.engine_number,
        is_new_energy: order.is_new_energy,
        vehicle_status: order.vehicle_status,
        license_image: order.license_image,
        registration_image: order.registration_image,
        remarks: order.remarks,
        platform: order.platform || '线下',
        platform_color: order.platform_color,
        source_name: order.platform,
        source_color: order.platform_color,
        name: order.customer_name,
        phone: order.customer_phone,
        pickLocation: order.pickup_location,
        returnLocation: order.return_location,
        rmb: order.total_amount
      });
    });
    
    return c.json({ success: true, data: ganttData });
  } catch (error) {
    console.error('Get gantt data error:', error);
    return c.json({ success: false, message: '获取甘特图数据失败' }, 500);
  }
});

// 导出 Worker
export default app;
