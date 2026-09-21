import { hash } from 'bcryptjs';
import type { D1Database } from '@cloudflare/workers-types';
import { type Bind, execute, query, queryOne, queryWithPagination } from '../db/helpers';
import type { UserRow } from '../db/rows';
import { BCRYPT_COST, validatePassword } from '../lib/auth';
import { generateId } from '../lib/ids';
import { handleError } from '../lib/errors';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
import { now } from '../lib/time';
import type { AppContext } from '../types';

/** 允许的角色取值。写入前必须校验，否则可以把 role 改成任意字符串绕过 adminOnly */
const ROLE_WHITELIST = ['admin', 'staff'];

type PublicUser = Pick<UserRow, 'id' | 'username' | 'name' | 'role' | 'phone' | 'email' | 'status' | 'created_at'>;

/** 统计仍在启用状态的管理员数量，可选排除某个用户（用于「最后一个管理员」保护） */
async function countActiveAdmins(db: D1Database, excludeId?: string): Promise<number> {
  const row = await queryOne<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 1${excludeId ? ' AND id != ?' : ''}`,
    excludeId ? [excludeId] : []
  );
  return row?.count ?? 0;
}

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

/**
 * 仅返回 id 与姓名的用户选项，供司机指派等只需要选人的场景使用。
 *
 * GET /users 是 adminOnly（列表含手机号、邮箱），但指派司机是员工的日常操作，
 * 员工打开指派弹窗会拿到 403、下拉框是空的。这里只暴露 id/name，权限放宽到登录即可。
 */
export async function getUserOptions(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const users = await query<{ id: string; name: string }>(
      db,
      'SELECT id, name FROM users WHERE status = 1 ORDER BY name'
    );
    return c.json({ success: true, data: users });
  } catch (error) {
    return handleError(c, '获取用户选项错误:', error);
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

    if (!ROLE_WHITELIST.includes(role)) {
      return c.json({ success: false, message: '角色只能是管理员或员工' }, 400);
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return c.json({ success: false, message: passwordError }, 400);
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
    const body = await c.req.json<{
      name?: string;
      role?: string;
      phone?: string;
      email?: string;
      status?: number;
    }>();

    const user = await queryOne<UserRow>(db, 'SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }

    if (body.role !== undefined && !ROLE_WHITELIST.includes(body.role)) {
      return c.json({ success: false, message: '角色只能是管理员或员工' }, 400);
    }

    const isSelf = id === getAuthUser(c)?.id;
    const changingRole = body.role !== undefined && body.role !== user.role;
    const changingStatus = body.status !== undefined && Number(body.status) !== user.status;

    // 不允许改自己的角色或启用状态：否则可能把自己降级/禁用，直接失去管理入口
    if (isSelf && (changingRole || changingStatus)) {
      return c.json({ success: false, message: '不能修改自己的角色或启用状态' }, 400);
    }

    // 保护最后一个启用中的管理员：降级或禁用后系统不能没有任何管理员
    const losesAdmin =
      user.role === 'admin' &&
      user.status === 1 &&
      ((changingRole && body.role !== 'admin') || (changingStatus && Number(body.status) !== 1));
    if (losesAdmin) {
      const remaining = await countActiveAdmins(db, id);
      if (remaining === 0) {
        return c.json({ success: false, message: '系统必须保留至少一个启用状态的管理员' }, 400);
      }
    }

    const nextRole = body.role ?? user.role;
    const nextStatus = body.status !== undefined ? Number(body.status) : user.status;
    // 角色或启用状态变化时吊销该用户的令牌：否则被降级/禁用的账号
    // 可以继续拿着旧 token 按旧权限访问，直到 token 自然过期
    const revokeTokens = changingRole || changingStatus;

    await execute(
      db,
      `UPDATE users SET name = ?, role = ?, phone = ?, email = ?, status = ?,
         token_version = token_version + ?, updated_at = ? WHERE id = ?`,
      [
        body.name ?? user.name,
        nextRole,
        body.phone !== undefined ? body.phone || null : user.phone,
        body.email !== undefined ? body.email || null : user.email,
        nextStatus,
        revokeTokens ? 1 : 0,
        now(),
        id
      ]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '更新用户',
      entityType: 'user',
      entityId: id,
      details: `更新用户 ${body.name ?? user.name}`,
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

    const user = await queryOne<UserRow>(db, 'SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }

    // orders.user_id 没有外键（允许删除只有已完成/已取消订单的车辆与用户），
    // 但删掉用户会让历史订单的经办人变成悬空引用、日志里的操作人也查不到。
    // 有历史订单时改为提示禁用，保留可追溯性。
    const orderCount = await queryOne<{ count: number }>(
      db,
      'SELECT COUNT(*) AS count FROM orders WHERE user_id = ?',
      [id]
    );
    const orders = orderCount?.count ?? 0;
    if (orders > 0) {
      return c.json(
        {
          success: false,
          message: `该用户名下有 ${orders} 条历史订单，不能删除。如需停止使用，请把状态改为「禁用」。`
        },
        400
      );
    }

    // 保护最后一个启用中的管理员
    if (user.role === 'admin' && user.status === 1) {
      const remaining = await countActiveAdmins(db, id);
      if (remaining === 0) {
        return c.json({ success: false, message: '系统必须保留至少一个启用状态的管理员' }, 400);
      }
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

// 重置密码（管理员操作）
export async function resetPassword(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const { newPassword } = await c.req.json<{ newPassword?: string }>();

    if (!newPassword) {
      return c.json({ success: false, message: '新密码不能为空' }, 400);
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return c.json({ success: false, message: passwordError }, 400);
    }

    const user = await queryOne<UserRow>(db, 'SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }

    const hashedPassword = await hash(newPassword, BCRYPT_COST);
    // 重置密码必须吊销旧 token（否则被盗号者手里的 token 依然有效），
    // 并标记为需要改密：管理员设置的临时密码不应长期使用。
    await execute(
      db,
      `UPDATE users SET password = ?, must_change_password = 1,
         token_version = token_version + 1, updated_at = ? WHERE id = ?`,
      [hashedPassword, now(), id]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '重置密码',
      entityType: 'user',
      entityId: id,
      details: `重置用户 ${user.name} 的密码`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    return handleError(c, '重置密码错误:', error);
  }
}
