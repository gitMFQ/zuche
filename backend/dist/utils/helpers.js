import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/index.js';
// 生成UUID
export function generateId() {
    return uuidv4();
}
// 生成订单号
export function generateOrderNo() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `R${year}${month}${day}${random}`;
}
// 格式化日期
export function formatDate(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().replace('T', ' ').substring(0, 19);
}
// 获取当前时间
export function now() {
    return formatDate(new Date());
}
// 记录操作日志
export function logAction(userId, action, entityType, entityId, details, ipAddress) {
    try {
        const db = getDatabase();
        const id = generateId();
        const currentTime = now();
        db.prepare(`INSERT INTO operation_logs (id, user_id, action, entity_type, entity_id, details, ip_address, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, userId || null, action, entityType || null, entityId || null, details || null, ipAddress || null, currentTime);
    }
    catch (error) {
        // 日志记录失败不应影响主业务
        console.error('记录日志失败:', error);
    }
}
// 查询辅助函数 - 返回所有匹配行
export function query(sql, params = []) {
    const db = getDatabase();
    try {
        const stmt = db.prepare(sql);
        return stmt.all(...params);
    }
    catch (error) {
        console.error('查询错误:', error);
        throw error;
    }
}
// 执行SQL辅助函数 - 用于 INSERT, UPDATE, DELETE
export function execute(sql, params = []) {
    const db = getDatabase();
    try {
        const stmt = db.prepare(sql);
        const info = stmt.run(...params);
        return {
            changes: info.changes,
            lastInsertRowId: info.lastInsertRowid
        };
    }
    catch (error) {
        console.error('执行错误:', error);
        throw error;
    }
}
// 查询单条记录
export function queryOne(sql, params = []) {
    const db = getDatabase();
    try {
        const stmt = db.prepare(sql);
        return stmt.get(...params) || null;
    }
    catch (error) {
        console.error('查询错误:', error);
        throw error;
    }
}
// 分页查询
export function queryWithPagination(sql, params = [], page = 1, pageSize = 10) {
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
