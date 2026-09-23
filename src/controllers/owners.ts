/**
 * 车主档案与对账单。
 *
 * 一个实体两种角色（owners.role）：挂靠车的车主、以及在公司有往来垫付的合伙人。
 * 台账 file-5 里的牛昭平、马跃两种身份都有，所以合成一张表。
 *
 * 有两条互相独立的「应付」口径，**不要混在一起看**：
 *   * `balance`          车主结算应付 = 期初 + 结算行车主金额 − 代垫车辆费用 − 结算付款
 *                        （台账底部「结余」列就是它）
 *   * `advance_balance`  合伙人往来应付 = 期初 + 往来 in − 往来 out
 *                        （台账 file-5 的往来账）
 */

import { type Bind, type Stmt, batchExecute, execute, query, queryOne, queryWithPagination } from '../db/helpers';
import type { OwnerRow, PartnerAdvanceRow, SettlementLineRow, SettlementPayoutRow, VehicleExpenseRow } from '../db/rows';
import { handleError } from '../lib/errors';
import { ADVANCE_SUBJECTS, findPeriodLock, isDate, oneOf, OWNER_ROLES, pushFundTxn } from '../lib/ledger';
import { generateId } from '../lib/ids';
import { logAction } from '../lib/log';
import { roundMoney, toAmount } from '../lib/money';
import { getAuthUser, getClientIp } from '../lib/request';
import { calcStatementSummary } from '../lib/settlement';
import { fiscalYearOf, isPeriod, monthRangeOf, now, periodOf, today } from '../lib/time';
import { ADVANCE_SUBJECT_TEXT } from '../lib/constants';
import type { AppContext } from '../types';

interface OwnerBody {
  name?: string;
  phone?: string | null;
  id_card?: string | null;
  role?: string;
  company_fee_rate?: number;
  bank_name?: string | null;
  bank_account?: string | null;
  opening_balance?: number;
  opening_date?: string | null;
  remarks?: string | null;
}

interface AdvanceBody {
  advance_date?: string;
  subject?: string;
  amount?: number;
  direction?: string;
  remarks?: string | null;
}

/**
 * 车主结算应付余额（截至今天）。
 * 代垫车辆费用只算挂在车主名下的（自营车 owner_id 为空，不进任何人的对账单）。
 */
const OWNER_BALANCE_EXPR = `ROUND(
  o.opening_balance
  + COALESCE((SELECT SUM(l.owner_amount) FROM settlement_lines l WHERE l.owner_id = o.id AND l.status = 'posted'), 0)
  - COALESCE((SELECT SUM(e.expense_amount - e.income_amount) FROM vehicle_expenses e WHERE e.owner_id = o.id), 0)
  - COALESCE((SELECT SUM(p.amount) FROM settlement_payouts p WHERE p.owner_id = o.id), 0)
, 6)`;

/** 合伙人往来应付余额 = 期初 + 垫付等 in − 已付 out */
const ADVANCE_BALANCE_EXPR = `ROUND(
  o.opening_balance
  + COALESCE((SELECT SUM(CASE WHEN a.direction = 'in' THEN a.amount ELSE -a.amount END)
              FROM partner_advances a WHERE a.owner_id = o.id), 0)
, 6)`;

// ==================== 档案 ====================

/** 车主列表，带车辆数、结算应付、往来应付 */
export async function getOwners(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page, pageSize, keyword, role, status } = c.req.query();

    let sql = `SELECT o.*,
        (SELECT COUNT(*) FROM vehicles v WHERE v.owner_id = o.id) AS vehicle_count,
        ${OWNER_BALANCE_EXPR} AS balance,
        ${ADVANCE_BALANCE_EXPR} AS advance_balance
      FROM owners o WHERE 1 = 1`;
    const params: Bind[] = [];

    if (oneOf(role, OWNER_ROLES)) {
      sql += ' AND o.role = ?';
      params.push(role);
    }
    if (status === '0' || status === '1') {
      sql += ' AND o.status = ?';
      params.push(Number(status));
    } else {
      sql += ' AND o.status = 1';
    }
    if (keyword) {
      sql += ' AND (o.name LIKE ? OR o.phone LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    sql += ' ORDER BY o.created_at DESC';

    const pageNum = Number(page);
    const size = Number(pageSize);
    if (Number.isFinite(pageNum) && pageNum > 0 && Number.isFinite(size) && size > 0) {
      const result = await queryWithPagination<OwnerRow>(db, sql, params, pageNum, size);
      return c.json({ success: true, data: result });
    }

    const rows = await query<OwnerRow>(db, sql, params);
    return c.json({ success: true, data: { data: rows, total: rows.length } });
  } catch (error) {
    return handleError(c, '获取车主列表错误:', error);
  }
}

