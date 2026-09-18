// 格式化日期，输出与 SQLite CURRENT_TIMESTAMP 一致：'YYYY-MM-DD HH:MM:SS'
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

// 获取当前时间
export function now(): string {
  return formatDate(new Date());
}
