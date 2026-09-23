/**
 * WeUI 滚轮日期选择器的纯逻辑。
 *
 * 组件（components/AppDatePicker.vue）只负责渲染和滚动事件，列数据、值解析、
 * 闰年与大小月联动都放在这里，方便单测：本机没有浏览器，滚轮的滚动手感无法
 * 本地验证，但「滚到 2 月要把 31 日压回 28/29 日」这类规则必须是对的。
 */

export type PickerType = 'date' | 'month' | 'datetime'

export type WheelColumnKey = 'year' | 'month' | 'day' | 'hour' | 'minute'

export interface WheelItem {
  /** 列内的真实值（年 / 月 / 日 / 时 / 分） */
  value: number
  /** 滚轮上显示的文字 */
  label: string
}

export interface WheelColumn {
  key: WheelColumnKey
  items: WheelItem[]
  /** 当前值在列中的索引，0 起 */
  index: number
}

export interface DateParts {
  year: number
  /** 1-12 */
  month: number
  /** 1-31 */
  day: number
  /** 0-23，只有 datetime 类型会渲染成滚轮列 */
  hour: number
  /** 0-59，同上 */
  minute: number
}

/**
 * 滚轮单项高度（px）。组件把它写成 CSS 变量 --m-wheel-item-h，
 * 样式与 scrollTop 换算共用这一个来源，改这里就够。
 */
export const WHEEL_ITEM_HEIGHT = 34

/** 某一年的可选范围：当前年 ±30，传入值在范围外时再向外扩到该值 ±5 */
const YEAR_SPAN = 30
const VALUE_PADDING = 5

/** 某年某月的天数。Date 的 day=0 表示上月最后一天，正好是本月天数 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** 把 2 月 30 日这类不存在的日期压回当月最大天数 */
export function clampDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(day, 1), daysInMonth(year, month))
}

export function clampHour(hour: number): number {
  return Math.min(Math.max(hour, 0), 23)
}

export function clampMinute(minute: number): number {
  return Math.min(Math.max(minute, 0), 59)
}

export function buildYearItems(valueYear?: number): WheelItem[] {
  const now = new Date().getFullYear()
  const anchor = valueYear ?? now
  const min = Math.min(now - YEAR_SPAN, anchor - VALUE_PADDING)
  const max = Math.max(now + YEAR_SPAN, anchor + VALUE_PADDING)
  const items: WheelItem[] = []
  for (let y = min; y <= max; y += 1) items.push({ value: y, label: `${y}年` })
  return items
}

export function buildMonthItems(): WheelItem[] {
  const items: WheelItem[] = []
  for (let m = 1; m <= 12; m += 1) items.push({ value: m, label: `${m}月` })
  return items
}

export function buildDayItems(year: number, month: number): WheelItem[] {
  const total = daysInMonth(year, month)
  const items: WheelItem[] = []
  for (let d = 1; d <= total; d += 1) items.push({ value: d, label: `${d}日` })
  return items
}

export function buildHourItems(): WheelItem[] {
  const items: WheelItem[] = []
  for (let h = 0; h < 24; h += 1) items.push({ value: h, label: `${pad2(h)}时` })
  return items
}

export function buildMinuteItems(): WheelItem[] {
  const items: WheelItem[] = []
  for (let m = 0; m < 60; m += 1) items.push({ value: m, label: `${pad2(m)}分` })
  return items
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * 今天的日期时间（北京时间）。
 *
 * 与 FundTxnDialog 的 today() 同一口径：先加 8 小时再按 UTC 取值，
 * 设备时区不是 +8 时也不会把晚上录成前一天。
 */
export function todayParts(): DateParts {
  const beijing = new Date(Date.now() + 8 * 3600 * 1000)
  return {
    year: beijing.getUTCFullYear(),
    month: beijing.getUTCMonth() + 1,
    day: beijing.getUTCDate(),
    hour: beijing.getUTCHours(),
    minute: beijing.getUTCMinutes()
  }
}

/**
 * 解析 v-model 的值，认这几种形态（都是项目里真实存在的）：
 * `YYYY-MM`、`YYYY-MM-DD`、`YYYY-MM-DD HH:mm`、`YYYY-MM-DDTHH:mm`、带秒的 `HH:mm:ss`。
 *
 * 空值或解析失败时回落到今天，避免滚轮停在 1970 年；
 * 时分缺失时取 0（date/month 类型不渲染时分列，取什么值都无所谓）。
 */
export function parseValue(value: string | null | undefined, type: PickerType): DateParts {
  const matched = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:[T ](\d{1,2}):(\d{1,2}))?/.exec((value ?? '').trim())
  if (matched) {
    const year = Number(matched[1])
    const month = Number(matched[2])
    if (month >= 1 && month <= 12) {
      return {
        year,
        month,
        day: clampDay(year, month, matched[3] ? Number(matched[3]) : 1),
        hour: matched[4] === undefined ? 0 : clampHour(Number(matched[4])),
        minute: matched[5] === undefined ? 0 : clampMinute(Number(matched[5]))
      }
    }
  }
  const fallback = todayParts()
  return type === 'month' ? { ...fallback, day: 1 } : fallback
}

