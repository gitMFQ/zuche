-- C1 车辆状态真相统一
--
-- vehicles.status 早期可以取 'rented'，但订单流转从不维护它，
-- 导致仪表盘「已出租」恒为 0，而车辆列表又在运行时用订单区间另算一套。
-- 现在 status 只表达人工设定的可用性，是否在租一律由订单推导。
--
-- 存量把 rented 归一成 available：派生逻辑会按订单自动显示出「已出租」，
-- 不需要也不应该由这一列承担。

UPDATE vehicles SET status = 'available', updated_at = updated_at WHERE status = 'rented';
