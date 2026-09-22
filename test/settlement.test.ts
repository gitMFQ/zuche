import { describe, expect, it } from 'vitest';
import {
  SETTLEMENT_LINE_COLUMN_COUNT,
  applyOverride,
  buildSettlementAmounts,
  buildSettlementInsertStmt,
  buildSettlementRefreshStmt,
  buildSettlementVoidStmt,
  calcStatementSummary,
  calcVehicleMonthlyRow,
  moneyOf
} from '../src/lib/settlement';

/**
 * 车主结算台账的计算链。
 *
 * 下面每一个数值都取自用户提供的真实台账（5 份 Excel），逐分核对过 ——
 * 这些用例是「系统算出来的钱和台账对得上」的唯一防线，改动公式时必须同步核对。
 *
 * 注意费率不是「一个平台一个费率」：
 *   捷途 宁A8E9K2 的公司费率是 15%，雅阁 宁A917DE 是 10%，
 *   哈弗H6 宁A173GV 自营没有这一列（0）。
 * 所以费率按车主配置（owners.company_fee_rate），生成时快照进结算行。
 */
describe('buildSettlementAmounts 台账真实行回归', () => {
  it('捷途 · 哈啰 · 公司费率 15%：余欣荣 394 元', () => {
    // file-1「2026」sheet 第 4 行
    const amounts = buildSettlementAmounts({ totalAmount: 394, platformRate: 15, companyRate: 15, otherFee: 21 });
    expect(amounts.platformFee).toBe(59.1);
    expect(amounts.settlementAmount).toBe(334.9);
    expect(amounts.companyFee).toBe(50.235);
    expect(amounts.ownerAmount).toBe(263.665);
  });

  it('捷途 · 携程 · 公司费率 15%：樊文 827 元（公司管理费是 4 位小数）', () => {
    // file-1「2026」sheet 第 5 行：702.95 × 15% = 105.4425
    const amounts = buildSettlementAmounts({ totalAmount: 827, platformRate: 15, companyRate: 15, otherFee: 10 });
    expect(amounts.platformFee).toBe(124.05);
    expect(amounts.settlementAmount).toBe(702.95);
    expect(amounts.companyFee).toBe(105.4425);
    expect(amounts.ownerAmount).toBe(587.5075);
  });

  it('捷途 · 携程 · 王旭洋 467 元（无其他费用）', () => {
    // file-1「2026」sheet 第 7 行
    const amounts = buildSettlementAmounts({ totalAmount: 467, platformRate: 15, companyRate: 15 });
    expect(amounts.platformFee).toBe(70.05);
    expect(amounts.settlementAmount).toBe(396.95);
    expect(amounts.companyFee).toBe(59.5425);
    expect(amounts.ownerAmount).toBe(337.4075);
  });

  it('捷途 · 线下 · 平台费率 0：张晨亮 600 元', () => {
    // file-1「2026」sheet 第 3 行：线下单也有 15% 公司管理费
    const amounts = buildSettlementAmounts({ totalAmount: 600, platformRate: 0, companyRate: 15 });
    expect(amounts.platformFee).toBe(0);
    expect(amounts.settlementAmount).toBe(600);
    expect(amounts.companyFee).toBe(90);
    expect(amounts.ownerAmount).toBe(510);
  });

  it('捷途 · 线下 · 平台费率 15%：张晨亮 240 元', () => {
    // file-1「2026」sheet 第 10 行。线下单并不总是 0 平台费，用户手工给过 15%，
    // 所以费率必须是可快照+可覆盖的，不能由「平台=线下」硬推出 0。
    const amounts = buildSettlementAmounts({ totalAmount: 240, platformRate: 15, companyRate: 15 });
    expect(amounts.platformFee).toBe(36);
    expect(amounts.settlementAmount).toBe(204);
    expect(amounts.companyFee).toBe(30.6);
    expect(amounts.ownerAmount).toBe(173.4);
  });

  it('雅阁 · 携程 · 公司费率 10%：马国庆 225 元', () => {
    // file-3「2026」sheet 第 1 行：191.25 × 10% = 19.125
    const amounts = buildSettlementAmounts({ totalAmount: 225, platformRate: 15, companyRate: 10 });
    expect(amounts.platformFee).toBe(33.75);
    expect(amounts.settlementAmount).toBe(191.25);
    expect(amounts.companyFee).toBe(19.125);
    expect(amounts.ownerAmount).toBe(172.125);
  });

  it('雅阁 · 线下 · 公司费率 10%：阿卜杜吉力力买买 160 元', () => {
    // file-3「2026」sheet 第 8 行：160 × 10% = 16
    const amounts = buildSettlementAmounts({ totalAmount: 160, platformRate: 0, companyRate: 10 });
    expect(amounts.platformFee).toBe(0);
    expect(amounts.companyFee).toBe(16);
    expect(amounts.ownerAmount).toBe(144);
  });

  it('哈弗H6 · 哈啰 · 自营无公司费：李龙山 920 元', () => {
    // file-2「2026」sheet 第 3 行：该表没有公司管理费列，等价于费率 0
    const amounts = buildSettlementAmounts({ totalAmount: 920, platformRate: 15, companyRate: 0 });
    expect(amounts.platformFee).toBe(138);
    expect(amounts.settlementAmount).toBe(782);
    expect(amounts.companyFee).toBe(0);
    expect(amounts.ownerAmount).toBe(782);
  });

  it('捷途 2025 · 李兴杰 498.88 元 · 其他费用 0', () => {
    // file-1「2025年」sheet 第 3 行
    const amounts = buildSettlementAmounts({ totalAmount: 498.88, platformRate: 15, companyRate: 15, otherFee: 0 });
    expect(amounts.platformFee).toBe(74.832);
    expect(amounts.settlementAmount).toBe(424.048);
    expect(amounts.companyFee).toBe(63.6072);
    expect(amounts.ownerAmount).toBe(360.4408);
  });
});

