import { Env, query, queryOne } from '../db/index.js';
import { errorResponse, successResponse } from '../utils/helpers.js';

const ACTION_MAP: Record<string, string> = {
  '登录': '登录', '登出': '登出', '创建用户': '创建用户', '更新用户': '更新用户', '删除用户': '删除用户',
  '重置密码': '重置密码', '修改密码': '修改密码', '创建客户': '创建客户', '更新客户': '更新客户', '删除客户': '删除客户',
  '创建车辆': '创建车辆', '更新车辆': '更新车辆', '删除车辆': '删除车辆', '创建订单': '创建订单', '更新订单': '更新订单',
  '取消订单': '取消订单', '取车': '取车', '还车': '还车', '续租订单': '续租订单', '添加支付': '添加支付',
  '创建违章': '创建违章', '更新违章': '更新违章', '处理违章': '处理违章', '删除违章': '删除违章',
  '添加黑名单': '添加黑名单', '移除黑名单': '移除黑名单', '创建订单来源': '创建订单来源', '更新订单来源': '更新订单来源', '删除订单来源': '删除订单来源',
};

const ENTITY_TYPE_MAP: Record<string, string> = {
  'user': '用户', 'customer': '客户', 'vehicle': '车辆', 'order': '订单', 'violation': '违章',
  'blacklist': '黑名单', 'maintenance': '保养', 'insurance': '保险', 'inspection': '年检证',
  'order_source': '订单来源', 'settings': '系统设置',
};

// Get logs list
export async function getLogsController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 20;
    const userFilterId = params.userId || '';
    const action = params.action || '';
    const entityType = params.entityType || '';
    const startDate = params.startDate || '';
    const endDate = params.endDate || '';
    const keyword = params.keyword || '';

    let sql = `
      SELECT l.*, u.name as user_name, u.username
      FROM operation_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const queryParams: any[] = [];

    if (userFilterId) {
      sql += ' AND l.user_id = ?';
      queryParams.push(userFilterId);
    }

    if (action) {
      sql += ' AND l.action = ?';
      queryParams.push(action);
    }

    if (entityType) {
      sql += ' AND l.entity_type = ?';
      queryParams.push(entityType);
    }

    if (startDate) {
      sql += ' AND l.created_at >= ?';
      queryParams.push(startDate + ' 00:00:00');
    }

    if (endDate) {
      sql += ' AND l.created_at <= ?';
      queryParams.push(endDate + ' 23:59:59');
    }

    if (keyword) {
      sql += ' AND (l.details LIKE ? OR u.name LIKE ? OR u.username LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      queryParams.push(likeKeyword, likeKeyword, likeKeyword);
    }

    sql += ' ORDER BY l.created_at DESC';

    // Simple pagination without count query for CF
    const dataSql = `${sql} LIMIT ? OFFSET ?`;
    const offset = (page - 1) * pageSize;
    const dataParams = [...queryParams, pageSize, offset];
    const data = await query(env.DB, dataSql, dataParams);

    const result = {
      data: data.map((log: any) => ({
        ...log,
        action_text: ACTION_MAP[log.action] || log.action,
        entity_type_text: ENTITY_TYPE_MAP[log.entity_type] || log.entity_type
      })),
      total: 0,
      page,
      pageSize,
      totalPages: 0
    };

    return successResponse(result);
  } catch (error) {
    console.error('Get logs error:', error);
    return errorResponse('获取日志列表失败', 500);
  }
}

// Get single log
export async function getLogController(request: Request, env: Env, userId?: string, logId?: string): Promise<Response> {
  try {
    if (!logId) return errorResponse('日志ID不能为空');

    const logs: any = await query(env.DB, `
      SELECT l.*, u.name as user_name, u.username
      FROM operation_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.id = ?
    `, [logId]);

    if (logs.length === 0) return errorResponse('日志不存在', 404);

    const log = logs[0];
    return successResponse({
      ...log,
      action_text: ACTION_MAP[log.action] || log.action,
      entity_type_text: ENTITY_TYPE_MAP[log.entity_type] || log.entity_type
    });
  } catch (error) {
    console.error('Get log error:', error);
    return errorResponse('获取日志详情失败', 500);
  }
}

// Get action types
export async function getActionTypesController(request: Request, env: Env, userId?: string): Promise<Response> {
  return successResponse(ACTION_MAP);
}

// Get entity types
export async function getEntityTypesController(request: Request, env: Env, userId?: string): Promise<Response> {
  return successResponse(ENTITY_TYPE_MAP);
}

// Get log users
export async function getLogUsersController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const users = await query(env.DB, `
      SELECT DISTINCT u.id, u.name, u.username
      FROM users u
      INNER JOIN operation_logs l ON l.user_id = u.id
      ORDER BY u.name
    `);
    return successResponse(users);
  } catch (error) {
    console.error('Get log users error:', error);
    return errorResponse('获取用户列表失败', 500);
  }
}
