-- 车主档案 + 车辆档案扩展
--
-- 背景：公司总台账（file-4）的「车辆档案」sheet 有 车辆编号 / 车型分类 / 购入日期 /
--       初始里程 四列，现有 vehicles 表都没有；三份单车车主结算台账（捷途 / 哈弗H6 /
--       雅阁）还暴露了「车主」这个实体 —— 车与车主是分开的，车主要按车结算收益。
--       台账里的「车主结算金额 = 结算金额 − 公司管理费 − 其他费用」就是给车主的钱。
--
-- 外键策略：
--   * vehicles.owner_id 刻意不声明外键 —— SQLite 的 ALTER TABLE ADD COLUMN 带
--     REFERENCES 在 D1 上行为不一致，且仓库既有先例（orders.vehicle_id / customer_id）
--     就是「用控制器层校验代替外键」，删除前先查引用能给出更可控的报错文案。
--   * owners 不声明任何外键 —— 它是最上游主数据。
--
-- 为什么车主与合伙人用一张表：
--   台账 file-5 里的牛昭平、马跃既是挂靠车辆的车主，又在公司有大量往来垫付
--   （资金流水摘要里反复出现「牛昭平垫付H6贷款1978.78」「报销牛昭平垫付」）。
--   拆成两张表会让同一个人在界面上出现两次，账也对不齐。用 role 区分身份即可。

-- ==================== 车主档案 ====================

CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  id_card TEXT,
  -- owner 挂靠车主 / partner 合伙人(股东) / both 两者兼具
  -- 台账里的牛昭平、马跃是 both
  role TEXT NOT NULL DEFAULT 'owner',
  -- 公司管理费率（%）。按车主配而不是全局统一：
  -- 捷途宁A8E9K2 是 15%（台账 file-1：334.9 × 15% = 50.235），
  -- 雅阁宁A917DE 是 10%（台账 file-3：191.25 × 10% = 19.125），
  -- 自营的哈弗H6 没有这一列，等价于 0。
  -- 生成结算行时会快照进 settlement_lines.calc_company_rate，之后改率不影响历史行。
  company_fee_rate REAL NOT NULL DEFAULT 15,
  bank_name TEXT,
  bank_account TEXT,
  -- 往来期初余额（正数 = 公司应付此人）。历史明细不迁移，只结转这个数
  opening_balance REAL NOT NULL DEFAULT 0,
  opening_date TEXT,
  status INTEGER NOT NULL DEFAULT 1,
  remarks TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_owners_name ON owners(name);
CREATE INDEX IF NOT EXISTS idx_owners_status ON owners(status);
CREATE INDEX IF NOT EXISTS idx_owners_role ON owners(role);

-- ==================== vehicles 档案扩展 ====================

-- 车辆编号：台账里是 01-18 的两位序号，用来在纸质/Excel 台账和系统之间对齐
ALTER TABLE vehicles ADD COLUMN vehicle_no TEXT;
-- 车型分类：SUV / sedan 轿车 / MPV / pickup 皮卡（台账「车型」列）
-- 与既有的 body_type（携程车型串解析出的车身类型）用途不同，不要合并
ALTER TABLE vehicles ADD COLUMN category TEXT;
ALTER TABLE vehicles ADD COLUMN purchase_date TEXT;
ALTER TABLE vehicles ADD COLUMN purchase_price REAL;
-- 购入时表显里程。单车月报算里程差用 mileage − initial_mileage
ALTER TABLE vehicles ADD COLUMN initial_mileage INTEGER;
-- 车主 id（软引用 owners.id，见文件头外键策略）
ALTER TABLE vehicles ADD COLUMN owner_id TEXT;
-- company 自有 / attached 挂靠。自营车的公司费率取 0，挂靠车取车主配置的费率
ALTER TABLE vehicles ADD COLUMN ownership_type TEXT NOT NULL DEFAULT 'company';
-- 月供（车贷）。台账里雅阁 2030.31/月、三辆 H6 合计 6978.78/月，
-- 是单车月报「结余」列的主要扣减项
ALTER TABLE vehicles ADD COLUMN monthly_payment REAL NOT NULL DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN loan_total REAL;
ALTER TABLE vehicles ADD COLUMN loan_terms INTEGER;
ALTER TABLE vehicles ADD COLUMN loan_start_date TEXT;
-- 月供扣款账户（软引用 fund_accounts.id，该表在 0013 建）
ALTER TABLE vehicles ADD COLUMN loan_account_id TEXT;

-- 车辆编号允许为空（很多老车还没编号），但一旦填了就必须唯一。
-- 用部分索引而不是普通唯一索引：SQLite 里 NULL 互不相等，普通唯一索引其实也能用，
-- 但显式写 WHERE 更能表达「只约束填了值的行」这个意图。
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_vehicle_no ON vehicles(vehicle_no) WHERE vehicle_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_ownership ON vehicles(ownership_type);
