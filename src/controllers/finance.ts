/**
 * 资金账户与流水总账。
 *
 * 对应台账 file-4 的「资金流水总账」sheet（日期|摘要|收入金额|支出金额|余额|备注）。
 *
 * 三个必须记住的约定（改动前先读 src/lib/ledger.ts 的文件头）：
 *
 * 1. **余额不落库**，一律 `opening_balance + SUM(全部流水)` 派生。不要改成写 balance_after。
 *
 * 2. **余额求和不能按 status 过滤**。冲销是「一条红字 + 把原行标成 reversed」两步：
 *      原行 in 100（status 变为 reversed）  →  红字 out 100（status = posted）
 *    只统计 posted 的话原行被排除、红字被计入，余额会变成 −100 而不是 0。
 *    红字本身就是那条补偿分录，所以必须把两行都算进去。
 *    status 只是给界面看的「本行已被冲销」标记，不是求和条件。
 *
 * 3. **流水不物理删除**。删除业务单据时由 buildReverseStmts 写红字，
 *    界面上的「冲销」也是同一个动作。
 */

import { type Bind, batchExecute, execute, query, queryOne, queryWithPagination } from '../db/helpers';
import type { FundAccountRow, FundTransactionRow, FundTransferRow, FinancePeriodLockRow } from '../db/rows';
import { handleError } from '../lib/errors';
import { fallbackAccountId } from '../lib/fundAccount';
import { ACCOUNT_TYPES, buildReverseStmts, buildTransferStmts, findPeriodLock, isDate, oneOf } from '../lib/ledger';
import { generateId } from '../lib/ids';
import { logAction } from '../lib/log';
import { roundMoney, toAmount } from '../lib/money';
import { getAuthUser, getClientIp } from '../lib/request';
import { isPeriod, now, periodOf, today } from '../lib/time';
import type { AppContext } from '../types';
import type { Stmt } from '../db/helpers';

interface AccountBody {
  name?: string;
  account_type?: string;
  method_key?: string | null;
  opening_balance?: number;
  opening_date?: string;
  sort_order?: number;
  remarks?: string;
}

interface TxnBody {
  account_id?: string;
  txn_date?: string;
  direction?: string;
  amount?: number;
  category?: string | null;
  counterparty?: string | null;
  summary?: string;
  remarks?: string | null;
}

/**
 * 余额表达式 = 期初余额 + 该账户全部流水的收支净额。
 *
 * **刻意不按 `opening_date` 过滤**。早先的写法是「只算 opening_date 及以后的流水」，
 * 语义上更严谨（期初余额就是截至那天的余额），但在真实使用里是个陷阱：
 * 种子账户的 opening_date 默认是迁移当天，于是补录一笔 3 天前的付款时，
 * 这笔钱会**静默消失** —— 明细里查不到、余额里也不算，而且没有任何提示。
 *
 * 现在的约定：opening_balance 是「系统里第一条流水之前」的余额，
 * 录入的所有流水都叠加在它之上。所以期初余额要填**开始用系统时**的真实余额，
 * 不要把已经在期初余额里体现过的流水再录一遍。opening_date 保留作说明用途。
 */
const BALANCE_EXPR = `ROUND(a.opening_balance + COALESCE((
  SELECT SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END)
  FROM fund_transactions t
  WHERE t.account_id = a.id
), 0), 6)`;

// ==================== 账户 ====================

/** 账户列表 + 余额。include_inactive=1 时带上已停用账户（历史查看用） */
export async function getFundAccounts(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const includeInactive = c.req.query('include_inactive') === '1';
    const accounts = await query<FundAccountRow & { balance: number }>(
      db,
      `SELECT a.*, ${BALANCE_EXPR} AS balance
       FROM fund_accounts a
       ${includeInactive ? '' : 'WHERE a.is_active = 1'}
       ORDER BY a.sort_order, a.name`
    );
    return c.json({ success: true, data: accounts });
  } catch (error) {
    return handleError(c, '获取资金账户列表错误:', error);
  }
}

/** 单个账户 + 余额（编辑回显用） */
export async function getFundAccount(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const account = await queryOne<FundAccountRow & { balance: number }>(
      db,
      `SELECT a.*, ${BALANCE_EXPR} AS balance FROM fund_accounts a WHERE a.id = ?`,
      [id]
    );
    if (!account) {
      return c.json({ success: false, message: '账户不存在' }, 404);
    }
    return c.json({ success: true, data: account });
  } catch (error) {
    return handleError(c, '获取资金账户错误:', error);
  }
}

