import { type Bind, batchExecute, execute, query, queryOne, queryWithPagination, type Stmt } from '../db/helpers';
import type { D1Database } from '@cloudflare/workers-types';
import type { BlacklistRow, OrderExtensionRow, OrderFeeRow, OrderRow } from '../db/rows';
import { generateId, generateOrderNo } from '../lib/ids';
import { handleError } from '../lib/errors';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
import { dateOffset, normalizeDateTime, now, today } from '../lib/time';
import { calcDailyRate, calcNetAmount, calcRentalDays } from '../lib/orderAmount';
import {
  PAYMENT_TYPE_FEE_CATEGORY,
  PAYMENT_TYPE_TEXT,
  PAYMENT_TXN_CATEGORY,
  PAYMENT_TXN_SLOT,
  ORDER_STATUS_TRANSITIONS,
  ORDER_STATUS_TEXT
} from '../lib/constants';
import { resolveAccountIdByMethod } from '../lib/fundAccount';
import {
  buildReverseStmts,
  findFirstLockedPeriod,
  findPeriodLock,
  INVOICE_STATUSES,
  oneOf,
  pushFundTxn,
  type ReversibleTxn,
  SETTLE_STATUSES
} from '../lib/ledger';
import { roundMoney, toAmount } from '../lib/money';
import {
  buildSettlementAmounts,
  buildSettlementRefreshStmt,
  buildSettlementVoidStmt,
  resolveCompanyRate
} from '../lib/settlement';
import type { AppContext } from '../types';

// 订单状态映射
const STATUS_MAP = { ...ORDER_STATUS_TEXT };

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

/** 订单连同车辆车牌一起取出，避免写日志时再回查一次 */
const ORDER_WITH_PLATE_SQL = `
  SELECT o.*, COALESCE(o.plate_number, v.plate_number) AS plate_number
  FROM orders o
  LEFT JOIN vehicles v ON o.vehicle_id = v.id
  WHERE o.id = ?
`;

type OrderWithPlate = OrderRow & { plate_number: string | null };

/**
 * 生成「按订单重算结算行」的语句。订单金额/费率/还车时间变动时都要带上它。
 *
 * 费率的两个来源：平台费率取订单上的 commission_rate（来源配置的快照），
 * 公司费率取车辆所属车主的配置。取不到就返回 null —— 这张单还没生成过结算行，
 * 没有需要重算的东西，省掉一次无意义的 UPDATE。
 */
async function buildSettlementRefresh(
  db: D1Database,
  orderId: string,
  order: { vehicle_id: string; commission_rate: number },
  totalAmount: number,
  currentTime: string
): Promise<Stmt> {
  const companyRate = await resolveCompanyRate(db, order.vehicle_id);
  const amounts = buildSettlementAmounts({
    totalAmount,
    platformRate: order.commission_rate || 0,
    companyRate
  });
  return buildSettlementRefreshStmt(orderId, amounts, currentTime);
}

/** 读订单下所有收款流水（用于删除订单时写红字） */
async function loadOrderTxnRows(db: D1Database, orderId: string): Promise<ReversibleTxn[]> {
  const payments = await query<{ id: string }>(db, 'SELECT id FROM payments WHERE order_id = ?', [orderId]);
  if (payments.length === 0) return [];

  const placeholders = payments.map(() => '?').join(', ');
  return query<ReversibleTxn>(
    db,
    `SELECT id, account_id, txn_date, direction, amount, category, counterparty, summary
     FROM fund_transactions
     WHERE source_type IN ('prepay', 'payment', 'extension')
       AND source_id IN (${placeholders})
       AND status = 'posted'
       AND reverses_id IS NULL`,
    payments.map((row) => row.id)
  );
}

function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function serializeImages(images: string[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  return JSON.stringify(images);
}

/** 订单号唯一冲突时的最大重试次数 */
const ORDER_NO_MAX_ATTEMPTS = 5;

/**
 * 插入订单，订单号撞唯一约束时换号重试。
 *
 * D1 的 batch 是隐式事务，任一条失败会整体回滚，所以直接重放整批是安全的。
 * 只在明确是 order_no 唯一冲突时才换号，其它错误（外键、类型等）原样抛出，
 * 避免把真实的业务错误伪装成重试。
 */
async function insertOrderWithOrderNoRetry(
  db: D1Database,
  buildStatements: (orderNo: string) => Stmt[]
): Promise<string> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < ORDER_NO_MAX_ATTEMPTS; attempt += 1) {
    const orderNo = generateOrderNo();
    try {
      await batchExecute(db, buildStatements(orderNo));
      return orderNo;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!(message.includes('UNIQUE') && message.includes('order_no'))) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError ?? new Error('订单号生成失败');
}