describe('buildSettlementAmounts 边界', () => {
  it('非法输入不产出 NaN', () => {
    const amounts = buildSettlementAmounts({
      totalAmount: Number.NaN,
      platformRate: Number.NaN,
      companyRate: Number.NaN,
      otherFee: Number.NaN
    });
    expect(amounts).toEqual({
      totalAmount: 0,
      platformRate: 0,
      platformFee: 0,
      settlementAmount: 0,
      companyRate: 0,
      companyFee: 0,
      otherFee: 0,
      ownerAmount: 0
    });
  });

  it('其他费用为负（车主反向补贴）时加回车主所得', () => {
    // 结算金额 600、公司费 90、其他费用 −50 → 车主得 560
    const amounts = buildSettlementAmounts({ totalAmount: 600, platformRate: 0, companyRate: 15, otherFee: -50 });
    expect(amounts.ownerAmount).toBe(560);
  });

  it('费率为 0 时直接穿透', () => {
    const amounts = buildSettlementAmounts({ totalAmount: 1000, platformRate: 0, companyRate: 0 });
    expect(amounts.platformFee).toBe(0);
    expect(amounts.settlementAmount).toBe(1000);
    expect(amounts.companyFee).toBe(0);
    expect(amounts.ownerAmount).toBe(1000);
  });

  it('总金额为 0 时全链为 0', () => {
    const amounts = buildSettlementAmounts({ totalAmount: 0, platformRate: 15, companyRate: 15 });
    expect(amounts.ownerAmount).toBe(0);
  });

  it('费率越界被收敛到 [0, 100]', () => {
    expect(buildSettlementAmounts({ totalAmount: 100, platformRate: -5, companyRate: 200 }).platformFee).toBe(0);
    expect(buildSettlementAmounts({ totalAmount: 100, platformRate: 200, companyRate: 0 }).platformFee).toBe(100);
  });
});

