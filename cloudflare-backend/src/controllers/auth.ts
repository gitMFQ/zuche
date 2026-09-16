import { D1Database } from '@cloudflare/workers-types';
import { Env, queryOne } from '../db/index.js';
import { generateToken } from '../middleware/auth.js';
import { comparePassword, logAction, generateUuid, errorResponse, successResponse } from '../utils/helpers.js';

export async function loginController(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const { username, password } = body;
    
    if (!username || !password) {
      return errorResponse('用户名和密码不能为空');
    }
    
    const user = await queryOne(env.DB, 'SELECT * FROM users WHERE username = ? AND status = 1', [username]);
    
    if (!user) {
      return errorResponse('用户名或密码错误', 401);
    }
    
    const isValid = await comparePassword(password, (user as any).password);
    
    if (!isValid) {
      return errorResponse('用户名或密码错误', 401);
    }
    
    const token = await generateToken({
      userId: (user as any).id,
      username: (user as any).username,
      role: (user as any).role
    }, env.JWT_SECRET);
    
    // Log action
    await logAction(env.DB, (user as any).id, 'login', 'user', (user as any).id, 'User logged in');
    
    return successResponse({
      token,
      user: {
        id: (user as any).id,
        username: (user as any).username,
        name: (user as any).name,
        role: (user as any).role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('登录失败', 500);
  }
}

export async function getCurrentUserController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    if (!userId) {
      return errorResponse('未授权', 401);
    }
    
    const user = await queryOne(env.DB, 'SELECT id, username, name, role, phone, email, status FROM users WHERE id = ?', [userId]);
    
    if (!user) {
      return errorResponse('用户不存在', 404);
    }
    
    return successResponse(user);
  } catch (error) {
    console.error('Get current user error:', error);
    return errorResponse('获取用户信息失败', 500);
  }
}

export async function changePasswordController(
  request: Request, 
  env: Env, 
  userId?: string
): Promise<Response> {
  try {
    if (!userId) {
      return errorResponse('未授权', 401);
    }
    
    const body = await request.json();
    const { oldPassword, newPassword } = body;
    
    if (!oldPassword || !newPassword) {
      return errorResponse('旧密码和新密码不能为空');
    }
    
    const user = await queryOne(env.DB, 'SELECT * FROM users WHERE id = ?', [userId]);
    
    if (!user) {
      return errorResponse('用户不存在', 404);
    }
    
    const isValid = await comparePassword(oldPassword, (user as any).password);
    
    if (!isValid) {
      return errorResponse('旧密码错误');
    }
    
    const hashedPassword = await hashPassword(newPassword);
    await env.DB.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(hashedPassword, userId)
      .run();
    
    await logAction(env.DB, userId, 'change_password', 'user', userId, 'User changed password');
    
    return successResponse(null, '密码修改成功');
  } catch (error) {
    console.error('Change password error:', error);
    return errorResponse('修改密码失败', 500);
  }
}

// Import hashPassword locally since it's not exported from helpers in this file
async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 10);
}
