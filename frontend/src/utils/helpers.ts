import {
  ORDER_STATUS_TYPE_MAP,
  PAYMENT_METHOD_TEXT_MAP,
  PAYMENT_TYPE_TEXT_MAP,
  SERVICE_TYPE_TEXT_MAP,
  SERVICE_TYPE_TAG_MAP
} from './constants'

/**
 * 获取图片完整URL
 */
export function getImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('data:')) return url
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
  return baseUrl + url
}

/**
 * 格式化日期时间 (MM-DD HH:mm)
 */
export function formatDateTime(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

/**
 * 格式化完整日期时间 (YYYY-MM-DD HH:mm:ss)
 */
export function formatFullDateTime(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 格式化为 datetime-local 输入格式
 */
export function formatDateTimeLocal(dateStr: string): string {
  if (!dateStr) return ''
  return dateStr.replace(' ', 'T').slice(0, 16)
}

/**
 * 从 datetime-local 解析为数据库格式
 */
export function parseDateTimeLocal(value: string): string {
  if (!value) return ''
  return value.replace('T', ' ') + ':00'
}

/**
 * 获取订单状态标签类型
 */
export function getOrderStatusType(status: string): string {
  return ORDER_STATUS_TYPE_MAP[status] || 'info'
}

/**
 * 获取支付方式文本
 */
export function getPaymentMethodText(method: string): string {
  return PAYMENT_METHOD_TEXT_MAP[method] || method
}

/**
 * 获取支付类型文本
 */
export function getPaymentTypeText(type: string): string {
  return PAYMENT_TYPE_TEXT_MAP[type] || type
}

/**
 * 获取服务类型文本
 */
export function getServiceLabel(type: string): string {
  return SERVICE_TYPE_TEXT_MAP[type] || type
}

/**
 * 获取服务类型标签颜色
 */
export function getServiceTagType(type: string): string {
  return SERVICE_TYPE_TAG_MAP[type] || ''
}

/**
 * 检查是否过期
 */
export function isExpired(date: string): boolean {
  if (!date) return false
  return new Date(date) < new Date()
}

/**
 * 检查是否即将到期(默认30天内)
 */
export function isExpiringSoon(date: string, days: number = 30): boolean {
  if (!date) return false
  const now = new Date()
  const target = new Date(date)
  const diff = target.getTime() - now.getTime()
  const daysDiff = diff / (1000 * 60 * 60 * 24)
  return daysDiff > 0 && daysDiff <= days
}

/**
 * 计算两个日期之间的天数
 */
export function getDaysBetween(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diff = end.getTime() - start.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * 格式化金额
 */
export function formatAmount(amount: number): string {
  return `¥${amount.toFixed(2)}`
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}
