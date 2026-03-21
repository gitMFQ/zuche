import initSqlJs, { Database } from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_DIR = join(__dirname, '../../data');
const DB_PATH = join(DB_DIR, 'rental.db');

let db: Database | null = null;

// 初始化数据库
export async function initDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();
  
  // 确保数据目录存在
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  // 尝试加载现有数据库
  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    // 执行迁移
    runMigrations(db);
  } else {
    db = new SQL.Database();
    createTables(db);
    insertInitialData(db);
  }

  console.log('数据库初始化成功');
  return db;
}

// 执行数据库迁移
function runMigrations(db: Database): void {
  try {
    // 检查订单表是否有 source_id 字段
    const orderColumns = db.exec("PRAGMA table_info(orders)");
    if (orderColumns.length > 0) {
      const columns = orderColumns[0].values.map(col => col[1]);
      
      if (!columns.includes('source_id')) {
        db.run('ALTER TABLE orders ADD COLUMN source_id TEXT');
      }
      if (!columns.includes('source_name')) {
        db.run('ALTER TABLE orders ADD COLUMN source_name TEXT');
      }
      if (!columns.includes('commission_rate')) {
        db.run('ALTER TABLE orders ADD COLUMN commission_rate REAL DEFAULT 0');
      }
      if (!columns.includes('net_amount')) {
        db.run('ALTER TABLE orders ADD COLUMN net_amount REAL');
      }
      if (!columns.includes('service_type')) {
        db.run("ALTER TABLE orders ADD COLUMN service_type TEXT DEFAULT 'basic'");
        console.log('已添加service_type字段到订单表');
      }
      if (!columns.includes('deposit_waived')) {
        db.run('ALTER TABLE orders ADD COLUMN deposit_waived INTEGER DEFAULT 0');
        console.log('已添加deposit_waived字段到订单表');
      }
      if (!columns.includes('deposit_waived_expiry')) {
        db.run('ALTER TABLE orders ADD COLUMN deposit_waived_expiry TEXT');
        console.log('已添加deposit_waived_expiry字段到订单表');
      }
      if (!columns.includes('pickup_mileage')) {
        db.run('ALTER TABLE orders ADD COLUMN pickup_mileage INTEGER');
        console.log('已添加pickup_mileage字段到订单表');
      }
      if (!columns.includes('return_mileage')) {
        db.run('ALTER TABLE orders ADD COLUMN return_mileage INTEGER');
        console.log('已添加return_mileage字段到订单表');
      }
      if (!columns.includes('pickup_image')) {
        db.run('ALTER TABLE orders ADD COLUMN pickup_image TEXT');
        console.log('已添加pickup_image字段到订单表');
      }
      if (!columns.includes('return_image')) {
        db.run('ALTER TABLE orders ADD COLUMN return_image TEXT');
        console.log('已添加return_image字段到订单表');
      }
    }
    
    // 检查订单来源表是否存在
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='order_sources'");
    if (tables.length === 0) {
      db.run(`
        CREATE TABLE IF NOT EXISTS order_sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          commission_rate REAL DEFAULT 0,
          color TEXT DEFAULT '#409EFF',
          remarks TEXT,
          status INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    
    // 检查订单来源表是否有 color 字段
    const sourceColumns = db.exec("PRAGMA table_info(order_sources)");
    if (sourceColumns.length > 0) {
      const columns = sourceColumns[0].values.map((col: any) => col[1]);
      if (!columns.includes('color')) {
        db.run('ALTER TABLE order_sources ADD COLUMN color TEXT DEFAULT "#409EFF"');
        console.log('已添加color字段到订单来源表');
      }
    }
    
    // 检查订单来源表是否为空，如果为空则插入默认数据
    const sourceCount = db.exec("SELECT COUNT(*) FROM order_sources");
    if (sourceCount.length > 0 && sourceCount[0].values[0][0] === 0) {
      const defaultSources = [
        { id: uuidv4(), name: '门店直租', commission_rate: 0, remarks: '客户直接到门店租车' },
        { id: uuidv4(), name: '美团', commission_rate: 10, remarks: '美团平台订单' },
        { id: uuidv4(), name: '携程', commission_rate: 12, remarks: '携程平台订单' },
        { id: uuidv4(), name: '滴滴', commission_rate: 15, remarks: '滴滴租车平台订单' },
        { id: uuidv4(), name: '其他', commission_rate: 0, remarks: '其他渠道' },
      ];
      
      defaultSources.forEach(s => {
        db.run(
          'INSERT INTO order_sources (id, name, commission_rate, remarks, status) VALUES (?, ?, ?, ?, 1)',
          [s.id, s.name, s.commission_rate, s.remarks]
        );
      });
      console.log('已插入默认订单来源数据');
    }
    
    // 检查保养表是否存在
    const maintenanceTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='maintenance'");
    if (maintenanceTable.length === 0) {
      db.run(`
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
          FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        )
      `);
      console.log('已创建保养表');
    }
    
    // 检查保险表是否存在
    const insuranceTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='insurance'");
    if (insuranceTable.length === 0) {
      db.run(`
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
          FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        )
      `);
      console.log('已创建保险表');
    }
    
    // 检查年检证表是否存在
    const inspectionTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='inspections'");
    if (inspectionTable.length === 0) {
      db.run(`
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
        )
      `);
      console.log('已创建年检证表');
    } else {
      // 检查inspections表是否有certificate_image字段
      const inspectionColumns = db.exec("PRAGMA table_info(inspections)");
      if (inspectionColumns.length > 0) {
        const columns = inspectionColumns[0].values.map((col: any) => col[1]);
        if (!columns.includes('certificate_image')) {
          db.run('ALTER TABLE inspections ADD COLUMN certificate_image TEXT');
          console.log('已添加certificate_image字段到年检证表');
        }
      }
    }
    
    // 检查违章表是否有images字段
    const violationColumns = db.exec("PRAGMA table_info(violations)");
    if (violationColumns.length > 0) {
      const columns = violationColumns[0].values.map((col: any) => col[1]);
      if (!columns.includes('images')) {
        db.run('ALTER TABLE violations ADD COLUMN images TEXT');
        console.log('已添加images字段到违章表');
      }
    }
    
    // 检查insurance表是否有documents字段
    const insuranceColumns = db.exec("PRAGMA table_info(insurance)");
    if (insuranceColumns.length > 0) {
      const columns = insuranceColumns[0].values.map((col: any) => col[1]);
      if (!columns.includes('documents')) {
        db.run('ALTER TABLE insurance ADD COLUMN documents TEXT');
        console.log('已添加documents字段到保险表');
      }
    }
    
    // 检查maintenance表是否有images字段
    const maintenanceColumns = db.exec("PRAGMA table_info(maintenance)");
    if (maintenanceColumns.length > 0) {
      const columns = maintenanceColumns[0].values.map((col: any) => col[1]);
      if (!columns.includes('images')) {
        db.run('ALTER TABLE maintenance ADD COLUMN images TEXT');
        console.log('已添加images字段到保养表');
      }
    }
    
    // 检查vehicles表是否有新字段
    const vehicleColumns = db.exec("PRAGMA table_info(vehicles)");
    if (vehicleColumns.length > 0) {
      const columns = vehicleColumns[0].values.map((col: any) => col[1]);
      if (!columns.includes('vin')) {
        db.run('ALTER TABLE vehicles ADD COLUMN vin TEXT');
        console.log('已添加vin字段到车辆表');
      }
      if (!columns.includes('engine_number')) {
        db.run('ALTER TABLE vehicles ADD COLUMN engine_number TEXT');
        console.log('已添加engine_number字段到车辆表');
      }
      if (!columns.includes('license_image')) {
        db.run('ALTER TABLE vehicles ADD COLUMN license_image TEXT');
        console.log('已添加license_image字段到车辆表');
      }
      if (!columns.includes('registration_image')) {
        db.run('ALTER TABLE vehicles ADD COLUMN registration_image TEXT');
        console.log('已添加registration_image字段到车辆表');
      }
      if (!columns.includes('is_new_energy')) {
        db.run('ALTER TABLE vehicles ADD COLUMN is_new_energy INTEGER DEFAULT 0');
        console.log('已添加is_new_energy字段到车辆表');
      }
    }
    
    // 检查customers表是否有照片字段
    const customerColumns = db.exec("PRAGMA table_info(customers)");
    if (customerColumns.length > 0) {
      const columns = customerColumns[0].values.map((col: any) => col[1]);
      if (!columns.includes('id_card_images')) {
        db.run('ALTER TABLE customers ADD COLUMN id_card_images TEXT');
        console.log('已添加id_card_images字段到客户表');
      }
      if (!columns.includes('license_images')) {
        db.run('ALTER TABLE customers ADD COLUMN license_images TEXT');
        console.log('已添加license_images字段到客户表');
      }
      if (!columns.includes('is_regular')) {
        db.run('ALTER TABLE customers ADD COLUMN is_regular INTEGER DEFAULT 0');
        console.log('已添加is_regular字段到客户表');
      }
    }
    
    // 检查系统设置表是否存在
    const settingsTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'");
    if (settingsTable.length === 0) {
      db.run(`
        CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // 插入默认系统标题
      db.run("INSERT INTO system_settings (key, value) VALUES ('system_title', '租车管理系统')");
      console.log('已创建系统设置表');
    }
    
    saveDatabase();
  } catch (error) {
    console.error('数据库迁移错误:', error);
  }
}

