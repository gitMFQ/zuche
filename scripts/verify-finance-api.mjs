#!/usr/bin/env node
/**
 * 财务模块的接口层体检（需要后端在跑）。
 *
 * 与 verify-finance.mjs 的分工：
 *   * verify-finance.mjs   只读数据库，查「表里的数据自不自洽」
 *   * 本脚本               打接口，查「查询逻辑算得对不对」
 *
 * 为什么必须有这一层：有些错误只有把请求发出去才看得出来。
 * 例如「逐行余额」要求窗口函数算在**未筛选**的行集上、筛选写在**外层**子查询；
 * 一旦有人为「优化」把它合回一层，余额会退化成「筛选区间内的累加和」——
 * 依然是一串格式正常的金额，单测与数据库体检都发现不了（这个坑真实发生过）。
 *
 * 用法（先起后端：`npm run dev:worker` 或 `node scripts/dev-backend.mjs`）：
 *   node scripts/verify-finance-api.mjs
 *   BASE_URL=http://127.0.0.1:8787 DB_FILE=.wrangler/state/dev-node/data.sqlite node scripts/verify-finance-api.mjs
 *
 * 会在临时账户上写入几笔流水用于验证。**流水没有删除接口**（设计上只允许红字冲销），
 * 所以清理走 SQLite 直连删掉本次创建的测试数据 —— 生产库上别跑这个脚本。
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const DB_FILE = process.env.DB_FILE ?? path.join(ROOT, '.wrangler', 'state', 'dev-node', 'data.sqlite');
const USER = process.env.ADMIN_USER ?? 'admin';
const PASS = process.env.ADMIN_PASS ?? 'admin123';

let token = '';
let failures = 0;
let checks = 0;

function assert(label, cond, detail = '') {
  checks += 1;
  if (cond) console.log(`  ✅ ${label}`);
  else {
    failures += 1;
    console.log(`  ❌ ${label}${detail ? `\n       ${detail}` : ''}`);
  }
}

async function api(method, path, body) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: `非 JSON 响应（HTTP ${res.status}）：${text.slice(0, 120)}` };
  }
}

/** 按时间正序取余额序列（同日多行时按创建时间排，与查询的排序口径一致） */
async function balances(accountId, params = '') {
  const data = (await api('GET', `/finance/transactions?account_id=${accountId}${params}`)).data?.data ?? [];
  return data
    .slice()
    .sort((a, b) => `${a.txn_date}${a.created_at}`.localeCompare(`${b.txn_date}${b.created_at}`))
    .map((r) => r.balance);
}

async function main() {
  console.log(`接口地址：${BASE}`);

  const login = await api('POST', '/auth/login', { username: USER, password: PASS });
  if (!login.success || !login.data?.token) {
    console.error(`登录失败：${login.message ?? '未知错误'}`);
    console.error('请先启动后端（npm run dev:worker），或用 BASE_URL 指向其它实例。');
    process.exit(2);
  }
  token = login.data.token;

  const accountId = `verify-api-${Date.now().toString(36)}`;
  const created = await api('POST', '/finance/accounts', {
    id: accountId,
    name: `接口体检-${accountId.slice(-4)}`,
    account_type: 'bank',
    opening_balance: 1000,
    opening_date: '2026-01-01'
  });
  if (!created.success) {
    // 账户 id 由后端生成，这里退回按名字找
    const list = (await api('GET', '/finance/accounts')).data ?? [];
    const found = list.find((a) => a.name.startsWith('接口体检-') && a.opening_balance === 1000);
    if (!found) {
      console.error(`建测试账户失败：${created.message}`);
      process.exit(2);
    }
    return runChecks(found.id);
  }
  return runChecks(created.data.id);
}

