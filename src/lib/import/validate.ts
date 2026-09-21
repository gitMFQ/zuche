/**
 * 导入预检：逐行校验 + 与库内数据匹配，只读不写。
 *
 * 客户按姓名匹配（平台导出没有完整手机号，脱敏的也没法当匹配键），
 * 车辆按车牌匹配，匹配不到时标记为「将新建」，由 commit 阶段落库。
 */

import { query } from '../../db/helpers';
import type { NormalizedRow } from './normalize';
import type { Platform } from './templates';

export type IssueLevel = 'error' | 'warning';

export interface RowIssue {
  field: string;
  message: string;
  level: IssueLevel;
}

export interface MatchedCustomer {
  id: string;
  name: string;
}

export interface MatchedVehicle {
  id: string;
  plate_number: string;
}

export interface MatchedDriver {
  id: string;
  name: string;
}

export interface PreparedRow {
  rowIndex: number;
  row: NormalizedRow;
  issues: RowIssue[];
  customer: MatchedCustomer | null;
  customerAction: 'match' | 'create' | null;
  vehicle: MatchedVehicle | null;
  vehicleAction: 'match' | 'create' | null;
  pickupDriver: MatchedDriver | null;
  returnDriver: MatchedDriver | null;
  /** 库内已存在同 order_no 的记录 */
  duplicate: boolean;
  /** 命中黑名单（按手机号或姓名）。只做提示，不阻断导入 */
  blacklisted: boolean;
  /** 可通过校验、可以落库 */
  importable: boolean;
}

export interface PrepareSummary {
  total: number;
  importable: number;
  error: number;
  warning: number;
  duplicates: number;
  newCustomers: number;
  newVehicles: number;
  /** 命中黑名单的行数（仅提示，不阻断导入） */
  blacklisted: number;
}

export interface PrepareResult {
  platform: Platform;
  rows: PreparedRow[];
  summary: PrepareSummary;
}

const CHUNK = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/**
 * 批量按某列查回记录。占位符数量是拼接的，但值始终走参数绑定，
 * 表名与列名来自本文件常量而非用户输入。
 */
async function buildLookup<T>(
  db: D1Database,
  table: string,
  column: string,
  select: string,
  values: string[],
  toKey: (row: T) => string,
  extraWhere = ''
): Promise<Map<string, T>> {
  const map = new Map<string, T>();
  const unique = [...new Set(values.filter((item) => item !== ''))];

  for (const part of chunk(unique, CHUNK)) {
    const placeholders = part.map(() => '?').join(', ');
    const rows = await query<T>(
      db,
      `SELECT ${select} FROM ${table} WHERE ${column} IN (${placeholders})${extraWhere}`,
      part
    );
    for (const row of rows) {
      map.set(toKey(row), row);
    }
  }

  return map;
}

interface PlateOccupancy {
  plate_number: string;
  start_date: string;
  end_date: string;
}

