import { type Bind, execute, queryOne, queryWithPagination } from '../db/helpers';
import type { ViolationRow } from '../db/rows';
import { generateId } from '../lib/ids';
import { handleError } from '../lib/errors';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
import { now } from '../lib/time';
import type { AppContext } from '../types';

// 违章状态映射
const STATUS_MAP: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成'
};

// 违章类型映射
const TYPE_MAP: Record<string, string> = {
  speeding: '超速',
  red_light: '闯红灯',
  parking: '违章停车',
  lane: '违规变道',
  overloading: '超载',
  drunk: '酒驾',
  other: '其他'
};

const MAX_IMAGES = 5;

function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function serializeImages(images: string[] | undefined): string | null {
  if (!images || !Array.isArray(images)) return null;
  return JSON.stringify(images.slice(0, MAX_IMAGES));
}

interface ViolationWithOrder extends ViolationRow {
  order_no: string | null;
  source_name: string | null;
  source_color: string | null;
}

function decorate(item: ViolationRow) {
  return {
    ...item,
    status_text: STATUS_MAP[item.status] || item.status,
    violation_type_text: TYPE_MAP[item.violation_type] || item.violation_type,
    images: parseImages(item.images)
  };
}

// 获取违章列表
export async function getViolations(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page = '1', pageSize = '10', keyword = '', status = '', vehicle_id = '' } = c.req.query();

    let sql = `
      SELECT v.*,
        o.order_no,
        s.name as source_name,
        s.color as source_color
      FROM violations v
      LEFT JOIN orders o ON v.order_id = o.id
      LEFT JOIN order_sources s ON o.source_id = s.id
      WHERE 1=1
    `;
    const params: Bind[] = [];

    if (keyword) {
      sql += ' AND (v.customer_name LIKE ? OR v.customer_phone LIKE ? OR v.plate_number LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) {
      sql += ' AND v.status = ?';
      params.push(status);
    }

    if (vehicle_id) {
      sql += ' AND v.vehicle_id = ?';
      params.push(vehicle_id);
    }

    sql += ' ORDER BY v.created_at DESC';

    const result = await queryWithPagination<ViolationWithOrder>(db, sql, params, Number(page), Number(pageSize));

    return c.json({ success: true, data: { ...result, data: result.data.map(decorate) } });
  } catch (error) {
    return handleError(c, '获取违章列表错误:', error);
  }
}

// 获取单个违章
export async function getViolation(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const violation = await queryOne<ViolationRow>(db, 'SELECT * FROM violations WHERE id = ?', [id]);

    if (!violation) {
      return c.json({ success: false, message: '违章记录不存在' }, 404);
    }

    return c.json({ success: true, data: decorate(violation) });
  } catch (error) {
    return handleError(c, '获取违章错误:', error);
  }
}

interface CreateViolationBody {
  order_id?: string;
  vehicle_id?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  plate_number?: string;
  violation_type?: string;
  violation_date?: string;
  location?: string;
  fine_amount?: number;
  penalty_points?: number;
  penalty_fee?: number;
  images?: string[];
  remarks?: string;
}

// 创建违章记录
export async function createViolation(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<CreateViolationBody>();
    const { vehicle_id, customer_name, plate_number, violation_type, violation_date } = body;

    if (!vehicle_id || !customer_name || !plate_number || !violation_type || !violation_date) {
      return c.json({ success: false, message: '车辆、客户姓名、车牌、违章类型和违章日期不能为空' }, 400);
    }

    const id = generateId();
    const currentTime = now();

    await execute(
      db,
      `INSERT INTO violations
        (id, order_id, vehicle_id, customer_id, customer_name, customer_phone, plate_number,
         violation_type, violation_date, location, fine_amount, penalty_points, penalty_fee, images, status, remarks, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        id,
        body.order_id ?? null,
        vehicle_id,
        body.customer_id ?? null,
        customer_name,
        body.customer_phone ?? null,
        plate_number,
        violation_type,
        violation_date,
        body.location ?? null,
        body.fine_amount || 0,
        body.penalty_points || 0,
        body.penalty_fee || 0,
        serializeImages(body.images),
        body.remarks ?? null,
        currentTime,
        currentTime
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '创建违章',
      entityType: 'violation',
      entityId: id,
      details: `创建违章记录：${plate_number}，${TYPE_MAP[violation_type] || violation_type}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { id }, message: '违章记录创建成功' });
  } catch (error) {
    return handleError(c, '创建违章记录错误:', error);
  }
}