export async function createFundAccount(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<AccountBody>();

    if (!body.name?.trim()) {
      return c.json({ success: false, message: '账户名称不能为空' }, 400);
    }
    if (!oneOf(body.account_type, ACCOUNT_TYPES)) {
      return c.json({ success: false, message: '账户类型不合法' }, 400);
    }
    // 期初日期必填：它是「期初余额对应哪一天」的分界，为空会让余额失去基准
    if (!isDate(body.opening_date)) {
      return c.json({ success: false, message: '期初日期格式应为 YYYY-MM-DD' }, 400);
    }

    const id = generateId();
    const currentTime = now();

    await execute(
      db,
      `INSERT INTO fund_accounts (id, name, account_type, method_key, opening_balance, opening_date, is_active, sort_order, remarks, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        id,
        body.name.trim(),
        body.account_type,
        body.method_key?.trim() || null,
        roundMoney(toAmount(body.opening_balance)),
        body.opening_date,
        Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0,
        body.remarks ?? null,
        currentTime,
        currentTime
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '创建资金账户',
      entityType: 'fund_account',
      entityId: id,
      details: `创建资金账户：${body.name.trim()}，期初 ${roundMoney(toAmount(body.opening_balance))}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { id }, message: '账户创建成功' });
  } catch (error) {
    return handleError(c, '创建资金账户错误:', error);
  }
}