// 获取订单列表
export async function getOrders(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const q = c.req.query();
    const page = Number(q.page ?? 1);
    const pageSize = Number(q.pageSize ?? 10);

    // 列表不返回 pickup_image / return_image（编辑、取还车弹窗都是重新上传，从不回显旧图），
    // 其余字段保留：弹窗在 getOne 失败时会退回用列表行做预填，裁太狠会让预填缺字段。
    let sql = `
      SELECT o.id, o.order_no, o.status, o.customer_id, o.vehicle_id, o.user_id,
        o.start_date, o.end_date, o.actual_start_date, o.actual_end_date,
        o.daily_rate, o.deposit, o.violation_deposit, o.total_amount, o.paid_amount,
        o.pickup_mileage, o.return_mileage, o.pickup_location, o.return_location,
        o.service_type, o.deposit_waived, o.deposit_waived_expiry, o.contract_number,
        o.source_id, o.commission_rate, o.net_amount, o.remarks,
        o.platform, o.external_no, o.import_batch_id, o.cancel_reason, o.cancelled_at,
        o.invoice_amount, o.invoice_status, o.settle_status, o.settle_remarks,
        o.created_at, o.updated_at,
        c.name as customer_name, c.phone as customer_phone,
        COALESCE(o.plate_number, v.plate_number) as plate_number,
        v.brand, v.model, v.is_new_energy,
        u.name as operator_name,
        s.name as source_name, s.color as source_color
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_sources s ON o.source_id = s.id
      WHERE 1=1
    `;
    const params: Bind[] = [];

    if (q.keyword) {
      sql += ' AND (o.order_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR v.plate_number LIKE ?)';
      const likeKeyword = `%${q.keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword);
    }

    if (q.status) {
      sql += ' AND o.status = ?';
      params.push(q.status);
    }

    if (q.customer_id) {
      sql += ' AND o.customer_id = ?';
      params.push(q.customer_id);
    }

    if (q.vehicle_id) {
      sql += ' AND o.vehicle_id = ?';
      params.push(q.vehicle_id);
    }

    // 结算状态是人工维护的枚举（台账「未结清」列被当备注用过，所以不跟 paid_amount 自动联动）
    if (oneOf(q.settle_status, SETTLE_STATUSES)) {
      sql += ' AND o.settle_status = ?';
      params.push(q.settle_status);
    }
    if (oneOf(q.invoice_status, INVOICE_STATUSES)) {
      sql += ' AND o.invoice_status = ?';
      params.push(q.invoice_status);
    }

    // 取车时间范围筛选
    if (q.start_date_from) {
      sql += ' AND o.start_date >= ?';
      params.push(`${q.start_date_from} 00:00:00`);
    }
    if (q.start_date_to) {
      sql += ' AND o.start_date <= ?';
      params.push(`${q.start_date_to} 23:59:59`);
    }

    // 还车时间范围筛选
    if (q.end_date_from) {
      sql += ' AND o.end_date >= ?';
      params.push(`${q.end_date_from} 00:00:00`);
    }
    if (q.end_date_to) {
      sql += ' AND o.end_date <= ?';
      params.push(`${q.end_date_to} 23:59:59`);
    }

    // 订单来源筛选
    if (q.source_id) {
      sql += ' AND o.source_id = ?';
      params.push(q.source_id);
    }

    // 车型筛选
    if (q.vehicle_model) {
      sql += ' AND (v.brand LIKE ? OR v.model LIKE ?)';
      const likeModel = `%${q.vehicle_model}%`;
      params.push(likeModel, likeModel);
    }

    // 车牌号筛选
    if (q.plate_number) {
      sql += ' AND v.plate_number LIKE ?';
      params.push(`%${q.plate_number}%`);
    }

    // 时间快捷筛选（今天/明天/后天/逾期）。
    // 原来在前端拉全表过滤，被分页上限截断；这里下推到 SQL。
    // dateField 只可能是下面两个字面量之一，不参与用户输入拼接。
    if (q.time_filter) {
      const dateField = q.status === 'active' ? 'o.end_date' : 'o.start_date';
      switch (q.time_filter) {
        case 'overdue':
          sql += ` AND date(${dateField}) < ?`;
          params.push(today());
          break;
        case 'today':
          sql += ` AND date(${dateField}) = ?`;
          params.push(today());
          break;
        case 'tomorrow':
          sql += ` AND date(${dateField}) = ?`;
          params.push(dateOffset(1));
          break;
        case 'day_after':
          sql += ` AND date(${dateField}) = ?`;
          params.push(dateOffset(2));
          break;
      }
    }

    // 排序处理
    switch (q.order_by) {
      case 'start_date_asc':
        sql += ' ORDER BY o.start_date ASC';
        break;
      case 'start_date_desc':
        sql += ' ORDER BY o.start_date DESC';
        break;
      case 'end_date_asc':
        sql += ' ORDER BY o.end_date ASC';
        break;
      case 'end_date_desc':
        sql += ' ORDER BY o.end_date DESC';
        break;
      default:
        // 未指定时按状态选择最合适的排序
        if (q.status === 'pending') {
          sql += ' ORDER BY o.start_date ASC';
        } else if (q.status === 'active') {
          sql += ' ORDER BY o.end_date ASC';
        } else if (q.status === 'completed') {
          sql += ' ORDER BY o.actual_end_date DESC, o.updated_at DESC';
        } else {
          sql += ' ORDER BY o.created_at DESC';
        }
    }

    const result = await queryWithPagination<OrderRow>(db, sql, params, page, pageSize);

    const data = result.data.map((o) => ({
      ...o,
      status_text: STATUS_MAP[o.status] || o.status
    }));

    return c.json({ success: true, data: { ...result, data } });
  } catch (error) {
    return handleError(c, '获取订单列表错误:', error);
  }
}

interface OrderStatsRow {
  pending: number;
  active: number;
  completed: number;
  cancelled: number;
  pending_overdue: number;
  pending_today: number;
  pending_tomorrow: number;
  pending_day_after: number;
  active_overdue: number;
  active_today: number;
  active_tomorrow: number;
  active_day_after: number;
}

/**
 * 订单统计：状态分桶 + 时间快捷筛选分桶。
 *
 * 前端原本用 pageSize=10000 拉全表在前端计数，但 queryWithPagination 把 pageSize
 * 上限锁在 100，订单超过 100 条后 tab 计数与时间筛选计数就全是错的。
 * 这里用一条条件聚合查询一次算完。
 */
export async function getOrderStats(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const todayStr = today();
    const tomorrowStr = dateOffset(1);
    const dayAfterStr = dateOffset(2);

    const row = await queryOne<OrderStatsRow>(
      db,
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
         COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
         COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
         COALESCE(SUM(CASE WHEN status = 'pending' AND date(start_date) < ? THEN 1 ELSE 0 END), 0) AS pending_overdue,
         COALESCE(SUM(CASE WHEN status = 'pending' AND date(start_date) = ? THEN 1 ELSE 0 END), 0) AS pending_today,
         COALESCE(SUM(CASE WHEN status = 'pending' AND date(start_date) = ? THEN 1 ELSE 0 END), 0) AS pending_tomorrow,
         COALESCE(SUM(CASE WHEN status = 'pending' AND date(start_date) = ? THEN 1 ELSE 0 END), 0) AS pending_day_after,
         COALESCE(SUM(CASE WHEN status = 'active' AND date(end_date) < ? THEN 1 ELSE 0 END), 0) AS active_overdue,
         COALESCE(SUM(CASE WHEN status = 'active' AND date(end_date) = ? THEN 1 ELSE 0 END), 0) AS active_today,
         COALESCE(SUM(CASE WHEN status = 'active' AND date(end_date) = ? THEN 1 ELSE 0 END), 0) AS active_tomorrow,
         COALESCE(SUM(CASE WHEN status = 'active' AND date(end_date) = ? THEN 1 ELSE 0 END), 0) AS active_day_after
       FROM orders`,
      [
        todayStr, todayStr, tomorrowStr, dayAfterStr,
        todayStr, todayStr, tomorrowStr, dayAfterStr
      ]
    );

    return c.json({
      success: true,
      data: {
        pending: row?.pending ?? 0,
        active: row?.active ?? 0,
        completed: row?.completed ?? 0,
        cancelled: row?.cancelled ?? 0,
        timeFilter: {
          pending: {
            overdue: row?.pending_overdue ?? 0,
            today: row?.pending_today ?? 0,
            tomorrow: row?.pending_tomorrow ?? 0,
            day_after: row?.pending_day_after ?? 0
          },
          active: {
            overdue: row?.active_overdue ?? 0,
            today: row?.active_today ?? 0,
            tomorrow: row?.active_tomorrow ?? 0,
            day_after: row?.active_day_after ?? 0
          }
        }
      }
    });
  } catch (error) {
    return handleError(c, '获取订单统计错误:', error);
  }
}

