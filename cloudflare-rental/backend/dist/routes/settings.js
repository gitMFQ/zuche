import { Hono } from 'hono';
import { now } from '../utils/helpers.js';
import { authMiddleware } from '../middleware/auth.js';
const app = new Hono();
// 获取所有设置
app.get('/', authMiddleware, async (c) => {
    try {
        const settings = await c.env.DB.prepare('SELECT key, value FROM system_settings').all();
        return c.json({ success: true, data: settings });
    }
    catch (error) {
        console.error('Get settings error:', error);
        return c.json({ success: false, message: '服务器错误' }, 500);
    }
});
// 更新设置
app.put('/', authMiddleware, async (c) => {
    try {
        const body = await c.req.json();
        const { key, value } = body;
        if (!key || !value) {
            return c.json({ success: false, message: '参数不能为空' }, 400);
        }
        await c.env.DB.prepare(`INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)`).bind(key, value, now()).run();
        return c.json({ success: true, message: '设置已保存' });
    }
    catch (error) {
        console.error('Update settings error:', error);
        return c.json({ success: false, message: '服务器错误' }, 500);
    }
});
export default app;
