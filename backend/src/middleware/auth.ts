import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'rental-admin-secret-key-2026';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    name: string;
  };
}

// 生成 Token
export function generateToken(user: { id: string; username: string; role: string; name: string }): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// 验证 Token 中间件
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ success: false, message: '未提供认证令牌' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      role: string;
      name: string;
    };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: '令牌无效或已过期' });
  }
}

// 管理员权限检查
export function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, message: '需要管理员权限' });
    return;
  }
  next();
}
