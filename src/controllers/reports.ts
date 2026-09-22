/**
 * 财务报表。
 *
 * 口径说明（改动前务必读，三条口径**不能混着比较**）：
 *
 *   1. 经营收入 = 排除已取消订单的 payments（仪表盘 dashboard.ts 用的就是这个口径）
 *   2. 结算收入 = settlement_lines 的车主结算金额 / 公司管理费（两位精度见 lib/money.ts）
 *   3. 现金余额 = 账户期初 + fund_transactions 全部收支（现金收付制）
 *
 * 报表一律以 settlement_lines / fund_transactions / *_expenses 为准，不用 payments 反推。
 *
 * 保险年费按 vehicle_expenses.amortize_months 分摊到各月：SQL 里的判断是
 * 「费用月份的月初 <= 目标月份月初 <= 费用月份 + (N-1) 个月的月初」，
 * 单月分摊额 = (支出 − 收入) / N。不做分摊的话，续保那个月的结余会是一条巨大的负数。
 */

import { type Bind, query, queryOne } from '../db/helpers';
import { handleError } from '../lib/errors';
import { roundMoney, sumBy, toAmount } from '../lib/money';
import { calcVehicleMonthlyRow } from '../lib/settlement';
import { addMonths, isPeriod, monthRangeOf, periodOf, today } from '../lib/time';
import type { AppContext } from '../types';

/**
 * 分摊窗口条件：目标月份落在某条费用的分摊区间内。
 * 参数顺序：$monthStart（'YYYY-MM-01'）出现两次。
 */
const AMORTIZE_WINDOW = `date(e.expense_date, 'start of month') <= date(?)
  AND date(?) <= date(e.expense_date, '+' || (CASE WHEN e.amortize_months >= 1 THEN e.amortize_months - 1 ELSE 0 END) || ' months', 'start of month')`;

const AMORTIZED_AMOUNT = `ROUND((e.expense_amount - e.income_amount) / (CASE WHEN e.amortize_months >= 1 THEN e.amortize_months ELSE 1 END), 6)`;

/**
 * 「公司自营」受益人 id（migrations/0017 建的固定记录）。
 * 自营车的车主就是公司，所以它名下的结算金额是公司收入而不是应付给外部车主。
 */
const SELF_OWNER_ID = 'owner-self';

interface MonthlyRow {
  vehicle_id: string;
  plate_number: string;
  vehicle_no: string | null;
  owner_name: string | null;
  monthly_payment: number;
  owner_amount: number;
  settlement_amount: number;
  company_fee: number;
  days: number;
  line_count: number;
  maintenance: number;
  repair: number;
  other_expense: number;
}

/**
 * 单车月报：`月份 | 天数 | 总金额 | 月供 | 保养 | 维修 | 结余`。
 * 行 = 车辆（「全部车辆」而不是只有本月有单的车 —— 没出车的车也要能看到月供与结余为负）。
 */
