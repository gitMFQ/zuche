-- 租车管理系统 D1 初始结构
-- 说明：本文件已把原 backend/src/db/index.ts 中 createTables 的定义
--       与 runMigrations 里所有 ALTER TABLE 累加到列的终态，无需再跑增量迁移。
--
-- 外键策略（D1 外键始终开启，无法关闭，因此这里必须显式决定级联行为）：
--   * orders 对 customers/vehicles/users 刻意不声明外键 —— 原业务逻辑允许删除
--     只有「已完成/已取消」订单的车辆、客户和用户（删除前只拦截 pending/active），
--     声明外键会把这个既定业务规则改成禁止删除。
--   * 依附于车辆的明细表（违章/保养/保险/年检）与支付记录用 CASCADE，
--     删除主记录时一并清理，避免出现孤儿数据。
--   * 可空的客户引用（违章、黑名单）用 SET NULL，删除客户不影响历史记录。

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

CREATE TABLE IF NOT EXISTS customers (
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
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  plate_number TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT,
  year INTEGER,
  seats INTEGER DEFAULT 5,
  daily_rate REAL NOT NULL,
  deposit REAL DEFAULT 0,
  status TEXT DEFAULT 'available',
  mileage INTEGER DEFAULT 0,
  last_maintenance TEXT,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  vin TEXT,
  engine_number TEXT,
  license_image TEXT,
  registration_image TEXT,
  is_new_energy INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_no TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  actual_end_date TEXT,
  daily_rate REAL NOT NULL,
  deposit REAL DEFAULT 0,
  total_amount REAL NOT NULL,
  paid_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  source_id TEXT,
  source_name TEXT,
  commission_rate REAL DEFAULT 0,
  net_amount REAL,
  service_type TEXT DEFAULT 'basic',
  deposit_waived INTEGER DEFAULT 0,
  deposit_waived_expiry TEXT,
  pickup_mileage INTEGER,
  return_mileage INTEGER,
  pickup_image TEXT,
  return_image TEXT,
  contract_number TEXT,
  pickup_location TEXT,
  return_location TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  payment_type TEXT NOT NULL,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

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
  status TEXT DEFAULT 'pending',
  handle_date TEXT,
  handle_remarks TEXT,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  penalty_fee REAL DEFAULT 0,
  collected_penalty REAL DEFAULT 0,
  collected_fine REAL DEFAULT 0,
  fee_remarks TEXT,
  handle_type TEXT DEFAULT 'store',
  license_deposit REAL DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

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
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

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
  status TEXT DEFAULT 'completed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  images TEXT,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

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
  remarks TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  documents TEXT,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

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
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

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