/** 下拉选项：只含 id / name / role / company_fee_rate，供车辆表单等选人场景 */
export async function getOwnerOptions(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const rows = await query<{ id: string; name: string; role: string; company_fee_rate: number }>(
      db,
      'SELECT id, name, role, company_fee_rate FROM owners WHERE status = 1 ORDER BY name'
    );
    return c.json({ success: true, data: rows });
  } catch (error) {
    return handleError(c, '获取车主选项错误:', error);
  }
}

export async function getOwner(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const owner = await queryOne<OwnerRow>(
      db,
      `SELECT o.*, ${OWNER_BALANCE_EXPR} AS balance, ${ADVANCE_BALANCE_EXPR} AS advance_balance FROM owners o WHERE o.id = ?`,
      [id]
    );
    if (!owner) {
      return c.json({ success: false, message: '车主不存在' }, 404);
    }
    return c.json({ success: true, data: owner });
  } catch (error) {
    return handleError(c, '获取车主错误:', error);
  }
}

export async function createOwner(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<OwnerBody>();

    if (!body.name?.trim()) {
      return c.json({ success: false, message: '车主姓名不能为空' }, 400);
    }
    if (body.role !== undefined && !oneOf(body.role, OWNER_ROLES)) {
      return c.json({ success: false, message: '身份不合法' }, 400);
    }
    if (body.opening_date && !isDate(body.opening_date)) {
      return c.json({ success: false, message: '期初日期格式应为 YYYY-MM-DD' }, 400);
    }

    const id = generateId();
    const currentTime = now();
    await execute(
      db,
      `INSERT INTO owners (id, name, phone, id_card, role, company_fee_rate, bank_name, bank_account,
         opening_balance, opening_date, status, remarks, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        id,
        body.name.trim(),
        body.phone ?? null,
        body.id_card ?? null,
        body.role ?? 'owner',
        Number.isFinite(body.company_fee_rate) ? Number(body.company_fee_rate) : 15,
        body.bank_name ?? null,
        body.bank_account ?? null,
        roundMoney(toAmount(body.opening_balance)),
        body.opening_date ?? null,
        body.remarks ?? null,
        currentTime,
        currentTime
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '创建车主',
      entityType: 'owner',
      entityId: id,
      details: `创建车主：${body.name.trim()}（费率 ${body.company_fee_rate ?? 15}%）`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { id }, message: '车主创建成功' });
  } catch (error) {
    return handleError(c, '创建车主错误:', error);
  }
}

export async function updateOwner(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const body = await c.req.json<OwnerBody>();

    const owner = await queryOne<OwnerRow>(db, 'SELECT * FROM owners WHERE id = ?', [id]);
    if (!owner) {
      return c.json({ success: false, message: '车主不存在' }, 404);
    }
    if (body.role !== undefined && !oneOf(body.role, OWNER_ROLES)) {
      return c.json({ success: false, message: '身份不合法' }, 400);
    }
    if (body.opening_date && !isDate(body.opening_date)) {
      return c.json({ success: false, message: '期初日期格式应为 YYYY-MM-DD' }, 400);
    }

    await execute(
      db,
      `UPDATE owners SET name = ?, phone = ?, id_card = ?, role = ?, company_fee_rate = ?,
       bank_name = ?, bank_account = ?, opening_balance = ?, opening_date = ?, status = ?, remarks = ?, updated_at = ?
       WHERE id = ?`,
      [
        body.name?.trim() || owner.name,
        body.phone !== undefined ? body.phone : owner.phone,
        body.id_card !== undefined ? body.id_card : owner.id_card,
        body.role ?? owner.role,
        Number.isFinite(body.company_fee_rate) ? Number(body.company_fee_rate) : owner.company_fee_rate,
        body.bank_name !== undefined ? body.bank_name : owner.bank_name,
        body.bank_account !== undefined ? body.bank_account : owner.bank_account,
        body.opening_balance !== undefined ? roundMoney(toAmount(body.opening_balance)) : owner.opening_balance,
        body.opening_date !== undefined ? body.opening_date : owner.opening_date,
        owner.status,
        body.remarks !== undefined ? body.remarks : owner.remarks,
        now(),
        id
      ]
    );

    // 费率改动只影响之后生成的结算行（生成时会快照进 calc_company_rate），
    // 历史行不动 —— 已出的对账单不能因为改配置而变化。这里在日志里留痕便于追溯。
    const rateChanged = Number.isFinite(body.company_fee_rate) && Number(body.company_fee_rate) !== owner.company_fee_rate;

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '更新车主',
      entityType: 'owner',
      entityId: id,
      details: `更新车主：${body.name?.trim() || owner.name}${
        rateChanged ? `，费率 ${owner.company_fee_rate}% → ${body.company_fee_rate}%（仅影响之后生成的结算行）` : ''
      }`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '车主更新成功' });
  } catch (error) {
    return handleError(c, '更新车主错误:', error);
  }
}

/**
 * 删除车主。有车辆挂靠或有结算/往来记录时拦下，引导停用。
 * 外键也是 RESTRICT，这里先查一次是为了给出能看懂的原因。
 */
export async function deleteOwner(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');

    const owner = await queryOne<OwnerRow>(db, 'SELECT * FROM owners WHERE id = ?', [id]);
    if (!owner) {
      return c.json({ success: false, message: '车主不存在' }, 404);
    }

    const refs = await queryOne<{ vehicles: number; lines: number; advances: number; payouts: number; openings: number }>(
      db,
      `SELECT
         (SELECT COUNT(*) FROM vehicles WHERE owner_id = ?) AS vehicles,
         (SELECT COUNT(*) FROM settlement_lines WHERE owner_id = ?) AS lines,
         (SELECT COUNT(*) FROM partner_advances WHERE owner_id = ?) AS advances,
         (SELECT COUNT(*) FROM settlement_payouts WHERE owner_id = ?) AS payouts,
         (SELECT COUNT(*) FROM settlement_openings WHERE owner_id = ?) AS openings`,
      [id, id, id, id, id]
    );

    const reasons: string[] = [];
    if ((refs?.vehicles ?? 0) > 0) reasons.push(`${refs?.vehicles} 台车挂靠`);
    if ((refs?.lines ?? 0) > 0) reasons.push(`${refs?.lines} 条结算记录`);
    if ((refs?.advances ?? 0) > 0) reasons.push(`${refs?.advances} 条往来记录`);
    if ((refs?.payouts ?? 0) > 0) reasons.push(`${refs?.payouts} 条付款记录`);
    if ((refs?.openings ?? 0) > 0) reasons.push(`${refs?.openings} 条期初结转`);

    if (reasons.length > 0) {
      return c.json({ success: false, message: `该车主已有${reasons.join('、')}，无法删除，请改为停用` }, 400);
    }

    await execute(db, 'DELETE FROM owners WHERE id = ?', [id]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除车主',
      entityType: 'owner',
      entityId: id,
      details: `删除车主：${owner.name}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '车主删除成功' });
  } catch (error) {
    return handleError(c, '删除车主错误:', error);
  }
}

