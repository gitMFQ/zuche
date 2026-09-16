-- Cloudflare D1 数据库 Schema
-- 用于租车公司管理系统

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  phone TEXT,
  email TEXT,
  status INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 客户表
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  id_card TEXT UNIQUE,
  driving_license TEXT,
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

-- 车辆表
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  license_plate TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT,
  year INTEGER,
  seats INTEGER DEFAULT 5,
  vin TEXT,
  engine_number TEXT,
  is_new_energy INTEGER DEFAULT 0,
  status TEXT DEFAULT 'available',
  mileage INTEGER DEFAULT 0,
  license_image TEXT,
  registration_image TEXT,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_no TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  service_type TEXT DEFAULT 'basic',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  actual_end_date TEXT,
  pickup_location TEXT,
  return_location TEXT,
  daily_rate REAL NOT NULL,
  days INTEGER DEFAULT 1,
  total_amount REAL NOT NULL,
  paid_amount REAL DEFAULT 0,
  deposit REAL DEFAULT 0,
  deposit_waived INTEGER DEFAULT 0,
  deposit_waived_expiry TEXT,
  pickup_mileage INTEGER,
  return_mileage INTEGER,
  pickup_image TEXT,
  return_image TEXT,
  contract_number TEXT,
  source_id TEXT,
  source_name TEXT,
  commission_rate REAL DEFAULT 0,
  net_amount REAL,
  status TEXT DEFAULT 'pending',
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 支付记录表
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  payment_type TEXT NOT NULL,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- 订单来源表
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

-- 违章记录表
CREATE TABLE IF NOT EXISTS violations (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  vehicle_id TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  plate_number TEXT NOT NULL,
  violation_type TEXT NOT NULL,
  violation_date TEXT NOT NULL,
  location TEXT,
  fine_amount REAL DEFAULT 0,
  penalty_points INTEGER DEFAULT 0,
  images TEXT,
  penalty_fee REAL DEFAULT 0,
  collected_penalty REAL DEFAULT 0,
  collected_fine REAL DEFAULT 0,
  fee_remarks TEXT,
  handle_type TEXT DEFAULT 'store',
  license_deposit REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  handle_date TEXT,
  handle_remarks TEXT,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 黑名单表
CREATE TABLE IF NOT EXISTS blacklist (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  id_card TEXT,
  reason TEXT NOT NULL,
  order_id TEXT,
  operator_id TEXT,
  operator_name TEXT,
  status INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- 保养记录表
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
  images TEXT,
  remarks TEXT,
  status TEXT DEFAULT 'completed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- 保险记录表
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
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- 年检证表
CREATE TABLE IF NOT EXISTS inspections (
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
);

-- 系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 操作日志表
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

-- 调度表
CREATE TABLE IF NOT EXISTS schedules (
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
);

-- 插入默认管理员账号
-- 密码：admin123 (实际应该使用 bcrypt 哈希，这里仅为示例)
INSERT OR IGNORE INTO users (id, username, password_hash, name, role, phone, email, status)
VALUES ('admin-uuid-placeholder', 'admin', 'admin123', '管理员', 'admin', '13800138000', 'admin@rental.com', 1);

-- 插入默认订单来源
INSERT OR IGNORE INTO order_sources (id, name, commission_rate, color, remarks, status) VALUES 
  ('source-store-uuid', '门店直租', 0, '#409EFF', '客户直接到门店租车', 1),
  ('source-meituan-uuid', '美团', 10, '#FFD700', '美团平台订单', 1),
  ('source-ctrip-uuid', '携程', 12, '#0066CC', '携程平台订单', 1),
  ('source-didi-uuid', '滴滴', 15, '#FF6B35', '滴滴租车平台订单', 1),
  ('source-other-uuid', '其他', 0, '#999999', '其他渠道', 1);

-- 插入示例车辆
INSERT OR IGNORE INTO vehicles (id, license_plate, brand, model, color, year, seats, status) VALUES 
  ('vehicle-1-uuid', '京 A12345', '丰田', '凯美瑞', '白色', 2023, 5, 'available'),
  ('vehicle-2-uuid', '京 B67890', '本田', '雅阁', '黑色', 2022, 5, 'available'),
  ('vehicle-3-uuid', '京 C11111', '大众', '帕萨特', '银色', 2023, 5, 'available');

-- 插入示例客户
INSERT OR IGNORE INTO customers (id, name, phone, id_card, status) VALUES 
  ('customer-1-uuid', '张三', '13900001111', '110101199001011234', 1),
  ('customer-2-uuid', '李四', '13900002222', '110101199002021234', 1);

-- 插入默认系统设置
INSERT OR IGNORE INTO system_settings (key, value) VALUES 
  ('system_title', '租车管理系统'),
  ('theme_color', '#0071e3'),
  ('sidebar_style', 'default');
