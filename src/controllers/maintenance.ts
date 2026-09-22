import { type Bind, type Stmt, batchExecute, query, queryOne, queryWithPagination } from '../db/helpers';
import type { MaintenanceRow } from '../db/rows';
import { generateId } from '../lib/ids';
import { handleError } from '../lib/errors';
import { parseStringArray, stringifyArray } from '../lib/json';
import { dateOffset, monthRange, now, today as todayDate } from '../lib/time';
import { buildMirrorDeleteStmts, buildMirrorSyncStmts, findPaidMirror } from '../lib/expenseMirror';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
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
  /** 以下三个是车辆费用台账侧的信息：源单据不关心钱从哪出，所以留成可选 */
  invoice_status?: string;
  account_id?: string | null;
  paid_at?: string | null;
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
    const images = body.images && body.images.length > 0 ? JSON.stringify(body.images) : null;

    // 保养单与它的车辆费用镜像必须同批写入：两处各写一次很容易漏，而且漏了没人发现
    const vehicle = await queryOne<{ owner_id: string | null }>(db, 'SELECT owner_id FROM vehicles WHERE id = ?', [
      vehicle_id
    ]);
    const mirror = await buildMirrorSyncStmts(
      db,
      {
        sourceType: 'maintenance',
        sourceId: id,
        vehicleId: vehicle_id,
        plateNumber: plateNum,
        ownerId: vehicle?.owner_id ?? null,
        expenseDate: maintenance_date,
        // 保养单的类型是数组，费用台账里统一归到「保养」（只有维修成本单独走 repair 时另说）
        expenseType: 'maintenance',
        expenseTypeName: '保养',
        incomeAmount: 0,
        expenseAmount: body.cost || 0,
        invoiceStatus: body.invoice_status,
        remarks: body.remarks ?? null,
        images
      },
      { operatorId: getAuthUser(c)?.id ?? null, currentTime },
      { id, paidAccountId: body.account_id ?? null, paidAt: body.paid_at ?? maintenance_date }
    );

    const stmts: Stmt[] = [
      {
        sql: `INSERT INTO maintenance (
          id, vehicle_id, plate_number, type, maintenance_date, cost, mileage,
          garage, next_maintenance_date, next_maintenance_mileage, images, remarks, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
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
          images,
          body.remarks ?? null,
          body.status || 'completed',
          currentTime,
          currentTime
        ]
      },
      ...mirror.stmts
    ];

    // 更新车辆的里程和上次保养日期
    if (mileage) {
      stmts.push({
        sql: 'UPDATE vehicles SET mileage = ?, last_maintenance = ?, updated_at = ? WHERE id = ?',
        params: [mileage, maintenance_date, currentTime, vehicle_id]
      });
    }

    await batchExecute(db, stmts);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '创建保养记录',
      entityType: 'maintenance',
      entityId: id,
      details: `创建保养记录 ${plateNum ?? ''} ${maintenance_date}，费用 ${body.cost || 0}`,
      ipAddress: getClientIp(c)
    });

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

    const currentTime = now();
    const images = body.images && body.images.length > 0 ? JSON.stringify(body.images) : null;
    const vehicleId = body.vehicle_id || maintenance.vehicle_id;
    const maintenanceDate = body.maintenance_date || maintenance.maintenance_date;
    const cost = body.cost ?? 0;

    const vehicle = await queryOne<{ owner_id: string | null }>(db, 'SELECT owner_id FROM vehicles WHERE id = ?', [
      vehicleId
    ]);
    const mirror = await buildMirrorSyncStmts(
      db,
      {
        sourceType: 'maintenance',
        sourceId: id ?? '',
        vehicleId,
        plateNumber: maintenance.plate_number,
        ownerId: vehicle?.owner_id ?? null,
        expenseDate: maintenanceDate,
        expenseType: 'maintenance',
        expenseTypeName: '保养',
        incomeAmount: 0,
        expenseAmount: cost,
        invoiceStatus: body.invoice_status,
        remarks: body.remarks ?? null,
        images
      },
      { operatorId: getAuthUser(c)?.id ?? null, currentTime }
    );
    if (mirror.blocked) {
      return c.json({ success: false, message: mirror.blocked }, 400);
    }

    await batchExecute(db, [
      {
        sql: `UPDATE maintenance SET
          vehicle_id = ?, type = ?, maintenance_date = ?, cost = ?, mileage = ?,
          garage = ?, next_maintenance_date = ?, next_maintenance_mileage = ?,
          images = ?, remarks = ?, status = ?, updated_at = ?
        WHERE id = ?`,
        params: [
          vehicleId,
          stringifyArray(body.type),
          maintenanceDate,
          cost,
          body.mileage ?? 0,
          body.garage ?? null,
          body.next_maintenance_date ?? null,
          body.next_maintenance_mileage ?? null,
          images,
          body.remarks ?? null,
          body.status || maintenance.status,
          currentTime,
          id
        ]
      },
      ...mirror.stmts
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '更新保养记录',
      entityType: 'maintenance',
      entityId: id,
      details: `更新保养记录 ${maintenance.plate_number ?? ''} ${maintenanceDate}，费用 ${cost}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '保养记录更新成功' });
  } catch (error) {
    return handleError(c, '更新保养记录错误:', error);
  }
}

// 删除保养记录
export async function deleteMaintenance(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';
    const maintenance = await queryOne<MaintenanceRow>(db, 'SELECT * FROM maintenance WHERE id = ?', [id]);
    if (!maintenance) {
      return c.json({ success: false, message: '保养记录不存在' }, 404);
    }

    // 镜像行已付款意味着这笔钱已经进过资金流水，不能在源单据上悄悄删掉
    const paid = await findPaidMirror(db, 'maintenance', id);
    if (paid) {
      return c.json({ success: false, message: '该保养的费用已在车辆费用台账标记付款，请先撤销付款再删除' }, 400);
    }

    await batchExecute(db, [
      ...buildMirrorDeleteStmts('maintenance', id),
      { sql: 'DELETE FROM maintenance WHERE id = ?', params: [id] }
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除保养记录',
      entityType: 'maintenance',
      entityId: id,
      details: `删除保养记录 ${maintenance.plate_number ?? ''} ${maintenance.maintenance_date}，费用 ${maintenance.cost}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '保养记录删除成功' });
  } catch (error) {
    return handleError(c, '删除保养记录错误:', error);
  }
}
