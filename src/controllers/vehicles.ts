import { type Bind, execute, query, queryOne, queryWithPagination } from '../db/helpers';
import type { VehicleRow } from '../db/rows';
import { generateId } from '../lib/ids';
import { handleError } from '../lib/errors';
import { parseStringArray, stringifyArray } from '../lib/json';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
import { now } from '../lib/time';
import type { AppContext } from '../types';

// 车辆状态映射
const STATUS_MAP: Record<string, string> = {
  available: '可用',
  rented: '已出租',
  maintenance: '维修中',
  unavailable: '不可用'
};

// license_images 库里是 JSON 数组字符串，对外统一给数组
interface VehicleListItem extends Omit<VehicleRow, 'license_images'> {
  license_images: string[];
  actual_status?: string;
  status_text: string;
}

// 获取车辆列表
export async function getVehicles(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page = '1', pageSize = '10', keyword = '', status = '', brand = '' } = c.req.query();

    let sql = 'SELECT * FROM vehicles WHERE 1=1';
    const params: Bind[] = [];

    if (keyword) {
      sql += ' AND (plate_number LIKE ? OR brand LIKE ? OR model LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    // 注意：这里按数据库中的状态筛选，前端显示的状态会动态计算
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (brand) {
      sql += ' AND brand = ?';
      params.push(brand);
    }

    sql += ' ORDER BY created_at DESC';

    const currentTime = now();

    // 分页数据与「正在出租的车辆 id」并发查询，避免逐车回库（D1 下每次都是一次往返）
    const [result, busyRows] = await Promise.all([
      queryWithPagination<VehicleRow>(db, sql, params, Number(page), Number(pageSize)),
      query<{ vehicle_id: string }>(
        db,
        `SELECT DISTINCT vehicle_id FROM orders
         WHERE status IN ('pending', 'active')
           AND start_date <= ?
           AND end_date > ?`,
        [currentTime, currentTime]
      )
    ]);

    const busyIds = new Set(busyRows.map((row) => row.vehicle_id));

    const data: VehicleListItem[] = result.data.map((v) => {
      const base = { ...v, license_images: parseStringArray(v.license_images) };

      // 维修或不可用状态保持原样
      if (v.status === 'maintenance' || v.status === 'unavailable') {
        return { ...base, status_text: STATUS_MAP[v.status] || v.status };
      }

      if (busyIds.has(v.id)) {
        return { ...base, actual_status: 'rented', status_text: '已出租' };
      }

      return { ...base, actual_status: 'available', status_text: '可用' };
    });

    return c.json({ success: true, data: { ...result, data } });
  } catch (error) {
    return handleError(c, '获取车辆列表错误:', error);
  }
}

interface AvailableVehicle {
  id: string;
  plate_number: string;
  brand: string;
  model: string;
  color: string | null;
  daily_rate: number;
  deposit: number;
  status: string;
}

// 获取可用车辆（下拉选择用）
// 支持时间段参数：start_date, end_date
export async function getAvailableVehicles(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { start_date, end_date, exclude_order_id } = c.req.query();

    const vehicles = await query<AvailableVehicle>(
      db,
      `SELECT id, plate_number, brand, model, color, daily_rate, deposit, status
       FROM vehicles
       WHERE status NOT IN ('maintenance', 'unavailable')
       ORDER BY plate_number`
    );

    // 没有时间段时直接返回全部
    if (!start_date || !end_date) {
      return c.json({ success: true, data: vehicles });
    }

    // 一次性查出所有冲突车辆，避免逐车查询
    let conflictSql = `
      SELECT DISTINCT vehicle_id FROM orders
      WHERE status NOT IN ('cancelled', 'completed')
    `;
    const params: Bind[] = [];

    // 编辑订单时排除该订单自身
    if (exclude_order_id) {
      conflictSql += ' AND id != ?';
      params.push(exclude_order_id);
    }

    conflictSql += `
      AND (
        (start_date <= ? AND end_date > ?)
        OR (start_date < ? AND end_date >= ?)
        OR (start_date >= ? AND end_date <= ?)
      )
    `;
    params.push(start_date, start_date, end_date, end_date, start_date, end_date);

    const conflictRows = await query<{ vehicle_id: string }>(db, conflictSql, params);
    const conflictIds = new Set(conflictRows.map((row) => row.vehicle_id));

    return c.json({ success: true, data: vehicles.filter((v) => !conflictIds.has(v.id)) });
  } catch (error) {
    return handleError(c, '获取可用车辆错误:', error);
  }
}

// 获取单个车辆
export async function getVehicle(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');

    const [vehicle, orders] = await Promise.all([
      queryOne<VehicleRow>(db, 'SELECT * FROM vehicles WHERE id = ?', [id]),
      query(
        db,
        `SELECT o.*, c.name as customer_name, c.phone as customer_phone
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE o.vehicle_id = ?
         ORDER BY o.created_at DESC
         LIMIT 10`,
        [id]
      )
    ]);

    if (!vehicle) {
      return c.json({ success: false, message: '车辆不存在' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...vehicle,
        license_images: parseStringArray(vehicle.license_images),
        status_text: STATUS_MAP[vehicle.status] || vehicle.status,
        orders
      }
    });
  } catch (error) {
    return handleError(c, '获取车辆错误:', error);
  }
}

interface VehicleBody {
  plate_number?: string;
  brand?: string;
  model?: string;
  color?: string;
  year?: number;
  seats?: number;
  daily_rate?: number;
  deposit?: number;
  status?: string;
  mileage?: number;
  last_maintenance?: string;
  vin?: string;
  engine_number?: string;
  license_images?: string[] | string;
  /** 旧版前端发的是单张 license_image，兼容部署瞬间还没刷新的页面 */
  license_image?: string;
  registration_image?: string;
  is_new_energy?: boolean | number;
  remarks?: string;
  transmission?: string;
  fuel_type?: string;
  body_type?: string;
  doors?: number;
}

