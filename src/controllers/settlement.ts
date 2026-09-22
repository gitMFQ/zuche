/**
 * 车主结算台账。
 *
 * 公式与口径见 src/lib/settlement.ts 的文件头（那是唯一权威说明）。
 *
 * 这里只强调两个使用上的约定：
 *
 * 1. **结算行是「按需生成」的，不是下单时自动生成**。
 *    订单会取消、改价、续租、还车重算，下单即生成的台账全是噪音且要反复维护。
 *    所以做成一个显式动作：选结算期 → 生成本期结算 → 核对 → 出对账单。
 *    生成是幂等的，重复点只是把系统口径刷新一遍。
 *
 * 2. **人工改过的行不会被重算覆盖**。
 *    amount_overridden = 1 之后，重算只更新 calc_*（供前端展示「系统算 X / 你改成 Y」），
 *    最终值保持人工填的。要恢复自动，用「恢复自动计算」。
 */

import { type Bind, type Stmt, batchExecute, execute, query, queryOne, queryWithPagination } from '../db/helpers';
import type { OwnerRow, SettlementLineRow, SettlementOpeningRow, SettlementPayoutRow } from '../db/rows';
import { handleError } from '../lib/errors';
import { findPeriodLock, isDate, oneOf, PAYOUT_TYPES, pushFundTxn, SETTLEMENT_LINE_STATUSES } from '../lib/ledger';
import { generateId } from '../lib/ids';
import { logAction } from '../lib/log';
import { roundMoney, toAmount } from '../lib/money';
import { getAuthUser, getClientIp } from '../lib/request';
import {
  buildSettlementAmounts,
  buildSettlementInsertStmt,
  buildSettlementRefreshStmt,
  moneyOf
} from '../lib/settlement';
import { calcRentalDays } from '../lib/orderAmount';
import { isPeriod, monthRangeOf, now, periodOf, today } from '../lib/time';
import type { AppContext } from '../types';

/** 单次生成的订单上限。结算行有 37 列，一次塞太多会让整批失败且难定位 */
const GENERATE_BATCH = 50;

/** 待结算的订单行（连车牌、车主、费率一起取出，避免逐单回查） */
interface SettleableOrder {
  id: string;
  order_no: string;
  vehicle_id: string;
  customer_id: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  daily_rate: number;
  commission_rate: number;
  source_id: string | null;
  source_name: string | null;
  plate_number: string | null;
  customer_name: string | null;
  owner_id: string;
  company_fee_rate: number;
}

const SETTLEABLE_ORDER_SQL = `
  SELECT o.id, o.order_no, o.vehicle_id, o.customer_id, o.start_date, o.end_date,
    o.total_amount, o.daily_rate, o.commission_rate, o.source_id,
    v.plate_number, v.owner_id,
    c.name AS customer_name,
    s.name AS source_name,
    ow.company_fee_rate
  FROM orders o
  JOIN vehicles v ON v.id = o.vehicle_id
  JOIN owners ow ON ow.id = v.owner_id
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN order_sources s ON s.id = o.source_id
  WHERE o.status != 'cancelled' AND o.start_date >= ? AND o.start_date < ?
`;

/**
 * 生成本期结算行。
 *
 * 归属规则：按订单的**取车时间**归月（台账「用车时间」列），不是按还车时间。
 * 跨月的长租单整笔落在取车那个月，与台账一致。
 *
 * 幂等：已存在的行只刷新系统口径，不新增；人工改过的行由 CASE 守卫生效。
 */
