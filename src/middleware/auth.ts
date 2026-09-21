import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { queryOne } from '../db/helpers';
import { type VerifiedToken, verifyToken } from '../lib/auth';

// 验证 Token 中间件
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    return c.json({ success: false, message: '未提供认证令牌' }, 401);
  }

  let verified: VerifiedToken | null;
  try {
    verified = await verifyToken(token, c.env.JWT_SECRET);
  } catch (error) {
    // JWT_SECRET 未配置等部署错误：明确报 500，不要伪装成「令牌无效」，
    // 否则线上会表现成全员静默掉线，排查方向会被带偏。
    console.error('鉴权配置错误:', error);
    return c.json({ success: false, message: '服务未正确配置，请联系管理员' }, 500);
  }

  if (!verified) {
    return c.json({ success: false, message: '令牌无效或已过期' }, 401);
  }

  // 令牌吊销 + 账号状态：改密码 / 重置密码 / 禁用 / 删除用户会自增 users.token_version，
  // 版本对不上说明 token 已作废。顺带校验账号仍然启用（禁用后旧 token 立即失效）。
  const record = await queryOne<{ token_version: number; status: number }>(
    c.env.DB,
    'SELECT token_version, status FROM users WHERE id = ?',
    [verified.user.id]
  );

  if (!record) {
    return c.json({ success: false, message: '账号不存在或已被删除' }, 401);
  }
  if (record.status !== 1) {
    return c.json({ success: false, message: '账号已被禁用' }, 401);
  }
  if ((record.token_version ?? 0) !== verified.tokenVersion) {
    return c.json({ success: false, message: '登录状态已失效，请重新登录' }, 401);
  }

  c.set('user', verified.user);
  await next();
};

// 管理员权限检查
export const adminOnly: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get('user')?.role !== 'admin') {
    return c.json({ success: false, message: '需要管理员权限' }, 403);
  }
  await next();
};
