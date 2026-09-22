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
         AND o.start_date >= datetime('now', '+8 hours')
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
         AND o.end_date >= datetime('now', '+8 hours')
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

/** 订单关联不到车辆时的兜底分组键 */
const UNKNOWN_PLATE = '未知车辆';

interface GanttVehicle {
  id: string;
  plate_number: string;
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
  is_new_energy: number;
  status: string;
  license_images: string | null;
  registration_image: string | null;
  remarks: string | null;
}

/** 默认窗口：往前 30 天、往后 60 天（共 91 天） */
const DEFAULT_PAST_DAYS = 30;
const DEFAULT_FUTURE_DAYS = 60;
/** 窗口上限，防止一次拉好几年的订单 */
const MAX_WINDOW_DAYS = 366;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(base: Date, days: number): Date {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * 解析查询参数里的窗口 [start_date, end_date]。
 * 缺参数或格式不对就回落到默认窗口（前端不传时就是「今天」口径）。
 */
function resolveWindow(query: Record<string, string | undefined>): { start: Date; end: Date } {
  const today = startOfToday();
  const start = query.start_date;
  const end = query.end_date;

  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
    return { start: addDays(today, -DEFAULT_PAST_DAYS), end: addDays(today, DEFAULT_FUTURE_DAYS) };
  }

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T23:59:59.999`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { start: addDays(today, -DEFAULT_PAST_DAYS), end: addDays(today, DEFAULT_FUTURE_DAYS) };
  }

  const spanDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (spanDays > MAX_WINDOW_DAYS) {
    return { start: startDate, end: addDays(startDate, MAX_WINDOW_DAYS) };
  }

  return { start: startDate, end: endDate };
}

// 获取甘特图数据：全部车辆 + 按车辆分组的订单占用信息
// 库存日历要列出每一辆车（保养/停用/窗口内无单的车也要占位），
// 所以车辆列表独立于订单查询，不能被「有单的车」牵着走。
export async function getGanttData(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { start: startDate, end: endDate } = resolveWindow(c.req.query());

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    const [vehicles, orders] = await Promise.all([
      query<GanttVehicle>(
        db,
        `SELECT id, plate_number, brand, model, color, year, seats, mileage,
           daily_rate, deposit, vin, engine_number, is_new_energy, status,
           license_images, registration_image, remarks
         FROM vehicles
         ORDER BY plate_number ASC`
      ),
      query<GanttOrder>(
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
      )
    ]);

    const ganttData: Record<string, unknown[]> = {};

    orders.forEach((order) => {
      const plateNumber = order.plate_number || UNKNOWN_PLATE;

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

    const rows = vehicles.map((vehicle) => ({
      ...vehicle,
      license_images: parseStringArray(vehicle.license_images)
    }));

    // 订单关联不到车辆（车已删 / vehicle_id 为空）时会落在「未知车辆」上，
    // 给它留一行，否则这些占用在库存日历里就凭空消失了
    if (ganttData[UNKNOWN_PLATE] && !rows.some((v) => v.plate_number === UNKNOWN_PLATE)) {
      rows.push({
        id: '',
        plate_number: UNKNOWN_PLATE,
        brand: null,
        model: null,
        color: null,
        year: null,
        seats: null,
        mileage: null,
        daily_rate: null,
        deposit: null,
        vin: null,
        engine_number: null,
        is_new_energy: 0 as number,
        status: 'available',
        license_images: [],
        registration_image: null,
        remarks: null
      });
    }

    return c.json({ success: true, data: { vehicles: rows, orders: ganttData } });
  } catch (error) {
    return handleError(c, '获取甘特图数据错误:', error);
  }
}
