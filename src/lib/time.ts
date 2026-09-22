/**
 * 全系统统一以北京时间为准（Asia/Shanghai，无夏令时，固定 +8）。
 *
 * Workers 运行时是 UTC，早期实现直接 toISOString()，导致系统写入的时间是 UTC、
 * 而用户通过 datetime-local 录入的时间是北京时间，同库两套基准：
 *   - 车辆「是否在租」判定用 UTC 比北京时间，实际在租的车会显示可用
 *   - 调度列表边界错 8 小时
 *   - 前端按本地时间解析 UTC 串，创建时间/日志时间全部显示早 8 小时
 *
 * 现在 now() 返回北京时间，SQL 侧对应使用 datetime('now','+8 hours')。
 */

const CN_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// 格式化日期，输出 'YYYY-MM-DD HH:MM:SS'
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

// 获取当前北京时间
export function now(): string {
  return formatDate(new Date(Date.now() + CN_OFFSET_MS));
}

// 当前北京日期 'YYYY-MM-DD'
export function today(): string {
  return now().substring(0, 10);
}

// 北京日期偏移 N 天后的 'YYYY-MM-DD'
export function dateOffset(days: number): string {
  return formatDate(new Date(Date.now() + CN_OFFSET_MS + days * DAY_MS)).substring(0, 10);
}

// 北京时间偏移 N 分钟后的完整时间戳（用于登录锁定等短周期场景）
export function dateTimeOffsetMinutes(minutes: number): string {
  return formatDate(new Date(Date.now() + CN_OFFSET_MS + minutes * 60 * 1000));
}

/**
 * 北京时间的本月起止边界，用于替代 `strftime('%Y-%m', x) = strftime('%Y-%m','now')`。
 * 那个写法无法命中索引，改成本函数产生的范围比较后可以走索引。
 */
export function monthRange(): { start: string; end: string } {
  const cn = new Date(Date.now() + CN_OFFSET_MS);
  const year = cn.getUTCFullYear();
  const month = cn.getUTCMonth();
  return {
    start: formatDate(new Date(Date.UTC(year, month, 1))),
    end: formatDate(new Date(Date.UTC(year, month + 1, 1)))
  };
}

/** 北京时间本年起止边界 */
export function yearRange(): { start: string; end: string } {
  const cn = new Date(Date.now() + CN_OFFSET_MS);
  const year = cn.getUTCFullYear();
  return {
    start: formatDate(new Date(Date.UTC(year, 0, 1))),
    end: formatDate(new Date(Date.UTC(year + 1, 0, 1)))
  };
}

/**
 * 把 'YYYY-MM-DDTHH:mm' 规整成存储格式 'YYYY-MM-DD HH:mm:ss'。
 * 空串统一转成 null：调用方普遍写成 `normalizeDateTime(x) ?? currentTime`，
 * 若空串原样返回，`?? ` 不会生效，库里会存进一个空字符串。
 */
export function normalizeDateTime(input: string | null | undefined): string | null {
  if (!input) return null;
  const withSpace = input.replace('T', ' ');
  return withSpace.length === 16 ? `${withSpace}:00` : withSpace;
}

/**
 * 取出日期/时间串所属的账期 'YYYY-MM'。
 * 财务模块用它做月度归属（`settlement_lines.period`、`operating_expenses` 的月份筛选）。
 * 格式不符时返回空串，由调用方决定是报错还是兜底。
 */
export function periodOf(date: string | null | undefined): string {
  const value = (date ?? '').trim();
  return /^\d{4}-\d{2}/.test(value) ? value.substring(0, 7) : '';
}

/** 账期 'YYYY-MM' 是否合法 */
export function isPeriod(value: string | null | undefined): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test((value ?? '').trim());
}

/**
 * 账期偏移 N 个月，返回 'YYYY-MM'。
 * 输入非法时返回空串 —— 财务写路径会先 isPeriod 校验，这里不抛错是为了让报表查询能安全兜底。
 */
export function addMonths(period: string | null | undefined, months: number): string {
  const value = periodOf(period);
  if (!isPeriod(value)) return '';
  const year = Number(value.substring(0, 4));
  const month = Number(value.substring(5, 7));
  const total = year * 12 + (month - 1) + (Number.isFinite(months) ? Math.trunc(months) : 0);
  const nextYear = Math.floor(total / 12);
  const nextMonth = total - nextYear * 12 + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`;
}

/**
 * 指定账期的起止边界，半开区间 [start, end)，与 monthRange() 同风格。
 * 半开区间让 `>= start AND < end` 能走索引，避免 `strftime('%Y-%m', x) = ?` 的全表扫描。
 */
export function monthRangeOf(period: string | null | undefined): { start: string; end: string } {
  const value = periodOf(period);
  const next = addMonths(value, 1);
  if (!isPeriod(value) || !next) return { start: '', end: '' };
  return { start: `${value}-01 00:00:00`, end: `${next}-01 00:00:00` };
}

/** 取日期串所属年份（财务上的「年」即自然年），非法时返回 0 */
export function fiscalYearOf(date: string | null | undefined): number {
  const value = (date ?? '').trim();
  return /^\d{4}/.test(value) ? Number(value.substring(0, 4)) : 0;
}
