/**
 * 前端侧的接口类型。
 *
 * 字段与后端 src/db/rows.ts 的行类型一一对应（后端返回的是行 + 若干 JOIN 出来的
 * 冗余字段），改动时两边要一起改。之前整个 API 层是 `params?: any` /
 * `data: any`，调用方一律 `const res: any`，等于完全放弃了类型检查；
 * 这里先把「响应信封 + 分页 + 各实体的列表/详情」定下来。
 */

/** 后端统一响应体，与 src/types.ts 的 ApiResponse 对齐 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  /**
   * 业务错误码。带 code 的错误由调用方自己处理（例如 BLACKLISTED 需要二次确认），
   * axios 拦截器不会重复弹提示。
   */
  code?: string
}

/** queryWithPagination 的返回结构 */
export interface PageResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** 分页 + 关键词的基础查询参数 */
export interface PageQuery {
  page?: number
  pageSize?: number
  keyword?: string
}

/**
 * 列表页的 status 筛选。
 * 表单里是字符串（el-select 的 value 与空串），后端会把 query 参数 Number() 之后再绑定，
 * 两种情况都能接受，因此这里如实写成联合类型而不是硬要求 number。
 */
export type StatusFilter = number | string

// ==================== 订单 ====================

export type OrderStatus = 'pending' | 'active' | 'completed' | 'cancelled'

export interface OrderListItem {
  id: string
  order_no: string
  status: OrderStatus
  status_text: string
  customer_id: string
  vehicle_id: string
  user_id: string
  start_date: string
  end_date: string
  actual_start_date: string | null
  actual_end_date: string | null
  daily_rate: number
  deposit: number
  violation_deposit: number
  total_amount: number
  paid_amount: number
  pickup_mileage: number | null
  return_mileage: number | null
  pickup_location: string | null
  return_location: string | null
  service_type: string
  deposit_waived: number
  deposit_waived_expiry: string | null
  contract_number: string | null
  source_id: string | null
  source_name: string | null
  source_color: string | null
  commission_rate: number
  net_amount: number | null
  remarks: string | null
  platform: string | null
  external_no: string | null
  import_batch_id: string | null
  cancel_reason: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  /** LEFT JOIN 出来的展示字段 */
  customer_name: string | null
  customer_phone: string | null
  plate_number: string | null
  brand: string | null
  model: string | null
  is_new_energy: number | null
  operator_name: string | null
}

export interface OrderQuery extends PageQuery {
  status?: string
  customer_id?: string
  vehicle_id?: string
  start_date_from?: string
  start_date_to?: string
  end_date_from?: string
  end_date_to?: string
  source_id?: string
  vehicle_model?: string
  plate_number?: string
  order_by?: string
  /** 时间快捷筛选：overdue / today / tomorrow / day_after */
  time_filter?: string
}

/** 订单统计：状态分桶 + 时间快捷筛选分桶 */
export interface OrderStats {
  pending: number
  active: number
  completed: number
  cancelled: number
  timeFilter: {
    pending: TimeFilterCounts
    active: TimeFilterCounts
  }
}

export interface TimeFilterCounts {
  overdue: number
  today: number
  tomorrow: number
  day_after: number
}

export interface PaymentRecord {
  id: string
  order_id: string
  amount: number
  payment_method: string
  payment_type: string
  remarks: string | null
  created_at: string
}

export interface OrderFeeRecord {
  id: string
  order_id: string
  fee_category: string
  fee_name: string
  receivable: number
  received: number
  refunded: number
  created_at: string
}

export interface OrderExtensionRecord {
  id: string
  order_id: string
  original_end_date: string
  new_end_date: string
  extend_days: number
  extend_amount: number
  payment_method: string | null
  remarks: string | null
  created_at: string
}

export interface OrderDetail extends OrderListItem {
  id_card: string | null
  license_number: string | null
  id_card_images: string[]
  license_images: string[]
  color: string | null
  payments: PaymentRecord[]
  fees: OrderFeeRecord[]
  extensions: OrderExtensionRecord[]
}

// ==================== 客户 ====================

