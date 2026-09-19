/**
 * Excel 原始行 -> 统一的 NormalizedRow。
 *
 * 前端用 SheetJS 解析完后只传「表头 + 二维数组」，不传对象数组，
 * 145 列的场景下体积差一个量级。
 */

import {
  buildColumnMap,
  buildFeeTriplets,
  classifyFee,
  detectTemplate,
  TEMPLATES,
  type FieldKey,
  type Platform,
  type TemplateDef
} from './templates';

export type OrderStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export interface FeeDraft {
  fee_category: string;
  fee_name: string;
  receivable: number;
  received: number;
  refunded: number;
}

export interface NormalizedRow {
  rowIndex: number;
  external_no: string;
  customer_name: string;
  customer_phone: string;
  /** 平台导出的是脱敏号（含 *），无法直接落库，需要人工补全 */
  phone_masked: boolean;
  plate_number: string;
  vehicle_model: string;
  booked_model: string | null;
  status: OrderStatus | null;
  status_raw: string;
  order_created_at: string | null;
  start_date: string;
  end_date: string;
  actual_start_date: string | null;
  actual_end_date: string | null;
  extend_end_date: string | null;
  extend_amount: number;
  deposit: number;
  violation_deposit: number;
  deposit_waived: boolean;
  total_amount: number;
  net_amount: number;
  paid_amount: number;
  pickup_location: string | null;
  return_location: string | null;
  pickup_driver: string | null;
  return_driver: string | null;
  delivery_type: string | null;
  channel: string | null;
  cancel_reason: string | null;
  cancel_time: string | null;
  is_vip: boolean;
  fees: FeeDraft[];
  remarks: string | null;
}

export interface RawSheet {
  headers: string[];
  rows: (string | null)[][];
}

const CTRIP_STATUS_MAP: Record<string, OrderStatus> = {
  已下单: 'pending',
  已取车: 'active',
  已还车: 'completed',
  已取消: 'cancelled'
};

const SELF_STATUS_MAP: Record<string, OrderStatus> = {
  待取车: 'pending',
  待接单: 'pending',
  已下单: 'pending',
  已取车: 'active',
  进行中: 'active',
  租赁中: 'active',
  已还车: 'completed',
  已完成: 'completed',
  已取消: 'cancelled'
};

const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;

export function parseAmount(raw: string | null): number {
  if (raw === null) return 0;
  const text = raw.trim();
  if (!text || text === '-') return 0;
  const value = Number(text);
  return Number.isFinite(value) ? value : 0;
}

/** 平台导出里「0」「/」「空」都是没有值的意思，统一成空串 */
function parseText(raw: string | null): string {
  if (raw === null) return '';
  const text = raw.trim();
  return text === '0' || text === '/' || text === '空' ? '' : text;
}

function parseDateTime(raw: string | null): string | null {
  const text = parseText(raw);
  if (!text) return null;
  if (!DATETIME_PATTERN.test(text)) return null;
  // 只有日期没有时间时补齐，保证与系统内 start_date 的排序语义一致
  return text.length === 10 ? `${text} 00:00:00` : text.replace('T', ' ');
}

/** 携程车型形如「29621894-丰田威兰达 (普通) 5座 5门 自动 汽油 SUV」，剥掉平台侧编号 */
export function stripModelPrefix(raw: string): string {
  return raw.replace(/^\d+-/, '').trim();
}

export interface VehicleAttributes {
  seats: number | null;
  doors: number | null;
  transmission: string | null;
  fuel_type: string | null;
  body_type: string | null;
  is_new_energy: number;
}

/** 从车型文本里尽量抠出车辆属性，抠不出的留空由人工在车辆页补 */
export function parseVehicleAttributes(model: string): VehicleAttributes {
  const seatsMatch = /(\d+)\s*座/.exec(model);
  const doorsMatch = /(\d+)\s*门/.exec(model);

  let transmission: string | null = null;
  if (/自动/.test(model)) transmission = '自动';
  else if (/手动/.test(model)) transmission = '手动';

  let fuel_type: string | null = null;
  if (/纯电|电动|EV/.test(model)) fuel_type = '纯电';
  else if (/混动|DM-i|DM\b/.test(model)) fuel_type = '混动';
  else if (/柴油/.test(model)) fuel_type = '柴油';
  else if (/汽油/.test(model)) fuel_type = '汽油';

  let body_type: string | null = null;
  if (/SUV/i.test(model)) body_type = 'SUV';
  else if (/MPV/i.test(model)) body_type = 'MPV';
  else if (/轿车/.test(model)) body_type = '轿车';

  return {
    seats: seatsMatch ? Number(seatsMatch[1]) : null,
    doors: doorsMatch ? Number(doorsMatch[1]) : null,
    transmission,
    fuel_type,
    body_type,
    is_new_energy: fuel_type === '纯电' || fuel_type === '混动' ? 1 : 0
  };
}

function parseDeliveryType(raw: string): string | null {
  if (/送车上门/.test(raw)) return 'delivery';
  if (/自行前往门店|门店自取|门店取还/.test(raw)) return 'store';
  return null;
}

/** 部分导出没有配送方式列，但收了送车上门服务费，据此反推 */
function inferDeliveryType(fees: FeeDraft[]): string | null {
  return fees.some((fee) => /送车上门/.test(fee.fee_name) && fee.receivable > 0) ? 'delivery' : null;
}

/** 按表头下标取该行的值 */
function cellAt(row: (string | null)[], headers: string[], column: string | undefined): string | null {
  if (!column) return null;
  const index = headers.indexOf(column);
  if (index < 0) return null;
  return row[index] ?? null;
}

