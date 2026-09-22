/**
 * 业务单据 → 车辆费用台账的镜像。
 *
 * 保养 / 保险 / 违章 三张表各自有自己的字段，但台账 file-4 的「车辆费用台账」
 * 把它们和手工录入的洗车费/过路费放在一张表里看。这里把它们镜像进
 * vehicle_expenses，用 `source_type + source_id + source_kind` 做幂等键。
 *
 * ==================== 为什么镜像行是「只读」的 ====================
 *
 * 镜像行的金额来自源单据，源单据是唯一真相。如果允许在费用台账里直接改，
 * 就会出现「保养单写 240、费用台账写 180」两套数，谁也不知道哪个对。
 * 所以：
 *   * 改金额/日期 → 到源单据改（保养记录、保险记录、违章记录）
 *   * 改付款状态   → 在费用台账里操作（标记付款 / 撤销付款）。
 *                    源单据并不关心钱从哪个账户出的，这部分信息只存在于镜像行上，
 *                    因此镜像同步**不会覆盖 is_paid / account_id / paid_at**。
 *
 * 已经标记付款的镜像行不能再改金额 —— 与系统里其他单据一致
 * （已发生的现金记录不能靠改单据来"修正"，必须先撤销付款）。
 */

import type { Stmt } from '../db/helpers';
import { queryOne } from '../db/helpers';
import type { VehicleExpenseRow } from '../db/rows';
import { pushFundTxn, type FundSourceType } from './ledger';
import { roundMoney, toAmount } from './money';

/** 能产生车辆费用镜像的源单据类型 */
export type MirrorSourceType = 'maintenance' | 'insurance' | 'violation';

export interface MirrorSource {
  sourceType: MirrorSourceType;
  sourceId: string;
  vehicleId: string;
  plateNumber: string | null;
  ownerId: string | null;
  expenseDate: string;
  /** 车辆费用类型字典 id（repair / maintenance / violation / insurance ...） */
  expenseType: string;
  expenseTypeName: string;
  incomeAmount: number;
  expenseAmount: number;
  /** 年费按 N 个月分摊进单车月报（保险默认 12） */
  amortizeMonths?: number;
  invoiceStatus?: string;
  remarks?: string | null;
  images?: string | null;
}

interface MirrorMeta {
  operatorId: string | null;
  currentTime: string;
}

const MIRROR_COLUMNS =
  'id, vehicle_id, plate_number, owner_id, expense_date, expense_type, expense_type_name, ' +
  'income_amount, expense_amount, invoice_status, invoice_no, is_paid, paid_at, account_id, ' +
  'amortize_months, amount_overridden, source_type, source_id, source_kind, remarks, images, operator_id, created_at, updated_at';

/** 源单据的金额/日期是否已经和镜像行不一致（不一致且已付款时要拦下） */
export function mirrorAmountChanged(existing: VehicleExpenseRow, source: MirrorSource): boolean {
  return (
    roundMoney(toAmount(existing.expense_amount)) !== roundMoney(toAmount(source.expenseAmount)) ||
    roundMoney(toAmount(existing.income_amount)) !== roundMoney(toAmount(source.incomeAmount)) ||
    existing.expense_date !== source.expenseDate
  );
}

/**
 * 生成镜像同步语句。
 *
 * 现有镜像行已付款时返回 `{ blocked: true }`，由调用方回 400 —— 金额已经进了资金流水，
 * 不能靠改单据来"修正"。返回的语句顺序是「先建后改」：INSERT OR IGNORE 幂等建行，
 * 再 UPDATE 派生字段，这样镜像行上的付款信息不会被覆盖掉。
 */
