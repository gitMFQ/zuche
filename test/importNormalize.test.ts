import { describe, expect, it } from 'vitest';
import { normalizeSheet, parseAmount, parseVehicleAttributes, stripModelPrefix } from '../src/lib/import/normalize';

/**
 * 导入是纯函数里风险最高的一块：两个平台的导出列名各不相同（携程 70 列、自有平台 145 列），
 * 映射错一列就会静默把数据写进错误的字段，而且只有真的导一批数据才看得出来。
 *
 * 列名必须与 src/lib/import/templates.ts 的 CTRIP_TEMPLATE / SELF_TEMPLATE 严格一致，
 * 改模板时这些用例会一起失败，起到提醒作用。
 */

/** 按「列名 → 值」构造一行，未提供的列填空串 */
function buildSheet(headers: string[], values: Record<string, string> = {}) {
  return { headers, rows: [headers.map((h) => values[h] ?? '')] };
}

const CTRIP_HEADERS = [
  '携程订单号',
  '订单状态',
  '车型',
  '车牌',
  '客户姓名',
  '取车城市',
  '还车城市',
  '取车地址',
  '还车地址',
  '取车时间',
  '还车时间',
  '实际取车时间',
  '实际还车时间',
  '携程实收',
  '供应商应收',
  '租车押金',
  '违章押金',
  '取车服务类型',
  '送车上门服务费'
];

const CTRIP_ROW: Record<string, string> = {
  携程订单号: 'CT123456',
  订单状态: '已还车',
  车型: '29621894-丰田威兰达 (普通) 5座 5门 自动 汽油 SUV',
  车牌: '京A12345',
  客户姓名: '张三',
  取车城市: '北京',
  还车城市: '北京',
  取车地址: '首都机场T3',
  还车地址: '首都机场T3',
  取车时间: '2026-09-01 10:00:00',
  还车时间: '2026-09-03 10:00:00',
  实际取车时间: '2026-09-01 10:30:00',
  实际还车时间: '2026-09-03 09:50:00',
  携程实收: '1200.50',
  供应商应收: '1056.44',
  租车押金: '2000',
  违章押金: '500',
  取车服务类型: '送车上门'
};

describe('normalizeSheet - 携程模板', () => {
  it('按表头嗅探出模板并映射核心字段', () => {
    const result = normalizeSheet(buildSheet(CTRIP_HEADERS, CTRIP_ROW));
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.template.platform).toBe('ctrip');
    expect(result.rows).toHaveLength(1);

    const row = result.rows[0];
    expect(row.external_no).toBe('CT123456');
    expect(row.status).toBe('completed');
    expect(row.customer_name).toBe('张三');
    expect(row.plate_number).toBe('京A12345');
    expect(row.start_date).toBe('2026-09-01 10:00:00');
    expect(row.actual_start_date).toBe('2026-09-01 10:30:00');
    expect(row.actual_end_date).toBe('2026-09-03 09:50:00');
    expect(row.total_amount).toBe(1200.5);
    expect(row.net_amount).toBe(1056.44);
    expect(row.deposit).toBe(2000);
    expect(row.violation_deposit).toBe(500);
  });

  it('车型串剥掉平台编号后写入 vehicle_model', () => {
    const result = normalizeSheet(buildSheet(CTRIP_HEADERS, CTRIP_ROW), 'ctrip');
    if ('error' in result) throw new Error(result.error);

    expect(result.rows[0].vehicle_model).toBe('丰田威兰达 (普通) 5座 5门 自动 汽油 SUV');
  });

  it('送车上门时取还位置用城市+地址拼出完整位置', () => {
    const result = normalizeSheet(buildSheet(CTRIP_HEADERS, CTRIP_ROW), 'ctrip');
    if ('error' in result) throw new Error(result.error);

    expect(result.rows[0].delivery_type).toBe('delivery');
    expect(result.rows[0].pickup_location).toBe('北京 首都机场T3');
    expect(result.rows[0].return_location).toBe('北京 首都机场T3');
  });

  it('到店取还时位置统一记成「门店」，平台导出的地址不写进去', () => {
    const result = normalizeSheet(
      buildSheet(CTRIP_HEADERS, { ...CTRIP_ROW, 取车服务类型: '自行前往门店' }),
      'ctrip'
    );
    if ('error' in result) throw new Error(result.error);

    expect(result.rows[0].delivery_type).toBe('store');
    expect(result.rows[0].pickup_location).toBe('门店');
    expect(result.rows[0].return_location).toBe('门店');
  });

  it('没有配送方式列但收了送车上门服务费时反推为 delivery', () => {
    const result = normalizeSheet(
      buildSheet(CTRIP_HEADERS, { ...CTRIP_ROW, 取车服务类型: '', 送车上门服务费: '50' }),
      'ctrip'
    );
    if ('error' in result) throw new Error(result.error);

    expect(result.rows[0].delivery_type).toBe('delivery');
  });

  it('全零的费用项不落明细（否则一张单挂几十条 0 元记录）', () => {
    const result = normalizeSheet(buildSheet(CTRIP_HEADERS, CTRIP_ROW), 'ctrip');
    if ('error' in result) throw new Error(result.error);

    // 送车上门服务费传了空值 → 0 → 应被过滤
    expect(result.rows[0].fees.every((fee) => fee.receivable !== 0)).toBe(true);
  });
});

