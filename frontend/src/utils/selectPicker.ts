/**
 * WeUI 单列滚轮选择器（AppSelect.vue 的移动端分支）的纯逻辑。
 *
 * 组件只负责渲染与滚动事件；滚轮项怎么拼、当前值怎么定位、搜索怎么过滤都放这里，
 * 方便单测 —— 本机没有浏览器，滚轮的滚动手感无法本地验证，但「值对不上选项时
 * 不能被静默改掉」这类规则必须是对的。
 */

export interface SelectOption {
  /** 滚轮上显示的文字 */
  label: string
  /** 选中后 emit 出去的值 */
  value: string
}

/** 「不限」行的值：滚到它并确定 = 清空，与触发器上的 × 等价 */
export const CLEAR_VALUE = ''

/** 「不限」行的文案 */
const CLEAR_LABEL = '不限'

/**
 * 选项超过这个数量就在 sheet 里给搜索框。
 *
 * 判据不只看 filterable：订单表单的车辆、常用客户这些长列表本来就没写 filterable，
 * 光靠 filterable 会让几十项只能滚着找。
 */
export const SEARCH_THRESHOLD = 8

export function shouldShowSearch(filterable: boolean, optionCount: number): boolean {
  return filterable || optionCount > SEARCH_THRESHOLD
}

/**
 * 滚轮项 =「不限」（clearable 时）+ 当前值占位项（值不在选项里时）+ 真实选项。
 *
 * 当前值占位项是为「值和选项对不上」的那一刻准备的：选项还没加载完、来源已被删、
 * 从 URL 恢复出来的旧 id。没有它，滚轮会停在第 0 项，用户直接点确定就把值
 * 静默改成了第一项；有了它，什么都没动就确定 = 值没变 = 不发 change。
 */
export function buildSelectItems(options: SelectOption[], currentValue: string, clearable: boolean): SelectOption[] {
  const items: SelectOption[] = []
  if (clearable) items.push({ label: CLEAR_LABEL, value: CLEAR_VALUE })
  if (currentValue !== '' && !options.some((item) => item.value === currentValue)) {
    items.push({ label: currentValue, value: currentValue })
  }
  return items.concat(options)
}

/**
 * 滚轮定位用：返回当前值在列里的索引，找不到就停在第一项
 * （非 clearable 且值为空时会走到这条路，等同「默认选中第一项」）。
 */
export function findOptionIndex(items: SelectOption[], value: string): number {
  const index = items.findIndex((item) => item.value === value)
  return index >= 0 ? index : 0
}

/**
 * 搜索：只按 label 做不区分大小写的包含匹配，关键词两端空白忽略。
 * 值是 id / 状态 key，不参与匹配（用户搜的是看得见的文字）。
 */
export function filterOptions(options: SelectOption[], keyword: string): SelectOption[] {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return options
  return options.filter((item) => item.label.toLowerCase().includes(needle))
}
