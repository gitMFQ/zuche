import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import type { Env } from '../middleware/auth.js';

export const blacklistRoutes = new Hono();

blacklistRoutes.get('/', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const list = await db.prepare('SELECT * FROM blacklist ORDER BY created_at DESC').all();
    return c.json({ success: true, data: list.results || [] });
  } catch (error) {
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

blacklistRoutes.get('/check', authMiddleware, async (c: any) => {
  return c.json({ success: true, data: { isBlacklisted: false } });
});

blacklistRoutes.post('/', authMiddleware, async (c: any) => {
  try {
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const db = (c.env as Env).DB;
    await db.prepare('INSERT INTO blacklist (id, customer_id, customer_name, customer_phone, reason, operator_id) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, body.customer_id, body.customer_name, body.customer_phone, body.reason, body.operator_id).run();
    return c.json({ success: true, message: '已加入黑名单' });
  } catch (error) {
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

blacklistRoutes.get('/:id', authMiddleware, async (c: any) => c.json({ success: true, data: {} }));
blacklistRoutes.delete('/:id', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    await db.prepare('DELETE FROM blacklist WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ success: true, message: '已移除黑名单' });
  } catch (error) {
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});
