import { D1Database } from '@cloudflare/workers-types';
import schema from './schema.sql';

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  JWT_SECRET: string;
}

// Initialize database with schema and seed data
export async function initDatabase(db: D1Database): Promise<void> {
  // Split by semicolons and execute each statement
  const statements = schema.split(';').filter(s => s.trim().length > 0);
  
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
