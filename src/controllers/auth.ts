import { compare, hash } from 'bcryptjs';
import { execute, queryOne } from '../db/helpers';
import type { UserRow } from '../db/rows';
import { signToken } from '../lib/auth';
import { handleError } from '../lib/errors';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
import { now } from '../lib/time';
import type { AppContext } from '../types';

const BCRYPT_COST = 8;

interface LoginBody {
  username?: string;
  password?: string;
}

// 登录
export async function login(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { username, password } = await c.req.json<LoginBody>();

    if (!username || !password) {
      return c.json({ success: false, message: '账号和密码不能为空' }, 400);
    }

    // 支持用户名、姓名、手机号、邮箱登录
    const user = await queryOne<UserRow>(
      db,
      'SELECT * FROM users WHERE (username = ? OR name = ? OR phone = ? OR email = ?) AND status = 1',
      [username, username, username, username]
    );

    if (!user) {
      return c.json({ success: false, message: '账号不存在或已禁用' }, 401);
    }

    const isValidPassword = await compare(password, user.password);
    if (!isValidPassword) {
      return c.json({ success: false, message: '密码错误' }, 401);
    }

    const token = await signToken(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      c.env.JWT_SECRET
    );

    // 记录登录日志
    await logAction(db, {
      userId: user.id,
      action: '登录',
      entityType: 'user',
      entityId: user.id,
      details: `用户 ${user.name} 登录系统`,
      ipAddress: getClientIp(c)
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
        }
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
    const userId = getAuthUser(c)?.id;
    const user = await queryOne<UserRow>(
      db,
      'SELECT id, username, name, role, phone, email, status, created_at FROM users WHERE id = ?',
      [userId ?? null]
    );

    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }

    return c.json({ success: true, data: user });
  } catch (error) {
    return handleError(c, '获取当前用户错误:', error);
  }
}

// 修改密码
export async function changePassword(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { oldPassword, newPassword } = await c.req.json<{ oldPassword?: string; newPassword?: string }>();
    const userId = getAuthUser(c)?.id;

    if (!oldPassword || !newPassword) {
      return c.json({ success: false, message: '旧密码和新密码不能为空' }, 400);
    }

    const user = await queryOne<Pick<UserRow, 'password'>>(db, 'SELECT password FROM users WHERE id = ?', [
      userId ?? null
    ]);
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }

    const isValid = await compare(oldPassword, user.password);
    if (!isValid) {
      return c.json({ success: false, message: '旧密码错误' }, 400);
    }

    const hashedPassword = await hash(newPassword, BCRYPT_COST);
    await execute(db, 'UPDATE users SET password = ?, updated_at = ? WHERE id = ?', [
      hashedPassword,
      now(),
      userId ?? null
    ]);

    return c.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    return handleError(c, '修改密码错误:', error);
  }
}
