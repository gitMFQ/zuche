import { type Bind, execute, query, queryOne, queryWithPagination } from '../db/helpers';
import type { InspectionRow } from '../db/rows';
import { generateId } from '../lib/ids';
import { handleError } from '../lib/errors';
import { dateOffset, now, today as todayDate } from '../lib/time';
import type { AppContext } from '../types';

interface InspectionRowItem {
  vehicle_id: string;
  plate_number: string;
  brand: string;
  model: string;
  color: string | null;
  vehicle_status: string;
  is_new_energy: number;
  inspection_id: string | null;
  expiry_date: string | null;
  certificate_image: string | null;
  remarks: string | null;
  inspection_created_at: string | null;
  inspection_status: string;
}

type InspectionListItem = InspectionRowItem & {
  status_text: string;
};

// 年检状态是算出来的：未登记 / 已过期 / 有效
const INSPECTION_STATUS_TEXT: Record<string, string> = {
  none: '未登记',
  expired: '已过期',
  valid: '有效'
};

/**
 * 状态判定表达式。SELECT 与 WHERE 必须复用同一段，否则筛选与计数会对不上。
 * 参数：今天（YYYY-MM-DD）。
 */
const INSPECTION_STATUS_CASE = `CASE
  WHEN i.id IS NULL THEN 'none'
  WHEN i.expiry_date IS NOT NULL AND i.expiry_date < ? THEN 'expired'
  ELSE 'valid'
END`;

// 获取车辆年检状态列表（显示所有车辆）
export async function getInspectionList(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page = '1', pageSize = '10', keyword = '', status = '' } = c.req.query();

    const today = todayDate();

    // 状态原本是先分页取一页、再在内存里过滤，导致筛选结果不完整、total 也不对。
    // 现在把状态判定下推到 SQL，筛选与计数都交给分页函数。
    let sql = `
      SELECT
        v.id as vehicle_id,
        v.plate_number,
        v.brand,
        v.model,
        v.color,
        v.status as vehicle_status,
        v.is_new_energy,
        i.id as inspection_id,
        i.expiry_date,
        i.certificate_image,
        i.remarks,
        i.created_at as inspection_created_at,
        ${INSPECTION_STATUS_CASE} AS inspection_status
      FROM vehicles v
      LEFT JOIN inspections i ON v.id = i.vehicle_id
      WHERE 1=1
    `;
    // 与上面的 CASE 占位符顺序一致
    const params: Bind[] = [today];

    if (keyword) {
      sql += ' AND (v.plate_number LIKE ? OR v.brand LIKE ? OR v.model LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) {
      sql += ` AND ${INSPECTION_STATUS_CASE} = ?`;
      params.push(today, status);
    }

    sql += ' ORDER BY v.plate_number ASC';

    const result = await queryWithPagination<InspectionRowItem>(db, sql, params, Number(page), Number(pageSize));

    const data: InspectionListItem[] = result.data.map((item) => ({
      ...item,
      status_text: INSPECTION_STATUS_TEXT[item.inspection_status] || item.inspection_status
    }));

    return c.json({ success: true, data: { ...result, data } });
  } catch (error) {
    return handleError(c, '获取年检列表错误:', error);
  }
}

interface InspectionWithVehicle extends InspectionRow {
  brand: string | null;
  model: string | null;
}

// 获取年检统计
export async function getInspectionStats(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const today = todayDate();
    const thirtyDaysLater = dateOffset(30);

    const [vehicleTotal, inspectionTotal, expiringSoon, expired, valid] = await Promise.all([
      queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM vehicles'),
      queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM inspections'),
      query<InspectionWithVehicle>(
        db,
        `SELECT i.*, v.brand, v.model, v.plate_number FROM inspections i
         LEFT JOIN vehicles v ON i.vehicle_id = v.id
         WHERE i.expiry_date >= ? AND i.expiry_date <= ?
         ORDER BY i.expiry_date ASC`,
        [today, thirtyDaysLater]
      ),
      query<InspectionWithVehicle>(
        db,
        `SELECT i.*, v.brand, v.model, v.plate_number FROM inspections i
         LEFT JOIN vehicles v ON i.vehicle_id = v.id
         WHERE i.expiry_date < ?
         ORDER BY i.expiry_date DESC`,
        [today]
      ),
      queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM inspections WHERE expiry_date >= ?', [today])
    ]);

    const noneCount = (vehicleTotal?.count || 0) - (inspectionTotal?.count || 0);

    return c.json({
      success: true,
      data: {
        expiringSoon: expiringSoon.map((i) => ({ ...i, status_text: '即将到期' })),
        expired: expired.map((i) => ({ ...i, status_text: '已过期' })),
        validCount: valid?.count || 0,
        noneCount: noneCount > 0 ? noneCount : 0
      }
    });
  } catch (error) {
    return handleError(c, '获取年检统计错误:', error);
  }
}

