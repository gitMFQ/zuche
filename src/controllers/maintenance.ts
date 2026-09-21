import { type Bind, execute, query, queryOne, queryWithPagination } from '../db/helpers';
import type { MaintenanceRow } from '../db/rows';
import { generateId } from '../lib/ids';
import { handleError } from '../lib/errors';
import { parseStringArray, stringifyArray } from '../lib/json';
import { dateOffset, monthRange, now, today as todayDate } from '../lib/time';
import type { AppContext } from '../types';

// 保养类型映射
const TYPE_MAP: Record<string, string> = {
  maintenance: '保养',
  oil: '机油',
  oil_filter: '机滤',
  air_filter: '空滤',
  ac_filter: '空调滤',
  tire: '轮胎',
  coolant: '防冻液',
  brake_fluid: '刹车油',
  inspection: '年检',
  repair: '维修',
  other: '其它'
};

// 保养状态映射
const STATUS_MAP: Record<string, string> = {
  pending: '待保养',
  in_progress: '保养中',
  completed: '已完成'
};

function getTypeText(typeStr: string): string {
  return parseStringArray(typeStr).map((t) => TYPE_MAP[t] || t).join('、') || '-';
}

interface MaintenanceWithVehicle extends MaintenanceRow {
  brand: string | null;
  model: string | null;
}

function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function decorate(m: MaintenanceWithVehicle) {
  return {
    ...m,
    type_text: getTypeText(m.type),
    status_text: STATUS_MAP[m.status] || m.status,
    types: parseStringArray(m.type),
    images: parseImages(m.images)
  };
}

// 获取保养列表
export async function getMaintenanceList(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page = '1', pageSize = '10', keyword = '', status = '', type = '', vehicle_id = '' } = c.req.query();

    let sql = `SELECT m.*, v.brand, v.model FROM maintenance m
               LEFT JOIN vehicles v ON m.vehicle_id = v.id WHERE 1=1`;
    const params: Bind[] = [];

    if (keyword) {
      sql += ' AND (m.plate_number LIKE ? OR v.brand LIKE ? OR v.model LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) {
      sql += ' AND m.status = ?';
      params.push(status);
    }

    if (type) {
      sql += ' AND m.type LIKE ?';
      params.push(`%"${type}"%`);
    }

    if (vehicle_id) {
      sql += ' AND m.vehicle_id = ?';
      params.push(vehicle_id);
    }

    sql += ' ORDER BY m.maintenance_date DESC';

    const result = await queryWithPagination<MaintenanceWithVehicle>(db, sql, params, Number(page), Number(pageSize));

    return c.json({ success: true, data: { ...result, data: result.data.map(decorate) } });
  } catch (error) {
    return handleError(c, '获取保养列表错误:', error);
  }
}

interface UpcomingRow extends MaintenanceWithVehicle {
  vehicle_mileage: number | null;
}

// 获取保养统计
export async function getMaintenanceStats(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const [thisMonth, pending, thisMonthCost, upcomingExpire] = await Promise.all([
      queryOne<{ count: number }>(
        db,
        `SELECT COUNT(*) as count FROM maintenance
         WHERE maintenance_date >= ? AND maintenance_date < ?`,
        [monthRange().start, monthRange().end]
      ),
      queryOne<{ count: number }>(
        db,
        `SELECT COUNT(DISTINCT m.vehicle_id) as count FROM maintenance m
         LEFT JOIN vehicles v ON m.vehicle_id = v.id
         WHERE (m.type LIKE '%"oil"%' OR m.type = 'oil')
         AND (m.status = 'pending'
         OR (m.next_maintenance_mileage IS NOT NULL
             AND v.mileage >= m.next_maintenance_mileage - 1000))`
      ),
      queryOne<{ total: number }>(
        db,
        `SELECT COALESCE(SUM(cost), 0) as total FROM maintenance
         WHERE maintenance_date >= ? AND maintenance_date < ?`,
        [monthRange().start, monthRange().end]
      ),
      query<UpcomingRow>(
        db,
        `SELECT m.*, v.brand, v.model, v.mileage as vehicle_mileage FROM maintenance m
         LEFT JOIN vehicles v ON m.vehicle_id = v.id
         WHERE (m.type LIKE '%"oil"%' OR m.type = 'oil')
         AND (
           (m.next_maintenance_date IS NOT NULL
            AND m.next_maintenance_date >= ?
            AND m.next_maintenance_date <= ?)
           OR (m.next_maintenance_mileage IS NOT NULL
               AND v.mileage >= m.next_maintenance_mileage - 1000)
         )
         ORDER BY m.next_maintenance_date ASC`,
        [todayDate(), dateOffset(30)]
      )
    ]);

    return c.json({
      success: true,
      data: {
        thisMonth: thisMonth?.count || 0,
        pending: pending?.count || 0,
        thisMonthCost: thisMonthCost?.total || 0,
        upcomingExpire: upcomingExpire.map((m) => ({
          ...m,
          type_text: getTypeText(m.type),
          status_text: STATUS_MAP[m.status] || m.status
        }))
      }
    });
  } catch (error) {
    return handleError(c, '获取保养统计错误:', error);
  }
}

