import { describe, expect, it } from 'vitest';
import type { Stmt } from '../src/db/helpers';
import {
  FUND_TXN_COLUMN_COUNT,
  buildFundTxnStmt,
  buildReverseStmts,
  buildTransferStmts,
  isDate,
  pushFundTxn,
  type ReversibleTxn
} from '../src/lib/ledger';

/**
 * 资金流水的写语句。
 *
 * 这里测不到 SQL 是否真能跑（vitest 不接 D1，见 vitest.config.ts），
 * 但能测出最容易静默出错的一类问题：**列与参数错位** ——
 * 金额落进相邻列不会报错，只会让账目慢慢对不上，所以列数、顺序都要钉死。
 */
const meta = { operatorId: 'user-1', currentTime: '2026-09-22 10:00:00' };

function columnIndexOf(sql: string, column: string): number {
  const columns = sql.substring(sql.indexOf('(') + 1, sql.indexOf(')')).split(',').map((c) => c.trim());
  return columns.indexOf(column);
}

describe('buildFundTxnStmt', () => {
  const input = {
    accountId: 'fa-bank',
    txnDate: '2026-09-22',
    direction: 'in' as const,
    amount: 1200.5,
    category: 'rent',
    sourceType: 'payment' as const,
    sourceId: 'payment-1',
    sourceKind: 'rent_in' as const,
    counterparty: '余欣荣',
    summary: '订单 R20260812000001 收款'
  };

  it('列数与参数个数一致', () => {
    const stmt = buildFundTxnStmt(input, meta);
    expect(stmt).not.toBeNull();
    const placeholders = (stmt?.sql.match(/\?/g) ?? []).length;
    expect(FUND_TXN_COLUMN_COUNT).toBe(18);
    expect(placeholders).toBe(FUND_TXN_COLUMN_COUNT);
    expect(stmt?.params).toHaveLength(FUND_TXN_COLUMN_COUNT);
  });

  it('参数按列名对齐', () => {
    const stmt = buildFundTxnStmt(input, meta);
    const sql = stmt?.sql ?? '';
    const params = stmt?.params ?? [];
    const at = (column: string) => params[columnIndexOf(sql, column)];

    expect(typeof at('id')).toBe('string');
    expect(at('account_id')).toBe('fa-bank');
    expect(at('txn_date')).toBe('2026-09-22');
    expect(at('direction')).toBe('in');
    expect(at('amount')).toBe(1200.5);
    expect(at('category')).toBe('rent');
    expect(at('source_type')).toBe('payment');
    expect(at('source_id')).toBe('payment-1');
    expect(at('source_kind')).toBe('rent_in');
    expect(at('counterparty')).toBe('余欣荣');
    expect(at('summary')).toBe('订单 R20260812000001 收款');
    expect(at('status')).toBe('posted');
    expect(at('reverses_id')).toBeNull();
    expect(at('reversed_by_id')).toBeNull();
    expect(at('operator_id')).toBe('user-1');
    expect(at('created_at')).toBe('2026-09-22 10:00:00');
  });

  it('支出方向金额仍为正数，方向由 direction 表达', () => {
    const stmt = buildFundTxnStmt({ ...input, direction: 'out', amount: 3000, sourceKind: 'settlement_out' }, meta);
    const params = stmt?.params ?? [];
    const at = (column: string) => params[columnIndexOf(stmt?.sql ?? '', column)];
    expect(at('direction')).toBe('out');
    expect(at('amount')).toBe(3000);
  });

  it('金额为 0 时不写流水（避免对账单出现金额 0 的噪音行）', () => {
    expect(buildFundTxnStmt({ ...input, amount: 0 }, meta)).toBeNull();
    expect(buildFundTxnStmt({ ...input, amount: Number.NaN }, meta)).toBeNull();
    expect(buildFundTxnStmt({ ...input, amount: undefined as unknown as number }, meta)).toBeNull();
  });

  it('账户为空时不写流水（不能让「财务没配好」把整笔业务回滚）', () => {
    expect(buildFundTxnStmt({ ...input, accountId: null }, meta)).toBeNull();
    expect(buildFundTxnStmt({ ...input, accountId: '' }, meta)).toBeNull();
    expect(buildFundTxnStmt({ ...input, accountId: '   ' }, meta)).toBeNull();
  });

  it('负数金额按 0 处理，不允许用负号表达方向', () => {
    expect(buildFundTxnStmt({ ...input, amount: -500 }, meta)).toBeNull();
  });

  it('可选字段缺省落 null，不写 undefined（D1 会抛 D1_TYPE_ERROR）', () => {
    const stmt = buildFundTxnStmt(
      { accountId: 'fa-bank', txnDate: '2026-09-22', direction: 'in', amount: 100, sourceType: 'manual', summary: '手工记账' },
      { currentTime: '2026-09-22 10:00:00' }
    );
    const params = stmt?.params ?? [];
    expect(params).not.toContain(undefined);
    const sql = stmt?.sql ?? '';
    const at = (column: string) => params[columnIndexOf(sql, column)];
    expect(at('source_id')).toBeNull();
    expect(at('source_kind')).toBe('main');
    expect(at('operator_id')).toBeNull();
    expect(at('category')).toBeNull();
    expect(at('counterparty')).toBeNull();
  });

  it('手工记账的 source_id 为 null（幂等键不生效，可重复录入）', () => {
    const stmt = buildFundTxnStmt(
      { accountId: 'fa-cash', txnDate: '2026-09-22', direction: 'out', amount: 25, sourceType: 'manual', summary: '餐费' },
      meta
    );
    const params = stmt?.params ?? [];
    expect(params[columnIndexOf(stmt?.sql ?? '', 'source_id')]).toBeNull();
  });

  it('幂等键三段在同一单据上保持一致（重复调用会撞唯一索引）', () => {
    const first = buildFundTxnStmt(input, meta);
    const second = buildFundTxnStmt(input, meta);
    const sql = first?.sql ?? '';
    const key = (stmt: typeof first) => {
      const params = stmt?.params ?? [];
      return [params[columnIndexOf(sql, 'source_type')], params[columnIndexOf(sql, 'source_id')], params[columnIndexOf(sql, 'source_kind')]];
    };
    expect(key(second)).toEqual(key(first));
    // 但 id 必须不同，否则第二次插入会撞主键而不是幂等键
    const params = first?.params ?? [];
    expect(first?.params?.[columnIndexOf(sql, 'id')]).not.toBe(second?.params?.[columnIndexOf(sql, 'id')]);
    expect(params[columnIndexOf(sql, 'id')]).toBeTruthy();
  });
});

