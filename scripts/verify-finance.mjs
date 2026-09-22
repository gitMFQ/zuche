#!/usr/bin/env node
/**
 * 财务模块的只读体检脚本。
 *
 * 为什么需要它：test/ 下的 vitest 跑不了 D1（只测 src/lib 的纯逻辑），
 * 所以 SQL、外键、唯一索引、余额聚合这些**没有任何自动化覆盖**。
 * 这个脚本直接读本地 SQLite（`node:sqlite`），把最容易出错的不变量挨个查一遍。
 *
 * 用法：
 *   node scripts/verify-finance.mjs                       # 查 .wrangler/state/dev-node/data.sqlite
 *   node scripts/verify-finance.mjs path/to/data.sqlite   # 查指定库
 *
 * **只读**：全程只有 SELECT 与 PRAGMA，不会修改任何数据。
 * 退出码非 0 表示发现了不一致。
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DB = path.join(ROOT, '.wrangler', 'state', 'dev-node', 'data.sqlite');
const dbPath = process.argv[2] ?? DEFAULT_DB;

if (!existsSync(dbPath)) {
  console.error(`找不到数据库：${dbPath}`);
  console.error('先跑一次 npm run dev（会建库并执行 migrations/），或用参数指定库文件路径。');
  process.exit(2);
}

const db = new DatabaseSync(dbPath, { readOnly: true });

let failures = 0;
let checks = 0;

/** 一条断言：cond 为假就记为失败并打印细节 */
function assert(label, cond, detail = '') {
  checks += 1;
  if (cond) {
    console.log(`  ✅ ${label}`);
  } else {
    failures += 1;
    console.log(`  ❌ ${label}${detail ? `\n       ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

const scalar = (sql, params = []) => db.prepare(sql).get(...params);
const rows = (sql, params = []) => db.prepare(sql).all(...params);

// ==================== 1. 基础结构 ====================
section('数据库结构');
const tables = rows("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").map((r) => r.name);
const REQUIRED_TABLES = [
  'owners',
  'fund_accounts',
  'fund_transactions',
  'fund_transfers',
  'finance_period_locks',
  'settlement_lines',
  'settlement_openings',
  'settlement_payouts',
  'vehicle_expenses',
  'vehicle_expense_types',
  'operating_expenses',
  'expense_categories',
  'partner_advances'
];
const missing = REQUIRED_TABLES.filter((t) => !tables.includes(t));
assert(`13 张财务表齐备（共 ${tables.length} 张表）`, missing.length === 0, `缺少：${missing.join(', ')}`);

assert('vehicles 有档案字段', rows('PRAGMA table_info(vehicles)').some((c) => c.name === 'vehicle_no'));
assert('orders 有开票/结算字段', rows('PRAGMA table_info(orders)').some((c) => c.name === 'settle_status'));

// ==================== 2. 外键完整性与种子 ====================
section('外键与种子数据');
const fkViolations = rows('PRAGMA foreign_key_check');
assert('外键完整性（foreign_key_check 为空）', fkViolations.length === 0, JSON.stringify(fkViolations.slice(0, 5)));

const accountCount = scalar('SELECT COUNT(*) AS c FROM fund_accounts').c;
assert(`资金账户已初始化（${accountCount} 个）`, accountCount >= 5, '应为 0016 种子建的 6 个账户');

const categoryCount = scalar('SELECT COUNT(*) AS c FROM expense_categories').c;
assert(`运营开支字典已初始化（${categoryCount} 项）`, categoryCount >= 27, '应为台账的 27 项');

const typeCount = scalar('SELECT COUNT(*) AS c FROM vehicle_expense_types').c;
assert(`车辆费用类型字典已初始化（${typeCount} 类）`, typeCount >= 12);

const selfOwner = scalar("SELECT id, company_fee_rate FROM owners WHERE id = 'owner-self'");
assert('「公司自营」受益人存在且费率为 0', Boolean(selfOwner) && Number(selfOwner?.company_fee_rate) === 0);

const derivedAccounts = rows('SELECT id FROM fund_accounts WHERE method_key IS NOT NULL').map((r) => r.id);
assert('每个支付方式最多映射一个账户（method_key 唯一）', new Set(derivedAccounts).size === derivedAccounts.length);

// ==================== 3. 资金流水：幂等键与冲销链 ====================
section('资金流水');
const dupKeys = rows(`
  SELECT source_type, source_id, source_kind, COUNT(*) AS c
  FROM fund_transactions WHERE source_id IS NOT NULL
  GROUP BY source_type, source_id, source_kind HAVING c > 1`);
assert('幂等键无重复（同单据同语义槽只有一条）', dupKeys.length === 0, JSON.stringify(dupKeys.slice(0, 5)));

const badAmount = scalar('SELECT COUNT(*) AS c FROM fund_transactions WHERE amount <= 0').c;
assert(`流水金额恒为正（0 与负数共 ${badAmount} 条）`, badAmount === 0);

const badDirection = scalar("SELECT COUNT(*) AS c FROM fund_transactions WHERE direction NOT IN ('in','out')").c;
assert('流水方向只有 in/out', badDirection === 0);

const badStatus = scalar("SELECT COUNT(*) AS c FROM fund_transactions WHERE status NOT IN ('posted','reversed')").c;
assert('流水状态只有 posted/reversed', badStatus === 0);

// 冲销链闭合：被标为 reversed 的原行必须有一条红字指向它；红字必须指向一条存在的原行
const orphanReversed = rows(`
  SELECT t.id FROM fund_transactions t
  WHERE t.status = 'reversed'
    AND NOT EXISTS (SELECT 1 FROM fund_transactions r WHERE r.reverses_id = t.id AND r.status = 'posted')`);
assert(`被冲销的原行都有红字（异常 ${orphanReversed.length} 条）`, orphanReversed.length === 0, JSON.stringify(orphanReversed.slice(0, 5)));

const orphanReversal = rows(`
  SELECT r.id FROM fund_transactions r
  WHERE r.source_type = 'void_reversal'
    AND (r.reverses_id IS NULL OR NOT EXISTS (SELECT 1 FROM fund_transactions t WHERE t.id = r.reverses_id))`);
assert(`红字都指向存在的原行（悬空 ${orphanReversal.length} 条）`, orphanReversal.length === 0, JSON.stringify(orphanReversal.slice(0, 5)));

const badSourceType = scalar(`
  SELECT COUNT(*) AS c FROM fund_transactions
  WHERE source_type NOT IN ('prepay','payment','extension','refund','transfer','vehicle_expense',
                            'operating_expense','settlement_payout','partner_advance','loan','manual','void_reversal')`).c;
assert(`来源类型都是已知值（未知 ${badSourceType} 条）`, badSourceType === 0);

// ==================== 4. 余额一致性 ====================
section('账户余额');
// 余额 = 期初 + 全部流水收支。**不按 opening_date 过滤** —— 过滤会让补录的历史流水
// 静默消失（明细查不到、余额也不计），这个陷阱比口径上的严谨更伤，详见 0013 的说明。
//
// 余额是派生值，库里不存，所以这里现算一遍并列出来：期初 + 流水净额 = 余额。
// 数值不能自动断言（没有第二个数据源可比），但列出来就能和银行/微信账单人工核对。
const balanceRows = rows(`
  SELECT a.id, a.name, ROUND(a.opening_balance, 6) AS opening,
    ROUND((SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0)
           FROM fund_transactions WHERE account_id = a.id), 6) AS flow_sum
  FROM fund_accounts a`);
const badBalance = balanceRows.filter((r) => !Number.isFinite(Number(r.flow_sum)) || !Number.isFinite(Number(r.opening)));
assert(
  `每个账户的流水净额都能算出来（${balanceRows.length} 个账户）`,
  badBalance.length === 0,
  JSON.stringify(badBalance.slice(0, 3))
);

// 对每家账户单独列出余额，方便人工和银行流水核对（余额不在库里存，所以这里现算）
for (const r of balanceRows) {
  const derived = Math.round((Number(r.opening) + Number(r.flow_sum)) * 1e6) / 1e6;
  console.log(`     ${r.name}: 期初 ${r.opening} + 流水 ${r.flow_sum} = ${derived}`);
}

// 逐行余额的正确性**不在本脚本的覆盖范围内**：它取决于 controller 里 SQL 的分层结构
// （窗口必须算在未筛选的行集上，筛选写在外层），只读数据库无法判断查询是怎么写的。
// 曾经在这里写过一条「自己拼窗口 SQL 比较」的断言，但那等于复现错误写法，
// 在正确代码上也会失败 —— 已删除。这一项由 scripts/verify-finance-api.mjs 以接口层断言覆盖。

// 「待归属」账户有余额说明有自动流水没配上账户（不是错误，但需要人工处理）
const holding = scalar(`
  SELECT ROUND(COALESCE(SUM(CASE WHEN t.direction = 'in' THEN t.amount ELSE -t.amount END), 0), 6) AS net
  FROM fund_accounts a LEFT JOIN fund_transactions t ON t.account_id = a.id
  WHERE a.account_type = 'virtual' AND a.method_key IS NULL`);
if (holding && Math.abs(Number(holding.net) || 0) > 0.000001) {
  console.log(`  ⚠️  「待归属」账户还有 ${holding.net} 元流水，建议在「资金流水」页批量改归属`);
}

// ==================== 5. 结算台账 ====================
section('车主结算台账');
const badOverridden = scalar('SELECT COUNT(*) AS c FROM settlement_lines WHERE amount_overridden NOT IN (0,1)').c;
assert('覆盖标记只有 0/1', badOverridden === 0);

const badLineStatus = scalar("SELECT COUNT(*) AS c FROM settlement_lines WHERE status NOT IN ('posted','void')").c;
assert('结算行状态只有 posted/void', badLineStatus === 0);

const missingOwner = scalar(`
  SELECT COUNT(*) AS c FROM settlement_lines l
  WHERE NOT EXISTS (SELECT 1 FROM owners o WHERE o.id = l.owner_id)`).c;
assert(`结算行都有对应车主（孤儿 ${missingOwner} 条）`, missingOwner === 0);

const missingVehicle = scalar(`
  SELECT COUNT(*) AS c FROM settlement_lines l
  WHERE l.vehicle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.id = l.vehicle_id)`).c;
assert(`结算行的车辆都存在（孤儿 ${missingVehicle} 条）`, missingVehicle === 0);

// 未人工覆盖的行，最终值必须等于系统口径 —— 不等说明重算语句漏了某一列
const drifted = rows(`
  SELECT id, period, plate_number,
    total_amount, calc_total_amount, company_fee, calc_company_fee, owner_amount, calc_owner_amount
  FROM settlement_lines WHERE amount_overridden = 0 AND status = 'posted'`);
const driftList = drifted.filter(
  (r) =>
    Math.abs(Number(r.total_amount) - Number(r.calc_total_amount)) > 1e-6 ||
    Math.abs(Number(r.company_fee) - Number(r.calc_company_fee)) > 1e-6 ||
    Math.abs(Number(r.owner_amount) - Number(r.calc_owner_amount)) > 1e-6
);
assert(
  `未覆盖行的最终值 = 系统口径（${drifted.length} 行中 ${driftList.length} 行漂移）`,
  driftList.length === 0,
  driftList.slice(0, 5).map((r) => `${r.period} ${r.plate_number}: ${r.owner_amount} vs ${r.calc_owner_amount}`).join('; ')
);

// 人工覆盖过的行必须看得出差异（差异全 0 说明覆盖标记是多余的，无害但值得知道）
const overriddenCount = scalar('SELECT COUNT(*) AS c FROM settlement_lines WHERE amount_overridden = 1').c;
console.log(`  ℹ️  人工调整过的结算行 ${overriddenCount} 条（这些行不会被订单改价覆盖）`);

const badOpening = rows("SELECT id, owner_vehicle_key FROM settlement_openings WHERE owner_vehicle_key = '' OR owner_vehicle_key IS NULL");
assert('期初结转的 owner_vehicle_key 都非空（唯一约束才能生效）', badOpening.length === 0);

const dupOpening = rows(`
  SELECT owner_vehicle_key, fiscal_year, COUNT(*) AS c FROM settlement_openings
  GROUP BY owner_vehicle_key, fiscal_year HAVING c > 1`);
assert('同车主同车辆同年份的结转不重复', dupOpening.length === 0, JSON.stringify(dupOpening.slice(0, 5)));

// ==================== 6. 镜像费用 ====================
section('车辆费用镜像');
const badMirrorSource = scalar(`
  SELECT COUNT(*) AS c FROM vehicle_expenses
  WHERE source_type IS NOT NULL AND source_type NOT IN ('maintenance','insurance','violation','manual')`).c;
assert(`镜像来源类型都是已知值（未知 ${badMirrorSource} 条）`, badMirrorSource === 0);

const dupMirror = rows(`
  SELECT source_type, source_id, source_kind, COUNT(*) AS c FROM vehicle_expenses
  WHERE source_id IS NOT NULL GROUP BY source_type, source_id, source_kind HAVING c > 1`);
assert('一条源单据只镜像出一行费用', dupMirror.length === 0, JSON.stringify(dupMirror.slice(0, 5)));

// 源单据已删但镜像还在（不该有：删源单据是同批清镜像的）
const orphanMirror = rows(`
  SELECT e.id, e.source_type, e.source_id FROM vehicle_expenses e
  WHERE e.source_type = 'maintenance' AND NOT EXISTS (SELECT 1 FROM maintenance m WHERE m.id = e.source_id)
  UNION ALL
  SELECT e.id, e.source_type, e.source_id FROM vehicle_expenses e
  WHERE e.source_type = 'insurance' AND NOT EXISTS (SELECT 1 FROM insurance i WHERE i.id = e.source_id)
  UNION ALL
  SELECT e.id, e.source_type, e.source_id FROM vehicle_expenses e
  WHERE e.source_type = 'violation' AND NOT EXISTS (SELECT 1 FROM violations v WHERE v.id = e.source_id)`);
assert(`镜像行的源单据都存在（孤儿 ${orphanMirror.length} 行）`, orphanMirror.length === 0, JSON.stringify(orphanMirror.slice(0, 5)));

// 已付款的费用必须有镜像流水（权责发生 vs 现金收付：只有付款才写流水）
const paidWithoutFlow = rows(`
  SELECT e.id, e.plate_number, e.expense_date, e.expense_amount FROM vehicle_expenses e
  WHERE e.is_paid = 1 AND (e.expense_amount > 0 OR e.income_amount > 0)
    AND NOT EXISTS (SELECT 1 FROM fund_transactions t
                    WHERE t.source_type = 'vehicle_expense' AND t.source_id = e.id
                      AND t.source_kind = 'main_out' AND t.status = 'posted')`);
assert(
  `已付款的费用都有资金流水（缺失 ${paidWithoutFlow.length} 条）`,
  paidWithoutFlow.length === 0,
  JSON.stringify(paidWithoutFlow.slice(0, 5))
);

// 未付款的费用不该有流水（否则等于把应付当成了已付）
const unpaidWithFlow = rows(`
  SELECT e.id, e.plate_number FROM vehicle_expenses e
  WHERE e.is_paid = 0
    AND EXISTS (SELECT 1 FROM fund_transactions t
                WHERE t.source_type = 'vehicle_expense' AND t.source_id = e.id
                  AND t.status = 'posted' AND t.reverses_id IS NULL)`);
assert(
  `未付款的费用没有资金流水（异常 ${unpaidWithFlow.length} 条）`,
  unpaidWithFlow.length === 0,
  JSON.stringify(unpaidWithFlow.slice(0, 5))
);

// ==================== 7. 运营开支与往来 ====================
section('运营开支 / 合伙人往来');
const badOpCategory = scalar(`
  SELECT COUNT(*) AS c FROM operating_expenses o
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories c WHERE c.id = o.category)`).c;
assert(`开支项目都在字典里（未知 ${badOpCategory} 条）`, badOpCategory === 0);

const badOpPaid = rows(`
  SELECT id FROM operating_expenses WHERE is_paid = 1 AND account_id IS NULL`);
assert(`已付款的开支都有账户（缺失 ${badOpPaid.length} 条）`, badOpPaid.length === 0);

const badAdvance = scalar("SELECT COUNT(*) AS c FROM partner_advances WHERE direction NOT IN ('in','out')").c;
assert('往来方向只有 in/out', badAdvance === 0);

const badAdvanceAmount = scalar('SELECT COUNT(*) AS c FROM partner_advances WHERE amount <= 0').c;
assert(`往来金额恒为正（异常 ${badAdvanceAmount} 条）`, badAdvanceAmount === 0);

// ==================== 8. 账期锁定 ====================
section('账期锁定');
const badPeriod = rows("SELECT period FROM finance_period_locks WHERE period NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'");
assert(`锁定的账期格式都是 YYYY-MM（异常 ${badPeriod.length} 条）`, badPeriod.length === 0, JSON.stringify(badPeriod));

// ==================== 汇总 ====================
console.log(`\n${'='.repeat(48)}`);
if (failures === 0) {
  console.log(`全部通过：${checks} 项检查`);
} else {
  console.log(`${failures} / ${checks} 项检查失败`);
}
console.log(`（只读体检，未修改任何数据；库文件：${dbPath}）`);
db.close();
process.exit(failures === 0 ? 0 : 1);