interface OrderDetailRow extends OrderRow {
  customer_name: string | null;
  customer_phone: string | null;
  id_card: string | null;
  license_number: string | null;
  id_card_images: string | null;
  license_images: string | null;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  is_new_energy: number | null;
  operator_name: string | null;
  source_name: string | null;
  source_color: string | null;
}

// 获取单个订单
export async function getOrder(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');

    const [order, payments, fees, extensions] = await Promise.all([
      queryOne<OrderDetailRow>(
        db,
        `SELECT o.*,
           c.name as customer_name, c.phone as customer_phone, c.id_card, c.license_number,
           c.id_card_images, c.license_images,
           COALESCE(o.plate_number, v.plate_number) as plate_number,
           v.brand, v.model, v.color, v.is_new_energy,
           u.name as operator_name,
           s.name as source_name, s.color as source_color
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         LEFT JOIN vehicles v ON o.vehicle_id = v.id
         LEFT JOIN users u ON o.user_id = u.id
         LEFT JOIN order_sources s ON o.source_id = s.id
         WHERE o.id = ?`,
        [id]
      ),
      query(db, 'SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC', [id]),
      query<OrderFeeRow>(db, 'SELECT * FROM order_fees WHERE order_id = ? ORDER BY fee_category, fee_name', [id]),
      query<OrderExtensionRow>(db, 'SELECT * FROM order_extensions WHERE order_id = ? ORDER BY created_at DESC', [id])
    ]);

    if (!order) {
      return c.json({ success: false, message: '订单不存在' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...order,
        id_card_images: parseImages(order.id_card_images),
        license_images: parseImages(order.license_images),
        status_text: STATUS_MAP[order.status] || order.status,
        payments,
        fees,
        extensions
      }
    });
  } catch (error) {
    return handleError(c, '获取订单错误:', error);
  }
}

interface CreateOrderBody {
  customer_name?: string;
  customer_phone?: string;
  customer_id_card?: string;
  customer_license?: string;
  id_card_images?: string[];
  license_images?: string[];
  vehicle_id?: string;
  start_date?: string;
  end_date?: string;
  daily_rate?: number;
  deposit?: number;
  total_amount?: number;
  remarks?: string;
  source_id?: string;
  service_type?: string;
  deposit_waived?: boolean;
  deposit_waived_expiry?: string;
  contract_number?: string;
  pickup_location?: string;
  return_location?: string;
  delivery_type?: string;
  has_prepay?: boolean;
  prepay_amount?: number;
  prepay_method?: string;
  prepay_type?: string;
  /** 命中黑名单时，前端二次确认后带 force=true 强制下单（会写日志留痕） */
  force?: boolean;
}

