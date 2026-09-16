-- Users table
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

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  plate_number TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT NOT NULL,
  year INTEGER NOT NULL,
  seats INTEGER NOT NULL,
  mileage INTEGER DEFAULT 0,
  status TEXT DEFAULT 'available',
  daily_rate REAL NOT NULL,
  vin TEXT,
  engine_number TEXT,
  license_image TEXT,
  registration_image TEXT,
  is_new_energy INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  total_amount REAL NOT NULL,
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
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- Payments table
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

-- Order sources table
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

-- Violations table
CREATE TABLE IF NOT EXISTS violations (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  vehicle_id TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  violation_date TEXT NOT NULL,
  description TEXT NOT NULL,
  fine REAL DEFAULT 0,
  points INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  images TEXT,
  penalty_fee REAL DEFAULT 0,
  collected_penalty REAL DEFAULT 0,
  collected_fine REAL DEFAULT 0,
  fee_remarks TEXT,
  handle_type TEXT DEFAULT 'store',
  license_deposit REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- Blacklist table
CREATE TABLE IF NOT EXISTS blacklist (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  id_card TEXT,
  reason TEXT NOT NULL,
  order_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Maintenance table
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
  images TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- Insurance table
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
  documents TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- Inspections table
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

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Operation logs table
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

-- Schedules table
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