describe('moneyOf 与 applyOverride', () => {
  const otherFee = 21;
  const calc = buildSettlementAmounts({ totalAmount: 394, platformRate: 15, companyRate: 15, otherFee });

  it('moneyOf 把金额链投影成 6 个落库金额列', () => {
    expect(moneyOf(calc)).toEqual({
      totalAmount: 394,
      platformFee: 59.1,
      settlementAmount: 334.9,
      companyFee: 50.235,
      otherFee: 21,
      ownerAmount: 263.665
    });
  });

  it('未手工覆盖时最终值等于系统口径', () => {
    expect(applyOverride(calc, null, false)).toEqual(moneyOf(calc));
  });

  it('已手工覆盖时原样保留人工值，不被系统口径改回去', () => {
    // 台账里常见的人工调整：机场过路费 7 元、小电 3 元之类
    const manual = { totalAmount: 394, platformFee: 59.1, settlementAmount: 334.9, companyFee: 50.235, otherFee: 28, ownerAmount: 256.665 };
    expect(applyOverride(calc, manual, true)).toEqual(manual);
  });

  it('已覆盖但缺少人工值时回落到系统口径（读旧数据兜底）', () => {
    expect(applyOverride(calc, null, true)).toEqual(moneyOf(calc));
  });

  it('覆盖值里的非法数字被归 0 而不是写进库', () => {
    const dirty = {
      totalAmount: Number.NaN,
      platformFee: 59.1,
      settlementAmount: 334.9,
      companyFee: 50.235,
      otherFee: 21,
      ownerAmount: 263.665
    };
    expect(applyOverride(calc, dirty, true).totalAmount).toBe(0);
  });

  it('覆盖后重算 calc_* 仍可用（前端据此展示差异）', () => {
    const refreshed = buildSettlementAmounts({ totalAmount: 500, platformRate: 15, companyRate: 15 });
    const manual = { totalAmount: 394, platformFee: 59.1, settlementAmount: 334.9, companyFee: 50.235, otherFee: 21, ownerAmount: 263.665 };
    const final = applyOverride(refreshed, manual, true);
    expect(refreshed.totalAmount).toBe(500);
    expect(final.totalAmount).toBe(394);
  });
});

describe('calcStatementSummary 对账单期末应付', () => {
  it('捷途 2026：本期 15246 − 补油 99.16 − 结车款 3000', () => {
    // file-1「2026」sheet：车主结算金额总计 15246，支出区 99.16 → 余额 15147，再 3000 → 12147
    const { closing } = calcStatementSummary({
      opening: 0,
      ownerAmountSum: 15246,
      ownerExpenseSum: 99.16,
      payoutSum: 3000
    });
    expect(closing).toBe(12146.84);
  });

  it('捷途 2024.8：期初 15801 依次扣支出', () => {
    // file-1「2024.8」sheet 的结余列：15801 →330→ 15471 →2000→ 13471
    expect(
      calcStatementSummary({ opening: 15801, ownerAmountSum: 0, ownerExpenseSum: 0, payoutSum: 330 }).closing
    ).toBe(15471);
    expect(
      calcStatementSummary({ opening: 15471, ownerAmountSum: 0, ownerExpenseSum: 0, payoutSum: 2000 }).closing
    ).toBe(13471);
  });

  it('期初结转非 0 时参与计算', () => {
    // file-1「2025年」sheet 的「2024年余额 5387」
    expect(
      calcStatementSummary({ opening: 5387, ownerAmountSum: 0, ownerExpenseSum: 0, payoutSum: 0 }).closing
    ).toBe(5387);
  });

  it('代垫车辆费用与结算付款都扣减车主所得', () => {
    expect(
      calcStatementSummary({ opening: 0, ownerAmountSum: 1000, ownerExpenseSum: 120.5, payoutSum: 300 }).closing
    ).toBe(579.5);
  });

  it('非法输入不产出 NaN', () => {
    expect(calcStatementSummary({ opening: Number.NaN, ownerAmountSum: 0, ownerExpenseSum: 0, payoutSum: 0 }).closing).toBe(0);
  });
});