// 创建订单（支持自动创建客户）
export async function createOrder(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<CreateOrderBody>();
    const { customer_name, vehicle_id, start_date, end_date } = body;
    const { daily_rate, total_amount } = body;
    // 手机号选填：平台导入的客户可能没有手机号，留空时不能参与格式校验与匹配
    const customer_phone = body.customer_phone?.trim() ?? '';

    if (!customer_name || !vehicle_id || !start_date || !end_date) {
      return c.json({ success: false, message: '客户姓名、车辆、起止日期不能为空' }, 400);
    }

    if (!daily_rate && !total_amount) {
      return c.json({ success: false, message: '日租金和总租金至少填写一项' }, 400);
    }

    // 验证手机号格式（留空时跳过）
    if (customer_phone && !PHONE_PATTERN.test(customer_phone)) {
      return c.json({ success: false, message: '手机号格式不正确' }, 400);
    }

    // 先把需要判断的数据全部读出来
    const [vehicle, existingCustomer, source, blacklistHit] = await Promise.all([
      queryOne<{ id: string; status: string; plate_number: string }>(db, 'SELECT id, status, plate_number FROM vehicles WHERE id = ?', [vehicle_id]),
      // 没有手机号时退回按姓名匹配，否则空串会误命中上一个无手机号的客户
      queryOne<{ id: string }>(
        db,
        customer_phone ? 'SELECT id FROM customers WHERE phone = ?' : 'SELECT id FROM customers WHERE name = ?',
        [customer_phone || customer_name]
      ),
      body.source_id
        ? queryOne<{ commission_rate: number }>(db, 'SELECT commission_rate FROM order_sources WHERE id = ? AND status = 1', [body.source_id])
        : Promise.resolve(null),
      // 黑名单命中检查：优先手机号，无手机号时退回姓名
      queryOne<BlacklistRow>(
        db,
        customer_phone
          ? 'SELECT * FROM blacklist WHERE phone = ? AND status = 1'
          : 'SELECT * FROM blacklist WHERE name = ? AND status = 1',
        [customer_phone || customer_name]
      )
    ]);

    // 黑名单软拦截：提示风险但允许强制下单（可能存在误拉黑、欠款已结清未移出的情况），
    // 硬性拒绝会直接卡住门店营业。强制下单会写日志留痕。
    if (blacklistHit && !body.force) {
      return c.json(
        {
          success: false,
          code: 'BLACKLISTED',
          message: '该客户在黑名单中',
          data: {
            record: {
              id: blacklistHit.id,
              name: blacklistHit.name,
              phone: blacklistHit.phone,
              reason: blacklistHit.reason,
              operator_name: blacklistHit.operator_name,
              created_at: blacklistHit.created_at
            }
          }
        },
        409
      );
    }

    if (!vehicle) {
      return c.json({ success: false, message: '车辆不存在' }, 400);
    }

    // 检查车辆是否在维修中或不可用
    if (vehicle.status === 'maintenance' || vehicle.status === 'unavailable') {
      return c.json({ success: false, message: '车辆当前处于维修或不可用状态' }, 400);
    }

    // 检查车辆在指定时间段内是否与其他订单冲突
    const conflictingOrder = await queryOne<{ id: string }>(
      db,
      `SELECT id FROM orders
       WHERE vehicle_id = ?
         AND status NOT IN ('cancelled', 'completed')
         AND (
           (start_date <= ? AND end_date > ?)
           OR (start_date < ? AND end_date >= ?)
           OR (start_date >= ? AND end_date <= ?)
         )`,
      [vehicle_id, start_date, start_date, end_date, end_date, start_date, end_date]
    );

    if (conflictingOrder) {
      return c.json({ success: false, message: '该车辆在指定时间段内已被预约' }, 400);
    }

    // 计算天数
    const days = calcRentalDays(start_date, end_date);

    // 计算总金额：如果提供了总租金则使用，否则按日租金计算
    let totalAmount = total_amount;
    let finalDailyRate = daily_rate;

    if (!totalAmount && daily_rate) {
      totalAmount = days * daily_rate;
    }

    // 如果只有总租金，反推日租金
    if (totalAmount && !daily_rate) {
      finalDailyRate = calcDailyRate(totalAmount, days);
    }

    // 计算到账金额（扣除平台服务费）
    const commissionRate = source?.commission_rate || 0;
    const netAmount = calcNetAmount(totalAmount ?? 0, commissionRate);

    const id = generateId();
    const currentTime = now();
    const userId = getAuthUser(c)?.id ?? null;

    // 处理免押相关
    const isDepositWaived = body.deposit_waived ? 1 : 0;
    const finalDeposit = isDepositWaived ? 0 : body.deposit || 0;
    const depositWaivedExpiry = isDepositWaived ? body.deposit_waived_expiry ?? null : null;

    // 处理预付金额
    const hasPrepay = Boolean(body.has_prepay && (body.prepay_amount ?? 0) > 0);
    const initialPaidAmount = hasPrepay ? (body.prepay_amount ?? 0) : 0;

    // 客户的新建/更新与订单、支付记录放进同一个 batch，保证原子性
    const customerId = existingCustomer?.id ?? generateId();

    const customerStmt: Stmt = existingCustomer
      ? {
          sql: 'UPDATE customers SET name = ?, id_card = ?, license_number = ?, id_card_images = ?, license_images = ?, updated_at = ? WHERE id = ?',
          params: [
            customer_name,
            body.customer_id_card ?? null,
            body.customer_license ?? null,
            serializeImages(body.id_card_images),
            serializeImages(body.license_images),
            currentTime,
            customerId
          ]
        }
      : {
          sql: 'INSERT INTO customers (id, name, phone, id_card, license_number, id_card_images, license_images, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
          params: [
            customerId,
            customer_name,
            customer_phone,
            body.customer_id_card ?? null,
            body.customer_license ?? null,
            serializeImages(body.id_card_images),
            serializeImages(body.license_images),
            currentTime,
            currentTime
          ]
        };

    // 预付流水的账户在重试循环外解析一次即可（重试只是换订单号）
    const prepayAccountId = hasPrepay ? await resolveAccountIdByMethod(db, body.prepay_method) : null;
    // 支付记录 id 必须提前生成：资金流水要用它做幂等键的 source_id，
    // 原来是内联 generateId()，流水引用不上、重复执行也拦不住
    const prepayPaymentId = generateId();

    // 订单号随机生成，理论上可能撞唯一约束，所以按号重建整批语句以便重试
    const buildStatements = (orderNo: string): Stmt[] => {
      const list: Stmt[] = [customerStmt];

      list.push({
        sql: `INSERT INTO orders (id, order_no, customer_id, vehicle_id, plate_number, user_id, start_date, end_date, daily_rate, deposit, total_amount, paid_amount, status, remarks, source_id, commission_rate, net_amount, service_type, deposit_waived, deposit_waived_expiry, contract_number, pickup_location, return_location, delivery_type, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id,
          orderNo,
          customerId,
          vehicle_id,
          // 车牌快照：删车后历史订单仍能显示车牌（orders.vehicle_id 刻意无外键）
          vehicle.plate_number,
          userId,
          start_date,
          end_date,
          finalDailyRate || 0,
          finalDeposit,
          totalAmount,
          initialPaidAmount,
          body.remarks ?? null,
          body.source_id ?? null,
          commissionRate,
          netAmount,
          body.service_type || 'basic',
          isDepositWaived,
          depositWaivedExpiry,
          body.contract_number ?? null,
          body.pickup_location ?? null,
          body.return_location ?? null,
          body.delivery_type ?? null,
          currentTime,
          currentTime
        ]
      });

      // 如果有预付，添加支付记录 + 对应的资金流水
      if (hasPrepay && body.prepay_method && body.prepay_type) {
        list.push({
          sql: 'INSERT INTO payments (id, order_id, amount, payment_method, payment_type, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          params: [
            prepayPaymentId,
            id,
            body.prepay_amount ?? 0,
            body.prepay_method,
            body.prepay_type,
            '下单时预付',
            currentTime
          ]
        });
        pushFundTxn(
          list,
          {
            accountId: prepayAccountId,
            txnDate: today(),
            direction: 'in',
            amount: body.prepay_amount ?? 0,
            category: PAYMENT_TXN_CATEGORY[body.prepay_type] ?? 'other',
            sourceType: 'prepay',
            sourceId: prepayPaymentId,
            sourceKind: PAYMENT_TXN_SLOT[body.prepay_type] ?? 'other_in',
            counterparty: customer_name,
            summary: `下单预付 ${orderNo}（${customer_name}）`
          },
          { operatorId: userId, currentTime }
        );
      }

      return list;
    };

    const orderNo = await insertOrderWithOrderNoRetry(db, buildStatements);

    await logAction(db, {
      userId: userId ?? '',
      action: '创建订单',
      entityType: 'order',
      entityId: id,
      details: `创建订单 ${orderNo}，客户：${customer_name}，车辆：${vehicle.plate_number}${
        blacklistHit ? `（黑名单客户强制下单，原因：${blacklistHit.reason}）` : ''
      }`,
      ipAddress: getClientIp(c)
    });

    return c.json({
      success: true,
      data: {
        id,
        order_no: orderNo,
        total_amount: totalAmount,
        net_amount: netAmount,
        commission_rate: commissionRate,
        days,
        customer_id: customerId,
        paid_amount: initialPaidAmount
      },
      message: '订单创建成功'
    });
  } catch (error) {
    return handleError(c, '创建订单错误:', error);
  }
}

// 更新订单状态
export async function updateOrderStatus(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';
    const body = await c.req.json<{
      status?: string;
      actual_start_date?: string;
      actual_end_date?: string;
      remarks?: string;
      pickup_mileage?: number;
      return_mileage?: number;
      pickup_image?: string;
      return_image?: string;
    }>();
    const { status } = body;

    if (!status) {
      return c.json({ success: false, message: '订单状态不能为空' }, 400);
    }

    const order = await queryOne<OrderWithPlate>(db, ORDER_WITH_PLATE_SQL, [id]);
    if (!order) {
      return c.json({ success: false, message: '订单不存在' }, 404);
    }

    // 状态机校验：只允许 ORDER_STATUS_TRANSITIONS 声明的流转。
    // 同状态视为幂等重试（前端重发、网络重试），直接放行。
    if (status !== order.status) {
      const allowed = ORDER_STATUS_TRANSITIONS[order.status];
      if (!allowed) {
        return c.json({ success: false, message: `订单当前状态异常：${order.status}` }, 400);
      }
      if (!allowed.includes(status)) {
        const from = STATUS_MAP[order.status] || order.status;
        const to = STATUS_MAP[status] || status;
        return c.json({ success: false, message: `订单为「${from}」，不能变更为「${to}」` }, 400);
      }
    }

    const currentTime = now();
    const stmts: Stmt[] = [];

    // 如果还车时有里程数据，更新车辆里程
    if (status === 'completed' && body.return_mileage !== undefined && body.return_mileage !== null) {
      stmts.push({
        sql: 'UPDATE vehicles SET mileage = ?, updated_at = ? WHERE id = ?',
        params: [body.return_mileage, currentTime, order.vehicle_id]
      });
    }

    // 计算实际金额（如果有实际还车日期）。
    // daily_rate 为 0 时不做重算，否则会把总额直接清零。
    let totalAmount = order.total_amount;
    if (body.actual_end_date && status === 'completed' && order.daily_rate > 0) {
      const days = calcRentalDays(order.start_date, body.actual_end_date);
      totalAmount = days * order.daily_rate;
    }
    // total_amount 变了必须同步 net_amount，否则平台单的净收入与总额对不上
    const netAmount = calcNetAmount(totalAmount, order.commission_rate || 0);

    // 未传 actual_end_date 时保留原值：取车等操作不应该把已记录的还车时间清空
    const actualEndDate =
      body.actual_end_date !== undefined ? normalizeDateTime(body.actual_end_date) : order.actual_end_date;

    // 构建更新字段
    let updateSql =
      'UPDATE orders SET status = ?, actual_end_date = ?, total_amount = ?, net_amount = ?, remarks = ?, updated_at = ?';
    const updateParams: Bind[] = [
      status,
      actualEndDate,
      totalAmount,
      netAmount,
      body.remarks ?? order.remarks,
      currentTime
    ];

    // 取车时记录取车里程和图片
    if (status === 'active') {
      // 实际取车时间与还车时间对称，未传则取当前时间
      updateSql += ', actual_start_date = ?';
      updateParams.push(normalizeDateTime(body.actual_start_date) ?? currentTime);

      if (body.pickup_mileage !== undefined && body.pickup_mileage !== null) {
        updateSql += ', pickup_mileage = ?';
        updateParams.push(body.pickup_mileage);
      }
      if (body.pickup_image) {
        updateSql += ', pickup_image = ?';
        updateParams.push(body.pickup_image);
      }
    }

    // 还车时记录还车里程和图片
    if (status === 'completed') {
      if (body.return_mileage !== undefined && body.return_mileage !== null) {
        updateSql += ', return_mileage = ?';
        updateParams.push(body.return_mileage);
      }
      if (body.return_image) {
        updateSql += ', return_image = ?';
        updateParams.push(body.return_image);
      }
    }

    updateSql += ' WHERE id = ?';
    updateParams.push(id);

    stmts.push({ sql: updateSql, params: updateParams });

    // 还车会按实际天数重算 total_amount，结算行的系统口径要跟着更新。
    // 人工改过金额的结算行由 CASE 守卫保护，不会被覆盖。
    if (totalAmount !== order.total_amount) {
      stmts.push(await buildSettlementRefresh(db, id, order, totalAmount, currentTime));
    }

    await batchExecute(db, stmts);

    const statusText = STATUS_MAP[status] || status;
    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: statusText || '更新订单状态',
      entityType: 'order',
      entityId: id,
      details: `订单 ${order.order_no} 状态变更为${statusText}，车辆：${order.plate_number || ''}`,
      ipAddress: getClientIp(c)
    });

    return c.json({
      success: true,
      data: { status, total_amount: totalAmount, net_amount: netAmount },
      message: '订单状态更新成功'
    });
  } catch (error) {
    return handleError(c, '更新订单状态错误:', error);
  }
}

interface UpdateOrderBody {
  customer_name?: string;
  customer_phone?: string;
  customer_id_card?: string;
  customer_license?: string;
  id_card_images?: string[];
  license_images?: string[];
  vehicle_id?: string;
  source_id?: string | null;
  start_date?: string;
  end_date?: string;
  daily_rate?: number;
  total_amount?: number;
  deposit?: number;
  remarks?: string;
  service_type?: string;
  deposit_waived?: boolean;
  deposit_waived_expiry?: string;
  contract_number?: string;
  pickup_location?: string;
  return_location?: string;
  /** 开票金额。台账的「开票金额」常常大于总租金（含税含服务费），不能由总额推导 */
  invoice_amount?: number;
  /** none 未开 / pending 待开 / issued 已开 */
  invoice_status?: string;
  /** unpaid 未结清 / partial 部分 / paid 已结清。人工维护，不跟 paid_amount 自动联动 */
  settle_status?: string;
  settle_remarks?: string | null;
  /** 命中黑名单时，前端二次确认后带 force=true 强制保存 */
  force?: boolean;
}

// 更新订单信息
export async function updateOrder(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';
    const body = await c.req.json<UpdateOrderBody>();

    const order = await queryOne<OrderRow>(db, 'SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return c.json({ success: false, message: '订单不存在' }, 404);
    }

    // 只有待确认和进行中的订单可以修改
    if (order.status !== 'pending' && order.status !== 'active') {
      return c.json({ success: false, message: '只能修改待确认或进行中的订单' }, 400);
    }

    // 验证手机号格式
    if (body.customer_phone && !PHONE_PATTERN.test(body.customer_phone)) {
      return c.json({ success: false, message: '手机号格式不正确' }, 400);
    }

    const currentTime = now();
    const stmts: Stmt[] = [];
    let customerId = order.customer_id;

    // 处理客户信息更新
    const hasCustomerUpdate =
      body.customer_name !== undefined ||
      body.customer_phone !== undefined ||
      body.customer_id_card !== undefined ||
      body.customer_license !== undefined ||
      body.id_card_images !== undefined ||
      body.license_images !== undefined;

    if (hasCustomerUpdate) {
      // 手机号选填：留空时按姓名匹配。若仍按 phone 查，空串会命中库里
      // 第一个无手机号的客户，把订单错挂到别人名下
      const customer = body.customer_phone
        ? await queryOne<{ id: string }>(db, 'SELECT id FROM customers WHERE phone = ?', [body.customer_phone])
        : body.customer_name
          ? await queryOne<{ id: string }>(db, 'SELECT id FROM customers WHERE name = ?', [body.customer_name])
          : null;

      // 换客户（或新建客户）时同样过一遍黑名单，否则改单就成了绕过黑名单的口子
      const isChangingCustomer = customer ? customer.id !== order.customer_id : Boolean(body.customer_phone);
      if (isChangingCustomer && !body.force) {
        const hit = await queryOne<BlacklistRow>(
          db,
          body.customer_phone
            ? 'SELECT * FROM blacklist WHERE phone = ? AND status = 1'
            : 'SELECT * FROM blacklist WHERE name = ? AND status = 1',
          [body.customer_phone || body.customer_name || '']
        );
        if (hit) {
          return c.json(
            {
              success: false,
              code: 'BLACKLISTED',
              message: '该客户在黑名单中',
              data: {
                record: {
                  id: hit.id,
                  name: hit.name,
                  phone: hit.phone,
                  reason: hit.reason,
                  operator_name: hit.operator_name,
                  created_at: hit.created_at
                }
              }
            },
            409
          );
        }
      }

      if (customer && customer.id !== order.customer_id) {
        customerId = customer.id;
      } else if (!customer && body.customer_phone) {
        customerId = generateId();
        stmts.push({
          sql: 'INSERT INTO customers (id, name, phone, id_card, license_number, id_card_images, license_images, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
          params: [
            customerId,
            body.customer_name,
            body.customer_phone,
            body.customer_id_card ?? null,
            body.customer_license ?? null,
            serializeImages(body.id_card_images),
            serializeImages(body.license_images),
            currentTime,
            currentTime
          ]
        });
      }

      // 更新客户信息
      stmts.push({
        sql: 'UPDATE customers SET name = ?, phone = ?, id_card = ?, license_number = ?, id_card_images = ?, license_images = ?, updated_at = ? WHERE id = ?',
        params: [
          body.customer_name,
          body.customer_phone,
          body.customer_id_card ?? null,
          body.customer_license ?? null,
          serializeImages(body.id_card_images),
          serializeImages(body.license_images),
          currentTime,
          customerId
        ]
      });
    }

    // 处理车辆更换（仅在待确认状态可以换车）
    let plateNumber = order.plate_number;
    if (body.vehicle_id && body.vehicle_id !== order.vehicle_id) {
      if (order.status !== 'pending') {
        return c.json({ success: false, message: '进行中的订单不能更换车辆' }, 400);
      }

      const newVehicle = await queryOne<{ id: string; status: string; plate_number: string }>(
        db,
        'SELECT id, status, plate_number FROM vehicles WHERE id = ?',
        [body.vehicle_id]
      );
      if (!newVehicle) {
        return c.json({ success: false, message: '车辆不存在' }, 400);
      }
      if (newVehicle.status === 'maintenance' || newVehicle.status === 'unavailable') {
        return c.json({ success: false, message: '该车辆当前处于维修或不可用状态' }, 400);
      }
      // 换车时同步车牌快照，否则列表会一直显示旧车牌
      plateNumber = newVehicle.plate_number;

      // 检查新车辆在订单时间段是否可用
      const startDate = body.start_date || order.start_date;
      const endDate = body.end_date || order.end_date;
      const conflictingOrder = await queryOne<{ id: string }>(
        db,
        `SELECT id FROM orders
         WHERE vehicle_id = ?
           AND id != ?
           AND status NOT IN ('cancelled', 'completed')
           AND (
             (start_date <= ? AND end_date > ?)
             OR (start_date < ? AND end_date >= ?)
             OR (start_date >= ? AND end_date <= ?)
           )`,
        [body.vehicle_id, id, startDate, startDate, endDate, endDate, startDate, endDate]
      );

      if (conflictingOrder) {
        return c.json({ success: false, message: '该车辆在订单时间段内已被预约' }, 400);
      }
    }

    // 计算天数
    const startDate = body.start_date || order.start_date;
    const endDate = body.end_date || order.end_date;
    const days = calcRentalDays(startDate, endDate);

    // 计算总金额：如果提供了总租金则使用，否则按日租金计算
    let totalAmount = body.total_amount;
    let finalDailyRate = body.daily_rate !== undefined ? body.daily_rate : order.daily_rate;

    if (!totalAmount && finalDailyRate) {
      totalAmount = days * finalDailyRate;
    }

    // 如果只有总租金，反推日租金
    if (totalAmount && !finalDailyRate) {
      finalDailyRate = calcDailyRate(totalAmount, days);
    }

    // 处理订单来源变化
    let sourceId = body.source_id === undefined ? order.source_id : body.source_id;
    let sourceName = order.source_name;
    let commissionRate = order.commission_rate || 0;

    if (body.source_id !== undefined) {
      if (body.source_id) {
        const source = await queryOne<{ name: string; commission_rate: number }>(
          db,
          'SELECT name, commission_rate FROM order_sources WHERE id = ? AND status = 1',
          [body.source_id]
        );
        if (source) {
          sourceName = source.name;
          commissionRate = source.commission_rate || 0;
        }
      } else {
        sourceId = null;
        sourceName = null;
        commissionRate = 0;
      }
    }

    // 重新计算到账金额
    const netAmount = calcNetAmount(totalAmount ?? 0, commissionRate);

    // 处理免押相关
    const isDepositWaived = body.deposit_waived ? 1 : 0;
    const finalDeposit = isDepositWaived ? 0 : body.deposit !== undefined ? body.deposit : order.deposit;
    const depositWaivedExpiry = isDepositWaived ? body.deposit_waived_expiry ?? null : null;

    stmts.push({
      sql: `UPDATE orders SET
        customer_id = ?, vehicle_id = ?, plate_number = ?, source_id = ?, source_name = ?, commission_rate = ?,
        start_date = ?, end_date = ?, daily_rate = ?, total_amount = ?, net_amount = ?,
        deposit = ?, deposit_waived = ?, deposit_waived_expiry = ?, service_type = ?,
        contract_number = ?, pickup_location = ?, return_location = ?, remarks = ?,
        invoice_amount = ?, invoice_status = ?, settle_status = ?, settle_remarks = ?,
        updated_at = ?
       WHERE id = ?`,
      params: [
        customerId,
        body.vehicle_id || order.vehicle_id,
        plateNumber,
        sourceId,
        sourceName,
        commissionRate,
        startDate,
        endDate,
        finalDailyRate || 0,
        totalAmount,
        netAmount,
        finalDeposit,
        isDepositWaived,
        depositWaivedExpiry,
        body.service_type || order.service_type,
        body.contract_number ?? order.contract_number,
        body.pickup_location !== undefined ? body.pickup_location : order.pickup_location,
        body.return_location !== undefined ? body.return_location : order.return_location,
        body.remarks ?? order.remarks,
        body.invoice_amount !== undefined ? roundMoney(toAmount(body.invoice_amount)) : order.invoice_amount,
        oneOf(body.invoice_status, INVOICE_STATUSES) ? body.invoice_status : order.invoice_status,
        oneOf(body.settle_status, SETTLE_STATUSES) ? body.settle_status : order.settle_status,
        body.settle_remarks !== undefined ? body.settle_remarks : order.settle_remarks,
        currentTime,
        id
      ]
    });

    await batchExecute(db, stmts);

    // 改价 / 改费率 / 换车 / 改来源都会影响结算口径，同步重算一次。
    // 改还车时间也可能改变归属月份，但结算期是生成时人工选定的，这里不动 period。
    // totalAmount 为 undefined 表示本次请求没带总额（不是「改成 0」），按不变处理
    const effectiveTotal = totalAmount ?? order.total_amount;
    if (
      effectiveTotal !== order.total_amount ||
      commissionRate !== (order.commission_rate || 0) ||
      (body.vehicle_id || order.vehicle_id) !== order.vehicle_id
    ) {
      const currentTime = now();
      await batchExecute(db, [
        await buildSettlementRefresh(
          db,
          id,
          { vehicle_id: body.vehicle_id || order.vehicle_id, commission_rate: commissionRate },
          effectiveTotal,
          currentTime
        )
      ]);
    }

    return c.json({
      success: true,
      data: { total_amount: totalAmount, net_amount: netAmount, days },
      message: '订单更新成功'
    });
  } catch (error) {
    return handleError(c, '更新订单错误:', error);
  }
}

// 续租订单
export async function extendOrder(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';
    const { new_end_date, extend_amount, has_payment, payment_amount, payment_method } = await c.req.json<{
      new_end_date?: string;
      extend_amount?: number;
      has_payment?: boolean;
      payment_amount?: number;
      payment_method?: string;
    }>();

    if (!new_end_date) {
      return c.json({ success: false, message: '新的还车时间不能为空' }, 400);
    }

    if (extend_amount === undefined || extend_amount < 0) {
      return c.json({ success: false, message: '续租金额不能为空' }, 400);
    }

    const order = await queryOne<OrderWithPlate>(db, ORDER_WITH_PLATE_SQL, [id]);
    if (!order) {
      return c.json({ success: false, message: '订单不存在' }, 404);
    }

    // 只有已取车状态可以续租
    if (order.status !== 'active') {
      return c.json({ success: false, message: '只有已取车的订单可以续租' }, 400);
    }

    // 检查新还车时间必须晚于当前还车时间
    const currentEndDate = new Date(order.end_date);
    const newEndDateObj = new Date(new_end_date);

    if (newEndDateObj <= currentEndDate) {
      return c.json({ success: false, message: '新的还车时间必须晚于当前还车时间' }, 400);
    }

    const currentTime = now();

    // 计算续租天数（按小时精确计算，向上取整）
    const extendDays = calcRentalDays(order.end_date, new_end_date);

    // 使用传入的续租金额
    const newTotalAmount = order.total_amount + extend_amount;

    // 重新计算到账金额
    const commissionRate = order.commission_rate || 0;
    const newNetAmount = calcNetAmount(newTotalAmount, commissionRate);

    // 计算新的已付金额
    let newPaidAmount = order.paid_amount || 0;
    const hasPayment = Boolean(has_payment && (payment_amount ?? 0) > 0);
    if (hasPayment) {
      newPaidAmount += payment_amount ?? 0;
    }

    const extendPaymentId = generateId();
    const extendAccountId = hasPayment && payment_method ? await resolveAccountIdByMethod(db, payment_method) : null;

    // 续租留痕：原来只改 end_date 累加金额，看不出一张单续过几次
    const stmts: Stmt[] = [
      {
        sql: 'UPDATE orders SET end_date = ?, total_amount = ?, net_amount = ?, paid_amount = ?, updated_at = ? WHERE id = ?',
        params: [new_end_date, newTotalAmount, newNetAmount, newPaidAmount, currentTime, id]
      },
      {
        sql: `INSERT INTO order_extensions (id, order_id, original_end_date, new_end_date, extend_days, extend_amount, payment_method, operator_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          generateId(),
          id,
          order.end_date,
          new_end_date,
          extendDays,
          extend_amount,
          hasPayment ? (payment_method ?? null) : null,
          getAuthUser(c)?.id ?? null,
          currentTime
        ]
      }
    ];

    // 如果有支付，添加支付记录 + 资金流水
    if (hasPayment && payment_method) {
      stmts.push({
        sql: 'INSERT INTO payments (id, order_id, amount, payment_method, payment_type, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [extendPaymentId, id, payment_amount ?? 0, payment_method, 'rent', '续租支付', currentTime]
      });
      pushFundTxn(
        stmts,
        {
          accountId: extendAccountId,
          txnDate: today(),
          direction: 'in',
          amount: payment_amount ?? 0,
          category: 'rent',
          sourceType: 'extension',
          sourceId: extendPaymentId,
          sourceKind: 'rent_in',
          counterparty: order.plate_number,
          summary: `续租收款 ${order.order_no}`
        },
        { operatorId: getAuthUser(c)?.id ?? null, currentTime }
      );
    }

    // 续租改了总额，结算行的系统口径同步跟上
    stmts.push(
      await buildSettlementRefresh(
        db,
        id,
        { vehicle_id: order.vehicle_id, commission_rate: commissionRate },
        newTotalAmount,
        currentTime
      )
    );

    await batchExecute(db, stmts);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '续租订单',
      entityType: 'order',
      entityId: id,
      details: `订单 ${order.order_no} 续租 ${extendDays} 天，金额：${extend_amount}，车辆：${order.plate_number || ''}`,
      ipAddress: getClientIp(c)
    });

    return c.json({
      success: true,
      data: {
        new_end_date,
        extend_days: extendDays,
        extend_amount,
        new_total_amount: newTotalAmount,
        new_net_amount: newNetAmount,
        new_paid_amount: newPaidAmount
      },
      message: '续租成功'
    });
  } catch (error) {
    return handleError(c, '续租订单错误:', error);
  }
}

