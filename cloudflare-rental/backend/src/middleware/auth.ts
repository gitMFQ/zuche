import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { Context, Next } from 'hono'
import { verifyToken } from '../utils/helpers.js'
import type { Bindings, Variables } from '../index.js'

export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c: Context, next: Next) => {
  // 跳过登录和健康检查接口
  if (c.req.path === '/api/auth/login' || c.req.path === '/health') {
    await next()
    return
  }

  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, message: '未提供认证令牌' }, 401)
  }

  const token = authHeader.split(' ')[1]
  const secret = c.env.JWT_SECRET

  const payload = await verifyToken(token, secret)
  if (!payload) {
    return c.json({ success: false, message: '无效的认证令牌' }, 401)
  }

  // 将用户信息存入上下文
  c.set('userId', payload.userId)
  c.set('username', payload.username)
  c.set('role', payload.role)

  await next()
})
