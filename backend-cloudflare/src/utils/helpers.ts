// 辅助函数

/**
 * 格式化日期
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * 生成随机 ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 计算日期差 (天)
 */
export function daysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 计算佣金
 */
export function calculateCommission(amount: number, rate: number): number {
  return amount * (rate / 100);
}

/**
 * 计算净收入
 */
export function calculateNetAmount(amount: number, commissionRate: number): number {
  return amount * (1 - commissionRate / 100);
}
