import { type Bind, query } from '../db/helpers';
import { handleError } from '../lib/errors';
import type { AppContext } from '../types';

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
