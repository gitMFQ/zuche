import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addMonths,
  dateOffset,
  dateTimeOffsetMinutes,
  fiscalYearOf,
  formatDate,
  isPeriod,
  monthRange,
  monthRangeOf,
  now,
  normalizeDateTime,
  periodOf,
  today,
  yearRange
} from '../src/lib/time';

/**
 * 时区统一（批次 A1）是整个改造里最容易改错、且错了很难发现的一环：
 * 全系统以北京时间为准，Workers 运行时却是 UTC。这里把基准钉死。
 */
describe('lib/time 北京时间基准', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('now() 把 UTC 转成北京时间（+8）', () => {
    vi.useFakeTimers();
    // UTC 02:00 对应北京 10:00
    vi.setSystemTime(new Date('2026-09-21T02:00:00Z'));
    expect(now()).toBe('2026-09-21 10:00:00');
  });

  it('now() 跨日时日期一起进位', () => {
    vi.useFakeTimers();
    // UTC 20:00 → 北京次日 04:00
    vi.setSystemTime(new Date('2026-09-21T20:00:00Z'));
    expect(now()).toBe('2026-09-22 04:00:00');
    expect(today()).toBe('2026-09-22');
  });

  it('today() 只取日期部分', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T02:30:45Z'));
    expect(today()).toBe('2026-09-21');
  });

  it('dateOffset 按北京日期偏移', () => {
    vi.useFakeTimers();
    // 北京 2026-09-21 23:00，加一天应是 09-22 而不是 09-21
    vi.setSystemTime(new Date('2026-09-21T15:00:00Z'));
    expect(dateOffset(0)).toBe('2026-09-21');
    expect(dateOffset(1)).toBe('2026-09-22');
    expect(dateOffset(2)).toBe('2026-09-23');
    expect(dateOffset(-1)).toBe('2026-09-20');
  });

  it('monthRange 返回本月起止（用于替代 strftime 比较）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T02:00:00Z'));
    expect(monthRange()).toEqual({ start: '2026-09-01 00:00:00', end: '2026-10-01 00:00:00' });
  });

  it('monthRange 在 12 月正确跨年', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-15T02:00:00Z'));
    expect(monthRange()).toEqual({ start: '2026-12-01 00:00:00', end: '2027-01-01 00:00:00' });
  });

  it('monthRange 在跨月边界（UTC 月末、北京次月）取北京月份', () => {
    vi.useFakeTimers();
    // UTC 8/31 20:00 → 北京 9/1 04:00，应算 9 月
    vi.setSystemTime(new Date('2026-08-31T20:00:00Z'));
    expect(monthRange()).toEqual({ start: '2026-09-01 00:00:00', end: '2026-10-01 00:00:00' });
  });

  it('yearRange 返回本年起止', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T02:00:00Z'));
    expect(yearRange()).toEqual({ start: '2026-01-01 00:00:00', end: '2027-01-01 00:00:00' });
  });

  it('dateTimeOffsetMinutes 支持负数（限流窗口起点）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T02:00:00Z'));
    expect(dateTimeOffsetMinutes(15)).toBe('2026-09-21 10:15:00');
    expect(dateTimeOffsetMinutes(-15)).toBe('2026-09-21 09:45:00');
  });

  it('formatDate 输出可排序的固定格式', () => {
    expect(formatDate(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02 03:04:05');
  });

  it('formatDate 对字符串输入不抛错', () => {
    expect(formatDate('2026-01-02T03:04:05Z')).toBe('2026-01-02 03:04:05');
  });
});

describe('lib/time normalizeDateTime', () => {
  it('把 datetime-local 的 T 分隔补成带秒的存储格式', () => {
    expect(normalizeDateTime('2026-09-21T10:00')).toBe('2026-09-21 10:00:00');
  });

  it('已带秒的值保持不变', () => {
    expect(normalizeDateTime('2026-09-21 10:00:30')).toBe('2026-09-21 10:00:30');
  });

  it('空值原样返回，不产生 "null" 字符串', () => {
    expect(normalizeDateTime('')).toBeNull();
    expect(normalizeDateTime(null)).toBeNull();
    expect(normalizeDateTime(undefined)).toBeNull();
  });
});

/**
 * 财务模块的账期工具。结算期（period）是「YYYY-MM」，用来归属月度报表与期间锁定，
 * 边界写错会让整月的账落到相邻月份，所以跨年与闰月都要钉住。
 */
describe('lib/time 账期工具', () => {
  it('periodOf 从日期/时间串取账期', () => {
    expect(periodOf('2026-09-21 10:00:00')).toBe('2026-09');
    expect(periodOf('2026-09-21')).toBe('2026-09');
    expect(periodOf('2026-09')).toBe('2026-09');
  });

  it('periodOf 对空值与非法值返回空串', () => {
    expect(periodOf('')).toBe('');
    expect(periodOf(null)).toBe('');
    expect(periodOf(undefined)).toBe('');
    expect(periodOf('2026/09')).toBe('');
  });

  it('isPeriod 只接受合法的 YYYY-MM', () => {
    expect(isPeriod('2026-09')).toBe(true);
    expect(isPeriod('2026-12')).toBe(true);
    expect(isPeriod('2026-00')).toBe(false);
    expect(isPeriod('2026-13')).toBe(false);
    expect(isPeriod('2026-9')).toBe(false);
    expect(isPeriod('')).toBe(false);
  });

  it('addMonths 正常偏移', () => {
    expect(addMonths('2026-09', 1)).toBe('2026-10');
    expect(addMonths('2026-09', -1)).toBe('2026-08');
    expect(addMonths('2026-09', 0)).toBe('2026-09');
  });

  it('addMonths 跨年', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('addMonths 偏移超过一年', () => {
    expect(addMonths('2026-03', 12)).toBe('2027-03');
    expect(addMonths('2026-03', -15)).toBe('2024-12');
  });

  it('addMonths 接受完整日期串，非法输入返回空串', () => {
    expect(addMonths('2026-09-21 10:00:00', 1)).toBe('2026-10');
    expect(addMonths('', 1)).toBe('');
    expect(addMonths('不是日期', 1)).toBe('');
  });

  it('monthRangeOf 返回半开区间，2 月闰年同样正确', () => {
    expect(monthRangeOf('2026-09')).toEqual({ start: '2026-09-01 00:00:00', end: '2026-10-01 00:00:00' });
    // 2028 是闰年，2 月有 29 天；半开区间不受天数影响，但必须落在 3/1
    expect(monthRangeOf('2028-02')).toEqual({ start: '2028-02-01 00:00:00', end: '2028-03-01 00:00:00' });
    expect(monthRangeOf('2026-12')).toEqual({ start: '2026-12-01 00:00:00', end: '2027-01-01 00:00:00' });
  });

  it('monthRangeOf 非法账期返回空区间而不是抛错', () => {
    expect(monthRangeOf('')).toEqual({ start: '', end: '' });
    expect(monthRangeOf('2026-13')).toEqual({ start: '', end: '' });
  });

  it('fiscalYearOf 取自然年', () => {
    expect(fiscalYearOf('2026-09-21 10:00:00')).toBe(2026);
    expect(fiscalYearOf('2025-01-01')).toBe(2025);
    expect(fiscalYearOf('')).toBe(0);
  });
});
