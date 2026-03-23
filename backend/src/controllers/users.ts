import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, execute, generateId, now, queryWithPagination, logAction } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 获取用户列表
export function getUsers(req: AuthRequest, res: Response): void {
  try {
    const { page = 1, pageSize = 10, keyword = '', role = '', status = '' } = req.query;
    
    let sql = 'SELECT id, username, name, role, phone, email, status, created_at FROM users WHERE 1=1';
    const params: any[] = [];

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

    const result = queryWithPagination(sql, params, Number(page), Number(pageSize));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取单个用户
export function getUser(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const user = queryOne(
      'SELECT id, username, name, role, phone, email, status, created_at FROM users WHERE id = ?',
      [id]
    );

    if (!user) {
      res.status(404).json({ success: false, message: '用户不存在' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('获取用户错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 创建用户
export function createUser(req: AuthRequest, res: Response): void {
  try {
    const { username, password, name, role = 'staff', phone, email } = req.body;

    if (!username || !password || !name) {
      res.status(400).json({ success: false, message: '用户名、密码和姓名不能为空' });
      return;
    }

    // 检查用户名是否已存在
    const existing = queryOne('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      res.status(400).json({ success: false, message: '用户名已存在' });
      return;
    }

    const id = generateId();
    const hashedPassword = bcrypt.hashSync(password, 10);
    const currentTime = now();

    execute(
      'INSERT INTO users (id, username, password, name, role, phone, email, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [id, username, hashedPassword, name, role, phone || null, email || null, currentTime, currentTime]
    );

    // 记录操作日志
    logAction(req.user?.id || '', '创建用户', 'user', id, `创建用户 ${name}（${role === 'admin' ? '管理员' : '员工'}）`, req.ip);

    res.json({ 
      success: true, 
      data: { id, username, name, role, phone, email },
      message: '用户创建成功' 
    });
  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 更新用户
export function updateUser(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const { name, role, phone, email, status } = req.body;

    const user = queryOne('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      res.status(404).json({ success: false, message: '用户不存在' });
      return;
    }

    execute(
      'UPDATE users SET name = ?, role = ?, phone = ?, email = ?, status = ?, updated_at = ? WHERE id = ?',
      [name, role, phone || null, email || null, status, now(), id]
    );

    // 记录操作日志
    logAction(req.user?.id || '', '更新用户', 'user', id, `更新用户 ${name}`, req.ip);

    res.json({ success: true, message: '用户更新成功' });
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 删除用户
export function deleteUser(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;

    if (id === req.user?.id) {
      res.status(400).json({ success: false, message: '不能删除自己的账号' });
      return;
    }

    const user = queryOne('SELECT id, name FROM users WHERE id = ?', [id]);
    if (!user) {
      res.status(404).json({ success: false, message: '用户不存在' });
      return;
    }

    execute('DELETE FROM users WHERE id = ?', [id]);

    // 记录操作日志
    logAction(req.user?.id || '', '删除用户', 'user', id, `删除用户 ${user.name}`, req.ip);

    res.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 重置密码
export function resetPassword(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      res.status(400).json({ success: false, message: '新密码不能为空' });
      return;
    }

    const user = queryOne('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      res.status(404).json({ success: false, message: '用户不存在' });
      return;
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    execute('UPDATE users SET password = ?, updated_at = ? WHERE id = ?', [hashedPassword, now(), id]);

    res.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
