import { query } from '../db/helpers';
import { handleError } from '../lib/errors';
import { parseStringArray } from '../lib/json';
import { formatDate } from '../lib/time';
import type { AppContext } from '../types';

interface ScheduleItem {
  id: string;
  schedule_time: string;
  type: string;
  plate_number: string | null;
  platform: string | null;
  platform_color: string | null;
  location: string;
  order_no: string;
}

// 获取最近调度（从订单自动生成）
export async function getRecentSchedules(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    // 两条查询互不依赖，并发发出
    const [pickupOrders, returnOrders] = await Promise.all([
      query<ScheduleItem>(
        db,
        `SELECT
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
         ORDER BY o.start_date ASC`
      ),
      query<ScheduleItem>(
        db,
        `SELECT
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
         ORDER BY o.end_date ASC`
      )
    ]);

    const schedules = [...pickupOrders, ...returnOrders];
    schedules.sort((a, b) => new Date(a.schedule_time).getTime() - new Date(b.schedule_time).getTime());

    return c.json({ success: true, data: schedules });
  } catch (error) {
    return handleError(c, '获取调度数据错误:', error);
  }
}

interface GanttOrder {
  id: string;
  order_no: string;
  start_date: string;
  end_date: string;
  status: string;
  total_amount: number;
  pickup_location: string | null;
  return_location: string | null;
  vehicle_id: string;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  seats: number | null;
  mileage: number | null;
  daily_rate: number | null;
  deposit: number | null;
  vin: string | null;
  engine_number: string | null;
  is_new_energy: number | null;
  vehicle_status: string | null;
  license_images: string | null;
  registration_image: string | null;
  remarks: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  platform: string | null;
  platform_color: string | null;
}

// 获取甘特图数据（按车辆分组的订单占用信息）
export async function getGanttData(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const current = new Date();

    const startDate = new Date(current);
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(current);
    endDate.setDate(endDate.getDate() + 30);
    endDate.setHours(23, 59, 59, 999);

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    const orders = await query<GanttOrder>(
      db,
      `SELECT
         o.id, o.order_no, o.start_date, o.end_date, o.status, o.total_amount,
         o.pickup_location, o.return_location, o.vehicle_id,
         v.plate_number, v.brand, v.model, v.color, v.year, v.seats, v.mileage,
         v.daily_rate, v.deposit, v.vin, v.engine_number, v.is_new_energy,
         v.status as vehicle_status, v.license_images, v.registration_image, v.remarks,
         c.name as customer_name, c.phone as customer_phone,
         s.name as platform, s.color as platform_color
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
       ORDER BY v.plate_number ASC, o.start_date ASC`,
      [startDateStr, endDateStr, startDateStr, endDateStr, startDateStr, endDateStr]
    );

    const ganttData: Record<string, unknown[]> = {};

    orders.forEach((order) => {
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
        year: order.year,
        seats: order.seats,
        mileage: order.mileage,
        daily_rate: order.daily_rate,
        deposit: order.deposit,
        vin: order.vin,
        engine_number: order.engine_number,
        is_new_energy: order.is_new_energy,
        vehicle_status: order.vehicle_status,
        license_images: parseStringArray(order.license_images),
        registration_image: order.registration_image,
        remarks: order.remarks,
        platform: order.platform || '线下',
        platform_color: order.platform_color,
        source_name: order.platform,
        source_color: order.platform_color,
        name: order.customer_name,
        phone: order.customer_phone,
        pickLocation: order.pickup_location,
        returnLocation: order.return_location,
        rmb: order.total_amount
      });
    });

    return c.json({ success: true, data: ganttData });
  } catch (error) {
    return handleError(c, '获取甘特图数据错误:', error);
  }
}