// 更新违章记录
export async function updateViolation(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const body = await c.req.json<{
      violation_type?: string;
      violation_date?: string;
      location?: string;
      fine_amount?: number;
      penalty_points?: number;
      penalty_fee?: number;
      images?: string[];
      remarks?: string;
    }>();

    const violation = await queryOne<ViolationRow>(db, 'SELECT * FROM violations WHERE id = ?', [id]);
    if (!violation) {
      return c.json({ success: false, message: '违章记录不存在' }, 404);
    }

    await execute(
      db,
      `UPDATE violations SET
        violation_type = ?, violation_date = ?, location = ?,
        fine_amount = ?, penalty_points = ?, penalty_fee = ?, images = ?, remarks = ?, updated_at = ?
       WHERE id = ?`,
      [
        body.violation_type,
        body.violation_date,
        body.location ?? null,
        body.fine_amount || 0,
        body.penalty_points || 0,
        body.penalty_fee || 0,
        serializeImages(body.images),
        body.remarks ?? null,
        now(),
        id
      ]
    );

    return c.json({ success: true, message: '违章记录更新成功' });
  } catch (error) {
    return handleError(c, '更新违章记录错误:', error);
  }
}

// 处理违章（标记已处理）
export async function handleViolation(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const { status, handle_remarks, handle_type, license_deposit } = await c.req.json<{
      status?: string;
      handle_remarks?: string;
      handle_type?: string;
      license_deposit?: number;
    }>();

    const violation = await queryOne<ViolationRow>(db, 'SELECT * FROM violations WHERE id = ?', [id]);
    if (!violation) {
      return c.json({ success: false, message: '违章记录不存在' }, 404);
    }

    const currentTime = now();

    await execute(
      db,
      'UPDATE violations SET status = ?, handle_date = ?, handle_remarks = ?, handle_type = ?, license_deposit = ?, updated_at = ? WHERE id = ?',
      [status, currentTime, handle_remarks ?? null, handle_type || 'store', license_deposit || 0, currentTime, id]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '处理违章',
      entityType: 'violation',
      entityId: id,
      details: `违章处理：${violation.plate_number}，状态：${STATUS_MAP[status ?? ''] || status}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '违章状态更新成功' });
  } catch (error) {
    return handleError(c, '处理违章错误:', error);
  }
}

// 收取违章费用（违约金、罚款）
export async function collectFee(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const { collected_penalty, collected_fine, fee_remarks } = await c.req.json<{
      collected_penalty?: number;
      collected_fine?: number;
      fee_remarks?: string;
    }>();

    const violation = await queryOne<ViolationRow>(db, 'SELECT * FROM violations WHERE id = ?', [id]);
    if (!violation) {
      return c.json({ success: false, message: '违章记录不存在' }, 404);
    }

    await execute(
      db,
      `UPDATE violations SET
        collected_penalty = ?, collected_fine = ?, fee_remarks = ?, updated_at = ?
       WHERE id = ?`,
      [collected_penalty || 0, collected_fine || 0, fee_remarks ?? null, now(), id]
    );

    return c.json({ success: true, message: '费用记录更新成功' });
  } catch (error) {
    return handleError(c, '收取费用错误:', error);
  }
}

// 删除违章记录
export async function deleteViolation(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const violation = await queryOne<ViolationRow>(db, 'SELECT * FROM violations WHERE id = ?', [id]);

    if (!violation) {
      return c.json({ success: false, message: '违章记录不存在' }, 404);
    }

    await execute(db, 'DELETE FROM violations WHERE id = ?', [id]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除违章',
      entityType: 'violation',
      entityId: id,
      details: `删除违章记录：${violation.plate_number}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '删除成功' });
  } catch (error) {
    return handleError(c, '删除违章记录错误:', error);
  }
}

// 获取违章统计
export async function getViolationStats(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const [pending, processing, completed, totalFines] = await Promise.all([
      queryOne<{ count: number }>(db, "SELECT COUNT(*) as count FROM violations WHERE status = 'pending'"),
      queryOne<{ count: number }>(db, "SELECT COUNT(*) as count FROM violations WHERE status = 'processing'"),
      queryOne<{ count: number }>(db, "SELECT COUNT(*) as count FROM violations WHERE status = 'completed'"),
      queryOne<{ total: number }>(db, "SELECT SUM(fine_amount) as total FROM violations WHERE status != 'completed'")
    ]);

    return c.json({
      success: true,
      data: {
        pending: pending?.count || 0,
        processing: processing?.count || 0,
        completed: completed?.count || 0,
        pendingFines: totalFines?.total || 0
      }
    });
  } catch (error) {
    return handleError(c, '获取违章统计错误:', error);
  }
}