// 添加支付记录
export async function addPayment(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';
    const { amount, payment_method, payment_type, remarks } = await c.req.json<{
      amount?: number;
      payment_method?: string;
      payment_type?: string;
      remarks?: string;
    }>();

    if (!amount || !payment_method || !payment_type) {
      return c.json({ success: false, message: '金额、支付方式和支付类型不能为空' }, 400);
    }

    const order = await queryOne<OrderWithPlate>(db, ORDER_WITH_PLATE_SQL, [id]);
    if (!order) {
      return c.json({ success: false, message: '订单不存在' }, 404);
    }

    const paymentId = generateId();
    const currentTime = now();
    const newPaidAmount = (order.paid_amount || 0) + amount;
    const accountId = await resolveAccountIdByMethod(db, payment_method);

    // 支付记录、订单已付金额、费用明细必须同时生效
    await batchExecute(db, [
      {
        sql: 'INSERT INTO payments (id, order_id, amount, payment_method, payment_type, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [paymentId, id, amount, payment_method, payment_type, remarks ?? null, currentTime]
      },
      {
        sql: 'UPDATE orders SET paid_amount = ?, updated_at = ? WHERE id = ?',
        params: [newPaidAmount, currentTime, id]
      },
      {
        sql: `INSERT INTO order_fees (id, order_id, fee_category, fee_name, receivable, received, refunded, created_at)
              VALUES (?, ?, ?, ?, 0, ?, 0, ?)`,
        params: [
          generateId(),
          id,
          PAYMENT_TYPE_FEE_CATEGORY[payment_type] ?? 'other',
          PAYMENT_TYPE_TEXT[payment_type] ?? payment_type,
          amount,
          currentTime
        ]
      },
      ...(() => {
        // 资金流水与支付记录同批写入：宁可整笔记账失败，也不允许出现「有收款无流水」。
        // 账户未配置时 pushFundTxn 会跳过，不会把整笔业务带崩。
        const flows: Stmt[] = [];
        pushFundTxn(
          flows,
          {
            accountId,
            txnDate: today(),
            direction: 'in',
            amount,
            category: PAYMENT_TXN_CATEGORY[payment_type] ?? 'other',
            sourceType: 'payment',
            sourceId: paymentId,
            sourceKind: PAYMENT_TXN_SLOT[payment_type] ?? 'other_in',
            counterparty: order.plate_number,
            summary: `订单 ${order.order_no} 收款（${PAYMENT_TYPE_TEXT[payment_type] ?? payment_type}）`,
            remarks: remarks ?? null
          },
          { operatorId: getAuthUser(c)?.id ?? null, currentTime }
        );
        return flows;
      })()
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '添加支付',
      entityType: 'order',
      entityId: id,
      details: `订单 ${order.order_no} 添加支付记录：${amount} 元，类型：${payment_type}`,
      ipAddress: getClientIp(c)
    });

    return c.json({
      success: true,
      data: { id: paymentId, amount, new_paid_amount: newPaidAmount },
      message: '支付记录添加成功'
    });
  } catch (error) {
    return handleError(c, '添加支付记录错误:', error);
  }
}

