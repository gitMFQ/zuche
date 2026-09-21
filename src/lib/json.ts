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

/**
 * 入参可能是数组也可能是单个值，统一成存储用的字符串。
 *
 * 空数组返回 null 而不是 '[]'：多选字段语义上「一个都没选」就等于「未设置」，
 * 存 '[]' 会让 `if (!typeStr)` 这类校验失效 —— 保险类型提交空数组时
 * 曾因此绕过「类型不能为空」的校验，落库后显示成 '-'。
 */
export function stringifyArray(value: string[] | string | undefined | null): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) {
    return value.length === 0 ? null : JSON.stringify(value);
  }
  return value;
}