describe('calcVehicleMonthlyRow 单车月报结余', () => {
  it('雅阁 2026 月报 1 月：总金额 2023.72，月供 2030.31 → 结余 −6.59', () => {
    // file-3「2026月报」sheet 第 1 行
    expect(calcVehicleMonthlyRow({ ownerAmount: 2023.72, loan: 2030.31, maintenance: 0, repair: 0 }).balance).toBe(-6.59);
  });

  it('雅阁 2026 月报 2 月：2357.01 − 2030.30 → 326.71', () => {
    expect(calcVehicleMonthlyRow({ ownerAmount: 2357.01, loan: 2030.3, maintenance: 0, repair: 0 }).balance).toBe(326.71);
  });

  it('雅阁 2026 月报 3 月：3340.76 − 2030.30 → 1310.46', () => {
    // 台账上写的是 1310.45（Excel 截断），这里按精确口径应为 1310.46
    expect(calcVehicleMonthlyRow({ ownerAmount: 3340.76, loan: 2030.3, maintenance: 0, repair: 0 }).balance).toBe(1310.46);
  });

  it('保养与维修一并扣减', () => {
    expect(calcVehicleMonthlyRow({ ownerAmount: 5000, loan: 2000, maintenance: 240, repair: 650 }).balance).toBe(2110);
  });

  it('其它车辆费用（保险分摊后）也扣减', () => {
    // 保险 3718.83 按 12 个月分摊 = 309.9025/月
    expect(
      calcVehicleMonthlyRow({ ownerAmount: 5000, loan: 2000, maintenance: 240, repair: 650, otherExpense: 309.9025 }).balance
    ).toBe(1800.0975);
  });

  it('其它费用缺省为 0，与只有月供/保养/维修的台账口径一致', () => {
    expect(calcVehicleMonthlyRow({ ownerAmount: 2023.72, loan: 2030.31, maintenance: 0, repair: 0 }).balance).toBe(-6.59);
  });
});

