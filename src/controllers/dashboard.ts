import { type Bind, query, queryOne } from '../db/helpers';
import { handleError } from '../lib/errors';
import { dateOffset, monthRange, now } from '../lib/time';
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

/** 首页统计的缓存时长（秒）。数据变化不频繁，短时缓存能省掉大量重复聚合查询 */
const STATS_CACHE_SECONDS = 60;

// 获取仪表盘统计数据
export async function getDashboardStats(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    // 首页每次进入都要跑 6 条聚合查询，频繁刷新会白白消耗 D1 读配额。
    // 统计结果是全店共享的（不含任何按用户区分的字段），可以安全地用 Cache API 缓存。
    const cache = caches.default;
    const cacheKey = new Request(new URL('/__cached/dashboard-stats', c.req.url).toString());

    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }

    // 各统计互不依赖，并发发出以减少往返
    const currentTime = now();
    const [vehicleStats, orderStats, monthIncome, customerCount, recentOrders, expiringOrders] = await Promise.all([
      // 车辆统计：available / rented 都必须由订单占用情况推导。
      // 早期这里读 vehicles.status = 'rented'，但订单流转从不写该字段，
      // 统计恒为 0，且与车辆列表的算法不一致。现在两处口径统一（见 lib/vehicles.ts）。
      query<VehicleStats>(
        db,
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status NOT IN ('maintenance', 'unavailable') AND EXISTS (
                SELECT 1 FROM orders o WHERE o.vehicle_id = vehicles.id
                  AND o.status IN ('pending', 'active')
                  AND o.start_date <= ? AND o.end_date > ?
              ) THEN 1 ELSE 0 END) as rented,
          SUM(CASE WHEN status NOT IN ('maintenance', 'unavailable') AND NOT EXISTS (
                SELECT 1 FROM orders o WHERE o.vehicle_id = vehicles.id
                  AND o.status IN ('pending', 'active')
                  AND o.start_date <= ? AND o.end_date > ?
              ) THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
         FROM vehicles`,
        [currentTime, currentTime, currentTime, currentTime]
      ),
      query<OrderStats>(
        db,
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
         FROM orders
         WHERE status != 'cancelled'`
      ),
      // 已取消订单的收款不再算收入，必须关联订单状态排除掉
      // 用范围比较替代 strftime('%Y-%m', ...) = 'now'，后者无法命中 idx_payments_created
      queryOne<{ total: number }>(
        db,
        `SELECT COALESCE(SUM(p.amount), 0) as total
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         WHERE o.status != 'cancelled'
           AND p.created_at >= ? AND p.created_at < ?`,
        [monthRange().start, monthRange().end]
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
         WHERE o.status = 'active' AND date(o.end_date) <= ?
         ORDER BY o.end_date ASC`,
        [dateOffset(3)]
      )
    ]);

    const response = c.json(
      {
        success: true,
        data: {
          vehicles: vehicleStats[0] || { total: 0, available: 0, rented: 0, maintenance: 0 },
          orders: orderStats[0] || { total: 0, pending: 0, active: 0, completed: 0 },
          monthIncome: monthIncome?.total || 0,
          customerCount: customerCount?.total || 0,
          recentOrders,
          expiringOrders
        }
      },
      200,
      { 'Cache-Control': `max-age=${STATS_CACHE_SECONDS}` }
    );

    // 写入缓存失败不应该影响这次响应，交给 waitUntil 后台完成
    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
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
        strftime('%Y-%m-%d', p.created_at) as date,
        SUM(p.amount) as total
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      WHERE o.status != 'cancelled'
    `;
    const params: Bind[] = [];

    if (start_date) {
      sql += ' AND p.created_at >= ?';
      params.push(`${start_date} 00:00:00`);
    }
    if (end_date) {
      sql += ' AND p.created_at <= ?';
      params.push(`${end_date} 23:59:59`);
    }

    sql += " GROUP BY strftime('%Y-%m-%d', p.created_at) ORDER BY date DESC LIMIT 30";

    const data = await query<{ date: string; total: number }>(db, sql, params);

    return c.json({ success: true, data });
  } catch (error) {
    return handleError(c, '获取收入报表错误:', error);
  }
}