const SELF_HEADERS = [
  '订单编号',
  '订单状态',
  '驾驶人姓名',
  '驾驶人手机号',
  '排车车牌号',
  '排车车辆',
  '计划取车时间',
  '计划还车时间',
  '实际取车时间',
  '实际还车时间',
  '订单费用',
  '商家应收',
  '用户实付',
  '车辆押金',
  '违章押金',
  '押金方式'
];

const SELF_ROW: Record<string, string> = {
  订单编号: 'SELF-001',
  订单状态: '租赁中',
  驾驶人姓名: '李四',
  驾驶人手机号: '13900139000',
  排车车牌号: '京B54321',
  排车车辆: '比亚迪汉 5座 4门 自动 纯电 轿车',
  计划取车时间: '2026-09-10 09:00:00',
  计划还车时间: '2026-09-12 09:00:00',
  订单费用: '800',
  商家应收: '800',
  用户实付: '800',
  车辆押金: '3000',
  押金方式: '信用免押'
};

describe('normalizeSheet - 自有平台模板', () => {
  it('识别模板并映射核心字段', () => {
    const result = normalizeSheet(buildSheet(SELF_HEADERS, SELF_ROW));
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.template.platform).toBe('self');
    const row = result.rows[0];
    expect(row.external_no).toBe('SELF-001');
    expect(row.status).toBe('active'); // 「租赁中」→ active
    expect(row.customer_name).toBe('李四');
    expect(row.customer_phone).toBe('13900139000');
    expect(row.plate_number).toBe('京B54321');
    expect(row.deposit).toBe(3000);
    expect(row.deposit_waived).toBe(true);
  });

  it('脱敏手机号不写入库里，只在备注里留原文', () => {
    const result = normalizeSheet(
      buildSheet(SELF_HEADERS, { ...SELF_ROW, 驾驶人手机号: '139****9000' }),
      'self'
    );
    if ('error' in result) throw new Error(result.error);

    expect(result.rows[0].customer_phone).toBe('');
    expect(result.rows[0].phone_masked).toBe(true);
    expect(result.rows[0].remarks).toContain('139****9000');
  });

  it('各平台的状态说法都归一到四种内部状态', () => {
    const cases: Array<[string, string]> = [
      ['待取车', 'pending'],
      ['待接单', 'pending'],
      ['已下单', 'pending'],
      ['已取车', 'active'],
      ['进行中', 'active'],
      ['租赁中', 'active'],
      ['已还车', 'completed'],
      ['已完成', 'completed'],
      ['已取消', 'cancelled']
    ];

    for (const [raw, expected] of cases) {
      const result = normalizeSheet(buildSheet(SELF_HEADERS, { ...SELF_ROW, 订单状态: raw }), 'self');
      if ('error' in result) throw new Error(result.error);
      expect(result.rows[0].status, `状态「${raw}」`).toBe(expected);
    }
  });
});