// ==================== 对账单 ====================

/**
 * 车主对账单（某个结算期的详细账）。
 *
 * 期初 = 该期之前的所有往来净额（含年初结转），
 * 期末 = 期初 + 本期车主结算金额 − 本期代垫车辆费用 − 本期结算付款。
 * 与台账底部「结余」列一致（捷途 2026：15246 − 99.16 − 3000 = 12147）。
 */
export async function getOwnerStatement(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const period = periodOf(c.req.query('period')) || periodOf(today());

    if (!isPeriod(period)) {
      return c.json({ success: false, message: '账期格式应为 YYYY-MM' }, 400);
    }

    const owner = await queryOne<OwnerRow>(db, 'SELECT * FROM owners WHERE id = ?', [id]);
    if (!owner) {
      return c.json({ success: false, message: '车主不存在' }, 404);
    }

    const { start, end } = monthRangeOf(period);
    const periodStartDate = start.substring(0, 10);

    const [openings, beforeLines, beforeExpenses, beforePayouts, lines, expenses, payouts] = await Promise.all([
      // 年初结转：只算该年及以前的（fiscal_year <= 本期年份）
      queryOne<{ total: number }>(
        db,
        'SELECT COALESCE(SUM(amount), 0) AS total FROM settlement_openings WHERE owner_id = ? AND fiscal_year <= ?',
        [id, fiscalYearOf(period)]
      ),
      queryOne<{ total: number }>(
        db,
        "SELECT COALESCE(SUM(owner_amount), 0) AS total FROM settlement_lines WHERE owner_id = ? AND status = 'posted' AND period < ?",
        [id, period]
      ),
      queryOne<{ total: number }>(
        db,
        'SELECT COALESCE(SUM(expense_amount - income_amount), 0) AS total FROM vehicle_expenses WHERE owner_id = ? AND expense_date < ?',
        [id, periodStartDate]
      ),
      queryOne<{ total: number }>(
        db,
        'SELECT COALESCE(SUM(amount), 0) AS total FROM settlement_payouts WHERE owner_id = ? AND period < ?',
        [id, period]
      ),
      query<SettlementLineRow>(
        db,
        `SELECT * FROM settlement_lines WHERE owner_id = ? AND period = ? ORDER BY line_date, created_at`,
        [id, period]
      ),
      query<VehicleExpenseRow>(
        db,
        'SELECT * FROM vehicle_expenses WHERE owner_id = ? AND expense_date >= ? AND expense_date < ? ORDER BY expense_date',
        [id, periodStartDate, end.substring(0, 10)]
      ),
      query<SettlementPayoutRow>(
        db,
        'SELECT * FROM settlement_payouts WHERE owner_id = ? AND period = ? ORDER BY paid_at',
        [id, period]
      )
    ]);

    const opening = roundMoney(
      toAmount(openings?.total) - toAmount(beforeLines?.total) - toAmount(beforeExpenses?.total) - toAmount(beforePayouts?.total)
    );

    const postedLines = lines.filter((line) => line.status === 'posted');
    const ownerAmountSum = roundMoney(postedLines.reduce((sum, line) => sum + toAmount(line.owner_amount), 0));
    const ownerExpenseSum = roundMoney(
      expenses.reduce((sum, item) => sum + toAmount(item.expense_amount) - toAmount(item.income_amount), 0)
    );
    const payoutSum = roundMoney(payouts.reduce((sum, item) => sum + toAmount(item.amount), 0));

    const { closing } = calcStatementSummary({ opening, ownerAmountSum, ownerExpenseSum, payoutSum });

    // 按车辆分组的小计，方便按车对账
    const byVehicle = new Map<string, { vehicle_id: string | null; plate_number: string | null; amount: number; count: number }>();
    for (const line of postedLines) {
      const key = line.vehicle_id ?? '';
      const bucket = byVehicle.get(key) ?? {
        vehicle_id: line.vehicle_id,
        plate_number: line.plate_number,
        amount: 0,
        count: 0
      };
      bucket.amount = roundMoney(bucket.amount + toAmount(line.owner_amount));
      bucket.count += 1;
      byVehicle.set(key, bucket);
    }

    return c.json({
      success: true,
      data: {
        owner,
        period,
        opening,
        lines: postedLines,
        voided_lines: lines.filter((line) => line.status !== 'posted'),
        expenses,
        payouts,
        by_vehicle: [...byVehicle.values()],
        summary: { opening, ownerAmountSum, ownerExpenseSum, payoutSum, closing }
      }
    });
  } catch (error) {
    return handleError(c, '获取车主对账单错误:', error);
  }
}

