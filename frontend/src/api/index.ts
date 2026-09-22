import axios from 'axios'
import { ElMessage } from 'element-plus'
import { compressImage } from '../utils/image'
import { validateUploadFile } from '../utils/upload'
import type {
  ApiResponse,
  BlacklistItem,
  CustomerItem,
  LoginResult,
  OrderDetail,
  OrderListItem,
  OrderQuery,
  OrderSourceItem,
  OrderStats,
  OrderStatus,
  PageQuery,
  PageResult,
  StatusFilter,
  UploadResult,
  UserItem,
  UserOption,
  VehicleFilterOptions,
  VehicleItem,
  VehicleOption
} from './types'

export type * from './types'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const payload = error.response?.data
    const message = payload?.message || '网络错误'
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      ElMessage.error('登录已过期，请重新登录')
    } else if (!payload?.code) {
      // 带业务 code 的错误由调用方自己处理（如黑名单二次确认），
      // 这里不再弹一次，避免同一个错误弹两个提示
      ElMessage.error(message)
    }
    
    return Promise.reject(error)
  }
)

/**
 * 类型化的请求辅助。
 *
 * 响应拦截器返回的是 response.data（即后端响应体本身），但 axios 的类型签名
 * 仍然声称返回 AxiosResponse，所以这里统一断言一次，让各 API 方法可以
 * 直接声明业务返回类型。
 */
function get<T>(url: string, params?: Record<string, unknown> | PageQuery): Promise<ApiResponse<T>> {
  return api.get(url, { params }) as unknown as Promise<ApiResponse<T>>
}

function post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
  return api.post(url, data) as unknown as Promise<ApiResponse<T>>
}

function put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
  return api.put(url, data) as unknown as Promise<ApiResponse<T>>
}

function del<T>(url: string): Promise<ApiResponse<T>> {
  return api.delete(url) as unknown as Promise<ApiResponse<T>>
}

// ==================== 认证 API ====================
export const authApi = {
  login: (data: { username: string; password: string }) => post<LoginResult>('/auth/login', data),
  getCurrentUser: () => get<UserItem & { must_change_password?: boolean }>('/auth/me'),
  /** 改密会吊销旧 token 并回传新 token，调用方必须替换本地 token */
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    put<{ token: string }>('/auth/password', data),
  logout: () => post<null>('/auth/logout')
}

// ==================== 用户管理 API ====================
export const userApi = {
  getList: (params?: PageQuery & { role?: string; status?: StatusFilter }) =>
    get<PageResult<UserItem>>('/users', params),
  // 只含 id/name，供司机指派等选人场景使用（员工也需要，/users 是管理员专属）
  getOptions: () => get<UserOption[]>('/users/options'),
  create: (data: { username: string; password: string; name: string; role?: string; phone?: string; email?: string }) =>
    post<{ id: string }>('/users', data),
  update: (id: string, data: { name?: string; role?: string; phone?: string; email?: string; status?: number }) =>
    put<null>(`/users/${id}`, data),
  delete: (id: string) => del<null>(`/users/${id}`),
  resetPassword: (id: string, newPassword: string) =>
    put<null>(`/users/${id}/reset-password`, { newPassword })
}

// ==================== 客户管理 API ====================
export const customerApi = {
  getList: (params?: PageQuery & { source_id?: string; is_regular?: number }) =>
    get<PageResult<CustomerItem>>('/customers', params),
  getRegular: () => get<CustomerItem[]>('/customers/regular'),
  create: (data: Record<string, unknown>) => post<{ id: string }>('/customers', data),
  update: (id: string, data: Record<string, unknown>) => put<null>(`/customers/${id}`, data),
  setRegular: (id: string, isRegular: boolean) => put<null>(`/customers/${id}/regular`, { is_regular: isRegular }),
  delete: (id: string) => del<null>(`/customers/${id}`)
}

// ==================== 车辆管理 API ====================
export const vehicleApi = {
  getList: (params?: PageQuery & { status?: string; brand?: string }) =>
    get<PageResult<VehicleItem>>('/vehicles', params),
  getAvailable: (params?: { start_date?: string; end_date?: string; exclude_order_id?: string }) =>
    get<VehicleOption[]>('/vehicles/available', params),
  // 筛选下拉用的去重选项（车牌号 / 车型），避免拉全量车辆再在前端去重
  getFilterOptions: () => get<VehicleFilterOptions>('/vehicles/options'),
  create: (data: Record<string, unknown>) => post<{ id: string }>('/vehicles', data),
  update: (id: string, data: Record<string, unknown>) => put<null>(`/vehicles/${id}`, data),
  delete: (id: string) => del<null>(`/vehicles/${id}`)
}

