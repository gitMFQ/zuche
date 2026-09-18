import { hash } from 'bcryptjs';
import { type Bind, execute, queryOne, queryWithPagination } from '../db/helpers';
import type { UserRow } from '../db/rows';
import { generateId } from '../lib/ids';
import { handleError } from '../lib/errors';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
import { now } from '../lib/time';
import type { AppContext } from '../types';

const BCRYPT_COST = 8;

type PublicUser = Pick<UserRow, 'id' | 'username' | 'name' | 'role' | 'phone' | 'email' | 'status' | 'created_at'>;

// 获取用户列表
export async function getUsers(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { page = '1', pageSize = '10', keyword = '', role = '', status = '' } = c.req.query();

    let sql = 'SELECT id, username, name, role, phone, email, status, created_at FROM users WHERE 1=1';
    const params: Bind[] = [];

    if (keyword) {
      sql += ' AND (username LIKE ? OR name LIKE ? OR phone LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }

    if (status !== '') {
      sql += ' AND status = ?';
      params.push(Number(status));
    }

    sql += ' ORDER BY created_at DESC';

    const result = await queryWithPagination<PublicUser>(db, sql, params, Number(page), Number(pageSize));
    return c.json({ success: true, data: result });
  } catch (error) {
    return handleError(c, '获取用户列表错误:', error);
  }
}

// 获取单个用户
export async function getUser(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const user = await queryOne<PublicUser>(
      db,
      'SELECT id, username, name, role, phone, email, status, created_at FROM users WHERE id = ?',
      [id]
    );

    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }

    return c.json({ success: true, data: user });
  } catch (error) {
    return handleError(c, '获取用户错误:', error);
  }
}

// 创建用户
export async function createUser(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { username, password, name, role = 'staff', phone, email } = await c.req.json<{
      username?: string;
      password?: string;
      name?: string;
      role?: string;
      phone?: string;
      email?: string;
    }>();

    if (!username || !password || !name) {
      return c.json({ success: false, message: '用户名、密码和姓名不能为空' }, 400);
    }

    // 检查用户名是否已存在
    const existing = await queryOne<{ id: string }>(db, 'SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return c.json({ success: false, message: '用户名已存在' }, 400);
    }

    const id = generateId();
    const hashedPassword = await hash(password, BCRYPT_COST);
    const currentTime = now();

    await execute(
      db,
      'INSERT INTO users (id, username, password, name, role, phone, email, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [id, username, hashedPassword, name, role, phone ?? null, email ?? null, currentTime, currentTime]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '创建用户',
      entityType: 'user',
      entityId: id,
      details: `创建用户 ${name}（${role === 'admin' ? '管理员' : '员工'}）`,
      ipAddress: getClientIp(c)
    });

    return c.json({
      success: true,
      data: { id, username, name, role, phone, email },
      message: '用户创建成功'
    });
  } catch (error) {
    return handleError(c, '创建用户错误:', error);
  }
}

// 更新用户
export async function updateUser(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const { name, role, phone, email, status } = await c.req.json<{
      name?: string;
      role?: string;
      phone?: string;
      email?: string;
      status?: number;
    }>();

    const user = await queryOne<{ id: string }>(db, 'SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }

    await execute(
      db,
      'UPDATE users SET name = ?, role = ?, phone = ?, email = ?, status = ?, updated_at = ? WHERE id = ?',
      [name, role, phone ?? null, email ?? null, status, now(), id]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '更新用户',
      entityType: 'user',
      entityId: id,
      details: `更新用户 ${name}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '用户更新成功' });
  } catch (error) {
    return handleError(c, '更新用户错误:', error);
  }
}

// 删除用户
export async function deleteUser(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');

    if (id === getAuthUser(c)?.id) {
      return c.json({ success: false, message: '不能删除自己的账号' }, 400);
    }

    const user = await queryOne<{ id: string; name: string }>(db, 'SELECT id, name FROM users WHERE id = ?', [id]);
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }

    await execute(db, 'DELETE FROM users WHERE id = ?', [id]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除用户',
      entityType: 'user',
      entityId: id,
      details: `删除用户 ${user.name}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    return handleError(c, '删除用户错误:', error);
  }
}

// 重置密码
export async function resetPassword(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const { newPassword } = await c.req.json<{ newPassword?: string }>();

    if (!newPassword) {
      return c.json({ success: false, message: '新密码不能为空' }, 400);
    }

    const user = await queryOne<{ id: string }>(db, 'SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }

    const hashedPassword = await hash(newPassword, BCRYPT_COST);
    await execute(db, 'UPDATE users SET password = ?, updated_at = ? WHERE id = ?', [hashedPassword, now(), id]);

    return c.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    return handleError(c, '重置密码错误:', error);
  }
}
