import type { AppContext, AuthUser } from '../types';

/**
 * 获取客户端 IP。Workers 没有 Express 的 req.ip，
 * 优先取 Cloudflare 注入的 cf-connecting-ip，其次 x-forwarded-for。
 */
export function getClientIp(c: AppContext): string | null {
  const cfIp = c.req.header('cf-connecting-ip');
  if (cfIp) return cfIp;

  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    return first ? first.trim() : null;
  }

  return null;
}

// 取认证中间件注入的用户信息
export function getAuthUser(c: AppContext): AuthUser | undefined {
  return c.get('user');
}