// ==================== 订单管理 API ====================
export const orderApi = {
  getList: (params?: OrderQuery) => get<PageResult<OrderListItem>>('/orders', params),
  // 各状态数量 + 时间快捷筛选数量，一条聚合查询（替代前端拉全量表自己数）
  getStats: () => get<OrderStats>('/orders/stats'),
  getOne: (id: string) => get<OrderDetail>(`/orders/${id}`),
  create: (data: Record<string, unknown>) => post<{ id: string; order_no: string }>('/orders', data),
  update: (id: string, data: Record<string, unknown>) => put<null>(`/orders/${id}`, data),
  extend: (
    id: string,
    data: { new_end_date: string; extend_amount?: number; has_payment?: boolean; payment_amount?: number; payment_method?: string }
  ) => put<{ extend_days: number; new_total_amount: number }>(`/orders/${id}/extend`, data),
  updateStatus: (
    id: string,
    data: {
      status: OrderStatus
      actual_start_date?: string
      actual_end_date?: string
      remarks?: string
      pickup_mileage?: number
      return_mileage?: number
      pickup_image?: string
      return_image?: string
    }
  ) => put<{ status: string; total_amount: number; net_amount: number }>(`/orders/${id}/status`, data),
  addPayment: (id: string, data: { amount: number; payment_method: string; payment_type: string; remarks?: string }) =>
    post<null>(`/orders/${id}/payments`, data),
  cancel: (id: string, remarks?: string) => put<null>(`/orders/${id}/cancel`, { remarks }),
  delete: (id: string) => del<null>(`/orders/${id}`),
  assignDrivers: (id: string, data: { pickup_driver_id?: string | null; return_driver_id?: string | null }) =>
    put<null>(`/orders/${id}/drivers`, data)
}

// ==================== 订单导入 API ====================
export const importApi = {
  preview: (data: { platform?: string; headers: string[]; rows: (string | null)[][] }) =>
    post<{ platform: string; rows: unknown[]; summary: Record<string, number> }>('/orders/import/preview', data),
  commit: (data: {
    platform?: string
    headers: string[]
    rows: (string | null)[][]
    filename?: string
    overrides?: { rowIndex: number; customer_phone?: string; skip?: boolean }[]
    default_source_id?: string | null
  }) => post<{ batchId: string }>('/orders/import', data),
  batches: () => get<unknown[]>('/orders/import/batches'),
  rollback: (id: string) => del<null>(`/orders/import/batches/${id}`)
}

// ==================== 违章管理 API ====================
export const violationApi = {
  getList: (params?: PageQuery & { status?: string; vehicle_id?: string }) =>
    get<PageResult<Record<string, unknown>>>('/violations', params),
  getStats: () => get<{ pending: number; processing: number; completed: number; pendingFines: number }>('/violations/stats'),
  create: (data: Record<string, unknown>) => post<{ id: string }>('/violations', data),
  update: (id: string, data: Record<string, unknown>) => put<null>(`/violations/${id}`, data),
  handle: (id: string, data: { status: string; handle_remarks?: string }) =>
    put<null>(`/violations/${id}/handle`, data),
  collectFee: (id: string, data: { collected_penalty?: number; collected_fine?: number; fee_remarks?: string }) =>
    put<null>(`/violations/${id}/fee`, data),
  delete: (id: string) => del<null>(`/violations/${id}`)
}

// ==================== 黑名单 API ====================
export const blacklistApi = {
  getList: (params?: PageQuery) => get<PageResult<BlacklistItem>>('/blacklist', params),
  check: (params: { phone?: string; id_card?: string }) =>
    get<{ isBlacklisted: boolean; record: Record<string, unknown> | null }>('/blacklist/check', params),
  add: (data: { customer_id?: string; name: string; phone: string; id_card?: string; reason: string; order_id?: string }) =>
    post<{ id: string }>('/blacklist', data),
  remove: (id: string) => del<null>(`/blacklist/${id}`)
}

// ==================== 订单来源 API ====================
export const orderSourceApi = {
  /** 不带分页参数时后端直接返回数组（当前所有调用点都是这种用法） */
  getList: (params?: PageQuery) => get<OrderSourceItem[]>('/order-sources', params),
  create: (data: { name: string; commission_rate?: number; color?: string; remarks?: string }) =>
    post<{ id: string }>('/order-sources', data),
  update: (id: string, data: { name?: string; commission_rate?: number; color?: string; remarks?: string }) =>
    put<null>(`/order-sources/${id}`, data),
  delete: (id: string) => del<null>(`/order-sources/${id}`)
}

// ==================== 仪表盘 API ====================
export const dashboardApi = {
  getStats: () => get<Record<string, unknown>>('/dashboard/stats')
}

// ==================== 保养管理 API ====================
export const maintenanceApi = {
  getList: (params?: PageQuery & { status?: string; type?: string; vehicle_id?: string }) =>
    get<PageResult<Record<string, unknown>>>('/maintenance', params),
  getStats: () => get<Record<string, unknown>>('/maintenance/stats'),
  create: (data: Record<string, unknown>) => post<{ id: string }>('/maintenance', data),
  update: (id: string, data: Record<string, unknown>) => put<null>(`/maintenance/${id}`, data),
  delete: (id: string) => del<null>(`/maintenance/${id}`)
}