export async function generateSettlementLines(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<{ period?: string; owner_id?: string; vehicle_id?: string; offset?: number }>();
    const period = periodOf(body.period) || periodOf(today());

    if (!isPeriod(period)) {
      return c.json({ success: false, message: '结算期格式应为 YYYY-MM' }, 400);
    }

    const locked = await findPeriodLock(db, `${period}-01`);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法生成结算` }, 400);
    }

    const { start, end } = monthRangeOf(period);
    const params: Bind[] = [start, end];
    let sql = SETTLEABLE_ORDER_SQL;

    if (body.owner_id) {
      sql += ' AND ow.id = ?';
      params.push(body.owner_id);
    }
    if (body.vehicle_id) {
      sql += ' AND o.vehicle_id = ?';
      params.push(body.vehicle_id);
    }
    sql += ' ORDER BY o.start_date, o.id';

    // 分页取一批：offset 由前端循环推进，hasMore 为 false 时结束。
    // 不用 LIMIT ? OFFSET ? 之外的技巧，因为幂等所以重入是安全的。
    const offset = Number.isFinite(body.offset) && Number(body.offset) > 0 ? Math.floor(Number(body.offset)) : 0;
    const orders = await query<SettleableOrder>(db, `${sql} LIMIT ? OFFSET ?`, [...params, GENERATE_BATCH, offset]);

    if (orders.length === 0) {
      return c.json({
        success: true,
        data: { period, inserted: 0, updated: 0, skipped: 0, hasMore: false, scanned: 0 },
        message: `${period} 没有需要结算的订单`
      });
    }

    // 已存在的行先查出来：判断是新增还是刷新，同时拿到 other_fee / 覆盖标记（刷新语句自己处理）
    const orderIds = orders.map((order) => order.id);
    const existingRows = await query<{ source_id: string }>(
      db,
      `SELECT source_id FROM settlement_lines
       WHERE source_type = 'order' AND line_kind = 'main' AND source_id IN (${orderIds.map(() => '?').join(', ')})`,
      orderIds
    );
    const existing = new Set(existingRows.map((row) => row.source_id));

    const currentTime = now();
    const operatorId = getAuthUser(c)?.id ?? null;
    const stmts: Stmt[] = [];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const order of orders) {
      const days = calcRentalDays(order.start_date, order.end_date);
      const amounts = buildSettlementAmounts({
        totalAmount: order.total_amount,
        platformRate: order.commission_rate,
        companyRate: order.company_fee_rate
      });

      if (existing.has(order.id)) {
        stmts.push(buildSettlementRefreshStmt(order.id, amounts, currentTime));
        updated += 1;
        continue;
      }

      // 合计为 0 的单（占位/待定价）不生成结算行，免得台账里全是 0
      if (roundMoney(toAmount(order.total_amount)) === 0) {
        skipped += 1;
        continue;
      }

      stmts.push(
        buildSettlementInsertStmt(
          {
            ownerId: order.owner_id,
            vehicleId: order.vehicle_id,
            orderId: order.id,
            period,
            lineDate: order.start_date,
            orderNo: order.order_no,
            plateNumber: order.plate_number,
            sourceIdRef: order.source_id,
            sourceName: order.source_name,
            customerName: order.customer_name,
            startDate: order.start_date,
            endDate: order.end_date,
            days,
            unitPrice: order.daily_rate,
            amounts,
            sourceType: 'order',
            sourceId: order.id,
            lineKind: 'main'
          },
          { id: generateId(), operatorId, currentTime }
        )
      );
      inserted += 1;
    }

    await batchExecute(db, stmts);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '生成结算',
      entityType: 'settlement_line',
      details: `生成 ${period} 结算：新增 ${inserted}，刷新 ${updated}，跳过 ${skipped}${
        body.owner_id ? '（指定车主）' : ''
      }`,
      ipAddress: getClientIp(c)
    });

    return c.json({
      success: true,
      data: {
        period,
        inserted,
        updated,
        skipped,
        scanned: orders.length,
        hasMore: orders.length === GENERATE_BATCH
      },
      message: `${period} 生成完成：新增 ${inserted} 条，刷新 ${updated} 条`
    });
  } catch (error) {
    return handleError(c, '生成结算错误:', error);
  }
}

/** 结算行列表 */
export async function getSettlementLines(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page, pageSize, period, owner_id, vehicle_id, status, keyword } = c.req.query();

    const where: string[] = [];
    const params: Bind[] = [];

    if (period) {
      where.push('l.period = ?');
      params.push(period);
    }
    if (owner_id) {
      where.push('l.owner_id = ?');
      params.push(owner_id);
    }
    if (vehicle_id) {
      where.push('l.vehicle_id = ?');
      params.push(vehicle_id);
    }
    if (oneOf(status, SETTLEMENT_LINE_STATUSES)) {
      where.push('l.status = ?');
      params.push(status);
    }
    if (keyword) {
      where.push('(l.customer_name LIKE ? OR l.order_no LIKE ? OR l.plate_number LIKE ? OR l.remarks LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const filter = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const from = `FROM settlement_lines l
      LEFT JOIN owners ow ON ow.id = l.owner_id
      LEFT JOIN vehicles v ON v.id = l.vehicle_id${filter}`;

    // 合计与列表共用筛选条件。只统计正常行，作废行不参与任何金额
    const totals = await queryOne<{
      total_amount: number;
      platform_fee: number;
      settlement_amount: number;
      company_fee: number;
      other_fee: number;
      owner_amount: number;
      days: number;
      count: number;
    }>(
      db,
      `SELECT
         ROUND(COALESCE(SUM(CASE WHEN l.status = 'posted' THEN l.total_amount ELSE 0 END), 0), 6) AS total_amount,
         ROUND(COALESCE(SUM(CASE WHEN l.status = 'posted' THEN l.platform_fee ELSE 0 END), 0), 6) AS platform_fee,
         ROUND(COALESCE(SUM(CASE WHEN l.status = 'posted' THEN l.settlement_amount ELSE 0 END), 0), 6) AS settlement_amount,
         ROUND(COALESCE(SUM(CASE WHEN l.status = 'posted' THEN l.company_fee ELSE 0 END), 0), 6) AS company_fee,
         ROUND(COALESCE(SUM(CASE WHEN l.status = 'posted' THEN l.other_fee ELSE 0 END), 0), 6) AS other_fee,
         ROUND(COALESCE(SUM(CASE WHEN l.status = 'posted' THEN l.owner_amount ELSE 0 END), 0), 6) AS owner_amount,
         ROUND(COALESCE(SUM(CASE WHEN l.status = 'posted' THEN l.days ELSE 0 END), 0), 6) AS days,
         COUNT(*) AS count
       ${from}`,
      params
    );

    const sql = `SELECT l.*, ow.name AS owner_name, v.plate_number AS vehicle_plate ${from} ORDER BY l.line_date, l.created_at`;

    const pageNum = Number(page);
    const size = Number(pageSize);
    if (Number.isFinite(pageNum) && pageNum > 0 && Number.isFinite(size) && size > 0) {
      const result = await queryWithPagination<SettlementLineRow>(db, sql, params, pageNum, size);
      return c.json({ success: true, data: { ...result, totals } });
    }

    const rows = await query<SettlementLineRow>(db, sql, params);
    return c.json({ success: true, data: { data: rows, total: rows.length, totals } });
  } catch (error) {
    return handleError(c, '获取结算行错误:', error);
  }
}

/** 手工补录结算行（台账里那些没法从订单推出来的行，例如「顶H6」的补偿） */
export async function createSettlementLine(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<{
      owner_id?: string;
      vehicle_id?: string | null;
      period?: string;
      line_date?: string;
      customer_name?: string | null;
      days?: number;
      unit_price?: number;
      total_amount?: number;
      platform_rate?: number;
      company_rate?: number;
      other_fee?: number;
      remarks?: string | null;
    }>();

    const ownerId = body.owner_id?.trim();
    if (!ownerId) {
      return c.json({ success: false, message: '请选择车主' }, 400);
    }
    const owner = await queryOne<OwnerRow>(db, 'SELECT * FROM owners WHERE id = ?', [ownerId]);
    if (!owner) {
      return c.json({ success: false, message: '车主不存在' }, 404);
    }

    const period = periodOf(body.period) || periodOf(today());
    if (!isPeriod(period)) {
      return c.json({ success: false, message: '结算期格式应为 YYYY-MM' }, 400);
    }
    const lineDate = body.line_date?.trim() ?? '';
    if (!isDate(lineDate.substring(0, 10))) {
      return c.json({ success: false, message: '用车时间格式应为 YYYY-MM-DD' }, 400);
    }

    const locked = await findPeriodLock(db, lineDate);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法补录` }, 400);
    }

    const amounts = buildSettlementAmounts({
      totalAmount: toAmount(body.total_amount),
      platformRate: body.platform_rate ?? 0,
      companyRate: body.company_rate ?? owner.company_fee_rate,
      otherFee: toAmount(body.other_fee)
    });

    const stmt = buildSettlementInsertStmt(
      {
        ownerId,
        vehicleId: body.vehicle_id?.trim() || null,
        orderId: null,
        period,
        lineDate,
        orderNo: null,
        plateNumber: null,
        sourceIdRef: null,
        sourceName: null,
        customerName: body.customer_name ?? null,
        startDate: null,
        endDate: null,
        days: toAmount(body.days),
        unitPrice: toAmount(body.unit_price),
        amounts,
        sourceType: 'manual',
        sourceId: null,
        lineKind: 'main',
        remarks: body.remarks ?? null
      },
      { id: generateId(), operatorId: getAuthUser(c)?.id ?? null, currentTime: now() }
    );

    await execute(db, stmt.sql, stmt.params ?? []);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '补录结算',
      entityType: 'settlement_line',
      details: `补录 ${period} 结算：${owner.name}，合计 ${amounts.totalAmount}，车主金额 ${amounts.ownerAmount}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { owner_amount: amounts.ownerAmount }, message: '结算行已补录' });
  } catch (error) {
    return handleError(c, '补录结算行错误:', error);
  }
}

/**
 * 人工修改结算金额（台账备注列里那些特殊调整）。
 *
 * 写入最终值 + amount_overridden = 1，同时把 calc_* 刷成当前系统口径，
 * 前端据此展示「系统算 X / 你改成 Y / 差异 Z」。
 * 之后订单再改价也不会覆盖这一行，除非用户点「恢复自动计算」。
 */
export async function updateSettlementLine(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';
    const body = await c.req.json<{
      total_amount?: number;
      platform_fee?: number;
      settlement_amount?: number;
      company_fee?: number;
      other_fee?: number;
      owner_amount?: number;
      override_note?: string | null;
      remarks?: string | null;
      /** 传 true 表示恢复自动计算（清掉覆盖标记，最终值回到系统口径） */
      restore_auto?: boolean;
    }>();

    const line = await queryOne<SettlementLineRow>(db, 'SELECT * FROM settlement_lines WHERE id = ?', [id]);
    if (!line) {
      return c.json({ success: false, message: '结算行不存在' }, 404);
    }
    if (line.status === 'void') {
      return c.json({ success: false, message: '已作废的结算行不能修改' }, 400);
    }

    const locked = await findPeriodLock(db, line.line_date);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法修改结算` }, 400);
    }

    const currentTime = now();

    if (body.restore_auto) {
      // 恢复自动：把最终值拉回 calc_*（otherFee 用现有的）
      const calc = buildSettlementAmounts({
        totalAmount: line.calc_total_amount,
        platformRate: line.calc_platform_rate,
        companyRate: line.calc_company_rate,
        otherFee: line.other_fee
      });
      const money = moneyOf(calc);
      await execute(
        db,
        `UPDATE settlement_lines SET total_amount = ?, platform_fee = ?, settlement_amount = ?, company_fee = ?,
           owner_amount = ?, amount_overridden = 0, override_note = NULL, remarks = ?, updated_at = ?
         WHERE id = ?`,
        [
          money.totalAmount,
          money.platformFee,
          money.settlementAmount,
          money.companyFee,
          money.ownerAmount,
          body.remarks !== undefined ? body.remarks : line.remarks,
          currentTime,
          id
        ]
      );

      await logAction(db, {
        userId: getAuthUser(c)?.id ?? '',
        action: '恢复结算自动计算',
        entityType: 'settlement_line',
        entityId: id,
        details: `恢复自动：${line.period} ${line.plate_number ?? ''} ${line.customer_name ?? ''}，车主金额 ${money.ownerAmount}`,
        ipAddress: getClientIp(c)
      });

      return c.json({ success: true, data: { owner_amount: money.ownerAmount }, message: '已恢复自动计算' });
    }

    const otherFee = body.other_fee !== undefined ? roundMoney(toAmount(body.other_fee)) : line.other_fee;
    const totalAmount = body.total_amount !== undefined ? roundMoney(toAmount(body.total_amount)) : line.total_amount;
    const platformFee = body.platform_fee !== undefined ? roundMoney(toAmount(body.platform_fee)) : line.platform_fee;
    const settlementAmount =
      body.settlement_amount !== undefined
        ? roundMoney(toAmount(body.settlement_amount))
        : roundMoney(totalAmount - platformFee);
    const companyFee = body.company_fee !== undefined ? roundMoney(toAmount(body.company_fee)) : line.company_fee;
    // 车主金额不传时按公式推：结算金额 − 公司管理费 − 其他费用
    const ownerAmount =
      body.owner_amount !== undefined
        ? roundMoney(toAmount(body.owner_amount))
        : roundMoney(settlementAmount - companyFee - otherFee);

    await execute(
      db,
      `UPDATE settlement_lines SET total_amount = ?, platform_fee = ?, settlement_amount = ?, company_fee = ?,
         other_fee = ?, owner_amount = ?, amount_overridden = 1, override_note = ?, remarks = ?, updated_at = ?
       WHERE id = ?`,
      [
        totalAmount,
        platformFee,
        settlementAmount,
        companyFee,
        otherFee,
        ownerAmount,
        body.override_note ?? line.override_note,
        body.remarks !== undefined ? body.remarks : line.remarks,
        currentTime,
        id
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '人工调整结算',
      entityType: 'settlement_line',
      entityId: id,
      details: `人工调整 ${line.period} ${line.plate_number ?? ''} ${line.customer_name ?? ''}：车主金额 ${
        line.owner_amount
      } → ${ownerAmount}${body.override_note ? `（${body.override_note}）` : ''}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { owner_amount: ownerAmount }, message: '结算行已更新' });
  } catch (error) {
    return handleError(c, '修改结算行错误:', error);
  }
}

/** 作废结算行（不物理删除：台账要能看出这行为什么不算钱） */
export async function voidSettlementLine(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';
    const { reason } = await c.req.json<{ reason?: string }>().catch(() => ({ reason: undefined }));

    const line = await queryOne<SettlementLineRow>(db, 'SELECT * FROM settlement_lines WHERE id = ?', [id]);
    if (!line) {
      return c.json({ success: false, message: '结算行不存在' }, 404);
    }
    if (line.status === 'void') {
      return c.json({ success: false, message: '该结算行已作废' }, 400);
    }

    const locked = await findPeriodLock(db, line.line_date);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法作废` }, 400);
    }

    await execute(db, "UPDATE settlement_lines SET status = 'void', voided_reason = ?, updated_at = ? WHERE id = ?", [
      reason?.trim() || '手工作废',
      now(),
      id
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '作废结算行',
      entityType: 'settlement_line',
      entityId: id,
      details: `作废 ${line.period} ${line.plate_number ?? ''} ${line.customer_name ?? ''}，车主金额 ${line.owner_amount}，原因：${
        reason?.trim() || '手工作废'
      }`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '结算行已作废' });
  } catch (error) {
    return handleError(c, '作废结算行错误:', error);
  }
}