export async function getVehicleMonthlyReport(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const period = periodOf(c.req.query('period')) || periodOf(today());
    if (!isPeriod(period)) {
      return c.json({ success: false, message: '账期格式应为 YYYY-MM' }, 400);
    }
    const vehicleId = c.req.query('vehicle_id');
    const monthStart = `${period}-01`;

    const params: Bind[] = [period, monthStart, monthStart];
    let vehicleFilter = '';
    if (vehicleId) {
      vehicleFilter = ' AND v.id = ?';
      params.push(vehicleId);
    }
    if (c.req.query('owner_id')) {
      vehicleFilter += ' AND v.owner_id = ?';
      params.push(c.req.query('owner_id'));
    }

    const sql = `SELECT
        v.id AS vehicle_id, v.plate_number, v.vehicle_no, v.monthly_payment,
        ow.name AS owner_name,
        COALESCE(l.owner_amount, 0) AS owner_amount,
        COALESCE(l.settlement_amount, 0) AS settlement_amount,
        COALESCE(l.company_fee, 0) AS company_fee,
        COALESCE(l.days, 0) AS days,
        COALESCE(l.line_count, 0) AS line_count,
        COALESCE(mt.maintenance, 0) AS maintenance,
        COALESCE(mt.repair, 0) AS repair,
        COALESCE(mt.other_expense, 0) AS other_expense
      FROM vehicles v
      LEFT JOIN owners ow ON ow.id = v.owner_id
      LEFT JOIN (
        SELECT vehicle_id,
          ROUND(SUM(owner_amount), 6) AS owner_amount,
          ROUND(SUM(settlement_amount), 6) AS settlement_amount,
          ROUND(SUM(company_fee), 6) AS company_fee,
          ROUND(SUM(days), 6) AS days,
          COUNT(*) AS line_count
        FROM settlement_lines
        WHERE status = 'posted' AND period = ? AND vehicle_id IS NOT NULL
        GROUP BY vehicle_id
      ) l ON l.vehicle_id = v.id
      LEFT JOIN (
        SELECT e.vehicle_id,
          ROUND(SUM(CASE WHEN e.expense_type = 'maintenance' THEN ${AMORTIZED_AMOUNT} ELSE 0 END), 6) AS maintenance,
          ROUND(SUM(CASE WHEN e.expense_type = 'repair' THEN ${AMORTIZED_AMOUNT} ELSE 0 END), 6) AS repair,
          ROUND(SUM(CASE WHEN e.expense_type NOT IN ('maintenance', 'repair') THEN ${AMORTIZED_AMOUNT} ELSE 0 END), 6) AS other_expense
        FROM vehicle_expenses e
        WHERE ${AMORTIZE_WINDOW}
        GROUP BY e.vehicle_id
      ) mt ON mt.vehicle_id = v.id
      WHERE 1 = 1${vehicleFilter}
      ORDER BY v.plate_number`;

    const rows = await query<MonthlyRow>(db, sql, params);

    const data = rows.map((row) => ({
      ...row,
      ...calcVehicleMonthlyRow({
        ownerAmount: row.owner_amount,
        loan: row.monthly_payment,
        maintenance: row.maintenance,
        repair: row.repair,
        otherExpense: row.other_expense
      })
    }));

    return c.json({
      success: true,
      data: {
        period,
        rows: data,
        totals: {
          owner_amount: sumBy(data, (row) => row.owner_amount),
          monthly_payment: sumBy(data, (row) => row.monthly_payment),
          maintenance: sumBy(data, (row) => row.maintenance),
          repair: sumBy(data, (row) => row.repair),
          other_expense: sumBy(data, (row) => row.other_expense),
          balance: sumBy(data, (row) => row.balance),
          days: sumBy(data, (row) => row.days)
        }
      }
    });
  } catch (error) {
    return handleError(c, '获取单车月报错误:', error);
  }
}

/** 车辆收益排行：按区间内车主结算金额（自营车即公司所得）排序 */
export async function getVehicleRanking(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const startDate = c.req.query('start_date') || `${periodOf(today())}-01`;
    const endDate = c.req.query('end_date') || today();

    const rows = await query<{
      vehicle_id: string;
      plate_number: string | null;
      vehicle_no: string | null;
      owner_name: string | null;
      owner_amount: number;
      settlement_amount: number;
      company_fee: number;
      days: number;
      line_count: number;
      expense: number;
      profit: number;
    }>(
      db,
      `SELECT
        v.id AS vehicle_id, v.plate_number, v.vehicle_no, ow.name AS owner_name,
        COALESCE(l.owner_amount, 0) AS owner_amount,
        COALESCE(l.settlement_amount, 0) AS settlement_amount,
        COALESCE(l.company_fee, 0) AS company_fee,
        COALESCE(l.days, 0) AS days,
        COALESCE(l.line_count, 0) AS line_count,
        COALESCE(e.expense, 0) AS expense,
        ROUND(COALESCE(l.owner_amount, 0) - COALESCE(e.expense, 0) - v.monthly_payment, 6) AS profit
      FROM vehicles v
      LEFT JOIN owners ow ON ow.id = v.owner_id
      LEFT JOIN (
        SELECT vehicle_id,
          ROUND(SUM(owner_amount), 6) AS owner_amount,
          ROUND(SUM(settlement_amount), 6) AS settlement_amount,
          ROUND(SUM(company_fee), 6) AS company_fee,
          ROUND(SUM(days), 6) AS days,
          COUNT(*) AS line_count
        FROM settlement_lines
        WHERE status = 'posted' AND line_date >= ? AND line_date < date(?, '+1 day')
        GROUP BY vehicle_id
      ) l ON l.vehicle_id = v.id
      LEFT JOIN (
        SELECT vehicle_id, ROUND(SUM(expense_amount - income_amount), 6) AS expense
        FROM vehicle_expenses WHERE expense_date >= ? AND expense_date < date(?, '+1 day')
        GROUP BY vehicle_id
      ) e ON e.vehicle_id = v.id
      ORDER BY profit DESC, l.owner_amount DESC`,
      [startDate, endDate, startDate, endDate]
    );

    return c.json({ success: true, data: { start_date: startDate, end_date: endDate, rows } });
  } catch (error) {
    return handleError(c, '获取车辆收益排行错误:', error);
  }
}