// 保存数据库到文件
export function saveDatabase(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
  }
}

// 获取数据库实例
export function getDatabase(): Database {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
}

// 创建表结构
function createTables(db: Database): void {
  // 用户表
  db.run(`
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
    )
  `);

  // 客户表
  db.run(`
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
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 车辆表
  db.run(`
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
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 订单表
  db.run(`
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
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 支付记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_type TEXT NOT NULL,
      remarks TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  // 操作日志表
  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 违章记录表
  db.run(`
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
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  // 黑名单表
  db.run(`
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
    )
  `);

  // 订单来源表
  db.run(`
    CREATE TABLE IF NOT EXISTS order_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      commission_rate REAL DEFAULT 0,
      remarks TEXT,
      status INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 保养记录表
  db.run(`
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
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )
  `);

  // 保险记录表
  db.run(`
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
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )
  `);

  // 年检证记录表
  db.run(`
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
    )
  `);

  saveDatabase();
}

// 插入初始数据
function insertInitialData(db: Database): void {
  // 创建管理员账号
  const adminId = uuidv4();
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  
  db.run(`
    INSERT INTO users (id, username, password, name, role, phone, email, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [adminId, 'admin', hashedPassword, '管理员', 'admin', '13800138000', 'admin@rental.com', 1]);

  // 插入示例车辆
  const vehicles = [
    { id: uuidv4(), plate: '京A12345', brand: '丰田', model: '凯美瑞', color: '白色', year: 2023, seats: 5, rate: 280, deposit: 2000 },
    { id: uuidv4(), plate: '京B67890', brand: '本田', model: '雅阁', color: '黑色', year: 2022, seats: 5, rate: 260, deposit: 1800 },
    { id: uuidv4(), plate: '京C11111', brand: '大众', model: '帕萨特', color: '银色', year: 2023, seats: 5, rate: 250, deposit: 1500 },
  ];

  vehicles.forEach(v => {
    db.run(`
      INSERT INTO vehicles (id, plate_number, brand, model, color, year, seats, daily_rate, deposit, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [v.id, v.plate, v.brand, v.model, v.color, v.year, v.seats, v.rate, v.deposit, 'available']);
  });

  // 插入示例客户
  const customers = [
    { id: uuidv4(), name: '张三', phone: '13900001111', idCard: '110101199001011234' },
    { id: uuidv4(), name: '李四', phone: '13900002222', idCard: '110101199002021234' },
  ];

  customers.forEach(c => {
    db.run(`
      INSERT INTO customers (id, name, phone, id_card, status)
      VALUES (?, ?, ?, ?, ?)
    `, [c.id, c.name, c.phone, c.idCard, 1]);
  });

  // 插入默认订单来源
  const orderSources = [
    { id: uuidv4(), name: '门店直租', commission_rate: 0, remarks: '客户直接到门店租车' },
    { id: uuidv4(), name: '美团', commission_rate: 10, remarks: '美团平台订单' },
    { id: uuidv4(), name: '携程', commission_rate: 12, remarks: '携程平台订单' },
    { id: uuidv4(), name: '滴滴', commission_rate: 15, remarks: '滴滴租车平台订单' },
    { id: uuidv4(), name: '其他', commission_rate: 0, remarks: '其他渠道' },
  ];

  orderSources.forEach(s => {
    db.run(`
      INSERT INTO order_sources (id, name, commission_rate, remarks, status)
      VALUES (?, ?, ?, ?, 1)
    `, [s.id, s.name, s.commission_rate, s.remarks]);
  });

  saveDatabase();
  console.log('初始数据插入成功');
}
