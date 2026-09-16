import { Env, query, queryOne, execute } from '../db/index.js';
import { errorResponse, successResponse } from '../utils/helpers.js';

// Get system settings
export async function getSettingsController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const rows = await query(env.DB, 'SELECT key, value FROM system_settings');
    
    const settings: Record<string, string> = {};
    rows.forEach((row: any) => {
      settings[row.key] = row.value || '';
    });
    
    return successResponse(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    return errorResponse('获取系统设置失败', 500);
  }
}

// Get single setting
export async function getSettingController(request: Request, env: Env, userId?: string, key?: string): Promise<Response> {
  try {
    if (!key) return errorResponse('设置项不能为空');

    const row: any = await queryOne(env.DB, 'SELECT value FROM system_settings WHERE key = ?', [key]);
    
    return successResponse(row?.value ?? null);
  } catch (error) {
    console.error('Get setting error:', error);
    return errorResponse('获取设置失败', 500);
  }
}

// Update setting
export async function updateSettingController(request: Request, env: Env, operatorId?: string): Promise<Response> {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) return errorResponse('缺少设置项名称');

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
    await execute(
      env.DB,
      "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)",
      [key, value || '', currentTime]
    );

    return successResponse(null, '设置保存成功');
  } catch (error) {
    console.error('Update setting error:', error);
    return errorResponse('保存设置失败', 500);
  }
}
