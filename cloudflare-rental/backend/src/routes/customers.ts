import { Hono } from 'hono'
import { generateId, now, generateOrderNo } from '../utils/helpers.js'
import { authMiddleware } from '../middleware/auth.js'
import type { Bindings, Variables } from '../index.js'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 获取客户列表
app.get('/', authMiddleware, async (c) => {
  try {
    const page = Number(c.req.query('page') || '1')
    const pageSize = Number(c.req.query('pageSize') || '10')
    const keyword = c.req.query('keyword') || ''

    let sql = 'SELECT * FROM customers WHERE 1=1'
    const params: any[] = []

    if (keyword) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR id_card LIKE ?)'
      const likeKeyword = `%${keyword}%`
      params.push(likeKeyword, likeKeyword, likeKeyword)
    }

    sql += ' ORDER BY created_at DESC'

    const countSql = `SELECT COUNT(*) as total FROM (${sql})`
    const countResult = await c.env.DB.prepare(countSql).bind(...params).first()
    const total = (countResult as any)?.total || 0

    const offset = (page - 1) * pageSize
    const pagedSql = `${sql} LIMIT ${pageSize} OFFSET ${offset}`
    const data = await c.env.DB.prepare(pagedSql).bind(...params).all()

    return c.json({
      success: true,
      data: { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
    })
  } catch (error) {
    console.error('Get customers error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 获取常用客户
app.get('/regular', authMiddleware, async (c) => {
  try {
    const data = await c.env.DB.prepare(
      'SELECT * FROM customers WHERE is_regular = 1 ORDER BY name'
    ).all()
    return c.json({ success: true, data })
  } catch (error) {
    console.error('Get regular customers error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 创建客户
app.post('/', authMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const { name, phone, id_card, license_number, license_expiry, address, remarks, source_id, source_name } = body

    if (!name || !phone) {
      return c.json({ success: false, message: '姓名和电话不能为空' }, 400)
    }

    const existing = await c.env.DB.prepare('SELECT id FROM customers WHERE phone = ?').bind(phone).first()
    if (existing) {
      return c.json({ success: false, message: '手机号已存在' }, 400)
    }

    const id = generateId()
    await c.env.DB.prepare(
      `INSERT INTO customers (id, name, phone, id_card, license_number, license_expiry, address, remarks, source_id, source_name, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(id, name, phone, id_card || null, license_number || null, license_expiry || null, address || null, remarks || null, source_id || null, source_name || null, now(), now()).run()

    return c.json({ success: true, data: { id }, message: '客户创建成功' })
  } catch (error) {
    console.error('Create customer error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 更新客户
app.put('/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const { name, phone, id_card, license_number, license_expiry, address, remarks, is_regular, source_id, source_name, id_card_images, license_images } = body

    const user = await c.env.DB.prepare('SELECT id FROM customers WHERE id = ?').bind(id).first()
    if (!user) {
      return c.json({ success: false, message: '客户不存在' }, 404)
    }

    await c.env.DB.prepare(
      `UPDATE customers SET name = ?, phone = ?, id_card = ?, license_number = ?, license_expiry = ?, address = ?, remarks = ?, is_regular = ?, source_id = ?, source_name = ?, id_card_images = ?, license_images = ?, updated_at = ? WHERE id = ?`
    ).bind(name, phone, id_card, license_number, license_expiry, address, remarks, is_regular ? 1 : 0, source_id, source_name, id_card_images, license_images, now(), id).run()

    return c.json({ success: true, message: '客户更新成功' })
  } catch (error) {
    console.error('Update customer error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 删除客户
app.delete('/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: '客户删除成功' })
  } catch (error) {
    console.error('Delete customer error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

export default app
