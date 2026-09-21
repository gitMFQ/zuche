import { compare, hash } from 'bcryptjs';
import type { D1Database } from '@cloudflare/workers-types';
import { execute, queryOne } from '../db/helpers';
import type { UserRow } from '../db/rows';
import { BCRYPT_COST, signToken, validatePassword } from '../lib/auth';
import { handleError } from '../lib/errors';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
import { dateTimeOffsetMinutes, now } from '../lib/time';
import type { AppContext } from '../types';

interface LoginBody {
  username?: string;
  password?: string;
}

interface LoginAttemptRow {
  key: string;
  count: number;
  first_at: string;
  locked_until: string | null;
}

/** 限流窗口内允许的失败次数 */
const LOGIN_MAX_FAILURES = 5;
/** 失败计数窗口（分钟），超出窗口的历史失败不再累计 */
const LOGIN_WINDOW_MINUTES = 15;
/** 达到阈值后的锁定时长（分钟） */
const LOGIN_LOCK_MINUTES = 15;

/**
 * 限流维度是 username:IP。
 * 门店常共用同一个出口 IP，只按 IP 限流会互相误伤；只按 username 又拦不住换号撞库。
 */
function attemptKey(username: string, ip: string | null): string {
  return `${username.trim().toLowerCase()}:${ip ?? 'unknown'}`;
}

/** 记录一次登录失败，达到阈值则锁定一段时间 */
async function recordLoginFailure(db: D1Database, key: string, currentTime: string): Promise<void> {
  const record = await queryOne<LoginAttemptRow>(db, 'SELECT * FROM login_attempts WHERE key = ?', [key]);
  const windowStart = dateTimeOffsetMinutes(-LOGIN_WINDOW_MINUTES);

  // 没有记录、或上次计数已在窗口之外，则重新开始计数
  if (!record || record.first_at < windowStart) {
    await execute(
      db,
      `INSERT INTO login_attempts (key, count, first_at, locked_until) VALUES (?, 1, ?, NULL)
       ON CONFLICT(key) DO UPDATE SET count = 1, first_at = excluded.first_at, locked_until = NULL`,
      [key, currentTime]
    );
    return;
  }

  const nextCount = (record.count || 0) + 1;
  const lockedUntil = nextCount >= LOGIN_MAX_FAILURES ? dateTimeOffsetMinutes(LOGIN_LOCK_MINUTES) : null;

  await execute(db, 'UPDATE login_attempts SET count = ?, locked_until = ? WHERE key = ?', [
    nextCount,
    lockedUntil,
    key
  ]);
}

/** 登录成功后清空失败计数 */
async function clearLoginFailures(db: D1Database, key: string): Promise<void> {
  await execute(db, 'DELETE FROM login_attempts WHERE key = ?', [key]);
}

// 登录
export async function login(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { username, password } = await c.req.json<LoginBody>();

    if (!username || !password) {
      return c.json({ success: false, message: '账号和密码不能为空' }, 400);
    }

    const ip = getClientIp(c);
    const key = attemptKey(username, ip);
    const currentTime = now();

    // 限流检查
    const attempt = await queryOne<LoginAttemptRow>(db, 'SELECT * FROM login_attempts WHERE key = ?', [key]);
    if (attempt?.locked_until && attempt.locked_until > currentTime) {
      return c.json(
        {
          success: false,
          message: `失败次数过多，请于 ${attempt.locked_until.substring(11, 16)} 后重试`
        },
        429
      );
    }

    // 支持用户名、姓名、手机号、邮箱登录
    const user = await queryOne<UserRow>(
      db,
      'SELECT * FROM users WHERE (username = ? OR name = ? OR phone = ? OR email = ?) AND status = 1',
      [username, username, username, username]
    );

    if (!user) {
      await recordLoginFailure(db, key, currentTime);
      // 失败登录也要留痕，否则被撞库时没有任何线索
      await logAction(db, {
        userId: '',
        action: '登录失败',
        entityType: 'user',
        details: `账号不存在或已禁用：${username}`,
        ipAddress: ip
      });
      return c.json({ success: false, message: '账号不存在或已禁用' }, 401);
    }

    const isValidPassword = await compare(password, user.password);
    if (!isValidPassword) {
      await recordLoginFailure(db, key, currentTime);
      await logAction(db, {
        userId: user.id,
        action: '登录失败',
        entityType: 'user',
        entityId: user.id,
        details: `密码错误：${user.name}`,
        ipAddress: ip
      });
      return c.json({ success: false, message: '密码错误' }, 401);
    }

    await clearLoginFailures(db, key);

    const token = await signToken(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      user.token_version ?? 0,
      c.env.JWT_SECRET
    );

    // 记录登录日志
    await logAction(db, {
      userId: user.id,
      action: '登录',
      entityType: 'user',
      entityId: user.id,
      details: `用户 ${user.name} 登录系统`,
      ipAddress: ip
    });

    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          phone: user.phone,
          email: user.email
        },
        // 默认口令（admin123）是公开的，必须强制改掉，前端据此跳转改密
        must_change_password: (user.must_change_password ?? 0) === 1
      }
    });
  } catch (error) {
    return handleError(c, '登录错误:', error);
  }
}

