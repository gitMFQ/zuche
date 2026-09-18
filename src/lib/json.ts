/**
 * 库里的多选字段以 JSON 数组字符串存储，历史上也存在裸字符串值，
 * 因此解析失败时降级为「把原值当成单元素数组」。
 */
export function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [raw];
  }
}

/** 入参可能是数组也可能是单个值，统一成存储用的字符串 */
export function stringifyArray(value: string[] | string | undefined | null): string | null {
  if (value === undefined || value === null || value === '') return null;
  return Array.isArray(value) ? JSON.stringify(value) : value;
}
