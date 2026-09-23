import { describe, expect, it } from 'vitest'
import {
  WHEEL_ITEM_HEIGHT,
  buildColumns,
  buildDayItems,
  buildHourItems,
  buildMinuteItems,
  buildMonthItems,
  buildYearItems,
  clampDay,
  clampHour,
  clampMinute,
  daysInMonth,
  formatValue,
  indexToScrollTop,
  parseValue,
  scrollTopToIndex,
  todayParts
} from '../frontend/src/utils/wheelPicker'

describe('daysInMonth', () => {
  it('平年 2 月 28 天，闰年 2 月 29 天', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2024, 2)).toBe(29)
    // 整百年份：2000 是闰年、1900 不是（Date 的 day=0 走的就是这套规则）
    expect(daysInMonth(2000, 2)).toBe(29)
    expect(daysInMonth(1900, 2)).toBe(28)
  })

  it('大小月正确', () => {
    expect(daysInMonth(2026, 1)).toBe(31)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })
})

describe('clampDay / clampHour / clampMinute', () => {
  it('超过当月天数时压回最大天数', () => {
    expect(clampDay(2026, 2, 31)).toBe(28)
    expect(clampDay(2024, 2, 30)).toBe(29)
    expect(clampDay(2026, 4, 31)).toBe(30)
  })

  it('合法日期原样返回，0 或负数压到 1', () => {
    expect(clampDay(2026, 9, 23)).toBe(23)
    expect(clampDay(2026, 9, 0)).toBe(1)
    expect(clampDay(2026, 9, -5)).toBe(1)
  })

  it('时分夹在 0-23 / 0-59', () => {
    expect(clampHour(0)).toBe(0)
    expect(clampHour(23)).toBe(23)
    expect(clampHour(24)).toBe(23)
    expect(clampHour(-1)).toBe(0)
    expect(clampMinute(0)).toBe(0)
    expect(clampMinute(59)).toBe(59)
    expect(clampMinute(60)).toBe(59)
    expect(clampMinute(-1)).toBe(0)
  })
})

describe('parseValue', () => {
  it('解析 YYYY-MM-DD', () => {
    expect(parseValue('2026-09-23', 'date')).toMatchObject({ year: 2026, month: 9, day: 23 })
  })

  it('解析 YYYY-MM（month 类型）', () => {
    expect(parseValue('2026-09', 'month')).toMatchObject({ year: 2026, month: 9, day: 1 })
  })

  // MileagePhotoDialog 取车侧历史上存的是带 T 的格式，Orders 的提交逻辑依赖它
  it('解析带 T 与带空格的日期时间', () => {
    expect(parseValue('2026-09-23T10:30', 'datetime')).toMatchObject({ hour: 10, minute: 30 })
    expect(parseValue('2026-09-23 10:30', 'datetime')).toMatchObject({ hour: 10, minute: 30 })
  })

  it('带秒的值只取到分钟', () => {
    expect(parseValue('2026-09-23 10:30:45', 'datetime')).toMatchObject({ hour: 10, minute: 30 })
  })

  it('纯日期解析出的时分是 0', () => {
    expect(parseValue('2026-09-23', 'date')).toMatchObject({ hour: 0, minute: 0 })
  })

  it('空值回落到今天', () => {
    const today = todayParts()
    expect(parseValue('', 'date')).toEqual(today)
    expect(parseValue(null, 'date')).toEqual(today)
    expect(parseValue(undefined, 'date')).toEqual(today)
    // month 类型回落今天所在月，日固定 1
    expect(parseValue('', 'month')).toEqual({ ...today, day: 1 })
  })

  it('月份非法或格式不认识时回落到今天', () => {
    const today = todayParts()
    expect(parseValue('2026-13-01', 'date')).toEqual(today)
    expect(parseValue('2026-00-01', 'date')).toEqual(today)
    expect(parseValue('not-a-date', 'date')).toEqual(today)
  })

  // 后端可能存进 2 月 30 日这类脏数据（导入的台账），滚轮不能因此停在空白列
  it('2 月 30 日这类越界日期被压回当月最后一天', () => {
    expect(parseValue('2026-02-30', 'date')).toMatchObject({ year: 2026, month: 2, day: 28 })
    expect(parseValue('2024-02-30', 'date')).toMatchObject({ year: 2024, month: 2, day: 29 })
  })

  it('越界的时分被夹住', () => {
    expect(parseValue('2026-09-23 25:99', 'datetime')).toMatchObject({ hour: 23, minute: 59 })
  })
})

describe('formatValue', () => {
  const parts = { year: 2026, month: 9, day: 3, hour: 10, minute: 5 }

  it('date 输出 YYYY-MM-DD 且补零', () => {
    expect(formatValue(parts, 'date')).toBe('2026-09-03')
    expect(formatValue({ ...parts, month: 12, day: 31 }, 'date')).toBe('2026-12-31')
  })

  it('month 输出 YYYY-MM 且补零', () => {
    expect(formatValue(parts, 'month')).toBe('2026-09')
    expect(formatValue({ ...parts, month: 10 }, 'month')).toBe('2026-10')
  })

  it('datetime 默认输出 YYYY-MM-DD HH:mm:ss', () => {
    expect(formatValue(parts, 'datetime')).toBe('2026-09-03 10:05:00')
  })

  // MileagePhotoDialog 取车侧要带 T 的 16 位串，不能再补秒，否则 Orders 的
  // `payload.datetime.replace('T',' ') + ':00'` 会拼出 22 位的脏数据
  it('datetime 按 valueFormat 决定分隔符与是否带秒', () => {
    expect(formatValue(parts, 'datetime', 'YYYY-MM-DDTHH:mm')).toBe('2026-09-03T10:05')
    expect(formatValue(parts, 'datetime', 'YYYY-MM-DD HH:mm')).toBe('2026-09-03 10:05')
    expect(formatValue(parts, 'datetime', 'YYYY-MM-DD HH:mm:ss')).toBe('2026-09-03 10:05:00')
  })

  // 解析再格式化必须回到原值，否则打开滚轮点确定会把日期改掉
  it('parseValue → formatValue 往返一致', () => {
    for (const value of ['2026-09-23', '2024-02-29', '2026-01-01', '2026-12-31']) {
      expect(formatValue(parseValue(value, 'date'), 'date')).toBe(value)
    }
    for (const value of ['2026-09', '2026-01', '2026-12']) {
      expect(formatValue(parseValue(value, 'month'), 'month')).toBe(value)
    }
    expect(formatValue(parseValue('2026-09-23 10:30:00', 'datetime'), 'datetime')).toBe('2026-09-23 10:30:00')
    expect(formatValue(parseValue('2026-09-23T10:30', 'datetime'), 'datetime', 'YYYY-MM-DDTHH:mm')).toBe(
      '2026-09-23T10:30'
    )
  })
})

