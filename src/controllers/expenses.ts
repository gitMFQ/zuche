/**
 * 费用台账：车辆费用 + 运营开支。
 *
 * 对应台账 file-4 的两本账：
 *   * 车辆费用台账（日期|车牌|费用类型|收入|支出|有无发票|备注）
 *   * 运营开支台账（日期|项目|金额|支付方式|备注）
 *
 * 三个关键约定：
 *
 * 1. **车辆费用是收支双列**。台账 2026.4.13 有一行「宁AF63561 | 违章 | 收入300 | 支出300」，
 *    也有纯收入行「宁A7919K | 维修 | 收入2500 | 支出/ | 王宗强」（车损赔偿）。
 *    所以用 income_amount / expense_amount 两列，不用单金额 + 正负号。
 *
 * 2. **权责发生 vs 现金收付分开**。只有「已付款」的行才写资金流水。
 *    没付款的只进费用台账（应付），否则账户余额会虚高。
 *
 * 3. **已付款的行不能改金额**，必须先「撤销付款」。
 *    这不是权限洁癖：镜像流水是按金额生成的，允许改金额就得同步修改已经发生的现金记录，
 *    与其做一套「改金额时重建流水」的对账逻辑（还要处理流水已被冲销的边界），
 *    不如直接拦住 —— 与合伙人往来的处理方式一致，用户也容易理解。
 */

import { type Bind, batchExecute, execute, query, queryOne, queryWithPagination } from '../db/helpers';
import type {
  ExpenseCategoryRow,
  OperatingExpenseRow,
  OwnerRow,
  VehicleExpenseRow,
  VehicleExpenseTypeRow,
  VehicleRow
} from '../db/rows';
import { INVOICE_STATUS_TEXT } from '../lib/constants';
import { handleError } from '../lib/errors';
import { listAccountOptions } from '../lib/fundAccount';
import { mirrorFlowStmts } from '../lib/expenseMirror';
import { INVOICE_STATUSES, findPeriodLock, isDate, oneOf, pushFundTxn } from '../lib/ledger';
import { generateId } from '../lib/ids';
import { logAction } from '../lib/log';
import { roundMoney, sumBy, toAmount } from '../lib/money';
import { getAuthUser, getClientIp } from '../lib/request';
import { monthRangeOf, now, periodOf, today } from '../lib/time';
import type { AppContext } from '../types';
import type { Stmt } from '../db/helpers';

interface VehicleExpenseBody {
  vehicle_id?: string;
  expense_date?: string;
  expense_type?: string;
  income_amount?: number;
  expense_amount?: number;
  invoice_status?: string;
  invoice_no?: string | null;
  is_paid?: boolean | number;
  paid_at?: string | null;
  account_id?: string | null;
  amortize_months?: number;
  remarks?: string | null;
  images?: string[];
}

interface OperatingExpenseBody {
  expense_date?: string;
  category?: string;
  amount?: number;
  is_paid?: boolean | number;
  paid_at?: string | null;
  account_id?: string | null;
  invoice_status?: string;
  invoice_no?: string | null;
  payee?: string | null;
  remarks?: string | null;
}

/** 车辆费用类型 id → 中文名（字典表是唯一来源，这里只做查表） */
async function expenseTypeName(db: D1Database, id: string): Promise<string | null> {
  const row = await queryOne<{ name: string }>(db, 'SELECT name FROM vehicle_expense_types WHERE id = ?', [id]);
  return row?.name ?? null;
}

async function categoryName(db: D1Database, id: string): Promise<string | null> {
  const row = await queryOne<{ name: string }>(db, 'SELECT name FROM expense_categories WHERE id = ?', [id]);
  return row?.name ?? null;
}

/** 账户校验（已付款时才需要） */
async function resolvePaidAccount(
  db: D1Database,
  accountId: string | null | undefined
): Promise<{ id: string; name: string } | null> {
  const id = (accountId ?? '').trim();
  if (!id) return null;
  return queryOne<{ id: string; name: string }>(db, 'SELECT id, name FROM fund_accounts WHERE id = ? AND is_active = 1', [
    id
  ]);
}

/** 运营开支镜像出的资金流水（只有支出侧） */
function operatingExpenseTxnStmts(
  row: { id: string; category_name: string; payee: string | null; remarks: string | null },
  accountId: string,
  paidAt: string,
  amount: number,
  operatorId: string | null,
  currentTime: string
): Stmt[] {
  const stmts: Stmt[] = [];
  pushFundTxn(
    stmts,
    {
      accountId,
      txnDate: paidAt,
      direction: 'out',
      amount,
      category: 'operating',
      sourceType: 'operating_expense',
      sourceId: row.id,
      sourceKind: 'main_out',
      counterparty: row.payee,
      summary: `运营开支：${row.category_name}`,
      remarks: row.remarks
    },
    { operatorId, currentTime }
  );
  return stmts;
}

