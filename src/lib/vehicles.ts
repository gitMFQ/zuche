import type { D1Database } from '@cloudflare/workers-types';
import { query } from '../db/helpers';
import { now } from './time';

/**
 * 车辆「人工状态」白名单。
 *
 * 刻意不包含 rented：是否在租是由订单的时间区间算出来的派生状态。
 * 早期 dashboard 依赖 `vehicles.status = 'rented'` 统计已出租车辆，
 * 但订单流转从不写这个字段，于是该统计恒为 0；而车辆列表又在运行时
 * 用订单区间另算一套 actual_status，两处永远对不上。
 * 现在统一：status 只表达人工设定的可用性，在租与否一律由订单推导。
 */
export const VEHICLE_STATUS_WHITELIST = ['available', 'maintenance', 'unavailable'];

/**
 * 取当前处于出租中（被未结束订单占用）的车辆 id 集合。
 * 判定依据：订单为待取车或已取车，且当前时间落在取还车区间之内。
 * 车辆列表与仪表盘共用本函数，避免两处口径不一致。
 */
export async function busyVehicleIds(db: D1Database, at?: string): Promise<Set<string>> {
  const currentTime = at ?? now();

  const rows = await query<{ vehicle_id: string }>(
    db,
    `SELECT DISTINCT vehicle_id FROM orders
     WHERE status IN ('pending', 'active')
       AND start_date <= ?
       AND end_date > ?`,
    [currentTime, currentTime]
  );

  return new Set(rows.map((row) => row.vehicle_id));
}
