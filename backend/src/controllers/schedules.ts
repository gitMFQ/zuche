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

// 获取甘特图数据（按车辆分组的订单占用信息）
// 返回过去30天到未来30天的订单数据，按车牌号分组
export function getGanttData(req: AuthRequest, res: Response): void {
  try {
    // 计算日期范围：过去30天到未来30天
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);
    endDate.setHours(23, 59, 59, 999);

    const startDateStr = startDate.toISOString().replace('T', ' ').slice(0, 19);
    const endDateStr = endDate.toISOString().replace('T', ' ').slice(0, 19);

    // 查询订单数据（包含车辆信息、客户信息、平台信息）
    const orders = query(`
      SELECT 
        o.id,
        o.order_no,
        o.start_date,
        o.end_date,
        o.status,
        o.total_amount,
        o.pickup_location,
        o.return_location,
        v.plate_number,
        v.brand as model,
        v.is_new_energy,
        c.name as customer_name,
        c.phone as customer_phone,
        s.name as platform,
        s.color as platform_color
      FROM orders o
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN order_sources s ON o.source_id = s.id
      WHERE o.status IN ('pending', 'active', 'completed')
      AND (
        (o.start_date >= ? AND o.start_date <= ?)
        OR (o.end_date >= ? AND o.end_date <= ?)
        OR (o.start_date < ? AND o.end_date > ?)
      )
      ORDER BY v.plate_number ASC, o.start_date ASC
    `, [startDateStr, endDateStr, startDateStr, endDateStr, startDateStr, endDateStr]);

    // 按车牌号分组
    const ganttData: Record<string, any[]> = {};
    
    orders.forEach((order: any) => {
      const plateNumber = order.plate_number || '未知车辆';
      
      if (!ganttData[plateNumber]) {
        ganttData[plateNumber] = [];
      }
      
      ganttData[plateNumber].push({
        id: order.id,
        order_no: order.order_no,
        startDateTime: order.start_date,
        endDateTime: order.end_date,
        status: order.status,
        model: order.model,
        num: order.plate_number,
        platform: order.platform || '线下',
        platform_color: order.platform_color,
        name: order.customer_name,
        phone: order.customer_phone,
        pickLocation: order.pickup_location,
        returnLocation: order.return_location,
        rmb: order.total_amount,
        毛利: order.total_amount // 简化处理，实际可能需要计算
      });
    });

    res.json({ success: true, data: ganttData });
  } catch (error) {
    console.error('获取甘特图数据错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
