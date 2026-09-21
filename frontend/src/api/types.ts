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
  id_card_images: string[]
  license_images: string[]
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
