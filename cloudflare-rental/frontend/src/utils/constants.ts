// 支付方式选项
export const PAYMENT_METHOD_OPTIONS = [
  { label: '平台支付', value: 'platform' },
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '现金', value: 'cash' },
  { label: '银行转账', value: 'bank' },
  { label: '其他', value: 'other' }
]

// 支付类型选项
export const PAYMENT_TYPE_OPTIONS = [
  { label: '租金', value: 'rent' },
  { label: '押金', value: 'deposit' },
  { label: '租金+押金', value: 'rent_deposit' },
  { label: '违章押金', value: 'violation_deposit' },
  { label: '车损', value: 'damage' },
  { label: '其他', value: 'other' }
]

// 订单状态类型映射
export const ORDER_STATUS_TYPE_MAP: Record<string, string> = {
  pending: 'warning',
  active: 'primary',
  completed: 'success',
  cancelled: 'info',
  overdue: 'danger'
}

// 支付方式文本映射
export const PAYMENT_METHOD_TEXT_MAP: Record<string, string> = {
  platform: '平台支付',
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  bank: '银行卡',
  other: '其他'
}

// 支付类型文本映射
export const PAYMENT_TYPE_TEXT_MAP: Record<string, string> = {
  rental: '租金',
  rent: '租金',
  deposit: '押金',
  rent_deposit: '租金+押金',
  violation_deposit: '违章押金',
  damage: '车损',
  other: '其他'
}

// 服务类型文本映射
export const SERVICE_TYPE_TEXT_MAP: Record<string, string> = {
  basic: '基础',
  premium: '优享',
  vip: '尊享'
}

// 服务类型标签颜色映射
export const SERVICE_TYPE_TAG_MAP: Record<string, string> = {
  basic: '',
  premium: 'warning',
  vip: 'danger'
}
