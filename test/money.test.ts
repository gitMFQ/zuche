import { describe, expect, it } from 'vitest';
import { MONEY_SCALE, roundMoney, sumBy, toAmount, toRate } from '../src/lib/money';

/**
 * 财务口径的金额工具。
 *
 * 为什么不复用 orderAmount.ts 的 calcNetAmount：那个是 Math.round 到**整元**，
 * 用于订单页展示；财务/结算台账要保留台账精度（4 位小数，见下）。
 * 为什么精度取 6 位而不是 2 位：台账的「公司管理费」就是 4 位小数
 * （702.95 × 15% = 105.4425），降到 2 位会让每一行差半分、几百行累计后总额对不上。
 */
describe('lib/money toAmount', () => {
  it('保留合法数值', () => {
    expect(toAmount(123.45)).toBe(123.45);
    expect(toAmount(0)).toBe(0);
    expect(toAmount(-5)).toBe(-5);
  });

  it('数字字符串按数值处理', () => {
    expect(toAmount('123.45')).toBe(123.45);
    expect(toAmount('-1.5')).toBe(-1.5);
  });

  it('非法值一律归 0，避免 NaN 污染写库', () => {
    expect(toAmount(undefined)).toBe(0);
    expect(toAmount(null)).toBe(0);
    expect(toAmount('')).toBe(0);
    expect(toAmount('abc')).toBe(0);
    expect(toAmount(Number.NaN)).toBe(0);
    expect(toAmount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(toAmount(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe('lib/money roundMoney', () => {
  it('精度常量是 6 位', () => {
    expect(MONEY_SCALE).toBe(6);
  });

  it('如实保留台账的 4 位小数，不降到 2 位', () => {
    // file-1 捷途台账真实行
    expect(roundMoney(702.95 * 0.15)).toBe(105.4425);
    expect(roundMoney(396.95 * 0.15)).toBe(59.5425);
    expect(roundMoney(334.9 * 0.15)).toBe(50.235);
    expect(roundMoney(459.85 * 0.15)).toBe(68.9775);
  });

  it('消掉 IEEE754 表示误差导致的尾数噪音', () => {
    // 394 * 0.15 在双精度下是 59.099999999999994，直接写库会显示成一长串
    expect(roundMoney(394 * 0.15)).toBe(59.1);
    expect(roundMoney(827 * 0.15)).toBe(124.05);
    expect(roundMoney(100.3 * 0.15)).toBe(15.045);
  });

  it('账本真实数：车主结算金额 = 结算金额 − 公司管理费 − 其他费用', () => {
    const settlementAmount = roundMoney(827 - 124.05); // 702.95
    const companyFee = roundMoney(settlementAmount * 0.15); // 105.4425
    expect(settlementAmount).toBe(702.95);
    expect(companyFee).toBe(105.4425);
    expect(roundMoney(settlementAmount - companyFee - 10)).toBe(587.5075);
  });

  it('第 7 位才进位，前 6 位原样保留', () => {
    expect(roundMoney(1.2345674)).toBe(1.234567);
    expect(roundMoney(1.2345675)).toBe(1.234568);
  });

  it('负数向远离 0 的方向进位，与正数口径一致', () => {
    // Math.round(-0.5) 是 -0（向 +∞ 取整），直接用会算出 -0 而不是 -0.000001
    expect(roundMoney(-0.0000005)).toBe(-0.000001);
    expect(roundMoney(-105.4425004)).toBe(-105.4425);
  });

  it('容差不误伤真实的「不到半位」', () => {
    expect(roundMoney(1.0000004)).toBe(1);
  });

  it('非法值归 0，0 与 -0 都返回 0', () => {
    expect(roundMoney(undefined)).toBe(0);
    expect(roundMoney(Number.NaN)).toBe(0);
    expect(Object.is(roundMoney(0), 0)).toBe(true);
    expect(Object.is(roundMoney(-0), 0)).toBe(true);
  });

  it('台账结转数原样返回', () => {
    expect(roundMoney(8186.83)).toBe(8186.83);
    expect(roundMoney(13064.0858)).toBe(13064.0858);
    expect(roundMoney(5387)).toBe(5387);
    expect(roundMoney(15246)).toBe(15246);
  });
});

describe('lib/money sumBy', () => {
  it('先求和再舍入，不边加边舍', () => {
    // 0.1 + 0.2 直接相加是 0.30000000000000004
    expect(sumBy([{ v: 0.1 }, { v: 0.2 }], (x) => x.v)).toBe(0.3);
  });

  it('空列表返回 0', () => {
    expect(sumBy([], () => 1)).toBe(0);
  });

  it('跳过非法项而不是产出 NaN', () => {
    expect(sumBy([{ v: 1 }, { v: null }, { v: undefined }, { v: 2 }], (x) => x.v)).toBe(3);
  });

  it('支持负数（车损赔偿走收入，冲销走负数）', () => {
    expect(sumBy([{ v: 100 }, { v: -30 }], (x) => x.v)).toBe(70);
  });

  it('台账真实数：哈弗H6 2025 年前 5 行结算金额求和', () => {
    const rows = [{ v: 377.4 }, { v: 1359.2605 }, { v: 180 }, { v: 3000 }, { v: 3000 }];
    expect(sumBy(rows, (x) => x.v)).toBe(7916.6605);
  });
});

describe('lib/money toRate', () => {
  it('保留合法费率', () => {
    expect(toRate(15)).toBe(15);
    expect(toRate(0)).toBe(0);
    expect(toRate(12.5)).toBe(12.5);
  });

  it('负数归 0，超过 100 截到 100', () => {
    expect(toRate(-1)).toBe(0);
    expect(toRate(101)).toBe(100);
  });

  it('非法值归 0', () => {
    expect(toRate(undefined)).toBe(0);
    expect(toRate('abc')).toBe(0);
  });
});
