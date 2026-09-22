/**
 * 资金流水（总账）的写入与冲销。
 *
 * 两条铁律，改动本文件前先读：
 *
 * 1. **余额不落库**。账户余额一律由 `fund_accounts.opening_balance + SUM(收支)` 派生。
 *    D1 没有跨语句交互式事务（只有 db.batch 是隐式事务），存滚动余额在并发写入、
 *    事后回填、删除冲销三种场景下必然漂移且无法自愈；派生值永远不会漂移。
 *
 * 2. **业务单据删除不物理删除流水，只写红字冲销**。流水是「已经发生过的现金事实」，
 *    删单不等于钱没动；已出的对账单也不能因为删单而变数字。
 *    因此 fund_transactions 对 payments/orders 等**不声明外键**，只存软引用。
 *
 * 幂等：`UNIQUE(source_type, source_id, source_kind) WHERE source_id IS NOT NULL`。
 * SQLite 里 NULL 互不相等，所以手工记账（source_id 为 NULL）天然可以重复录，
 * 而每张单据的每个语义槽只会有一条流水 —— 重复调用不会写重。
 */

import type { Stmt } from '../db/helpers';
import { query, queryOne } from '../db/helpers';
import { generateId } from './ids';
import { roundMoney, toAmount } from './money';
import { isPeriod, periodOf } from './time';

/** 资金流水的来源类型。新增业务 hook 时在这里补一个值，并同步 utils/constants.ts */
export const FUND_SOURCE_TYPES = [
  'prepay',
  'payment',
  'extension',
  'refund',
  'transfer',
  'vehicle_expense',
  'operating_expense',
  'settlement_payout',
  'partner_advance',
  'loan',
  'manual',
  'void_reversal'
] as const;

export type FundSourceType = (typeof FUND_SOURCE_TYPES)[number];

/** 收入侧语义槽 */
export type FundInKind = 'rent_in' | 'deposit_in' | 'penalty_in' | 'violation_in' | 'refund_in' | 'transfer_in' | 'other_in';
/** 支出侧语义槽 */
export type FundOutKind = 'rent_out' | 'deposit_refund' | 'main_out' | 'settlement_out' | 'advance_out' | 'loan_out' | 'transfer_out' | 'other_out';
/**
 * `main_out` / `main_in` 是「同一张源单据的支出侧与收入侧」。
 * 车辆费用台账允许一行同时有收入和支出（台账 2026.4.13 违章行），
 * 两侧用不同的槽位才能各写一条流水而不互相顶掉幂等键。
 */
export type FundSourceKind = FundInKind | FundOutKind | 'main' | 'main_in' | 'main_out' | 'void_reversal';

export interface FundTxnInput {
  /** 目标账户 id。为 null/空时不写流水（见 buildFundTxnStmt 的说明） */
  accountId: string | null;
  /** 业务发生日 YYYY-MM-DD（不是写入日；跨月补录靠它归月） */
  txnDate: string;
  direction: 'in' | 'out';
  /** 恒为正数，方向由 direction 表达 */
  amount: number;
  category?: string | null;
  sourceType: FundSourceType;
  sourceId?: string | null;
  sourceKind?: FundSourceKind;
  counterparty?: string | null;
  summary: string;
  remarks?: string | null;
}

export interface FundTxnMeta {
  operatorId?: string | null;
  /** 写入时间，统一由调用方传入 now()，避免一次请求里出现多个时间戳 */
  currentTime: string;
}

const FUND_TXN_COLUMNS =
  'id, account_id, txn_date, direction, amount, category, source_type, source_id, source_kind, ' +
  'counterparty, summary, status, reverses_id, reversed_by_id, operator_id, remarks, created_at, updated_at';

/** 列数（18）。单测断言它与 INSERT 的参数个数一致 */
export const FUND_TXN_COLUMN_COUNT = FUND_TXN_COLUMNS.split(',').length;

/**
 * 组装一条资金流水语句。
 *
 * 两种情况返回 null（不写流水），目的都是**绝不让流水语句把业务批处理弄失败**：
 *   * 金额为 0 —— 不写零金额流水，否则对账单上会出现一堆「金额 0」的噪音行。
 *   * 账户为空 —— 库里一个启用的账户都没有（全新部署还没跑 0016 种子）。
 *     此时若照样拼语句，account_id = '' 会撞外键约束，把整笔业务一起回滚，
 *     变成「因为财务没配好所以订单收不了款」。宁可不记这笔流水。
 *     账户缺失的情况在界面上由「账户余额」页提示，人工补账即可。
 */
export function buildFundTxnStmt(input: FundTxnInput, meta: FundTxnMeta): Stmt | null {
  const accountId = (input.accountId ?? '').trim();
  if (!accountId) return null;

  const amount = roundMoney(toAmount(input.amount));
  if (amount <= 0) return null;

  const params = [
    generateId(),
    accountId,
    input.txnDate,
    input.direction,
    amount,
    input.category ?? null,
    input.sourceType,
    input.sourceId ?? null,
    input.sourceKind ?? 'main',
    input.counterparty ?? null,
    input.summary,
    'posted',
    null,
    null,
    meta.operatorId ?? null,
    input.remarks ?? null,
    meta.currentTime,
    meta.currentTime
  ];

  return {
    sql: `INSERT INTO fund_transactions (${FUND_TXN_COLUMNS}) VALUES (${params.map(() => '?').join(', ')})`,
    params
  };
}

/** 把流水语句追加进业务的 batch；金额为 0 时静默跳过 */
export function pushFundTxn(stmts: Stmt[], input: FundTxnInput, meta: FundTxnMeta): void {
  const stmt = buildFundTxnStmt(input, meta);
  if (stmt) stmts.push(stmt);
}

