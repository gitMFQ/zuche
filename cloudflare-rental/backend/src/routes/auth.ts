import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { generateId, createToken, now } from '../utils/helpers.js'
import { authMiddleware } from '../middleware/auth.js'
import type { Bindings, Variables } from '../index.js'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 登录接口
app.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    const { username, password } = body

    if (!username || !password) {
      return c.json({ success: false, message: '用户名和密码不能为空' }, 400)
    }

    // 查询用户
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ? AND status = 1')
      .bind(username)
      .first()

    if (!user) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401)
    }

    // 验证密码
    const valid = await bcrypt.compare(password, user.password as string)
    if (!valid) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401)
    }

    // 生成 token
    const token = await createToken(
      { userId: user.id as string, username: user.username as string, role: user.role as string },
      c.env.JWT_SECRET
    )

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
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ success: false, message: '登录失败' }, 500)
  }
})

// 获取当前用户信息
app.get('/me', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    
    const user = await c.env.DB.prepare('SELECT id, username, name, role, phone, email FROM users WHERE id = ?')
      .bind(userId)
      .first()

    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404)
    }

    return c.json({ success: true, data: { user } })
  } catch (error) {
    console.error('Get current user error:', error)
    return c.json({ success: false, message: '获取用户信息失败' }, 500)
  }
})

// 修改密码
app.put('/password', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json()
    const { oldPassword, newPassword } = body

    if (!oldPassword || !newPassword) {
      return c.json({ success: false, message: '请提供旧密码和新密码' }, 400)
    }

    // 获取用户
    const user = await c.env.DB.prepare('SELECT password FROM users WHERE id = ?')
      .bind(userId)
      .first()

    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404)
    }

    // 验证旧密码
    const valid = await bcrypt.compare(oldPassword, user.password as string)
    if (!valid) {
      return c.json({ success: false, message: '旧密码错误' }, 401)
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await c.env.DB.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?')
      .bind(hashedPassword, now(), userId)
      .run()

    return c.json({ success: true, message: '密码修改成功' })
  } catch (error) {
    console.error('Change password error:', error)
    return c.json({ success: false, message: '修改密码失败' }, 500)
  }
})

export default app