function buildFees(
  row: (string | null)[],
  headers: string[],
  template: TemplateDef
): FeeDraft[] {
  const fees: FeeDraft[] = [];

  if (template.feeColumns) {
    for (const column of template.feeColumns) {
      const value = parseAmount(cellAt(row, headers, column));
      // 全零的费用项不落明细，否则一张单会挂几十条 0 元记录
      if (value === 0) continue;
      fees.push({
        fee_category: classifyFee(column),
        fee_name: column,
        receivable: value,
        received: value,
        refunded: 0
      });
    }
    return fees;
  }

  if (template.feeTriplet) {
    for (const triplet of buildFeeTriplets(headers)) {
      const receivable = parseAmount(cellAt(row, headers, triplet.receivable));
      const received = parseAmount(cellAt(row, headers, triplet.received));
      const refunded = parseAmount(cellAt(row, headers, triplet.refunded));
      if (receivable === 0 && received === 0 && refunded === 0) continue;
      fees.push({
        fee_category: classifyFee(triplet.name),
        fee_name: triplet.name,
        receivable,
        received,
        refunded
      });
    }
  }

  return fees;
}

/**
 * 把原始表格转成统一行。platform 未指定时按表头嗅探。
 */
export function normalizeSheet(
  sheet: RawSheet,
  platform?: Platform
): { template: TemplateDef; rows: NormalizedRow[] } | { error: string } {
  const headers = sheet.headers.map((h) => (h ?? '').trim());
  const template = platform ? TEMPLATES.find((item) => item.platform === platform) : detectTemplate(headers);

  if (!template) {
    return { error: '无法识别表格模板，请确认上传的是携程或自有平台的订单导出文件' };
  }

  const columnMap = buildColumnMap(headers, template);
  const statusMap = template.platform === 'ctrip' ? CTRIP_STATUS_MAP : SELF_STATUS_MAP;

  const pick = (row: (string | null)[], key: FieldKey): string | null =>
    cellAt(row, headers, columnMap[key]);

  const rows: NormalizedRow[] = sheet.rows.map((row, index) => {
    const statusRaw = parseText(pick(row, 'status'));
    const status = statusMap[statusRaw] ?? null;

    const rawPhone = parseText(pick(row, 'customer_phone'));
    const phoneMasked = rawPhone.includes('*');
    const customerPhone = phoneMasked ? '' : rawPhone;

    const cancelTime = parseDateTime(pick(row, 'cancel_time'));
    const cancelReason = parseText(pick(row, 'cancel_reason'));

    // 取还地址：携程的城市与地址是两列，拼起来才是完整位置
    const pickupCity = parseText(pick(row, 'pickup_city'));
    const pickupAddress = parseText(pick(row, 'pickup_location'));
    const returnCity = parseText(pick(row, 'return_city'));
    const returnAddress = parseText(pick(row, 'return_location'));
    const pickupLocation = pickupCity ? `${pickupCity} ${pickupAddress}`.trim() : pickupAddress || null;
    const returnLocation = returnCity ? `${returnCity} ${returnAddress}`.trim() : returnAddress || null;

    const totalAmount = parseAmount(pick(row, 'total_amount'));
    const netAmount = parseAmount(pick(row, 'net_amount'));
    const paidAmount = parseAmount(pick(row, 'paid_amount'));

    const fees = buildFees(row, headers, template);
    const remarkParts: string[] = [];
    if (phoneMasked) remarkParts.push(`平台脱敏手机号：${rawPhone}`);
    const isVip = parseText(pick(row, 'is_vip')) === '是';
    if (isVip) remarkParts.push('VIP客户');

    return {
      rowIndex: index,
      external_no: parseText(pick(row, 'external_no')),
      customer_name: parseText(pick(row, 'customer_name')),
      customer_phone: customerPhone,
      phone_masked: phoneMasked,
      plate_number: parseText(pick(row, 'plate_number')),
      vehicle_model: stripModelPrefix(parseText(pick(row, 'vehicle_model'))),
      booked_model: parseText(pick(row, 'booked_model')) || null,
      status,
      status_raw: statusRaw,
      order_created_at: parseDateTime(pick(row, 'order_created_at')),
      start_date: parseDateTime(pick(row, 'start_date')) ?? '',
      end_date: parseDateTime(pick(row, 'end_date')) ?? '',
      actual_start_date: parseDateTime(pick(row, 'actual_start_date')),
      actual_end_date: parseDateTime(pick(row, 'actual_end_date')),
      extend_end_date: parseDateTime(pick(row, 'extend_end_date')),
      extend_amount: parseAmount(pick(row, 'extend_amount')),
      deposit: parseAmount(pick(row, 'deposit')),
      violation_deposit: parseAmount(pick(row, 'violation_deposit')),
      deposit_waived: parseText(pick(row, 'deposit_waived')) !== '',
      total_amount: totalAmount,
      // 携程没有「商家应收」之外的已收概念，完成单视为全额到账
      net_amount: netAmount || totalAmount,
      paid_amount: paidAmount || totalAmount,
      pickup_location: pickupLocation,
      return_location: returnLocation,
      pickup_driver: parseText(pick(row, 'pickup_driver')) || null,
      return_driver: parseText(pick(row, 'return_driver')) || null,
      delivery_type: parseDeliveryType(parseText(pick(row, 'delivery_type'))) ?? inferDeliveryType(fees),
      channel: parseText(pick(row, 'channel')) || null,
      cancel_reason: cancelReason || null,
      cancel_time: cancelTime,
      is_vip: isVip,
      fees,
      remarks: remarkParts.length > 0 ? remarkParts.join('；') : null
    };
  });

  return { template, rows };
}
