import { Hono } from 'hono';
import { generateId, now } from '../utils/helpers.js';
import { authMiddleware } from '../middleware/auth.js';
const app = new Hono();
// 获取违章列表
app.get('/', authMiddleware, async (c) => {
    try {
        const page = Number(c.req.query('page') || '1');
        const pageSize = Number(c.req.query('pageSize') || '10');
        const status = c.req.query('status') || '';
        let sql = 'SELECT * FROM violations WHERE 1=1';
        const params = [];
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }
        sql += ' ORDER BY created_at DESC';
        const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
        const countResult = await c.env.DB.prepare(countSql).bind(...params).first();
        const total = countResult?.total || 0;
        const offset = (page - 1) * pageSize;
        const pagedSql = `${sql} LIMIT ${pageSize} OFFSET ${offset}`;
        const data = await c.env.DB.prepare(pagedSql).bind(...params).all();
        return c.json({
            success: true,
            data: { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
        });
    }
    catch (error) {
        console.error('Get violations error:', error);
        return c.json({ success: false, message: '服务器错误' }, 500);
    }
});
// 创建违章
app.post('/', authMiddleware, async (c) => {
    try {
        const body = await c.req.json();
        const { order_id, vehicle_id, plate_number, violation_date, type, description, fine, points, images } = body;
        if (!order_id || !vehicle_id || !plate_number || !violation_date) {
            return c.json({ success: false, message: '必填字段不能为空' }, 400);
        }
        const id = generateId();
        await c.env.DB.prepare(`INSERT INTO violations (id, order_id, vehicle_id, plate_number, violation_date, type, description, fine, points, images, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`).bind(id, order_id, vehicle_id, plate_number, violation_date, type, description, fine, points, images, now(), now()).run();
        return c.json({ success: true, data: { id }, message: '违章记录创建成功' });
    }
    catch (error) {
        console.error('Create violation error:', error);
        return c.json({ success: false, message: '服务器错误' }, 500);
    }
});
// 处理违章
app.put('/:id/handle', authMiddleware, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const { status, handle_remarks } = body;
        await c.env.DB.prepare('UPDATE violations SET status = ?, handle_remarks = ?, updated_at = ? WHERE id = ?')
            .bind(status, handle_remarks, now(), id).run();
        return c.json({ success: true, message: '违章处理成功' });
    }
    catch (error) {
        console.error('Handle violation error:', error);
        return c.json({ success: false, message: '服务器错误' }, 500);
    }
});
// 删除违章
app.delete('/:id', authMiddleware, async (c) => {
    try {
        const id = c.req.param('id');
        await c.env.DB.prepare('DELETE FROM violations WHERE id = ?').bind(id).run();
        return c.json({ success: true, message: '违章记录删除成功' });
    }
    catch (error) {
        console.error('Delete violation error:', error);
        return c.json({ success: false, message: '服务器错误' }, 500);
    }
});
export default app;
