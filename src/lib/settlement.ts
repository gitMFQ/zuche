/**
 * 车主结算台账的计算链。口径来自三份单车车主结算台账（捷途 / 哈弗H6 / 雅阁），
 * 三份表的公式一致，已用真实数据逐行验证：
 *
 *   平台管理费   = 合计 × 平台费率          (哈啰 15% / 携程 15% / 线下 0)
 *   结算金额     = 合计 − 平台管理费
 *   公司管理费   = 结算金额 × 公司费率       (默认 15%，自营车 0)
 *   车主结算金额 = 结算金额 − 公司管理费 − 其他费用
 *
 * 「其他费用」是台账备注列里那些零散加减项（机场过路费 6 元、洗车 10 元、补气 5 元、
 * 违章罚款、车损赔偿），正数表示由车主承担（减少车主所得），负数表示反向补贴。
 *
 * 口径纪律：本模块一律走 money.ts 的 roundMoney（保留 6 位小数，见该文件里关于台账
 * 4 位小数的说明）。**不要**复用 orderAmount.ts 的 calcNetAmount —— 那个是整元口径，
 * 用于订单页展示；两者允许差几分，报表以结算行为准。
 */

import type { Stmt } from '../db/helpers';
import { queryOne } from '../db/helpers';
import { MONEY_SCALE, roundMoney, toAmount, toRate } from './money';

/** 系统计算出的金额链（不含人工干预），唯一承载 otherFee，避免出现第二个来源 */
export interface SettlementAmounts {
  /** 合计 */
  totalAmount: number;
  /** 平台费率（%） */
  platformRate: number;
  /** 平台管理费 */
  platformFee: number;
  /** 结算金额 = 合计 − 平台管理费 */
  settlementAmount: number;
  /** 公司费率（%） */
  companyRate: number;
  /** 公司管理费 = 结算金额 × 公司费率 */
  companyFee: number;
  /** 其他费用（正数 = 车主承担） */
  otherFee: number;
  /** 车主结算金额 = 结算金额 − 公司管理费 − 其他费用 */
  ownerAmount: number;
}

/** 落库的 6 个金额列（最终值 / 对外导出用） */
export interface SettlementMoney {
  totalAmount: number;
  platformFee: number;
  settlementAmount: number;
  companyFee: number;
  otherFee: number;
  ownerAmount: number;
}

export interface SettlementInput {
  /** 订单合计（或手工补录的合计） */
  totalAmount: number;
  /** 平台费率（%），来自 order_sources.commission_rate，生成时快照 */
  platformRate: number;
  /** 公司费率（%），来自 owners.company_fee_rate，自营车为 0 */
  companyRate: number;
  /** 其他费用（正数 = 车主承担） */
  otherFee?: number;
}

/** 按台账公式算出完整金额链 */
export function buildSettlementAmounts(input: SettlementInput): SettlementAmounts {
  const totalAmount = roundMoney(toAmount(input.totalAmount));
  const platformRate = toRate(input.platformRate);
  const platformFee = roundMoney((totalAmount * platformRate) / 100);
  const settlementAmount = roundMoney(totalAmount - platformFee);
  const companyRate = toRate(input.companyRate);
  const companyFee = roundMoney((settlementAmount * companyRate) / 100);
  const otherFee = roundMoney(toAmount(input.otherFee));
  const ownerAmount = roundMoney(settlementAmount - companyFee - otherFee);

  return {
    totalAmount,
    platformRate,
    platformFee,
    settlementAmount,
    companyRate,
    companyFee,
    otherFee,
    ownerAmount
  };
}

/** 从金额链投影出 6 个落库金额列 */
export function moneyOf(amounts: SettlementAmounts): SettlementMoney {
  return {
    totalAmount: amounts.totalAmount,
    platformFee: amounts.platformFee,
    settlementAmount: amounts.settlementAmount,
    companyFee: amounts.companyFee,
    otherFee: amounts.otherFee,
    ownerAmount: roundMoney(amounts.settlementAmount - amounts.companyFee - amounts.otherFee)
  };
}

/**
 * 最终金额：未手工覆盖时用系统口径；已覆盖时原样保留人工填的值。
 *
 * 重算（订单改价 / 续租 / 还车重算）**绝不能**覆盖人工改过的行，
 * 否则用户在「其他费用」里填的机场过路费会被悄悄改回去，且没有人会发现。
 * 数据库侧对应 `CASE WHEN amount_overridden = 1 THEN 原值 ELSE 新值 END`。
 */
export function applyOverride(calc: SettlementAmounts, final: SettlementMoney | null, overridden: boolean): SettlementMoney {
  if (overridden && final) {
    return {
      totalAmount: roundMoney(final.totalAmount),
      platformFee: roundMoney(final.platformFee),
      settlementAmount: roundMoney(final.settlementAmount),
      companyFee: roundMoney(final.companyFee),
      otherFee: roundMoney(final.otherFee),
      ownerAmount: roundMoney(final.ownerAmount)
    };
  }
  return moneyOf(calc);
}