/** 删除镜像流水。镜像流水是派生数据（源单据是唯一真相），所以可以物理删 */
function deleteMirrorTxnStmt(sourceType: string, sourceId: string): Stmt {
  return {
    // 只删 posted 的：如果它被单独冲销过，红字行必须留着，否则账凭空多出一笔
    sql: "DELETE FROM fund_transactions WHERE source_type = ? AND source_id = ? AND status = 'posted' AND reverses_id IS NULL",
    params: [sourceType, sourceId]
  };
}

async function findLockedPeriod(db: D1Database, dates: Array<string | null | undefined>): Promise<string | null> {
  for (const date of [...new Set(dates.filter((value): value is string => Boolean(value)))]) {
    const locked = await findPeriodLock(db, date);
    if (locked) return locked;
  }
  return null;
}

interface PaymentBody {
  account_id?: string;
  paid_at?: string;
}

async function validatePayment(
  db: D1Database,
  body: PaymentBody
): Promise<{ account: { id: string; name: string } | null; paidAt: string; error?: string }> {
  const paidAt = body.paid_at?.trim() || today();
  if (!isDate(paidAt)) return { account: null, paidAt, error: '付款日期格式应为 YYYY-MM-DD' };
  const account = await resolvePaidAccount(db, body.account_id);
  if (!account) return { account: null, paidAt, error: '请选择有效的付款账户' };
  const locked = await findLockedPeriod(db, [paidAt]);
  if (locked) return { account: null, paidAt, error: `账期 ${locked} 已锁定，无法记账` };
  return { account, paidAt };
}

function paymentUpdateStmt(sql: string, id: string, accountId: string, paidAt: string, currentTime: string): Stmt {
  return { sql, params: [paidAt, accountId, currentTime, id] };
}

function unpayUpdateStmt(sql: string, id: string, currentTime: string): Stmt {
  return { sql, params: [currentTime, id] };
}

// ==================== 车辆费用台账 ====================

export async function getVehicleExpenses(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page, pageSize, vehicle_id, expense_type, invoice_status, is_paid, start_date, end_date, keyword } =
      c.req.query();

    const where: string[] = [];
    const params: Bind[] = [];

    if (vehicle_id) {
      where.push('e.vehicle_id = ?');
      params.push(vehicle_id);
    }
    if (expense_type) {
      where.push('e.expense_type = ?');
      params.push(expense_type);
    }
    if (oneOf(invoice_status, INVOICE_STATUSES)) {
      where.push('e.invoice_status = ?');
      params.push(invoice_status);
    }
    if (is_paid === '0' || is_paid === '1') {
      where.push('e.is_paid = ?');
      params.push(Number(is_paid));
    }
    if (start_date) {
      where.push('e.expense_date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      where.push('e.expense_date <= ?');
      params.push(end_date);
    }
    if (keyword) {
      where.push('(e.plate_number LIKE ? OR e.remarks LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    // 合计与列表共用同一份筛选条件，用同一组 SQL 片段拼，避免两处条件漂移
    const filter = where.length ? ` AND ${where.join(' AND ')}` : '';
    // 未付款的收支必须分列：台账里有「只有收入没有支出」的行（车损赔偿），
    // 合成一个净额会得到负数，前端只能标成「应付 -2500」这种看不懂的东西。
    const totals = await queryOne<{
      income_total: number;
      expense_total: number;
      unpaid_income: number;
      unpaid_expense: number;
      count: number;
    }>(
      db,
      `SELECT
         ROUND(COALESCE(SUM(e.income_amount), 0), 6) AS income_total,
         ROUND(COALESCE(SUM(e.expense_amount), 0), 6) AS expense_total,
         ROUND(COALESCE(SUM(CASE WHEN e.is_paid = 0 THEN e.income_amount ELSE 0 END), 0), 6) AS unpaid_income,
         ROUND(COALESCE(SUM(CASE WHEN e.is_paid = 0 THEN e.expense_amount ELSE 0 END), 0), 6) AS unpaid_expense,
         COUNT(*) AS count
       FROM vehicle_expenses e WHERE 1 = 1${filter}`,
      params
    );

    const sql = `SELECT e.* FROM vehicle_expenses e WHERE 1 = 1${filter} ORDER BY e.expense_date DESC, e.created_at DESC`;

    const pageNum = Number(page);
    const size = Number(pageSize);
    if (Number.isFinite(pageNum) && pageNum > 0 && Number.isFinite(size) && size > 0) {
      const result = await queryWithPagination<VehicleExpenseRow>(db, sql, params, pageNum, size);
      return c.json({ success: true, data: { ...result, totals } });
    }

    const rows = await query<VehicleExpenseRow>(db, sql, params);
    return c.json({ success: true, data: { data: rows, total: rows.length, totals } });
  } catch (error) {
    return handleError(c, '获取车辆费用列表错误:', error);
  }
}

/**
 * 车辆费用统计。
 * 每车汇总走一条 GROUP BY，**不要**按车循环查（InsuranceTab.vue 就是反面教材，
 * 它每辆车再发一次请求，14 台车就是 14 次往返）。
 */
export async function getVehicleExpenseStats(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const period = periodOf(c.req.query('period')) || periodOf(today());
    const { start, end } = monthRangeOf(period);

    const [byType, byVehicle, monthTotals, unpaid] = await Promise.all([
      query<{ expense_type: string; expense_type_name: string; income: number; expense: number; count: number }>(
        db,
        `SELECT expense_type, expense_type_name,
           ROUND(COALESCE(SUM(income_amount), 0), 6) AS income,
           ROUND(COALESCE(SUM(expense_amount), 0), 6) AS expense,
           COUNT(*) AS count
         FROM vehicle_expenses WHERE expense_date >= ? AND expense_date < ?
         GROUP BY expense_type, expense_type_name ORDER BY expense DESC`,
        [start.substring(0, 10), end.substring(0, 10)]
      ),
      query<{ vehicle_id: string; plate_number: string | null; income: number; expense: number; count: number }>(
        db,
        `SELECT vehicle_id, plate_number,
           ROUND(COALESCE(SUM(income_amount), 0), 6) AS income,
           ROUND(COALESCE(SUM(expense_amount), 0), 6) AS expense,
           COUNT(*) AS count
         FROM vehicle_expenses WHERE expense_date >= ? AND expense_date < ?
         GROUP BY vehicle_id, plate_number ORDER BY expense DESC`,
        [start.substring(0, 10), end.substring(0, 10)]
      ),
      queryOne<{ income: number; expense: number; count: number }>(
        db,
        `SELECT ROUND(COALESCE(SUM(income_amount), 0), 6) AS income,
                ROUND(COALESCE(SUM(expense_amount), 0), 6) AS expense, COUNT(*) AS count
         FROM vehicle_expenses WHERE expense_date >= ? AND expense_date < ?`,
        [start.substring(0, 10), end.substring(0, 10)]
      ),
      // 未付款：不限月份，全量提示，否则跨月漏付会看不见。
      // 收支分列，理由同列表 totals
      queryOne<{ income: number; expense: number; count: number }>(
        db,
        `SELECT
           ROUND(COALESCE(SUM(income_amount), 0), 6) AS income,
           ROUND(COALESCE(SUM(expense_amount), 0), 6) AS expense,
           COUNT(*) AS count
         FROM vehicle_expenses WHERE is_paid = 0`
      )
    ]);

    return c.json({
      success: true,
      data: {
        period,
        month: monthTotals ?? { income: 0, expense: 0, count: 0 },
        by_type: byType,
        by_vehicle: byVehicle,
        unpaid: unpaid ?? { income: 0, expense: 0, count: 0 }
      }
    });
  } catch (error) {
    return handleError(c, '获取车辆费用统计错误:', error);
  }
}

