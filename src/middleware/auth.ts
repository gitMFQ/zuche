import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { verifyToken } from '../lib/auth';

// 验证 Token 中间件
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    return c.json({ success: false, message: '未提供认证令牌' }, 401);
  }

  const user = await verifyToken(token, c.env.JWT_SECRET);
  if (!user) {
    return c.json({ success: false, message: '令牌无效或已过期' }, 401);
  }

  c.set('user', user);
  await next();
};

// 管理员权限检查
export const adminOnly: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get('user')?.role !== 'admin') {
    return c.json({ success: false, message: '需要管理员权限' }, 403);
  }
  await next();
};
