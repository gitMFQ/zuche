// 订单状态文本映射
export const ORDER_STATUS_TEXT_MAP: Record<string, string> = {
  pending: '待取车',
  active: '已取车',
  completed: '已还车',
  cancelled: '已取消',
  overdue: '已逾期'
}

// 订单来源平台映射（批量导入用）
export const PLATFORM_TEXT_MAP: Record<string, string> = {
  ctrip: '携程',
  self: '自有平台'
}

// 取还车配送方式映射
export const DELIVERY_TYPE_TEXT_MAP: Record<string, string> = {
  delivery: '送车上门',
  store: '到店取车'
}

// 取还车方式选项
export const DELIVERY_TYPE_OPTIONS = [
  { label: '送车上门', value: 'delivery' },
  { label: '到店取车', value: 'store' }
]

// 到店取车/还车都在门店完成，不需要具体地址，取还车位置统一记为门店
export const STORE_LOCATION_TEXT = '门店'

// 费用明细分类映射
export const FEE_CATEGORY_TEXT_MAP: Record<string, string> = {
  rent: '租金',
  service: '服务费',
  deposit: '押金',
  penalty: '违约金/扣款',
  extra: '附加费用',
  other: '其他'
}

// 支付方式选项
export const PAYMENT_METHOD_OPTIONS = [
  { label: '平台支付', value: 'platform' },
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '现金', value: 'cash' },
  { label: '银行卡', value: 'bank' },
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

// ==================== 财务 / 结算 ====================
// 与后端 src/lib/constants.ts 的同名映射保持一致，改动要两边同步。

// 车辆归属：自有 / 挂靠。挂靠车才有车主公司管理费
export const OWNERSHIP_TYPE_TEXT_MAP: Record<string, string> = {
  company: '自有',
  attached: '挂靠'
}

export const OWNERSHIP_TYPE_OPTIONS = [
  { label: '自有', value: 'company' },
  { label: '挂靠', value: 'attached' }
]

// 车型分类（台账「车辆档案」sheet 的车型列）
export const VEHICLE_CATEGORY_TEXT_MAP: Record<string, string> = {
  suv: 'SUV',
  sedan: '轿车',
  mpv: 'MPV',
  pickup: '皮卡',
  other: '其他'
}

export const VEHICLE_CATEGORY_OPTIONS = [
  { label: 'SUV', value: 'suv' },
  { label: '轿车', value: 'sedan' },
  { label: 'MPV', value: 'mpv' },
  { label: '皮卡', value: 'pickup' },
  { label: '其他', value: 'other' }
]

// 车主 / 合伙人身份
export const OWNER_ROLE_TEXT_MAP: Record<string, string> = {
  owner: '挂靠车主',
  partner: '合伙人',
  both: '车主兼合伙人'
}

export const OWNER_ROLE_OPTIONS = [
  { label: '挂靠车主', value: 'owner' },
  { label: '合伙人', value: 'partner' },
  { label: '车主兼合伙人', value: 'both' }
]

// 资金流水方向
export const FUND_DIRECTION_TEXT_MAP: Record<string, string> = {
  in: '收入',
  out: '支出'
}

export const FUND_DIRECTION_OPTIONS = [
  { label: '收入', value: 'in' },
  { label: '支出', value: 'out' }
]

// 资金流水的收支分类
export const FUND_CATEGORY_TEXT_MAP: Record<string, string> = {
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
}

// 资金流水来源类型
export const FUND_SOURCE_TYPE_TEXT_MAP: Record<string, string> = {
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
}

// 账户类型
export const ACCOUNT_TYPE_TEXT_MAP: Record<string, string> = {
  bank: '对公账户',
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  virtual: '虚拟账户'
}

export const ACCOUNT_TYPE_OPTIONS = [
  { label: '对公账户', value: 'bank' },
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '现金', value: 'cash' },
  { label: '虚拟账户', value: 'virtual' }
]

// 订单结算状态（台账「未结清」列，人工维护）
export const SETTLE_STATUS_TEXT_MAP: Record<string, string> = {
  unpaid: '未结清',
  partial: '部分结清',
  paid: '已结清'
}

export const SETTLE_STATUS_TAG_MAP: Record<string, string> = {
  unpaid: 'danger',
  partial: 'warning',
  paid: 'success'
}

export const SETTLE_STATUS_OPTIONS = [
  { label: '未结清', value: 'unpaid' },
  { label: '部分结清', value: 'partial' },
  { label: '已结清', value: 'paid' }
]

// 开票状态（台账「有无发票」列）
export const INVOICE_STATUS_TEXT_MAP: Record<string, string> = {
  none: '无票',
  pending: '待开',
  issued: '已开'
}

export const INVOICE_STATUS_OPTIONS = [
  { label: '无票', value: 'none' },
  { label: '待开', value: 'pending' },
  { label: '已开', value: 'issued' }
]