export interface CustomerItem {
  id: string
  name: string
  phone: string
  id_card: string | null
  license_number: string | null
  license_expiry: string | null
  address: string | null
  remarks: string | null
  status: number
  is_regular: number
  source_id: string | null
  source_name: string | null
  /** LEFT JOIN order_sources 带出的标签色 */
  source_color: string | null
  id_card_images: string[]
  license_images: string[]
  created_at: string
  updated_at: string
}

/** 黑名单记录，与后端 src/db/rows.ts 的 BlacklistRow 对应 */
export interface BlacklistItem {
  id: string
  customer_id: string | null
  name: string
  phone: string
  id_card: string | null
  reason: string
  order_id: string | null
  operator_id: string | null
  operator_name: string | null
  status: number
  created_at: string
  updated_at: string
}

// ==================== 车辆 ====================

export interface VehicleItem {
  id: string
  plate_number: string
  brand: string
  model: string
  color: string | null
  year: number | null
  seats: number
  daily_rate: number
  deposit: number
  /** 库里存的人工状态：available / maintenance / unavailable */
  status: string
  /** 派生状态：available / rented（由订单占用情况算出，见后端 lib/vehicles.ts） */
  actual_status?: 'available' | 'rented'
  status_text: string
  mileage: number
  last_maintenance: string | null
  vin: string | null
  engine_number: string | null
  license_images: string[]
  registration_image: string | null
  is_new_energy: number
  transmission: string | null
  fuel_type: string | null
  body_type: string | null
  doors: number | null
  remarks: string | null
  created_at: string
  updated_at: string
}

export interface VehicleOption {
  id: string
  plate_number: string
  brand: string
  model: string
  color: string | null
  daily_rate: number
  deposit: number
  status: string
}

/** 车辆筛选下拉的去重选项 */
export interface VehicleFilterOptions {
  plateNumbers: string[]
  models: string[]
}

// ==================== 用户 ====================

export interface UserItem {
  id: string
  username: string
  name: string
  role: 'admin' | 'staff'
  phone: string | null
  email: string | null
  status: number
  created_at: string
}

/** 司机指派等选人场景用的精简选项 */
export interface UserOption {
  id: string
  name: string
}

export interface LoginResult {
  token: string
  user: {
    id: string
    username: string
    name: string
    role: string
    phone: string | null
    email: string | null
  }
  must_change_password: boolean
}

// ==================== 订单来源 ====================

export interface OrderSourceItem {
  id: string
  name: string
  commission_rate: number
  color: string
  remarks: string | null
  status: number
  created_at: string
  updated_at: string
}

// ==================== 上传 ====================

export interface UploadResult {
  filename: string
  url: string
  type?: string
}

// ==================== 财务 / 结算 ====================
// 与后端 src/db/rows.ts 的行类型对应

/** 车主 / 合伙人 */
export interface OwnerItem {
  id: string
  name: string
  phone: string | null
  id_card: string | null
  /** owner 挂靠车主 / partner 合伙人 / both 两者兼具 */
  role: string
  /** 公司管理费率（%）。捷途 15 / 雅阁 10 / 自营 0 */
  company_fee_rate: number
  bank_name: string | null
  bank_account: string | null
  opening_balance: number
  opening_date: string | null
  status: number
  remarks: string | null
  created_at: string
  updated_at: string
  /** 车辆数（列表接口带出） */
  vehicle_count?: number
  /** 车主结算应付余额（正数 = 公司应付车主） */
  balance?: number
  /** 合伙人往来应付余额 */
  advance_balance?: number
}

export interface OwnerOption {
  id: string
  name: string
  role: string
  company_fee_rate: number
}

export interface FundAccountItem {
  id: string
  name: string
  /** bank / wechat / alipay / cash / virtual */
  account_type: string
  method_key: string | null
  opening_balance: number
  opening_date: string
  is_active: number
  sort_order: number
  remarks: string | null
  created_at: string
  updated_at: string
  /** 余额 = 期初 + 全部流水收支（派生值，库里不存） */
  balance: number
}

