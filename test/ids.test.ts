import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateOrderNo } from '../src/lib/ids';

/**
 * 订单号早期是 4 位随机，按生日悖论一天 120 单左右就有一半概率撞 orders.order_no
 * 的唯一约束，撞上直接抛 500。随机段加长到 6 位后这里把格式与取值范围钉住，
 * 防止以后被改回去。
 */
describe('generateOrderNo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('格式为 R + 北京日期(yyyyMMdd) + 6 位数字', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T02:00:00Z'));
    expect(generateOrderNo()).toMatch(/^R20260921\d{6}$/);
  });

  it('日期部分用北京时间，跨日时跟着进位', () => {
    vi.useFakeTimers();
    // UTC 20:00 → 北京次日 04:00
    vi.setSystemTime(new Date('2026-09-21T20:00:00Z'));
    expect(generateOrderNo().slice(1, 9)).toBe('20260922');
  });

  it('长度固定，便于人工核对与对账', () => {
    expect(generateOrderNo()).toHaveLength(1 + 8 + 6);
  });

  it('批量生成碰撞率极低（这正是需要重试兜底的原因）', () => {
    // 6 位随机共 100 万种取值。按生日悖论，同一天生成 n 单的期望碰撞数约为 n²/(2×10⁶)：
    //   n=2000 → 约 2 次；n=200 → 约 0.02 次
    // 也就是说即使加长到 6 位，仍然不能保证绝对不撞 —— 所以 createOrder 里
    // 保留了「唯一冲突换号重试」。这里断言的是「碰撞率足够低」，不是「零碰撞」。
    const set = new Set<string>();
    for (let i = 0; i < 2000; i += 1) {
      set.add(generateOrderNo());
    }
    expect(set.size).toBeGreaterThanOrEqual(1990);
  });

  it('单日 200 单量级下基本不会碰撞（实际业务量）', () => {
    const set = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      set.add(generateOrderNo());
    }
    // 期望碰撞数约 0.02，允许偶尔出现 1 次
    expect(set.size).toBeGreaterThanOrEqual(199);
  });

  it('随机段用满 6 位（前导零被保留）', () => {
    // 采样足够多次，一定出现小于 100000 的值 → 必须有前导零补齐
    const samples = Array.from({ length: 300 }, () => generateOrderNo());
    const withLeadingZero = samples.filter((no) => no.slice(9).startsWith('0'));
    expect(withLeadingZero.length).toBeGreaterThan(0);
  });
});