interface InspectionBody {
  vehicle_id?: string;
  expiry_date?: string;
  certificate_image?: string;
  remarks?: string;
}

// 创建或更新年检记录（每辆车只保留一条记录）
export async function createInspection(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { vehicle_id, expiry_date, certificate_image, remarks } = await c.req.json<InspectionBody>();

    if (!vehicle_id || !expiry_date) {
      return c.json({ success: false, message: '车辆和到期日期不能为空' }, 400);
    }

    const vehicle = await queryOne<{ plate_number: string }>(db, 'SELECT plate_number FROM vehicles WHERE id = ?', [
      vehicle_id
    ]);
    if (!vehicle) {
      return c.json({ success: false, message: '车辆不存在' }, 400);
    }

    const currentTime = now();

    // 检查是否已存在年检记录
    const existing = await queryOne<{ id: string }>(db, 'SELECT id FROM inspections WHERE vehicle_id = ?', [
      vehicle_id
    ]);

    if (existing) {
      await execute(
        db,
        'UPDATE inspections SET expiry_date = ?, certificate_image = ?, remarks = ?, updated_at = ? WHERE vehicle_id = ?',
        [expiry_date, certificate_image ?? null, remarks ?? null, currentTime, vehicle_id]
      );
      return c.json({ success: true, message: '年检证更新成功' });
    }

    const id = generateId();
    await execute(
      db,
      `INSERT INTO inspections (id, vehicle_id, plate_number, expiry_date, certificate_image, remarks, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'valid', ?, ?)`,
      [
        id,
        vehicle_id,
        vehicle.plate_number,
        expiry_date,
        certificate_image ?? null,
        remarks ?? null,
        currentTime,
        currentTime
      ]
    );
    return c.json({ success: true, message: '年检证创建成功' });
  } catch (error) {
    return handleError(c, '创建年检记录错误:', error);
  }
}

// 更新年检记录（通过车辆ID）
export async function updateInspection(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const vehicleId = c.req.param('vehicle_id');
    const { expiry_date, certificate_image, remarks } = await c.req.json<InspectionBody>();

    if (!expiry_date) {
      return c.json({ success: false, message: '到期日期不能为空' }, 400);
    }

    // 检查年检记录是否存在
    const inspection = await queryOne<{ id: string }>(db, 'SELECT id FROM inspections WHERE vehicle_id = ?', [
      vehicleId
    ]);

    if (!inspection) {
      const vehicle = await queryOne<{ plate_number: string }>(db, 'SELECT plate_number FROM vehicles WHERE id = ?', [
        vehicleId
      ]);
      if (!vehicle) {
        return c.json({ success: false, message: '车辆不存在' }, 404);
      }

      const id = generateId();
      const currentTime = now();
      await execute(
        db,
        `INSERT INTO inspections (id, vehicle_id, plate_number, expiry_date, certificate_image, remarks, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'valid', ?, ?)`,
        [id, vehicleId, vehicle.plate_number, expiry_date, certificate_image ?? null, remarks ?? null, currentTime, currentTime]
      );
    } else {
      await execute(
        db,
        'UPDATE inspections SET expiry_date = ?, certificate_image = ?, remarks = ?, updated_at = ? WHERE vehicle_id = ?',
        [expiry_date, certificate_image ?? null, remarks ?? null, now(), vehicleId]
      );
    }

    return c.json({ success: true, message: '年检记录更新成功' });
  } catch (error) {
    return handleError(c, '更新年检记录错误:', error);
  }
}

// 删除年检记录（通过车辆ID）
export async function deleteInspection(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const vehicleId = c.req.param('vehicle_id');
    await execute(db, 'DELETE FROM inspections WHERE vehicle_id = ?', [vehicleId]);
    return c.json({ success: true, message: '年检记录删除成功' });
  } catch (error) {
    return handleError(c, '删除年检记录错误:', error);
  }
}