describe('buildColumns', () => {
  it('date 类型有年/月/日三列，索引指向当前值', () => {
    const columns = buildColumns({ year: 2026, month: 9, day: 23, hour: 0, minute: 0 }, 'date')
    expect(columns.map((c) => c.key)).toEqual(['year', 'month', 'day'])
    expect(columns[1].index).toBe(8)
    expect(columns[2].items.length).toBe(30)
    expect(columns[2].index).toBe(22)
    expect(columns[0].items[columns[0].index].value).toBe(2026)
  })

  it('month 类型只有年/月两列', () => {
    const columns = buildColumns({ year: 2026, month: 9, day: 1, hour: 0, minute: 0 }, 'month')
    expect(columns.map((c) => c.key)).toEqual(['year', 'month'])
  })

  it('datetime 类型有年/月/日/时/分五列', () => {
    const columns = buildColumns({ year: 2026, month: 9, day: 23, hour: 10, minute: 5 }, 'datetime')
    expect(columns.map((c) => c.key)).toEqual(['year', 'month', 'day', 'hour', 'minute'])
    expect(columns[3].items.length).toBe(24)
    expect(columns[3].index).toBe(10)
    expect(columns[4].items.length).toBe(60)
    expect(columns[4].index).toBe(5)
  })

  // 年/月滚到 2 月后，日列的 index 必须落在合法范围内，不能指向不存在的 30 日
  it('2 月的日列只到 28/29 天，索引被夹住', () => {
    const leap = buildColumns({ year: 2024, month: 2, day: 30, hour: 0, minute: 0 }, 'date')
    expect(leap[2].items.length).toBe(29)
    expect(leap[2].index).toBe(28)
    const common = buildColumns({ year: 2026, month: 2, day: 30, hour: 0, minute: 0 }, 'date')
    expect(common[2].items.length).toBe(28)
    expect(common[2].index).toBe(27)
  })

  it('datetime 的越界时分索引被夹住', () => {
    const columns = buildColumns({ year: 2026, month: 9, day: 23, hour: 99, minute: 99 }, 'datetime')
    expect(columns[3].index).toBe(23)
    expect(columns[4].index).toBe(59)
  })
})

describe('buildYearItems', () => {
  it('覆盖当前年 ±30', () => {
    const now = new Date().getFullYear()
    const items = buildYearItems()
    expect(items[0].value).toBe(now - 30)
    expect(items[items.length - 1].value).toBe(now + 30)
    expect(items.length).toBe(61)
  })

  it('传入的年份超出范围时向外扩到该年 ±5', () => {
    const now = new Date().getFullYear()
    const items = buildYearItems(now - 100)
    expect(items[0].value).toBe(now - 105)
    expect(items.some((item) => item.value === now - 100)).toBe(true)
  })
})

describe('buildDayItems / buildMonthItems / buildHourItems / buildMinuteItems', () => {
  it('日期列 1 起、数量等于当月天数', () => {
    const items = buildDayItems(2026, 9)
    expect(items.length).toBe(30)
    expect(items[0]).toEqual({ value: 1, label: '1日' })
    expect(items[29]).toEqual({ value: 30, label: '30日' })
  })

  it('月份列固定 12 项', () => {
    const items = buildMonthItems()
    expect(items.length).toBe(12)
    expect(items[0].label).toBe('1月')
    expect(items[11].label).toBe('12月')
  })

  it('小时列 0-23 补零，分钟列 0-59 补零', () => {
    const hours = buildHourItems()
    expect(hours.length).toBe(24)
    expect(hours[0]).toEqual({ value: 0, label: '00时' })
    expect(hours[23]).toEqual({ value: 23, label: '23时' })
    const minutes = buildMinuteItems()
    expect(minutes.length).toBe(60)
    expect(minutes[5]).toEqual({ value: 5, label: '05分' })
    expect(minutes[59]).toEqual({ value: 59, label: '59分' })
  })
})

describe('滚轮位置换算', () => {
  it('索引与 scrollTop 互为逆运算', () => {
    expect(indexToScrollTop(0)).toBe(0)
    expect(indexToScrollTop(23)).toBe(23 * WHEEL_ITEM_HEIGHT)
    expect(scrollTopToIndex(indexToScrollTop(23), 30)).toBe(23)
  })

  it('惯性滚动超界时夹在合法范围', () => {
    expect(scrollTopToIndex(-40, 30)).toBe(0)
    expect(scrollTopToIndex(99999, 30)).toBe(29)
    expect(scrollTopToIndex(17, 30)).toBe(1) // 半个项高向上取整
    expect(scrollTopToIndex(0, 0)).toBe(0)
  })
})
