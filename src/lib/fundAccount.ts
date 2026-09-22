/**
 * 支付方式 → 资金账户的唯一解析入口。
 *
 * 所有自动写流水的 hook 都只调这里，保证口径一致。
 *
 * 关键约定：**本函数永不返回 null，也永不抛错**。
 * 自动流水是写在业务自己的 batchExecute 里的（宁可不记账也不能记半笔），
 * 如果账户没配好就抛错，等于「因为财务配置不完整，订单收不了款」——
 * 这个代价太大。所以解析不到就落到 system_settings.finance_fallback_account_id
 * 指定的「待归属」虚拟账户，界面上提供批量改归属把账挪到正确账户。
 */

import { query, queryOne } from '../db/helpers';

/** 兜底账户的系统设置 key */
const FALLBACK_SETTING_KEY = 'finance_fallback_account_id';

/** 平台待结算账户的系统设置 key */
const PLATFORM_SETTING_KEY = 'finance_platform_settle_account_id';

/** 读一个系统设置值 */
async function readSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await queryOne<{ value: string | null }>(db, 'SELECT value FROM system_settings WHERE key = ?', [key]);
  const value = row?.value?.trim();
  return value ? value : null;
}

/**
 * 兜底账户 id（「待归属」）。系统设置缺失或指向已删除的账户时，
 * 退到第一个虚拟账户，再退到第一个启用账户。列表为空时返回 null。
 */
export async function fallbackAccountId(db: D1Database): Promise<string | null> {
  const configured = await readSetting(db, FALLBACK_SETTING_KEY);
  if (configured) {
    const exists = await queryOne<{ id: string }>(db, 'SELECT id FROM fund_accounts WHERE id = ? AND is_active = 1', [
      configured
    ]);
    if (exists) return exists.id;
  }

  const virtual = await queryOne<{ id: string }>(
    db,
    "SELECT id FROM fund_accounts WHERE account_type = 'virtual' AND is_active = 1 ORDER BY sort_order LIMIT 1"
  );
  if (virtual) return virtual.id;

  const any = await queryOne<{ id: string }>(db, 'SELECT id FROM fund_accounts WHERE is_active = 1 ORDER BY sort_order LIMIT 1');
  return any?.id ?? null;
}

/**
 * 按支付方式解析账户。
 *
 * 返回 null 只有一种情况：库里一个启用的账户都没有（全新部署还没跑 0016 种子）。
 * 此时 buildFundTxnStmt 会跳过这条流水而不是拼出 account_id='' 的语句 ——
 * 后者会撞外键约束并回滚整笔业务，变成「财务没配好所以订单收不了款」。
 */
export async function resolveAccountIdByMethod(db: D1Database, method: string | null | undefined): Promise<string | null> {
  const key = (method ?? '').trim();
  if (key) {
    const matched = await queryOne<{ id: string }>(
      db,
      'SELECT id FROM fund_accounts WHERE method_key = ? AND is_active = 1',
      [key]
    );
    if (matched) return matched.id;
  }
  return fallbackAccountId(db);
}

/** 平台待结算账户 id（平台打款划转时用），缺失时退到兜底账户 */
export async function platformSettleAccountId(db: D1Database): Promise<string | null> {
  const configured = await readSetting(db, PLATFORM_SETTING_KEY);
  if (configured) {
    const exists = await queryOne<{ id: string }>(db, 'SELECT id FROM fund_accounts WHERE id = ? AND is_active = 1', [
      configured
    ]);
    if (exists) return exists.id;
  }
  return fallbackAccountId(db);
}

/** 账户是否存在且启用（手工记账时的校验；自动 hook 不走这里） */
export async function isActiveAccount(db: D1Database, accountId: string | null | undefined): Promise<boolean> {
  const id = (accountId ?? '').trim();
  if (!id) return false;
  const row = await queryOne<{ id: string }>(db, 'SELECT id FROM fund_accounts WHERE id = ? AND is_active = 1', [id]);
  return Boolean(row);
}

/** 前端下拉用的账户选项（只含启用账户，带账户类型与排序） */
export async function listAccountOptions(db: D1Database): Promise<Array<{ id: string; name: string; account_type: string }>> {
  return query<{ id: string; name: string; account_type: string }>(
    db,
    'SELECT id, name, account_type FROM fund_accounts WHERE is_active = 1 ORDER BY sort_order, name'
  );
}