/** 恢复作废的结算行 */
export async function restoreSettlementLine(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';

    const line = await queryOne<SettlementLineRow>(db, 'SELECT * FROM settlement_lines WHERE id = ?', [id]);
    if (!line) {
      return c.json({ success: false, message: '结算行不存在' }, 404);
    }
    if (line.status !== 'void') {
      return c.json({ success: false, message: '该结算行未被作废' }, 400);
    }

    const locked = await findPeriodLock(db, line.line_date);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法恢复` }, 400);
    }

    await execute(
      db,
      "UPDATE settlement_lines SET status = 'posted', voided_reason = NULL, updated_at = ? WHERE id = ?",
      [now(), id]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '恢复结算行',
      entityType: 'settlement_line',
      entityId: id,
      details: `恢复结算行 ${line.period} ${line.plate_number ?? ''} ${line.customer_name ?? ''}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '结算行已恢复' });
  } catch (error) {
    return handleError(c, '恢复结算行错误:', error);
  }
}

// ==================== 期初结转 ====================

/** 期初结转列表（台账里的「2024年余额 5387」） */
export async function getSettlementOpenings(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { owner_id, fiscal_year } = c.req.query();

    let sql = `SELECT so.*, ow.name AS owner_name, v.plate_number
      FROM settlement_openings so
      LEFT JOIN owners ow ON ow.id = so.owner_id
      LEFT JOIN vehicles v ON v.id = so.vehicle_id
      WHERE 1 = 1`;
    const params: Bind[] = [];

    if (owner_id) {
      sql += ' AND so.owner_id = ?';
      params.push(owner_id);
    }
    const year = Number(fiscal_year);
    if (Number.isFinite(year) && year > 0) {
      sql += ' AND so.fiscal_year = ?';
      params.push(year);
    }
    sql += ' ORDER BY so.fiscal_year DESC, ow.name';

    const rows = await query<SettlementOpeningRow>(db, sql, params);
    return c.json({ success: true, data: rows });
  } catch (error) {
    return handleError(c, '获取期初结转错误:', error);
  }
}