export async function prepareRows(
  db: D1Database,
  platform: Platform,
  rows: NormalizedRow[]
): Promise<PrepareResult> {
  const [customers, vehicles, drivers, existingOrders, blacklistByPhone, blacklistByName] = await Promise.all([
    buildLookup<MatchedCustomer>(db, 'customers', 'name', 'id, name', rows.map((r) => r.customer_name), (row) => row.name),
    buildLookup<MatchedVehicle>(
      db,
      'vehicles',
      'plate_number',
      'id, plate_number',
      rows.map((r) => r.plate_number),
      (row) => row.plate_number
    ),
    buildLookup<MatchedDriver>(
      db,
      'users',
      'name',
      'id, name',
      rows.flatMap((r) => [r.pickup_driver ?? '', r.return_driver ?? '']),
      (row) => row.name
    ),
    buildLookup<{ order_no: string }>(db, 'orders', 'order_no', 'order_no', rows.map((r) => r.external_no), (row) => row.order_no),
    // 黑名单只保留 status = 1 的生效记录。平台导出的手机号常被脱敏，
    // 所以手机号与姓名两条线都查，任一中命中即标记。
    buildLookup<{ phone: string; reason: string }>(
      db,
      'blacklist',
      'phone',
      'phone, reason',
      rows.map((r) => r.customer_phone),
      (row) => row.phone,
      ' AND status = 1'
    ),
    buildLookup<{ name: string; reason: string }>(
      db,
      'blacklist',
      'name',
      'name, reason',
      rows.map((r) => r.customer_name),
      (row) => row.name,
      ' AND status = 1'
    )
  ]);

  // 库内同车牌已排的时间段，用于提示重叠
  const plates = [...new Set(rows.map((r) => r.plate_number).filter((p) => p !== ''))];
  const occupancy: PlateOccupancy[] = [];
  for (const part of chunk(plates, CHUNK)) {
    const placeholders = part.map(() => '?').join(', ');
    const occupied = await query<PlateOccupancy>(
      db,
      `SELECT v.plate_number, o.start_date, o.end_date
       FROM orders o
       JOIN vehicles v ON o.vehicle_id = v.id
       WHERE v.plate_number IN (${placeholders})
         AND o.status NOT IN ('cancelled')`,
      part
    );
    occupancy.push(...occupied);
  }

  const seenExternal = new Set<string>();
  const prepared: PreparedRow[] = rows.map((row) => {
    const issues: RowIssue[] = [];

    if (!row.external_no) issues.push({ field: 'external_no', message: '缺少平台订单号', level: 'error' });
    if (!row.customer_name) issues.push({ field: 'customer_name', message: '缺少客户姓名', level: 'error' });
    if (!row.plate_number) issues.push({ field: 'plate_number', message: '缺少车牌号', level: 'error' });
    if (!row.start_date) issues.push({ field: 'start_date', message: '缺少取车时间', level: 'error' });
    if (!row.end_date) issues.push({ field: 'end_date', message: '缺少还车时间', level: 'error' });
    if (row.start_date && row.end_date && row.end_date <= row.start_date) {
      issues.push({ field: 'end_date', message: '还车时间早于取车时间', level: 'error' });
    }
    if (!row.status) {
      issues.push({ field: 'status', message: `未知订单状态：${row.status_raw || '空'}`, level: 'error' });
    }
    if (row.phone_masked && !row.customer_phone) {
      issues.push({ field: 'customer_phone', message: '手机号脱敏，建议补全', level: 'warning' });
    }
    if (row.total_amount <= 0) {
      issues.push({ field: 'total_amount', message: '订单金额为 0', level: 'warning' });
    }

    const duplicate = existingOrders.has(row.external_no);
    if (duplicate) {
      issues.push({ field: 'external_no', message: '该订单已导入过', level: 'error' });
    }

    const inBatchDuplicate = seenExternal.has(row.external_no);
    if (row.external_no) seenExternal.add(row.external_no);
    if (inBatchDuplicate) {
      issues.push({ field: 'external_no', message: '文件内订单号重复', level: 'error' });
    }

    const customer = customers.get(row.customer_name) ?? null;
    if (!customer && row.customer_name) {
      issues.push({ field: 'customer_name', message: `将新建客户「${row.customer_name}」`, level: 'warning' });
    }

    const vehicle = vehicles.get(row.plate_number) ?? null;
    if (!vehicle && row.plate_number) {
      issues.push({ field: 'plate_number', message: `将新建车辆「${row.plate_number}」`, level: 'warning' });
    }

    if (vehicle && row.start_date && row.end_date) {
      const overlap = occupancy.some(
        (item) =>
          item.plate_number === row.plate_number &&
          item.start_date < row.end_date &&
          item.end_date > row.start_date
      );
      if (overlap) {
        issues.push({ field: 'plate_number', message: '与库内同车牌订单时间重叠', level: 'warning' });
      }
    }

    const hasError = issues.some((issue) => issue.level === 'error');

    // 黑名单命中只给警告：平台导出的是历史账单，导入是补录行为，
    // 强行拦截会让整批数据进不来。真正的风险提示留给建单路径去拦。
    const blacklistHit =
      (row.customer_phone ? blacklistByPhone.get(row.customer_phone) : undefined) ??
      (row.customer_name ? blacklistByName.get(row.customer_name) : undefined);
    if (blacklistHit) {
      issues.push({ field: 'customer_name', message: `客户在黑名单中：${blacklistHit.reason}`, level: 'warning' });
    }

    return {
      rowIndex: row.rowIndex,
      row,
      issues,
      customer,
      customerAction: customer ? 'match' : row.customer_name ? 'create' : null,
      vehicle,
      vehicleAction: vehicle ? 'match' : row.plate_number ? 'create' : null,
      pickupDriver: row.pickup_driver ? (drivers.get(row.pickup_driver) ?? null) : null,
      returnDriver: row.return_driver ? (drivers.get(row.return_driver) ?? null) : null,
      duplicate,
      blacklisted: Boolean(blacklistHit),
      importable: !hasError
    };
  });

  const summary: PrepareSummary = {
    total: prepared.length,
    importable: prepared.filter((item) => item.importable).length,
    error: prepared.filter((item) => item.issues.some((i) => i.level === 'error')).length,
    warning: prepared.filter((item) => item.issues.some((i) => i.level === 'warning')).length,
    duplicates: prepared.filter((item) => item.duplicate).length,
    newCustomers: prepared.filter((item) => item.customerAction === 'create').length,
    newVehicles: prepared.filter((item) => item.vehicleAction === 'create').length,
    blacklisted: prepared.filter((item) => item.blacklisted).length
  };

  return { platform, rows: prepared, summary };
}

/** 只保留可导入的行，供 commit 阶段使用 */
export function importableRows(prepared: PreparedRow[]): PreparedRow[] {
  return prepared.filter((item) => item.importable);
}
