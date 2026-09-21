/**
 * 订单金额计算。
 *
 * 之前 createOrder / updateOrder / extendOrder 各写一遍天数与净额的计算，
 * 而且口径不一致（createOrder 与 extendOrder 不做四舍五入，updateOrder 做），
 * 同一张单在不同路径下能算出相差几分钱的净额。这里统一成一处。
 */

const HOURS_PER_DAY = 24;

/**
 * 把 'YYYY-MM-DD HH:mm:ss'（或带 T 的变体）解析成毫秒时间戳。
 * 库里存的是不带时区的本地时间串，两端相减只关心差值，因此统一按本地时间解析。
 */
function parseLocalDateTime(value: string): number {
  if (!value) return NaN;
  return new Date(value.replace(' ', 'T')).getTime();
}

/**
 * 租期天数：按小时向上取整，至少 1 天。
 * 不满一天按一天算（与业务口径一致：当天取当天还也算一天）。
 */
export function calcRentalDays(startDate: string, endDate: string): number {
  const start = parseLocalDateTime(startDate);
  const end = parseLocalDateTime(endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;

  const hours = (end - start) / (1000 * 60 * 60);
  return Math.max(1, Math.ceil(hours / HOURS_PER_DAY));
}

/**
 * 到账净额 = 总租金 × (1 − 佣金比例/100)，四舍五入到元。
 * 平台单要扣掉渠道佣金，门店单 commissionRate 为 0 时净额等于总额。
 */
export function calcNetAmount(totalAmount: number, commissionRate: number): number {
  const rate = Number.isFinite(commissionRate) ? commissionRate : 0;
  return Math.round((totalAmount || 0) * (1 - rate / 100));
}

/**
 * 只给了总租金时反推日租金（取整到元）。
 */
export function calcDailyRate(totalAmount: number, days: number): number {
  if (!days) return 0;
  return Math.round((totalAmount || 0) / days);
}