// ==================== 合伙人往来账 ====================

export async function getOwnerAdvances(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const { page, pageSize, subject, direction } = c.req.query();

    let sql = 'SELECT * FROM partner_advances WHERE owner_id = ?';
    const params: Bind[] = [id];

    if (subject) {
      sql += ' AND subject = ?';
      params.push(subject);
    }
    if (oneOf(direction, ['in', 'out'] as const)) {
      sql += ' AND direction = ?';
      params.push(direction);
    }

    const totals = await queryOne<{ in_total: number; out_total: number; count: number }>(
      db,
      `SELECT
         ROUND(COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0), 6) AS in_total,
         ROUND(COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0), 6) AS out_total,
         COUNT(*) AS count
       FROM partner_advances WHERE owner_id = ?`,
      [id]
    );

    sql += ' ORDER BY advance_date DESC, created_at DESC';

    const pageNum = Number(page);
    const size = Number(pageSize);
    if (Number.isFinite(pageNum) && pageNum > 0 && Number.isFinite(size) && size > 0) {
      const result = await queryWithPagination<PartnerAdvanceRow>(db, sql, params, pageNum, size);
      return c.json({ success: true, data: { ...result, totals } });
    }

    const rows = await query<PartnerAdvanceRow>(db, sql, params);
    return c.json({ success: true, data: { data: rows, total: rows.length, totals } });
  } catch (error) {
    return handleError(c, '获取往来账错误:', error);
  }
}

