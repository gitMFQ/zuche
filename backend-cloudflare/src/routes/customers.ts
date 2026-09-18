import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import type { Env } from '../middleware/auth.js';

export const customerRoutes = new Hono();

// 获取客户列表
customerRoutes.get('/', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const customers = await db.prepare(
      'SELECT * FROM customers ORDER BY created_at DESC'
    ).all();
    
    return c.json({
      success: true,
      data: customers.results || []
    });
  } catch (error) {
    console.error('获取客户列表失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

// 获取常用客户
customerRoutes.get('/regular', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const customers = await db.prepare(
      'SELECT * FROM customers WHERE is_regular = 1 ORDER BY created_at DESC'
    ).all();
    
    return c.json({
      success: true,
      data: customers.results || []
    });
  } catch (error) {
    console.error('获取常用客户失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

// 获取单个客户
customerRoutes.get('/:id', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const customer = await db.prepare(
      'SELECT * FROM customers WHERE id = ?'
    ).bind(c.req.param('id')).first();
    
    if (!customer) {
      return c.json({ success: false, message: '客户不存在' }, 404);
    }
    
    return c.json({ success: true, data: customer });
  } catch (error) {
    console.error('获取客户失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

// 创建客户
customerRoutes.post('/', authMiddleware, async (c: any) => {
  try {
    const body = await c.req.json();
    const { name, phone, id_card, license_number, license_expiry, address, remarks } = body;
    
    if (!name || !phone) {
      return c.json({ success: false, message: '姓名和电话为必填项' }, 400);
    }
    
    const customerId = crypto.randomUUID();
    const db = (c.env as Env).DB;
    
    await db.prepare(
      'INSERT INTO customers (id, name, phone, id_card, license_number, license_expiry, address, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(customerId, name, phone, id_card, license_number, license_expiry, address, remarks).run();
    
    return c.json({ success: true, message: '客户创建成功' });
  } catch (error) {
    console.error('创建客户失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

// 更新客户
customerRoutes.put('/:id', authMiddleware, async (c: any) => {
  try {
    const body = await c.req.json();
    const { name, phone, id_card, license_number, license_expiry, address, remarks, status } = body;
    const customerId = c.req.param('id');
    
    const db = (c.env as Env).DB;
    await db.prepare(
      'UPDATE customers SET name = ?, phone = ?, id_card = ?, license_number = ?, license_expiry = ?, address = ?, remarks = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(name, phone, id_card, license_number, license_expiry, address, remarks, status, customerId).run();
    
    return c.json({ success: true, message: '客户更新成功' });
  } catch (error) {
    console.error('更新客户失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

// 设置常用客户
customerRoutes.put('/:id/regular', authMiddleware, async (c: any) => {
  try {
    const body = await c.req.json();
    const { isRegular } = body;
    const customerId = c.req.param('id');
    
    const db = (c.env as Env).DB;
    await db.prepare(
      'UPDATE customers SET is_regular = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(isRegular ? 1 : 0, customerId).run();
    
    return c.json({ success: true, message: '客户状态更新成功' });
  } catch (error) {
    console.error('更新客户状态失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

// 删除客户
customerRoutes.delete('/:id', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    await db.prepare('DELETE FROM customers WHERE id = ?').bind(c.req.param('id')).run();
    
    return c.json({ success: true, message: '客户删除成功' });
  } catch (error) {
    console.error('删除客户失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});
