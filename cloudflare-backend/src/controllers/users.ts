import { D1Database } from '@cloudflare/workers-types';
import { Env, query, queryOne, execute, queryWithPagination } from '../db/index.js';
import { hashPassword, generateUuid, errorResponse, successResponse, logAction } from '../utils/helpers.js';

// Get users list
export async function getUsersController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 10;
    const keyword = params.keyword || '';
    const role = params.role || '';
    const status = params.status !== undefined ? params.status : '';

    let sql = 'SELECT id, username, name, role, phone, email, status, created_at FROM users WHERE 1=1';
    const queryParams: any[] = [];

    if (keyword) {
      sql += ' AND (username LIKE ? OR name LIKE ? OR phone LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      queryParams.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (role) {
      sql += ' AND role = ?';
      queryParams.push(role);
    }

    if (status !== '') {
      sql += ' AND status = ?';
      queryParams.push(Number(status));
    }

    sql += ' ORDER BY created_at DESC';

    const result = await queryWithPagination(env.DB, sql, queryParams, page, pageSize);
    return successResponse(result);
  } catch (error) {
    console.error('Get users error:', error);
    return errorResponse('获取用户列表失败', 500);
  }
}

// Get single user
export async function getUserController(request: Request, env: Env, userId?: string, targetUserId?: string): Promise<Response> {
  try {
    if (!targetUserId) {
      return errorResponse('用户ID不能为空');
    }

    const user = await queryOne(env.DB, 'SELECT id, username, name, role, phone, email, status, created_at FROM users WHERE id = ?', [targetUserId]);

    if (!user) {
      return errorResponse('用户不存在', 404);
    }

    return successResponse(user);
  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse('获取用户信息失败', 500);
  }
}

// Create user
export async function createUserController(request: Request, env: Env, operatorId?: string): Promise<Response> {
  try {
    const body = await request.json();
    const { username, password, name, role = 'staff', phone, email } = body;

    if (!username || !password || !name) {
      return errorResponse('用户名、密码和姓名不能为空');
    }

    // Check if username exists
    const existing = await queryOne(env.DB, 'SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return errorResponse('用户名已存在');
    }

    const id = generateUuid();
    const hashedPassword = await hashPassword(password);
    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    await execute(
      env.DB,
      'INSERT INTO users (id, username, password, name, role, phone, email, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [id, username, hashedPassword, name, role, phone || null, email || null, currentTime, currentTime]
    );

    // Log action
    await logAction(env.DB, operatorId || null, '创建用户', 'user', id, `创建用户 ${name}（${role === 'admin' ? '管理员' : '员工'}）`);

    return successResponse(
      { id, username, name, role, phone, email },
      '用户创建成功'
    );
  } catch (error) {
    console.error('Create user error:', error);
    return errorResponse('创建用户失败', 500);
  }
}

// Update user
export async function updateUserController(request: Request, env: Env, operatorId?: string, targetUserId?: string): Promise<Response> {
  try {
    if (!targetUserId) {
      return errorResponse('用户ID不能为空');
    }

    const body = await request.json();
    const { name, role, phone, email, status } = body;

    const user = await queryOne(env.DB, 'SELECT id FROM users WHERE id = ?', [targetUserId]);
    if (!user) {
      return errorResponse('用户不存在', 404);
    }

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
    await execute(
      env.DB,
      'UPDATE users SET name = ?, role = ?, phone = ?, email = ?, status = ?, updated_at = ? WHERE id = ?',
      [name, role, phone || null, email || null, status, currentTime, targetUserId]
    );

    // Log action
    await logAction(env.DB, operatorId || null, '更新用户', 'user', targetUserId, `更新用户 ${name}`);

    return successResponse(null, '用户更新成功');
  } catch (error) {
    console.error('Update user error:', error);
    return errorResponse('更新用户失败', 500);
  }
}

// Delete user
export async function deleteUserController(request: Request, env: Env, operatorId?: string, targetUserId?: string): Promise<Response> {
  try {
    if (!targetUserId) {
      return errorResponse('用户ID不能为空');
    }

    if (operatorId === targetUserId) {
      return errorResponse('不能删除自己的账号');
    }

    const user = await queryOne(env.DB, 'SELECT id, name FROM users WHERE id = ?', [targetUserId]);
    if (!user) {
      return errorResponse('用户不存在', 404);
    }

    await execute(env.DB, 'DELETE FROM users WHERE id = ?', [targetUserId]);

    // Log action
    await logAction(env.DB, operatorId || null, '删除用户', 'user', targetUserId, `删除用户 ${(user as any).name || ''}`);

    return successResponse(null, '用户删除成功');
  } catch (error) {
    console.error('Delete user error:', error);
    return errorResponse('删除用户失败', 500);
  }
}

// Reset password
export async function resetPasswordController(request: Request, env: Env, operatorId?: string, targetUserId?: string): Promise<Response> {
  try {
    if (!targetUserId) {
      return errorResponse('用户ID不能为空');
    }

    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword) {
      return errorResponse('新密码不能为空');
    }

    const user = await queryOne(env.DB, 'SELECT id FROM users WHERE id = ?', [targetUserId]);
    if (!user) {
      return errorResponse('用户不存在', 404);
    }

    const hashedPassword = await hashPassword(newPassword);
    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
    await execute(
      env.DB,
      'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
      [hashedPassword, currentTime, targetUserId]
    );

    return successResponse(null, '密码重置成功');
  } catch (error) {
    console.error('Reset password error:', error);
    return errorResponse('重置密码失败', 500);
  }
}
