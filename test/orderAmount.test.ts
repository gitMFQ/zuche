import { describe, expect, it } from 'vitest';
import { calcDailyRate, calcNetAmount, calcRentalDays } from '../src/lib/orderAmount';

/**
 * 金额与天数计算。改造前 createOrder / updateOrder / extendOrder 各写一遍，
 * 且四舍五入口径不一致（同一张单在不同路径下能差几分钱）。这里锁住统一后的口径。
 */
describe('calcRentalDays', () => {
  it('不满一天按一天算', () => {
    expect(calcRentalDays('2026-09-21 10:00:00', '2026-09-21 18:00:00')).toBe(1);
  });

  it('按小时向上取整', () => {
    expect(calcRentalDays('2026-09-21 10:00:00', '2026-09-22 11:00:00')).toBe(2);
  });

  it('整 24 小时算一天', () => {
    expect(calcRentalDays('2026-09-21 10:00:00', '2026-09-22 10:00:00')).toBe(1);
  });

  it('整 48 小时算两天', () => {
    expect(calcRentalDays('2026-09-21 10:00:00', '2026-09-23 10:00:00')).toBe(2);
  });

  it('允许带 T 的输入（前端 datetime-local 原样提交）', () => {
    expect(calcRentalDays('2026-09-21T10:00:00', '2026-09-23T10:00:00')).toBe(2);
  });

  it('结束早于开始时兜底为 1 天，不返回 0 或负数', () => {
    expect(calcRentalDays('2026-09-23 10:00:00', '2026-09-21 10:00:00')).toBe(1);
  });

  it('非法时间串兜底为 1 天', () => {
    expect(calcRentalDays('', '')).toBe(1);
    expect(calcRentalDays('不是时间', '2026-09-21 10:00:00')).toBe(1);
  });
});

describe('calcNetAmount', () => {
  it('无佣金时净额等于总额', () => {
    expect(calcNetAmount(1000, 0)).toBe(1000);
  });

  it('按比例扣除渠道佣金并四舍五入到元', () => {
    expect(calcNetAmount(1000, 10)).toBe(900);
    expect(calcNetAmount(1000, 12)).toBe(880);
    expect(calcNetAmount(1000, 15)).toBe(850);
  });

  it('除不尽时四舍五入，避免出现小数分', () => {
    // 999 * 0.88 = 879.12 → 879
    expect(calcNetAmount(999, 12)).toBe(879);
    expect(Number.isInteger(calcNetAmount(1234.56, 13))).toBe(true);
  });

  it('传入非法佣金比例时按 0 处理', () => {
    expect(calcNetAmount(1000, Number.NaN)).toBe(1000);
  });

  it('总额为 0 / undefined 时返回 0', () => {
    expect(calcNetAmount(0, 10)).toBe(0);
    expect(calcNetAmount(undefined as unknown as number, 10)).toBe(0);
  });
});

describe('calcDailyRate', () => {
  it('由总租金反推日租金并取整到元', () => {
    expect(calcDailyRate(1000, 3)).toBe(333);
  });

  it('天数为 0 时返回 0，不产生 Infinity', () => {
    expect(calcDailyRate(1000, 0)).toBe(0);
  });
});