// 获取单个保养记录
export async function getMaintenance(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const maintenance = await queryOne<MaintenanceRow & { brand: string | null; model: string | null; color: string | null; year: number | null }>(
      db,
      `SELECT m.*, v.brand, v.model, v.color, v.year
       FROM maintenance m
       LEFT JOIN vehicles v ON m.vehicle_id = v.id
       WHERE m.id = ?`,
      [id]
    );

    if (!maintenance) {
      return c.json({ success: false, message: '保养记录不存在' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...maintenance,
        type_text: TYPE_MAP[maintenance.type] || maintenance.type,
        status_text: STATUS_MAP[maintenance.status] || maintenance.status
      }
    });
  } catch (error) {
    return handleError(c, '获取保养记录错误:', error);
  }
}

interface MaintenanceBody {
  vehicle_id?: string;
  plate_number?: string;
  type?: string[] | string;
  maintenance_date?: string;
  cost?: number;
  mileage?: number;
  garage?: string;
  next_maintenance_date?: string;
  next_maintenance_mileage?: number;
  images?: string[];
  remarks?: string;
  status?: string;
}

// 创建保养记录
export async function createMaintenance(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<MaintenanceBody>();
    const { vehicle_id, maintenance_date, mileage } = body;

    if (!vehicle_id || !body.type || !maintenance_date) {
      return c.json({ success: false, message: '车辆、保养类型和保养日期不能为空' }, 400);
    }

    // 未传车牌号时从车辆表取
    let plateNum = body.plate_number ?? null;
    if (!plateNum) {
      const vehicle = await queryOne<{ plate_number: string }>(db, 'SELECT plate_number FROM vehicles WHERE id = ?', [
        vehicle_id
      ]);
      plateNum = vehicle?.plate_number ?? null;
    }

    const id = generateId();
    const currentTime = now();

    await execute(
      db,
      `INSERT INTO maintenance (
        id, vehicle_id, plate_number, type, maintenance_date, cost, mileage,
        garage, next_maintenance_date, next_maintenance_mileage, images, remarks, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        vehicle_id,
        plateNum,
        stringifyArray(body.type),
        maintenance_date,
        body.cost || 0,
        mileage || 0,
        body.garage ?? null,
        body.next_maintenance_date ?? null,
        body.next_maintenance_mileage ?? null,
        body.images && body.images.length > 0 ? JSON.stringify(body.images) : null,
        body.remarks ?? null,
        body.status || 'completed',
        currentTime,
        currentTime
      ]
    );

    // 更新车辆的里程和上次保养日期
    if (mileage) {
      await execute(db, 'UPDATE vehicles SET mileage = ?, last_maintenance = ?, updated_at = ? WHERE id = ?', [
        mileage,
        maintenance_date,
        currentTime,
        vehicle_id
      ]);
    }

    return c.json({
      success: true,
      data: { id, plate_number: plateNum },
      message: '保养记录创建成功'
    });
  } catch (error) {
    return handleError(c, '创建保养记录错误:', error);
  }
}

// 更新保养记录
export async function updateMaintenance(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const body = await c.req.json<MaintenanceBody>();

    const maintenance = await queryOne<MaintenanceRow>(db, 'SELECT * FROM maintenance WHERE id = ?', [id]);
    if (!maintenance) {
      return c.json({ success: false, message: '保养记录不存在' }, 404);
    }

    await execute(
      db,
      `UPDATE maintenance SET
        vehicle_id = ?, type = ?, maintenance_date = ?, cost = ?, mileage = ?,
        garage = ?, next_maintenance_date = ?, next_maintenance_mileage = ?,
        images = ?, remarks = ?, status = ?, updated_at = ?
      WHERE id = ?`,
      [
        body.vehicle_id || maintenance.vehicle_id,
        stringifyArray(body.type),
        body.maintenance_date,
        body.cost ?? 0,
        body.mileage ?? 0,
        body.garage ?? null,
        body.next_maintenance_date ?? null,
        body.next_maintenance_mileage ?? null,
        body.images && body.images.length > 0 ? JSON.stringify(body.images) : null,
        body.remarks ?? null,
        body.status || maintenance.status,
        now(),
        id
      ]
    );

    return c.json({ success: true, message: '保养记录更新成功' });
  } catch (error) {
    return handleError(c, '更新保养记录错误:', error);
  }
}

// 删除保养记录
export async function deleteMaintenance(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    await execute(db, 'DELETE FROM maintenance WHERE id = ?', [id]);
    return c.json({ success: true, message: '保养记录删除成功' });
  } catch (error) {
    return handleError(c, '删除保养记录错误:', error);
  }
}