/**
 * 公司月度经营报表。
 *
 * 「公司收入」= 结算金额里公司真正留下的部分：
 *   * 挂靠车：只有公司管理费（+ 其他费用）—— 车主结算金额要付给车主
 *   * 自营车：**全额结算金额** —— 「公司自营」这个受益人就是公司自己
 *
 * 所以不能用 `结算金额 − 车主结算金额`：自营车那部分相减会变成 0，
 * 把公司唯一的收入来源算没了。正确的写法是
 *   Σ结算金额 − Σ(挂靠车的车主结算金额)
 * 也就是下面的 `SUM(settlement_amount) - SUM(CASE WHEN owner_id != 'owner-self' THEN owner_amount ELSE 0 END)`。
 *
 * 「公司成本」= 自营车的车辆费用 + 运营开支 + 自营车的月供。
 * 挂靠车的费用与月供由车主承担（在对账单里扣回），进这里会重复算。
 * 挂靠车的月供单独放在 `monthly_loan_attached` 里做提示，不进成本。
 */
export async function getCompanyMonthlyReport(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const period = periodOf(c.req.query('period')) || periodOf(today());
    if (!isPeriod(period)) {
      return c.json({ success: false, message: '账期格式应为 YYYY-MM' }, 400);
    }
    const { start, end } = monthRangeOf(period);
    const monthStart = `${period}-01`;
    const lastMonth = addMonths(period, -11);

    const [settlement, vehicleExpense, operatingExpense, settlementPayout, loan, fundFlow] = await Promise.all([
      queryOne<{
        total_amount: number;
        platform_fee: number;
        settlement_amount: number;
        company_fee: number;
        other_fee: number;
        owner_amount: number;
        company_income: number;
        days: number;
        line_count: number;
      }>(
        db,
        `SELECT
           ROUND(COALESCE(SUM(total_amount), 0), 6) AS total_amount,
           ROUND(COALESCE(SUM(platform_fee), 0), 6) AS platform_fee,
           ROUND(COALESCE(SUM(settlement_amount), 0), 6) AS settlement_amount,
           ROUND(COALESCE(SUM(company_fee), 0), 6) AS company_fee,
           ROUND(COALESCE(SUM(other_fee), 0), 6) AS other_fee,
           ROUND(COALESCE(SUM(owner_amount), 0), 6) AS owner_amount,
           ROUND(COALESCE(SUM(settlement_amount)
             - SUM(CASE WHEN owner_id != '${SELF_OWNER_ID}' THEN owner_amount ELSE 0 END), 0), 6) AS company_income,
           ROUND(COALESCE(SUM(days), 0), 6) AS days,
           COUNT(*) AS line_count
         FROM settlement_lines WHERE status = 'posted' AND period = ?`,
        [period]
      ),
      // 车辆费用：只算自营车的（挂靠车的费用由车主承担，公司只是代垫，在对账单里扣回）
      queryOne<{ maintenance: number; repair: number; other: number; income: number }>(
        db,
        `SELECT
           ROUND(COALESCE(SUM(CASE WHEN e.expense_type = 'maintenance' THEN ${AMORTIZED_AMOUNT} ELSE 0 END), 0), 6) AS maintenance,
           ROUND(COALESCE(SUM(CASE WHEN e.expense_type = 'repair' THEN ${AMORTIZED_AMOUNT} ELSE 0 END), 0), 6) AS repair,
           ROUND(COALESCE(SUM(CASE WHEN e.expense_type NOT IN ('maintenance','repair') THEN ${AMORTIZED_AMOUNT} ELSE 0 END), 0), 6) AS other,
           ROUND(COALESCE(SUM(CASE WHEN e.amortize_months > 1 THEN e.income_amount / e.amortize_months ELSE e.income_amount END), 0), 6) AS income
         FROM vehicle_expenses e
         JOIN vehicles v ON v.id = e.vehicle_id
         JOIN owners ow ON ow.id = v.owner_id
         WHERE ow.id = '${SELF_OWNER_ID}' AND ${AMORTIZE_WINDOW}`,
        [monthStart, monthStart]
      ),
      queryOne<{ total: number; unpaid: number }>(
        db,
        `SELECT
           ROUND(COALESCE(SUM(amount), 0), 6) AS total,
           ROUND(COALESCE(SUM(CASE WHEN is_paid = 0 THEN amount ELSE 0 END), 0), 6) AS unpaid
         FROM operating_expenses WHERE expense_date >= ? AND expense_date < ?`,
        [start.substring(0, 10), end.substring(0, 10)]
      ),
      queryOne<{ total: number }>(
        db,
        'SELECT ROUND(COALESCE(SUM(amount), 0), 6) AS total FROM settlement_payouts WHERE period = ?',
        [period]
      ),
      // 月供按归属拆开：自营车的月供是公司成本，挂靠车的是车主成本（只做提示）
      queryOne<{ self_loan: number; attached_loan: number }>(
        db,
        `SELECT
           ROUND(COALESCE(SUM(CASE WHEN owner_id = '${SELF_OWNER_ID}' THEN monthly_payment ELSE 0 END), 0), 6) AS self_loan,
           ROUND(COALESCE(SUM(CASE WHEN owner_id IS NOT NULL AND owner_id != '${SELF_OWNER_ID}' THEN monthly_payment ELSE 0 END), 0), 6) AS attached_loan
         FROM vehicles WHERE monthly_payment > 0`
      ),
      // 资金流水：近 12 个月的收支，给「现金流」区块用
      query<{ month: string; income: number; expense: number }>(
        db,
        `SELECT substr(txn_date, 1, 7) AS month,
           ROUND(COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0), 6) AS income,
           ROUND(COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0), 6) AS expense
         FROM fund_transactions WHERE substr(txn_date, 1, 7) >= ?
         GROUP BY month ORDER BY month`,
        [lastMonth]
      )
    ]);

    const companyIncome = toAmount(settlement?.company_income);
    const vehicleCost = roundMoney(
      toAmount(vehicleExpense?.maintenance) + toAmount(vehicleExpense?.repair) + toAmount(vehicleExpense?.other) - toAmount(vehicleExpense?.income)
    );
    const operatingCost = toAmount(operatingExpense?.total);
    const selfLoan = toAmount(loan?.self_loan);

    return c.json({
      success: true,
      data: {
        period,
        revenue: {
          total_amount: settlement?.total_amount ?? 0,
          platform_fee: settlement?.platform_fee ?? 0,
          settlement_amount: settlement?.settlement_amount ?? 0,
          company_income: companyIncome,
          company_fee: settlement?.company_fee ?? 0,
          other_fee: settlement?.other_fee ?? 0,
          owner_amount: settlement?.owner_amount ?? 0,
          days: settlement?.days ?? 0,
          line_count: settlement?.line_count ?? 0
        },
        cost: {
          vehicle_maintenance: vehicleExpense?.maintenance ?? 0,
          vehicle_repair: vehicleExpense?.repair ?? 0,
          vehicle_other: vehicleExpense?.other ?? 0,
          vehicle_income: vehicleExpense?.income ?? 0,
          vehicle_total: vehicleCost,
          operating: operatingCost,
          operating_unpaid: operatingExpense?.unpaid ?? 0,
          monthly_loan: selfLoan,
          monthly_loan_attached: loan?.attached_loan ?? 0,
          settlement_payout: settlementPayout?.total ?? 0,
          total: roundMoney(vehicleCost + operatingCost + selfLoan)
        },
        profit: roundMoney(companyIncome - vehicleCost - operatingCost - selfLoan),
        fund_flow: fundFlow
      }
    });
  } catch (error) {
    return handleError(c, '获取公司月报错误:', error);
  }
}

