-- 初始数据：管理员账号（admin / admin123）、默认订单来源、系统标题
-- 全部使用 INSERT OR IGNORE，重复执行不会产生脏数据

-- 管理员账号，密码明文为 admin123（bcrypt cost 10）
INSERT OR IGNORE INTO users (id, username, password, name, role, phone, email, status)
VALUES (
  'user-admin',
  'admin',
  '$2b$10$1AyNolKBKHyPTB4/xRufg.ONI7.MTFzwgMYyb6C2dGnE08Vpim3Ye',
  '管理员',
  'admin',
  '13800138000',
  'admin@rental.com',
  1
);

-- 默认订单来源，id 固定便于业务代码与测试数据引用
INSERT OR IGNORE INTO order_sources (id, name, commission_rate, color, remarks, status) VALUES
  ('src-store',    '门店直租', 0,  '#409EFF', '客户直接到门店租车', 1),
  ('src-meituan',  '美团',     10, '#FF9900', '美团平台订单',       1),
  ('src-ctrip',    '携程',     12, '#2577E3', '携程平台订单',       1),
  ('src-didi',     '滴滴',     15, '#FF7D41', '滴滴租车平台订单',   1),
  ('src-other',    '其他',     0,  '#909399', '其他渠道',           1);

INSERT OR IGNORE INTO system_settings (key, value) VALUES ('system_title', '租车管理系统');
