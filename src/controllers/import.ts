/**
 * 订单批量导入。
 *
 * 分两段：preview 只读校验、commit 才落库。前端在 preview 之后可以改手机号、
 * 勾选跳过某些行，commit 时用 overrides 把改动带回来重新走一遍归一化。
 *
 * 这里刻意不复用 createOrder：它会强制 pending、校验手机号格式、检查车辆可用性
 * 与时间冲突，而平台导出的是历史账单，全不满足这些前提。
 */

import { type Bind, batchExecute, execute, query, queryOne, type Stmt } from '../db/helpers';
import { handleError } from '../lib/errors';
import { generateId } from '../lib/ids';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
import { now } from '../lib/time';
import type { AppContext } from '../types';
import { normalizeSheet, parseVehicleAttributes, type NormalizedRow, type RawSheet } from '../lib/import/normalize';
import { prepareRows } from '../lib/import/validate';
import type { Platform } from '../lib/import/templates';

interface ImportBody extends RawSheet {
  platform?: Platform;
  filename?: string;
  /** 预览后的改动，按行下标定位 */
  overrides?: { rowIndex: number; customer_phone?: string; skip?: boolean }[];
  /** 整批套用的订单来源，必填：导入的订单统一挂到该来源下 */
  default_source_id?: string;
}

/** 一次 batch 的语句上限，避免单批过大 */
const STMT_CHUNK = 200;

