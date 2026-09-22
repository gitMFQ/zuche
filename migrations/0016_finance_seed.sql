-- 财务模块种子数据：资金账户 + 两套费用字典 + 订单来源补全
--
-- 与 0003_seed.sql 同风格，全部 INSERT OR IGNORE，重复执行安全。

-- ==================== 资金账户 ====================
--
-- 期初余额一律先填 0、期初日期填迁移当天，由用户在「财务 → 资金流水」页按真实余额改。
-- 语义是「opening_balance 是系统里第一条流水之前的余额，之后录入的流水都叠加在它之上」。
-- 所以余额要填**开始用系统时**的真实余额，不要把已经在期初余额里体现过的流水再录一遍。
-- opening_date 只是说明「这个余额是哪天观察到的」，不参与计算（见 0013 的说明）。
--
-- 账户划分来自台账「资金流水总账」备注列实际记录的内容（「公户：413.97元，微信：928.95」）。
--
-- 「平台待结算」（method_key='platform'）是虚拟账户：
-- 平台单的钱先记到它，平台打款时用「账户划转」转入公户。这样「所有收款都有流水」才成立，
-- 否则平台结算的钱会凭空出现在公户余额里。
--
-- 「待归属」（method_key 为空）是兜底账户：支付方式没有映射到任何账户时自动落到这里，
-- 保证业务写入永远不会因为「账户没配好」而失败。界面上支持批量改归属。
INSERT OR IGNORE INTO fund_accounts (id, name, account_type, method_key, opening_balance, opening_date, is_active, sort_order, remarks, created_at, updated_at) VALUES
  ('fa-bank',     '公户',       'bank',    'bank',     0, date('now','+8 hours'), 1, 10, '对公银行账户',              datetime('now','+8 hours'), datetime('now','+8 hours')),
  ('fa-wechat',   '微信',       'wechat',  'wechat',   0, date('now','+8 hours'), 1, 20, '微信收款',                  datetime('now','+8 hours'), datetime('now','+8 hours')),
  ('fa-alipay',   '支付宝',     'alipay',  'alipay',   0, date('now','+8 hours'), 1, 30, '支付宝收款',                datetime('now','+8 hours'), datetime('now','+8 hours')),
  ('fa-cash',     '现金',       'cash',    'cash',     0, date('now','+8 hours'), 1, 40, '现金收支',                  datetime('now','+8 hours'), datetime('now','+8 hours')),
  ('fa-platform', '平台待结算', 'virtual', 'platform', 0, date('now','+8 hours'), 1, 50, '平台单先记这里，打款时划转到公户', datetime('now','+8 hours'), datetime('now','+8 hours')),
  ('fa-hold',     '待归属',     'virtual', NULL,       0, date('now','+8 hours'), 1, 99, '支付方式未映射账户时的兜底',  datetime('now','+8 hours'), datetime('now','+8 hours'));

INSERT OR IGNORE INTO system_settings (key, value) VALUES ('finance_fallback_account_id', 'fa-hold');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('finance_platform_settle_account_id', 'fa-platform');

-- ==================== 运营开支项目字典 ====================
-- 取自公司总台账「运营开支台账」sheet 的「项目」列，共 27 项，
-- sort_order 按台账里的出现频次排序（结车款 84 次最高）。
INSERT OR IGNORE INTO expense_categories (id, name, sort_order, is_active, created_at) VALUES
  ('settle-pay',    '结车款',       10, 1, datetime('now','+8 hours')),
  ('meal',          '餐费',         20, 1, datetime('now','+8 hours')),
  ('car-loan',      '车贷',         30, 1, datetime('now','+8 hours')),
  ('fuel',          '油费',         40, 1, datetime('now','+8 hours')),
  ('service-charge','手续费',       50, 1, datetime('now','+8 hours')),
  ('repair-maintain','维修保养',    60, 1, datetime('now','+8 hours')),
  ('deposit-out',   '押金',         70, 1, datetime('now','+8 hours')),
  ('wash',          '洗车费',       80, 1, datetime('now','+8 hours')),
  ('violation-fine','违章处理罚款', 90, 1, datetime('now','+8 hours')),
  ('salary',        '工资',        100, 1, datetime('now','+8 hours')),
  ('water',         '水费',        110, 1, datetime('now','+8 hours')),
  ('insurance',     '车险',        120, 1, datetime('now','+8 hours')),
  ('loan-interest', '银行贷款利息',130, 1, datetime('now','+8 hours')),
  ('electricity',   '电费',        140, 1, datetime('now','+8 hours')),
  ('telecom',       '通讯费',      150, 1, datetime('now','+8 hours')),
  ('rent',          '租金',        160, 1, datetime('now','+8 hours')),
  ('transport',     '交通费',      170, 1, datetime('now','+8 hours')),
  ('daily-supplies','日用品',      180, 1, datetime('now','+8 hours')),
  ('toll',          '过路费',      190, 1, datetime('now','+8 hours')),
  ('driver-board',  '司机食宿',    200, 1, datetime('now','+8 hours')),
  ('inspection',    '审车',        210, 1, datetime('now','+8 hours')),
  ('entertain',     '招待费',      220, 1, datetime('now','+8 hours')),
  ('loan-repay',    '贷款',        230, 1, datetime('now','+8 hours')),
  ('social-security','社保',       240, 1, datetime('now','+8 hours')),
  ('office',        '办公用品',    250, 1, datetime('now','+8 hours')),
  ('tax',           '缴税',        260, 1, datetime('now','+8 hours')),
  ('parking',       '停车费',      270, 1, datetime('now','+8 hours'));

