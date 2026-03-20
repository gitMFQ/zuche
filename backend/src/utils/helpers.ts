import { v4 as uuidv4 } from 'uuid';
import { getDatabase, saveDatabase } from '../db/index.js';

// 生成UUID
export function generateId(): string {
  return uuidv4();
}

// 生成订单号
export function generateOrderNo(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `R${year}${month}${day}${random}`;
}

// 格式化日期
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

// 获取当前时间
export function now(): string {
  return formatDate(new Date());
}

// 查询辅助函数
export function query(sql: string, params: any[] = []): any[] {
  const db = getDatabase();
  try {
    const result = db.exec(sql, params);
    if (result.length === 0) return [];
    
    const columns = result[0].columns;
    const values = result[0].values;
    
    return values.map(row => {
      const obj: Record<string, any> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  } catch (error) {
    console.error('查询错误:', error);
    throw error;
  }
}

// 执行SQL辅助函数
export function execute(sql: string, params: any[] = []): { changes: number; lastInsertRowId: number } {
  const db = getDatabase();
  try {
    db.run(sql, params);
    saveDatabase();
    return { changes: db.getRowsModified(), lastInsertRowId: 0 };
  } catch (error) {
    console.error('执行错误:', error);
    throw error;
  }
}

// 查询单条记录
export function queryOne(sql: string, params: any[] = []): any | null {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

// 分页查询
export function queryWithPagination(
  sql: string, 
  params: any[] = [], 
  page: number = 1, 
  pageSize: number = 10
): { data: any[]; total: number; page: number; pageSize: number; totalPages: number } {
  // 查询总数
  const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
  const countResult = queryOne(countSql, params);
  const total = countResult?.total || 0;

  // 分页查询
  const offset = (page - 1) * pageSize;
  const pagedSql = `${sql} LIMIT ${pageSize} OFFSET ${offset}`;
  const data = query(pagedSql, params);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}