const ORDER_INSERT_SQL = `
  INSERT INTO orders (
    id, order_no, customer_id, vehicle_id, user_id,
    start_date, end_date, actual_start_date, actual_end_date,
    daily_rate, deposit, violation_deposit, total_amount, paid_amount,
    status, remarks, source_id, source_name, commission_rate, net_amount,
    service_type, deposit_waived, pickup_location, return_location,
    platform, external_no, import_batch_id, cancel_reason, cancelled_at,
    delivery_type, pickup_driver_id, pickup_driver_name, return_driver_id, return_driver_name,
    booked_model, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function daysBetween(start: string, end: string): number {
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 1;
  return Math.max(1, Math.ceil((to - from) / (1000 * 60 * 60 * 24)));
}

/** 携程的优享/尊享服务费对应系统的服务类型档位 */
function resolveServiceType(row: NormalizedRow): string {
  const hasVip = row.fees.some((fee) => /尊享/.test(fee.fee_name) && fee.receivable > 0);
  if (hasVip) return 'vip';
  const hasPremium = row.fees.some((fee) => /优享/.test(fee.fee_name) && fee.receivable > 0);
  return hasPremium ? 'premium' : 'basic';
}

function applyOverrides(rows: NormalizedRow[], body: ImportBody): Set<number> {
  const skipped = new Set<number>();
  for (const item of body.overrides ?? []) {
    if (item.skip) {
      skipped.add(item.rowIndex);
      continue;
    }
    const target = rows[item.rowIndex];
    if (!target || item.customer_phone === undefined) continue;
    const phone = item.customer_phone.trim();
    target.customer_phone = phone;
    // 人工补全后就不是脱敏号了，清掉标记免得预览里继续报警
    target.phone_masked = phone.includes('*');
  }
  return skipped;
}

/** 预览：只校验不落库 */
export async function previewImport(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<ImportBody>();
    const normalized = normalizeSheet({ headers: body.headers, rows: body.rows }, body.platform);

    if ('error' in normalized) {
      return c.json({ success: false, message: normalized.error }, 400);
    }

    const result = await prepareRows(db, normalized.template.platform, normalized.rows);

    return c.json({
      success: true,
      data: {
        platform: result.platform,
        rows: result.rows,
        summary: result.summary
      }
    });
  } catch (error) {
    return handleError(c, '导入预检错误:', error);
  }
}

/** 确认导入：写库 */
export async function commitImport(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<ImportBody>();
    const normalized = normalizeSheet({ headers: body.headers, rows: body.rows }, body.platform);

    if ('error' in normalized) {
      return c.json({ success: false, message: normalized.error }, 400);
    }

    if (!body.default_source_id) {
      return c.json({ success: false, message: '请先选择订单来源' }, 400);
    }

    const defaultSource = await queryOne<{ id: string; name: string; commission_rate: number }>(
      db,
      'SELECT id, name, commission_rate FROM order_sources WHERE id = ? AND status = 1',
      [body.default_source_id]
    );
    if (!defaultSource) {
      return c.json({ success: false, message: '所选订单来源不存在或已删除' }, 400);
    }

    const skipped = applyOverrides(normalized.rows, body);
    const prepared = await prepareRows(db, normalized.template.platform, normalized.rows);
    const targets = prepared.rows.filter((item) => item.importable && !skipped.has(item.rowIndex));

    if (targets.length === 0) {
      return c.json({ success: false, message: '没有可导入的订单' }, 400);
    }

    const operatorId = getAuthUser(c)?.id ?? '';
    const batchId = generateId();
    const currentTime = now();
    const platform = normalized.template.platform;

    await execute(
      db,
      `INSERT INTO import_batches (id, platform, filename, total_rows, operator_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [batchId, platform, body.filename ?? null, prepared.rows.length, operatorId || null, currentTime]
    );

    // 先建好客户/车辆，订单才能引用它们的 id。id 在内存里预生成，
    // 因为 D1 的 batch 拿不回自增结果。
    const customerIds = new Map<string, string>();
    const vehicleIds = new Map<string, string>();
    const bootstrap: Stmt[] = [];

    for (const item of targets) {
      const { row } = item;

      if (item.customerAction === 'create' && !customerIds.has(row.customer_name)) {
        const id = generateId();
        customerIds.set(row.customer_name, id);
        bootstrap.push({
          sql: `INSERT INTO customers (id, name, phone, status, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`,
          params: [id, row.customer_name, row.customer_phone || '', currentTime, currentTime]
        });
      }

      if (item.vehicleAction === 'create' && !vehicleIds.has(row.plate_number)) {
        const id = generateId();
        vehicleIds.set(row.plate_number, id);
        const attrs = parseVehicleAttributes(row.vehicle_model);
        const days = daysBetween(row.start_date, row.end_date);
        // 车型串里没有日租金，用总额反推一个估算值，后续在车辆页改
        const dailyRate = days > 0 ? Math.round((row.total_amount / days) * 100) / 100 : 0;
        bootstrap.push({
          sql: `INSERT INTO vehicles (id, plate_number, brand, model, seats, doors, transmission, fuel_type, body_type,
                  is_new_energy, daily_rate, deposit, mileage, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'available', ?, ?)`,
          params: [
            id,
            row.plate_number,
            row.vehicle_model || '未知',
            row.vehicle_model || '未知',
            attrs.seats ?? 5,
            attrs.doors,
            attrs.transmission,
            attrs.fuel_type,
            attrs.body_type,
            attrs.is_new_energy,
            dailyRate,
            currentTime,
            currentTime
          ]
        });
      }
    }

    if (bootstrap.length > 0) {
      await batchExecute(db, bootstrap);
    }

    const statements: Stmt[] = [];
    let newCustomers = 0;
    let newVehicles = 0;

    for (const item of targets) {
      const { row } = item;

      const customerId = item.customer?.id ?? customerIds.get(row.customer_name) ?? '';
      if (!item.customer) newCustomers += 1;

      const vehicleId = item.vehicle?.id ?? vehicleIds.get(row.plate_number) ?? '';
      if (!item.vehicle) newVehicles += 1;

      if (!customerId || !vehicleId) continue;

      // 携程「实收」与「供应商应收」的差额就是实际佣金，比来源默认费率精确
      const commissionRate =
        row.total_amount > 0 && row.net_amount > 0 && row.net_amount < row.total_amount
          ? Math.round(((row.total_amount - row.net_amount) / row.total_amount) * 10000) / 100
          : defaultSource.commission_rate;

      // 续租过的单，合同还车时间以续租后的为准
      const finalEndDate = row.extend_end_date && row.extend_end_date > row.end_date ? row.extend_end_date : row.end_date;
      const days = daysBetween(row.start_date, finalEndDate);
      const dailyRate = days > 0 ? Math.round((row.total_amount / days) * 100) / 100 : 0;

      // 免押的订单押金实际未收取，但押金标准本身有对账价值，
      // 所以这里保留原值，由 deposit_waived 单独标记是否免押
      const fees = row.fees;

      const orderId = generateId();
      const userId = item.pickupDriver?.id ?? operatorId;
      const orderCreatedAt = row.order_created_at ?? currentTime;

      const orderParams: Bind[] = [
        orderId,
        row.external_no,
        customerId,
        vehicleId,
        userId || null,
        row.start_date,
        finalEndDate,
        row.actual_start_date,
        row.actual_end_date,
        dailyRate,
        row.deposit,
        row.violation_deposit,
        row.total_amount,
        row.paid_amount,
        row.status,
        row.remarks,
        defaultSource.id,
        defaultSource.name,
        commissionRate,
        row.net_amount,
        resolveServiceType(row),
        row.deposit_waived ? 1 : 0,
        row.pickup_location,
        row.return_location,
        platform,
        row.external_no,
        batchId,
        row.cancel_reason,
        row.cancel_time,
        row.delivery_type,
        item.pickupDriver?.id ?? null,
        row.pickup_driver,
        item.returnDriver?.id ?? null,
        row.return_driver,
        row.booked_model,
        orderCreatedAt,
        currentTime
      ];

      statements.push({ sql: ORDER_INSERT_SQL, params: orderParams });

      for (const fee of fees) {
        statements.push({
          sql: `INSERT INTO order_fees (id, order_id, fee_category, fee_name, receivable, received, refunded, platform, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            generateId(),
            orderId,
            fee.fee_category,
            fee.fee_name,
            fee.receivable,
            fee.received,
            fee.refunded,
            platform,
            currentTime
          ]
        });
      }

      if (row.paid_amount > 0) {
        statements.push({
          sql: `INSERT INTO payments (id, order_id, amount, payment_method, payment_type, remarks, created_at)
                VALUES (?, ?, ?, 'platform', 'rent', ?, ?)`,
          params: [generateId(), orderId, row.paid_amount, '批量导入', orderCreatedAt]
        });
      }

      if (row.extend_end_date && row.extend_end_date > row.end_date) {
        statements.push({
          sql: `INSERT INTO order_extensions (id, order_id, original_end_date, new_end_date, extend_days, extend_amount, operator_id, remarks, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            generateId(),
            orderId,
            row.end_date,
            row.extend_end_date,
            daysBetween(row.end_date, row.extend_end_date),
            row.extend_amount,
            operatorId || null,
            '导入自平台导出',
            currentTime
          ]
        });
      }
    }

    for (const part of chunkStatements(statements, STMT_CHUNK)) {
      await batchExecute(db, part);
    }

    const skippedCount = prepared.rows.length - targets.length;
    await execute(
      db,
      `UPDATE import_batches SET success_rows = ?, skipped_rows = ?, new_customers = ?, new_vehicles = ? WHERE id = ?`,
      [targets.length, skippedCount, customerIds.size, vehicleIds.size, batchId]
    );

    await logAction(db, {
      userId: operatorId,
      action: '批量导入订单',
      entityType: 'order',
      entityId: batchId,
      details: `导入 ${targets.length} 条订单（${platform === 'ctrip' ? '携程' : '自有平台'}），新建客户 ${customerIds.size}，新建车辆 ${vehicleIds.size}`,
      ipAddress: getClientIp(c)
    });

    return c.json({
      success: true,
      data: {
        batch_id: batchId,
        imported: targets.length,
        skipped: skippedCount,
        new_customers: customerIds.size,
        new_vehicles: vehicleIds.size
      },
      message: `成功导入 ${targets.length} 条订单`
    });
  } catch (error) {
    return handleError(c, '导入订单错误:', error);
  }
}

