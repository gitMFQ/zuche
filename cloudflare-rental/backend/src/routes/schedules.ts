import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import type { Bindings, Variables } from '../index.js'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 获取调度列表
app.get('/recent', authMiddleware, async (c) => {
  try {
    const now = new Date().toISOString()
    
    // 送车任务：待取车订单
    const pickupSql = `
      SELECT o.id as order_id, o.plate_number, o.start_date as schedule_time, 
             'pickup' as type, COALESCE(os.name, '门店直租') as platform,
             o.pickup_location as location, os.color
      FROM orders o
      LEFT JOIN order_sources os ON o.source_id = os.id
      WHERE o.status = 'pending' AND o.start_date >= ?
      ORDER BY o.start_date ASC
    `
    const pickups = await c.env.DB.prepare(pickupSql).bind(now).all()

    // 收车任务：已取车订单
    const returnSql = `
      SELECT o.id as order_id, o.plate_number, o.end_date as schedule_time,
             'return' as type, COALESCE(os.name, '门店直租') as platform,
             o.return_location as location, os.color
      FROM orders o
      LEFT JOIN order_sources os ON o.source_id = os.id
      WHERE o.status = 'active' AND o.end_date >= ?
      ORDER BY o.end_date ASC
    `
    const returns = await c.env.DB.prepare(returnSql).bind(now).all()

    const schedules = [...pickups, ...returns].sort((a, b) => 
      new Date(a.schedule_time).getTime() - new Date(b.schedule_time).getTime()
    )

    return c.json({ success: true, data: schedules })
  } catch (error) {
    console.error('Get schedules error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 获取甘特图数据
app.get('/gantt', authMiddleware, async (c) => {
  try {
    const sql = `
      SELECT o.id, o.order_no, o.plate_number, v.brand, v.model,
             o.start_date, o.end_date, o.status, o.customer_name,
             COALESCE(os.name, '门店直租') as source_name, os.color
      FROM orders o
      JOIN vehicles v ON o.vehicle_id = v.id
      LEFT JOIN order_sources os ON o.source_id = os.id
      WHERE o.status IN ('pending', 'active') AND o.end_date >= ?
      ORDER BY o.start_date ASC
    `
    const now = new Date().toISOString()
    const data = await c.env.DB.prepare(sql).bind(now).all()

    return c.json({ success: true, data })
  } catch (error) {
    console.error('Get gantt error:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

export default app
