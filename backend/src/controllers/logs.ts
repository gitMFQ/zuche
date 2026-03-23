import { Response } from 'express';
import { query, queryWithPagination } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 操作类型映射
const ACTION_MAP: Record<string, string> = {
  '登录': '登录',
  '登出': '登出',
  '创建用户': '创建用户',
  '更新用户': '更新用户',
  '删除用户': '删除用户',
  '重置密码': '重置密码',
  '修改密码': '修改密码',
  '创建客户': '创建客户',
  '更新客户': '更新客户',
  '删除客户': '删除客户',
  '创建车辆': '创建车辆',
  '更新车辆': '更新车辆',
  '删除车辆': '删除车辆',
  '创建订单': '创建订单',
  '更新订单': '更新订单',
  '取消订单': '取消订单',
  '取车': '取车',
  '还车': '还车',
  '续租订单': '续租订单',
  '添加支付': '添加支付',
  '创建违章': '创建违章',
  '更新违章': '更新违章',
  '处理违章': '处理违章',
  '删除违章': '删除违章',
  '添加黑名单': '添加黑名单',
  '移除黑名单': '移除黑名单',
  '创建订单来源': '创建订单来源',
  '更新订单来源': '更新订单来源',
  '删除订单来源': '删除订单来源',
};

// 实体类型映射
const ENTITY_TYPE_MAP: Record<string, string> = {
  'user': '用户',
  'customer': '客户',
  'vehicle': '车辆',
  'order': '订单',
  'violation': '违章',
  'blacklist': '黑名单',
  'maintenance': '保养',
  'insurance': '保险',
  'inspection': '年检证',
  'order_source': '订单来源',
  'settings': '系统设置',
};

// 获取日志列表
export function getLogs(req: AuthRequest, res: Response): void {
  try {
    const { page = 1, pageSize = 20, userId = '', action = '', entityType = '', startDate = '', endDate = '', keyword = '' } = req.query;
    
    let sql = `
      SELECT l.*, u.name as user_name, u.username
      FROM operation_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (userId) {
      sql += ' AND l.user_id = ?';
      params.push(userId);
    }

    if (action) {
      sql += ' AND l.action = ?';
      params.push(action);
    }

    if (entityType) {
      sql += ' AND l.entity_type = ?';
      params.push(entityType);
    }

    if (startDate) {
      sql += ' AND l.created_at >= ?';
      params.push(startDate as string + ' 00:00:00');
    }

    if (endDate) {
      sql += ' AND l.created_at <= ?';
      params.push(endDate as string + ' 23:59:59');
    }

    if (keyword) {
      sql += ' AND (l.details LIKE ? OR u.name LIKE ? OR u.username LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    sql += ' ORDER BY l.created_at DESC';

    const result = queryWithPagination(sql, params, Number(page), Number(pageSize));
    
    // 添加操作文本
    result.data = result.data.map((log: any) => ({
      ...log,
      action_text: ACTION_MAP[log.action] || log.action,
      entity_type_text: ENTITY_TYPE_MAP[log.entity_type] || log.entity_type
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取日志列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取单个日志详情
export function getLog(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const logs = query(`
      SELECT l.*, u.name as user_name, u.username
      FROM operation_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.id = ?
    `, [id]);

    if (logs.length === 0) {
      res.status(404).json({ success: false, message: '日志不存在' });
      return;
    }

    const log = logs[0];
    res.json({ 
      success: true, 
      data: {
        ...log,
        action_text: ACTION_MAP[log.action] || log.action,
        entity_type_text: ENTITY_TYPE_MAP[log.entity_type] || log.entity_type
      }
    });
  } catch (error) {
    console.error('获取日志详情错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取操作类型列表
export function getActionTypes(req: AuthRequest, res: Response): void {
  res.json({ success: true, data: ACTION_MAP });
}

// 获取实体类型列表
export function getEntityTypes(req: AuthRequest, res: Response): void {
  res.json({ success: true, data: ENTITY_TYPE_MAP });
}

// 获取用户列表（用于筛选）
export function getLogUsers(req: AuthRequest, res: Response): void {
  try {
    const users = query(`
      SELECT DISTINCT u.id, u.name, u.username
      FROM users u
      INNER JOIN operation_logs l ON l.user_id = u.id
      ORDER BY u.name
    `);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
