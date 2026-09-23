/**
 * 后端侧的枚举中文名。前端 utils/constants.ts 有一份同内容的映射，
 * 但 Worker 不能引前端代码，这里单独维护一份，改动时两边要同步。
 */

// 只为下面两个语义槽映射声明类型；type-only 导入不会产生运行时依赖
import type { FundSourceKind } from './ledger';

export const PAYMENT_METHOD_TEXT: Record<string, string> = {
  platform: '平台支付',
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  bank: '银行卡',
  other: '其他'
};

export const PAYMENT_TYPE_TEXT: Record<string, string> = {
  rent: '租金',
  deposit: '押金',
  rent_deposit: '租金+押金',
  violation_deposit: '违章押金',
  damage: '车损',
  other: '其他'
};

/**
 * 订单状态中文名。
 * overdue（已逾期）是派生状态，不落库 —— 由 `active 且 end_date < 当前时间` 算出来。
 * 落库会引入"需要定时任务把 active 改成 overdue、续租又要改回来"的同步负担，
 * 且取消/续租路径都要额外处理。展示与筛选统一用派生的方式。
 */
export const ORDER_STATUS_TEXT: Record<string, string> = {
  pending: '待取车',
  active: '已取车',
  completed: '已还车',
  cancelled: '已取消',
  overdue: '已逾期'
};

/**
 * 订单状态机：key 是当前状态，value 是允许变更到的状态。
 * 空数组表示终态，不允许再流转。
 * 逾期不参与流转（它是派生的），因此不在表里出现。
 */
export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

/** 到店取车/还车都在门店完成，不记录具体地址，取还车位置统一记为门店 */
export const STORE_LOCATION_TEXT = '门店';

/** 支付类型落到费用明细的分类 */
export const PAYMENT_TYPE_FEE_CATEGORY: Record<string, string> = {
  rent: 'rent',
  deposit: 'deposit',
  rent_deposit: 'rent',
  violation_deposit: 'deposit',
  damage: 'penalty',
  other: 'other'
};

// ==================== 财务 / 结算 ====================
// 前端 frontend/src/utils/constants.ts 有一份同内容的映射，改动时要两边同步。

/** 车辆归属：自有 / 挂靠。挂靠车才有车主公司管理费 */
export const OWNERSHIP_TYPE_TEXT: Record<string, string> = {
  company: '自有',
  attached: '挂靠'
};

/** 车型分类（台账「车辆档案」sheet 的车型列） */
export const VEHICLE_CATEGORY_TEXT: Record<string, string> = {
  suv: 'SUV',
  sedan: '轿车',
  mpv: 'MPV',
  pickup: '皮卡',
  other: '其他'
};

/** 车主身份 */
export const OWNER_ROLE_TEXT: Record<string, string> = {
  owner: '挂靠车主',
  partner: '合伙人',
  both: '车主兼合伙人'
};

/** 资金流水方向 */
export const FUND_DIRECTION_TEXT: Record<string, string> = {
  in: '收入',
  out: '支出'
};

/** 资金流水的收支分类 */
export const FUND_CATEGORY_TEXT: Record<string, string> = {
  rent: '租金',
  deposit: '押金',
  violation: '违章款',
  compensation: '车损赔偿',
  vehicle: '车辆费用',
  operating: '运营开支',
  settlement: '车主结算款',
  loan: '车贷',
  transfer: '账户划转',
  other: '其他'
};

/**
 * 资金流水的来源类型。
 * 每一项对应一个会自动写流水的业务动作，新增 hook 时两边一起加。
 */
export const FUND_SOURCE_TYPE_TEXT: Record<string, string> = {
  prepay: '下单预付',
  payment: '订单收款',
  extension: '续租收款',
  refund: '退款',
  transfer: '账户划转',
  vehicle_expense: '车辆费用',
  operating_expense: '运营开支',
  settlement_payout: '车主结算付款',
  partner_advance: '合伙人往来',
  loan: '车贷月供',
  manual: '手工记账',
  void_reversal: '冲销红字'
};

/**
 * 支付类型 → 资金流水的语义槽（source_kind）。
 * 与 PAYMENT_TYPE_FEE_CATEGORY 同构：槽位是幂等键的第三段，
 * 所以「租金+押金」一笔收款要拆成 rent_in / deposit_in 两个槽才不会互相顶掉。
 */
export const PAYMENT_TXN_SLOT: Record<string, FundSourceKind> = {
  rent: 'rent_in',
  deposit: 'deposit_in',
  rent_deposit: 'rent_in',
  violation_deposit: 'deposit_in',
  damage: 'penalty_in',
  other: 'other_in'
};

/** 支付类型 → 资金流水的收支分类 */
export const PAYMENT_TXN_CATEGORY: Record<string, string> = {
  rent: 'rent',
  deposit: 'deposit',
  rent_deposit: 'rent',
  violation_deposit: 'deposit',
  damage: 'compensation',
  other: 'other'
};

/** 订单结算状态（台账「未结清」列，人工维护，不跟 paid_amount 自动联动） */
export const SETTLE_STATUS_TEXT: Record<string, string> = {
  unpaid: '未结清',
  partial: '部分结清',
  paid: '已结清'
};

/** 开票状态（台账「有无发票」列） */
export const INVOICE_STATUS_TEXT: Record<string, string> = {
  none: '无票',
  pending: '待开',
  issued: '已开'
};

/** 结算行状态 */
export const SETTLEMENT_LINE_STATUS_TEXT: Record<string, string> = {
  posted: '正常',
  void: '已作废'
};

/** 车主结算行的来源 */
export const SETTLEMENT_SOURCE_TYPE_TEXT: Record<string, string> = {
  order: '订单生成',
  manual: '手工补录',
  carryover: '期初结转'
};

/** 合伙人往来科目（台账 file-5 的「科目」列） */
export const ADVANCE_SUBJECT_TEXT: Record<string, string> = {
  setup: '开办费',
  advance: '垫资',
  loan: '借款',
  salary: '领工资',
  writeoff: '下账',
  reimburse: '报销',
  repay: '还款',
  other: '其他'
};

/** 结算付款类型（台账底部支出区的「结车款」） */
export const PAYOUT_TYPE_TEXT: Record<string, string> = {
  settlement: '结车款',
  advance: '预付款',
  adjust: '调整'
};
