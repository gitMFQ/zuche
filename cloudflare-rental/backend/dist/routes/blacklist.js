import { Hono } from 'hono';
import { generateId, now } from '../utils/helpers.js';
import { authMiddleware } from '../middleware/auth.js';
const app = new Hono();
// 获取黑名单列表
app.get('/', authMiddleware, async (c) => {
    try {
        const page = Number(c.req.query('page') || '1');
        const pageSize = Number(c.req.query('pageSize') || '10');
        const keyword = c.req.query('keyword') || '';
        let sql = 'SELECT * FROM blacklist WHERE 1=1';
        const params = [];
        if (keyword) {
            sql += ' AND (name LIKE ? OR phone LIKE ?)';
            const likeKeyword = `%${keyword}%`;
            params.push(likeKeyword, likeKeyword);
        }
        sql += ' ORDER BY created_at DESC';
        const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
        const countResult = await c.env.DB.prepare(countSql).bind(...params).first();
        const total = countResult?.total || 0;
        const offset = (page - 1) * pageSize;
        const pagedSql = `${sql} LIMIT ${pageSize} OFFSET ${offset}`;
        const data = await c.env.DB.prepare(pagedSql).bind(...params).all();
        return c.json({ success: true, data: { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
    }
    catch (error) {
        console.error('Get blacklist error:', error);
        return c.json({ success: false, message: '服务器错误' }, 500);
    }
});
// 添加黑名单
app.post('/', authMiddleware, async (c) => {
    try {
        const body = await c.req.json();
        const { customer_id, name, phone, id_card, reason, order_id } = body;
        if (!name || !phone || !reason) {
            return c.json({ success: false, message: '必填字段不能为空' }, 400);
        }
        const id = generateId();
        await c.env.DB.prepare(`INSERT INTO blacklist (id, customer_id, name, phone, id_card, reason, order_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, customer_id, name, phone, id_card, reason, order_id, now()).run();
        return c.json({ success: true, data: { id }, message: '已加入黑名单' });
    }
    catch (error) {
        console.error('Add blacklist error:', error);
        return c.json({ success: false, message: '服务器错误' }, 500);
    }
});
// 移除黑名单
app.delete('/:id', authMiddleware, async (c) => {
    try {
        const id = c.req.param('id');
        await c.env.DB.prepare('DELETE FROM blacklist WHERE id = ?').bind(id).run();
        return c.json({ success: true, message: '已移出黑名单' });
    }
    catch (error) {
        console.error('Remove blacklist error:', error);
        return c.json({ success: false, message: '服务器错误' }, 500);
    }
});
export default app;
