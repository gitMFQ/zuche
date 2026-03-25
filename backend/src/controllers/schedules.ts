import { Response } from 'express';
import { query } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 获取最近调度（从订单自动生成）
// 不按订单状态过滤，同一订单的取和还都显示，按当前时间往下排
export function getRecentSchedules(req: AuthRequest, res: Response): void {
  try {
    const schedules: any[] = [];

    // 查询待取车订单（送车）- 只显示当前时间未到取车时间的
    const pickupOrders = query(`
      SELECT 
        o.id,
        o.start_date as schedule_time,
        '送' as type,
        v.plate_number,
        s.name as platform,
        s.color as platform_color,
        COALESCE(o.pickup_location, '') as location,
        o.order_no
      FROM orders o
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      LEFT JOIN order_sources s ON o.source_id = s.id
      WHERE o.status = 'pending'
      AND o.start_date >= datetime('now')
      ORDER BY o.start_date ASC
    `);

    // 查询还车订单（收车）- 显示当前时间未到还车时间的
    const returnOrders = query(`
      SELECT 
        o.id,
        o.end_date as schedule_time,
        '收' as type,
        v.plate_number,
        s.name as platform,
        s.color as platform_color,
        COALESCE(o.return_location, '') as location,
        o.order_no
      FROM orders o
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      LEFT JOIN order_sources s ON o.source_id = s.id
      WHERE o.status = 'active'
      AND o.end_date >= datetime('now')
      ORDER BY o.end_date ASC
    `);

    schedules.push(...pickupOrders, ...returnOrders);
    
    // 按时间排序
    schedules.sort((a, b) => new Date(a.schedule_time).getTime() - new Date(b.schedule_time).getTime());

    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error('获取调度数据错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
