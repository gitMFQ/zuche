import { Env, query, queryOne } from '../db/index.js';
import { errorResponse, successResponse } from '../utils/helpers.js';

// Get schedules (from orders)
export async function getRecentSchedulesController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const schedules: any[] = [];

    // Pickup orders (送车)
    const pickupOrders = await query(env.DB, `
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
      WHERE o.status NOT IN ('completed', 'cancelled')
      AND o.start_date >= datetime('now')
      ORDER BY o.start_date ASC
    `);

    // Return orders (收车)
    const returnOrders = await query(env.DB, `
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
      WHERE o.status NOT IN ('completed', 'cancelled')
      AND o.end_date >= datetime('now')
      ORDER BY o.end_date ASC
    `);

    schedules.push(...pickupOrders, ...returnOrders);
    schedules.sort((a, b) => new Date(a.schedule_time).getTime() - new Date(b.schedule_time).getTime());

    return successResponse(schedules);
  } catch (error) {
    console.error('Get schedules error:', error);
    return errorResponse('获取调度数据失败', 500);
  }
}

// Get Gantt data
export async function getGanttDataController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);
    endDate.setHours(23, 59, 59, 999);

    const startDateStr = startDate.toISOString().replace('T', ' ').slice(0, 19);
    const endDateStr = endDate.toISOString().replace('T', ' ').slice(0, 19);

    const orders = await query(env.DB, `
      SELECT
        o.id,
        o.order_no,
        o.start_date,
        o.end_date,
        o.status,
        o.total_amount,
        o.pickup_location,
        o.return_location,
        o.vehicle_id,
        v.plate_number,
        v.brand,
        v.model,
        v.color,
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
        vehicle_id: order.vehicle_id,
        plate_number: order.plate_number,
        brand: order.brand,
        model: order.model,
        color: order.color,
        platform: order.platform || '线下',
        platform_color: order.platform_color,
        name: order.customer_name,
        phone: order.customer_phone,
        pickLocation: order.pickup_location,
        returnLocation: order.return_location,
        rmb: order.total_amount
      });
    });

    return successResponse(ganttData);
  } catch (error) {
    console.error('Get Gantt data error:', error);
    return errorResponse('获取甘特图数据失败', 500);
  }
}
