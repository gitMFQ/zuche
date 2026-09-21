import { type Bind, execute, query, queryOne, queryWithPagination } from '../db/helpers';
import type { OrderSourceRow } from '../db/rows';
import { generateId } from '../lib/ids';
import { handleError } from '../lib/errors';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
import { now } from '../lib/time';
import type { AppContext } from '../types';

interface SourceBody {
  name?: string;
  commission_rate?: number;
  color?: string;
  remarks?: string;
}

// 获取订单来源列表
export async function getOrderSources(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page, pageSize, keyword } = c.req.query();

    let sql = 'SELECT * FROM order_sources WHERE status = 1';
    const params: Bind[] = [];

    if (keyword) {
      sql += ' AND name LIKE ?';
      params.push(`%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC';

    if (page && pageSize) {
      const result = await queryWithPagination<OrderSourceRow>(db, sql, params, Number(page), Number(pageSize));
      return c.json({ success: true, data: result });
    }

    const sources = await query<OrderSourceRow>(db, sql, params);
    return c.json({ success: true, data: sources });
  } catch (error) {
    return handleError(c, '获取订单来源列表错误:', error);
  }
}

// 获取单个订单来源
export async function getOrderSource(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const source = await queryOne<OrderSourceRow>(db, 'SELECT * FROM order_sources WHERE id = ?', [id]);

    if (!source) {
      return c.json({ success: false, message: '订单来源不存在' }, 404);
    }

    return c.json({ success: true, data: source });
  } catch (error) {
    return handleError(c, '获取订单来源错误:', error);
  }
}

// 创建订单来源
export async function createOrderSource(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { name, commission_rate, color, remarks } = await c.req.json<SourceBody>();

    if (!name) {
      return c.json({ success: false, message: '来源名称不能为空' }, 400);
    }

    // 检查名称是否已存在
    const existing = await queryOne<OrderSourceRow>(
      db,
      'SELECT * FROM order_sources WHERE name = ? AND status = 1',
      [name]
    );
    if (existing) {
      return c.json({ success: false, message: '该来源名称已存在' }, 400);
    }

    const id = generateId();
    const currentTime = now();

    await execute(
      db,
      'INSERT INTO order_sources (id, name, commission_rate, color, remarks, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
      [id, name, commission_rate || 0, color || '#0071e3', remarks ?? null, currentTime, currentTime]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '创建订单来源',
      entityType: 'order_source',
      entityId: id,
      details: `创建订单来源：${name}`,
      ipAddress: getClientIp(c)
    });

    return c.json({
      success: true,
      data: { id, name, commission_rate: commission_rate || 0, color: color || '#0071e3' },
      message: '订单来源创建成功'
    });
  } catch (error) {
    return handleError(c, '创建订单来源错误:', error);
  }
}

// 更新订单来源
export async function updateOrderSource(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const { name, commission_rate, color, remarks } = await c.req.json<SourceBody>();

    const source = await queryOne<OrderSourceRow>(db, 'SELECT * FROM order_sources WHERE id = ?', [id]);
    if (!source) {
      return c.json({ success: false, message: '订单来源不存在' }, 404);
    }

    // 检查名称是否与其他记录重复
    if (name && name !== source.name) {
      const existing = await queryOne<OrderSourceRow>(
        db,
        'SELECT * FROM order_sources WHERE name = ? AND status = 1 AND id != ?',
        [name, id]
      );
      if (existing) {
        return c.json({ success: false, message: '该来源名称已存在' }, 400);
      }
    }

    await execute(
      db,
      'UPDATE order_sources SET name = ?, commission_rate = ?, color = ?, remarks = ?, updated_at = ? WHERE id = ?',
      [name || source.name, commission_rate ?? source.commission_rate, color || source.color, remarks ?? source.remarks, now(), id]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '更新订单来源',
      entityType: 'order_source',
      entityId: id,
      details: `更新订单来源：${name || source.name}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '订单来源更新成功' });
  } catch (error) {
    return handleError(c, '更新订单来源错误:', error);
  }
}

// 删除订单来源
export async function deleteOrderSource(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');

    const source = await queryOne<OrderSourceRow>(db, 'SELECT * FROM order_sources WHERE id = ?', [id]);
    if (!source) {
      return c.json({ success: false, message: '订单来源不存在' }, 404);
    }

    // 检查是否有订单使用该来源
    const orders = await queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM orders WHERE source_id = ?', [
      id
    ]);
    if (orders && orders.count > 0) {
      return c.json({ success: false, message: '该来源已被订单使用，无法删除' }, 400);
    }

    await execute(db, 'UPDATE order_sources SET status = 0, updated_at = ? WHERE id = ?', [now(), id]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除订单来源',
      entityType: 'order_source',
      entityId: id,
      details: `删除订单来源：${source.name}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '订单来源删除成功' });
  } catch (error) {
    return handleError(c, '删除订单来源错误:', error);
  }
}