/**
 * 指派司机。平台导出给的是人名，可能不是本系统用户，
 * 所以 id 与 name 分开存：匹配得上就关联，匹配不上只留名字。
 */
export async function assignDrivers(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const body = await c.req.json<{ pickup_driver_id?: string | null; return_driver_id?: string | null }>();

    const order = await queryOne<OrderWithPlate>(db, ORDER_WITH_PLATE_SQL, [id]);
    if (!order) {
      return c.json({ success: false, message: '订单不存在' }, 404);
    }

    const [pickupDriver, returnDriver] = await Promise.all([
      body.pickup_driver_id
        ? queryOne<{ id: string; name: string }>(db, 'SELECT id, name FROM users WHERE id = ?', [body.pickup_driver_id])
        : Promise.resolve(null),
      body.return_driver_id
        ? queryOne<{ id: string; name: string }>(db, 'SELECT id, name FROM users WHERE id = ?', [body.return_driver_id])
        : Promise.resolve(null)
    ]);

    if (body.pickup_driver_id && !pickupDriver) {
      return c.json({ success: false, message: '取车司机不存在' }, 400);
    }
    if (body.return_driver_id && !returnDriver) {
      return c.json({ success: false, message: '还车司机不存在' }, 400);
    }

    // 未传该字段时保持原值，显式传 null 表示清空
    const pickupId = body.pickup_driver_id === undefined ? order.pickup_driver_id : body.pickup_driver_id;
    const pickupName = body.pickup_driver_id === undefined ? order.pickup_driver_name : pickupDriver?.name ?? null;
    const returnId = body.return_driver_id === undefined ? order.return_driver_id : body.return_driver_id;
    const returnName = body.return_driver_id === undefined ? order.return_driver_name : returnDriver?.name ?? null;

    await execute(
      db,
      `UPDATE orders SET pickup_driver_id = ?, pickup_driver_name = ?, return_driver_id = ?, return_driver_name = ?, updated_at = ? WHERE id = ?`,
      [pickupId, pickupName, returnId, returnName, now(), id]
    );

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '指派司机',
      entityType: 'order',
      entityId: id,
      details: `订单 ${order.order_no} 指派司机：取车 ${pickupName ?? '未指派'}，还车 ${returnName ?? '未指派'}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '司机指派成功' });
  } catch (error) {
    return handleError(c, '指派司机错误:', error);
  }
}

// 删除订单（支付、费用、续租记录随外键级联删除）
export async function deleteOrder(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';
    const order = await queryOne<OrderWithPlate>(db, ORDER_WITH_PLATE_SQL, [id]);

    if (!order) {
      return c.json({ success: false, message: '订单不存在' }, 404);
    }

    // 删单会动到取车日所属结算期与各笔收款的账期，锁月时一律拒绝
    const txns = await loadOrderTxnRows(db, id);
    const locked = await findFirstLockedPeriod(db, [order.start_date, ...txns.map((txn) => txn.txn_date)]);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法删除该订单` }, 400);
    }

    const currentTime = now();
    // payments / order_fees / order_extensions 都是 CASCADE，删订单就一并没了，
    // 所以流水必须在 DELETE 之前读出来写红字，否则历史现金流会被静默抹掉
    const stmts: Stmt[] = [
      ...buildReverseStmts(txns, `订单 ${order.order_no} 删除`, {
        operatorId: getAuthUser(c)?.id ?? null,
        currentTime
      }),
      buildSettlementVoidStmt(id, `订单 ${order.order_no} 删除`, currentTime),
      { sql: 'DELETE FROM orders WHERE id = ?', params: [id] }
    ];
    await batchExecute(db, stmts);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '删除订单',
      entityType: 'order',
      entityId: id,
      details: `删除订单 ${order.order_no}，车辆：${order.plate_number || ''}${
        txns.length ? `（同批冲销 ${txns.length} 条收款流水）` : ''
      }`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '订单删除成功' });
  } catch (error) {
    return handleError(c, '删除订单错误:', error);
  }
}

