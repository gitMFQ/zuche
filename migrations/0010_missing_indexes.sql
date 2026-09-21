-- F1 补齐查询路径缺失的索引
--
-- 这些索引对应实际存在但没被覆盖的访问模式：
--   * 收入报表按月/按日范围过滤 + 分组 payments.created_at
--   * 客户 / 车辆 / 订单来源 / 违章列表都是 ORDER BY created_at DESC
--   * 完成订单按 actual_end_date DESC 排序（orders.ts 的默认排序分支）
--   * 车辆「是否在租」判定按 (vehicle_id, status, 时间区间) 过滤

CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);

CREATE INDEX IF NOT EXISTS idx_customers_created ON customers(created_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_created ON vehicles(created_at);
CREATE INDEX IF NOT EXISTS idx_order_sources_created ON order_sources(created_at);
CREATE INDEX IF NOT EXISTS idx_violations_created ON violations(created_at);

CREATE INDEX IF NOT EXISTS idx_orders_actual_end ON orders(actual_end_date);

-- 车辆占用判定（列表状态筛选、仪表盘统计、可用车辆校验都走这个组合）
CREATE INDEX IF NOT EXISTS idx_orders_vehicle_status_dates ON orders(vehicle_id, status, start_date, end_date);
