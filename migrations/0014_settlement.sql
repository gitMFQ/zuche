-- 车主结算台账（本模块的核心）
--
-- 背景：捷途 宁A8E9K2 / 哈弗H6 宁A173GV / 雅阁 宁A917DE 三份单车台账，列结构一致：
--   月份|序号|平台|姓名|用车时间|还车时间|数量|单价|合计|平台管理费|结算金额|公司管理费|其他费用|车主结算金额|备注
-- 公式（已用真实数据逐行验证）：
--   平台管理费   = 合计 × 平台费率          (哈啰 15% / 携程 15% / 线下视情况 0 或 15%)
--   结算金额     = 合计 − 平台管理费
--   公司管理费   = 结算金额 × 公司费率        (捷途 15% / 雅阁 10% / 自营 0)
--   车主结算金额 = 结算金额 − 公司管理费 − 其他费用
--
-- ==================== 为什么是「calc_* + 最终值」双列 ====================
--
-- 台账的备注列承载着真实的业务调整：「机场还车，过路费6元，洗车10元，补气5元」
-- 「顶H6」「订单有误，续租没收费，后又取消续租，但费用显示没退，实际线下没有收取费用」。
-- 也就是说金额一定会被人工改。
--
-- 与此同时订单会被改价、续租、还车重算，这些都会触发结算行重算。
-- 如果重算无脑覆盖，用户手工填的「其他费用」会被悄悄改回去 —— 账错了而且没人发现。
--
-- 解法：calc_* 永远记录系统算出来的值（供前端展示差异），最终值列在
-- amount_overridden = 1 时不再被重算覆盖。重算语句见 lib/settlement.ts 的
-- buildSettlementRefreshStmt，用 CASE WHEN amount_overridden = 1 THEN 原值 ELSE 新值 END。
--
-- 外键策略：
--   * owner_id / vehicle_id 用 RESTRICT —— 钱的历史不能跟着车或车主一起消失。
--     代价是删车/删车主会变成 400，前端要把「删除」引导成「停用」。
--   * order_id 软引用不加外键 —— 订单删除时由控制器先读出来写红字、再作废结算行，
--     级联删除会让历史账目凭空消失。

CREATE TABLE IF NOT EXISTS settlement_lines (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  vehicle_id TEXT,
  -- 软引用 orders.id
  order_id TEXT,
  -- 结算期 YYYY-MM。是人工选定的「结算归属月」，不等于订单日期（跨月补结算很常见）
  period TEXT NOT NULL,
  -- 用车时间，台账「用车时间」列
  line_date TEXT NOT NULL,
  order_no TEXT,
  -- 车牌快照：删车后历史结算行仍要能显示车牌
  plate_number TEXT,
  -- 订单来源 id（软引用 order_sources.id）
  source_id_ref TEXT,
  -- 平台名快照（哈啰 / 携程 / 线下）
  source_name TEXT,
  customer_name TEXT,
  start_date TEXT,
  end_date TEXT,
  -- 数量（天）
  days REAL NOT NULL DEFAULT 0,
  -- 单价
  unit_price REAL NOT NULL DEFAULT 0,

  -- ---- 系统计算值（每次重算都更新）----
  calc_total_amount REAL NOT NULL DEFAULT 0,
  calc_platform_rate REAL NOT NULL DEFAULT 0,
  calc_platform_fee REAL NOT NULL DEFAULT 0,
  calc_settlement_amount REAL NOT NULL DEFAULT 0,
  calc_company_rate REAL NOT NULL DEFAULT 0,
  calc_company_fee REAL NOT NULL DEFAULT 0,
  calc_owner_amount REAL NOT NULL DEFAULT 0,

  -- ---- 最终值（对外/导出用；被人工改过后不再自动覆盖）----
  total_amount REAL NOT NULL DEFAULT 0,
  platform_fee REAL NOT NULL DEFAULT 0,
  settlement_amount REAL NOT NULL DEFAULT 0,
  company_fee REAL NOT NULL DEFAULT 0,
  -- 其他费用：正数 = 车主承担（减少车主所得），负数 = 反向补贴
  other_fee REAL NOT NULL DEFAULT 0,
  owner_amount REAL NOT NULL DEFAULT 0,
  -- 1 = 本行金额被人工改过，重算只更新 calc_* 不动最终值
  amount_overridden INTEGER NOT NULL DEFAULT 0,
  override_note TEXT,

  -- order 系统生成 / manual 手工补录 / carryover 期初结转
  source_type TEXT NOT NULL DEFAULT 'order',
  -- 源单据 id，与 source_type、line_kind 一起构成幂等键
  source_id TEXT,
  -- 同一单据需要拆多行时用它区分（例如一张单分出「顶车」的补偿行）
  line_kind TEXT NOT NULL DEFAULT 'main',
  -- posted 正常 / void 已作废
  status TEXT NOT NULL DEFAULT 'posted',
  voided_reason TEXT,
  -- 台账「备注」列原文
  remarks TEXT,
  operator_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE RESTRICT,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT
);

-- 幂等键：同一单据的同一语义槽只生成一行。手工补录 source_id 为 NULL，不受约束
CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_lines_idem
  ON settlement_lines(source_type, source_id, line_kind) WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_settlement_lines_period ON settlement_lines(period, owner_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_settlement_lines_owner ON settlement_lines(owner_id, period);
CREATE INDEX IF NOT EXISTS idx_settlement_lines_vehicle ON settlement_lines(vehicle_id, period);
CREATE INDEX IF NOT EXISTS idx_settlement_lines_order ON settlement_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_settlement_lines_status ON settlement_lines(status, period);

-- 车辆/车主年初结转（台账里的「2024年余额 5387」「2025年月 8186.83」）。
--
-- 唯一约束为什么用冗余的 owner_vehicle_key 而不是 (owner_id, vehicle_id, fiscal_year)：
-- 按车主汇总的结转行 vehicle_id 为 NULL，而 SQLite 里 NULL 互不相等，
-- 唯一约束会静默失效，同一年可以插进去任意多条。拼成一个非空字符串列才拦得住。
CREATE TABLE IF NOT EXISTS settlement_openings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  vehicle_id TEXT,
  owner_vehicle_key TEXT NOT NULL,
  -- 结转所属年份，如 2025 表示「2025 年初的余额」
  fiscal_year INTEGER NOT NULL,
  -- 结转余额（正数 = 公司应付车主）
  amount REAL NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE RESTRICT,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_openings_uniq
  ON settlement_openings(owner_vehicle_key, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_settlement_openings_year ON settlement_openings(fiscal_year, owner_id);

-- 结算付款：台账底部的「支出区」（结车款 / 预付车款 / 停车费代办）。
-- 每条付款都会在同批里产生一条 direction='out' 的资金流水。
CREATE TABLE IF NOT EXISTS settlement_payouts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  vehicle_id TEXT,
  -- 归属结算期 YYYY-MM
  period TEXT NOT NULL,
  -- settlement 结车款 / advance 预付 / adjust 调整
  payout_type TEXT NOT NULL DEFAULT 'settlement',
  amount REAL NOT NULL,
  -- 从哪个账户付的
  account_id TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  remarks TEXT,
  operator_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE RESTRICT,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
  FOREIGN KEY (account_id) REFERENCES fund_accounts(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_settlement_payouts_owner_period ON settlement_payouts(owner_id, period);
CREATE INDEX IF NOT EXISTS idx_settlement_payouts_date ON settlement_payouts(paid_at);
CREATE INDEX IF NOT EXISTS idx_settlement_payouts_vehicle ON settlement_payouts(vehicle_id, period);
