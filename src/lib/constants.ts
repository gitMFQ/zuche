/**
 * 后端侧的枚举中文名。前端 utils/constants.ts 有一份同内容的映射，
 * 但 Worker 不能引前端代码，这里单独维护一份，改动时两边要同步。
 */

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