describe('pushFundTxn', () => {
  it('金额为 0 时静默跳过，不污染 batch', () => {
    const stmts: Stmt[] = [];
    pushFundTxn(stmts, { accountId: 'fa-bank', txnDate: '2026-09-22', direction: 'in', amount: 0, sourceType: 'manual', summary: '空' }, meta);
    expect(stmts).toHaveLength(0);
  });

  it('账户为空时静默跳过', () => {
    const stmts: Stmt[] = [];
    pushFundTxn(stmts, { accountId: null, txnDate: '2026-09-22', direction: 'in', amount: 100, sourceType: 'manual', summary: '无账户' }, meta);
    expect(stmts).toHaveLength(0);
  });

  it('正常金额追加一条语句', () => {
    const stmts: Stmt[] = [];
    pushFundTxn(stmts, { accountId: 'fa-bank', txnDate: '2026-09-22', direction: 'in', amount: 1, sourceType: 'manual', summary: '有值' }, meta);
    expect(stmts).toHaveLength(1);
  });
});

describe('buildTransferStmts', () => {
  it('一次划转产生两条流水，方向相反、共用 source_id', () => {
    const stmts = buildTransferStmts('tr-1', 'fa-wechat', 'fa-bank', 5000, '2026-09-22', '微信提现到公户', meta);
    expect(stmts).toHaveLength(2);

    const sql = stmts[0].sql;
    const read = (stmt: (typeof stmts)[number], column: string) => (stmt.params ?? [])[columnIndexOf(sql, column)];
    expect(read(stmts[0], 'direction')).toBe('out');
    expect(read(stmts[0], 'source_kind')).toBe('transfer_out');
    expect(read(stmts[0], 'account_id')).toBe('fa-wechat');
    expect(read(stmts[1], 'direction')).toBe('in');
    expect(read(stmts[1], 'source_kind')).toBe('transfer_in');
    expect(read(stmts[1], 'account_id')).toBe('fa-bank');
    // 两条共用同一个 source_id（幂等键的 source_kind 区分方向，不会互相冲突）
    expect(read(stmts[0], 'source_id')).toBe('tr-1');
    expect(read(stmts[1], 'source_id')).toBe('tr-1');
  });

  it('金额为 0 时一条都不产生', () => {
    expect(buildTransferStmts('tr-1', 'fa-wechat', 'fa-bank', 0, '2026-09-22', null, meta)).toHaveLength(0);
  });
});

