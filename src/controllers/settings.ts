import { execute, query, queryOne } from '../db/helpers';
import type { SettingRow } from '../db/rows';
import { handleError } from '../lib/errors';
import type { AppContext } from '../types';

// 获取系统设置
export async function getSettings(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const rows = await query<SettingRow>(db, 'SELECT key, value FROM system_settings');

    const settings: Record<string, string> = {};
    rows.forEach((row) => {
      settings[row.key] = row.value || '';
    });

    return c.json({ success: true, data: settings });
  } catch (error) {
    return handleError(c, '获取系统设置失败:', error, '获取系统设置失败');
  }
}

// 获取单个设置
export async function getSetting(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const key = c.req.param('key');
    const row = await queryOne<SettingRow>(db, 'SELECT value FROM system_settings WHERE key = ?', [key]);

    return c.json({ success: true, data: row?.value ?? null });
  } catch (error) {
    return handleError(c, '获取设置失败:', error, '获取设置失败');
  }
}

// 更新系统设置
export async function updateSettings(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { key, value } = await c.req.json<{ key?: string; value?: string }>();

    if (!key) {
      return c.json({ success: false, message: '缺少设置项名称' }, 400);
    }

    // 使用 INSERT OR REPLACE 来更新或插入
    await execute(db, "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime('now', '+8 hours'))", [
      key,
      value || ''
    ]);

    return c.json({ success: true, message: '设置保存成功' });
  } catch (error) {
    return handleError(c, '保存系统设置失败:', error, '保存系统设置失败');
  }
}
