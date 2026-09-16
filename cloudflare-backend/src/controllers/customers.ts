import { Env, query, queryOne, execute, queryWithPagination } from '../db/index.js';
import { generateUuid, errorResponse, successResponse, logAction } from '../utils/helpers.js';

// Get customers list
export async function getCustomersController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 10;
    const keyword = params.keyword || '';
    const status = params.status !== undefined ? params.status : '';

    let sql = `SELECT c.*, s.color as source_color FROM customers c LEFT JOIN order_sources s ON c.source_id = s.id WHERE 1=1`;
    const queryParams: any[] = [];

    if (keyword) {
      sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.id_card LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      queryParams.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (status !== '') {
      sql += ' AND c.status = ?';
      queryParams.push(Number(status));
    }

    sql += ' ORDER BY c.created_at DESC';

    const result = await queryWithPagination(env.DB, sql, queryParams, page, pageSize);
    
    // Parse image JSON
    result.data = result.data.map((c: any) => {
      let idCardImages = [];
      let licenseImages = [];
      try {
        idCardImages = c.id_card_images ? JSON.parse(c.id_card_images) : [];
      } catch { idCardImages = []; }
      try {
        licenseImages = c.license_images ? JSON.parse(c.license_images) : [];
      } catch { licenseImages = []; }
      return { ...c, id_card_images: idCardImages, license_images: licenseImages };
    });

    return successResponse(result);
  } catch (error) {
    console.error('Get customers error:', error);
    return errorResponse('获取客户列表失败', 500);
  }
}

// Get single customer
export async function getCustomerController(request: Request, env: Env, userId?: string, customerId?: string): Promise<Response> {
  try {
    if (!customerId) {
      return errorResponse('客户ID不能为空');
    }

    const customer: any = await queryOne(
      env.DB,
      `SELECT c.*, s.color as source_color FROM customers c LEFT JOIN order_sources s ON c.source_id = s.id WHERE c.id = ?`,
      [customerId]
    );

    if (!customer) {
      return errorResponse('客户不存在', 404);
    }

    // Get customer orders
    const orders = await query(
      env.DB,
      `SELECT o.*, v.plate_number, v.brand, v.model FROM orders o LEFT JOIN vehicles v ON o.vehicle_id = v.id WHERE o.customer_id = ? ORDER BY o.created_at DESC LIMIT 10`,
      [customerId]
    );

    // Parse images
    let idCardImages = [], licenseImages = [];
    try { idCardImages = customer.id_card_images ? JSON.parse(customer.id_card_images) : []; } catch {}
    try { licenseImages = customer.license_images ? JSON.parse(customer.license_images) : []; } catch {}

    return successResponse({ ...customer, id_card_images: idCardImages, license_images: licenseImages, orders });
  } catch (error) {
    console.error('Get customer error:', error);
    return errorResponse('获取客户信息失败', 500);
  }
}