export async function createVehicleExpense(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<VehicleExpenseBody>();

    const vehicleId = body.vehicle_id?.trim();
    if (!vehicleId) {
      return c.json({ success: false, message: '请选择车辆' }, 400);
    }
    const expenseDate = body.expense_date?.trim() ?? '';
    if (!isDate(expenseDate)) {
      return c.json({ success: false, message: '日期格式应为 YYYY-MM-DD' }, 400);
    }
    const typeName = await expenseTypeName(db, body.expense_type ?? '');
    if (!typeName) {
      return c.json({ success: false, message: '费用类型不合法' }, 400);
    }
    if (body.invoice_status !== undefined && !oneOf(body.invoice_status, INVOICE_STATUSES)) {
      return c.json({ success: false, message: '发票状态不合法' }, 400);
    }

    const incomeAmount = roundMoney(toAmount(body.income_amount));
    const expenseAmount = roundMoney(toAmount(body.expense_amount));
    if (incomeAmount <= 0 && expenseAmount <= 0) {
      return c.json({ success: false, message: '收入与支出不能同时为 0' }, 400);
    }

    const vehicle = await queryOne<VehicleRow>(db, 'SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
    if (!vehicle) {
      return c.json({ success: false, message: '车辆不存在' }, 404);
    }

    const locked = await findPeriodLock(db, expenseDate);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法新增费用` }, 400);
    }

    const isPaid = body.is_paid ? 1 : 0;
    const paidAt = isPaid ? (body.paid_at?.trim() || expenseDate) : null;
    if (paidAt && !isDate(paidAt)) {
      return c.json({ success: false, message: '付款日期格式应为 YYYY-MM-DD' }, 400);
    }
    const account = isPaid ? await resolvePaidAccount(db, body.account_id) : null;
    if (isPaid && !account) {
      return c.json({ success: false, message: '标记已付款时必须选择有效的付款账户' }, 400);
    }
    if (paidAt) {
      const payLock = await findPeriodLock(db, paidAt);
      if (payLock) {
        return c.json({ success: false, message: `账期 ${payLock} 已锁定，无法记账` }, 400);
      }
    }

    const id = generateId();
    const currentTime = now();

    const stmts: Stmt[] = [
      {
        sql: `INSERT INTO vehicle_expenses (id, vehicle_id, plate_number, owner_id, expense_date, expense_type, expense_type_name,
           income_amount, expense_amount, invoice_status, invoice_no, is_paid, paid_at, account_id, amortize_months,
           amount_overridden, source_type, source_id, source_kind, remarks, images, operator_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'manual', NULL, 'main', ?, ?, ?, ?, ?)`,
        params: [
          id,
          vehicleId,
          vehicle.plate_number,
          vehicle.owner_id,
          expenseDate,
          body.expense_type,
          typeName,
          incomeAmount,
          expenseAmount,
          body.invoice_status ?? 'none',
          body.invoice_no ?? null,
          isPaid,
          paidAt,
          account?.id ?? null,
          Number.isFinite(body.amortize_months) && Number(body.amortize_months) >= 1 ? Number(body.amortize_months) : 1,
          body.remarks ?? null,
          body.images?.length ? JSON.stringify(body.images) : null,
          getAuthUser(c)?.id ?? null,
          currentTime,
          currentTime
        ]
      }
    ];

    if (isPaid && account && paidAt) {
      stmts.push(
        ...mirrorFlowStmts(
          {
            id,
            plateNumber: vehicle.plate_number,
            expenseTypeName: typeName,
            remarks: body.remarks ?? null
          },
          account.id,
          paidAt,
          incomeAmount,
          expenseAmount,
          { operatorId: getAuthUser(c)?.id ?? null, currentTime }
        )
      );
    }

    await batchExecute(db, stmts);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '新增车辆费用',
      entityType: 'vehicle_expense',
      entityId: id,
      details: `${expenseDate} ${vehicle.plate_number} ${typeName}：收入 ${incomeAmount} / 支出 ${expenseAmount}${
        isPaid ? `（已付款，账户 ${account?.name}）` : '（未付款）'
      }`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { id }, message: '车辆费用已保存' });
  } catch (error) {
    return handleError(c, '新增车辆费用错误:', error);
  }
}

export async function updateVehicleExpense(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const body = await c.req.json<VehicleExpenseBody>();

    const row = await queryOne<VehicleExpenseRow>(db, 'SELECT * FROM vehicle_expenses WHERE id = ?', [id]);
    if (!row) {
      return c.json({ success: false, message: '费用记录不存在' }, 404);
    }
    if (row.is_paid === 1) {
      return c.json({ success: false, message: '已付款的费用不能修改，请先撤销付款' }, 400);
    }
    // 保养/保险/违章镜像过来的行在费用台账里是**只读**的（与删除路径保持一致）：
    // 源单据是唯一真相，允许在这里改金额就会出现「保养单 240、费用台账 180」两套数，
    // 而且下一次改源单据时会被静默覆盖回去。
    // 之前这里守的是 amount_overridden，但那个标记**没有任何写入方**，
    // 所以守卫恒为假 —— 看起来在防，实际没防。
    if (row.source_type && row.source_type !== 'manual') {
      return c.json({ success: false, message: '该记录由业务单据自动生成（保养/保险/违章），请到源单据修改' }, 400);
    }

    const expenseDate = body.expense_date?.trim() ?? row.expense_date;
    if (!isDate(expenseDate)) {
      return c.json({ success: false, message: '日期格式应为 YYYY-MM-DD' }, 400);
    }
    if (body.invoice_status !== undefined && !oneOf(body.invoice_status, INVOICE_STATUSES)) {
      return c.json({ success: false, message: '发票状态不合法' }, 400);
    }

    let typeName = row.expense_type_name;
    if (body.expense_type !== undefined && body.expense_type !== row.expense_type) {
      const found = await expenseTypeName(db, body.expense_type);
      if (!found) {
        return c.json({ success: false, message: '费用类型不合法' }, 400);
      }
      typeName = found;
    }

    const incomeAmount = body.income_amount !== undefined ? roundMoney(toAmount(body.income_amount)) : row.income_amount;
    const expenseAmount =
      body.expense_amount !== undefined ? roundMoney(toAmount(body.expense_amount)) : row.expense_amount;
    if (incomeAmount <= 0 && expenseAmount <= 0) {
      return c.json({ success: false, message: '收入与支出不能同时为 0' }, 400);
    }

    let vehicleId = row.vehicle_id;
    let plateNumber = row.plate_number;
    let ownerId = row.owner_id;
    if (body.vehicle_id !== undefined && body.vehicle_id.trim() !== row.vehicle_id) {
      const vehicle = await queryOne<VehicleRow>(db, 'SELECT * FROM vehicles WHERE id = ?', [body.vehicle_id.trim()]);
      if (!vehicle) {
        return c.json({ success: false, message: '车辆不存在' }, 404);
      }
      vehicleId = vehicle.id;
      plateNumber = vehicle.plate_number;
      ownerId = vehicle.owner_id;
    }

    const locked = await findLockedPeriod(db, [row.expense_date, expenseDate]);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法修改` }, 400);
    }

    await execute(
      db,
      `UPDATE vehicle_expenses SET vehicle_id = ?, plate_number = ?, owner_id = ?, expense_date = ?, expense_type = ?, expense_type_name = ?,
       income_amount = ?, expense_amount = ?, invoice_status = ?, invoice_no = ?, amortize_months = ?, remarks = ?, images = ?, updated_at = ?
       WHERE id = ?`,
      [
        vehicleId,
        plateNumber,
        ownerId,
        expenseDate,
        body.expense_type ?? row.expense_type,
        typeName,
        incomeAmount,
        expenseAmount,
        body.invoice_status ?? row.invoice_status,
        body.invoice_no !== undefined ? body.invoice_no : row.invoice_no,
        Number.isFinite(body.amortize_months) && Number(body.amortize_months) >= 1
          ? Number(body.amortize_months)
          : row.amortize_months,
        body.remarks !== undefined ? body.remarks : row.remarks,
        body.images ? JSON.stringify(body.images) : row.images,
        now(),
        id
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '修改车辆费用',
      entityType: 'vehicle_expense',
      entityId: id,
      details: `修改车辆费用 ${row.expense_date} ${row.plate_number} ${row.expense_type_name}：支出 ${row.expense_amount} → ${expenseAmount}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '车辆费用已更新' });
  } catch (error) {
    return handleError(c, '修改车辆费用错误:', error);
  }
}

/** 标记已付款：置 is_paid=1 并在同批写资金流水 */
export async function payVehicleExpense(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const body = await c.req.json<PaymentBody>();

    const row = await queryOne<VehicleExpenseRow>(db, 'SELECT * FROM vehicle_expenses WHERE id = ?', [id]);
    if (!row) {
      return c.json({ success: false, message: '费用记录不存在' }, 404);
    }
    if (row.is_paid === 1) {
      return c.json({ success: false, message: '该记录已标记为已付款' }, 400);
    }

    const payment = await validatePayment(db, body);
    if (payment.error || !payment.account) {
      return c.json({ success: false, message: payment.error }, 400);
    }
    const { account, paidAt } = payment;

    const currentTime = now();
    await batchExecute(db, [
      paymentUpdateStmt(
        'UPDATE vehicle_expenses SET is_paid = 1, paid_at = ?, account_id = ?, updated_at = ? WHERE id = ?',
        id ?? '',
        account.id,
        paidAt,
        currentTime
      ),
      ...mirrorFlowStmts(
        {
          id: row.id,
          plateNumber: row.plate_number,
          expenseTypeName: row.expense_type_name,
          remarks: row.remarks
        },
        account.id,
        paidAt,
        row.income_amount,
        row.expense_amount,
        { operatorId: getAuthUser(c)?.id ?? null, currentTime }
      )
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '车辆费用付款',
      entityType: 'vehicle_expense',
      entityId: id,
      details: `${row.expense_date} ${row.plate_number} ${row.expense_type_name} 付款：支出 ${row.expense_amount} / 收入 ${row.income_amount}（${account.name}）`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '已标记付款' });
  } catch (error) {
    return handleError(c, '车辆费用付款错误:', error);
  }
}

/** 撤销付款：清掉镜像流水（派生数据），并把记录退回未付款状态 */
export async function unpayVehicleExpense(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';

    const row = await queryOne<VehicleExpenseRow>(db, 'SELECT * FROM vehicle_expenses WHERE id = ?', [id]);
    if (!row) {
      return c.json({ success: false, message: '费用记录不存在' }, 404);
    }
    if (row.is_paid !== 1) {
      return c.json({ success: false, message: '该记录未标记付款' }, 400);
    }

    const locked = await findLockedPeriod(db, [row.expense_date, row.paid_at ?? row.expense_date]);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法撤销付款` }, 400);
    }

    await batchExecute(db, [
      deleteMirrorTxnStmt('vehicle_expense', id),
      unpayUpdateStmt(
        'UPDATE vehicle_expenses SET is_paid = 0, paid_at = NULL, account_id = NULL, updated_at = ? WHERE id = ?',
        id,
        now()
      )
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '撤销车辆费用付款',
      entityType: 'vehicle_expense',
      entityId: id,
      details: `撤销付款：${row.expense_date} ${row.plate_number} ${row.expense_type_name} 支出 ${row.expense_amount}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '已撤销付款' });
  } catch (error) {
    return handleError(c, '撤销车辆费用付款错误:', error);
  }
}

export async function deleteVehicleExpense(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');

    const row = await queryOne<VehicleExpenseRow>(db, 'SELECT * FROM vehicle_expenses WHERE id = ?', [id]);
    if (!row) {
      return c.json({ success: false, message: '费用记录不存在' }, 404);
    }
    if (row.is_paid === 1) {
      return c.json({ success: false, message: '已付款的费用不能删除，请先撤销付款' }, 400);
    }
    if (row.source_type && row.source_type !== 'manual') {
      return c.json({ success: false, message: '该记录由业务单据自动生成（保养/保险/违章），请到源单据删除' }, 400);
    }

    const locked = await findPeriodLock(db, row.expense_date);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法删除` }, 400);
    }

    await execute(db, 'DELETE FROM vehicle_expenses WHERE id = ?', [id]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除车辆费用',
      entityType: 'vehicle_expense',
      entityId: id,
      details: `删除车辆费用：${row.expense_date} ${row.plate_number} ${row.expense_type_name} 支出 ${row.expense_amount}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '车辆费用已删除' });
  } catch (error) {
    return handleError(c, '删除车辆费用错误:', error);
  }
}

// ==================== 运营开支台账 ====================

export async function getOperatingExpenses(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page, pageSize, category, is_paid, invoice_status, start_date, end_date, keyword } = c.req.query();

    const where: string[] = [];
    const params: Bind[] = [];

    if (category) {
      where.push('o.category = ?');
      params.push(category);
    }
    if (is_paid === '0' || is_paid === '1') {
      where.push('o.is_paid = ?');
      params.push(Number(is_paid));
    }
    if (oneOf(invoice_status, INVOICE_STATUSES)) {
      where.push('o.invoice_status = ?');
      params.push(invoice_status);
    }
    if (start_date) {
      where.push('o.expense_date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      where.push('o.expense_date <= ?');
      params.push(end_date);
    }
    if (keyword) {
      where.push('(o.remarks LIKE ? OR o.payee LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const filter = where.length ? ` AND ${where.join(' AND ')}` : '';
    const totals = await queryOne<{ total: number; paid_total: number; unpaid_total: number; count: number }>(
      db,
      `SELECT
         ROUND(COALESCE(SUM(o.amount), 0), 6) AS total,
         ROUND(COALESCE(SUM(CASE WHEN o.is_paid = 1 THEN o.amount ELSE 0 END), 0), 6) AS paid_total,
         ROUND(COALESCE(SUM(CASE WHEN o.is_paid = 0 THEN o.amount ELSE 0 END), 0), 6) AS unpaid_total,
         COUNT(*) AS count
       FROM operating_expenses o WHERE 1 = 1${filter}`,
      params
    );

    const sql = `SELECT o.* FROM operating_expenses o WHERE 1 = 1${filter} ORDER BY o.expense_date DESC, o.created_at DESC`;

    const pageNum = Number(page);
    const size = Number(pageSize);
    if (Number.isFinite(pageNum) && pageNum > 0 && Number.isFinite(size) && size > 0) {
      const result = await queryWithPagination<OperatingExpenseRow>(db, sql, params, pageNum, size);
      return c.json({ success: true, data: { ...result, totals } });
    }

    const rows = await query<OperatingExpenseRow>(db, sql, params);
    return c.json({ success: true, data: { data: rows, total: rows.length, totals } });
  } catch (error) {
    return handleError(c, '获取运营开支列表错误:', error);
  }
}

/** 运营开支统计：按项目、按月份汇总 + 应付未付 */
export async function getOperatingExpenseStats(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const period = periodOf(c.req.query('period')) || periodOf(today());
    const { start, end } = monthRangeOf(period);

    const [byCategory, byMonth, unpaid] = await Promise.all([
      query<{ category: string; category_name: string; total: number; count: number }>(
        db,
        `SELECT category, category_name, ROUND(COALESCE(SUM(amount), 0), 6) AS total, COUNT(*) AS count
         FROM operating_expenses WHERE expense_date >= ? AND expense_date < ?
         GROUP BY category, category_name ORDER BY total DESC`,
        [start.substring(0, 10), end.substring(0, 10)]
      ),
      query<{ month: string; total: number; count: number }>(
        db,
        `SELECT substr(expense_date, 1, 7) AS month, ROUND(COALESCE(SUM(amount), 0), 6) AS total, COUNT(*) AS count
         FROM operating_expenses
         GROUP BY month ORDER BY month DESC LIMIT 12`
      ),
      queryOne<{ total: number; count: number }>(
        db,
        'SELECT ROUND(COALESCE(SUM(amount), 0), 6) AS total, COUNT(*) AS count FROM operating_expenses WHERE is_paid = 0'
      )
    ]);

    const monthTotal = sumBy(byCategory, (item) => item.total);

    return c.json({
      success: true,
      data: {
        period,
        month_total: monthTotal,
        by_category: byCategory,
        by_month: byMonth,
        unpaid: unpaid ?? { income: 0, expense: 0, count: 0 }
      }
    });
  } catch (error) {
    return handleError(c, '获取运营开支统计错误:', error);
  }
}

export async function createOperatingExpense(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<OperatingExpenseBody>();

    const expenseDate = body.expense_date?.trim() ?? '';
    if (!isDate(expenseDate)) {
      return c.json({ success: false, message: '日期格式应为 YYYY-MM-DD' }, 400);
    }
    const name = await categoryName(db, body.category ?? '');
    if (!name) {
      return c.json({ success: false, message: '开支项目不合法' }, 400);
    }
    const amount = roundMoney(toAmount(body.amount));
    if (amount <= 0) {
      return c.json({ success: false, message: '金额必须大于 0' }, 400);
    }
    if (body.invoice_status !== undefined && !oneOf(body.invoice_status, INVOICE_STATUSES)) {
      return c.json({ success: false, message: '发票状态不合法' }, 400);
    }

    const locked = await findPeriodLock(db, expenseDate);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法新增开支` }, 400);
    }

    const isPaid = body.is_paid ? 1 : 0;
    const paidAt = isPaid ? (body.paid_at?.trim() || expenseDate) : null;
    if (paidAt && !isDate(paidAt)) {
      return c.json({ success: false, message: '付款日期格式应为 YYYY-MM-DD' }, 400);
    }
    const account = isPaid ? await resolvePaidAccount(db, body.account_id) : null;
    if (isPaid && !account) {
      return c.json({ success: false, message: '标记已付款时必须选择有效的付款账户' }, 400);
    }
    if (paidAt) {
      const payLock = await findPeriodLock(db, paidAt);
      if (payLock) {
        return c.json({ success: false, message: `账期 ${payLock} 已锁定，无法记账` }, 400);
      }
    }

    const id = generateId();
    const currentTime = now();
    const stmts: Stmt[] = [
      {
        sql: `INSERT INTO operating_expenses (id, expense_date, category, category_name, amount, account_id, is_paid, paid_at,
           invoice_status, invoice_no, payee, remarks, operator_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id,
          expenseDate,
          body.category,
          name,
          amount,
          account?.id ?? null,
          isPaid,
          paidAt,
          body.invoice_status ?? 'none',
          body.invoice_no ?? null,
          body.payee ?? null,
          body.remarks ?? null,
          getAuthUser(c)?.id ?? null,
          currentTime,
          currentTime
        ]
      }
    ];

    if (isPaid && account && paidAt) {
      stmts.push(
        ...operatingExpenseTxnStmts(
          { id, category_name: name, payee: body.payee ?? null, remarks: body.remarks ?? null },
          account.id,
          paidAt,
          amount,
          getAuthUser(c)?.id ?? null,
          currentTime
        )
      );
    }

    await batchExecute(db, stmts);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '新增运营开支',
      entityType: 'operating_expense',
      entityId: id,
      details: `${expenseDate} ${name} ${amount}${isPaid ? `（已付款，账户 ${account?.name}）` : '（未付款）'}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { id }, message: '开支已保存' });
  } catch (error) {
    return handleError(c, '新增运营开支错误:', error);
  }
}

