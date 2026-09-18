import { sign, verify } from 'hono/jwt';
import type { AuthUser } from '../types';

/** 与改造前保持一致，避免已签发的 token 全部失效 */
const DEFAULT_SECRET = 'rental-admin-secret-key-2026';

const ONE_YEAR = 60 * 60 * 24 * 365;

export function getSecret(provided?: string): string {
  return provided || DEFAULT_SECRET;
}

// 生成 Token，有效期 1 年
export async function signToken(user: AuthUser, secret?: string): Promise<string> {
  return sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + ONE_YEAR
    },
    getSecret(secret),
    'HS256'
  );
}

// 校验 Token，无效或过期返回 null
export async function verifyToken(token: string, secret?: string): Promise<AuthUser | null> {
  try {
    const payload = await verify(token, getSecret(secret), 'HS256');
    if (
      typeof payload.id === 'string' &&
      typeof payload.username === 'string' &&
      typeof payload.role === 'string' &&
      typeof payload.name === 'string'
    ) {
      return {
        id: payload.id,
        username: payload.username,
        role: payload.role,
        name: payload.name
      };
    }
    return null;
  } catch {
    return null;
  }
}
