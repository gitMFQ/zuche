import { Hono } from 'hono'
import { generateId, now } from '../utils/helpers.js'
import { authMiddleware } from '../middleware/auth.js'
import type { Bindings, Variables } from '../index.js'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 获取车辆列表
app.get('/', authMiddleware, async (c) => {
  try {
    const page = Number(c.req.query('page') || '1')
    const pageSize = Number(c.req.query('pageSize') || '10')
    const keyword = c.req.query('keyword') || ''
    const status = c.req.query('status') || ''

    let sql = 'SELECT * FROM vehicles WHERE 1=1'
    const params: any[] = []

    if (keyword) {
      sql += ' AND (plate_number LIKE ? OR brand LIKE ? OR model LIKE ?)'
      const likeKeyword = `%${keyword}%`
      params.push(likeKeyword, likeKeyword, likeKeyword)
    }

    if (status) {
      sql += ' AND status = ?'
      params.push(status)
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
    console.error('Get vehicles error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 获取可用车辆
app.get('/available', authMiddleware, async (c) => {
  try {
    const startDate = c.req.query('start_date')
    const endDate = c.req.query('end_date')
    const excludeOrderId = c.req.query('exclude_order_id')

    let sql = `SELECT v.* FROM vehicles v WHERE v.status = 'available'`
    const params: any[] = []

    if (startDate && endDate) {
      let excludeSql = `SELECT DISTINCT vehicle_id FROM orders 
        WHERE status IN ('pending', 'active') 
        AND NOT (end_date <= ? OR start_date >= ?)`
      const excludeParams = [startDate, endDate]
      
      if (excludeOrderId) {
        excludeSql += ' AND id != ?'
        excludeParams.push(excludeOrderId)
      }
      
      sql += ` AND id NOT IN (${excludeSql})`
      params.push(...excludeParams)
    }

    const data = await c.env.DB.prepare(sql).bind(...params).all()
    return c.json({ success: true, data })
  } catch (error) {
    console.error('Get available vehicles error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 创建车辆
app.post('/', authMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const { plate_number, brand, model, color, year, seats, mileage, daily_rate, is_new_energy, vin, engine_number, license_image, registration_image, remarks } = body

    if (!plate_number || !brand || !model) {
      return c.json({ success: false, message: '车牌号、品牌和型号不能为空' }, 400)
    }

    const existing = await c.env.DB.prepare('SELECT id FROM vehicles WHERE plate_number = ?').bind(plate_number).first()
    if (existing) {
      return c.json({ success: false, message: '车牌号已存在' }, 400)
    }

    const id = generateId()
    await c.env.DB.prepare(
      `INSERT INTO vehicles (id, plate_number, brand, model, color, year, seats, mileage, daily_rate, status, is_new_energy, vin, engine_number, license_image, registration_image, remarks, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, plate_number, brand, model, color || null, year || null, seats || 5, mileage || 0, daily_rate || 0, is_new_energy ? 1 : 0, vin || null, engine_number || null, license_image || null, registration_image || null, remarks || null, now(), now()).run()

    return c.json({ success: true, data: { id }, message: '车辆创建成功' })
  } catch (error) {
    console.error('Create vehicle error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 更新车辆
app.put('/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const { plate_number, brand, model, color, year, seats, mileage, daily_rate, status, is_new_energy, vin, engine_number, license_image, registration_image, remarks } = body

    const vehicle = await c.env.DB.prepare('SELECT id FROM vehicles WHERE id = ?').bind(id).first()
    if (!vehicle) {
      return c.json({ success: false, message: '车辆不存在' }, 404)
    }

    await c.env.DB.prepare(
      `UPDATE vehicles SET plate_number = ?, brand = ?, model = ?, color = ?, year = ?, seats = ?, mileage = ?, daily_rate = ?, status = ?, is_new_energy = ?, vin = ?, engine_number = ?, license_image = ?, registration_image = ?, remarks = ?, updated_at = ? WHERE id = ?`
    ).bind(plate_number, brand, model, color, year, seats, mileage, daily_rate, status, is_new_energy ? 1 : 0, vin, engine_number, license_image, registration_image, remarks, now(), id).run()

    return c.json({ success: true, message: '车辆更新成功' })
  } catch (error) {
    console.error('Update vehicle error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 删除车辆
app.delete('/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM vehicles WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: '车辆删除成功' })
  } catch (error) {
    console.error('Delete vehicle error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

export default app
