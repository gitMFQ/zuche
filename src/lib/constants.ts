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