// Create customer
export async function createCustomerController(request: Request, env: Env, operatorId?: string): Promise<Response> {
  try {
    const body = await request.json();
    const { name, phone, id_card, license_number, license_expiry, address, remarks, id_card_images, license_images, source_id } = body;

    if (!name || !phone) {
      return errorResponse('姓名和手机号不能为空');
    }

    // Check phone exists
    const existing = await queryOne(env.DB, 'SELECT id FROM customers WHERE phone = ?', [phone]);
    if (existing) {
      return errorResponse('该手机号已存在');
    }

    // Check ID card exists
    if (id_card) {
      const existingIdCard = await queryOne(env.DB, 'SELECT id FROM customers WHERE id_card = ?', [id_card]);
      if (existingIdCard) {
        return errorResponse('该身份证号已存在');
      }
    }

    // Get source name
    let sourceName = null;
    if (source_id) {
      const source = await queryOne(env.DB, 'SELECT name FROM order_sources WHERE id = ? AND status = 1', [source_id]);
      if (source) sourceName = (source as any).name;
    }

    const id = generateUuid();
    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    await execute(
      env.DB,
      `INSERT INTO customers (id, name, phone, id_card, license_number, license_expiry, address, remarks, id_card_images, license_images, source_id, source_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, name, phone, id_card || null, license_number || null, license_expiry || null, address || null, remarks || null,
       id_card_images ? JSON.stringify(id_card_images) : null,
       license_images ? JSON.stringify(license_images) : null,
       source_id || null, sourceName, currentTime, currentTime]
    );

    await logAction(env.DB, operatorId || null, '创建客户', 'customer', id, `创建客户 ${name}，手机：${phone}`);

    return successResponse({ id, name, phone }, '客户创建成功');
  } catch (error) {
    console.error('Create customer error:', error);
    return errorResponse('创建客户失败', 500);
  }
}

// Update customer
export async function updateCustomerController(request: Request, env: Env, operatorId?: string, customerId?: string): Promise<Response> {
  try {
    if (!customerId) return errorResponse('客户ID不能为空');

    const body = await request.json();
    const { name, phone, id_card, license_number, license_expiry, address, remarks, status, id_card_images, license_images, source_id } = body;

    const customer = await queryOne(env.DB, 'SELECT id FROM customers WHERE id = ?', [customerId]);
    if (!customer) return errorResponse('客户不存在', 404);

    // Check phone not used by others
    if (phone) {
      const existingPhone = await queryOne(env.DB, 'SELECT id FROM customers WHERE phone = ? AND id != ?', [phone, customerId]);
      if (existingPhone) return errorResponse('该手机号已被其他客户使用');
    }

    // Get source name
    let sourceName = null;
    if (source_id) {
      const source = await queryOne(env.DB, 'SELECT name FROM order_sources WHERE id = ? AND status = 1', [source_id]);
      if (source) sourceName = (source as any).name;
    }

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
    await execute(
      env.DB,
      `UPDATE customers SET name = ?, phone = ?, id_card = ?, license_number = ?, license_expiry = ?, address = ?, remarks = ?, status = ?, id_card_images = ?, license_images = ?, source_id = ?, source_name = ?, updated_at = ? WHERE id = ?`,
      [name, phone, id_card || null, license_number || null, license_expiry || null, address || null, remarks || null, status,
       id_card_images ? JSON.stringify(id_card_images) : null,
       license_images ? JSON.stringify(license_images) : null,
       source_id || null, sourceName, currentTime, customerId]
    );

    await logAction(env.DB, operatorId || null, '更新客户', 'customer', customerId, `更新客户 ${name}`);

    return successResponse(null, '客户更新成功');
  } catch (error) {
    console.error('Update customer error:', error);
    return errorResponse('更新客户失败', 500);
  }
}

// Delete customer
export async function deleteCustomerController(request: Request, env: Env, operatorId?: string, customerId?: string): Promise<Response> {
  try {
    if (!customerId) return errorResponse('客户ID不能为空');

    const activeOrders: any = await queryOne(
      env.DB,
      "SELECT COUNT(*) as count FROM orders WHERE customer_id = ? AND status IN ('pending', 'active')",
      [customerId]
    );

    if (activeOrders && activeOrders.count > 0) {
      return errorResponse('该客户有未完成的订单，无法删除');
    }

    const customer: any = await queryOne(env.DB, 'SELECT name FROM customers WHERE id = ?', [customerId]);
    await execute(env.DB, 'DELETE FROM customers WHERE id = ?', [customerId]);

    await logAction(env.DB, operatorId || null, '删除客户', 'customer', customerId, `删除客户 ${customer?.name || ''}`);

    return successResponse(null, '客户删除成功');
  } catch (error) {
    console.error('Delete customer error:', error);
    return errorResponse('删除客户失败', 500);
  }
}

// Get regular customers
export async function getRegularCustomersController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const customers = await query(
      env.DB,
      `SELECT id, name, phone, id_card, license_number, license_expiry, is_regular FROM customers WHERE status = 1 AND is_regular = 1 ORDER BY name ASC`
    );
    return successResponse(customers);
  } catch (error) {
    console.error('Get regular customers error:', error);
    return errorResponse('获取常用客户列表失败', 500);
  }
}

// Set regular customer
export async function setRegularCustomerController(request: Request, env: Env, operatorId?: string, customerId?: string): Promise<Response> {
  try {
    if (!customerId) return errorResponse('客户ID不能为空');

    const body = await request.json();
    const { is_regular } = body;

    const customer = await queryOne(env.DB, 'SELECT id FROM customers WHERE id = ?', [customerId]);
    if (!customer) return errorResponse('客户不存在', 404);

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
    await execute(env.DB, 'UPDATE customers SET is_regular = ?, updated_at = ? WHERE id = ?', [is_regular ? 1 : 0, currentTime, customerId]);

    return successResponse(null, is_regular ? '已设为常用客户' : '已取消常用客户');
  } catch (error) {
    console.error('Set regular customer error:', error);
    return errorResponse('设置常用客户失败', 500);
  }
}