describe('normalizeSheet - 模板识别与容错', () => {
  it('表头完全对不上时返回可读错误，而不是抛异常', () => {
    const result = normalizeSheet(buildSheet(['随便一列', '又一列']));
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('无法识别');
    }
  });

  it('显式指定平台时跳过表头嗅探', () => {
    const result = normalizeSheet(buildSheet(CTRIP_HEADERS, CTRIP_ROW), 'ctrip');
    expect('error' in result).toBe(false);
  });

  it('列名带前后空格也能匹配（导出文件常见）', () => {
    // 表头带空格，取值时按 trim 后的列名查，行数据仍按列顺序对齐
    const padded = CTRIP_HEADERS.map((h) => ` ${h} `);
    const row = padded.map((h) => CTRIP_ROW[h.trim()] ?? '');
    const result = normalizeSheet({ headers: padded, rows: [row] }, 'ctrip');
    if ('error' in result) throw new Error(result.error);

    expect(result.rows[0].external_no).toBe('CT123456');
  });

  it('「0」「/」「空」统一视为没有值', () => {
    const result = normalizeSheet(buildSheet(CTRIP_HEADERS, { ...CTRIP_ROW, 车牌: '/', 客户姓名: '0' }), 'ctrip');
    if ('error' in result) throw new Error(result.error);

    expect(result.rows[0].plate_number).toBe('');
    expect(result.rows[0].customer_name).toBe('');
  });

  it('只有日期没有时间时补 00:00:00，保证与系统内排序语义一致', () => {
    const result = normalizeSheet(buildSheet(CTRIP_HEADERS, { ...CTRIP_ROW, 取车时间: '2026-09-01' }), 'ctrip');
    if ('error' in result) throw new Error(result.error);

    expect(result.rows[0].start_date).toBe('2026-09-01 00:00:00');
  });

  it('日期格式非法时 start_date 落空串（校验层会报「缺少取车时间」）', () => {
    const result = normalizeSheet(buildSheet(CTRIP_HEADERS, { ...CTRIP_ROW, 取车时间: '2026/09/01' }), 'ctrip');
    if ('error' in result) throw new Error(result.error);

    expect(result.rows[0].start_date).toBe('');
  });

  it('未知订单状态置为 null 并保留原文，交给校验层报错而不是瞎猜', () => {
    const result = normalizeSheet(buildSheet(CTRIP_HEADERS, { ...CTRIP_ROW, 订单状态: '外星状态' }), 'ctrip');
    if ('error' in result) throw new Error(result.error);

    expect(result.rows[0].status).toBeNull();
    expect(result.rows[0].status_raw).toBe('外星状态');
  });

  it('rowIndex 从 0 开始并回填，供前端按行做 overrides', () => {
    const result = normalizeSheet(buildSheet(CTRIP_HEADERS, CTRIP_ROW), 'ctrip');
    if ('error' in result) throw new Error(result.error);

    expect(result.rows[0].rowIndex).toBe(0);
  });
});

describe('parseAmount', () => {
  it('正常数字（含负数的退款）', () => {
    expect(parseAmount('1200.50')).toBe(1200.5);
    expect(parseAmount('-30')).toBe(-30);
  });

  it('空、短横线、空白都算 0', () => {
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('  ')).toBe(0);
    expect(parseAmount('-')).toBe(0);
  });

  it('非数字文本算 0，不产生 NaN', () => {
    expect(parseAmount('待定')).toBe(0);
    expect(parseAmount('1,200')).toBe(0);
  });
});

describe('stripModelPrefix', () => {
  it('剥掉携程车型前的平台编号', () => {
    expect(stripModelPrefix('29621894-丰田威兰达 (普通) 5座')).toBe('丰田威兰达 (普通) 5座');
  });

  it('没有编号时保持原样', () => {
    expect(stripModelPrefix('丰田威兰达')).toBe('丰田威兰达');
  });
});

describe('parseVehicleAttributes', () => {
  it('从车型串里抠出座位/车门/变速箱/燃料/车身类型', () => {
    const attrs = parseVehicleAttributes('丰田威兰达 (普通) 5座 5门 自动 汽油 SUV');
    expect(attrs.seats).toBe(5);
    expect(attrs.doors).toBe(5);
    expect(attrs.transmission).toBe('自动');
    expect(attrs.fuel_type).toBe('汽油');
    expect(attrs.body_type).toBe('SUV');
    expect(attrs.is_new_energy).toBe(0);
  });

  it('纯电车型标记为新能源', () => {
    const attrs = parseVehicleAttributes('比亚迪汉 5座 4门 自动 纯电 轿车');
    expect(attrs.is_new_energy).toBe(1);
  });

  it('抠不出的属性留 null 交给人工补，不瞎猜', () => {
    const attrs = parseVehicleAttributes('未知车型');
    expect(attrs.seats).toBeNull();
    expect(attrs.doors).toBeNull();
    expect(attrs.transmission).toBeNull();
  });
});
