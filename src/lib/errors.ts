import type { AppContext } from '../types';

/**
 * 统一的错误处理出口，替代各 controller 里重复的
 * `console.error(...); res.status(500).json({ success: false, message: '服务器错误' })`。
 *
 * D1 的外键约束始终开启，违反时会抛 FOREIGN KEY constraint failed；
 * 这类错误属于业务校验范畴，翻译回 400 而不是 500。
 */
export function handleError(c: AppContext, label: string, error: unknown, fallbackMessage = '服务器错误'): Response {
  console.error(label, error);

  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('FOREIGN KEY constraint failed')) {
    return c.json({ success: false, message: '该记录已被业务数据引用，无法删除' }, 400);
  }

  return c.json({ success: false, message: fallbackMessage }, 500);
}