/** 资金流水报表：按月（或按日）汇总收支与期末余额 */
export async function getFundFlowReport(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const startDate = c.req.query('start_date') || `${addMonths(periodOf(today()), -11)}-01`;
    const endDate = c.req.query('end_date') || today();
    const byDay = c.req.query('by') === 'day';

    const bucket = byDay ? 'txn_date' : "substr(txn_date, 1, 7) || '-01'";

    // 期末余额 = 账户期初合计 + 区间内之前的净额 + 区间内的净额（不按 opening_date 过滤，理由见 finance.ts）
    const [rows, opening, beforeNet] = await Promise.all([
      query<{ bucket: string; income: number; expense: number; count: number }>(
        db,
        `SELECT ${bucket} AS bucket,
           ROUND(COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0), 6) AS income,
           ROUND(COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0), 6) AS expense,
           COUNT(*) AS count
         FROM fund_transactions
         WHERE txn_date >= ? AND txn_date <= ?
         GROUP BY bucket ORDER BY bucket`,
        [startDate, endDate]
      ),
      queryOne<{ total: number }>(db, 'SELECT ROUND(COALESCE(SUM(opening_balance), 0), 6) AS total FROM fund_accounts WHERE is_active = 1'),
      queryOne<{ net: number }>(
        db,
        `SELECT ROUND(COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0), 6) AS net
         FROM fund_transactions WHERE txn_date < ?`,
        [startDate]
      )
    ]);

    let running = roundMoney(toAmount(opening?.total) + toAmount(beforeNet?.net));
    const data = rows.map((row) => {
      running = roundMoney(running + toAmount(row.income) - toAmount(row.expense));
      return { ...row, balance: running };
    });

    return c.json({
      success: true,
      data: {
        start_date: startDate,
        end_date: endDate,
        granularity: byDay ? 'day' : 'month',
        opening: roundMoney(toAmount(opening?.total) + toAmount(beforeNet?.net)),
        rows: data,
        summary: {
          income: sumBy(data, (row) => row.income),
          expense: sumBy(data, (row) => row.expense),
          closing: running
        }
      }
    });
  } catch (error) {
    return handleError(c, '获取资金流水报表错误:', error);
  }
}