// 付款状态（车辆费用 / 运营开支台账的 is_paid 筛选）。
// 值是字符串 '1'/'0'：后端按 `is_paid === '0' || is_paid === '1'` 判定，
// 改成数字会让 `query.is_paid || undefined` 这类判空写法的行为变掉
export const PAID_STATUS_OPTIONS = [
  { label: '已付款', value: '1' },
  { label: '未付款', value: '0' }
]

// 结算行状态
export const SETTLEMENT_LINE_STATUS_TEXT_MAP: Record<string, string> = {
  posted: '正常',
  void: '已作废'
}

export const SETTLEMENT_LINE_STATUS_OPTIONS = [
  { label: '正常', value: 'posted' },
  { label: '已作废', value: 'void' }
]

// 结算行来源
export const SETTLEMENT_SOURCE_TYPE_TEXT_MAP: Record<string, string> = {
  order: '订单生成',
  manual: '手工补录',
  carryover: '期初结转'
}

// 合伙人往来科目（台账 file-5 的「科目」列）
export const ADVANCE_SUBJECT_TEXT_MAP: Record<string, string> = {
  setup: '开办费',
  advance: '垫资',
  loan: '借款',
  salary: '领工资',
  writeoff: '下账',
  reimburse: '报销',
  repay: '还款',
  other: '其他'
}

export const ADVANCE_SUBJECT_OPTIONS = [
  { label: '开办费', value: 'setup' },
  { label: '垫资', value: 'advance' },
  { label: '借款', value: 'loan' },
  { label: '领工资', value: 'salary' },
  { label: '下账', value: 'writeoff' },
  { label: '报销', value: 'reimburse' },
  { label: '还款', value: 'repay' },
  { label: '其他', value: 'other' }
]

// 往来方向
export const ADVANCE_DIRECTION_TEXT_MAP: Record<string, string> = {
  in: '公司应付增加',
  out: '已付合伙人'
}

// 结算付款类型
export const PAYOUT_TYPE_TEXT_MAP: Record<string, string> = {
  settlement: '结车款',
  advance: '预付款',
  adjust: '调整'
}

export const PAYOUT_TYPE_OPTIONS = [
  { label: '结车款', value: 'settlement' },
  { label: '预付款', value: 'advance' },
  { label: '调整', value: 'adjust' }
]

// ==================== 列表与表单下拉选项 ====================
// 下面这些原本是各组件模板里写死的 <el-option>；改成 AppSelect 后统一收在这里 ——
// 桌面端 el-select、移动端滚轮渲染的都是同一份数据。

// 车辆状态。表单是 4 项；车辆列表的筛选历史上只给前 3 项（筛不了「不可用」）——
// 这是既有口径，两个常量各自独立，别合并
export const VEHICLE_STATUS_OPTIONS = [
  { label: '可用', value: 'available' },
  { label: '已出租', value: 'rented' },
  { label: '维修中', value: 'maintenance' },
  { label: '不可用', value: 'unavailable' }
]

export const VEHICLE_STATUS_FILTER_OPTIONS = [
  { label: '可用', value: 'available' },
  { label: '已出租', value: 'rented' },
  { label: '维修中', value: 'maintenance' }
]

// 变速箱 / 动力类型 / 车身类型：这几个字段存的就是中文原文，label 与 value 相同
export const VEHICLE_TRANSMISSION_OPTIONS = [
  { label: '自动', value: '自动' },
  { label: '手动', value: '手动' }
]

export const VEHICLE_FUEL_TYPE_OPTIONS = [
  { label: '汽油', value: '汽油' },
  { label: '柴油', value: '柴油' },
  { label: '混动', value: '混动' },
  { label: '纯电', value: '纯电' }
]

export const VEHICLE_BODY_TYPE_OPTIONS = [
  { label: '轿车', value: '轿车' },
  { label: 'SUV', value: 'SUV' },
  { label: 'MPV', value: 'MPV' },
  { label: '皮卡', value: '皮卡' }
]

// 年检列表的筛选状态
export const INSPECTION_STATUS_OPTIONS = [
  { label: '有效', value: 'valid' },
  { label: '已过期', value: 'expired' },
  { label: '未登记', value: 'none' }
]

// 用户角色
export const USER_ROLE_OPTIONS = [
  { label: '管理员', value: 'admin' },
  { label: '员工', value: 'staff' }
]

// 订单列表排序（值会经 useQuerySync 写进 URL，不能改）
export const ORDER_SORT_OPTIONS = [
  { label: '取车时间↑', value: 'start_date_asc' },
  { label: '取车时间↓', value: 'start_date_desc' },
  { label: '还车时间↑', value: 'end_date_asc' },
  { label: '还车时间↓', value: 'end_date_desc' }
]
