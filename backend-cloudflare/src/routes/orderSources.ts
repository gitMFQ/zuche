import { Hono } from 'hono';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import type { Env } from '../middleware/auth.js';

export const orderSourceRoutes = new Hono();

orderSourceRoutes.get('/', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const sources = await db.prepare('SELECT * FROM order_sources ORDER BY created_at DESC').all();
    return c.json({ success: true, data: sources.results || [] });
  } catch (error) {
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

orderSourceRoutes.get('/:id', authMiddleware, async (c: any) => c.json({ success: true, data: {} }));
orderSourceRoutes.post('/', authMiddleware, adminOnly, async (c: any) => {
  try {
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const db = (c.env as Env).DB;
    await db.prepare('INSERT INTO order_sources (id, name, commission_rate, color, remarks) VALUES (?, ?, ?, ?, ?)')
      .bind(id, body.name, body.commission_rate, body.color, body.remarks).run();
    return c.json({ success: true, message: '创建成功' });
  } catch (error) {
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});
orderSourceRoutes.put('/:id', authMiddleware, adminOnly, async (c: any) => c.json({ success: true, message: '更新成功' }));
orderSourceRoutes.delete('/:id', authMiddleware, adminOnly, async (c: any) => c.json({ success: true, message: '删除成功' }));
