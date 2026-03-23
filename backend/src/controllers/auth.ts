import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, query, execute, generateId, now, logAction } from '../utils/helpers.js';
import { generateToken, AuthRequest } from '../middleware/auth.js';

// 登录
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ success: false, message: '账号和密码不能为空' });
      return;
    }

    // 支持用户名、姓名、手机号、邮箱登录
    const user = queryOne(
      'SELECT * FROM users WHERE (username = ? OR name = ? OR phone = ? OR email = ?) AND status = 1',
      [username, username, username, username]
    );

    if (!user) {
      res.status(401).json({ success: false, message: '账号不存在或已禁用' });
      return;
    }

    const isValidPassword = bcrypt.compareSync(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ success: false, message: '密码错误' });
      return;
    }

    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    });

    // 记录登录日志
    logAction(user.id, '登录', 'user', user.id, `用户 ${user.name} 登录系统`, req.ip);

    res.json({
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
    console.error('登录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取当前用户信息
export function getCurrentUser(req: AuthRequest, res: Response): void {
  const user = queryOne('SELECT id, username, name, role, phone, email, status, created_at FROM users WHERE id = ?', [req.user?.id]);
  
  if (!user) {
    res.status(404).json({ success: false, message: '用户不存在' });
    return;
  }

  res.json({ success: true, data: user });
}

// 修改密码
export function changePassword(req: AuthRequest, res: Response): void {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!oldPassword || !newPassword) {
      res.status(400).json({ success: false, message: '旧密码和新密码不能为空' });
      return;
    }

    const user = queryOne('SELECT password FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ success: false, message: '用户不存在' });
      return;
    }

    const isValid = bcrypt.compareSync(oldPassword, user.password);
    if (!isValid) {
      res.status(400).json({ success: false, message: '旧密码错误' });
      return;
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    execute(
      'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
      [hashedPassword, now(), userId]
    );

    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
