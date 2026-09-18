import { type Bind, query, queryOne } from '../db/helpers';
import { handleError } from '../lib/errors';
import type { AppContext } from '../types';

interface VehicleStats {
  total: number;
  available: number;
  rented: number;
  maintenance: number;
}

interface OrderStats {
  total: number;
  pending: number;
  active: number;
  completed: number;
}

interface RecentOrder {
  order_no: string;
  status: string;
  total_amount: number;
  created_at: string;
  customer_name: string | null;
  plate_number: string | null;
  is_new_energy: number | null;
  source_name: string | null;
  source_color: string | null;
}

interface ExpiringOrder {
  order_no: string;
  end_date: string;
  total_amount: number;
  customer_name: string | null;
  phone: string | null;
  plate_number: string | null;
  is_new_energy: number | null;
}

// 获取仪表盘统计数据
export async function getDashboardStats(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    // 各统计互不依赖，并发发出以减少往返
    const [vehicleStats, orderStats, monthIncome, customerCount, recentOrders, expiringOrders] = await Promise.all([
      query<VehicleStats>(
        db,
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN status = 'rented' THEN 1 ELSE 0 END) as rented,
          SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
         FROM vehicles`
      ),
      query<OrderStats>(
        db,
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
         FROM orders`
      ),
      queryOne<{ total: number }>(
        db,
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM payments
         WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
      ),
      queryOne<{ total: number }>(db, 'SELECT COUNT(*) as total FROM customers WHERE status = 1'),
      query<RecentOrder>(
        db,
        `SELECT o.order_no, o.status, o.total_amount, o.created_at,
           c.name as customer_name, v.plate_number, v.is_new_energy,
           s.name as source_name, s.color as source_color
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         LEFT JOIN vehicles v ON o.vehicle_id = v.id
         LEFT JOIN order_sources s ON o.source_id = s.id
         ORDER BY o.created_at DESC
         LIMIT 5`
      ),
      query<ExpiringOrder>(
        db,
        `SELECT o.order_no, o.end_date, o.total_amount,
           c.name as customer_name, c.phone, v.plate_number, v.is_new_energy
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         LEFT JOIN vehicles v ON o.vehicle_id = v.id
         WHERE o.status = 'active' AND date(o.end_date) <= date('now', '+3 days')
         ORDER BY o.end_date ASC`
      )
    ]);

    return c.json({
      success: true,
      data: {
        vehicles: vehicleStats[0] || { total: 0, available: 0, rented: 0, maintenance: 0 },
        orders: orderStats[0] || { total: 0, pending: 0, active: 0, completed: 0 },
        monthIncome: monthIncome?.total || 0,
        customerCount: customerCount?.total || 0,
        recentOrders,
        expiringOrders
      }
    });
  } catch (error) {
    return handleError(c, '获取统计数据错误:', error);
  }
}

// 获取收入报表
export async function getIncomeReport(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const { start_date, end_date } = c.req.query();

    let sql = `
      SELECT
        strftime('%Y-%m-%d', created_at) as date,
        SUM(amount) as total
      FROM payments
      WHERE 1=1
    `;
    const params: Bind[] = [];

    if (start_date) {
      sql += ' AND date(created_at) >= date(?)';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND date(created_at) <= date(?)';
      params.push(end_date);
    }

    sql += " GROUP BY strftime('%Y-%m-%d', created_at) ORDER BY date DESC LIMIT 30";

    const data = await query<{ date: string; total: number }>(db, sql, params);

    return c.json({ success: true, data });
  } catch (error) {
    return handleError(c, '获取收入报表错误:', error);
  }
}
