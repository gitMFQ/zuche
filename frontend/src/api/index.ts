import axios from 'axios'
import { ElMessage } from 'element-plus'

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
    const message = error.response?.data?.message || '网络错误'
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      ElMessage.error('登录已过期，请重新登录')
    } else {
      ElMessage.error(message)
    }
    
    return Promise.reject(error)
  }
)

// ==================== 认证 API ====================
export const authApi = {
  login: (data: { username: string; password: string }) => 
    api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me'),
  changePassword: (data: { oldPassword: string; newPassword: string }) => 
    api.put('/auth/password', data)
}

// ==================== 用户管理 API ====================
export const userApi = {
  getList: (params?: any) => api.get('/users', { params }),
  getOne: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  resetPassword: (id: string, newPassword: string) => 
    api.put(`/users/${id}/reset-password`, { newPassword })
}

// ==================== 客户管理 API ====================
export const customerApi = {
  getList: (params?: any) => api.get('/customers', { params }),
  getRegular: () => api.get('/customers/regular'),
  getOne: (id: string) => api.get(`/customers/${id}`),
  create: (data: any) => api.post('/customers', data),
  update: (id: string, data: any) => api.put(`/customers/${id}`, data),
  setRegular: (id: string, isRegular: boolean) => api.put(`/customers/${id}/regular`, { is_regular: isRegular }),
  delete: (id: string) => api.delete(`/customers/${id}`)
}

// ==================== 车辆管理 API ====================
export const vehicleApi = {
  getList: (params?: any) => api.get('/vehicles', { params }),
  getAvailable: (params?: { start_date?: string; end_date?: string; exclude_order_id?: string }) => 
    api.get('/vehicles/available', { params }),
  getBrands: () => api.get('/vehicles/brands'),
  getOne: (id: string) => api.get(`/vehicles/${id}`),
  create: (data: any) => api.post('/vehicles', data),
  update: (id: string, data: any) => api.put(`/vehicles/${id}`, data),
  delete: (id: string) => api.delete(`/vehicles/${id}`)
}

// ==================== 订单管理 API ====================
export const orderApi = {
  getList: (params?: any) => api.get('/orders', { params }),
  getOne: (id: string) => api.get(`/orders/${id}`),
  create: (data: any) => api.post('/orders', data),
  update: (id: string, data: any) => api.put(`/orders/${id}`, data),
  extend: (id: string, data: { extend_days: number; daily_rate?: number }) => api.put(`/orders/${id}/extend`, data),
  updateStatus: (id: string, data: any) => api.put(`/orders/${id}/status`, data),
  addPayment: (id: string, data: any) => api.post(`/orders/${id}/payments`, data),
  cancel: (id: string, remarks?: string) => api.put(`/orders/${id}/cancel`, { remarks })
}

// ==================== 违章管理 API ====================
export const violationApi = {
  getList: (params?: any) => api.get('/violations', { params }),
  getStats: () => api.get('/violations/stats'),
  getOne: (id: string) => api.get(`/violations/${id}`),
  create: (data: any) => api.post('/violations', data),
  update: (id: string, data: any) => api.put(`/violations/${id}`, data),
  handle: (id: string, data: { status: string; handle_remarks?: string }) => 
    api.put(`/violations/${id}/handle`, data),
  collectFee: (id: string, data: { collected_penalty?: number; collected_fine?: number; fee_remarks?: string }) => 
    api.put(`/violations/${id}/fee`, data),
  delete: (id: string) => api.delete(`/violations/${id}`)
}

// ==================== 黑名单 API ====================
export const blacklistApi = {
  getList: (params?: any) => api.get('/blacklist', { params }),
  check: (params: { phone?: string; id_card?: string }) => api.get('/blacklist/check', { params }),
  getOne: (id: string) => api.get(`/blacklist/${id}`),
  add: (data: { customer_id?: string; name: string; phone: string; id_card?: string; reason: string; order_id?: string }) => 
    api.post('/blacklist', data),
  remove: (id: string) => api.delete(`/blacklist/${id}`)
}

