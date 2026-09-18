import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import type { Env } from '../middleware/auth.js';

export const scheduleRoutes = new Hono();

scheduleRoutes.get('/recent', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const schedules = await db.prepare('SELECT * FROM schedules WHERE schedule_time >= datetime("now") ORDER BY schedule_time ASC LIMIT 50').all();
    return c.json({ success: true, data: schedules.results || [] });
  } catch (error) {
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

scheduleRoutes.get('/gantt', authMiddleware, async (c: any) => {
  return c.json({ success: true, data: [] });
});
