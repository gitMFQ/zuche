import { type Bind, execute, queryOne, queryWithPagination } from '../db/helpers';
import type { BlacklistRow } from '../db/rows';
import { generateId } from '../lib/ids';
import { handleError } from '../lib/errors';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
import { now } from '../lib/time';
import type { AppContext } from '../types';

// 获取黑名单列表
export async function getBlacklist(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page = '1', pageSize = '10', keyword = '' } = c.req.query();

    let sql = 'SELECT * FROM blacklist WHERE status = 1';
    const params: Bind[] = [];

    if (keyword) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR id_card LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await queryWithPagination<BlacklistRow>(db, sql, params, Number(page), Number(pageSize));

    return c.json({ success: true, data: result });
  } catch (error) {
    return handleError(c, '获取黑名单列表错误:', error);
  }
}

// 检查是否在黑名单（根据手机号或身份证）
export async function checkBlacklist(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { phone, id_card } = c.req.query();

    let sql = 'SELECT * FROM blacklist WHERE status = 1';
    const params: Bind[] = [];

    if (phone) {
      sql += ' AND phone = ?';
      params.push(phone);
    } else if (id_card) {
      sql += ' AND id_card = ?';
      params.push(id_card);
    } else {
      return c.json({ success: true, data: { isBlacklisted: false } });
    }

    const record = await queryOne<BlacklistRow>(db, sql, params);

    return c.json({
      success: true,
      data: {
        isBlacklisted: !!record,
        record: record || null
      }
    });
  } catch (error) {
    return handleError(c, '检查黑名单错误:', error);
  }
}

// 添加到黑名单
export async function addToBlacklist(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { customer_id, name, phone, id_card, reason, order_id } = await c.req.json<{
      customer_id?: string;
      name?: string;
      phone?: string;
      id_card?: string;
      reason?: string;
      order_id?: string;
    }>();

    if (!name || !phone || !reason) {
      return c.json({ success: false, message: '姓名、手机号和拉黑原因不能为空' }, 400);
    }

    // 检查是否已在黑名单
    const existing = await queryOne<BlacklistRow>(db, 'SELECT * FROM blacklist WHERE phone = ? AND status = 1', [phone]);
    if (existing) {
      return c.json({ success: false, message: '该客户已在黑名单中' }, 400);
    }

    const id = generateId();
    const currentTime = now();
    const user = getAuthUser(c);

    await execute(
      db,
      `INSERT INTO blacklist (id, customer_id, name, phone, id_card, reason, order_id, operator_id, operator_name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        customer_id ?? null,
        name,
        phone,
        id_card ?? null,
        reason,
        order_id ?? null,
        user?.id ?? null,
        user?.name ?? null,
        currentTime,
        currentTime
      ]
    );

    await logAction(db, {
      userId: user?.id ?? '',
      action: '添加黑名单',
      entityType: 'blacklist',
      entityId: id,
      details: `添加黑名单：${name}，原因：${reason}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { id }, message: '已添加到黑名单' });
  } catch (error) {
    return handleError(c, '添加黑名单错误:', error);
  }
}

// 从黑名单移除
export async function removeFromBlacklist(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');

    const record = await queryOne<BlacklistRow>(db, 'SELECT * FROM blacklist WHERE id = ?', [id]);
    if (!record) {
      return c.json({ success: false, message: '记录不存在' }, 404);
    }

    await execute(db, 'UPDATE blacklist SET status = 0, updated_at = ? WHERE id = ?', [now(), id]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '移除黑名单',
      entityType: 'blacklist',
      entityId: id,
      details: `移除黑名单：${record.name}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '已从黑名单移除' });
  } catch (error) {
    return handleError(c, '移除黑名单错误:', error);
  }
}

// 获取黑名单详情
export async function getBlacklistDetail(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const record = await queryOne<BlacklistRow>(db, 'SELECT * FROM blacklist WHERE id = ?', [id]);

    if (!record) {
      return c.json({ success: false, message: '记录不存在' }, 404);
    }

    return c.json({ success: true, data: record });
  } catch (error) {
    return handleError(c, '获取黑名单详情错误:', error);
  }
}
