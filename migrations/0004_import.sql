-- 订单批量导入 + 两个平台导出格式暴露出的字段补全
--
-- 背景：携程供应商后台导出（70 列）与自有平台导出（145 列）里有一批现有 schema
--       承载不了的信息（实际取车时间、违章押金、司机、费用明细、续租历史、
--       配送方式、取消原因、车辆四属性、渠道分级）。不补这些字段，导入等于丢数据。
--
-- 外键策略（与 0001 一致）：
--   * order_fees / order_extensions 依附订单，用 CASCADE —— 订单删了明细就该一起走。
--   * orders 的司机字段刻意不声明外键 —— 司机可能来自平台导出，系统里没有对应
--     users 记录，此时只存名字。声明外键会让这类订单写不进去。
--   * import_batches 不声明外键 —— 批次记录要能独立于用户保留，删用户不该删导入台账。

-- ==================== orders 补全 ====================

-- 来源平台：'ctrip' 携程 / 'self' 自有平台 / NULL 系统内手工建单
ALTER TABLE orders ADD COLUMN platform TEXT;
-- 平台侧原始订单号，导入幂等键 + 对账凭据
ALTER TABLE orders ADD COLUMN external_no TEXT;
-- 所属导入批次，支持整批撤销与溯源
ALTER TABLE orders ADD COLUMN import_batch_id TEXT;

-- 实际取车时间：updateOrderStatus 原来只在还车时写 actual_end_date，
-- 取车时没有对称字段，补上后取还车时间轴才完整
ALTER TABLE orders ADD COLUMN actual_start_date TEXT;

-- 违章押金：携程/自有平台都是与租车押金分开的独立款项（固定 2000），
-- 原来只能混进 deposit，无法区分
ALTER TABLE orders ADD COLUMN violation_deposit REAL DEFAULT 0;

-- 取消原因与时间：原来只能塞进 remarks，无法统计取消率与原因分布
ALTER TABLE orders ADD COLUMN cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN cancelled_at TEXT;

-- 配送方式：'delivery' 送车上门 / 'store' 门店自取
-- 影响调度派单，不能只靠 pickup_location 文本推断
ALTER TABLE orders ADD COLUMN delivery_type TEXT;

-- 司机：平台导出给的是人名（可能不是本系统用户），
-- 因此名字与 user_id 分开存，匹配不上 users 时只留名字
ALTER TABLE orders ADD COLUMN pickup_driver_id TEXT;
ALTER TABLE orders ADD COLUMN pickup_driver_name TEXT;
ALTER TABLE orders ADD COLUMN return_driver_id TEXT;
ALTER TABLE orders ADD COLUMN return_driver_name TEXT;

-- 预订车型：自有平台区分「预订车辆」与「排车车辆」，
-- 两者不同说明发生了车型升级/降级，丢了就看不到
ALTER TABLE orders ADD COLUMN booked_model TEXT;

-- ==================== vehicles 补全 ====================
-- 携程车型串形如「丰田威兰达 (普通) 5座 5门 自动 汽油 SUV」，
-- 含四个现有 schema 没有的属性；补上后可精确判定动力类型，
-- 不再靠 is_new_energy 猜
ALTER TABLE vehicles ADD COLUMN transmission TEXT;
ALTER TABLE vehicles ADD COLUMN fuel_type TEXT;
ALTER TABLE vehicles ADD COLUMN body_type TEXT;
ALTER TABLE vehicles ADD COLUMN doors INTEGER;

-- ==================== order_sources 补全 ====================
-- 渠道是两级：平台（携程/去哪儿）→ 具体入口（App大首页/目的地联想推荐）。
-- 原来只有一层，无法按平台聚合
ALTER TABLE order_sources ADD COLUMN platform TEXT;

-- ==================== 新表：订单费用明细 ====================
-- 两个导出都有几十个费用分项，且每个都是「应收/已收/退款」三元组。
-- 现有 payments 只有 amount + 6 个粗粒度 payment_type，完全放不下，
-- 也不支持「应收」与「退款」概念（paid_amount 只能单调累加，退款只能填负数）。
-- 这里用明细表承载，而不是为几十个费用各建一列。
CREATE TABLE IF NOT EXISTS order_fees (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  -- rent 租金 / service 服务费 / deposit 押金 / penalty 违约金 / extra 附加 / other 其他
  fee_category TEXT NOT NULL,
  -- 平台原始中文名，如「超公里费」「剐蹭无忧保障费」，保留以便对账
  fee_name TEXT NOT NULL,
  receivable REAL DEFAULT 0,
  received REAL DEFAULT 0,
  refunded REAL DEFAULT 0,
  platform TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ==================== 新表：续租历史 ====================
-- extendOrder 原来只改 end_date 并累加金额，不留痕，
-- 看不出一张单续过几次、每次多少钱
CREATE TABLE IF NOT EXISTS order_extensions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  original_end_date TEXT NOT NULL,
  new_end_date TEXT NOT NULL,
  extend_days INTEGER DEFAULT 0,
  extend_amount REAL DEFAULT 0,
  payment_method TEXT,
  operator_id TEXT,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ==================== 新表：导入批次台账 ====================
CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  filename TEXT,
  total_rows INTEGER DEFAULT 0,
  success_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  new_vehicles INTEGER DEFAULT 0,
  operator_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 索引 ====================
-- UNIQUE 索引中 NULL 互不相等，历史订单（platform/external_no 均为 NULL）不受影响
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_external_no ON orders(platform, external_no);
CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform);
CREATE INDEX IF NOT EXISTS idx_orders_batch ON orders(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_driver ON orders(pickup_driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_return_driver ON orders(return_driver_id);
CREATE INDEX IF NOT EXISTS idx_order_fees_order ON order_fees(order_id);
CREATE INDEX IF NOT EXISTS idx_order_extensions_order ON order_extensions(order_id);
