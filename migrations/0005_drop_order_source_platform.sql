-- 订单来源不再区分所属平台，来源本身就是渠道
ALTER TABLE order_sources DROP COLUMN platform;