export interface StatementSummaryInput {
  /** 期初结转（settlement_openings + 该期之前的累计应付） */
  opening: number;
  /** 本期车主结算金额合计 */
  ownerAmountSum: number;
  /** 本期代该车主垫付的车辆费用（支出侧 − 收入侧） */
  ownerExpenseSum: number;
  /** 本期结算付款（结车款 / 预付） */
  payoutSum: number;
}

/**
 * 车主对账单的期末应付：
 *   期末 = 期初 + 本期车主结算金额 − 本期代垫车辆费用 − 本期付款
 *
 * 与台账底部的「结余」列一致（捷途 2026：15246 − 99.16 补油 − 3000 结车款 = 12147）。
 */
export function calcStatementSummary(input: StatementSummaryInput): { closing: number } {
  return {
    closing: roundMoney(
      toAmount(input.opening) + toAmount(input.ownerAmountSum) - toAmount(input.ownerExpenseSum) - toAmount(input.payoutSum)
    )
  };
}

export interface VehicleMonthlyInput {
  /** 车主结算金额（自营车取结算金额） */
  ownerAmount: number;
  /** 月供（车贷） */
  loan: number;
  /** 保养 */
  maintenance: number;
  /** 维修 */
  repair: number;
  /** 其它车辆费用（保险/洗车/过路费/违章…）。保险按 amortize_months 分摊后进来 */
  otherExpense?: number;
}

/**
 * 单车月报的「结余」。
 * 对照台账 file-3 的「2026月报」：1月 2023.72 − 2030.31 = −6.59，2月 2357.01 − 2030.30 = 326.71。
 * 那两行的保养/维修/其它都是 0，所以与台账完全一致。
 */
export function calcVehicleMonthlyRow(input: VehicleMonthlyInput): { balance: number } {
  return {
    balance: roundMoney(
      toAmount(input.ownerAmount) -
        toAmount(input.loan) -
        toAmount(input.maintenance) -
        toAmount(input.repair) -
        toAmount(input.otherExpense)
    )
  };
}

// ==================== SQL 构造 ====================

/** 生成结算行所需的全部字段 */
export interface SettlementLineInput {
  ownerId: string;
  vehicleId: string | null;
  orderId: string | null;
  /** 结算期 YYYY-MM */
  period: string;
  /** 用车时间（按订单取车时间归月） */
  lineDate: string;
  orderNo: string | null;
  plateNumber: string | null;
  /** 订单来源 id（软引用） */
  sourceIdRef: string | null;
  /** 平台名快照 */
  sourceName: string | null;
  customerName: string | null;
  startDate: string | null;
  endDate: string | null;
  days: number;
  unitPrice: number;
  /** 金额链（已含 otherFee 与 ownerAmount），不要另传一份 otherFee */
  amounts: SettlementAmounts;
  /** order 系统生成 / manual 手工补录 / carryover 期初结转 */
  sourceType: string;
  /** 源单据 id，幂等键的第二段 */
  sourceId: string | null;
  /** 幂等键的第三段，同一单据需要拆多行时用它区分 */
  lineKind: string;
  remarks?: string | null;
}

const SETTLEMENT_LINE_COLUMNS =
  'id, owner_id, vehicle_id, order_id, period, line_date, order_no, plate_number, source_id_ref, source_name, ' +
  'customer_name, start_date, end_date, days, unit_price, ' +
  'calc_total_amount, calc_platform_rate, calc_platform_fee, calc_settlement_amount, calc_company_rate, calc_company_fee, calc_owner_amount, ' +
  'total_amount, platform_fee, settlement_amount, company_fee, other_fee, owner_amount, amount_overridden, ' +
  'source_type, source_id, line_kind, status, remarks, operator_id, created_at, updated_at';

/** 列数（37）。单测会断言它与 INSERT 的参数个数一致，防止列与值错位这种静默 bug */
export const SETTLEMENT_LINE_COLUMN_COUNT = SETTLEMENT_LINE_COLUMNS.split(',').length;

/**
 * 拼出 INSERT 语句。
 * 占位符由参数个数生成，参数顺序必须与 SETTLEMENT_LINE_COLUMNS 严格一致 ——
 * 一旦错位，金额会静默落进相邻列，所以两条约束都写进单测。
 */
