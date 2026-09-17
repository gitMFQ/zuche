import { Hono } from 'hono';
import { generateId, now, generateOrderNo } from '../utils/helpers.js';
import { authMiddleware } from '../middleware/auth.js';
const app = new Hono();
// 获取订单列表
app.get('/', authMiddleware, async (c) => {
    try {
        const page = Number(c.req.query('page') || '1');
        const pageSize = Number(c.req.query('pageSize') || '10');
        const status = c.req.query('status') || '';
        const keyword = c.req.query('keyword') || '';
        let sql = `SELECT o.*, 
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = o.id) as paid_amount
      FROM orders o WHERE 1=1`;
        const params = [];
        if (status) {
            sql += ' AND o.status = ?';
            params.push(status);
        }
        if (keyword) {
            sql += ' AND (o.order_no LIKE ? OR o.customer_name LIKE ? OR o.plate_number LIKE ?)';
            const likeKeyword = `%${keyword}%`;
            params.push(likeKeyword, likeKeyword, likeKeyword);
        }
        sql += ' ORDER BY o.created_at DESC';
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
        console.error('Get orders error:', error);
        return c.json({ success: false, message: '服务器错误' }, 500);
    }
});
// 获取单个订单
app.get('/:id', authMiddleware, async (c) => {
    try {
        const id = c.req.param('id');
        const order = await c.env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first();
        if (!order) {
            return c.json({ success: false, message: '订单不存在' }, 404);
        }
        const payments = await c.env.DB.prepare(`SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date DESC`).bind(id).all();
        return c.json({ success: true, data: { ...order, payments } });
    }
    catch (error) {
        console.error('Get order error:', error);
        return c.json({ success: false, message: '服务器错误' }, 500);
    }
});
// 创建订单
app.post('/', authMiddleware, async (c) => {
    try {
        const body = await c.req.json();
        const { customer_id, customer_name, customer_phone, vehicle_id, plate_number, start_date, end_date, total_amount, discount_amount, actual_amount, deposit, service_type, deposit_waived, deposit_waived_expiry, source_id, source_name, commission_rate, pickup_location, return_location, remarks } = body;
        if (!customer_name || !customer_phone || !vehicle_id || !plate_number || !start_date || !end_date) {
            return c.json({ success: false, message: '必填字段不能为空' }, 400);
        }
        const id = generateId();
        const order_no = generateOrderNo();
        const net_amount = actual_amount - (actual_amount * (commission_rate || 0) / 100);
        await c.env.DB.prepare(`INSERT INTO orders (id, order_no, customer_id, customer_name, customer_phone, vehicle_id, plate_number, start_date, end_date, total_amount, discount_amount, actual_amount, paid_amount, deposit, status, service_type, deposit_waived, deposit_waived_expiry, source_id, source_name, commission_rate, net_amount, pickup_location, return_location, remarks, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, order_no, customer_id, customer_name, customer_phone, vehicle_id, plate_number, start_date, end_date, total_amount, discount_amount, actual_amount, deposit, service_type || 'basic', deposit_waived ? 1 : 0, deposit_waived_expiry, source_id, source_name, commission_rate, net_amount, pickup_location, return_location, remarks, now(), now()).run();
        return c.json({ success: true, data: { id, order_no }, message: '订单创建成功' });
    }
    catch (error) {
        console.error('Create order error:', error);
        return c.json({ success: false, message: '服务器错误' }, 500);
    }
});
// 更新订单
app.put('/:id', authMiddleware, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const { customer_name, customer_phone, vehicle_id, plate_number, start_date, end_date, total_amount, discount_amount, actual_amount, deposit, service_type, deposit_waived, deposit_waived_expiry, remarks } = body;
        const order = await c.env.DB.prepare('SELECT id FROM orders WHERE id = ?').bind(id).first();
        if (!order) {
            return c.json({ success: false, message: '订单不存在' }, 404);
        }
        const net_amount = actual_amount - (actual_amount * (body.commission_rate || 0) / 100);
        await c.env.DB.prepare(`UPDATE orders SET customer_name = ?, customer_phone = ?, vehicle_id = ?, plate_number = ?, start_date = ?, end_date = ?, total_amount = ?, discount_amount = ?, actual_amount = ?, deposit = ?, service_type = ?, deposit_waived = ?, deposit_waived_expiry = ?, net_amount = ?, remarks = ?, updated_at = ? WHERE id = ?`).bind(customer_name, customer_phone, vehicle_id, plate_number, start_date, end_date, total_amount, discount_amount, actual_amount, deposit, service_type, deposit_waived ? 1 : 0, deposit_waived_expiry, net_amount, remarks, now(), id).run();
        return c.json({ success: true, message: '订单更新成功' });
    }
    catch (error) {
        console.error('Update order error:', error);
        return c.json({ success: false, message: '服务器错误' }, 500);
    }
});
// 取消订单
app.put('/:id/cancel', authMiddleware, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const { remarks } = body;
        await c.env.DB.prepare('UPDATE orders SET status = ?, remarks = ?, updated_at = ? WHERE id = ?')
            .bind('cancelled', remarks, now(), id).run();
        return c.json({ success: true, message: '订单已取消' });
    }
    catch (error) {
        console.error('Cancel order error:', error);
        return c.json({ success: false, message: '服务器错误' }, 500);
    }
});
export default app;
