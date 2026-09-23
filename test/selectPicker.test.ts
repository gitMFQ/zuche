import { describe, expect, it } from 'vitest'
import {
  CLEAR_VALUE,
  SEARCH_THRESHOLD,
  buildSelectItems,
  filterOptions,
  findOptionIndex,
  shouldShowSearch
} from '../frontend/src/utils/selectPicker'

const options = [
  { label: '平台支付', value: 'platform' },
  { label: '微信', value: 'wechat' },
  { label: '现金', value: 'cash' }
]

describe('shouldShowSearch', () => {
  it('filterable 一律显示搜索框', () => {
    expect(shouldShowSearch(true, 0)).toBe(true)
    expect(shouldShowSearch(true, 3)).toBe(true)
  })

  it('非 filterable 只在选项数超过阈值时显示', () => {
    expect(shouldShowSearch(false, 0)).toBe(false)
    expect(shouldShowSearch(false, SEARCH_THRESHOLD)).toBe(false)
    expect(shouldShowSearch(false, SEARCH_THRESHOLD + 1)).toBe(true)
  })
})

describe('buildSelectItems', () => {
  it('clearable 时首行是「不限」，值为空串', () => {
    const items = buildSelectItems(options, '', true)
    expect(items[0]).toEqual({ label: '不限', value: CLEAR_VALUE })
    expect(items).toHaveLength(4)
    // 真实选项的顺序不能动
    expect(items.slice(1)).toEqual(options)
  })

  it('非 clearable 没有「不限」行', () => {
    expect(buildSelectItems(options, 'cash', false)).toEqual(options)
  })

  it('值不在选项里时插一条当前值占位项，避免确定后被静默改成第一项', () => {
    const items = buildSelectItems(options, 'stale-id', true)
    expect(items).toEqual([{ label: '不限', value: CLEAR_VALUE }, { label: 'stale-id', value: 'stale-id' }, ...options])
    // 占位项让「翻到它、直接确定」= 值没变，组件据此不发 change
    expect(findOptionIndex(items, 'stale-id')).toBe(1)
  })

  it('值为空时不插占位项（「不限」行已经表达了空）', () => {
    const items = buildSelectItems(options, '', true)
    expect(items.filter((item) => item.value === '')).toHaveLength(1)
  })

  it('值在选项里时不插占位项', () => {
    expect(buildSelectItems(options, 'wechat', true)).toHaveLength(4)
  })

  it('选项为空时不崩，clearable 只剩「不限」', () => {
    expect(buildSelectItems([], '', true)).toEqual([{ label: '不限', value: CLEAR_VALUE }])
    expect(buildSelectItems([], 'stale-id', false)).toEqual([{ label: 'stale-id', value: 'stale-id' }])
    expect(buildSelectItems([], '', false)).toEqual([])
  })
})

describe('findOptionIndex', () => {
  it('命中返回索引', () => {
    const items = buildSelectItems(options, 'wechat', true)
    expect(findOptionIndex(items, 'wechat')).toBe(2)
    expect(findOptionIndex(items, CLEAR_VALUE)).toBe(0)
  })

  it('找不到（或列表为空）时停在第 0 项', () => {
    expect(findOptionIndex(options, 'nope')).toBe(0)
    expect(findOptionIndex([], 'nope')).toBe(0)
  })
})

describe('filterOptions', () => {
  it('关键词为空或只有空白时原样返回', () => {
    expect(filterOptions(options, '')).toEqual(options)
    expect(filterOptions(options, '   ')).toEqual(options)
  })

  it('按 label 做不区分大小写的包含匹配', () => {
    const accounts = [
      { label: '微信（公户）', value: 'a1' },
      { label: '公户 ICBC', value: 'a2' },
      { label: '支付宝', value: 'a3' }
    ]
    expect(filterOptions(accounts, '公户')).toHaveLength(2)
    expect(filterOptions(accounts, 'icbc')).toEqual([{ label: '公户 ICBC', value: 'a2' }])
    expect(filterOptions(accounts, '  公户 ')).toHaveLength(2)
  })

  it('不匹配 value，只匹配 label；无匹配返回空数组', () => {
    expect(filterOptions(options, 'wechat')).toEqual([])
    expect(filterOptions(options, '不存在')).toEqual([])
  })
})
