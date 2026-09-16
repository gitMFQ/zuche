import { Env, query, queryOne } from '../db/index.js';
import { errorResponse, successResponse } from '../utils/helpers.js';

// Get dashboard stats
export async function getDashboardStatsController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    // Vehicle stats
    const vehicleStats: any = await queryOne(env.DB, `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'rented' THEN 1 ELSE 0 END) as rented,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
      FROM vehicles
    `);

    // Order stats
    const orderStats: any = await queryOne(env.DB, `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM orders
    `);

    // Month income
    const monthIncome: any = await queryOne(env.DB, `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `);

    // Customer count
    const customerCount: any = await queryOne(env.DB, 'SELECT COUNT(*) as total FROM customers WHERE status = 1');

    // Recent orders
    const recentOrders = await query(env.DB, `
      SELECT o.order_no, o.status, o.total_amount, o.created_at,
        c.name as customer_name, v.plate_number, v.is_new_energy,
        s.name as source_name, s.color as source_color
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      LEFT JOIN order_sources s ON o.source_id = s.id
      ORDER BY o.created_at DESC
      LIMIT 5
    `);

    // Expiring orders
    const expiringOrders = await query(env.DB, `
      SELECT o.order_no, o.end_date, o.total_amount,
        c.name as customer_name, c.phone, v.plate_number, v.is_new_energy
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      WHERE o.status = 'active' AND date(o.end_date) <= date('now', '+3 days')
      ORDER BY o.end_date ASC
    `);

    return successResponse({
      vehicles: vehicleStats || { total: 0, available: 0, rented: 0, maintenance: 0 },
      orders: orderStats || { total: 0, pending: 0, active: 0, completed: 0 },
      monthIncome: monthIncome?.total || 0,
      customerCount: customerCount?.total || 0,
      recentOrders,
      expiringOrders
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return errorResponse('获取统计数据失败', 500);
  }
}

// Get income report
export async function getIncomeReportController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const start_date = params.start_date;
    const end_date = params.end_date;

    let sql = `
      SELECT 
        strftime('%Y-%m-%d', created_at) as date,
        SUM(amount) as total
      FROM payments
      WHERE 1=1
    `;
    const queryParams: any[] = [];

    if (start_date) {
      sql += ' AND date(created_at) >= date(?)';
      queryParams.push(start_date);
    }

    if (end_date) {
      sql += ' AND date(created_at) <= date(?)';
      queryParams.push(end_date);
    }

    sql += ' GROUP BY strftime(\'%Y-%m-%d\', created_at) ORDER BY date DESC LIMIT 30';

    const data = await query(env.DB, sql, queryParams);
    return successResponse(data);
  } catch (error) {
    console.error('Get income report error:', error);
    return errorResponse('获取收入报表失败', 500);
  }
}