export async function updateOperatingExpense(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const body = await c.req.json<OperatingExpenseBody>();

    const row = await queryOne<{ id: string; expense_date: string; category: string; category_name: string; amount: number; is_paid: number; invoice_status: string; invoice_no: string | null; payee: string | null; remarks: string | null }>(
      db,
      'SELECT * FROM operating_expenses WHERE id = ?',
      [id]
    );
    if (!row) {
      return c.json({ success: false, message: '开支记录不存在' }, 404);
    }
    if (row.is_paid === 1) {
      return c.json({ success: false, message: '已付款的开支不能修改，请先撤销付款' }, 400);
    }

    const expenseDate = body.expense_date?.trim() ?? row.expense_date;
    if (!isDate(expenseDate)) {
      return c.json({ success: false, message: '日期格式应为 YYYY-MM-DD' }, 400);
    }
    if (body.invoice_status !== undefined && !oneOf(body.invoice_status, INVOICE_STATUSES)) {
      return c.json({ success: false, message: '发票状态不合法' }, 400);
    }
    const amount = body.amount !== undefined ? roundMoney(toAmount(body.amount)) : row.amount;
    if (amount <= 0) {
      return c.json({ success: false, message: '金额必须大于 0' }, 400);
    }

    let name = row.category_name;
    if (body.category !== undefined && body.category !== row.category) {
      const found = await categoryName(db, body.category);
      if (!found) {
        return c.json({ success: false, message: '开支项目不合法' }, 400);
      }
      name = found;
    }

    const locked = await findLockedPeriod(db, [row.expense_date, expenseDate]);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法修改` }, 400);
    }

    await execute(
      db,
      `UPDATE operating_expenses SET expense_date = ?, category = ?, category_name = ?, amount = ?,
       invoice_status = ?, invoice_no = ?, payee = ?, remarks = ?, updated_at = ? WHERE id = ?`,
      [
        expenseDate,
        body.category ?? row.category,
        name,
        amount,
        body.invoice_status ?? row.invoice_status,
        body.invoice_no !== undefined ? body.invoice_no : row.invoice_no,
        body.payee !== undefined ? body.payee : row.payee,
        body.remarks !== undefined ? body.remarks : row.remarks,
        now(),
        id
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '修改运营开支',
      entityType: 'operating_expense',
      entityId: id,
      details: `修改运营开支 ${row.expense_date} ${row.category_name}：金额 ${row.amount} → ${amount}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '开支已更新' });
  } catch (error) {
    return handleError(c, '修改运营开支错误:', error);
  }
}

