-- 常用查询路径的索引：D1 每次请求有查询次数上限，索引能显著减少全表扫描

CREATE INDEX IF NOT EXISTS idx_orders_vehicle ON orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_dates ON orders(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

CREATE INDEX IF NOT EXISTS idx_violations_vehicle ON violations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_violations_customer ON violations(customer_id);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
CREATE INDEX IF NOT EXISTS idx_violations_date ON violations(violation_date);

CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_date ON maintenance(maintenance_date);

CREATE INDEX IF NOT EXISTS idx_insurance_vehicle ON insurance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_insurance_end ON insurance(end_date);

CREATE INDEX IF NOT EXISTS idx_inspections_vehicle ON inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_inspections_expiry ON inspections(expiry_date);

CREATE INDEX IF NOT EXISTS idx_blacklist_phone ON blacklist(phone);
CREATE INDEX IF NOT EXISTS idx_blacklist_id_card ON blacklist(id_card);
CREATE INDEX IF NOT EXISTS idx_blacklist_customer ON blacklist(customer_id);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_brand ON vehicles(brand);

CREATE INDEX IF NOT EXISTS idx_logs_created ON operation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_user ON operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_action ON operation_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_entity ON operation_logs(entity_type);
