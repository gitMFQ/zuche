import { D1Database } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  JWT_SECRET: string;
}

// Schema SQL as a string constant (embedded at build time)
const SCHEMA_SQL = `-- Users table
CREATE TABLE IF NOT EXISTS users (
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
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  id_card TEXT UNIQUE,
  license_number TEXT,
  license_expiry TEXT,
  address TEXT,
  remarks TEXT,
  is_regular INTEGER DEFAULT 0,
  source_id TEXT,
  source_name TEXT,
  id_card_images TEXT,
  license_images TEXT,
  status INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Order sources table
CREATE TABLE IF NOT EXISTS order_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  commission_rate REAL DEFAULT 0,
  remarks TEXT,
  color TEXT,
  status INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  plate_number TEXT UNIQUE NOT NULL,
  brand_model TEXT NOT NULL,
  vehicle_type TEXT,
  year INTEGER,
  color TEXT,
  vin TEXT,
  engine_number TEXT,
  registration_date TEXT,
  insurance_expiry TEXT,
  annual_inspection_expiry TEXT,
  purchase_price REAL,
  rental_price_daily REAL,
  rental_price_weekly REAL,
  rental_price_monthly REAL,
  deposit_amount REAL,
  status TEXT DEFAULT 'available',
  mileage REAL DEFAULT 0,
  fuel_level TEXT,
  image_url TEXT,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  actual_return_time TEXT,
  pickup_location TEXT,
  return_location TEXT,
  daily_price REAL NOT NULL,
  total_days INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  discount_amount REAL DEFAULT 0,
  final_amount REAL NOT NULL,
  deposit_paid REAL DEFAULT 0,
  balance_due REAL NOT NULL,
  payment_status TEXT DEFAULT 'unpaid',
  order_status TEXT DEFAULT 'pending',
  source_id TEXT,
  source_name TEXT,
  commission_rate REAL DEFAULT 0,
  commission_amount REAL DEFAULT 0,
  driver_name TEXT,
  driver_phone TEXT,
  driver_license TEXT,
  remarks TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- Order extensions table
CREATE TABLE IF NOT EXISTS order_extensions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  extension_days INTEGER NOT NULL,
  extension_amount REAL NOT NULL,
  new_end_time TEXT NOT NULL,
  reason TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Order payments table
CREATE TABLE IF NOT EXISTS order_payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  payment_amount REAL NOT NULL,
  payment_method TEXT,
  payment_time TEXT NOT NULL,
  payment_note TEXT,
  paid_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Violations table
CREATE TABLE IF NOT EXISTS violations (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  violation_type TEXT NOT NULL,
  violation_date TEXT NOT NULL,
  location TEXT,
  description TEXT,
  fine_amount REAL,
  points_deducted INTEGER,
  status TEXT DEFAULT 'pending',
  processed_by TEXT,
  processed_at TEXT,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Insurance table
CREATE TABLE IF NOT EXISTS insurance_records (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  insurance_company TEXT NOT NULL,
  policy_number TEXT,
  coverage_type TEXT,
  premium_amount REAL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- Maintenance records table
CREATE TABLE IF NOT EXISTS maintenance_records (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  maintenance_type TEXT NOT NULL,
  maintenance_date TEXT NOT NULL,
  mileage REAL,
  cost REAL,
  service_provider TEXT,
  description TEXT,
  next_maintenance_date TEXT,
  next_maintenance_mileage REAL,
  status TEXT DEFAULT 'completed',
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- Inspection records table
CREATE TABLE IF NOT EXISTS inspection_records (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  inspection_date TEXT NOT NULL,
  inspector TEXT,
  items_checked TEXT,
  issues_found TEXT,
  status TEXT DEFAULT 'passed',
  next_inspection_date TEXT,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Operation logs table
CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  module TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Blacklist table
CREATE TABLE IF NOT EXISTS blacklist (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  id_card TEXT,
  reason TEXT NOT NULL,
  order_id TEXT,
  added_by TEXT,
  added_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status INTEGER DEFAULT 1,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT,
  assigned_to TEXT,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  reminder_enabled INTEGER DEFAULT 0,
  reminder_time TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);`;

