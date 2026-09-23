/**
 * 各表的行类型。D1 返回的是 unknown，这里统一声明，
 * 让 controller 层不需要 `as any` 就能拿到字段。
 */

export interface UserRow {
  id: string;
  username: string;
  password: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  status: number;
  created_at: string;
  updated_at: string;
  /** 令牌版本：改密码/禁用/删除时自增，使已签发的 JWT 立即失效 */
  token_version: number;
  /** 首次登录强制改密标记（seed 的 admin 默认口令是公开的） */
  must_change_password: number | null;
}

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  id_card: string | null;
  license_number: string | null;
  license_expiry: string | null;
  address: string | null;
  remarks: string | null;
  status: number;
  created_at: string;
  updated_at: string;
  id_card_images: string | null;
  license_images: string | null;
  is_regular: number;
  source_id: string | null;
  source_name: string | null;
}

export interface VehicleRow {
  id: string;
  plate_number: string;
  brand: string;
  model: string;
  color: string | null;
  year: number | null;
  seats: number;
  daily_rate: number;
  deposit: number;
  status: string;
  mileage: number;
  last_maintenance: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  vin: string | null;
  engine_number: string | null;
  license_images: string | null;
  registration_image: string | null;
  is_new_energy: number;
  transmission: string | null;
  fuel_type: string | null;
  body_type: string | null;
  doors: number | null;
  /** 车辆编号（台账里的 01-18 两位序号），可空但填了必须唯一 */
  vehicle_no: string | null;
  /** 车型分类：SUV / sedan 轿车 / MPV / pickup 皮卡。与 body_type（携程车型串解析结果）用途不同 */
  category: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  /** 购入时表显里程；单车月报算里程差用 mileage − initial_mileage */
  initial_mileage: number | null;
  /** 车主 id（软引用 owners.id，无外键） */
  owner_id: string | null;
  /** company 自有 / attached 挂靠 */
  ownership_type: string;
  /** 月供（车贷） */
  monthly_payment: number;
  loan_total: number | null;
  loan_terms: number | null;
  loan_start_date: string | null;
  /** 月供扣款账户（软引用 fund_accounts.id，无外键） */
  loan_account_id: string | null;
}

export interface OrderRow {
  id: string;
  order_no: string;
  customer_id: string;
  vehicle_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  actual_end_date: string | null;
  daily_rate: number;
  deposit: number;
  total_amount: number;
  paid_amount: number;
  status: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  source_id: string | null;
  source_name: string | null;
  commission_rate: number;
  net_amount: number | null;
  service_type: string;
  deposit_waived: number;
  deposit_waived_expiry: string | null;
  pickup_mileage: number | null;
  return_mileage: number | null;
  pickup_image: string | null;
  return_image: string | null;
  contract_number: string | null;
  pickup_location: string | null;
  return_location: string | null;
  platform: string | null;
  external_no: string | null;
  import_batch_id: string | null;
  actual_start_date: string | null;
  violation_deposit: number;
  cancel_reason: string | null;
  cancelled_at: string | null;
  delivery_type: string | null;
  pickup_driver_id: string | null;
  pickup_driver_name: string | null;
  return_driver_id: string | null;
  return_driver_name: string | null;
  booked_model: string | null;
  /** 车牌快照：orders.vehicle_id 无外键，删车后靠它保留可读的车牌 */
  plate_number: string | null;
  /** 开票金额。常大于 total_amount（含税含服务费），不能由总额推导 */
  invoice_amount: number;
  /** none 未开 / pending 待开 / issued 已开 */
  invoice_status: string;
  /** unpaid 未结清 / partial 部分 / paid 已付。人工枚举，不跟 paid_amount 自动联动 */
  settle_status: string;
  settle_remarks: string | null;
}

export interface OrderFeeRow {
  id: string;
  order_id: string;
  fee_category: string;
  fee_name: string;
  receivable: number;
  received: number;
  refunded: number;
  platform: string | null;
  created_at: string;
}

export interface OrderExtensionRow {
  id: string;
  order_id: string;
  original_end_date: string;
  new_end_date: string;
  extend_days: number;
  extend_amount: number;
  payment_method: string | null;
  operator_id: string | null;
  remarks: string | null;
  created_at: string;
}

