import { Env, query, queryOne, execute, queryWithPagination } from '../db/index.js';
import { generateUuid, errorResponse, successResponse, logAction } from '../utils/helpers.js';

// Get order sources list
export async function getOrderSourcesController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 10;
    const keyword = params.keyword || '';

    let sql = 'SELECT * FROM order_sources WHERE status = 1';
    const queryParams: any[] = [];

    if (keyword) {
      sql += ' AND name LIKE ?';
      queryParams.push(`%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC';

    if (page && pageSize) {
      const result = await queryWithPagination(env.DB, sql, queryParams, page, pageSize);
      return successResponse(result);
    } else {
      const sources = await query(env.DB, sql, queryParams);
      return successResponse(sources);
    }
  } catch (error) {
    console.error('Get order sources error:', error);
    return errorResponse('获取订单来源列表失败', 500);
  }
}

// Get single order source
export async function getOrderSourceController(request: Request, env: Env, userId?: string, sourceId?: string): Promise<Response> {
  try {
    if (!sourceId) return errorResponse('订单来源ID不能为空');

    const source = await queryOne(env.DB, 'SELECT * FROM order_sources WHERE id = ?', [sourceId]);
    if (!source) return errorResponse('订单来源不存在', 404);

    return successResponse(source);
  } catch (error) {
    console.error('Get order source error:', error);
    return errorResponse('获取订单来源失败', 500);
  }
}

// Create order source
export async function createOrderSourceController(request: Request, env: Env, operatorId?: string): Promise<Response> {
  try {
    const body = await request.json();
    const { name, commission_rate, color, remarks } = body;

    if (!name) return errorResponse('来源名称不能为空');

    const existing = await queryOne(env.DB, 'SELECT * FROM order_sources WHERE name = ? AND status = 1', [name]);
    if (existing) return errorResponse('该来源名称已存在');

    const id = generateUuid();
    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    await execute(
      env.DB,
      'INSERT INTO order_sources (id, name, commission_rate, color, remarks, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
      [id, name, commission_rate || 0, color || '#409EFF', remarks || null, currentTime, currentTime]
    );

    await logAction(env.DB, operatorId || null, '创建订单来源', 'order_source', id, `创建订单来源：${name}`);

    return successResponse({ id, name, commission_rate: commission_rate || 0, color: color || '#409EFF' }, '订单来源创建成功');
  } catch (error) {
    console.error('Create order source error:', error);
    return errorResponse('创建订单来源失败', 500);
  }
}

// Update order source
export async function updateOrderSourceController(request: Request, env: Env, operatorId?: string, sourceId?: string): Promise<Response> {
  try {
    if (!sourceId) return errorResponse('订单来源ID不能为空');

    const body = await request.json();
    const { name, commission_rate, color, remarks } = body;

    const source: any = await queryOne(env.DB, 'SELECT * FROM order_sources WHERE id = ?', [sourceId]);
    if (!source) return errorResponse('订单来源不存在', 404);

    if (name && name !== source.name) {
      const existing = await queryOne(env.DB, 'SELECT * FROM order_sources WHERE name = ? AND status = 1 AND id != ?', [name, sourceId]);
      if (existing) return errorResponse('该来源名称已存在');
    }

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
    await execute(
      env.DB,
      'UPDATE order_sources SET name = ?, commission_rate = ?, color = ?, remarks = ?, updated_at = ? WHERE id = ?',
      [name || source.name, commission_rate ?? source.commission_rate, color || source.color, remarks ?? source.remarks, currentTime, sourceId]
    );

    await logAction(env.DB, operatorId || null, '更新订单来源', 'order_source', sourceId, `更新订单来源：${name || source.name}`);

    return successResponse(null, '订单来源更新成功');
  } catch (error) {
    console.error('Update order source error:', error);
    return errorResponse('更新订单来源失败', 500);
  }
}

// Delete order source
export async function deleteOrderSourceController(request: Request, env: Env, operatorId?: string, sourceId?: string): Promise<Response> {
  try {
    if (!sourceId) return errorResponse('订单来源ID不能为空');

    const source: any = await queryOne(env.DB, 'SELECT * FROM order_sources WHERE id = ?', [sourceId]);
    if (!source) return errorResponse('订单来源不存在', 404);

    const orders: any = await queryOne(env.DB, 'SELECT COUNT(*) as count FROM orders WHERE source_id = ?', [sourceId]);
    if (orders && orders.count > 0) return errorResponse('该来源已被订单使用，无法删除');

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
    await execute(env.DB, 'UPDATE order_sources SET status = 0, updated_at = ? WHERE id = ?', [currentTime, sourceId]);

    await logAction(env.DB, operatorId || null, '删除订单来源', 'order_source', sourceId, `删除订单来源：${source.name}`);

    return successResponse(null, '订单来源删除成功');
  } catch (error) {
    console.error('Delete order source error:', error);
    return errorResponse('删除订单来源失败', 500);
  }
}