/**
 * 车主对账单（跨月）：与 owners.ts 的单期对账单同口径，但按月列出明细。
 * 前端拿它直接组 Excel 导出。
 */
export async function getOwnerStatementReport(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const ownerId = c.req.query('owner_id');
    if (!ownerId) {
      return c.json({ success: false, message: '请指定车主' }, 400);
    }

    const startPeriod = periodOf(c.req.query('start_period')) || `${periodOf(today())}-01`.substring(0, 7);
    const endPeriod = periodOf(c.req.query('end_period')) || periodOf(today());
    if (!isPeriod(startPeriod) || !isPeriod(endPeriod)) {
      return c.json({ success: false, message: '账期格式应为 YYYY-MM' }, 400);
    }

    const owner = await queryOne<{ id: string; name: string; company_fee_rate: number }>(
      db,
      'SELECT id, name, company_fee_rate FROM owners WHERE id = ?',
      [ownerId]
    );
    if (!owner) {
      return c.json({ success: false, message: '车主不存在' }, 404);
    }

    const { start } = monthRangeOf(startPeriod);
    const { end } = monthRangeOf(endPeriod);
    const startDate = start.substring(0, 10);
    const endDate = end.substring(0, 10);

    const [openings, beforeLines, beforeExpenses, beforePayouts, lines, expenses, payouts] = await Promise.all([
      queryOne<{ total: number }>(
        db,
        'SELECT COALESCE(SUM(amount), 0) AS total FROM settlement_openings WHERE owner_id = ? AND fiscal_year <= ?',
        [ownerId, Number(startPeriod.substring(0, 4))]
      ),
      queryOne<{ total: number }>(
        db,
        "SELECT COALESCE(SUM(owner_amount), 0) AS total FROM settlement_lines WHERE owner_id = ? AND status = 'posted' AND period < ?",
        [ownerId, startPeriod]
      ),
      queryOne<{ total: number }>(
        db,
        'SELECT COALESCE(SUM(expense_amount - income_amount), 0) AS total FROM vehicle_expenses WHERE owner_id = ? AND expense_date < ?',
        [ownerId, startDate]
      ),
      queryOne<{ total: number }>(
        db,
        'SELECT COALESCE(SUM(amount), 0) AS total FROM settlement_payouts WHERE owner_id = ? AND period < ?',
        [ownerId, startPeriod]
      ),
      query<SettlementLineLite>(
        db,
        `SELECT * FROM settlement_lines
         WHERE owner_id = ? AND status = 'posted' AND period >= ? AND period <= ?
         ORDER BY period, line_date, created_at`,
        [ownerId, startPeriod, endPeriod]
      ),
      query<ExpenseLite>(
        db,
        `SELECT expense_date, plate_number, expense_type_name, income_amount, expense_amount, is_paid, remarks
         FROM vehicle_expenses WHERE owner_id = ? AND expense_date >= ? AND expense_date < ?
         ORDER BY expense_date`,
        [ownerId, startDate, endDate]
      ),
      query<PayoutLite>(
        db,
        `SELECT period, paid_at, payout_type, amount, remarks FROM settlement_payouts
         WHERE owner_id = ? AND period >= ? AND period <= ? ORDER BY paid_at`,
        [ownerId, startPeriod, endPeriod]
      )
    ]);

    const opening = roundMoney(
      toAmount(openings?.total) - toAmount(beforeLines?.total) - toAmount(beforeExpenses?.total) - toAmount(beforePayouts?.total)
    );
    const ownerAmountSum = sumBy(lines, (line) => line.owner_amount);
    const ownerExpenseSum = sumBy(expenses, (item) => toAmount(item.expense_amount) - toAmount(item.income_amount));
    const payoutSum = sumBy(payouts, (item) => item.amount);

    return c.json({
      success: true,
      data: {
        owner,
        start_period: startPeriod,
        end_period: endPeriod,
        opening,
        lines,
        expenses,
        payouts,
        summary: {
          opening,
          ownerAmountSum,
          ownerExpenseSum,
          payoutSum,
          closing: roundMoney(opening + ownerAmountSum - ownerExpenseSum - payoutSum)
        }
      }
    });
  } catch (error) {
    return handleError(c, '获取车主对账单报表错误:', error);
  }
}

interface SettlementLineLite {
  period: string;
  line_date: string;
  plate_number: string | null;
  source_name: string | null;
  customer_name: string | null;
  days: number;
  unit_price: number;
  total_amount: number;
  platform_fee: number;
  settlement_amount: number;
  company_fee: number;
  other_fee: number;
  owner_amount: number;
  amount_overridden: number;
  remarks: string | null;
}

interface ExpenseLite {
  expense_date: string;
  plate_number: string | null;
  expense_type_name: string;
  income_amount: number;
  expense_amount: number;
  is_paid: number;
  remarks: string | null;
}

interface PayoutLite {
  period: string;
  paid_at: string;
  payout_type: string;
  amount: number;
  remarks: string | null;
}
