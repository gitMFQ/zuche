/**
 * 金额计算的公共底子。
 *
 * 为什么单独一个文件而不是塞进 orderAmount.ts：
 * orderAmount.ts 的 calcNetAmount 用 `Math.round`（**整元**），那是订单页展示口径；
 * 财务/结算台账必须保留台账的小数精度，两者混用会算出几毛到几块的差。
 * 这里只放财务口径的工具，且**只暴露一个舍入函数** —— 两套舍入口径并存正是
 * orderAmount.ts 注释里记录过的那类 bug 的根源。
 *
 * 精度为什么是 6 位而不是 2 位：
 * 三份车主结算台账里的「公司管理费」是 4 位小数 ——
 *   樊文 携程：702.95 × 15% = 105.4425，车主结算金额 = 702.95 − 105.4425 − 10 = 587.5075
 *   王旭洋携程：396.95 × 15% = 59.5425
 * 结算金额是 2 位小数，乘 15%（15/100）后最多产生 4 位小数；费率若不是整数
 * （如 12.5%）还会再多一位。取 6 位既能无损保留台账精度，又能消掉
 * IEEE754 的尾数噪音（394 × 0.15 在双精度下是 59.099999999999994）。
 * 用 2 位会把每一行都改掉半分，几百行累计后总额与台账对不上。
 */

/**
 * 金额保留的小数位。
 * 展示层再按需要格式化，**不要在写库前降到 2 位** —— 那等于丢台账精度。
 */
export const MONEY_SCALE = 6;

const SCALE_FACTOR = 10 ** MONEY_SCALE;

/**
 * 把任意输入收敛成有限数值，非法值（undefined / null / '' / 'abc' / NaN / Infinity）一律归 0。
 * 库里很多金额列是可空的，直接参与运算会得到 NaN 并一路污染到写库。
 */
export function toAmount(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 按 MONEY_SCALE 归整，负数向远离 0 的方向进位（-0.0000005 → -0.000001）。
 *
 * 加 1e-9 容差是为了消掉 IEEE754 的表示误差：
 * 1.005 * 100 在双精度下是 100.49999999999999，直接 Math.round 会少进一位。
 * 容差远小于真实的「不到半位」量级，不会把 1.0049999 误进位。
 *
 * 不用 Math.round(v * f) / f 的原因：Math.round 对 -0.5 是向 +∞ 取整，
 * 会导致负数金额与正数金额的进位方向不一致（-0.5 会算成 -0）。
 */
export function roundMoney(value: number | string | null | undefined): number {
  const v = toAmount(value);
  if (v === 0) return 0;
  const sign = v < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(v) * SCALE_FACTOR + 1e-9)) / SCALE_FACTOR;
}

/**
 * 求和并归整。
 * 逐项相加会累积浮点误差（0.1 + 0.2 = 0.30000000000000004），
 * 金额汇总必须先求和再舍入，不能边加边舍。
 */
export function sumBy<T>(list: readonly T[], pick: (item: T) => number | string | null | undefined): number {
  let total = 0;
  for (const item of list) {
    total += toAmount(pick(item));
  }
  return roundMoney(total);
}

/** 比率（百分数）归一到 [0, 100] 的有限数 */
export function toRate(value: number | string | null | undefined): number {
  const n = toAmount(value);
  if (n < 0) return 0;
  return n > 100 ? 100 : n;
}