export async function updateFundAccount(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const body = await c.req.json<AccountBody>();

    const account = await queryOne<FundAccountRow>(db, 'SELECT * FROM fund_accounts WHERE id = ?', [id]);
    if (!account) {
      return c.json({ success: false, message: '账户不存在' }, 404);
    }
    if (body.account_type !== undefined && !oneOf(body.account_type, ACCOUNT_TYPES)) {
      return c.json({ success: false, message: '账户类型不合法' }, 400);
    }
    if (body.opening_date !== undefined && !isDate(body.opening_date)) {
      return c.json({ success: false, message: '期初日期格式应为 YYYY-MM-DD' }, 400);
    }

    await execute(
      db,
      `UPDATE fund_accounts SET name = ?, account_type = ?, method_key = ?, opening_balance = ?, opening_date = ?,
       sort_order = ?, remarks = ?, updated_at = ? WHERE id = ?`,
      [
        body.name?.trim() || account.name,
        body.account_type ?? account.account_type,
        body.method_key !== undefined ? body.method_key?.trim() || null : account.method_key,
        body.opening_balance !== undefined ? roundMoney(toAmount(body.opening_balance)) : account.opening_balance,
        body.opening_date ?? account.opening_date,
        Number.isFinite(body.sort_order) ? Number(body.sort_order) : account.sort_order,
        body.remarks !== undefined ? body.remarks : account.remarks,
        now(),
        id
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '更新资金账户',
      entityType: 'fund_account',
      entityId: id,
      details: `更新资金账户：${body.name?.trim() || account.name}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '账户更新成功' });
  } catch (error) {
    return handleError(c, '更新资金账户错误:', error);
  }
}

/**
 * 删除账户。有流水的账户一律拦下（外键也是 RESTRICT，这里给出更清楚的提示），
 * 引导用户改成「停用」—— 停用后不再参与自动映射与新记账，历史余额仍可见。
 */
export async function deleteFundAccount(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');

    const account = await queryOne<FundAccountRow>(db, 'SELECT * FROM fund_accounts WHERE id = ?', [id]);
    if (!account) {
      return c.json({ success: false, message: '账户不存在' }, 404);
    }

    const used = await queryOne<{ count: number }>(
      db,
      `SELECT
         (SELECT COUNT(*) FROM fund_transactions WHERE account_id = ?) +
         (SELECT COUNT(*) FROM fund_transfers WHERE from_account_id = ? OR to_account_id = ?) +
         (SELECT COUNT(*) FROM settlement_payouts WHERE account_id = ?) +
         (SELECT COUNT(*) FROM operating_expenses WHERE account_id = ?) +
         (SELECT COUNT(*) FROM vehicle_expenses WHERE account_id = ?) AS count`,
      [id, id, id, id, id, id]
    );
    if ((used?.count ?? 0) > 0) {
      return c.json({ success: false, message: '该账户已有流水或费用记录，无法删除，请改为停用' }, 400);
    }

    await execute(db, 'DELETE FROM fund_accounts WHERE id = ?', [id]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除资金账户',
      entityType: 'fund_account',
      entityId: id,
      details: `删除资金账户：${account.name}（期初 ${account.opening_balance}）`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '账户删除成功' });
  } catch (error) {
    return handleError(c, '删除资金账户错误:', error);
  }
}

// ==================== 流水 ====================

interface TxnQuery {
  account_id?: string;
  start_date?: string;
  end_date?: string;
  direction?: string;
  category?: string;
  source_type?: string;
  keyword?: string;
  /** 1 = 只显示未冲销的原始流水，同时不返回余额列（见文件头第 2 条） */
  hide_reversed?: string;
  page?: string;
  pageSize?: string;
}

/**
 * 流水列表。
 *
 * 默认返回全部流水（含被冲销的原行与冲销红字），此时余额列一定正确。
 * hide_reversed=1 时只显示未被冲销的行 —— 这时**不再返回余额列**，
 * 因为把原行藏掉之后逐行余额必然算错（红字还在，被它抵消的原行不见了）。
 *
 * 逐行余额用窗口函数算，窗口内按 (txn_date, created_at, id) 升序累加，
 * 外层再按时间倒序输出。SQLite 会先把整个分区算完再套 LIMIT，
 * 所以翻页时每一页显示的仍然是绝对余额，不需要额外查锚点。
 *
 * ⚠️ 窗口必须算在「未筛选」的行集上，所以余额查询**强制多套一层子查询**：
 * 筛选条件写在**外层**（针对子查询的输出列），内层只做「限定账户」这一件事。
 * 直接把 WHERE 写进带窗口的那层会得到一个看似合理、实则错误的数字 ——
 * 窗口函数在 WHERE 之后的行集上计算，于是「余额」变成了「筛选区间内的累加和」：
 * 按 2 月起筛选时，1 月的收款不再参与累加，余额凭空少掉那一段时间。
 * 这种错最难发现，因为它依然是个格式正常的金额。
 */
export async function getFundTransactions(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const q = c.req.query() as TxnQuery;
    const hideReversed = q.hide_reversed === '1';
    // 只有一个账户时才谈得上「该行的账户余额是多少」
    const withBalance = Boolean(q.account_id) && !hideReversed;

    // 内层只限定账户（限定单一账户不改变该账户的逐行余额），其余筛选一律放外层
    const innerParams: Bind[] = [];
    const innerWhere: string[] = [];
    if (q.account_id) {
      innerWhere.push('t.account_id = ?');
      innerParams.push(q.account_id);
    }

    const params: Bind[] = [];
    // 外层的筛选针对子查询的输出列（列名都由内层显式投影，不存在歧义）。
    // 不按 opening_date 过滤，理由见 BALANCE_EXPR 的注释：
    // 过滤会让补录的历史流水静默消失，明细与余额同时看不见它。
    const where: string[] = ['1 = 1'];

    if (q.start_date) {
      where.push('txn_date >= ?');
      params.push(q.start_date);
    }
    if (q.end_date) {
      where.push('txn_date <= ?');
      params.push(q.end_date);
    }
    if (oneOf(q.direction, ['in', 'out'] as const)) {
      where.push('direction = ?');
      params.push(q.direction);
    }
    if (q.category) {
      where.push('category = ?');
      params.push(q.category);
    }
    if (q.source_type) {
      where.push('source_type = ?');
      params.push(q.source_type);
    }
    if (hideReversed) {
      where.push("status = 'posted' AND reverses_id IS NULL");
    }
    if (q.keyword) {
      where.push('(summary LIKE ? OR counterparty LIKE ? OR remarks LIKE ?)');
      const like = `%${q.keyword}%`;
      params.push(like, like, like);
    }
    // 内层参数在前、外层参数在后，顺序与 SQL 文本里的 ? 一致
    const allParams = [...innerParams, ...params];

    // 余额表达式必须把被冲销的原行也计入：红字是它的补偿分录。
    // 只算 posted 会让「原行 in 100 + 红字 out 100」变成 −100。
    const balanceColumn = withBalance
      ? `, ROUND(a.opening_balance + SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END)
           OVER (PARTITION BY t.account_id ORDER BY t.txn_date, t.created_at, t.id), 6) AS balance`
      : '';

    // 列名全部显式投影：外层筛选依靠这些输出列名，避免 JOIN 里 remarks/id 等同名列歧义
    const sql = `SELECT * FROM (
        SELECT t.id, t.account_id, t.txn_date, t.direction, t.amount, t.category,
          t.source_type, t.source_id, t.source_kind, t.counterparty, t.summary, t.status,
          t.reverses_id, t.reversed_by_id, t.operator_id, t.remarks, t.created_at, t.updated_at,
          a.name AS account_name, u.name AS operator_name${balanceColumn}
        FROM fund_transactions t
        JOIN fund_accounts a ON a.id = t.account_id
        LEFT JOIN users u ON u.id = t.operator_id${innerWhere.length ? ` WHERE ${innerWhere.join(' AND ')}` : ''}
      )
      WHERE ${where.join(' AND ')}
      ORDER BY txn_date DESC, created_at DESC, id DESC`;

    const page = Number(q.page);
    const pageSize = Number(q.pageSize);
    if (Number.isFinite(page) && page > 0 && Number.isFinite(pageSize) && pageSize > 0) {
      const result = await queryWithPagination<FundTransactionRow & { balance?: number; account_name: string }>(
        db,
        sql,
        allParams,
        page,
        pageSize
      );
      return c.json({ success: true, data: { ...result, with_balance: withBalance } });
    }

    const rows = await query<FundTransactionRow & { balance?: number; account_name: string }>(db, sql, allParams);
    return c.json({ success: true, data: { data: rows, total: rows.length, with_balance: withBalance } });
  } catch (error) {
    return handleError(c, '获取资金流水错误:', error);
  }
}

/** 手工记账。source_id 为空 → 不参与幂等约束，同一天可以记多笔同类费用 */
export async function createFundTransaction(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<TxnBody>();

    const accountId = body.account_id?.trim();
    if (!accountId) {
      return c.json({ success: false, message: '请选择账户' }, 400);
    }
    const txnDate = body.txn_date?.trim() ?? '';
    if (!isDate(txnDate)) {
      return c.json({ success: false, message: '日期格式应为 YYYY-MM-DD' }, 400);
    }
    if (!oneOf(body.direction, ['in', 'out'] as const)) {
      return c.json({ success: false, message: '收支方向不合法' }, 400);
    }
    const amount = roundMoney(toAmount(body.amount));
    if (amount <= 0) {
      return c.json({ success: false, message: '金额必须大于 0' }, 400);
    }
    if (!body.summary?.trim()) {
      return c.json({ success: false, message: '摘要不能为空' }, 400);
    }

    const account = await queryOne<FundAccountRow>(db, 'SELECT * FROM fund_accounts WHERE id = ? AND is_active = 1', [
      accountId
    ]);
    if (!account) {
      return c.json({ success: false, message: '账户不存在或已停用' }, 400);
    }

    const locked = await findPeriodLock(db, txnDate);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法记账` }, 400);
    }

    const id = generateId();
    const currentTime = now();
    await execute(
      db,
      `INSERT INTO fund_transactions (id, account_id, txn_date, direction, amount, category, source_type, source_id, source_kind,
         counterparty, summary, status, reverses_id, reversed_by_id, operator_id, remarks, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'manual', NULL, 'main', ?, ?, 'posted', NULL, NULL, ?, ?, ?, ?)`,
      [
        id,
        accountId,
        txnDate,
        body.direction,
        amount,
        body.category?.trim() || 'other',
        body.counterparty ?? null,
        body.summary.trim(),
        getAuthUser(c)?.id ?? null,
        body.remarks ?? null,
        currentTime,
        currentTime
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '手工记账',
      entityType: 'fund_transaction',
      entityId: id,
      details: `${txnDate} ${body.direction === 'in' ? '收入' : '支出'} ${amount}：${body.summary.trim()}（${account.name}）`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { id }, message: '记账成功' });
  } catch (error) {
    return handleError(c, '手工记账错误:', error);
  }
}