describe('结算行 SQL 构造', () => {
  const amounts = buildSettlementAmounts({ totalAmount: 394, platformRate: 15, companyRate: 15, otherFee: 21 });
  const input = {
    ownerId: 'owner-1',
    vehicleId: 'veh-1',
    orderId: 'order-1',
    period: '2026-08',
    lineDate: '2026-08-12 16:30:00',
    orderNo: 'R20260812000001',
    plateNumber: '宁A8E9K2',
    sourceIdRef: 'src-halo',
    sourceName: '哈啰',
    customerName: '余欣荣',
    startDate: '2026-08-12 16:30:00',
    endDate: '2026-08-13 16:30:00',
    days: 1,
    unitPrice: 318,
    amounts,
    sourceType: 'order',
    sourceId: 'order-1',
    lineKind: 'main',
    remarks: '机场还车，过路费6元，洗车10元，补气5元'
  };
  const meta = { id: 'line-1', operatorId: 'user-1', currentTime: '2026-09-22 10:00:00' };

  it('INSERT 的列数与参数个数一致（防止金额静默落进相邻列）', () => {
    const stmt = buildSettlementInsertStmt(input, meta);
    const placeholders = (stmt.sql.match(/\?/g) ?? []).length;
    expect(SETTLEMENT_LINE_COLUMN_COUNT).toBe(37);
    expect(placeholders).toBe(SETTLEMENT_LINE_COLUMN_COUNT);
    expect(stmt.params).toHaveLength(SETTLEMENT_LINE_COLUMN_COUNT);
  });

  it('INSERT 的列名与参数顺序对齐', () => {
    const stmt = buildSettlementInsertStmt(input, meta);
    const columns = stmt.sql.substring(stmt.sql.indexOf('(') + 1, stmt.sql.indexOf(')')).split(',').map((c) => c.trim());
    const params = stmt.params ?? [];
    const at = (column: string) => params[columns.indexOf(column)];

    expect(at('id')).toBe('line-1');
    expect(at('owner_id')).toBe('owner-1');
    expect(at('vehicle_id')).toBe('veh-1');
    expect(at('period')).toBe('2026-08');
    expect(at('days')).toBe(1);
    // calc_* 与最终值两组列都要落到正确位置
    expect(at('calc_platform_rate')).toBe(15);
    expect(at('calc_company_rate')).toBe(15);
    expect(at('calc_owner_amount')).toBe(263.665);
    expect(at('total_amount')).toBe(394);
    expect(at('platform_fee')).toBe(59.1);
    expect(at('settlement_amount')).toBe(334.9);
    expect(at('company_fee')).toBe(50.235);
    expect(at('other_fee')).toBe(21);
    expect(at('owner_amount')).toBe(263.665);
    expect(at('amount_overridden')).toBe(0);
    expect(at('status')).toBe('posted');
    expect(at('source_type')).toBe('order');
    expect(at('source_id')).toBe('order-1');
    expect(at('line_kind')).toBe('main');
    expect(at('remarks')).toBe('机场还车，过路费6元，洗车10元，补气5元');
    expect(at('operator_id')).toBe('user-1');
  });

  it('重算语句用 CASE 保护人工覆盖过的行', () => {
    const stmt = buildSettlementRefreshStmt('order-1', amounts, '2026-09-22 10:00:00');
    // 5 个最终值列都必须有 amount_overridden 守卫
    expect((stmt.sql.match(/CASE WHEN amount_overridden = 1 THEN \w+ ELSE /g) ?? []).length).toBe(5);
    // calc_owner_amount 与 owner_amount 都用 SQL 现算，好让「其他费用」单独改动时自动跟上；
    // 必须套 ROUND，否则 `334.9 - 50.235` 会落库成 284.66499999999996
    expect((stmt.sql.match(/ROUND\(\? - \? - other_fee, 6\)/g) ?? []).length).toBe(2);
    expect(stmt.sql).toContain("WHERE order_id = ? AND status = 'posted'");
    expect(stmt.sql).toContain('calc_owner_amount');
    // 参数顺序：7 个 calc 值（calc_owner 用 2 个参数现算）→ 4 个 CASE 新值 → owner 的 2 个 → 时间 → order_id
    expect(stmt.params).toHaveLength(16);
    expect(stmt.params?.[0]).toBe(394);
    expect(stmt.params?.[3]).toBe(334.9);
    expect(stmt.params?.[5]).toBe(50.235);
    expect(stmt.params?.[14]).toBe('2026-09-22 10:00:00');
    expect(stmt.params?.[15]).toBe('order-1');
  });

  it('作废语句带 status 守卫，不误伤已作废的行', () => {
    const voidStmt = buildSettlementVoidStmt('order-1', '订单取消', '2026-09-22 10:00:00');
    expect(voidStmt.sql).toContain("SET status = 'void'");
    expect(voidStmt.sql).toContain("status = 'posted'");
    expect(voidStmt.params).toEqual(['订单取消', '2026-09-22 10:00:00', 'order-1']);
  });

  it('手工补录行（source_id 为 NULL）不做幂等约束', () => {
    const manual = buildSettlementInsertStmt({ ...input, sourceType: 'manual', sourceId: null }, meta);
    const params = manual.params ?? [];
    const columns = manual.sql.substring(manual.sql.indexOf('(') + 1, manual.sql.indexOf(')')).split(',').map((c) => c.trim());
    expect(params[columns.indexOf('source_id')]).toBeNull();
  });
});
