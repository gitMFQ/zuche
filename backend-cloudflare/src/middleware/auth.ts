import { Hono } from 'hono';
import { sign, verify } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export interface JWTPayload {
  id: string;
  username: string;
  role: string;
}

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}

// 认证中间件
export async function authMiddleware(c: any, next: Function) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ 
      success: false, 
      message: '未提供认证令牌' 
    }, 401);
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const secret = (c.env as Env).JWT_SECRET || 'default-secret';
    const payload = verify(token, secret) as JWTPayload;
    
    // 将用户信息附加到上下文
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ 
      success: false, 
      message: '无效的认证令牌' 
    }, 401);
  }
}

// 管理员权限检查
export async function adminOnly(c: any, next: Function) {
  const user = c.get('user');
  
  if (!user || user.role !== 'admin') {
    return c.json({ 
      success: false, 
      message: '需要管理员权限' 
    }, 403);
  }
  
  await next();
}

// 登录
export const login = async (c: any) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;
    
    if (!username || !password) {
      return c.json({ 
        success: false, 
        message: '用户名和密码不能为空' 
      }, 400);
    }
    
    const db = (c.env as Env).DB;
    
    // 查询用户
    const user = await db.prepare(
      'SELECT * FROM users WHERE username = ? AND status = 1'
    ).bind(username).first();
    
    if (!user) {
      return c.json({ 
        success: false, 
        message: '用户名或密码错误' 
      }, 401);
    }
    
    // 验证密码
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return c.json({ 
        success: false, 
        message: '用户名或密码错误' 
      }, 401);
    }
    
    // 生成 JWT
    const secret = (c.env as Env).JWT_SECRET || 'default-secret';
    const token = sign(
      { id: user.id, username: user.username, role: user.role },
      secret,
      { expiresIn: '365d' }
    );
    
    // 返回用户信息（不包含密码）
    const { password: _, ...userInfo } = user;
    
    return c.json({
      success: true,
      data: {
        token,
        user: userInfo
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    return c.json({ 
      success: false, 
      message: '服务器内部错误' 
    }, 500);
  }
};

// 获取当前用户
export const getCurrentUser = async (c: any) => {
  try {
    const user = c.get('user');
    const db = (c.env as Env).DB;
    
    const userData = await db.prepare(
      'SELECT id, username, name, role, phone, email, status, created_at, updated_at FROM users WHERE id = ?'
    ).bind(user.id).first();
    
    if (!userData) {
      return c.json({ 
        success: false, 
        message: '用户不存在' 
      }, 404);
    }
    
    return c.json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return c.json({ 
      success: false, 
      message: '服务器内部错误' 
    }, 500);
  }
};

// 修改密码
export const changePassword = async (c: any) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { currentPassword, newPassword } = body;
    
    if (!currentPassword || !newPassword) {
      return c.json({ 
        success: false, 
        message: '当前密码和新密码不能为空' 
      }, 400);
    }
    
    if (newPassword.length < 6) {
      return c.json({ 
        success: false, 
        message: '新密码长度至少为 6 位' 
      }, 400);
    }
    
    const db = (c.env as Env).DB;
    
    // 验证当前密码
    const userData = await db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(user.id).first();
    
    if (!userData) {
      return c.json({ 
        success: false, 
        message: '用户不存在' 
      }, 404);
    }
    
    const isValid = await bcrypt.compare(currentPassword, userData.password);
    
    if (!isValid) {
      return c.json({ 
        success: false, 
        message: '当前密码错误' 
      }, 401);
    }
    
    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await db.prepare(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(hashedPassword, user.id).run();
    
    return c.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('修改密码失败:', error);
    return c.json({ 
      success: false, 
      message: '服务器内部错误' 
    }, 500);
  }
};

// 路由定义
export const authRoutes = new Hono();

authRoutes.post('/login', login);
authRoutes.get('/me', authMiddleware, getCurrentUser);
authRoutes.put('/password', authMiddleware, changePassword);