/**
 * 新增/修改期初结转。
 * 唯一键是 (owner_vehicle_key, fiscal_year)，所以传同样的车主+车辆+年份就是覆盖。
 */
export async function upsertSettlementOpening(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<{
      owner_id?: string;
      vehicle_id?: string | null;
      fiscal_year?: number;
      amount?: number;
      remarks?: string | null;
    }>();

    const ownerId = body.owner_id?.trim();
    if (!ownerId) {
      return c.json({ success: false, message: '请选择车主' }, 400);
    }
    const owner = await queryOne<OwnerRow>(db, 'SELECT * FROM owners WHERE id = ?', [ownerId]);
    if (!owner) {
      return c.json({ success: false, message: '车主不存在' }, 404);
    }
    const year = Number(body.fiscal_year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return c.json({ success: false, message: '年份不合法' }, 400);
    }
    const amount = roundMoney(toAmount(body.amount));
    const vehicleId = body.vehicle_id?.trim() || null;
    // 唯一约束要绕开 SQLite「NULL 互不相等」，所以用拼出来的非空串做键
    const key = `${ownerId}:${vehicleId ?? ''}`;

    const currentTime = now();
    const existing = await queryOne<SettlementOpeningRow>(
      db,
      'SELECT * FROM settlement_openings WHERE owner_vehicle_key = ? AND fiscal_year = ?',
      [key, year]
    );

    if (existing) {
      await execute(
        db,
        'UPDATE settlement_openings SET amount = ?, remarks = ?, updated_at = ? WHERE id = ?',
        [amount, body.remarks ?? null, currentTime, existing.id]
      );
      await logAction(db, {
        userId: getAuthUser(c)?.id ?? '',
        action: '修改期初结转',
        entityType: 'settlement_opening',
        entityId: existing.id,
        details: `${owner.name} ${year} 年结转：${existing.amount} → ${amount}`,
        ipAddress: getClientIp(c)
      });
      return c.json({ success: true, data: { id: existing.id }, message: '期初结转已更新' });
    }

    const id = generateId();
    await execute(
      db,
      `INSERT INTO settlement_openings (id, owner_id, vehicle_id, owner_vehicle_key, fiscal_year, amount, remarks, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ownerId, vehicleId, key, year, amount, body.remarks ?? null, currentTime, currentTime]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '新增期初结转',
      entityType: 'settlement_opening',
      entityId: id,
      details: `${owner.name} ${year} 年结转 ${amount}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { id }, message: '期初结转已保存' });
  } catch (error) {
    return handleError(c, '保存期初结转错误:', error);
  }
}