// Initialize database with schema and seed data
export async function initDatabase(db: D1Database): Promise<void> {
  // Split by semicolons and execute each statement
  const statements = SCHEMA_SQL.split(';').filter(s => s.trim().length > 0);
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await db.exec(statement);
      } catch (error) {
        console.error('Error executing statement:', error);
      }
    }
  }
  
  // Check if users table is empty and insert default admin user
  const { count } = await db.select<{ count: number }>('SELECT COUNT(*) as count FROM users').then(r => r[0] || { count: 0 });
  
  if (count === 0) {
    const bcrypt = await import('bcryptjs');
    const { v4: uuidv4 } = await import('uuid');
    
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminId = uuidv4();
    
    await db.prepare(`
      INSERT INTO users (id, username, password, name, role, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(adminId, 'admin', hashedPassword, '管理员', 'admin', 1).run();
    
    console.log('Default admin user created');
  }
  
  // Insert default order sources if empty
  const { count: sourceCount } = await db.select<{ count: number }>('SELECT COUNT(*) as count FROM order_sources').then(r => r[0] || { count: 0 });
  
  if (sourceCount === 0) {
    const { v4: uuidv4 } = await import('uuid');
    
    const defaultSources = [
      { id: uuidv4(), name: '门店直租', commission_rate: 0, remarks: '客户直接到门店租车', color: '#409EFF' },
      { id: uuidv4(), name: '美团', commission_rate: 10, remarks: '美团平台订单', color: '#FF6B00' },
      { id: uuidv4(), name: '携程', commission_rate: 12, remarks: '携程平台订单', color: '#0086F6' },
      { id: uuidv4(), name: '滴滴', commission_rate: 15, remarks: '滴滴租车平台订单', color: '#FFD700' },
      { id: uuidv4(), name: '其他', commission_rate: 0, remarks: '其他渠道', color: '#909399' }
    ];
    
    for (const source of defaultSources) {
      await db.prepare(`
        INSERT INTO order_sources (id, name, commission_rate, remarks, color, status)
        VALUES (?, ?, ?, ?, ?, 1)
      `).bind(source.id, source.name, source.commission_rate, source.remarks, source.color).run();
    }
    
    console.log('Default order sources created');
  }
  
  // Insert default system settings if not exists
  const existingSetting = await db.prepare('SELECT key FROM system_settings WHERE key = ?').bind('system_title').first();
  
  if (!existingSetting) {
    await db.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES (?, ?)
    `).bind('system_title', '租车管理系统').run();
  }
  
  console.log('Database initialized successfully');
}

// Helper function to run queries with proper typing
export async function query<T = any>(db: D1Database, sql: string, params?: any[]): Promise<T[]> {
  let stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt = stmt.bind(...params);
  }
  const { results } = await stmt.all<T>();
  return results || [];
}

export async function queryOne<T = any>(db: D1Database, sql: string, params?: any[]): Promise<T | null> {
  let stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt = stmt.bind(...params);
  }
  return await stmt.first<T>();
}

export async function execute(db: D1Database, sql: string, params?: any[]): Promise<D1Result> {
  let stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt = stmt.bind(...params);
  }
  return await stmt.run();
}

// Pagination helper
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function queryWithPagination<T = any>(
  db: D1Database,
  baseSql: string,
  params: any[],
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedResult<T>> {
  const offset = (page - 1) * pageSize;
  
  // Get total count
  const countSql = `SELECT COUNT(*) as count FROM (${baseSql})`;
  const countResult = await queryOne<{ count: number }>(db, countSql, params);
  const total = countResult?.count || 0;
  
  // Get paginated data
  const dataSql = `${baseSql} LIMIT ? OFFSET ?`;
  const dataParams = [...params, pageSize, offset];
  const data = await query<T>(db, dataSql, dataParams);
  
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}
