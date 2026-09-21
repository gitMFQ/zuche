-- A1 时区统一：全系统以北京时间为准
--
-- 背景：src/lib/time.ts 的 now() 早期用 toISOString() 写 UTC，而用户录入的时间
--       （datetime-local / 平台导出）是北京时间，导致同一个库里存在两套时间基准。
--       本次把「系统写入」的时间列 +8 小时，对齐到北京时间。
--
-- 判定依据（逐列核对过来源）：
--   * 系统写入（now() / datetime('now')）的审计列：created_at / updated_at 等，全部 +8
--   * 用户录入的业务列：orders.start_date / end_date、maintenance.maintenance_date、
--     violations.violation_date、insurance.start_date / end_date、inspections.expiry_date、
--     customers.license_expiry、vehicles.last_maintenance、orders.deposit_waived_expiry
--     —— 本来就是北京时间，一律不动
--   * orders.actual_start_date 是混合来源，需分开处理：
--       - 系统内取车（import_batch_id IS NULL）由后端 now() 自动填充 → UTC，需 +8
--         （前端此前提交的字段名 actual_pickup_date 与后端读取的 actual_start_date 不一致，
--           用户填的取车时间其实从未落库，该列历史值全部来自 now()）
--       - 平台导入（import_batch_id IS NOT NULL）来自导出表 → 北京时间，不动
--   * orders.actual_end_date 两个来源都是北京时间（前端 datetime-local / 平台导出），不动
--
-- 用 COALESCE(datetime(x,'+8 hours'), x) 兜底：若某行时间格式异常，
-- datetime() 会返回 NULL，此时保留原值而不是把数据清空。

-- ==================== 审计列（系统写入，全部 +8）====================

UPDATE users SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at),
  updated_at = COALESCE(datetime(updated_at, '+8 hours'), updated_at);

UPDATE customers SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at),
  updated_at = COALESCE(datetime(updated_at, '+8 hours'), updated_at);

UPDATE vehicles SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at),
  updated_at = COALESCE(datetime(updated_at, '+8 hours'), updated_at);

UPDATE orders SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at),
  updated_at = COALESCE(datetime(updated_at, '+8 hours'), updated_at),
  cancelled_at = COALESCE(datetime(cancelled_at, '+8 hours'), cancelled_at);

-- 系统内取车自动填充的取车时间（导入订单不动）
UPDATE orders SET
  actual_start_date = COALESCE(datetime(actual_start_date, '+8 hours'), actual_start_date)
WHERE import_batch_id IS NULL AND actual_start_date IS NOT NULL;

UPDATE payments SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at);

UPDATE violations SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at),
  updated_at = COALESCE(datetime(updated_at, '+8 hours'), updated_at),
  handle_date = COALESCE(datetime(handle_date, '+8 hours'), handle_date);

UPDATE blacklist SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at),
  updated_at = COALESCE(datetime(updated_at, '+8 hours'), updated_at);

UPDATE order_sources SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at),
  updated_at = COALESCE(datetime(updated_at, '+8 hours'), updated_at);

UPDATE maintenance SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at),
  updated_at = COALESCE(datetime(updated_at, '+8 hours'), updated_at);

UPDATE insurance SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at),
  updated_at = COALESCE(datetime(updated_at, '+8 hours'), updated_at);

UPDATE inspections SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at),
  updated_at = COALESCE(datetime(updated_at, '+8 hours'), updated_at);

UPDATE order_fees SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at);

UPDATE order_extensions SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at);

UPDATE import_batches SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at);

UPDATE operation_logs SET
  created_at = COALESCE(datetime(created_at, '+8 hours'), created_at);

UPDATE system_settings SET
  updated_at = COALESCE(datetime(updated_at, '+8 hours'), updated_at);