export async function createAdvance(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const ownerId = c.req.param('id');
    const body = await c.req.json<AdvanceBody>();

    const owner = await queryOne<OwnerRow>(db, 'SELECT * FROM owners WHERE id = ?', [ownerId]);
    if (!owner) {
      return c.json({ success: false, message: '车主不存在' }, 404);
    }
    const advanceDate = body.advance_date?.trim() ?? '';
    if (!isDate(advanceDate)) {
      return c.json({ success: false, message: '日期格式应为 YYYY-MM-DD' }, 400);
    }
    if (!oneOf(body.subject, ADVANCE_SUBJECTS)) {
      return c.json({ success: false, message: '往来科目不合法' }, 400);
    }
    if (!oneOf(body.direction, ['in', 'out'] as const)) {
      return c.json({ success: false, message: '往来方向不合法' }, 400);
    }
    const amount = roundMoney(toAmount(body.amount));
    if (amount <= 0) {
      return c.json({ success: false, message: '金额必须大于 0' }, 400);
    }

    const locked = await findPeriodLock(db, advanceDate);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法新增往来记录` }, 400);
    }

    const id = generateId();
    const currentTime = now();
    await execute(
      db,
      `INSERT INTO partner_advances (id, owner_id, advance_date, subject, subject_name, amount, direction,
         is_paid, paid_at, account_id, remarks, operator_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, ?, ?)`,
      [
        id,
        ownerId,
        advanceDate,
        body.subject,
        ADVANCE_SUBJECT_TEXT[body.subject] ?? body.subject,
        amount,
        body.direction,
        body.remarks ?? null,
        getAuthUser(c)?.id ?? null,
        currentTime,
        currentTime
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '新增合伙人往来',
      entityType: 'partner_advance',
      entityId: id,
      details: `${owner.name} ${advanceDate} ${body.direction === 'in' ? '增加应付' : '已付'} ${amount}：${body.subject}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { id }, message: '往来记录已保存' });
  } catch (error) {
    return handleError(c, '新增往来记录错误:', error);
  }
}

export async function updateAdvance(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { id, advanceId } = c.req.param();
    const body = await c.req.json<AdvanceBody>();

    const advance = await queryOne<PartnerAdvanceRow>(db, 'SELECT * FROM partner_advances WHERE id = ? AND owner_id = ?', [
      advanceId,
      id
    ]);
    if (!advance) {
      return c.json({ success: false, message: '往来记录不存在' }, 404);
    }
    if (advance.is_paid === 1) {
      return c.json({ success: false, message: '已付款的往来记录不能修改，请先撤销付款' }, 400);
    }
    if (body.advance_date !== undefined && !isDate(body.advance_date)) {
      return c.json({ success: false, message: '日期格式应为 YYYY-MM-DD' }, 400);
    }
    if (body.subject !== undefined && !oneOf(body.subject, ADVANCE_SUBJECTS)) {
      return c.json({ success: false, message: '往来科目不合法' }, 400);
    }
    if (body.direction !== undefined && !oneOf(body.direction, ['in', 'out'] as const)) {
      return c.json({ success: false, message: '往来方向不合法' }, 400);
    }
    const amount = body.amount !== undefined ? roundMoney(toAmount(body.amount)) : advance.amount;
    if (amount <= 0) {
      return c.json({ success: false, message: '金额必须大于 0' }, 400);
    }

    const targetDate = body.advance_date?.trim() ?? advance.advance_date;
    const locked = await findPeriodLock(db, targetDate);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法修改` }, 400);
    }

    await execute(
      db,
      `UPDATE partner_advances SET advance_date = ?, subject = ?, subject_name = ?, amount = ?, direction = ?,
       remarks = ?, updated_at = ? WHERE id = ?`,
      [
        targetDate,
        body.subject ?? advance.subject,
        body.subject ? ADVANCE_SUBJECT_TEXT[body.subject] ?? body.subject : advance.subject_name,
        amount,
        body.direction ?? advance.direction,
        body.remarks !== undefined ? body.remarks : advance.remarks,
        now(),
        advanceId
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '修改合伙人往来',
      entityType: 'partner_advance',
      entityId: advanceId,
      details: `修改往来记录：${advance.amount} → ${amount}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '往来记录已更新' });
  } catch (error) {
    return handleError(c, '修改往来记录错误:', error);
  }
}

