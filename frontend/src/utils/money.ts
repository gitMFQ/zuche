/**
 * 金额显示工具。
 *
 * 后端金额按 6 位小数存储、台账里的「公司管理费」真实存在 4 位小数
 * （702.95 × 15% = 105.4425），所以格式化**不能一刀切成 2 位** ——
 * 那会让界面上的数字和台账差半分，用户一眼就看出对不上。
 *
 * 规则：最多保留 4 位、去掉末尾多余的 0，但至少保留 2 位（看起来还像钱）。
 *   105.4425 → 105.4425
 *   59.1     → 59.10
 *   15246    → 15246.00
 */

/** 最多显示的小数位。与台账的真实精度一致（15% × 两位小数 = 最多 4 位） */
const MAX_DIGITS = 4;
const MIN_DIGITS = 2

export interface FormatMoneyOptions {
  /** 固定小数位（传了就忽略智能位数） */
  digits?: number
  /** 0 显示成破折号，跟台账习惯一致 */
  dashOnZero?: boolean
  /** 正数带 + 号，用于差异展示 */
  showSign?: boolean
}

export function formatMoney(value: number | string | null | undefined, options: FormatMoneyOptions = {}): string {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  const safe = Number.isFinite(n) ? n : 0

  if (options.dashOnZero && safe === 0) return '-'

  let text: string
  if (options.digits !== undefined) {
    text = Math.abs(safe).toFixed(options.digits)
  } else {
    // 先按最大位数定型，再把末尾多余的 0 削掉，但保住最少两位
    const fixed = Math.abs(safe).toFixed(MAX_DIGITS)
    const [intPart, decPart = ''] = fixed.split('.')
    const trimmed = decPart.replace(/0+$/, '')
    const decimals = trimmed.length > MIN_DIGITS ? trimmed : decPart.substring(0, MIN_DIGITS)
    text = decimals ? `${intPart}.${decimals}` : intPart
  }

  const [intPart, decPart] = text.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const body = decPart ? `${grouped}.${decPart}` : grouped

  if (safe < 0) return `-${body}`
  return options.showSign && safe > 0 ? `+${body}` : body
}

/** 金额 + 元 单位（表格里用得多） */
export function formatMoneyUnit(value: number | string | null | undefined, options?: FormatMoneyOptions): string {
  const text = formatMoney(value, options)
  return text === '-' ? '-' : `¥${text}`
}

/** 差异着色用的 class：正数绿、负数红、零灰 */
export function moneyClass(value: number | string | null | undefined): string {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  if (!Number.isFinite(n) || n === 0) return 'money-zero'
  return n > 0 ? 'money-positive' : 'money-negative'
}