/** 修改手工流水。自动生成的流水只能改归属账户（见 reassignFundTransaction），不能改金额 */
export async function updateFundTransaction(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const body = await c.req.json<TxnBody>();

    const txn = await queryOne<FundTransactionRow>(db, 'SELECT * FROM fund_transactions WHERE id = ?', [id]);
    if (!txn) {
      return c.json({ success: false, message: '流水不存在' }, 404);
    }
    if (txn.source_type !== 'manual') {
      return c.json({ success: false, message: '业务自动生成的流水不能直接改金额，请用「归属账户」调整或到源单据修改' }, 400);
    }
    if (txn.status === 'reversed') {
      return c.json({ success: false, message: '已冲销的流水不能修改' }, 400);
    }
    if (body.txn_date !== undefined && !isDate(body.txn_date)) {
      return c.json({ success: false, message: '日期格式应为 YYYY-MM-DD' }, 400);
    }
    if (body.direction !== undefined && !oneOf(body.direction, ['in', 'out'] as const)) {
      return c.json({ success: false, message: '收支方向不合法' }, 400);
    }
    const amount = body.amount !== undefined ? roundMoney(toAmount(body.amount)) : txn.amount;
    if (amount <= 0) {
      return c.json({ success: false, message: '金额必须大于 0' }, 400);
    }

    const targetDate = body.txn_date ?? txn.txn_date;
    for (const date of [txn.txn_date, targetDate]) {
      const locked = await findPeriodLock(db, date);
      if (locked) {
        return c.json({ success: false, message: `账期 ${locked} 已锁定，无法修改` }, 400);
      }
    }

    if (body.account_id !== undefined) {
      const accountId = body.account_id?.trim();
      const account = accountId
        ? await queryOne<FundAccountRow>(db, 'SELECT * FROM fund_accounts WHERE id = ? AND is_active = 1', [accountId])
        : null;
      if (!account) {
        return c.json({ success: false, message: '账户不存在或已停用' }, 400);
      }
    }

    await execute(
      db,
      `UPDATE fund_transactions SET account_id = ?, txn_date = ?, direction = ?, amount = ?, category = ?,
       counterparty = ?, summary = ?, remarks = ?, updated_at = ? WHERE id = ?`,
      [
        body.account_id?.trim() || txn.account_id,
        targetDate,
        body.direction ?? txn.direction,
        amount,
        body.category !== undefined ? body.category?.trim() || null : txn.category,
        body.counterparty !== undefined ? body.counterparty : txn.counterparty,
        body.summary?.trim() || txn.summary,
        body.remarks !== undefined ? body.remarks : txn.remarks,
        now(),
        id
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '修改手工流水',
      entityType: 'fund_transaction',
      entityId: id,
      details: `修改流水 ${txn.summary}：金额 ${txn.amount} → ${amount}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '流水更新成功' });
  } catch (error) {
    return handleError(c, '修改流水错误:', error);
  }
}

/**
 * 改归属账户。这是「待归属」兜底账户的唯一出路：
 * 自动流水写进来时账户没配好，事后批量把它挪到正确账户。
 * 金额与方向不动，所以不受「自动流水不能改」的限制。
 */
export async function reassignFundTransaction(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const { account_id } = await c.req.json<{ account_id?: string }>();

    const accountId = account_id?.trim();
    if (!accountId) {
      return c.json({ success: false, message: '请选择账户' }, 400);
    }

    const txn = await queryOne<FundTransactionRow>(db, 'SELECT * FROM fund_transactions WHERE id = ?', [id]);
    if (!txn) {
      return c.json({ success: false, message: '流水不存在' }, 404);
    }
    const account = await queryOne<FundAccountRow>(db, 'SELECT * FROM fund_accounts WHERE id = ? AND is_active = 1', [
      accountId
    ]);
    if (!account) {
      return c.json({ success: false, message: '账户不存在或已停用' }, 400);
    }
    const locked = await findPeriodLock(db, txn.txn_date);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法调整归属` }, 400);
    }

    await execute(db, 'UPDATE fund_transactions SET account_id = ?, updated_at = ? WHERE id = ?', [
      accountId,
      now(),
      id
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '调整流水归属账户',
      entityType: 'fund_transaction',
      entityId: id,
      details: `流水「${txn.summary}」归属账户调整为 ${account.name}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '归属账户已调整' });
  } catch (error) {
    return handleError(c, '调整流水归属错误:', error);
  }
}

/** 冲销流水：写一条方向相反的红字，并把原行标成 reversed。不物理删除 */
export async function reverseFundTransaction(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const { reason } = await c.req.json<{ reason?: string }>();

    const txn = await queryOne<FundTransactionRow>(db, 'SELECT * FROM fund_transactions WHERE id = ?', [id]);
    if (!txn) {
      return c.json({ success: false, message: '流水不存在' }, 404);
    }
    if (txn.status === 'reversed') {
      return c.json({ success: false, message: '该流水已被冲销' }, 400);
    }
    if (txn.source_type === 'void_reversal') {
      return c.json({ success: false, message: '冲销红字不能再次冲销，如需回滚请恢复原单据' }, 400);
    }

    const locked = await findPeriodLock(db, txn.txn_date);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法冲销` }, 400);
    }
    if (txn.source_type !== 'manual') {
      return c.json(
        { success: false, message: '业务自动生成的流水请在源单据上撤销（删除订单/费用），系统会自动冲销' },
        400
      );
    }

    const currentTime = now();
    await batchExecute(
      db,
      buildReverseStmts(
        [
          {
            id: txn.id,
            account_id: txn.account_id,
            txn_date: txn.txn_date,
            direction: txn.direction,
            amount: txn.amount,
            category: txn.category,
            counterparty: txn.counterparty,
            summary: txn.summary
          }
        ],
        reason?.trim() || '手工冲销',
        { operatorId: getAuthUser(c)?.id ?? null, currentTime }
      )
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '冲销流水',
      entityType: 'fund_transaction',
      entityId: id,
      details: `冲销流水「${txn.summary}」金额 ${txn.amount}，原因：${reason?.trim() || '手工冲销'}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '已冲销' });
  } catch (error) {
    return handleError(c, '冲销流水错误:', error);
  }
}

// ==================== 账户划转 ====================

/** 账户间划转。一次产生 out + in 两条流水，共用同一个 source_id */
export async function createTransfer(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<{
      from_account_id?: string;
      to_account_id?: string;
      amount?: number;
      transfer_date?: string;
      remarks?: string;
    }>();

    const fromId = body.from_account_id?.trim();
    const toId = body.to_account_id?.trim();
    if (!fromId || !toId) {
      return c.json({ success: false, message: '请选择转出与转入账户' }, 400);
    }
    if (fromId === toId) {
      return c.json({ success: false, message: '转出与转入账户不能相同' }, 400);
    }
    const transferDate = body.transfer_date?.trim() ?? '';
    if (!isDate(transferDate)) {
      return c.json({ success: false, message: '日期格式应为 YYYY-MM-DD' }, 400);
    }
    const amount = roundMoney(toAmount(body.amount));
    if (amount <= 0) {
      return c.json({ success: false, message: '金额必须大于 0' }, 400);
    }

    const accounts = await query<{ id: string; name: string }>(
      db,
      'SELECT id, name FROM fund_accounts WHERE id IN (?, ?) AND is_active = 1',
      [fromId, toId]
    );
    if (accounts.length !== 2) {
      return c.json({ success: false, message: '账户不存在或已停用' }, 400);
    }

    const locked = await findPeriodLock(db, transferDate);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法划转` }, 400);
    }

    const transferId = generateId();
    const currentTime = now();
    const stmts: Stmt[] = [
      {
        sql: `INSERT INTO fund_transfers (id, transfer_date, from_account_id, to_account_id, amount, remarks, operator_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          transferId,
          transferDate,
          fromId,
          toId,
          amount,
          body.remarks ?? null,
          getAuthUser(c)?.id ?? null,
          currentTime
        ]
      },
      ...buildTransferStmts(transferId, fromId, toId, amount, transferDate, body.remarks ?? null, {
        operatorId: getAuthUser(c)?.id ?? null,
        currentTime
      })
    ];

    await batchExecute(db, stmts);

    const fromName = accounts.find((a) => a.id === fromId)?.name ?? fromId;
    const toName = accounts.find((a) => a.id === toId)?.name ?? toId;
    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '账户划转',
      entityType: 'fund_transfer',
      entityId: transferId,
      details: `${fromName} → ${toName} 划转 ${amount}${body.remarks ? `（${body.remarks}）` : ''}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { id: transferId }, message: '划转成功' });
  } catch (error) {
    return handleError(c, '账户划转错误:', error);
  }
}

