import { afterEach, describe, expect, it, vi } from 'vitest';
import { dateOffset, dateTimeOffsetMinutes, formatDate, monthRange, now, normalizeDateTime, today, yearRange } from '../src/lib/time';

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
