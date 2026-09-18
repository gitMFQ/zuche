import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import type { Env } from '../middleware/auth.js';

export const maintenanceRoutes = new Hono();

maintenanceRoutes.get('/', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const list = await db.prepare('SELECT * FROM maintenance ORDER BY created_at DESC').all();
    return c.json({ success: true, data: list.results || [] });
  } catch (error) {
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

maintenanceRoutes.get('/stats', authMiddleware, async (c: any) => c.json({ success: true, data: {} }));
maintenanceRoutes.get('/:id', authMiddleware, async (c: any) => c.json({ success: true, data: {} }));
maintenanceRoutes.post('/', authMiddleware, async (c: any) => c.json({ success: true, message: '创建成功' }));
maintenanceRoutes.put('/:id', authMiddleware, async (c: any) => c.json({ success: true, message: '更新成功' }));
maintenanceRoutes.delete('/:id', authMiddleware, async (c: any) => c.json({ success: true, message: '删除成功' }));