async function runChecks(accountId) {
  // 期初 1000 → 一月 +500 = 1500 → 二月 −200 = 1300 → 三月 +300 = 1600
  const plan = [
    ['2026-01-05', 'in', 500, '体检一月收款'],
    ['2026-02-10', 'out', 200, '体检二月支出'],
    ['2026-03-15', 'in', 300, '体检三月收款']
  ];
  const txnIds = [];
  try {
    for (const [txn_date, direction, amount, summary] of plan) {
      const res = await api('POST', '/finance/transactions', { account_id: accountId, txn_date, direction, amount, summary });
      if (res.success) txnIds.push(res.data.id);
    }
    if (txnIds.length !== plan.length) {
      console.error(`准备测试流水失败（成功 ${txnIds.length}/${plan.length}），跳过检查`);
      failures += 1;
      return;
    }

    console.log('\n=== 逐行余额：筛选不得改变余额的绝对值 ===');
    const full = await balances(accountId);
    assert('不带筛选 → 1500 / 1300 / 1600', JSON.stringify(full) === JSON.stringify([1500, 1300, 1600]), JSON.stringify(full));

    const fromFeb = await balances(accountId, '&start_date=2026-02-01');
    assert('从 2 月起筛选 → 仍是绝对余额 1300 / 1600（缺陷版本会给 800 / 1100）', JSON.stringify(fromFeb) === JSON.stringify([1300, 1600]), JSON.stringify(fromFeb));

    const onlyMar = await balances(accountId, '&start_date=2026-03-01&end_date=2026-03-31');
    assert('只筛 3 月 → 1600（缺陷版本会给 1300）', JSON.stringify(onlyMar) === JSON.stringify([1600]), JSON.stringify(onlyMar));

    const onlyJan = await balances(accountId, '&start_date=2026-01-01&end_date=2026-01-31');
    assert('只筛 1 月 → 1500', JSON.stringify(onlyJan) === JSON.stringify([1500]), JSON.stringify(onlyJan));

    const page2 = (await api('GET', `/finance/transactions?account_id=${accountId}&page=2&pageSize=2`)).data?.data ?? [];
    assert('翻到第 2 页（最早那笔）→ 1500', JSON.stringify(page2.map((r) => r.balance)) === JSON.stringify([1500]), JSON.stringify(page2.map((r) => r.balance)));

    console.log('\n=== 冲销：余额回到冲销前，原行与红字都留在明细里 ===');
    await api('POST', `/finance/transactions/${txnIds[2]}/reverse`, { reason: '接口体检' });
    // 接口按时间倒序返回，rows[0] 就是账本上的最后一行。
    // 不要自己重排：同一天的两行（原行与红字）靠 id 兜底排序，客户端复现不了这个口径。
    const rows = (await api('GET', `/finance/transactions?account_id=${accountId}`)).data?.data ?? [];
    assert('冲销 3 月收款后账本末行余额回落到 1300', rows[0]?.balance === 1300, `末行 ${rows[0]?.balance}`);
    assert('原行标 reversed + 红字可见（都不物理删除）',
      rows.some((r) => r.status === 'reversed') && rows.some((r) => r.source_kind === 'void_reversal'));

    console.log('\n=== 账户余额与明细自洽 ===');
    // 1000（期初）+500 −200 +300 −300（红字）= 1300
    const acct = (await api('GET', `/finance/accounts/${accountId}`)).data;
    assert(`账户余额 = 期初 1000 +500 −200 +300 −300 = ${acct?.balance}`, acct?.balance === 1300, String(acct?.balance));
  } finally {
    cleanup(accountId);
  }

  console.log(`\n${'='.repeat(48)}`);
  console.log(failures === 0 ? `全部通过：${checks} 项检查` : `${failures} / ${checks} 项检查失败`);
  process.exit(failures === 0 ? 0 : 1);
}

/**
 * 清理本次创建的测试数据。
 * 走 SQLite 直连而不是接口：fund_transactions 没有 DELETE 端点
 * （现金流只允许红字冲销，不物理删除），所以接口层无法自我清理。
 */
function cleanup(accountId) {
  if (!existsSync(DB_FILE)) {
    console.warn(`\n⚠️  未找到 ${DB_FILE}，跳过清理。请手动删除测试账户 ${accountId}`);
    return;
  }
  const db = new DatabaseSync(DB_FILE);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    // 账户外键是 RESTRICT，必须先删流水再删账户。
    // 顺带扫掉历次运行留下的同名前缀账户（清理失败时它们会一直堆着）。
    const targets = db
      .prepare("SELECT id FROM fund_accounts WHERE id = ? OR name LIKE '接口体检-%'")
      .all(accountId)
      .map((r) => r.id);
    let flows = 0;
    let accounts = 0;
    for (const id of targets) {
      flows += db.prepare('DELETE FROM fund_transactions WHERE account_id = ?').run(id).changes;
      accounts += db.prepare('DELETE FROM fund_accounts WHERE id = ?').run(id).changes;
    }
    const residue = db.prepare("SELECT COUNT(*) AS c FROM fund_accounts WHERE name LIKE '接口体检-%'").get().c;
    console.log(`\n已清理测试数据：流水 ${flows} 条、账户 ${accounts} 个${residue ? `（仍有 ${residue} 个残留，请手工处理）` : ''}`);
  } catch (error) {
    console.warn(`\n⚠️  清理失败（${error.message}），请手动删除测试账户 ${accountId}`);
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error('体检脚本异常：', error);
  process.exit(2);
});