export function buildSettlementInsertStmt(
  input: SettlementLineInput,
  meta: { id: string; operatorId: string | null; currentTime: string }
): Stmt {
  const money = moneyOf(input.amounts);
  const { amounts } = input;

  const params = [
    meta.id,
    input.ownerId,
    input.vehicleId,
    input.orderId,
    input.period,
    input.lineDate,
    input.orderNo,
    input.plateNumber,
    input.sourceIdRef,
    input.sourceName,
    input.customerName,
    input.startDate,
    input.endDate,
    input.days,
    input.unitPrice,
    amounts.totalAmount,
    amounts.platformRate,
    amounts.platformFee,
    amounts.settlementAmount,
    amounts.companyRate,
    amounts.companyFee,
    amounts.ownerAmount,
    money.totalAmount,
    money.platformFee,
    money.settlementAmount,
    money.companyFee,
    money.otherFee,
    money.ownerAmount,
    0,
    input.sourceType,
    input.sourceId,
    input.lineKind,
    'posted',
    input.remarks ?? null,
    meta.operatorId,
    meta.currentTime,
    meta.currentTime
  ];

  return {
    sql: `INSERT INTO settlement_lines (${SETTLEMENT_LINE_COLUMNS}) VALUES (${params.map(() => '?').join(', ')})`,
    params
  };
}

/**
 * 按订单重算结算行的系统口径（订单改价 / 续租 / 还车重算时调用）。
 *
 * 人工改过的行（amount_overridden = 1）只更新 calc_* 供前端展示差异，
 * 最终值原样保留；未改过的行跟随系统口径。
 *
 * calc_owner_amount / owner_amount 用 SQL 表达式现算（而不是由调用方传值），
 * 这样「其他费用」被单独改动时两个口径会自动跟上，调用方不需要回读整行。
 * 外面必须套 ROUND(..., MONEY_SCALE)：SQLite 的浮点减法会留下尾数，
 * `334.9 - 50.235` 直接算出来是 284.66499999999996，落库就成了脏数据。
 */
export function buildSettlementRefreshStmt(
  orderId: string,
  amounts: SettlementAmounts,
  currentTime: string
): Stmt {
  const ownerExpr = `ROUND(? - ? - other_fee, ${MONEY_SCALE})`;

  return {
    sql: `UPDATE settlement_lines SET
      calc_total_amount = ?, calc_platform_rate = ?, calc_platform_fee = ?, calc_settlement_amount = ?,
      calc_company_rate = ?, calc_company_fee = ?, calc_owner_amount = ${ownerExpr},
      total_amount = CASE WHEN amount_overridden = 1 THEN total_amount ELSE ? END,
      platform_fee = CASE WHEN amount_overridden = 1 THEN platform_fee ELSE ? END,
      settlement_amount = CASE WHEN amount_overridden = 1 THEN settlement_amount ELSE ? END,
      company_fee = CASE WHEN amount_overridden = 1 THEN company_fee ELSE ? END,
      owner_amount = CASE WHEN amount_overridden = 1 THEN owner_amount ELSE ${ownerExpr} END,
      updated_at = ?
    WHERE order_id = ? AND status = 'posted'`,
    params: [
      amounts.totalAmount,
      amounts.platformRate,
      amounts.platformFee,
      amounts.settlementAmount,
      amounts.companyRate,
      amounts.companyFee,
      amounts.settlementAmount,
      amounts.companyFee,
      amounts.totalAmount,
      amounts.platformFee,
      amounts.settlementAmount,
      amounts.companyFee,
      amounts.settlementAmount,
      amounts.companyFee,
      currentTime,
      orderId
    ]
  };
}

/** 作废某个订单的结算行（订单取消 / 删除时调用）。不物理删除，保留审计痕迹 */
export function buildSettlementVoidStmt(orderId: string, reason: string, currentTime: string): Stmt {
  return {
    sql: "UPDATE settlement_lines SET status = 'void', voided_reason = ?, updated_at = ? WHERE order_id = ? AND status = 'posted'",
    params: [reason, currentTime, orderId]
  };
}

/**
 * 取车辆所属车主的公司费率（%）。
 *
 * 自营车（owner_id 为空）与车主已停用时都返回 0 —— 自营车的结算金额全部归公司，
 * 没有「公司管理费」这一说（台账里哈弗H6 那张表就没有这一列）。
 *
 * 费率是「生成结算行时快照」的：这里取的是**当前**配置，只影响重算的 calc_* 值，
 * 人工改过的行不受影响（见 buildSettlementRefreshStmt）。
 */
export async function resolveCompanyRate(db: D1Database, vehicleId: string | null): Promise<number> {
  if (!vehicleId) return 0;
  const row = await queryOne<{ company_fee_rate: number }>(
    db,
    `SELECT o.company_fee_rate
     FROM vehicles v JOIN owners o ON o.id = v.owner_id
     WHERE v.id = ? AND o.status = 1`,
    [vehicleId]
  );
  return toRate(row?.company_fee_rate);
}
