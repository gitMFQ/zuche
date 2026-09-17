import { Hono } from 'hono';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import type { Env } from '../middleware/auth.js';

export const userRoutes = new Hono();

// 获取用户列表
userRoutes.get('/', authMiddleware, adminOnly, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const users = await db.prepare(
      'SELECT id, username, name, role, phone, email, status, created_at, updated_at FROM users ORDER BY created_at DESC'
    ).all();
    
    return c.json({
      success: true,
      data: users.results || []
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

// 获取单个用户
userRoutes.get('/:id', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const user = await db.prepare(
      'SELECT id, username, name, role, phone, email, status, created_at, updated_at FROM users WHERE id = ?'
    ).bind(c.req.param('id')).first();
    
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }
    
    return c.json({ success: true, data: user });
  } catch (error) {
    console.error('获取用户失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

// 创建用户
userRoutes.post('/', authMiddleware, adminOnly, async (c: any) => {
  try {
    const body = await c.req.json();
    const { username, password, name, role, phone, email } = body;
    
    if (!username || !password || !name) {
      return c.json({ success: false, message: '用户名、密码和姓名为必填项' }, 400);
    }
    
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    
    const db = (c.env as Env).DB;
    await db.prepare(
      'INSERT INTO users (id, username, password, name, role, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, username, hashedPassword, name, role || 'staff', phone, email).run();
    
    return c.json({ success: true, message: '用户创建成功' });
  } catch (error) {
    console.error('创建用户失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

// 更新用户
userRoutes.put('/:id', authMiddleware, adminOnly, async (c: any) => {
  try {
    const body = await c.req.json();
    const { name, role, phone, email, status } = body;
    const userId = c.req.param('id');
    
    const db = (c.env as Env).DB;
    await db.prepare(
      'UPDATE users SET name = ?, role = ?, phone = ?, email = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(name, role, phone, email, status, userId).run();
    
    return c.json({ success: true, message: '用户更新成功' });
  } catch (error) {
    console.error('更新用户失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

// 删除用户
userRoutes.delete('/:id', authMiddleware, adminOnly, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    await db.prepare('DELETE FROM users WHERE id = ?').bind(c.req.param('id')).run();
    
    return c.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

// 重置密码
userRoutes.put('/:id/reset-password', authMiddleware, adminOnly, async (c: any) => {
  try {
    const body = await c.req.json();
    const { newPassword } = body;
    
    if (!newPassword || newPassword.length < 6) {
      return c.json({ success: false, message: '密码长度至少为 6 位' }, 400);
    }
    
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const db = (c.env as Env).DB;
    await db.prepare(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(hashedPassword, c.req.param('id')).run();
    
    return c.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    console.error('重置密码失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});