export async function payOperatingExpense(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const body = await c.req.json<PaymentBody>();

    const row = await queryOne<{ id: string; expense_date: string; category_name: string; amount: number; is_paid: number; payee: string | null; remarks: string | null }>(
      db,
      'SELECT * FROM operating_expenses WHERE id = ?',
      [id]
    );
    if (!row) {
      return c.json({ success: false, message: '开支记录不存在' }, 404);
    }
    if (row.is_paid === 1) {
      return c.json({ success: false, message: '该开支已标记为已付款' }, 400);
    }

    const payment = await validatePayment(db, body);
    if (payment.error || !payment.account) {
      return c.json({ success: false, message: payment.error }, 400);
    }
    const { account, paidAt } = payment;

    const currentTime = now();
    await batchExecute(db, [
      paymentUpdateStmt(
        'UPDATE operating_expenses SET is_paid = 1, paid_at = ?, account_id = ?, updated_at = ? WHERE id = ?',
        id ?? '',
        account.id,
        paidAt,
        currentTime
      ),
      ...operatingExpenseTxnStmts(
        { id: row.id, category_name: row.category_name, payee: row.payee, remarks: row.remarks },
        account.id,
        paidAt,
        row.amount,
        getAuthUser(c)?.id ?? null,
        currentTime
      )
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '运营开支付款',
      entityType: 'operating_expense',
      entityId: id,
      details: `${row.expense_date} ${row.category_name} ${row.amount} 付款（${account.name}）`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '已标记付款' });
  } catch (error) {
    return handleError(c, '运营开支付款错误:', error);
  }
}

