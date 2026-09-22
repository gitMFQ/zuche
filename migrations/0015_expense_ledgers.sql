-- 车辆费用台账 + 运营开支台账 + 合伙人往来账 + 订单应收/开票
--
-- 背景：公司总台账（file-4）的三本账，以及 file-5 的合伙人往来账：
--   * 车辆费用台账：日期|车牌|费用类型(维修/违章/保养/审车/洗车费/过路费/保险)|收入|支出|有无发票|备注
--   * 运营开支台账：日期|项目(27 类)|金额|支付方式(微信/公户)|备注
--   * 合伙人往来账：序号|日期|科目|金额|备注（开办费 / 领工资 / 下账 / 垫付）
--
-- 三个关键事实决定了下面的表结构：
--
-- 1. 车辆费用**收入与支出同行**。台账 2026.4.13 有一行「宁AF63561 | 违章 | 收入300 | 支出300」，
--    也有纯收入行「宁A7919K | 维修 | 收入2500 | 支出/ | 王宗强」（车损赔偿）。所以用双列而不是单金额。
--
-- 2. 「有无发票」是独立维度，值有「无 / 已开 / WU」，不是费用类型的一部分。
--
-- 3. 费用是权责发生还是现金收付要分开：只有填了付款账户（is_paid=1）的费用才写资金流水。
--    没付款的只进费用台账（应付），否则账户余额会虚高。
--
-- 外键策略：
--   * vehicle_expenses.vehicle_id 用 CASCADE，与既有 maintenance/insurance/inspections/
--     violations 保持一致（今天删车就会连带删保养/保险），不改变既有删除体验。
--     settlement_lines 反过来用 RESTRICT —— 结算行是钱的历史，车辆费用是过程记录。
--   * account_id 一律 RESTRICT。

-- ==================== 字典 ====================

-- 运营开支项目（台账里的 27 项，按原顺序给 sort_order）
CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- 车辆费用类型（台账的 7 类 + 三份单车台账支出区里出现的几类）
CREATE TABLE IF NOT EXISTS vehicle_expense_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- expense 通常只有支出 / income 通常只有收入 / both 两者都可能
  -- （违章是 both：向客户收罚款是收入，公司去缴罚款是支出）
  default_direction TEXT NOT NULL DEFAULT 'expense',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- ==================== 车辆费用台账 ====================

CREATE TABLE IF NOT EXISTS vehicle_expenses (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  -- 车牌与车主快照：删车后（CASCADE 会删掉本行，但历史导出与报表缓存仍可能引用）保持一致
  plate_number TEXT,
  owner_id TEXT,
  expense_date TEXT NOT NULL,
  -- 字典 id 与名称快照（字典改名不影响历史行）
  expense_type TEXT NOT NULL,
  expense_type_name TEXT NOT NULL,
  -- 收入侧：车损赔偿 / 停运费 / 保险理赔
  income_amount REAL NOT NULL DEFAULT 0,
  -- 支出侧：维修 / 保养 / 罚款 / 洗车 / 过路费。同一行可以两侧都有
  expense_amount REAL NOT NULL DEFAULT 0,
  -- none 无票 / pending 待开 / issued 已开
  invoice_status TEXT NOT NULL DEFAULT 'none',
  invoice_no TEXT,
  -- 只有 is_paid = 1 且 account_id 非空时才写资金流水
  is_paid INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  account_id TEXT,
  -- 保险等年费按 N 个月分摊进单车月报；1 表示现金口径（当月全额计入）
  amortize_months INTEGER NOT NULL DEFAULT 1,
  -- 金额被人工改过的行不被业务镜像更新覆盖（同 settlement_lines 的思路）
  amount_overridden INTEGER NOT NULL DEFAULT 0,
  -- 来源：maintenance / insurance / violation / manual
  source_type TEXT,
  source_id TEXT,
  source_kind TEXT NOT NULL DEFAULT 'main',
  remarks TEXT,
  images TEXT,
  operator_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES fund_accounts(id) ON DELETE RESTRICT
);

-- 幂等镜像：一条保养/保险/违章记录只镜像出一行车辆费用，重复调用不会写重
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_expenses_idem
  ON vehicle_expenses(source_type, source_id, source_kind) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_date ON vehicle_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_vehicle ON vehicle_expenses(vehicle_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_type ON vehicle_expenses(expense_type, expense_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_source ON vehicle_expenses(source_type, source_id);

-- ==================== 运营开支台账 ====================

CREATE TABLE IF NOT EXISTS operating_expenses (
  id TEXT PRIMARY KEY,
  expense_date TEXT NOT NULL,
  -- 字典 id 与名称快照
  category TEXT NOT NULL,
  category_name TEXT NOT NULL,
  amount REAL NOT NULL,
  -- 空 = 应付未付
  account_id TEXT,
  is_paid INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  invoice_status TEXT NOT NULL DEFAULT 'none',
  invoice_no TEXT,
  -- 收款方
  payee TEXT,
  remarks TEXT,
  operator_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES fund_accounts(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_operating_expenses_date ON operating_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_operating_expenses_category ON operating_expenses(category, expense_date);
CREATE INDEX IF NOT EXISTS idx_operating_expenses_paid ON operating_expenses(is_paid, expense_date);

-- ==================== 合伙人往来账 ====================
-- 台账 file-5：牛昭平 21 笔（开办费 63202 + 领工资 + 下账）、马跃 14 笔（开办费 48033 + 发工资 + 还个人贷款）
CREATE TABLE IF NOT EXISTS partner_advances (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  advance_date TEXT NOT NULL,
  -- setup 开办费 / advance 垫资 / loan 借款 / salary 领工资 /
  -- writeoff 下账 / reimburse 报销 / repay 还款 / other
  subject TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  -- 恒为正数
  amount REAL NOT NULL,
  -- in 公司应付增加（合伙人垫付）/ out 已付给合伙人（还款、报销、工资）
  direction TEXT NOT NULL,
  is_paid INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  account_id TEXT,
  -- 备注承载明细：「房租押金35000」「爸爸借款2000+2800+200」
  remarks TEXT,
  operator_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE RESTRICT,
  FOREIGN KEY (account_id) REFERENCES fund_accounts(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_partner_advances_owner ON partner_advances(owner_id, advance_date);
CREATE INDEX IF NOT EXISTS idx_partner_advances_date ON partner_advances(advance_date);
CREATE INDEX IF NOT EXISTS idx_partner_advances_paid ON partner_advances(is_paid, advance_date);

-- ==================== orders：应收与开票 ====================
-- 台账「租金台账」的「开票金额」列常常大于「总租金额」（总租金额 100.30 / 开票 118），
-- 是含服务费的含税开票价，不能用 total_amount 推导，必须单独存。
--
-- 「未结清」列刻意只做人工枚举 + 备注，**不跟 paid_amount 自动联动**：
-- 台账里这一列被当备注用了（值是「维修，含两天停运费三百元」「只转利润，未转全部金额」），
-- 自动推导会覆盖业务判断。前端给一个「按已收/应收推荐值」的辅助提示即可。
ALTER TABLE orders ADD COLUMN invoice_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN invoice_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE orders ADD COLUMN settle_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN settle_remarks TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_settle_status ON orders(settle_status);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_status ON orders(invoice_status);
