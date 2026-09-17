import { Hono } from 'hono';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import type { Env } from '../middleware/auth.js';

export const logRoutes = new Hono();

logRoutes.get('/', authMiddleware, adminOnly, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const logs = await db.prepare('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 100').all();
    return c.json({ success: true, data: logs.results || [] });
  } catch (error) {
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

logRoutes.get('/action-types', authMiddleware, async (c: any) => c.json({ success: true, data: [] }));
logRoutes.get('/entity-types', authMiddleware, async (c: any) => c.json({ success: true, data: [] }));
logRoutes.get('/logUsers', authMiddleware, async (c: any) => c.json({ success: true, data: [] }));
logRoutes.get('/:id', authMiddleware, adminOnly, async (c: any) => c.json({ success: true, data: {} }));
