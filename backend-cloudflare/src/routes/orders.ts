import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import type { Env } from '../middleware/auth.js';

export const orderRoutes = new Hono();

orderRoutes.get('/', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const orders = await db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    return c.json({ success: true, data: orders.results || [] });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

orderRoutes.get('/:id', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(c.req.param('id')).first();
    if (!order) return c.json({ success: false, message: '订单不存在' }, 404);
    return c.json({ success: true, data: order });
  } catch (error) {
    console.error('获取订单失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

orderRoutes.post('/', authMiddleware, async (c: any) => {
  try {
    const body = await c.req.json();
    const { customer_id, customer_name, customer_phone, vehicle_id, plate_number, pickup_time, return_time, pickup_location, return_location, daily_rate, days, total_amount, discount, final_amount, deposit_amount, service_type, source_id, source_name, commission_rate, contract_number, remarks } = body;
    
    if (!customer_id || !vehicle_id || !pickup_time || !return_time) {
      return c.json({ success: false, message: '客户、车辆、取还车时间为必填项' }, 400);
    }
    
    const orderId = crypto.randomUUID();
    const netAmount = final_amount * (1 - (commission_rate || 0) / 100);
    
    const db = (c.env as Env).DB;
    await db.prepare(
      `INSERT INTO orders (id, customer_id, customer_name, customer_phone, vehicle_id, plate_number, pickup_time, return_time, pickup_location, return_location, daily_rate, days, total_amount, discount, final_amount, deposit_amount, service_type, source_id, source_name, commission_rate, net_amount, contract_number, remarks, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(orderId, customer_id, customer_name, customer_phone, vehicle_id, plate_number, pickup_time, return_time, pickup_location, return_location, daily_rate, days, total_amount, discount, final_amount, deposit_amount, service_type || 'basic', source_id, source_name, commission_rate || 0, netAmount, contract_number, remarks).run();
    
    // 更新车辆状态
    await db.prepare("UPDATE vehicles SET status = 'rented' WHERE id = ?").bind(vehicle_id).run();
    
    return c.json({ success: true, message: '订单创建成功', data: { id: orderId } });
  } catch (error) {
    console.error('创建订单失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

orderRoutes.put('/:id', authMiddleware, async (c: any) => {
  try {
    const body = await c.req.json();
    const { daily_rate, days, total_amount, discount, final_amount, deposit_amount, remarks } = body;
    const orderId = c.req.param('id');
    
    const db = (c.env as Env).DB;
    await db.prepare(
      'UPDATE orders SET daily_rate = ?, days = ?, total_amount = ?, discount = ?, final_amount = ?, deposit_amount = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(daily_rate, days, total_amount, discount, final_amount, deposit_amount, remarks, orderId).run();
    
    return c.json({ success: true, message: '订单更新成功' });
  } catch (error) {
    console.error('更新订单失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

orderRoutes.put('/:id/extend', authMiddleware, async (c: any) => {
  try {
    const body = await c.req.json();
    const { return_time, extra_days, extra_amount } = body;
    const orderId = c.req.param('id');
    
    const db = (c.env as Env).DB;
    await db.prepare(
      'UPDATE orders SET return_time = ?, days = days + ?, final_amount = final_amount + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(return_time, extra_days, extra_amount, orderId).run();
    
    return c.json({ success: true, message: '订单延期成功' });
  } catch (error) {
    console.error('订单延期失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

orderRoutes.put('/:id/cancel', authMiddleware, async (c: any) => {
  try {
    const orderId = c.req.param('id');
    const db = (c.env as Env).DB;
    
    const order = await db.prepare('SELECT vehicle_id, status FROM orders WHERE id = ?').bind(orderId).first();
    if (!order) return c.json({ success: false, message: '订单不存在' }, 404);
    
    await db.prepare("UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(orderId).run();
    
    // 如果订单未取车，释放车辆
    if (order.status === 'pending') {
      await db.prepare("UPDATE vehicles SET status = 'available' WHERE id = ?").bind(order.vehicle_id).run();
    }
    
    return c.json({ success: true, message: '订单取消成功' });
  } catch (error) {
    console.error('取消订单失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

orderRoutes.post('/:id/payments', authMiddleware, async (c: any) => {
  try {
    const body = await c.req.json();
    const { amount, payment_type, payment_method, remark } = body;
    const orderId = c.req.param('id');
    
    if (!amount || !payment_type || !payment_method) {
      return c.json({ success: false, message: '金额、支付类型和支付方式为必填项' }, 400);
    }
    
    const paymentId = crypto.randomUUID();
    const db = (c.env as Env).DB;
    await db.prepare(
      'INSERT INTO payments (id, order_id, amount, payment_type, payment_method, remark) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(paymentId, orderId, amount, payment_type, payment_method, remark).run();
    
    return c.json({ success: true, message: '支付记录添加成功' });
  } catch (error) {
    console.error('添加支付记录失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

export default orderRoutes;
