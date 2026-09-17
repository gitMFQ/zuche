import { Hono } from 'hono';

// D1 数据库迁移脚本
export const migrations = [
  // 用户表
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'staff',
    phone TEXT,
    email TEXT,
    status INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,

  // 客户表
  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    id_card TEXT UNIQUE,
    license_number TEXT,
    license_expiry TEXT,
    address TEXT,
    remarks TEXT,
    status INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    id_card_images TEXT,
    license_images TEXT,
    is_regular INTEGER DEFAULT 0,
    source_id TEXT,
    source_name TEXT
  )`,

  // 车辆表
  `CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    plate_number TEXT UNIQUE NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    color TEXT,
    year INTEGER,
    seats INTEGER DEFAULT 5,
    mileage INTEGER DEFAULT 0,
    daily_rate REAL DEFAULT 0,
    weekly_rate REAL DEFAULT 0,
    monthly_rate REAL DEFAULT 0,
    deposit REAL DEFAULT 0,
    status TEXT DEFAULT 'available',
    vin TEXT,
    engine_number TEXT,
    license_image TEXT,
    registration_image TEXT,
    is_new_energy INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,

  // 订单表
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    plate_number TEXT NOT NULL,
    pickup_time TEXT NOT NULL,
    return_time TEXT NOT NULL,
    pickup_location TEXT,
    return_location TEXT,
    daily_rate REAL DEFAULT 0,
    days INTEGER DEFAULT 1,
    total_amount REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    final_amount REAL DEFAULT 0,
    deposit_amount REAL DEFAULT 0,
    deposit_waived INTEGER DEFAULT 0,
    deposit_waived_expiry TEXT,
    service_type TEXT DEFAULT 'basic',
    status TEXT DEFAULT 'pending',
    contract_number TEXT,
    source_id TEXT,
    source_name TEXT,
    commission_rate REAL DEFAULT 0,
    net_amount REAL,
    pickup_mileage INTEGER,
    return_mileage INTEGER,
    pickup_image TEXT,
    return_image TEXT,
    remarks TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
  )`,

  // 支付记录表
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_type TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    remark TEXT,
    paid_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`,

  // 订单来源表
  `CREATE TABLE IF NOT EXISTS order_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    commission_rate REAL DEFAULT 0,
    color TEXT DEFAULT '#409EFF',
    remarks TEXT,
    status INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,

  // 违章表
  `CREATE TABLE IF NOT EXISTS violations (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    vehicle_id TEXT NOT NULL,
    plate_number TEXT NOT NULL,
    violation_date TEXT NOT NULL,
    location TEXT,
    description TEXT,
    fine REAL DEFAULT 0,
    points INTEGER DEFAULT 0,
    penalty_fee REAL DEFAULT 0,
    collected_penalty REAL DEFAULT 0,
    collected_fine REAL DEFAULT 0,
    license_deposit REAL DEFAULT 0,
    fee_remarks TEXT,
    handle_type TEXT DEFAULT 'store',
    status TEXT DEFAULT 'pending',
    images TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
  )`,

  // 黑名单表
  `CREATE TABLE IF NOT EXISTS blacklist (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    reason TEXT NOT NULL,
    operator_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`,

  // 保养表
  `CREATE TABLE IF NOT EXISTS maintenance (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    plate_number TEXT NOT NULL,
    type TEXT NOT NULL,
    maintenance_date TEXT NOT NULL,
    cost REAL DEFAULT 0,
    mileage INTEGER DEFAULT 0,
    garage TEXT,
    next_maintenance_date TEXT,
    next_maintenance_mileage INTEGER,
    remarks TEXT,
    status TEXT DEFAULT 'completed',
    images TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
  )`,

  // 保险表
  `CREATE TABLE IF NOT EXISTS insurance (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    plate_number TEXT NOT NULL,
    insurance_type TEXT NOT NULL,
    insurance_company TEXT NOT NULL,
    policy_number TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    premium REAL DEFAULT 0,
    coverage_amount REAL DEFAULT 0,
    beneficiary TEXT,
    remarks TEXT,
    status TEXT DEFAULT 'active',
    documents TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
  )`,

  // 年检证表
  `CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    plate_number TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    certificate_image TEXT,
    remarks TEXT,
    status TEXT DEFAULT 'valid',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
  )`,

  // 系统设置表
  `CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,

  // 操作日志表
  `CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,

  // 调度表
  `CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    schedule_time TEXT NOT NULL,
    type TEXT NOT NULL,
    plate_number TEXT NOT NULL,
    platform TEXT NOT NULL,
    location TEXT NOT NULL,
    order_id TEXT,
    remarks TEXT,
    status INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`
];

// 初始化数据库
export async function initDatabase(db: D1Database): Promise<void> {
  try {
    // 检查是否已有表
    const tableCheck = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).first();

    if (!tableCheck) {
      console.log('正在创建数据库表...');
      
      // 执行所有迁移
      for (const migration of migrations) {
        await db.exec(migration);
      }
      
      console.log('数据库表创建成功');
      
      // 插入初始数据
      await insertInitialData(db);
    } else {
      console.log('数据库已初始化');
    }

    // 运行额外迁移
    await runMigrations(db);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

// 运行额外迁移
export async function runMigrations(db: D1Database): Promise<void> {
  try {
    // 检查并添加缺失的字段
    const tables = ['orders', 'order_sources', 'vehicles', 'customers', 'violations', 'insurance', 'maintenance'];
    
    for (const table of tables) {
      const pragma = await db.prepare(`PRAGMA table_info(${table})`).all();
      const columns = pragma.map((c: any) => c.name);
      
      // 根据需要在添加新列
      // 这里可以添加未来的迁移逻辑
    }
    
    console.log('数据库迁移完成');
  } catch (error) {
    console.error('数据库迁移错误:', error);
  }
}

// 插入初始数据
async function insertInitialData(db: D1Database): Promise<void> {
  // 插入默认管理员账户
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminId = crypto.randomUUID();
  
  await db.prepare(`
    INSERT INTO users (id, username, password, name, role, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(adminId, 'admin', hashedPassword, '系统管理员', 'admin', 1).run();
  
  console.log('默认管理员账户已创建：admin / admin123');
  
  // 插入默认订单来源
  const defaultSources = [
    { name: '门店直租', commission_rate: 0, remarks: '客户直接到门店租车' },
    { name: '美团', commission_rate: 10, remarks: '美团平台订单' },
    { name: '携程', commission_rate: 12, remarks: '携程平台订单' },
    { name: '滴滴', commission_rate: 15, remarks: '滴滴租车平台订单' },
    { name: '其他', commission_rate: 0, remarks: '其他渠道' },
  ];
  
  for (const source of defaultSources) {
    await db.prepare(`
      INSERT INTO order_sources (id, name, commission_rate, remarks, status)
      VALUES (?, ?, ?, ?, 1)
    `).bind(crypto.randomUUID(), source.name, source.commission_rate, source.remarks).run();
  }
  
  console.log('默认订单来源已创建');
  
  // 插入默认系统设置
  await db.prepare(`
    INSERT INTO system_settings (key, value)
    VALUES ('system_title', '租车管理系统')
  `).run();
  
  console.log('系统设置已初始化');
}