export interface FundTransactionItem {
  id: string
  account_id: string
  account_name?: string
  txn_date: string
  /** in 收入 / out 支出。amount 恒为正 */
  direction: string
  amount: number
  category: string | null
  source_type: string
  source_id: string | null
  source_kind: string
  counterparty: string | null
  summary: string
  /** posted 已入账 / reversed 已冲销 */
  status: string
  reverses_id: string | null
  reversed_by_id: string | null
  operator_id: string | null
  operator_name?: string
  remarks: string | null
  created_at: string
  updated_at: string
  /** 逐行余额。仅当筛选到单一账户且未隐藏冲销行时返回 */
  balance?: number
}

export interface FundTransferItem {
  id: string
  transfer_date: string
  from_account_id: string
  to_account_id: string
  from_account_name?: string
  to_account_name?: string
  amount: number
  remarks: string | null
  operator_id: string | null
  created_at: string
}

export interface FinancePeriodLockItem {
  period: string
  locked_at: string
  locked_by: string | null
  remarks: string | null
}

export interface FundSummary {
  period: string
  accounts: FundAccountItem[]
  total: number
  period_income: number
  period_expense: number
  /** 「待归属」账户。有余额说明有流水没配上账户，需要人工改归属 */
  holding_account: FundAccountItem | null
}

export interface SettlementLineItem {
  id: string
  owner_id: string
  owner_name?: string
  vehicle_id: string | null
  vehicle_plate?: string | null
  order_id: string | null
  period: string
  line_date: string
  order_no: string | null
  plate_number: string | null
  source_id_ref: string | null
  source_name: string | null
  customer_name: string | null
  start_date: string | null
  end_date: string | null
  days: number
  unit_price: number
  calc_total_amount: number
  calc_platform_rate: number
  calc_platform_fee: number
  calc_settlement_amount: number
  calc_company_rate: number
  calc_company_fee: number
  calc_owner_amount: number
  total_amount: number
  platform_fee: number
  settlement_amount: number
  company_fee: number
  other_fee: number
  owner_amount: number
  amount_overridden: number
  override_note: string | null
  source_type: string
  source_id: string | null
  line_kind: string
  status: string
  voided_reason: string | null
  remarks: string | null
  operator_id: string | null
  created_at: string
  updated_at: string
}

export interface SettlementTotals {
  total_amount: number
  platform_fee: number
  settlement_amount: number
  company_fee: number
  other_fee: number
  owner_amount: number
  days: number
  count: number
}

export interface SettlementOpeningItem {
  id: string
  owner_id: string
  owner_name?: string
  vehicle_id: string | null
  plate_number?: string | null
  owner_vehicle_key: string
  fiscal_year: number
  amount: number
  remarks: string | null
  created_at: string
  updated_at: string
}

export interface SettlementPayoutItem {
  id: string
  owner_id: string
  owner_name?: string
  vehicle_id: string | null
  plate_number?: string | null
  period: string
  payout_type: string
  amount: number
  account_id: string
  account_name?: string
  paid_at: string
  remarks: string | null
  operator_id: string | null
  created_at: string
}

/** 车主对账单 */
export interface OwnerStatement {
  owner: OwnerItem
  period: string
  opening: number
  lines: SettlementLineItem[]
  voided_lines: SettlementLineItem[]
  expenses: VehicleExpenseItem[]
  payouts: SettlementPayoutItem[]
  by_vehicle: Array<{ vehicle_id: string | null; plate_number: string | null; amount: number; count: number }>
  summary: {
    opening: number
    ownerAmountSum: number
    ownerExpenseSum: number
    payoutSum: number
    closing: number
  }
}

export interface VehicleExpenseItem {
  id: string
  vehicle_id: string
  plate_number: string | null
  owner_id: string | null
  expense_date: string
  expense_type: string
  expense_type_name: string
  /** 收入侧：车损赔偿 / 停运费 */
  income_amount: number
  /** 支出侧：维修 / 保养 / 罚款 / 洗车 / 过路费 */
  expense_amount: number
  invoice_status: string
  invoice_no: string | null
  is_paid: number
  paid_at: string | null
  account_id: string | null
  /** 年费按 N 个月分摊进单车月报 */
  amortize_months: number
  amount_overridden: number
  /** maintenance / insurance / violation / manual */
  source_type: string | null
  source_id: string | null
  source_kind: string
  remarks: string | null
  images: string | null
  operator_id: string | null
  created_at: string
  updated_at: string
}

