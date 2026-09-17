import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { generateId, now } from '../utils/helpers.js'
import { authMiddleware } from '../middleware/auth.js'
import type { Bindings, Variables } from '../index.js'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 获取用户列表（需要认证）
app.get('/', authMiddleware, async (c) => {
  try {
    const page = Number(c.req.query('page') || '1')
    const pageSize = Number(c.req.query('pageSize') || '10')
    const keyword = c.req.query('keyword') || ''
    const role = c.req.query('role') || ''
    const status = c.req.query('status') || ''

    let sql = 'SELECT id, username, name, role, phone, email, status, created_at FROM users WHERE 1=1'
    const params: any[] = []

    if (keyword) {
      sql += ' AND (username LIKE ? OR name LIKE ? OR phone LIKE ?)'
      const likeKeyword = `%${keyword}%`
      params.push(likeKeyword, likeKeyword, likeKeyword)
    }

    if (role) {
      sql += ' AND role = ?'
      params.push(role)
    }

    if (status !== '') {
      sql += ' AND status = ?'
      params.push(Number(status))
    }

    sql += ' ORDER BY created_at DESC'

    // 查询总数
    const countSql = `SELECT COUNT(*) as total FROM (${sql})`
    const countResult = await c.env.DB.prepare(countSql).bind(...params).first()
    const total = (countResult as any)?.total || 0

    // 分页查询
    const offset = (page - 1) * pageSize
    const pagedSql = `${sql} LIMIT ${pageSize} OFFSET ${offset}`
    const data = await c.env.DB.prepare(pagedSql).bind(...params).all()

    return c.json({
      success: true,
      data: {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (error) {
    console.error('Get users error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 获取单个用户
app.get('/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const user = await c.env.DB.prepare(
      'SELECT id, username, name, role, phone, email, status, created_at FROM users WHERE id = ?'
    ).bind(id).first()

    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404)
    }

    return c.json({ success: true, data: user })
  } catch (error) {
    console.error('Get user error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 创建用户
app.post('/', authMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const { username, password, name, role = 'staff', phone, email } = body

    if (!username || !password || !name) {
      return c.json({ success: false, message: '用户名、密码和姓名不能为空' }, 400)
    }

    // 检查用户名是否已存在
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
    if (existing) {
      return c.json({ success: false, message: '用户名已存在' }, 400)
    }

    const id = generateId()
    const hashedPassword = await bcrypt.hash(password, 10)
    const currentTime = now()

    await c.env.DB.prepare(
      'INSERT INTO users (id, username, password, name, role, phone, email, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)'
    ).bind(id, username, hashedPassword, name, role, phone || null, email || null, currentTime, currentTime).run()

    return c.json({
      success: true,
      data: { id, username, name, role, phone, email },
      message: '用户创建成功'
    })
  } catch (error) {
    console.error('Create user error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 更新用户
app.put('/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const { name, role, phone, email, status } = body

    const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404)
    }

    await c.env.DB.prepare(
      'UPDATE users SET name = ?, role = ?, phone = ?, email = ?, status = ?, updated_at = ? WHERE id = ?'
    ).bind(name, role, phone || null, email || null, status, now(), id).run()

    return c.json({ success: true, message: '用户更新成功' })
  } catch (error) {
    console.error('Update user error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 删除用户
app.delete('/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const userId = c.get('userId')

    if (id === userId) {
      return c.json({ success: false, message: '不能删除自己的账号' }, 400)
    }

    const user = await c.env.DB.prepare('SELECT id, name FROM users WHERE id = ?').bind(id).first()
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404)
    }

    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()

    return c.json({ success: true, message: '用户删除成功' })
  } catch (error) {
    console.error('Delete user error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 重置密码
app.put('/:id/reset-password', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const { newPassword } = body

    if (!newPassword) {
      return c.json({ success: false, message: '新密码不能为空' }, 400)
    }

    const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404)
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await c.env.DB.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?')
      .bind(hashedPassword, now(), id).run()

    return c.json({ success: true, message: '密码重置成功' })
  } catch (error) {
    console.error('Reset password error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

export default app