/** 一次划转（公户 → 微信 等）产生两条流水，用同一个 source_id 关联 */
export function buildTransferStmts(
  transferId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  transferDate: string,
  remarks: string | null,
  meta: FundTxnMeta
): Stmt[] {
  const stmts: Stmt[] = [];
  pushFundTxn(
    stmts,
    {
      accountId: fromAccountId,
      txnDate: transferDate,
      direction: 'out',
      amount,
      category: 'transfer',
      sourceType: 'transfer',
      sourceId: transferId,
      sourceKind: 'transfer_out',
      counterparty: null,
      summary: remarks || '账户划转（转出）'
    },
    meta
  );
  pushFundTxn(
    stmts,
    {
      accountId: toAccountId,
      txnDate: transferDate,
      direction: 'in',
      amount,
      category: 'transfer',
      sourceType: 'transfer',
      sourceId: transferId,
      sourceKind: 'transfer_in',
      counterparty: null,
      summary: remarks || '账户划转（转入）'
    },
    meta
  );
  return stmts;
}

/** 可被冲销的流水行（只需要这几列即可拼出红字） */
export interface ReversibleTxn {
  id: string;
  account_id: string;
  txn_date: string;
  direction: string;
  amount: number;
  category: string | null;
  counterparty: string | null;
  summary: string;
}

/**
 * 冲销若干条流水：每条生成「一条红字 + 把原行标记为 reversed」两条语句。
 *
 * 红字的 direction 取反、金额仍为正，`reverses_id` 指向原行；原行 `reversed_by_id` 指向红字。
 * 红字本身也参与余额 SUM，所以余额会自动回到单据发生前的状态，不需要任何修复脚本。
 */
export function buildReverseStmts(txns: readonly ReversibleTxn[], reason: string, meta: FundTxnMeta): Stmt[] {
  const stmts: Stmt[] = [];

  for (const txn of txns) {
    const reversalId = generateId();
    const reversedDirection = txn.direction === 'in' ? 'out' : 'in';
    const amount = roundMoney(toAmount(txn.amount));

    const params = [
      reversalId,
      txn.account_id,
      txn.txn_date,
      reversedDirection,
      amount,
      txn.category ?? null,
      'void_reversal',
      txn.id,
      'void_reversal',
      txn.counterparty ?? null,
      `冲销：${txn.summary}`,
      'posted',
      txn.id,
      null,
      meta.operatorId ?? null,
      reason,
      meta.currentTime,
      meta.currentTime
    ];

    stmts.push({
      sql: `INSERT INTO fund_transactions (${FUND_TXN_COLUMNS}) VALUES (${params.map(() => '?').join(', ')})`,
      params
    });

    stmts.push({
      sql: 'UPDATE fund_transactions SET status = ?, reversed_by_id = ?, updated_at = ? WHERE id = ?',
      params: ['reversed', reversalId, meta.currentTime, txn.id]
    });
  }

  return stmts;
}

/** 日期串是否合法（YYYY-MM-DD） */
export function isDate(value: string | null | undefined): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test((value ?? '').trim());
}

// ==================== 受控枚举 ====================
// 放在这里而不是各自 controller 里：同一套枚举被 finance / expenses / settlement
// 三个 controller 用来校验入参，散开写迟早会出现某一处漏了校验。

export const FUND_DIRECTIONS = ['in', 'out'] as const;
export const ACCOUNT_TYPES = ['bank', 'wechat', 'alipay', 'cash', 'virtual'] as const;
export const INVOICE_STATUSES = ['none', 'pending', 'issued'] as const;
export const SETTLE_STATUSES = ['unpaid', 'partial', 'paid'] as const;
export const SETTLEMENT_LINE_STATUSES = ['posted', 'void'] as const;
export const OWNER_ROLES = ['owner', 'partner', 'both'] as const;
export const OWNERSHIP_TYPES = ['company', 'attached'] as const;
export const PAYOUT_TYPES = ['settlement', 'advance', 'adjust'] as const;
export const ADVANCE_SUBJECTS = ['setup', 'advance', 'loan', 'salary', 'writeoff', 'reimburse', 'repay', 'other'] as const;

/** 成员校验。用于把请求体里的字符串收敛到已知枚举，非法值一律由调用方回 400 */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

/**
 * 该日期所属的账期是否被锁定。返回锁定的账期（YYYY-MM）或 null。
 * 控制器命中时直接回 400「账期已锁定」，而不是抛异常 —— 与仓库既有的校验风格一致。
 */
export async function findPeriodLock(db: D1Database, date: string): Promise<string | null> {
  const period = periodOf(date);
  if (!isPeriod(period)) return null;
  const row = await queryOne<{ period: string }>(db, 'SELECT period FROM finance_period_locks WHERE period = ?', [period]);
  return row?.period ?? null;
}

/**
 * 一组日期里任意一个落在锁定账期就返回那个账期。
 *
 * 删除订单这类操作会同时动到多个日期（订单取车日所属的结算期、各笔收款的日期），
 * 逐个查太啰嗦，而且漏查一个就等于锁月形同虚设 —— 所以做成「一次给全」的形式。
 */
export async function findFirstLockedPeriod(
  db: D1Database,
  dates: ReadonlyArray<string | null | undefined>
): Promise<string | null> {
  const periods = new Set<string>();
  for (const date of dates) {
    const period = periodOf(date);
    if (isPeriod(period)) periods.add(period);
  }
  if (periods.size === 0) return null;

  const list = [...periods];
  const rows = await query<{ period: string }>(
    db,
    `SELECT period FROM finance_period_locks WHERE period IN (${list.map(() => '?').join(', ')}) ORDER BY period LIMIT 1`,
    list
  );
  return rows[0]?.period ?? null;
}