// 获取当前用户信息
export async function getCurrentUser(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const authUser = getAuthUser(c);
    if (!authUser) {
      return c.json({ success: false, message: '未登录' }, 401);
    }

    const user = await queryOne<UserRow>(
      db,
      'SELECT id, username, name, role, phone, email, status, created_at, must_change_password FROM users WHERE id = ?',
      [authUser.id]
    );

    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...user,
        must_change_password: (user.must_change_password ?? 0) === 1
      }
    });
  } catch (error) {
    return handleError(c, '获取当前用户错误:', error);
  }
}

// 修改自己的密码
export async function changePassword(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const authUser = getAuthUser(c);
    if (!authUser) {
      return c.json({ success: false, message: '未登录' }, 401);
    }

    const { oldPassword, newPassword } = await c.req.json<{ oldPassword?: string; newPassword?: string }>();

    if (!oldPassword || !newPassword) {
      return c.json({ success: false, message: '原密码和新密码不能为空' }, 400);
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return c.json({ success: false, message: passwordError }, 400);
    }

    const user = await queryOne<UserRow>(db, 'SELECT * FROM users WHERE id = ?', [authUser.id]);
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }

    const isValid = await compare(oldPassword, user.password);
    if (!isValid) {
      return c.json({ success: false, message: '原密码错误' }, 400);
    }

    const hashedPassword = await hash(newPassword, BCRYPT_COST);
    // 自增 token_version 会让该账号所有已签发的 token 立即失效，
    // 因此同时签发一个新 token 返回，当前会话不用被迫重新登录。
    const nextTokenVersion = (user.token_version ?? 0) + 1;

    await execute(
      db,
      'UPDATE users SET password = ?, must_change_password = 0, token_version = ?, updated_at = ? WHERE id = ?',
      [hashedPassword, nextTokenVersion, now(), user.id]
    );

    const token = await signToken(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      nextTokenVersion,
      c.env.JWT_SECRET
    );

    await logAction(db, {
      userId: user.id,
      action: '修改密码',
      entityType: 'user',
      entityId: user.id,
      details: `用户 ${user.name} 修改密码`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, data: { token }, message: '密码修改成功' });
  } catch (error) {
    return handleError(c, '修改密码错误:', error);
  }
}

/**
 * 退出登录。
 *
 * token 存在 localStorage，客户端清掉即完成登出，服务端这里只落一条审计日志。
 * 刻意不自增 token_version —— 那会把该账号在其它设备上的会话一并踢掉，
 * 门店经常手机和电脑同时在线，属于意料之外的副作用。
 * 「退出所有设备」应当作为独立动作提供。
 */
export async function logout(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const authUser = getAuthUser(c);

    await logAction(db, {
      userId: authUser?.id ?? '',
      action: '登出',
      entityType: 'user',
      entityId: authUser?.id,
      details: `用户 ${authUser?.name ?? ''} 退出登录`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '已退出登录' });
  } catch (error) {
    return handleError(c, '退出登录错误:', error);
  }
}
