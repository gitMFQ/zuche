-- 创建用户表
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

-- 创建客户表
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

-- 创建车辆表
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  plate_number TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT,
  year INTEGER,
  seats INTEGER DEFAULT 5,
  mileage INTEGER DEFAULT 0,
  daily_rate REAL DEFAULT 0,
  status TEXT DEFAULT 'available',
  is_new_energy INTEGER DEFAULT 0,
  vin TEXT,
  engine_number TEXT,
  license_image TEXT,
  registration_image TEXT,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 创建订单表
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_no TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  total_amount REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  actual_amount REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  deposit REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  service_type TEXT DEFAULT 'basic',
  deposit_waived INTEGER DEFAULT 0,
  deposit_waived_expiry TEXT,
  source_id TEXT,
  source_name TEXT,
  commission_rate REAL DEFAULT 0,
  net_amount REAL,
  pickup_mileage INTEGER,
  return_mileage INTEGER,
  pickup_image TEXT,
  return_image TEXT,
  contract_number TEXT,
  pickup_location TEXT,
  return_location TEXT,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 创建支付记录表
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  payment_type TEXT NOT NULL,
  payment_date TEXT NOT NULL,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- 创建订单来源表
CREATE TABLE IF NOT EXISTS order_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  commission_rate REAL DEFAULT 0,
  color TEXT DEFAULT '#409EFF',
  remarks TEXT,
  status INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 创建违章记录表
CREATE TABLE IF NOT EXISTS violations (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  violation_date TEXT NOT NULL,
  type TEXT,
  description TEXT,
  fine REAL DEFAULT 0,
  points INTEGER DEFAULT 0,
  images TEXT,
  penalty_fee REAL DEFAULT 0,
  collected_penalty REAL DEFAULT 0,
  collected_fine REAL DEFAULT 0,
  fee_remarks TEXT,
  handle_type TEXT DEFAULT 'store',
  license_deposit REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  handle_remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 创建黑名单表
CREATE TABLE IF NOT EXISTS blacklist (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  id_card TEXT,
  reason TEXT NOT NULL,
  order_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 创建保养记录表
CREATE TABLE IF NOT EXISTS maintenance (
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
  images TEXT,
  status TEXT DEFAULT 'completed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 创建保险记录表
CREATE TABLE IF NOT EXISTS insurance (
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
  documents TEXT,
  remarks TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 创建年检证表
CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  certificate_image TEXT,
  remarks TEXT,
  status TEXT DEFAULT 'valid',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 创建系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 创建操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认管理员用户
INSERT OR IGNORE INTO users (id, username, password, name, role, status) 
VALUES ('admin-uuid', 'admin', '$2a$10$rHxVXfM3c.qPJnqKxqNwW.vZLhQJ8KqGvKxPqKxqNwW.vZLhQJ8Kq', '管理员', 'admin', 1);

-- 插入默认订单来源
INSERT OR IGNORE INTO order_sources (id, name, commission_rate, remarks, status, color) VALUES 
('source-1', '门店直租', 0, '客户直接到门店租车', 1, '#409EFF'),
('source-2', '美团', 10, '美团平台订单', 1, '#FF6B6B'),
('source-3', '携程', 12, '携程平台订单', 1, '#4ECDC4'),
('source-4', '滴滴', 15, '滴滴租车平台订单', 1, '#FFE66D'),
('source-5', '其他', 0, '其他渠道', 1, '#95A5A6');

-- 插入默认系统设置
INSERT OR IGNORE INTO system_settings (key, value) VALUES 
('system_title', '租车管理系统'),
('theme_color', '#0071e3'),
('sidebar_style', 'default');
