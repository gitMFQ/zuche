/**
 * 两套平台导出模板的列映射配置。
 *
 * 这里是纯数据 + 纯函数，不碰 D1。识别模板不看 sheet 名
 * （自有平台导出的 sheet 名是 "0"，没有意义），只看表头列名。
 */

export type Platform = 'ctrip' | 'self';

export type FieldKey =
  | 'external_no'
  | 'customer_name'
  | 'customer_phone'
  | 'vehicle_model'
  | 'plate_number'
  | 'booked_model'
  | 'status'
  | 'order_created_at'
  | 'start_date'
  | 'end_date'
  | 'actual_start_date'
  | 'actual_end_date'
  | 'extend_end_date'
  | 'extend_amount'
  | 'extend_flag'
  | 'deposit'
  | 'violation_deposit'
  | 'deposit_waived'
  | 'total_amount'
  | 'net_amount'
  | 'paid_amount'
  | 'pickup_city'
  | 'return_city'
  | 'pickup_location'
  | 'return_location'
  | 'pickup_driver'
  | 'return_driver'
  | 'delivery_type'
  | 'channel'
  | 'cancel_reason'
  | 'cancel_time'
  | 'is_vip';

export interface TemplateDef {
  platform: Platform;
  label: string;
  /** 表头命中任一项即识别为该模板，按数组顺序优先匹配 */
  detect: string[];
  /** 目标字段 -> 可能的原始列名（第一个命中的生效） */
  fields: Partial<Record<FieldKey, string[]>>;
  /** 携程：列名即费用名，该列值同时作为应收与已收 */
  feeColumns?: string[];
  /** 自有平台：按 "{name}-应收 / -已收 / -退款" 自动推导三元组 */
  feeTriplet?: boolean;
}

const CTRIP_FEE_COLUMNS = [
  '送车上门服务费',
  '上门取车服务费',
  '基础服务费',
  '优享服务费',
  '无忧尊享服务费',
  '基础安心保障费',
  '剐蹭无忧保障费',
  '全程无忧保障费',
  '儿童座椅费用',
  '租车费',
  '服务费',
  '异地还车费',
  '续租费',
  '违约金',
  '提前还车退费',
  '超小时费',
  '超公里费',
  '燃油费',
  '清洗费',
  '误工费',
  '维修费',
  '其他费用',
  '夜间取车服务费(下单时)',
  '夜间还车服务费(下单时)',
  '老无忧租一口价',
  '无忧租服务费',
  '实扣车损',
  '实扣违章'
];

export const CTRIP_TEMPLATE: TemplateDef = {
  platform: 'ctrip',
  label: '携程供应商后台导出',
  detect: ['携程订单号'],
  feeColumns: CTRIP_FEE_COLUMNS,
  fields: {
    external_no: ['携程订单号'],
    customer_name: ['客户姓名'],
    is_vip: ['是否vip客人'],
    vehicle_model: ['车型'],
    plate_number: ['车牌'],
    status: ['订单状态'],
    pickup_city: ['取车城市'],
    return_city: ['还车城市'],
    pickup_location: ['取车地址'],
    return_location: ['还车地址'],
    pickup_driver: ['取车司机'],
    return_driver: ['还车司机'],
    total_amount: ['携程实收'],
    net_amount: ['供应商应收'],
    deposit: ['租车押金'],
    violation_deposit: ['违章押金'],
    deposit_waived: ['免押方式'],
    start_date: ['取车时间'],
    end_date: ['还车时间'],
    actual_start_date: ['实际取车时间'],
    actual_end_date: ['实际还车时间'],
    delivery_type: ['取车服务类型'],
    order_created_at: ['下单时间'],
    channel: ['订单渠道'],
    cancel_reason: ['取消原因']
  }
};

export const SELF_TEMPLATE: TemplateDef = {
  platform: 'self',
  label: '自有平台订单导出',
  detect: ['排车车牌号', '驾驶人手机号', '订单编号'],
  feeTriplet: true,
  fields: {
    external_no: ['订单编号'],
    order_created_at: ['创建时间'],
    status: ['订单状态'],
    cancel_time: ['取消时间'],
    start_date: ['计划取车时间'],
    end_date: ['计划还车时间'],
    extend_end_date: ['续租还车时间'],
    actual_start_date: ['实际取车时间'],
    pickup_driver: ['取车操作人'],
    actual_end_date: ['实际还车时间'],
    return_driver: ['还车操作人'],
    pickup_location: ['用户取车地址'],
    return_location: ['用户还车地址'],
    customer_name: ['驾驶人姓名'],
    customer_phone: ['驾驶人手机号'],
    booked_model: ['预订车辆'],
    vehicle_model: ['排车车辆'],
    plate_number: ['排车车牌号'],
    deposit: ['车辆押金'],
    violation_deposit: ['违章押金'],
    deposit_waived: ['押金方式'],
    extend_flag: ['是否有效续租'],
    extend_amount: ['续租总金额'],
    total_amount: ['订单费用'],
    net_amount: ['商家应收'],
    paid_amount: ['用户实付']
  }
};

export const TEMPLATES: TemplateDef[] = [CTRIP_TEMPLATE, SELF_TEMPLATE];

/**
 * 按表头嗅探模板。命中不到返回 null，由前端让用户手动选择。
 */
export function detectTemplate(headers: string[]): TemplateDef | null {
  const cleaned = headers.map((h) => h.trim()).filter(Boolean);
  for (const template of TEMPLATES) {
    if (template.detect.some((key) => cleaned.includes(key))) {
      return template;
    }
  }
  return null;
}

/**
 * 建立「字段 -> 实际列下标」。导出的列名可能带前后空格，trim 后比较。
 */
export function buildColumnMap(headers: string[], template: TemplateDef): Partial<Record<FieldKey, string>> {
  const cleaned = headers.map((h) => (h ?? '').trim());
  const map: Partial<Record<FieldKey, string>> = {};

  for (const key of Object.keys(template.fields) as FieldKey[]) {
    const aliases = template.fields[key] ?? [];
    const hit = aliases.map((a) => a.trim()).find((a) => cleaned.includes(a));
    if (hit) map[key] = hit;
  }

  return map;
}

/**
 * 自有平台的费用三元组：凡以 "-应收" 结尾的列，按其前缀去找 "-已收" 与 "-退款"。
 * 145 列里大部分是这种三元组，逐一枚举不现实，靠命名规律推导。
 */
export function buildFeeTriplets(headers: string[]): { name: string; receivable: string; received: string; refunded: string }[] {
  const cleaned = headers.map((h) => (h ?? '').trim());
  const result: { name: string; receivable: string; received: string; refunded: string }[] = [];

  for (const col of cleaned) {
    if (!col.endsWith('-应收')) continue;
    const name = col.slice(0, -'-应收'.length);
    if (!name) continue;
    result.push({
      name,
      receivable: col,
      received: cleaned.includes(`${name}-已收`) ? `${name}-已收` : '',
      refunded: cleaned.includes(`${name}-退款`) ? `${name}-退款` : ''
    });
  }

  return result;
}

/** 费用归类：按中文名关键字判定，顺序敏感 */
export function classifyFee(name: string): string {
  if (/租车基本费用|租车费|租金|续租费/.test(name)) return 'rent';
  if (/押金/.test(name)) return 'deposit';
  if (/违约金|扣款|赔偿/.test(name)) return 'penalty';
  if (/服务费|保障|手续费/.test(name)) return 'service';
  if (/儿童座椅|包司机|油费|电费|停车费|ETC|超区|随车物品|行驶证|升级/.test(name)) return 'extra';
  return 'other';
}