// 取消订单
export async function cancelOrder(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id') ?? '';
    const { remarks, cancel_reason } = await c.req.json<{ remarks?: string; cancel_reason?: string }>();

    const order = await queryOne<OrderWithPlate>(db, ORDER_WITH_PLATE_SQL, [id]);
    if (!order) {
      return c.json({ success: false, message: '订单不存在' }, 404);
    }

    if (order.status !== 'pending' && order.status !== 'active') {
      return c.json({ success: false, message: '只能取消待确认或进行中的订单' }, 400);
    }

    // 取消会动到取车日所属结算期
    const locked = await findPeriodLock(db, order.start_date);
    if (locked) {
      return c.json({ success: false, message: `账期 ${locked} 已锁定，无法取消该订单` }, 400);
    }

    const currentTime = now();
    // 只作废结算行，**不动现金流水**：钱确实收过，退钱要单独走退款动作。
    // 直接冲销会让「收过又退过」变成「没收过」，账目反而看不清。
    await batchExecute(db, [
      {
        sql: `UPDATE orders SET status = 'cancelled', remarks = ?, cancel_reason = ?, cancelled_at = ?, updated_at = ? WHERE id = ?`,
        params: [remarks ?? order.remarks, cancel_reason ?? null, currentTime, currentTime, id]
      },
      buildSettlementVoidStmt(id, '订单取消', currentTime)
    ]);

    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: '取消订单',
      entityType: 'order',
      entityId: id,
      details: `取消订单 ${order.order_no}，车辆：${order.plate_number || ''}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '订单取消成功' });
  } catch (error) {
    return handleError(c, '取消订单错误:', error);
  }
}