// 创建车辆
export async function createVehicle(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<VehicleBody>();
    const { plate_number, brand, model } = body;

    if (!plate_number || !brand || !model) {
      return c.json({ success: false, message: '车牌号、品牌、型号不能为空' }, 400);
    }

    // 检查车牌号是否已存在
    const existing = await queryOne<{ id: string }>(db, 'SELECT id FROM vehicles WHERE plate_number = ?', [
      plate_number
    ]);
    if (existing) {
      return c.json({ success: false, message: '该车牌号已存在' }, 400);
    }

    const id = generateId();
    const currentTime = now();

    await execute(
      db,
      `INSERT INTO vehicles (id, plate_number, brand, model, color, year, seats, daily_rate, deposit, mileage, vin, engine_number, license_images, registration_image, is_new_energy, remarks, transmission, fuel_type, body_type, doors, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)`,
      [
        id,
        plate_number,
        brand,
        model,
        body.color ?? null,
        body.year ?? null,
        body.seats ?? 5,
        body.daily_rate ?? 0,
        body.deposit ?? 0,
        body.mileage ?? 0,
        body.vin ?? null,
        body.engine_number ?? null,
        stringifyArray(body.license_images ?? body.license_image),
        body.registration_image ?? null,
        body.is_new_energy ? 1 : 0,
        body.remarks ?? null,
        body.transmission ?? null,
        body.fuel_type ?? null,
        body.body_type ?? null,
        body.doors ?? null,
        currentTime,
        currentTime
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '创建车辆',
      entityType: 'vehicle',
      entityId: id,
      details: `创建车辆 ${plate_number}（${brand} ${model}）`,
      ipAddress: getClientIp(c)
    });

    return c.json({
      success: true,
      data: { id, plate_number, brand, model },
      message: '车辆创建成功'
    });
  } catch (error) {
    return handleError(c, '创建车辆错误:', error);
  }
}

// 更新车辆
export async function updateVehicle(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const body = await c.req.json<VehicleBody>();
    const { plate_number } = body;

    const vehicle = await queryOne<{ id: string }>(db, 'SELECT id FROM vehicles WHERE id = ?', [id]);
    if (!vehicle) {
      return c.json({ success: false, message: '车辆不存在' }, 404);
    }

    // 检查车牌号是否被其他车辆使用
    if (plate_number) {
      const existingPlate = await queryOne<{ id: string }>(
        db,
        'SELECT id FROM vehicles WHERE plate_number = ? AND id != ?',
        [plate_number, id]
      );
      if (existingPlate) {
        return c.json({ success: false, message: '该车牌号已被其他车辆使用' }, 400);
      }
    }

    await execute(
      db,
      `UPDATE vehicles SET plate_number = ?, brand = ?, model = ?, color = ?, year = ?, seats = ?, daily_rate = ?, deposit = ?, status = ?, mileage = ?, last_maintenance = ?, vin = ?, engine_number = ?, license_images = ?, registration_image = ?, is_new_energy = ?, remarks = ?, transmission = ?, fuel_type = ?, body_type = ?, doors = ?, updated_at = ? WHERE id = ?`,
      [
        plate_number,
        body.brand,
        body.model,
        body.color ?? null,
        body.year ?? null,
        body.seats ?? 5,
        body.daily_rate ?? 0,
        body.deposit ?? 0,
        body.status,
        body.mileage ?? 0,
        body.last_maintenance ?? null,
        body.vin ?? null,
        body.engine_number ?? null,
        stringifyArray(body.license_images ?? body.license_image),
        body.registration_image ?? null,
        body.is_new_energy ? 1 : 0,
        body.remarks ?? null,
        body.transmission ?? null,
        body.fuel_type ?? null,
        body.body_type ?? null,
        body.doors ?? null,
        now(),
        id
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '更新车辆',
      entityType: 'vehicle',
      entityId: id,
      details: `更新车辆 ${plate_number}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '车辆更新成功' });
  } catch (error) {
    return handleError(c, '更新车辆错误:', error);
  }
}

// 删除车辆
export async function deleteVehicle(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');

    // 检查是否有未完成的订单
    const activeOrders = await queryOne<{ count: number }>(
      db,
      "SELECT COUNT(*) as count FROM orders WHERE vehicle_id = ? AND status IN ('pending', 'active')",
      [id]
    );

    if (activeOrders && activeOrders.count > 0) {
      return c.json({ success: false, message: '该车辆有未完成的订单，无法删除' }, 400);
    }

    const vehicle = await queryOne<{ plate_number: string }>(db, 'SELECT plate_number FROM vehicles WHERE id = ?', [
      id
    ]);
    await execute(db, 'DELETE FROM vehicles WHERE id = ?', [id]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除车辆',
      entityType: 'vehicle',
      entityId: id,
      details: `删除车辆 ${vehicle?.plate_number || ''}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '车辆删除成功' });
  } catch (error) {
    return handleError(c, '删除车辆错误:', error);
  }
}

// 获取车辆品牌列表
export async function getVehicleBrands(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const brands = await query<{ brand: string }>(db, 'SELECT DISTINCT brand FROM vehicles ORDER BY brand');
    return c.json({ success: true, data: brands.map((b) => b.brand) });
  } catch (error) {
    return handleError(c, '获取品牌列表错误:', error);
  }
}