function chunkStatements(statements: Stmt[], size: number): Stmt[][] {
  const result: Stmt[][] = [];
  for (let i = 0; i < statements.length; i += size) {
    result.push(statements.slice(i, i + size));
  }
  return result;
}

/** 撤销一整个导入批次：订单连带费用/续租/支付一起删除 */
export async function rollbackImport(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const batchId = c.req.param('id');
    const batch = await queryOne<{ id: string; platform: string }>(
      db,
      'SELECT id, platform FROM import_batches WHERE id = ?',
      [batchId]
    );

    if (!batch) {
      return c.json({ success: false, message: '导入批次不存在' }, 404);
    }

    await execute(db, 'DELETE FROM orders WHERE import_batch_id = ?', [batchId]);
    await execute(db, 'DELETE FROM import_batches WHERE id = ?', [batchId]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '撤销导入批次',
      entityType: 'order',
      entityId: batchId,
      details: `撤销导入批次 ${batchId}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '已撤销该导入批次' });
  } catch (error) {
    return handleError(c, '撤销导入错误:', error);
  }
}

/** 导入批次列表，便于溯源与撤销 */
export async function getImportBatches(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const rows = await query<Record<string, unknown>>(
      db,
      `SELECT b.*, u.name as operator_name
       FROM import_batches b
       LEFT JOIN users u ON b.operator_id = u.id
       ORDER BY b.created_at DESC
       LIMIT 50`
    );
    return c.json({ success: true, data: rows });
  } catch (error) {
    return handleError(c, '获取导入批次错误:', error);
  }
}
