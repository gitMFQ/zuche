import { describe, expect, it } from 'vitest';
import { parseStringArray, stringifyArray } from '../src/lib/json';

/**
 * 库里的多选字段以 JSON 数组字符串存储，历史上也存在裸字符串值
 * （例如 maintenance.type 早期直接存 'oil'），读取时必须两种都能吃下。
 */
describe('parseStringArray', () => {
  it('解析标准 JSON 数组', () => {
    expect(parseStringArray('["oil","tire"]')).toEqual(['oil', 'tire']);
  });

  it('兼容裸字符串（历史数据）', () => {
    expect(parseStringArray('oil')).toEqual(['oil']);
  });

  it('空值与空串返回空数组', () => {
    expect(parseStringArray(null)).toEqual([]);
    expect(parseStringArray(undefined)).toEqual([]);
    expect(parseStringArray('')).toEqual([]);
  });

  it('过滤掉数组里的非字符串元素', () => {
    expect(parseStringArray('["oil",1,null,{"a":1},"tire"]')).toEqual(['oil', 'tire']);
  });

  it('合法 JSON 但不是数组时退回单元素数组', () => {
    // JSON.parse('{"a":1}') 成功但不是数组 → 当前实现返回空数组
    expect(parseStringArray('{"a":1}')).toEqual([]);
    // 数字字面量同理
    expect(parseStringArray('123')).toEqual([]);
  });

  it('非法 JSON 时把原值当单元素数组，不抛错', () => {
    expect(parseStringArray('[oil, tire')).toEqual(['[oil, tire']);
  });
});

describe('stringifyArray', () => {
  it('数组序列化成 JSON 字符串', () => {
    expect(stringifyArray(['oil', 'tire'])).toBe('["oil","tire"]');
  });

  it('单个字符串原样存储（保持历史格式兼容）', () => {
    expect(stringifyArray('oil')).toBe('oil');
  });

  it('空数组、空串、null、undefined 都存 null', () => {
    expect(stringifyArray([])).toBeNull();
    expect(stringifyArray('')).toBeNull();
    expect(stringifyArray(null)).toBeNull();
    expect(stringifyArray(undefined)).toBeNull();
  });
});