/** 划转记录列表 */
export async function getFundTransfers(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page, pageSize, start_date, end_date } = c.req.query();

    let sql = `SELECT tr.*, fa.name AS from_account_name, fb.name AS to_account_name
      FROM fund_transfers tr
      JOIN fund_accounts fa ON fa.id = tr.from_account_id
      JOIN fund_accounts fb ON fb.id = tr.to_account_id
      WHERE 1 = 1`;
    const params: Bind[] = [];

    if (start_date) {
      sql += ' AND tr.transfer_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND tr.transfer_date <= ?';
      params.push(end_date);
    }
    sql += ' ORDER BY tr.transfer_date DESC, tr.created_at DESC';

    const pageNum = Number(page);
    const size = Number(pageSize);
    if (Number.isFinite(pageNum) && pageNum > 0 && Number.isFinite(size) && size > 0) {
      const result = await queryWithPagination<FundTransferRow>(db, sql, params, pageNum, size);
      return c.json({ success: true, data: result });
    }

    const rows = await query<FundTransferRow>(db, sql, params);
    return c.json({ success: true, data: { data: rows, total: rows.length } });
  } catch (error) {
    return handleError(c, '获取划转记录错误:', error);
  }
}

// ==================== 资金汇总 ====================

/**
 * 资金汇总：各账户余额 + 合计 + 指定账期的收支合计。
 * 供「财务 → 资金流水」页顶部卡片使用。
 */
