-- 本地开发用演示数据，不进入生产迁移。
-- 用法：npx wrangler d1 execute zjzc --local --file=./scripts/seed-demo.sql

INSERT OR IGNORE INTO vehicles (id, plate_number, brand, model, color, year, seats, daily_rate, deposit, status) VALUES
  ('veh-demo-001', '京A12345', '丰田', '凯美瑞', '白色', 2023, 5, 280, 2000, 'available'),
  ('veh-demo-002', '京B67890', '本田', '雅阁',   '黑色', 2022, 5, 260, 1800, 'available'),
  ('veh-demo-003', '京C11111', '大众', '帕萨特', '银色', 2023, 5, 250, 1500, 'available');

INSERT OR IGNORE INTO customers (id, name, phone, id_card, status) VALUES
  ('cus-demo-001', '张三', '13900001111', '110101199001011234', 1),
  ('cus-demo-002', '李四', '13900002222', '110101199002021234', 1);
