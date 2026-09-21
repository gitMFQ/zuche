import { sign, verify } from 'hono/jwt';
import type { AuthUser } from '../types';

/**
 * bcrypt 代价因子。
 * 早期是 8（约 20ms，离线爆破成本偏低），而 seed 里的管理员密码是 cost 10，
 * 同一套代码里存在两套成本。统一为 10（约 80ms，仍在 Workers CPU 限制内）；
 * 12 约 300ms，有触碰 CPU 时间上限的风险，不建议。
 */
export const BCRYPT_COST = 10;

/**
 * JWT 有效期 7 天。
 * 早期是 1 年且无法吊销 —— 改密码、禁用、删除用户都拦不住旧 token。
 * 现在配合 users.token_version 实现吊销，有效期也顺势收短。
 */
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * 取签名密钥。
 *
 * 早期实现在 JWT_SECRET 缺失时回落到代码里写死的 DEFAULT_SECRET —— 那是公开仓库里的
 * 固定字符串，等于任何人都能伪造 token。这里改成直接抛错，让配置问题在部署时暴露，
 * 而不是线上静默降级成一个人人都知道的密钥。
 */
export function getSecret(provided?: string): string {
  if (!provided) {
    throw new Error('JWT_SECRET 未配置：请执行 npx wrangler secret put JWT_SECRET');
  }
  return provided;
}

export interface VerifiedToken {
  user: AuthUser;
  /** 签发时的 users.token_version，与当前值不一致说明令牌已被吊销 */
  tokenVersion: number;
}

// 生成 Token
export async function signToken(user: AuthUser, tokenVersion: number, secret?: string): Promise<string> {
  return sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      tv: tokenVersion,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
    },
    getSecret(secret),
    'HS256'
  );
}

/**
 * 校验 Token。
 * 注意 getSecret 必须放在 try 之外：密钥未配置属于部署错误，
 * 不能被当成「token 无效」吞掉，否则线上会表现成全员静默掉线、无从排查。
 */
export async function verifyToken(token: string, secret?: string): Promise<VerifiedToken | null> {
  const key = getSecret(secret);

  try {
    const payload = await verify(token, key, 'HS256');
    if (
      typeof payload.id === 'string' &&
      typeof payload.username === 'string' &&
      typeof payload.role === 'string' &&
      typeof payload.name === 'string'
    ) {
      return {
        user: {
          id: payload.id,
          username: payload.username,
          role: payload.role,
          name: payload.name
        },
        tokenVersion: typeof payload.tv === 'number' ? payload.tv : 0
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** 密码强度校验，通过返回 null，否则返回给用户看的错误文案 */
export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) return '密码至少 8 位';
  if (!/[A-Za-z]/.test(password)) return '密码必须包含字母';
  if (!/\d/.test(password)) return '密码必须包含数字';
  return null;
}