export async function getFundSummary(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const period = periodOf(c.req.query('period')) || periodOf(today());

    const accounts = await query<FundAccountRow & { balance: number }>(
      db,
      `SELECT a.*, ${BALANCE_EXPR} AS balance FROM fund_accounts a WHERE a.is_active = 1 ORDER BY a.sort_order, a.name`
    );

    const periodFlow = await queryOne<{ income: number; expense: number }>(
      db,
      `SELECT
         ROUND(COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0), 6) AS income,
         ROUND(COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0), 6) AS expense
       FROM fund_transactions WHERE substr(txn_date, 1, 7) = ?`,
      [period]
    );

    // 待归属的钱不属于任何真实账户，单独提示，避免用户以为账目正常
    const holdingId = await fallbackAccountId(db);
    const holding = accounts.find((a) => a.id === holdingId) ?? null;

    return c.json({
      success: true,
      data: {
        period,
        accounts,
        total: roundMoney(accounts.reduce((sum, a) => sum + toAmount(a.balance), 0)),
        period_income: periodFlow?.income ?? 0,
        period_expense: periodFlow?.expense ?? 0,
        holding_account: holding
      }
    });
  } catch (error) {
    return handleError(c, '获取资金汇总错误:', error);
  }
}

// ==================== 账期锁定 ====================