export async function deleteSettlementOpening(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';
    const opening = await queryOne<SettlementOpeningRow>(db, 'SELECT * FROM settlement_openings WHERE id = ?', [id]);
    if (!opening) {
      return c.json({ success: false, message: '期初结转不存在' }, 404);
    }

    await execute(db, 'DELETE FROM settlement_openings WHERE id = ?', [id]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除期初结转',
      entityType: 'settlement_opening',
      entityId: id,
      details: `删除 ${opening.fiscal_year} 年结转 ${opening.amount}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '期初结转已删除' });
  } catch (error) {
    return handleError(c, '删除期初结转错误:', error);
  }
}

// ==================== 结算付款 ====================

/** 结算付款列表（台账底部支出区：结车款 / 预付款） */
export async function getSettlementPayouts(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page, pageSize, owner_id, period } = c.req.query();

    const where: string[] = [];
    const params: Bind[] = [];

    if (owner_id) {
      where.push('p.owner_id = ?');
      params.push(owner_id);
    }
    if (period) {
      where.push('p.period = ?');
      params.push(period);
    }
    const filter = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const totals = await queryOne<{ total: number; count: number }>(
      db,
      `SELECT ROUND(COALESCE(SUM(p.amount), 0), 6) AS total, COUNT(*) AS count FROM settlement_payouts p${filter}`,
      params
    );

    const sql = `SELECT p.*, ow.name AS owner_name, v.plate_number, fa.name AS account_name
      FROM settlement_payouts p
      LEFT JOIN owners ow ON ow.id = p.owner_id
      LEFT JOIN vehicles v ON v.id = p.vehicle_id
      LEFT JOIN fund_accounts fa ON fa.id = p.account_id${filter}
      ORDER BY p.paid_at DESC, p.created_at DESC`;

    const pageNum = Number(page);
    const size = Number(pageSize);
    if (Number.isFinite(pageNum) && pageNum > 0 && Number.isFinite(size) && size > 0) {
      const result = await queryWithPagination<SettlementPayoutRow>(db, sql, params, pageNum, size);
      return c.json({ success: true, data: { ...result, totals } });
    }

    const rows = await query<SettlementPayoutRow>(db, sql, params);
    return c.json({ success: true, data: { data: rows, total: rows.length, totals } });
  } catch (error) {
    return handleError(c, '获取结算付款错误:', error);
  }
}

/** 记录一笔结算付款，并在同批写一条 out 流水（钱确实出去了，账户余额要跟着动） */
export async function createSettlementPayout(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<{
      owner_id?: string;
      vehicle_id?: string | null;
      period?: string;
      payout_type?: string;
      amount?: number;
      account_id?: string;
      paid_at?: string;
      remarks?: string | null;
    }>();

    const ownerId = body.owner_id?.trim();
    if (!ownerId) {
      return c.json({ success: false, message: '请选择车主' }, 400);
    }
    const owner = await queryOne<OwnerRow>(db, 'SELECT * FROM owners WHERE id = ?', [ownerId]);
    if (!owner) {
      return c.json({ success: false, message: '车主不存在' }, 404);
    }

    const period = periodOf(body.period) || periodOf(today());
    if (!isPeriod(period)) {
      return c.json({ success: false, message: '结算期格式应为 YYYY-MM' }, 400);
    }
    if (body.payout_type !== undefined && !oneOf(body.payout_type, PAYOUT_TYPES)) {
      return c.json({ success: false, message: '付款类型不合法' }, 400);
    }
    const amount = roundMoney(toAmount(body.amount));
    if (amount <= 0) {
      return c.json({ success: false, message: '金额必须大于 0' }, 400);
    }
    const paidAt = body.paid_at?.trim() || today();
    if (!isDate(paidAt)) {
      return c.json({ success: false, message: '付款日期格式应为 YYYY-MM-DD' }, 400);
    }

    const account = await queryOne<{ id: string; name: string }>(
      db,
      'SELECT id, name FROM fund_accounts WHERE id = ? AND is_active = 1',
      [body.account_id?.trim() ?? '']
    );
    if (!account) {
      return c.json({ success: false, message: '请选择有效的付款账户' }, 400);
    }

    const locked = await findPeriodLock(db, paidAt);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法付款` }, 400);
    }

    const id = generateId();
    const vehicleId = body.vehicle_id?.trim() || null;
    const currentTime = now();
    const stmts: Stmt[] = [
      {
        sql: `INSERT INTO settlement_payouts (id, owner_id, vehicle_id, period, payout_type, amount, account_id, paid_at, remarks, operator_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id,
          ownerId,
          vehicleId,
          period,
          body.payout_type ?? 'settlement',
          amount,
          account.id,
          paidAt,
          body.remarks ?? null,
          getAuthUser(c)?.id ?? null,
          currentTime
        ]
      }
    ];
    pushFundTxn(
      stmts,
      {
        accountId: account.id,
        txnDate: paidAt,
        direction: 'out',
        amount,
        category: 'settlement',
        sourceType: 'settlement_payout',
        sourceId: id,
        sourceKind: 'settlement_out',
        counterparty: owner.name,
        summary: `车主结算付款：${owner.name}（${period}）`,
        remarks: body.remarks ?? null
      },
      { operatorId: getAuthUser(c)?.id ?? null, currentTime }
    );

    await batchExecute(db, stmts);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '结算付款',
      entityType: 'settlement_payout',
      entityId: id,
      details: `${owner.name} ${period} 付款 ${amount}（${account.name}）${body.remarks ? `，${body.remarks}` : ''}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { id }, message: '结算付款已记录' });
  } catch (error) {
    return handleError(c, '记录结算付款错误:', error);
  }
}

/**
 * 删除结算付款。付款记录本身就是现金事实的载体，
 * 删掉它同时要删掉镜像流水，否则余额会多出一笔不存在的支出。
 */
export async function deleteSettlementPayout(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';

    const payout = await queryOne<SettlementPayoutRow>(db, 'SELECT * FROM settlement_payouts WHERE id = ?', [id]);
    if (!payout) {
      return c.json({ success: false, message: '付款记录不存在' }, 404);
    }

    const locked = await findPeriodLock(db, payout.paid_at);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法删除付款记录` }, 400);
    }

    await batchExecute(db, [
      {
        sql: "DELETE FROM fund_transactions WHERE source_type = 'settlement_payout' AND source_id = ? AND status = 'posted' AND reverses_id IS NULL",
        params: [id]
      },
      { sql: 'DELETE FROM settlement_payouts WHERE id = ?', params: [id] }
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除结算付款',
      entityType: 'settlement_payout',
      entityId: id,
      details: `删除结算付款 ${payout.period} ${payout.paid_at} 金额 ${payout.amount}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '付款记录已删除' });
  } catch (error) {
    return handleError(c, '删除结算付款错误:', error);
  }
}
