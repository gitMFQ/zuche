import { Env, query, queryOne, execute, queryWithPagination } from '../db/index.js';
import { generateUuid, errorResponse, successResponse, logAction } from '../utils/helpers.js';

// Get blacklist list
export async function getBlacklistController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 10;
    const keyword = params.keyword || '';

    let sql = 'SELECT * FROM blacklist WHERE status = 1';
    const queryParams: any[] = [];

    if (keyword) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR id_card LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      queryParams.push(likeKeyword, likeKeyword, likeKeyword);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await queryWithPagination(env.DB, sql, queryParams, page, pageSize);
    return successResponse(result);
  } catch (error) {
    console.error('Get blacklist error:', error);
    return errorResponse('获取黑名单列表失败', 500);
  }
}

// Check blacklist
export async function checkBlacklistController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const phone = params.phone;
    const id_card = params.id_card;

    let sql = 'SELECT * FROM blacklist WHERE status = 1';
    const queryParams: any[] = [];

    if (phone) {
      sql += ' AND phone = ?';
      queryParams.push(phone);
    } else if (id_card) {
      sql += ' AND id_card = ?';
      queryParams.push(id_card);
    } else {
      return successResponse({ isBlacklisted: false });
    }

    const record = await queryOne(env.DB, sql, queryParams);
    return successResponse({ isBlacklisted: !!record, record: record || null });
  } catch (error) {
    console.error('Check blacklist error:', error);
    return errorResponse('检查黑名单失败', 500);
  }
}

// Get blacklist detail
export async function getBlacklistDetailController(request: Request, env: Env, userId?: string, blacklistId?: string): Promise<Response> {
  try {
    if (!blacklistId) return errorResponse('记录ID不能为空');

    const record = await queryOne(env.DB, 'SELECT * FROM blacklist WHERE id = ?', [blacklistId]);
    if (!record) return errorResponse('记录不存在', 404);

    return successResponse(record);
  } catch (error) {
    console.error('Get blacklist detail error:', error);
    return errorResponse('获取黑名单详情失败', 500);
  }
}

// Add to blacklist
export async function addToBlacklistController(request: Request, env: Env, operatorId?: string): Promise<Response> {
  try {
    const body = await request.json();
    const { customer_id, name, phone, id_card, reason, order_id } = body;

    if (!name || !phone || !reason) {
      return errorResponse('姓名、手机号和拉黑原因不能为空');
    }

    const existing = await queryOne(env.DB, 'SELECT * FROM blacklist WHERE phone = ? AND status = 1', [phone]);
    if (existing) return errorResponse('该客户已在黑名单中');

    const id = generateUuid();
    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    await execute(
      env.DB,
      `INSERT INTO blacklist (id, customer_id, name, phone, id_card, reason, order_id, operator_id, operator_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, customer_id || null, name, phone, id_card || null, reason, order_id || null, operatorId, operatorId ? 'Operator' : null, currentTime, currentTime]
    );

    await logAction(env.DB, operatorId || null, '添加黑名单', 'blacklist', id, `添加黑名单：${name}，原因：${reason}`);

    return successResponse({ id }, '已添加到黑名单');
  } catch (error) {
    console.error('Add to blacklist error:', error);
    return errorResponse('添加黑名单失败', 500);
  }
}

// Remove from blacklist
export async function removeFromBlacklistController(request: Request, env: Env, operatorId?: string, blacklistId?: string): Promise<Response> {
  try {
    if (!blacklistId) return errorResponse('记录ID不能为空');

    const record: any = await queryOne(env.DB, 'SELECT * FROM blacklist WHERE id = ?', [blacklistId]);
    if (!record) return errorResponse('记录不存在', 404);

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
    await execute(env.DB, 'UPDATE blacklist SET status = 0, updated_at = ? WHERE id = ?', [currentTime, blacklistId]);

    await logAction(env.DB, operatorId || null, '移除黑名单', 'blacklist', blacklistId, `移除黑名单：${record.name}`);

    return successResponse(null, '已从黑名单移除');
  } catch (error) {
    console.error('Remove from blacklist error:', error);
    return errorResponse('移除黑名单失败', 500);
  }
}