export interface VehicleExpenseTotals {
  income_total: number
  expense_total: number
  /** 未付款的收支分列：纯收入行合成净额会出现负的「应付」 */
  unpaid_income: number
  unpaid_expense: number
  count: number
}

export interface OperatingExpenseItem {
  id: string
  expense_date: string
  category: string
  category_name: string
  amount: number
  account_id: string | null
  is_paid: number
  paid_at: string | null
  invoice_status: string
  invoice_no: string | null
  payee: string | null
  remarks: string | null
  operator_id: string | null
  created_at: string
  updated_at: string
}

export interface OperatingExpenseTotals {
  total: number
  paid_total: number
  unpaid_total: number
  count: number
}

export interface PartnerAdvanceItem {
  id: string
  owner_id: string
  advance_date: string
  subject: string
  subject_name: string
  amount: number
  /** in 公司应付增加 / out 已付合伙人 */
  direction: string
  is_paid: number
  paid_at: string | null
  account_id: string | null
  remarks: string | null
  operator_id: string | null
  created_at: string
  updated_at: string
}

export interface ExpenseCategoryItem {
  id: string
  name: string
  sort_order: number
  is_active: number
  created_at: string
}

export interface VehicleExpenseTypeItem {
  id: string
  name: string
  sort_order: number
  default_direction: string
  is_active: number
  created_at: string
}

export interface AccountOption {
  id: string
  name: string
  account_type: string
}

/** 财务基础数据，首屏一次拉完 */
export interface FinanceDicts {
  accounts: AccountOption[]
  expense_categories: ExpenseCategoryItem[]
  vehicle_expense_types: VehicleExpenseTypeItem[]
  owners: OwnerOption[]
  invoice_status_text: Record<string, string>
}

// -------------------- 报表 --------------------

export interface VehicleMonthlyRow {
  vehicle_id: string
  plate_number: string
  vehicle_no: string | null
  owner_name: string | null
  monthly_payment: number
  owner_amount: number
  settlement_amount: number
  company_fee: number
  days: number
  line_count: number
  maintenance: number
  repair: number
  other_expense: number
  balance: number
}

export interface VehicleMonthlyReport {
  period: string
  rows: VehicleMonthlyRow[]
  totals: {
    owner_amount: number
    monthly_payment: number
    maintenance: number
    repair: number
    other_expense: number
    balance: number
    days: number
  }
}

export interface VehicleRankingRow {
  vehicle_id: string
  plate_number: string | null
  vehicle_no: string | null
  owner_name: string | null
  owner_amount: number
  settlement_amount: number
  company_fee: number
  days: number
  line_count: number
  expense: number
  profit: number
}

export interface CompanyMonthlyReport {
  period: string
  revenue: {
    total_amount: number
    platform_fee: number
    settlement_amount: number
    company_income: number
    company_fee: number
    other_fee: number
    owner_amount: number
    days: number
    line_count: number
  }
  cost: {
    vehicle_maintenance: number
    vehicle_repair: number
    vehicle_other: number
    vehicle_income: number
    vehicle_total: number
    operating: number
    operating_unpaid: number
    monthly_loan: number
    monthly_loan_attached: number
    settlement_payout: number
    total: number
  }
  profit: number
  fund_flow: Array<{ month: string; income: number; expense: number }>
}

export interface FundFlowReport {
  start_date: string
  end_date: string
  granularity: 'day' | 'month'
  opening: number
  rows: Array<{ bucket: string; income: number; expense: number; count: number; balance: number }>
  summary: { income: number; expense: number; closing: number }
}

export interface OwnerStatementReport {
  owner: OwnerItem
  start_period: string
  end_period: string
  opening: number
  lines: SettlementLineItem[]
  expenses: VehicleExpenseItem[]
  payouts: SettlementPayoutItem[]
  summary: {
    opening: number
    ownerAmountSum: number
    ownerExpenseSum: number
    payoutSum: number
    closing: number
  }
}