/**
 * 按 value-format 输出：
 * - month → `YYYY-MM`
 * - date → `YYYY-MM-DD`
 * - datetime → `YYYY-MM-DD HH:mm:ss`，valueFormat 含 `T` 时用 T 分隔（MileagePhotoDialog
 *   的取车侧历史上存的就是带 T 的 16 位串，Orders/OrderDetail/Dashboard 的提交逻辑
 *   依赖这个长度，不能擅自改），不含 `ss` 时省略秒。
 *
 * 滚轮只能选到分钟，秒固定 00 —— 现有调用点的默认值秒都是 00，无损。
 */
export function formatValue(parts: DateParts, type: PickerType, valueFormat?: string): string {
  const ym = `${parts.year}-${pad2(parts.month)}`
  if (type === 'month') return ym
  const ymd = `${ym}-${pad2(parts.day)}`
  if (type === 'date') return ymd
  const separator = valueFormat?.includes('T') ? 'T' : ' '
  const hm = `${pad2(clampHour(parts.hour))}:${pad2(clampMinute(parts.minute))}`
  const seconds = valueFormat && !valueFormat.includes('ss') ? '' : ':00'
  return `${ymd}${separator}${hm}${seconds}`
}

/**
 * 值 → 列数据。month 只有年/月，date 加日列，datetime 再加时/分两列；
 * 索引一律按 clamp 后的值算，滚轮不会指向不存在的项。
 */
export function buildColumns(parts: DateParts, type: PickerType): WheelColumn[] {
  const yearItems = buildYearItems(parts.year)
  const monthItems = buildMonthItems()
  const columns: WheelColumn[] = [
    { key: 'year', items: yearItems, index: indexOfValue(yearItems, parts.year) },
    { key: 'month', items: monthItems, index: indexOfValue(monthItems, parts.month) }
  ]
  if (type === 'date' || type === 'datetime') {
    const dayItems = buildDayItems(parts.year, parts.month)
    columns.push({
      key: 'day',
      items: dayItems,
      index: indexOfValue(dayItems, clampDay(parts.year, parts.month, parts.day))
    })
  }
  if (type === 'datetime') {
    const hourItems = buildHourItems()
    const minuteItems = buildMinuteItems()
    columns.push({ key: 'hour', items: hourItems, index: indexOfValue(hourItems, clampHour(parts.hour)) })
    columns.push({ key: 'minute', items: minuteItems, index: indexOfValue(minuteItems, clampMinute(parts.minute)) })
  }
  return columns
}

function indexOfValue(items: WheelItem[], value: number): number {
  const found = items.findIndex((item) => item.value === value)
  return found >= 0 ? found : 0
}

/** 索引 → scrollTop：第 index 项居中时，scrollTop 恰好是 index × 项高 */
export function indexToScrollTop(index: number): number {
  return index * WHEEL_ITEM_HEIGHT
}

/** scrollTop → 索引，并夹在合法范围内（惯性滚动可能短暂超出） */
export function scrollTopToIndex(scrollTop: number, itemCount: number): number {
  const index = Math.round(scrollTop / WHEEL_ITEM_HEIGHT)
  return Math.min(Math.max(index, 0), Math.max(itemCount - 1, 0))
}
