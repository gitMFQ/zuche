import { Response } from 'express';
import { query, queryOne } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 获取仪表盘统计数据
export function getDashboardStats(req: AuthRequest, res: Response): void {
  try {
    // 车辆统计
    const vehicleStats = query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'rented' THEN 1 ELSE 0 END) as rented,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
      FROM vehicles
    `);

    // 订单统计
    const orderStats = query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM orders
    `);

    // 本月收入
    const monthIncome = queryOne(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `);

    // 客户总数
    const customerCount = queryOne('SELECT COUNT(*) as total FROM customers WHERE status = 1');

    // 最近订单
    const recentOrders = query(`
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

    // 即将到期的订单
    const expiringOrders = query(`
      SELECT o.order_no, o.end_date, o.total_amount,
        c.name as customer_name, c.phone, v.plate_number, v.is_new_energy
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      WHERE o.status = 'active' AND date(o.end_date) <= date('now', '+3 days')
      ORDER BY o.end_date ASC
    `);

    res.json({
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
    console.error('获取统计数据错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取收入报表
export function getIncomeReport(req: AuthRequest, res: Response): void {
  try {
    const { start_date, end_date } = req.query;

    let sql = `
      SELECT 
        strftime('%Y-%m-%d', created_at) as date,
        SUM(amount) as total
      FROM payments
      WHERE 1=1
    `;
    const params: any[] = [];

    if (start_date) {
      sql += ' AND date(created_at) >= date(?)';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND date(created_at) <= date(?)';
      params.push(end_date);
    }

    sql += ' GROUP BY strftime(\'%Y-%m-%d\', created_at) ORDER BY date DESC LIMIT 30';

    const data = query(sql, params);

    res.json({ success: true, data });
  } catch (error) {
    console.error('获取收入报表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