-- ==================== 车辆费用类型字典 ====================
-- 取自公司总台账「车辆费用台账」的 7 类（维修/违章/保养/审车/洗车费/过路费/保险）
-- 加上三份单车台账支出区里出现过的几类（停车费/补油/换刹车片/租车位）。
INSERT OR IGNORE INTO vehicle_expense_types (id, name, sort_order, default_direction, is_active, created_at) VALUES
  ('repair',      '维修',      10,  'expense', 1, datetime('now','+8 hours')),
  ('maintenance', '保养',      20,  'expense', 1, datetime('now','+8 hours')),
  ('violation',   '违章',      30,  'both',    1, datetime('now','+8 hours')),
  ('inspection',  '审车',      40,  'expense', 1, datetime('now','+8 hours')),
  ('wash',        '洗车费',    50,  'expense', 1, datetime('now','+8 hours')),
  ('toll',        '过路费',    60,  'expense', 1, datetime('now','+8 hours')),
  ('insurance',   '保险',      70,  'expense', 1, datetime('now','+8 hours')),
  ('parking',     '停车费',    80,  'expense', 1, datetime('now','+8 hours')),
  ('fuel',        '补油',      90,  'expense', 1, datetime('now','+8 hours')),
  ('brake',       '换刹车片', 100,  'expense', 1, datetime('now','+8 hours')),
  ('parking-spot','租车位',   110,  'expense', 1, datetime('now','+8 hours')),
  ('compensation','车损赔偿', 120,  'income',  1, datetime('now','+8 hours')),
  ('other',       '其他',     999,  'both',    1, datetime('now','+8 hours'));

-- ==================== 订单来源补全 ====================
--
-- 「哈啰」在 0003 的种子里缺失，但它是台账里的主力平台（66 条，与携程 62 条相当），
-- 不补上就根本没法录入哈啰的订单，也就没法生成对应的结算行。
--
-- 用的是 INSERT ... SELECT ... WHERE NOT EXISTS 而不是裸 INSERT：
-- order_sources.name **没有唯一约束**（只有 id 是主键），如果用户已经在
-- 「设置 → 订单来源」里手工建过一个「哈啰」，裸 INSERT 会插出第二条同名来源，
-- 之后按 source_id 分组的报表会把同一平台拆成两行。已经存在就跳过，
-- 并且不覆盖用户自己配的费率与颜色 —— 用户比我们清楚当前的商务条件。
INSERT OR IGNORE INTO order_sources (id, name, commission_rate, color, remarks, status)
SELECT 'src-halo', '哈啰', 15, '#3388FF', '哈啰租车平台订单', 1
WHERE NOT EXISTS (SELECT 1 FROM order_sources WHERE name = '哈啰');

-- 携程费率归一：台账里携程与哈啰一样按 15% 算平台管理费，而种子值是最早的 12%。
-- 带 `AND commission_rate = 12` 守卫，避免覆盖用户后来手工调整过的费率。
--
-- 注：费率就是「平台管理费率」，与结算行里算平台管理费用的是同一个值
-- （orders.net_amount 也用它扣佣金），所以两者天然一致。
UPDATE order_sources SET commission_rate = 15, updated_at = datetime('now','+8 hours')
WHERE id = 'src-ctrip' AND commission_rate = 12;
