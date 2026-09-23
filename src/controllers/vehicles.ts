import { type Bind, execute, query, queryOne, queryWithPagination } from '../db/helpers';
import type { VehicleRow } from '../db/rows';
import { generateId } from '../lib/ids';
import { handleError } from '../lib/errors';
import { parseStringArray, stringifyArray } from '../lib/json';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
import { now } from '../lib/time';
import { VEHICLE_STATUS_WHITELIST, busyVehicleIds } from '../lib/vehicles';
import { OWNERSHIP_TYPES, oneOf } from '../lib/ledger';
import { VEHICLE_CATEGORY_TEXT } from '../lib/constants';

/** 车型分类枚举直接取自中文名映射的 key，避免再维护第三份清单 */
const VEHICLE_CATEGORIES = Object.keys(VEHICLE_CATEGORY_TEXT);
import type { AppContext } from '../types';

// 车辆状态映射。不含 rented：已出租是派生状态，由订单时间区间算出（见 lib/vehicles.ts）
const STATUS_MAP: Record<string, string> = {
  available: '可用',
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

    const currentTime = now();

    let sql = 'SELECT * FROM vehicles WHERE 1=1';
    const params: Bind[] = [];

    if (keyword) {
      sql += ' AND (plate_number LIKE ? OR brand LIKE ? OR model LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    // 状态筛选按「显示状态」过滤。列表展示的是派生状态（可用/已出租/维修中/不可用），
    // 而库里只存人工状态，所以 available 与 rented 都要结合订单占用情况判断，
    // 只按 status 列筛会出现「筛已出租筛不出来、筛可用却是别人正在租的车」。
    if (status === 'maintenance' || status === 'unavailable') {
      sql += ' AND status = ?';
      params.push(status);
    } else if (status === 'rented' || status === 'available') {
      const busyCondition = `EXISTS (
        SELECT 1 FROM orders o
        WHERE o.vehicle_id = vehicles.id
          AND o.status IN ('pending', 'active')
          AND o.start_date <= ? AND o.end_date > ?
      )`;
      sql += ` AND status NOT IN ('maintenance', 'unavailable') AND ${status === 'rented' ? busyCondition : `NOT ${busyCondition}`}`;
      params.push(currentTime, currentTime);
    }

    if (brand) {
      sql += ' AND brand = ?';
      params.push(brand);
    }

    sql += ' ORDER BY created_at DESC';

    // 分页数据与「正在出租的车辆 id」并发查询，避免逐车回库（D1 下每次都是一次往返）
    const [result, busyIds] = await Promise.all([
      queryWithPagination<VehicleRow>(db, sql, params, Number(page), Number(pageSize)),
      busyVehicleIds(db, currentTime)
    ]);

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
  /** 车辆编号（台账里的 01-18 序号），可空但填了必须唯一 */
  vehicle_no?: string | null;
  /** 车型分类：suv / sedan / mpv / pickup / other。与 body_type（携程车型串解析结果）用途不同 */
  category?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  initial_mileage?: number | null;
  /** 车主 id（软引用 owners.id） */
  owner_id?: string | null;
  /** company 自有 / attached 挂靠。挂靠车才有车主公司管理费 */
  ownership_type?: string;
  monthly_payment?: number;
  loan_total?: number | null;
  loan_terms?: number | null;
  loan_start_date?: string | null;
  loan_account_id?: string | null;
}

/**
 * 档案相关的 12 个列名与取值。create/update 共用，避免两处列清单漂移。
 *
 * `current` 是更新场景下的现有行：字段缺省时**沿用原值而不是重置成默认值**。
 * 这 12 个字段与钱直接相关（车主决定结算费率、月供进单车月报），
 * 被一次不带这些字段的更新清空会造成「车还在、车主没了」——
 * 车直接掉出车主对账单，结算单也会悄悄按 0 费率算，全程没有任何报错。
 */
function archiveColumns(body: VehicleBody, current?: VehicleRow) {
  const pick = <K extends keyof VehicleBody>(key: K, fallback: unknown) =>
    body[key] !== undefined ? body[key] : fallback;
  return {
    columns: 'vehicle_no, category, purchase_date, purchase_price, initial_mileage, owner_id, ownership_type, monthly_payment, loan_total, loan_terms, loan_start_date, loan_account_id',
    values: [
      String(pick('vehicle_no', current?.vehicle_no ?? '') ?? '').trim() || null,
      String(pick('category', current?.category ?? '') ?? '').trim() || null,
      String(pick('purchase_date', current?.purchase_date ?? '') ?? '').trim() || null,
      toNullableNumber(pick('purchase_price', current?.purchase_price ?? null)),
      toNullableNumber(pick('initial_mileage', current?.initial_mileage ?? null)),
      String(pick('owner_id', current?.owner_id ?? '') ?? '').trim() || null,
      String(pick('ownership_type', current?.ownership_type ?? 'company') ?? 'company'),
      toNullableNumber(pick('monthly_payment', current?.monthly_payment ?? 0)) ?? 0,
      toNullableNumber(pick('loan_total', current?.loan_total ?? null)),
      toNullableNumber(pick('loan_terms', current?.loan_terms ?? null)),
      String(pick('loan_start_date', current?.loan_start_date ?? '') ?? '').trim() || null,
      String(pick('loan_account_id', current?.loan_account_id ?? '') ?? '').trim() || null
    ]
  };
}

/** 数字字段统一收敛：非有限数按 null（金额为 0 的语义由调用方决定，不在这里兜底成 0） */
function toNullableNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 档案字段的跨表校验。
 * 返回错误提示字符串，通过时返回 null。
 */
async function validateArchive(db: D1Database, body: VehicleBody, excludeId?: string): Promise<string | null> {
  if (body.ownership_type !== undefined && !oneOf(body.ownership_type, OWNERSHIP_TYPES)) {
    return '车辆归属只能是自有或挂靠';
  }
  if (body.category != null && body.category !== '' && !oneOf(body.category, VEHICLE_CATEGORIES)) {
    return '车型分类不合法';
  }
  // 车辆编号有部分唯一索引兜底，这里先查一次是为了给出能看懂的提示
  const vehicleNo = body.vehicle_no?.trim();
  if (vehicleNo) {
    const conflict = await queryOne<{ id: string }>(
      db,
      'SELECT id FROM vehicles WHERE vehicle_no = ? AND id != ?',
      [vehicleNo, excludeId ?? '']
    );
    if (conflict) {
      return `车辆编号 ${vehicleNo} 已被其他车辆使用`;
    }
  }
  if (body.owner_id?.trim()) {
    const owner = await queryOne<{ id: string }>(db, 'SELECT id FROM owners WHERE id = ? AND status = 1', [
      body.owner_id.trim()
    ]);
    if (!owner) {
      return '车主不存在或已停用';
    }
  }
  return null;
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

    const archiveError = await validateArchive(db, body);
    if (archiveError) {
      return c.json({ success: false, message: archiveError }, 400);
    }

    const archive = archiveColumns(body);
    const id = generateId();
    const currentTime = now();

    await execute(
      db,
      `INSERT INTO vehicles (id, plate_number, brand, model, color, year, seats, daily_rate, deposit, mileage, vin, engine_number, license_images, registration_image, is_new_energy, remarks, transmission, fuel_type, body_type, doors, ${archive.columns}, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${archive.values.map(() => '?').join(', ')}, 'available', ?, ?)`,
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
        ...archive.values,
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

    const vehicle = await queryOne<{ id: string; status: string }>(db, 'SELECT id, status FROM vehicles WHERE id = ?', [id]);
    if (!vehicle) {
      return c.json({ success: false, message: '车辆不存在' }, 404);
    }

    // 「已出租」是订单推导出来的派生状态，不允许手工写入，否则又会出现两套真相
    if (body.status !== undefined && !VEHICLE_STATUS_WHITELIST.includes(body.status)) {
      return c.json(
        { success: false, message: '车辆状态无效：只能是可用、维修中或不可用（「已出租」由订单自动判定）' },
        400
      );
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

    const archiveError = await validateArchive(db, body, id);
    if (archiveError) {
      return c.json({ success: false, message: archiveError }, 400);
    }
    // 传入现有行：缺省的档案字段沿用原值，避免「只改里程」把车主与归属清掉
    const existingVehicle = await queryOne<VehicleRow>(db, 'SELECT * FROM vehicles WHERE id = ?', [id]);
    const archive = archiveColumns(body, existingVehicle ?? undefined);

    await execute(
      db,
      `UPDATE vehicles SET plate_number = ?, brand = ?, model = ?, color = ?, year = ?, seats = ?, daily_rate = ?, deposit = ?, status = ?, mileage = ?, last_maintenance = ?, vin = ?, engine_number = ?, license_images = ?, registration_image = ?, is_new_energy = ?, remarks = ?, transmission = ?, fuel_type = ?, body_type = ?, doors = ?,
         vehicle_no = ?, category = ?, purchase_date = ?, purchase_price = ?, initial_mileage = ?, owner_id = ?, ownership_type = ?, monthly_payment = ?, loan_total = ?, loan_terms = ?, loan_start_date = ?, loan_account_id = ?,
         updated_at = ? WHERE id = ?`,
      [
        plate_number,
        body.brand,
        body.model,
        body.color ?? null,
        body.year ?? null,
        body.seats ?? 5,
        body.daily_rate ?? 0,
        body.deposit ?? 0,
        body.status ?? vehicle.status,
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
        ...archive.values,
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

    // 结算行外键是 RESTRICT（钱的历史不能跟着车一起消失），
    // 先查一次是为了给出能看懂的原因，而不是让用户收到一句外键约束失败
    const settlements = await queryOne<{ count: number }>(
      db,
      'SELECT COUNT(*) as count FROM settlement_lines WHERE vehicle_id = ?',
      [id]
    );
    if (settlements && settlements.count > 0) {
      return c.json(
        { success: false, message: `该车辆已有 ${settlements.count} 条结算记录，无法删除，请改为「不可用」` },
        400
      );
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

/**
 * 车辆筛选下拉的去重选项（车牌号 / 车型）。
 *
 * 前端原本拉 pageSize=10000 的全量车辆在前端去重，但 queryWithPagination 把
 * pageSize 上限锁在 100，车牌或车型超过 100 条后下拉选项就不全了。
 * 这里在后端直接去重，返回的 payload 也远小于整行数据。
 */
export async function getVehicleFilterOptions(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const [plates, models] = await Promise.all([
      query<{ plate_number: string }>(db, 'SELECT DISTINCT plate_number FROM vehicles ORDER BY plate_number'),
      query<{ model: string }>(
        db,
        `SELECT DISTINCT TRIM(brand || ' ' || model) AS model
         FROM vehicles
         WHERE brand IS NOT NULL AND model IS NOT NULL AND TRIM(brand || ' ' || model) <> ''
         ORDER BY model`
      )
    ]);

    return c.json({
      success: true,
      data: {
        plateNumbers: plates.map((row) => row.plate_number),
        models: models.map((row) => row.model)
      }
    });
  } catch (error) {
    return handleError(c, '获取车辆筛选项错误:', error);
  }
}