export async function deleteAdvance(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { id, advanceId } = c.req.param();

    const advance = await queryOne<PartnerAdvanceRow>(db, 'SELECT * FROM partner_advances WHERE id = ? AND owner_id = ?', [
      advanceId,
      id
    ]);
    if (!advance) {
      return c.json({ success: false, message: '往来记录不存在' }, 404);
    }
    if (advance.is_paid === 1) {
      return c.json({ success: false, message: '已付款的往来记录不能删除，请先撤销付款' }, 400);
    }

    const locked = await findPeriodLock(db, advance.advance_date);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法删除` }, 400);
    }

    await execute(db, 'DELETE FROM partner_advances WHERE id = ?', [advanceId]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除合伙人往来',
      entityType: 'partner_advance',
      entityId: advanceId,
      details: `删除往来记录：${advance.advance_date} ${advance.subject} ${advance.amount}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '往来记录已删除' });
  } catch (error) {
    return handleError(c, '删除往来记录错误:', error);
  }
}

/**
 * 标记往来记录为已付：置 is_paid=1 并在同一个 batch 里写一条 out 流水。
 * 与结算付款同理 —— 钱确实出去了，账户余额要跟着动。
 */
export async function payAdvance(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { id, advanceId } = c.req.param();
    const body = await c.req.json<{ account_id?: string; paid_at?: string }>();

    const advance = await queryOne<PartnerAdvanceRow>(db, 'SELECT * FROM partner_advances WHERE id = ? AND owner_id = ?', [
      advanceId,
      id
    ]);
    if (!advance) {
      return c.json({ success: false, message: '往来记录不存在' }, 404);
    }
    if (advance.is_paid === 1) {
      return c.json({ success: false, message: '该记录已标记为已付' }, 400);
    }
    if (advance.direction !== 'out') {
      return c.json({ success: false, message: '只有「已付合伙人」方向的记录才需要标记付款' }, 400);
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
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法标记付款` }, 400);
    }

    const currentTime = now();
    await batchExecute(db, [
      {
        sql: `UPDATE partner_advances SET is_paid = 1, paid_at = ?, account_id = ?, updated_at = ? WHERE id = ?`,
        params: [paidAt, account.id, currentTime, advanceId]
      },
      ...advanceTxnStmts(advance, account.id, paidAt, getAuthUser(c)?.id ?? null, currentTime)
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '合伙人往来付款',
      entityType: 'partner_advance',
      entityId: advanceId,
      details: `${advance.advance_date} ${advance.subject} ${advance.amount} 已付款（${account.name}）`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '已标记付款' });
  } catch (error) {
    return handleError(c, '标记合伙人往来付款错误:', error);
  }
}

/**
 * 标记「已付合伙人」时产生的资金流水语句。
 * direction 恒为 out（钱从公司账户出去），金额取记录本身的 amount。
 */
function advanceTxnStmts(
  advance: PartnerAdvanceRow,
  accountId: string,
  paidAt: string,
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
      amount: advance.amount,
      category: 'other',
      sourceType: 'partner_advance',
      sourceId: advance.id,
      sourceKind: 'advance_out',
      counterparty: null,
      summary: `合伙人往来付款：${advance.subject_name}`,
      remarks: advance.remarks
    },
    { operatorId, currentTime }
  );
  return stmts;
}
