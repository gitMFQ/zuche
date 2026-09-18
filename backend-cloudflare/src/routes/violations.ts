import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import type { Env } from '../middleware/auth.js';

export const violationRoutes = new Hono();

violationRoutes.get('/', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const violations = await db.prepare('SELECT * FROM violations ORDER BY created_at DESC').all();
    return c.json({ success: true, data: violations.results || [] });
  } catch (error) {
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

violationRoutes.get('/stats', authMiddleware, async (c: any) => {
  return c.json({ success: true, data: { pending: 0, handled: 0 } });
});

violationRoutes.post('/', authMiddleware, async (c: any) => {
  try {
    const body = await c.req.json();
    const violationId = crypto.randomUUID();
    const db = (c.env as Env).DB;
    await db.prepare('INSERT INTO violations (id, vehicle_id, plate_number, violation_date, status) VALUES (?, ?, ?, ?, ?)')
      .bind(violationId, body.vehicle_id, body.plate_number, body.violation_date, 'pending').run();
    return c.json({ success: true, message: '违章记录创建成功' });
  } catch (error) {
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

// 其他违章路由占位
violationRoutes.get('/:id', authMiddleware, async (c: any) => c.json({ success: true, data: {} }));
violationRoutes.put('/:id', authMiddleware, async (c: any) => c.json({ success: true, message: '更新成功' }));
violationRoutes.put('/:id/fee', authMiddleware, async (c: any) => c.json({ success: true, message: '处理成功' }));
violationRoutes.put('/:id/handle', authMiddleware, async (c: any) => c.json({ success: true, message: '处理成功' }));
violationRoutes.delete('/:id', authMiddleware, async (c: any) => c.json({ success: true, message: '删除成功' }));
