import { Hono } from 'hono';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import type { Env } from '../middleware/auth.js';

export const settingRoutes = new Hono();

settingRoutes.get('/', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const settings = await db.prepare('SELECT * FROM system_settings').all();
    const data: any = {};
    (settings.results || []).forEach((s: any) => { data[s.key] = s.value; });
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

settingRoutes.get('/:key', authMiddleware, async (c: any) => c.json({ success: true, data: {} }));
settingRoutes.put('/', authMiddleware, adminOnly, async (c: any) => {
  try {
    const body = await c.req.json();
    const db = (c.env as Env).DB;
    for (const [key, value] of Object.entries(body)) {
      await db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').bind(key, value).run();
    }
    return c.json({ success: true, message: '设置更新成功' });
  } catch (error) {
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});