export async function unpayOperatingExpense(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';

    const row = await queryOne<{ id: string; expense_date: string; category_name: string; amount: number; is_paid: number; paid_at: string | null }>(
      db,
      'SELECT * FROM operating_expenses WHERE id = ?',
      [id]
    );
    if (!row) {
      return c.json({ success: false, message: '开支记录不存在' }, 404);
    }
    if (row.is_paid !== 1) {
      return c.json({ success: false, message: '该开支未标记付款' }, 400);
    }

    const locked = await findLockedPeriod(db, [row.expense_date, row.paid_at ?? row.expense_date]);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法撤销付款` }, 400);
    }

    await batchExecute(db, [
      deleteMirrorTxnStmt('operating_expense', id),
      unpayUpdateStmt(
        'UPDATE operating_expenses SET is_paid = 0, paid_at = NULL, account_id = NULL, updated_at = ? WHERE id = ?',
        id,
        now()
      )
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '撤销运营开支付款',
      entityType: 'operating_expense',
      entityId: id,
      details: `撤销付款：${row.expense_date} ${row.category_name} ${row.amount}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '已撤销付款' });
  } catch (error) {
    return handleError(c, '撤销运营开支付款错误:', error);
  }
}

export async function deleteOperatingExpense(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');

    const row = await queryOne<{ id: string; expense_date: string; category_name: string; amount: number; is_paid: number }>(
      db,
      'SELECT * FROM operating_expenses WHERE id = ?',
      [id]
    );
    if (!row) {
      return c.json({ success: false, message: '开支记录不存在' }, 404);
    }
    if (row.is_paid === 1) {
      return c.json({ success: false, message: '已付款的开支不能删除，请先撤销付款' }, 400);
    }

    const locked = await findPeriodLock(db, row.expense_date);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法删除` }, 400);
    }

    await execute(db, 'DELETE FROM operating_expenses WHERE id = ?', [id]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除运营开支',
      entityType: 'operating_expense',
      entityId: id,
      details: `删除运营开支：${row.expense_date} ${row.category_name} ${row.amount}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '开支已删除' });
  } catch (error) {
    return handleError(c, '删除运营开支错误:', error);
  }
}

// ==================== 字典 ====================

/**
 * 财务模块的全部基础数据，一次返回。
 * 前端首屏一次拉完，避免「账户下拉 / 项目下拉 / 车辆下拉」各发一个请求。
 */
export async function getFinanceDicts(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const [accounts, categories, vehicleTypes, owners] = await Promise.all([
      listAccountOptions(db),
      query<ExpenseCategoryRow>(
        db,
        'SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY sort_order, name'
      ),
      query<VehicleExpenseTypeRow>(
        db,
        'SELECT * FROM vehicle_expense_types WHERE is_active = 1 ORDER BY sort_order, name'
      ),
      query<Pick<OwnerRow, 'id' | 'name' | 'role' | 'company_fee_rate'>>(
        db,
        'SELECT id, name, role, company_fee_rate FROM owners WHERE status = 1 ORDER BY name'
      )
    ]);

    return c.json({
      success: true,
      data: {
        accounts,
        expense_categories: categories,
        vehicle_expense_types: vehicleTypes,
        owners,
        invoice_status_text: INVOICE_STATUS_TEXT
      }
    });
  } catch (error) {
    return handleError(c, '获取财务字典错误:', error);
  }
}