/** 账期锁定列表 */
export async function getPeriodLocks(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const rows = await query<FinancePeriodLockRow>(db, 'SELECT * FROM finance_period_locks ORDER BY period DESC');
    return c.json({ success: true, data: rows });
  } catch (error) {
    return handleError(c, '获取账期锁定列表错误:', error);
  }
}

/** 锁定账期。锁定后该月的新增/修改/冲销一律 400 */
export async function lockPeriod(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const period = c.req.param('period');
    if (!isPeriod(period)) {
      return c.json({ success: false, message: '账期格式应为 YYYY-MM' }, 400);
    }
    const { remarks } = await c.req.json<{ remarks?: string }>().catch(() => ({ remarks: undefined }));

    await execute(
      db,
      'INSERT OR REPLACE INTO finance_period_locks (period, locked_at, locked_by, remarks) VALUES (?, ?, ?, ?)',
      [period, now(), getAuthUser(c)?.id ?? null, remarks ?? null]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '锁定账期',
      entityType: 'finance_period_lock',
      entityId: period,
      details: `锁定账期 ${period}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: `账期 ${period} 已锁定` });
  } catch (error) {
    return handleError(c, '锁定账期错误:', error);
  }
}

/** 解锁账期 */
export async function unlockPeriod(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const period = c.req.param('period');
    if (!isPeriod(period)) {
      return c.json({ success: false, message: '账期格式应为 YYYY-MM' }, 400);
    }

    await execute(db, 'DELETE FROM finance_period_locks WHERE period = ?', [period]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '解锁账期',
      entityType: 'finance_period_lock',
      entityId: period,
      details: `解锁账期 ${period}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: `账期 ${period} 已解锁` });
  } catch (error) {
    return handleError(c, '解锁账期错误:', error);
  }
}
