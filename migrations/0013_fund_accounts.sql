-- 资金账户 + 流水总账 + 账户划转 + 账期锁定
--
-- 背景：公司总台账（file-4）的「资金流水总账」sheet 是 日期|摘要|收入金额|支出金额|余额|备注，
--       备注列里逐日记录分账户余额（「公户：3745.01，微信：981.93」）。
--       要复现这本账，必须有「账户」这个概念，并且余额要能按账户算出来。
--
-- ==================== 余额为什么不落库 ====================
--
-- 余额 = fund_accounts.opening_balance + SUM(该账户全部流水的收支)，按需查询。
-- 流水表**不存 balance_after**。
--
-- 求和**不按 opening_date 过滤**：opening_balance 是「系统里第一条流水之前」的余额，
-- 录入的所有流水都叠加在它之上。若按 opening_date 过滤，补录一笔早于期初日的流水
-- 会静默消失（明细查不到、余额也不计），这个陷阱比口径上的严谨更伤。
-- opening_date 保留作说明用途。
--
-- 理由：D1 没有跨语句交互式事务（只有 db.batch 是隐式事务），存滚动余额会在三种
-- 场景下必然算错，而且没有自愈机制：
--   1. 并发写 —— 两个请求同时读到同一个「上一行余额」，各自加完再写回
--   2. 事后回填 —— 补录上月流水后，后续所有月份的余额快照全部失效
--   3. 删除冲销 —— 删掉中间一行，后面的余额快照不会自己重算
-- 派生值永远不会漂移，也就不需要任何「余额修复脚本」。
-- 代价是读放大：本模块量级是每年几千行（台账一整年几百行），SUM 走索引毫秒级。
-- 真到十万行级再引入「月末快照 + 增量」，因为余额是派生的，升级不需要回填数据。
--
-- ==================== 删除为什么不级联 ====================
--
-- fund_transactions 对 payments/orders 等业务单据**不声明外键**，只存软引用
-- （source_type + source_id）。单据被删除时必须留下红字冲销行：
-- 流水记录的是「已经发生过的现金事实」，删单不等于钱没动；
-- 已出的对账单也不能因为后来删了一张单就变数字。
-- 如果这里给 payments 加 ON DELETE CASCADE，删订单会静默抹掉历史现金流。
--
-- 外键策略：
--   * fund_transactions.account_id → RESTRICT：有流水的账户不允许删除，
--     前端引导用户「停用」而不是删除。
--   * fund_transfers 两个账户 → RESTRICT，同上。

CREATE TABLE IF NOT EXISTS fund_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  -- bank 公户 / wechat 微信 / alipay 支付宝 / cash 现金 / virtual 虚拟
  -- virtual 有两个用途：method_key='platform' 的「平台待结算」（平台打款前的过渡账户），
  -- 以及 method_key=NULL 的「待归属」（支付方式没有映射账户时的兜底，见下）
  account_type TEXT NOT NULL,
  -- 映射 payments.payment_method: platform/wechat/alipay/cash/bank/other
  -- 一个支付方式只能映射一个账户（见下面的部分唯一索引）
  method_key TEXT,
  -- 期初余额与期初日期。历史明细不迁移，只结转这一步
  opening_balance REAL NOT NULL DEFAULT 0,
  opening_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- method_key 为 NULL 的账户不参与自动映射，可以有多个
CREATE UNIQUE INDEX IF NOT EXISTS idx_fund_accounts_method ON fund_accounts(method_key) WHERE method_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fund_accounts_active ON fund_accounts(is_active, sort_order);

-- 资金流水。amount 恒为正数，方向由 direction 表达（收入 in / 支出 out）
CREATE TABLE IF NOT EXISTS fund_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  -- 业务发生日 YYYY-MM-DD（不是写入日）—— 跨月补录靠它归属到正确的月份
  txn_date TEXT NOT NULL,
  direction TEXT NOT NULL,
  amount REAL NOT NULL,
  -- 收入: rent 租金 / deposit 押金 / violation 违章款 / compensation 车损赔偿 / transfer 划转 / other
  -- 支出: vehicle 车辆费用 / operating 运营开支 / settlement 车主结算款 / loan 车贷 / transfer 划转 / other
  category TEXT,
  -- 来源类型：payment / prepay / extension / refund / transfer / vehicle_expense /
  --          operating_expense / settlement_payout / partner_advance / loan / manual / void_reversal
  source_type TEXT NOT NULL,
  -- 业务单据 id（软引用，无外键；手工流水为 NULL）
  source_id TEXT,
  -- 单据内的语义槽：main / rent_in / deposit_in / penalty_in / violation_in /
  --                main_out / settlement_out / transfer_out / transfer_in / void_reversal ...
  -- 与 source_type、source_id 一起构成幂等键
  source_kind TEXT NOT NULL DEFAULT 'main',
  -- 对方：客户名 / 车牌 / 供应商 / 车主
  counterparty TEXT,
  summary TEXT NOT NULL,
  -- posted 已入账 / reversed 已冲销（被红字冲掉的原行）
  status TEXT NOT NULL DEFAULT 'posted',
  -- 冲销链：红字行记录 reverses_id=原行 id；原行记录 reversed_by_id=红字行 id
  reverses_id TEXT,
  reversed_by_id TEXT,
  operator_id TEXT,
  remarks TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES fund_accounts(id) ON DELETE RESTRICT
);

-- ==================== 幂等键 ====================
-- 同一单据的同一语义槽只能有一条流水，重复调用不会写重。
--
-- 「WHERE source_id IS NOT NULL」是必须的：SQLite 里 NULL 互不相等，
-- 所以手工记账（source_id 为 NULL）天然不受这个约束限制，可以自由重复录入 ——
-- 这正是业务需要的（同一天可以记两笔餐费）。
CREATE UNIQUE INDEX IF NOT EXISTS idx_fund_txn_idem
  ON fund_transactions(source_type, source_id, source_kind) WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fund_txn_account_date ON fund_transactions(account_id, txn_date, created_at);
CREATE INDEX IF NOT EXISTS idx_fund_txn_date ON fund_transactions(txn_date);
CREATE INDEX IF NOT EXISTS idx_fund_txn_source ON fund_transactions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_fund_txn_status ON fund_transactions(status, txn_date);

-- 账户间划转（微信提现到公户、平台打款入公户、结车款预转）。
-- 一次划转产生两条流水（out + in），共用同一个 source_id = 本表 id。
CREATE TABLE IF NOT EXISTS fund_transfers (
  id TEXT PRIMARY KEY,
  transfer_date TEXT NOT NULL,
  from_account_id TEXT NOT NULL,
  to_account_id TEXT NOT NULL,
  amount REAL NOT NULL,
  remarks TEXT,
  operator_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (from_account_id) REFERENCES fund_accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (to_account_id) REFERENCES fund_accounts(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_fund_transfers_date ON fund_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_from ON fund_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_fund_transfers_to ON fund_transfers(to_account_id);

-- 账期锁定：锁住的月份禁止新增/修改/冲销流水与结算行。
-- 出完对账单就锁月，是财务最基本的护栏。
CREATE TABLE IF NOT EXISTS finance_period_locks (
  period TEXT PRIMARY KEY,
  locked_at TEXT NOT NULL,
  locked_by TEXT,
  remarks TEXT
);