// ==================== 保险管理 API ====================
export const insuranceApi = {
  getList: (params?: PageQuery & { status?: string; insurance_type?: string; vehicle_id?: string }) =>
    get<PageResult<Record<string, unknown>>>('/insurance', params),
  getStats: () => get<Record<string, unknown>>('/insurance/stats'),
  create: (data: Record<string, unknown>) => post<{ id: string }>('/insurance', data),
  update: (id: string, data: Record<string, unknown>) => put<null>(`/insurance/${id}`, data),
  delete: (id: string) => del<null>(`/insurance/${id}`)
}

// ==================== 年检证管理 API ====================
export const inspectionApi = {
  getList: (params?: PageQuery & { status?: string }) => get<PageResult<Record<string, unknown>>>('/inspections', params),
  getStats: () => get<Record<string, unknown>>('/inspections/stats'),
  update: (vehicleId: string, data: { expiry_date: string; certificate_image?: string; remarks?: string }) =>
    put<null>(`/inspections/${vehicleId}`, data),
  delete: (vehicleId: string) => del<null>(`/inspections/${vehicleId}`)
}

// ==================== 系统设置 API ====================
export const settingsApi = {
  getAll: () => get<Record<string, string>>('/settings'),
  update: (key: string, value: string) => put<null>('/settings', { key, value })
}

// ==================== 操作日志 API ====================
export const logApi = {
  getList: (params?: PageQuery & { user_id?: string; action?: string; entity_type?: string; date_from?: string; date_to?: string }) =>
    get<PageResult<Record<string, unknown>>>('/logs', params),
  getActionTypes: () => get<string[]>('/logs/action-types'),
  getEntityTypes: () => get<string[]>('/logs/entity-types'),
  getUsers: () => get<UserOption[]>('/logs/users')
}

// ==================== 调度 API ====================
export const scheduleApi = {
  getRecent: () => api.get('/schedules/recent'),
  getGantt: () => api.get('/schedules/gantt')
}

// ==================== 文件上传 API ====================
export type UploadType = 'inspection' | 'insurance' | 'violation' | 'maintenance' | 'vehicle' | 'customer' | 'other'

export const uploadApi = {
  // 按类型上传图片到指定子目录（前后端同源，直接走 axios 实例的 /api 前缀）
  // name 是可选的语义化文件名（如「京A12345-行驶证」），后端会拼上日期时间生成对象名
  uploadImage: async (file: File, type: UploadType = 'other', name?: string): Promise<ApiResponse<UploadResult>> => {
    // 上传前校验（MIME / 原始体积）统一放在这里，而不是每个调用点各写一遍 ——
    // 之前 9 个文件里有 23 处重复校验，仍然漏掉了仪表盘的取还车照片。
    // 放在 API 层后，所有入口（含以后新增的）自动带上校验。
    // 只有保险单允许 PDF，与后端 upload.ts 的 KINDS 白名单保持一致。
    const invalid = validateUploadFile(file, { allowPdf: type === 'insurance' })
    if (invalid) {
      return { success: false, message: invalid }
    }

    // 上传前统一压到 500KB 内（最长边 1600px、WebP），PDF/GIF 与压缩失败的情况自动退回原图
    // 大图压缩要花几百毫秒到几秒，给个提示避免用户以为没反应而重复点击
    const compressTip = file.size > 3 * 1024 * 1024
      ? ElMessage({ message: '正在压缩图片…', duration: 0 })
      : undefined

    let compressed: File
    try {
      compressed = (await compressImage(file)).file
    } finally {
      compressTip?.close()
    }

    const formData = new FormData()
    formData.append('image', compressed)
    if (name) formData.append('name', name)
    const endpoint = type === 'other' ? '/upload' : `/upload/${type}`
    try {
      return (await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })) as unknown as ApiResponse<UploadResult>
    } catch (error) {
      // 上传失败在这里就地转成 success:false，不往上抛：
      // 图片上传是流程中的一环，抛异常会让调用方多写一层 try/catch
      const payload = (error as { response?: { data?: { message?: string } } })?.response?.data
      return { success: false, message: payload?.message || '网络错误，请检查服务器连接' }
    }
  },
  
  // 年检证图片上传（便捷方法）
  uploadInspection: (file: File, name?: string) => uploadApi.uploadImage(file, 'inspection', name),
  
  // 保险图片上传（便捷方法）
  uploadInsurance: (file: File, name?: string) => uploadApi.uploadImage(file, 'insurance', name),
  
  // 违章图片上传（便捷方法）
  uploadViolation: (file: File, name?: string) => uploadApi.uploadImage(file, 'violation', name),
  
  // 保养图片上传（便捷方法）
  uploadMaintenance: (file: File, name?: string) => uploadApi.uploadImage(file, 'maintenance', name),
  
  // 车辆图片上传（便捷方法）
  uploadVehicle: (file: File, name?: string) => uploadApi.uploadImage(file, 'vehicle', name),
  
  // 客户图片上传（便捷方法）
  uploadCustomer: (file: File, name?: string) => uploadApi.uploadImage(file, 'customer', name),

  // 其他文件上传（便捷方法）
  uploadOther: (file: File, name?: string) => uploadApi.uploadImage(file, 'other', name)
}

export default api