export interface ImportBatchRow {
  id: string;
  platform: string;
  filename: string | null;
  total_rows: number;
  success_rows: number;
  skipped_rows: number;
  failed_rows: number;
  new_customers: number;
  new_vehicles: number;
  operator_id: string | null;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  order_id: string;
  amount: number;
  payment_method: string;
  payment_type: string;
  remarks: string | null;
  created_at: string;
}

export interface ViolationRow {
  id: string;
  order_id: string | null;
  vehicle_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  plate_number: string;
  violation_type: string;
  violation_date: string;
  location: string | null;
  fine_amount: number;
  penalty_points: number;
  images: string | null;
  status: string;
  handle_date: string | null;
  handle_remarks: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  penalty_fee: number;
  collected_penalty: number;
  collected_fine: number;
  fee_remarks: string | null;
  handle_type: string;
  license_deposit: number;
}

export interface BlacklistRow {
  id: string;
  customer_id: string | null;
  name: string;
  phone: string;
  id_card: string | null;
  reason: string;
  order_id: string | null;
  operator_id: string | null;
  operator_name: string | null;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface OrderSourceRow {
  id: string;
  name: string;
  commission_rate: number;
  color: string;
  remarks: string | null;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRow {
  id: string;
  vehicle_id: string;
  plate_number: string;
  type: string;
  maintenance_date: string;
  cost: number;
  mileage: number;
  garage: string | null;
  next_maintenance_date: string | null;
  next_maintenance_mileage: number | null;
  remarks: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  images: string | null;
}

export interface InsuranceRow {
  id: string;
  vehicle_id: string;
  plate_number: string;
  insurance_type: string;
  insurance_company: string;
  policy_number: string | null;
  start_date: string;
  end_date: string;
  premium: number;
  coverage_amount: number;
  beneficiary: string | null;
  remarks: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  documents: string | null;
}

export interface InspectionRow {
  id: string;
  vehicle_id: string;
  plate_number: string;
  expiry_date: string;
  certificate_image: string | null;
  remarks: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SettingRow {
  key: string;
  value: string | null;
  updated_at: string;
}

export interface OperationLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

// ==================== 财务 / 结算 ====================

/** 车主档案。一个实体两种角色：既可能是挂靠车的车主，也可能在公司有往来垫付 */
export interface OwnerRow {
  id: string;
  name: string;
  phone: string | null;
  id_card: string | null;
  /** owner 挂靠车主 / partner 合伙人 / both 两者兼具 */
  role: string;
  /** 公司管理费率（%）。捷途 15 / 雅阁 10 / 自营 0，按车主配 */
  company_fee_rate: number;
  bank_name: string | null;
  bank_account: string | null;
  /** 往来期初余额（正数 = 公司应付此人） */
  opening_balance: number;
  opening_date: string | null;
  status: number;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface FundAccountRow {
  id: string;
  name: string;
  /** bank / wechat / alipay / cash / virtual */
  account_type: string;
  /** 映射 payments.payment_method；为空表示不参与自动映射 */
  method_key: string | null;
  opening_balance: number;
  opening_date: string;
  is_active: number;
  sort_order: number;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

/** 资金流水。amount 恒为正，方向由 direction 表达；余额是派生值，不落库 */
export interface FundTransactionRow {
  id: string;
  account_id: string;
  txn_date: string;
  direction: string;
  amount: number;
  category: string | null;
  source_type: string;
  source_id: string | null;
  source_kind: string;
  counterparty: string | null;
  summary: string;
  /** posted 已入账 / reversed 已冲销 */
  status: string;
  reverses_id: string | null;
  reversed_by_id: string | null;
  operator_id: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface FundTransferRow {
  id: string;
  transfer_date: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  remarks: string | null;
  operator_id: string | null;
  created_at: string;
}

export interface FinancePeriodLockRow {
  period: string;
  locked_at: string;
  locked_by: string | null;
  remarks: string | null;
}

/**
 * 车主结算行。金额分两组：
 * calc_* 是系统算出来的（每次重算都更新），其余是最终值（amount_overridden=1 时不再被覆盖）。
 */
export interface SettlementLineRow {
  id: string;
  owner_id: string;
  vehicle_id: string | null;
  order_id: string | null;
  period: string;
  line_date: string;
  order_no: string | null;
  plate_number: string | null;
  source_id_ref: string | null;
  source_name: string | null;
  customer_name: string | null;
  start_date: string | null;
  end_date: string | null;
  days: number;
  unit_price: number;
  calc_total_amount: number;
  calc_platform_rate: number;
  calc_platform_fee: number;
  calc_settlement_amount: number;
  calc_company_rate: number;
  calc_company_fee: number;
  calc_owner_amount: number;
  total_amount: number;
  platform_fee: number;
  settlement_amount: number;
  company_fee: number;
  other_fee: number;
  owner_amount: number;
  amount_overridden: number;
  override_note: string | null;
  source_type: string;
  source_id: string | null;
  line_kind: string;
  status: string;
  voided_reason: string | null;
  remarks: string | null;
  operator_id: string | null;
  created_at: string;
  updated_at: string;
}

/** 车辆/车主年初结转（台账里的「2024年余额 5387」） */
export interface SettlementOpeningRow {
  id: string;
  owner_id: string;
  vehicle_id: string | null;
  /** owner_id || ':' || COALESCE(vehicle_id,'')，用于绕开 SQLite 里 NULL 互不相等的唯一约束问题 */
  owner_vehicle_key: string;
  fiscal_year: number;
  amount: number;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

/** 结算付款（台账底部的支出区：结车款 / 预付车款），每条会产生一条 out 流水 */
export interface SettlementPayoutRow {
  id: string;
  owner_id: string;
  vehicle_id: string | null;
  period: string;
  payout_type: string;
  amount: number;
  account_id: string;
  paid_at: string;
  remarks: string | null;
  operator_id: string | null;
  created_at: string;
}

export interface ExpenseCategoryRow {
  id: string;
  name: string;
  sort_order: number;
  is_active: number;
  created_at: string;
}

export interface VehicleExpenseTypeRow {
  id: string;
  name: string;
  sort_order: number;
  /** expense / income / both */
  default_direction: string;
  is_active: number;
  created_at: string;
}

/** 车辆费用台账。收支双列：同一行可以同时有收入和支出（台账 2026.4.13 违章行） */
export interface VehicleExpenseRow {
  id: string;
  vehicle_id: string;
  plate_number: string | null;
  owner_id: string | null;
  expense_date: string;
  expense_type: string;
  expense_type_name: string;
  income_amount: number;
  expense_amount: number;
  /** none 无票 / pending 待开 / issued 已开 */
  invoice_status: string;
  invoice_no: string | null;
  /** 只有已付款的行才写资金流水 */
  is_paid: number;
  paid_at: string | null;
  account_id: string | null;
  /** 年费按 N 个月分摊进单车月报；1 = 现金口径 */
  amortize_months: number;
  amount_overridden: number;
  source_type: string | null;
  source_id: string | null;
  source_kind: string;
  remarks: string | null;
  images: string | null;
  operator_id: string | null;
  created_at: string;
  updated_at: string;
}

/** 运营开支台账（台账 4 的 27 类项目） */
export interface OperatingExpenseRow {
  id: string;
  expense_date: string;
  category: string;
  category_name: string;
  amount: number;
  account_id: string | null;
  is_paid: number;
  paid_at: string | null;
  invoice_status: string;
  invoice_no: string | null;
  payee: string | null;
  remarks: string | null;
  operator_id: string | null;
  created_at: string;
  updated_at: string;
}

/** 合伙人往来账（台账 file-5） */
export interface PartnerAdvanceRow {
  id: string;
  owner_id: string;
  advance_date: string;
  /** setup 开办费 / advance 垫资 / loan 借款 / salary 领工资 / writeoff 下账 / reimburse 报销 / repay 还款 / other */
  subject: string;
  subject_name: string;
  amount: number;
  /** in 公司应付增加 / out 已付给合伙人 */
  direction: string;
  is_paid: number;
  paid_at: string | null;
  account_id: string | null;
  remarks: string | null;
  operator_id: string | null;
  created_at: string;
  updated_at: string;
}
