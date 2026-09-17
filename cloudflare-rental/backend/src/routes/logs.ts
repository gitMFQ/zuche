import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import type { Bindings, Variables } from '../index.js'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 获取日志列表
app.get('/', authMiddleware, async (c) => {
  try {
    const page = Number(c.req.query('page') || '1')
    const pageSize = Number(c.req.query('pageSize') || '10')
    const action_type = c.req.query('action_type') || ''
    const entity_type = c.req.query('entity_type') || ''

    let sql = 'SELECT * FROM operation_logs WHERE 1=1'
    const params: any[] = []

    if (action_type) {
      sql += ' AND action LIKE ?'
      params.push(`%${action_type}%`)
    }

    if (entity_type) {
      sql += ' AND entity_type = ?'
      params.push(entity_type)
    }

    sql += ' ORDER BY created_at DESC'

    const countSql = `SELECT COUNT(*) as total FROM (${sql})`
    const countResult = await c.env.DB.prepare(countSql).bind(...params).first()
    const total = (countResult as any)?.total || 0

    const offset = (page - 1) * pageSize
    const pagedSql = `${sql} LIMIT ${pageSize} OFFSET ${offset}`
    const data = await c.env.DB.prepare(pagedSql).bind(...params).all()

    return c.json({ success: true, data: { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } })
  } catch (error) {
    console.error('Get logs error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

export default app
