import { now } from './time';

// 生成UUID（Workers 运行时提供 Web Crypto）
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 生成订单号：R + 北京日期(yyyyMMdd) + 6 位随机数。
 *
 * 早期是 4 位随机，按生日悖论，一天 120 单左右就有一半概率撞上 orders.order_no
 * 的唯一约束，撞上直接抛 500。这里随机段加长到 6 位（100 万种），
 * 调用方（createOrder）另有唯一冲突重试兜底。
 */
export function generateOrderNo(): string {
  const datePart = now().substring(0, 10).replace(/-/g, '');
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return `R${datePart}${String(random).padStart(6, '0')}`;
}