export async function buildMirrorSyncStmts(
  db: D1Database,
  source: MirrorSource,
  meta: MirrorMeta,
  options: { id: string; paidAccountId?: string | null; paidAt?: string | null } = { id: '' }
): Promise<{ stmts: Stmt[]; blocked: string | null }> {
  const existing = await queryOne<VehicleExpenseRow>(
    db,
    'SELECT * FROM vehicle_expenses WHERE source_type = ? AND source_id = ?',
    [source.sourceType, source.sourceId]
  );

  if (existing && existing.is_paid === 1 && mirrorAmountChanged(existing, source)) {
    return {
      stmts: [],
      blocked: '该单据的费用已在车辆费用台账标记付款，请先撤销付款再修改金额或日期'
    };
  }

  const stmts: Stmt[] = [];
  const incomeAmount = roundMoney(toAmount(source.incomeAmount));
  const expenseAmount = roundMoney(toAmount(source.expenseAmount));
  const amortizeMonths =
    Number.isFinite(source.amortizeMonths) && Number(source.amortizeMonths) >= 1 ? Number(source.amortizeMonths) : 1;

  if (!existing) {
    const wantsPaid = Boolean(options.paidAccountId && options.paidAt);
    const mirrorId = options.id || source.sourceId;
    const params = [
      mirrorId,
      source.vehicleId,
      source.plateNumber,
      source.ownerId,
      source.expenseDate,
      source.expenseType,
      source.expenseTypeName,
      incomeAmount,
      expenseAmount,
      source.invoiceStatus ?? 'none',
      null,
      wantsPaid ? 1 : 0,
      wantsPaid ? options.paidAt : null,
      wantsPaid ? options.paidAccountId : null,
      amortizeMonths,
      0,
      source.sourceType,
      source.sourceId,
      'main',
      source.remarks ?? null,
      source.images ?? null,
      meta.operatorId,
      meta.currentTime,
      meta.currentTime
    ];
    stmts.push({
      sql: `INSERT OR IGNORE INTO vehicle_expenses (${MIRROR_COLUMNS}) VALUES (${params.map(() => '?').join(', ')})`,
      params
    });

    if (wantsPaid && options.paidAccountId && options.paidAt) {
      stmts.push(
        ...mirrorFlowStmts(
          { id: mirrorId, plateNumber: source.plateNumber, expenseTypeName: source.expenseTypeName, remarks: source.remarks ?? null },
          options.paidAccountId,
          options.paidAt,
          incomeAmount,
          expenseAmount,
          meta
        )
      );
    }
    return { stmts, blocked: null };
  }

  // 已存在：只改派生字段，is_paid / account_id / paid_at / amount_overridden 一律不动
  stmts.push({
    sql: `UPDATE vehicle_expenses SET
        vehicle_id = ?, plate_number = ?, owner_id = ?, expense_date = ?, expense_type = ?, expense_type_name = ?,
        income_amount = ?, expense_amount = ?, invoice_status = ?, amortize_months = ?, remarks = ?, images = ?,
        updated_at = ?
      WHERE source_type = ? AND source_id = ?`,
    params: [
      source.vehicleId,
      source.plateNumber,
      source.ownerId,
      source.expenseDate,
      source.expenseType,
      source.expenseTypeName,
      incomeAmount,
      expenseAmount,
      source.invoiceStatus ?? existing.invoice_status,
      amortizeMonths,
      source.remarks ?? null,
      source.images ?? existing.images,
      meta.currentTime,
      source.sourceType,
      source.sourceId
    ]
  });

  return { stmts, blocked: null };
}

/** 删除源单据时清理镜像行与它产生的流水（金额还没付款的话流水也不存在） */
export function buildMirrorDeleteStmts(sourceType: MirrorSourceType, sourceId: string): Stmt[] {
  return [
    {
      sql: "DELETE FROM fund_transactions WHERE source_type = 'vehicle_expense' AND source_id IN (SELECT id FROM vehicle_expenses WHERE source_type = ? AND source_id = ?) AND status = 'posted' AND reverses_id IS NULL",
      params: [sourceType, sourceId]
    },
    { sql: 'DELETE FROM vehicle_expenses WHERE source_type = ? AND source_id = ?', params: [sourceType, sourceId] }
  ];
}

/** 源单据删除前检查：已付款的镜像行不能连带删掉 */
export async function findPaidMirror(db: D1Database, sourceType: MirrorSourceType, sourceId: string): Promise<VehicleExpenseRow | null> {
  return queryOne<VehicleExpenseRow>(
    db,
    'SELECT * FROM vehicle_expenses WHERE source_type = ? AND source_id = ? AND is_paid = 1',
    [sourceType, sourceId]
  );
}

/**
 * 镜像行产生的资金流水（支出侧 + 收入侧两个语义槽）。
 * 两侧用不同的 source_kind，所以一行费用最多两条流水且互不顶替。
 */
export function mirrorFlowStmts(
  row: { id: string; plateNumber: string | null; expenseTypeName: string; remarks: string | null },
  accountId: string,
  paidAt: string,
  incomeAmount: number,
  expenseAmount: number,
  meta: MirrorMeta
): Stmt[] {
  const stmts: Stmt[] = [];
  pushFundTxn(
    stmts,
    {
      accountId,
      txnDate: paidAt,
      direction: 'out',
      amount: expenseAmount,
      category: 'vehicle',
      sourceType: 'vehicle_expense' as FundSourceType,
      sourceId: row.id,
      sourceKind: 'main_out',
      counterparty: row.plateNumber,
      summary: `车辆费用支出：${row.expenseTypeName}（${row.plateNumber ?? ''}）`,
      remarks: row.remarks
    },
    meta
  );
  pushFundTxn(
    stmts,
    {
      accountId,
      txnDate: paidAt,
      direction: 'in',
      amount: incomeAmount,
      category: 'compensation',
      sourceType: 'vehicle_expense' as FundSourceType,
      sourceId: row.id,
      sourceKind: 'main_in',
      counterparty: row.plateNumber,
      summary: `车辆费用收入：${row.expenseTypeName}（${row.plateNumber ?? ''}）`,
      remarks: row.remarks
    },
    meta
  );
  return stmts;
}