describe('buildReverseStmts 红字冲销', () => {
  const txns: ReversibleTxn[] = [
    {
      id: 'txn-in',
      account_id: 'fa-bank',
      txn_date: '2026-09-22',
      direction: 'in',
      amount: 1200,
      category: 'rent',
      counterparty: '余欣荣',
      summary: '订单 R001 收款'
    },
    {
      id: 'txn-out',
      account_id: 'fa-wechat',
      txn_date: '2026-09-23',
      direction: 'out',
      amount: 300,
      category: 'vehicle',
      counterparty: '宁A8E9K2',
      summary: '补油'
    }
  ];

  it('每条流水生成「红字 + 标记原行」两条语句', () => {
    const stmts = buildReverseStmts(txns, '订单删除', meta);
    expect(stmts).toHaveLength(4);
    expect(stmts[0].sql).toContain('INSERT INTO fund_transactions');
    expect(stmts[1].sql).toContain('UPDATE fund_transactions SET status');
    expect(stmts[2].sql).toContain('INSERT INTO fund_transactions');
    expect(stmts[3].sql).toContain('UPDATE fund_transactions SET status');
  });

  it('红字方向取反、金额仍为正，并指向原行', () => {
    const stmts = buildReverseStmts(txns, '订单删除', meta);
    const insertSql = stmts[0].sql;
    const read = (stmt: (typeof stmts)[number], column: string) => (stmt.params ?? [])[columnIndexOf(insertSql, column)];

    expect(read(stmts[0], 'direction')).toBe('out');
    expect(read(stmts[0], 'amount')).toBe(1200);
    expect(read(stmts[0], 'source_type')).toBe('void_reversal');
    expect(read(stmts[0], 'source_kind')).toBe('void_reversal');
    expect(read(stmts[0], 'reverses_id')).toBe('txn-in');
    expect(read(stmts[0], 'reversed_by_id')).toBeNull();
    expect(read(stmts[0], 'account_id')).toBe('fa-bank');
    expect(String(read(stmts[0], 'summary'))).toContain('冲销');
    expect(read(stmts[0], 'remarks')).toBe('订单删除');

    // 支出流水的红字是收入方向
    expect(read(stmts[2], 'direction')).toBe('in');
    expect(read(stmts[2], 'amount')).toBe(300);
  });

  it('把原行标记为 reversed，且 reversed_by_id 指回红字', () => {
    const stmts = buildReverseStmts(txns, '订单删除', meta);
    const read = (stmt: (typeof stmts)[number], column: string) => (stmt.params ?? [])[columnIndexOf(stmts[0].sql, column)];

    expect(stmts[1].params?.[0]).toBe('reversed');
    // 红字行的 id 必须与 UPDATE 里写的 reversed_by_id 一致，否则冲销链断掉
    expect(stmts[1].params?.[1]).toBe(read(stmts[0], 'id'));
    expect(stmts[1].params?.[3]).toBe('txn-in');
    expect(read(stmts[0], 'id')).not.toBe(read(stmts[2], 'id'));
  });

  it('空列表不产生语句', () => {
    expect(buildReverseStmts([], '订单删除', meta)).toHaveLength(0);
  });

  it('冲销链闭合：红字自身可再被冲销（source_id 指向原流水 id）', () => {
    const stmts = buildReverseStmts([txns[0]], '误操作撤销', meta);
    const read = (stmt: (typeof stmts)[number], column: string) => (stmt.params ?? [])[columnIndexOf(stmts[0].sql, column)];
    const reversalId = read(stmts[0], 'id');
    const reversalTxn: ReversibleTxn = {
      id: String(reversalId),
      account_id: 'fa-bank',
      txn_date: '2026-09-22',
      direction: 'out',
      amount: 1200,
      category: 'rent',
      counterparty: '余欣荣',
      summary: '冲销：订单 R001 收款'
    };
    const again = buildReverseStmts([reversalTxn], '再次冲销', meta);
    expect(again).toHaveLength(2);
    expect((again[0].params ?? [])[columnIndexOf(again[0].sql, 'reverses_id')]).toBe(reversalId);
    expect((again[0].params ?? [])[columnIndexOf(again[0].sql, 'direction')]).toBe('in');
  });
});

describe('isDate', () => {
  it('接受 YYYY-MM-DD 完整日期', () => {
    expect(isDate('2026-09-22')).toBe(true);
    expect(isDate('2026-01-01')).toBe(true);
    expect(isDate('2026-12-31')).toBe(true);
  });

  it('拒绝账期与其他格式', () => {
    expect(isDate('2026-09')).toBe(false);
    expect(isDate('2026/09/22')).toBe(false);
    expect(isDate('2026-9-2')).toBe(false);
    expect(isDate('')).toBe(false);
    expect(isDate(null)).toBe(false);
    expect(isDate(undefined)).toBe(false);
    expect(isDate('2026-13-01')).toBe(false);
    expect(isDate('2026-00-01')).toBe(false);
  });

  it('拒绝带时间的完整串（调用方要先切出日期）', () => {
    expect(isDate('2026-09-22 10:00:00')).toBe(false);
  });
});
