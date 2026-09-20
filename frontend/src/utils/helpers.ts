import {
  ORDER_STATUS_TYPE_MAP,
  PAYMENT_METHOD_TEXT_MAP,
  PAYMENT_TYPE_TEXT_MAP,
  SERVICE_TYPE_TEXT_MAP,
  SERVICE_TYPE_TAG_MAP
} from './constants'

/**
 * 拼接 Cloudflare Images 转换前缀
 * 前后端同源，/uploads/xxx 这类相对路径可以直接交给 CDN 做压缩与格式协商
 * 外链、base64、PDF 不参与转换
 */
function transformImageUrl(url: string, width: number): string {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('data:')) return url
  if (/\.pdf(\?|#|$)/i.test(url)) return url
  const path = url.startsWith('/') ? url : `/${url}`
  return `/cdn-cgi/image/width=${width},format=auto${path}`
}

/**
 * 获取图片完整URL
 */
export function getImageUrl(url: string): string {
  return transformImageUrl(url, 600)
}

/**
 * 获取 Logo URL（图标类小图，用更小的宽度）
 */
export function getLogoUrl(url: string): string {
  return transformImageUrl(url, 200)
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
 * 格式化为 datetime-local 输入格式
 */
export function formatDateTimeLocal(dateStr: string): string {
  if (!dateStr) return ''
  return dateStr.replace(' ', 'T').slice(0, 16)
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
