import { type Bind, query, queryWithPagination } from '../db/helpers';
import type { OperationLogRow } from '../db/rows';
import { handleError } from '../lib/errors';
import type { AppContext } from '../types';

// 操作类型映射
const ACTION_MAP: Record<string, string> = {
  登录: '登录',
  登出: '登出',
  创建用户: '创建用户',
  更新用户: '更新用户',
  删除用户: '删除用户',
  重置密码: '重置密码',
  修改密码: '修改密码',
  创建客户: '创建客户',
  更新客户: '更新客户',
  删除客户: '删除客户',
  创建车辆: '创建车辆',
  更新车辆: '更新车辆',
  删除车辆: '删除车辆',
  创建订单: '创建订单',
  更新订单: '更新订单',
  取消订单: '取消订单',
  取车: '取车',
  还车: '还车',
  续租订单: '续租订单',
  添加支付: '添加支付',
  创建违章: '创建违章',
  更新违章: '更新违章',
  处理违章: '处理违章',
  删除违章: '删除违章',
  添加黑名单: '添加黑名单',
  移除黑名单: '移除黑名单',
  创建订单来源: '创建订单来源',
  更新订单来源: '更新订单来源',
  删除订单来源: '删除订单来源'
};

// 实体类型映射
const ENTITY_TYPE_MAP: Record<string, string> = {
  user: '用户',
  customer: '客户',
  vehicle: '车辆',
  order: '订单',
  violation: '违章',
  blacklist: '黑名单',
  maintenance: '保养',
  insurance: '保险',
  inspection: '年检证',
  order_source: '订单来源',
  settings: '系统设置'
};

interface LogWithText extends OperationLogRow {
  user_name: string | null;
  username: string | null;
  action_text: string;
  entity_type_text: string | null;
}

function withText(log: OperationLogRow & { user_name: string | null; username: string | null }): LogWithText {
  return {
    ...log,
    action_text: ACTION_MAP[log.action] || log.action,
    entity_type_text: ENTITY_TYPE_MAP[log.entity_type ?? ''] || log.entity_type
  };
}

// 获取日志列表
export async function getLogs(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const q = c.req.query();
    const page = Number(q.page ?? 1);
    const pageSize = Number(q.pageSize ?? 20);

    let sql = `
      SELECT l.*, u.name as user_name, u.username
      FROM operation_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params: Bind[] = [];

    if (q.userId) {
      sql += ' AND l.user_id = ?';
      params.push(q.userId);
    }
    if (q.action) {
      sql += ' AND l.action = ?';
      params.push(q.action);
    }
    if (q.entityType) {
      sql += ' AND l.entity_type = ?';
      params.push(q.entityType);
    }
    if (q.startDate) {
      sql += ' AND l.created_at >= ?';
      params.push(`${q.startDate} 00:00:00`);
    }
    if (q.endDate) {
      sql += ' AND l.created_at <= ?';
      params.push(`${q.endDate} 23:59:59`);
    }
    if (q.keyword) {
      sql += ' AND (l.details LIKE ? OR u.name LIKE ? OR u.username LIKE ?)';
      const likeKeyword = `%${q.keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    sql += ' ORDER BY l.created_at DESC';

    const result = await queryWithPagination<OperationLogRow & { user_name: string | null; username: string | null }>(
      db,
      sql,
      params,
      page,
      pageSize
    );

    return c.json({
      success: true,
      data: { ...result, data: result.data.map(withText) }
    });
  } catch (error) {
    return handleError(c, '获取日志列表错误:', error);
  }
}

// 获取单个日志详情
export async function getLog(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const logs = await query<OperationLogRow & { user_name: string | null; username: string | null }>(
      db,
      `SELECT l.*, u.name as user_name, u.username
       FROM operation_logs l
       LEFT JOIN users u ON l.user_id = u.id
       WHERE l.id = ?`,
      [id]
    );

    const log = logs[0];
    if (!log) {
      return c.json({ success: false, message: '日志不存在' }, 404);
    }

    return c.json({ success: true, data: withText(log) });
  } catch (error) {
    return handleError(c, '获取日志详情错误:', error);
  }
}

// 获取操作类型列表
export async function getActionTypes(c: AppContext): Promise<Response> {
  return c.json({ success: true, data: ACTION_MAP });
}

// 获取实体类型列表
export async function getEntityTypes(c: AppContext): Promise<Response> {
  return c.json({ success: true, data: ENTITY_TYPE_MAP });
}

// 获取用户列表（用于筛选）
export async function getLogUsers(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const users = await query<{ id: string; name: string; username: string }>(
      db,
      `SELECT DISTINCT u.id, u.name, u.username
       FROM users u
       INNER JOIN operation_logs l ON l.user_id = u.id
       ORDER BY u.name`
    );
    return c.json({ success: true, data: users });
  } catch (error) {
    return handleError(c, '获取用户列表错误:', error);
  }
}