// ==================== 订单来源 API ====================
export const orderSourceApi = {
  getList: (params?: any) => api.get('/order-sources', { params }),
  getOne: (id: string) => api.get(`/order-sources/${id}`),
  create: (data: { name: string; commission_rate?: number; remarks?: string }) => api.post('/order-sources', data),
  update: (id: string, data: { name?: string; commission_rate?: number; remarks?: string }) => api.put(`/order-sources/${id}`, data),
  delete: (id: string) => api.delete(`/order-sources/${id}`)
}

// ==================== 仪表盘 API ====================
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getIncomeReport: (params?: any) => api.get('/dashboard/income', { params })
}

// ==================== 保养管理 API ====================
export const maintenanceApi = {
  getList: (params?: any) => api.get('/maintenance', { params }),
  getStats: () => api.get('/maintenance/stats'),
  getOne: (id: string) => api.get(`/maintenance/${id}`),
  create: (data: any) => api.post('/maintenance', data),
  update: (id: string, data: any) => api.put(`/maintenance/${id}`, data),
  delete: (id: string) => api.delete(`/maintenance/${id}`)
}

// ==================== 保险管理 API ====================
export const insuranceApi = {
  getList: (params?: any) => api.get('/insurance', { params }),
  getStats: () => api.get('/insurance/stats'),
  getOne: (id: string) => api.get(`/insurance/${id}`),
  create: (data: any) => api.post('/insurance', data),
  update: (id: string, data: any) => api.put(`/insurance/${id}`, data),
  delete: (id: string) => api.delete(`/insurance/${id}`)
}

// ==================== 年检证管理 API ====================
export const inspectionApi = {
  getList: (params?: any) => api.get('/inspections', { params }),
  getStats: () => api.get('/inspections/stats'),
  create: (data: any) => api.post('/inspections', data),
  update: (vehicleId: string, data: any) => api.put(`/inspections/${vehicleId}`, data),
  delete: (vehicleId: string) => api.delete(`/inspections/${vehicleId}`)
}

// ==================== 系统设置 API ====================
export const settingsApi = {
  getAll: () => api.get('/settings'),
  get: (key: string) => api.get(`/settings/${key}`),
  update: (key: string, value: string) => api.put('/settings', { key, value })
}

// ==================== 文件上传 API ====================
export type UploadType = 'inspection' | 'insurance' | 'violation' | 'maintenance' | 'vehicle' | 'customer' | 'other'

export const uploadApi = {
  // 按类型上传图片到指定子目录
  uploadImage: async (file: File, type: UploadType = 'other'): Promise<{ success: boolean; data?: { filename: string; url: string; type?: string }; message?: string }> => {
    const formData = new FormData()
    formData.append('image', file)
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
    const endpoint = type === 'other' ? '/api/upload' : `/api/upload/${type}`
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      })
      const result = await response.json()
      if (!response.ok) {
        return { success: false, message: result.message || `上传失败 (${response.status})` }
      }
      return result
    } catch (error) {
      return { success: false, message: '网络错误，请检查服务器连接' }
    }
  },
  
  // 年检证图片上传（便捷方法）
  uploadInspection: (file: File) => uploadApi.uploadImage(file, 'inspection'),
  
  // 保险图片上传（便捷方法）
  uploadInsurance: (file: File) => uploadApi.uploadImage(file, 'insurance'),
  
  // 违章图片上传（便捷方法）
  uploadViolation: (file: File) => uploadApi.uploadImage(file, 'violation'),
  
  // 保养图片上传（便捷方法）
  uploadMaintenance: (file: File) => uploadApi.uploadImage(file, 'maintenance'),
  
  // 车辆图片上传（便捷方法）
  uploadVehicle: (file: File) => uploadApi.uploadImage(file, 'vehicle'),
  
  // 客户图片上传（便捷方法）
  uploadCustomer: (file: File) => uploadApi.uploadImage(file, 'customer'),

  // 其他文件上传（便捷方法）
  uploadOther: (file: File) => uploadApi.uploadImage(file, 'other')
}

export default api
