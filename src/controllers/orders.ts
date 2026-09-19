import { type Bind, batchExecute, execute, query, queryOne, queryWithPagination, type Stmt } from '../db/helpers';
import type { OrderExtensionRow, OrderFeeRow, OrderRow } from '../db/rows';
import { generateId, generateOrderNo } from '../lib/ids';
import { handleError } from '../lib/errors';
import { logAction } from '../lib/log';
import { getAuthUser, getClientIp } from '../lib/request';
import { now } from '../lib/time';
import { PAYMENT_TYPE_FEE_CATEGORY, PAYMENT_TYPE_TEXT } from '../lib/constants';
import type { AppContext } from '../types';

// 订单状态映射
const STATUS_MAP: Record<string, string> = {
  pending: '待取车',
  active: '已取车',
  completed: '已还车',
  cancelled: '已取消',
  overdue: '已逾期'
};

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

/** 订单连同车辆车牌一起取出，避免写日志时再回查一次 */
const ORDER_WITH_PLATE_SQL = `
  SELECT o.*, v.plate_number
  FROM orders o
  LEFT JOIN vehicles v ON o.vehicle_id = v.id
  WHERE o.id = ?
`;

type OrderWithPlate = OrderRow & { plate_number: string | null };

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

// 获取订单列表
export async function getOrders(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const q = c.req.query();
    const page = Number(q.page ?? 1);
    const pageSize = Number(q.pageSize ?? 10);

    let sql = `
      SELECT o.*,
        c.name as customer_name, c.phone as customer_phone,
        v.plate_number, v.brand, v.model, v.is_new_energy,
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
           v.plate_number, v.brand, v.model, v.color, v.is_new_energy,
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
  has_prepay?: boolean;
  prepay_amount?: number;
  prepay_method?: string;
  prepay_type?: string;
}

// 创建订单（支持自动创建客户）
export async function createOrder(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const body = await c.req.json<CreateOrderBody>();
    const { customer_name, customer_phone, vehicle_id, start_date, end_date } = body;
    const { daily_rate, total_amount } = body;

    if (!customer_name || !customer_phone || !vehicle_id || !start_date || !end_date) {
      return c.json({ success: false, message: '客户姓名、手机号、车辆、起止日期不能为空' }, 400);
    }

    if (!daily_rate && !total_amount) {
      return c.json({ success: false, message: '日租金和总租金至少填写一项' }, 400);
    }

    // 验证手机号格式
    if (!PHONE_PATTERN.test(customer_phone)) {
      return c.json({ success: false, message: '手机号格式不正确' }, 400);
    }

    // 先把需要判断的数据全部读出来
    const [vehicle, existingCustomer, source] = await Promise.all([
      queryOne<{ id: string; status: string; plate_number: string }>(db, 'SELECT id, status, plate_number FROM vehicles WHERE id = ?', [vehicle_id]),
      queryOne<{ id: string }>(db, 'SELECT id FROM customers WHERE phone = ?', [customer_phone]),
      body.source_id
        ? queryOne<{ commission_rate: number }>(db, 'SELECT commission_rate FROM order_sources WHERE id = ? AND status = 1', [body.source_id])
        : Promise.resolve(null)
    ]);

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
    const start = new Date(start_date);
    const end = new Date(end_date);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const days = Math.max(1, Math.ceil(hours / 24));

    // 计算总金额：如果提供了总租金则使用，否则按日租金计算
    let totalAmount = total_amount;
    let finalDailyRate = daily_rate;

    if (!totalAmount && daily_rate) {
      totalAmount = days * daily_rate;
    }

    // 如果只有总租金，反推日租金
    if (totalAmount && !daily_rate) {
      finalDailyRate = Math.round(totalAmount / days);
    }

    // 计算到账金额（扣除平台服务费）
    const commissionRate = source?.commission_rate || 0;
    const netAmount = (totalAmount ?? 0) * (1 - commissionRate / 100);

    const id = generateId();
    const orderNo = generateOrderNo();
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
    const stmts: Stmt[] = [];

    if (existingCustomer) {
      stmts.push({
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
      });
    } else {
      stmts.push({
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
      });
    }

    stmts.push({
      sql: `INSERT INTO orders (id, order_no, customer_id, vehicle_id, user_id, start_date, end_date, daily_rate, deposit, total_amount, paid_amount, status, remarks, source_id, commission_rate, net_amount, service_type, deposit_waived, deposit_waived_expiry, contract_number, pickup_location, return_location, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        id,
        orderNo,
        customerId,
        vehicle_id,
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
        currentTime,
        currentTime
      ]
    });

    // 如果有预付，添加支付记录
    if (hasPrepay && body.prepay_method && body.prepay_type) {
      stmts.push({
        sql: 'INSERT INTO payments (id, order_id, amount, payment_method, payment_type, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [
          generateId(),
          id,
          body.prepay_amount ?? 0,
          body.prepay_method,
          body.prepay_type,
          '下单时预付',
          currentTime
        ]
      });
    }

    await batchExecute(db, stmts);

    await logAction(db, {
      userId: userId ?? '',
      action: '创建订单',
      entityType: 'order',
      entityId: id,
      details: `创建订单 ${orderNo}，客户：${customer_name}，车辆：${vehicle.plate_number}`,
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
    const id = c.req.param('id');
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

    const order = await queryOne<OrderWithPlate>(db, ORDER_WITH_PLATE_SQL, [id]);
    if (!order) {
      return c.json({ success: false, message: '订单不存在' }, 404);
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

    // 计算实际金额（如果有实际还车日期）
    let totalAmount = order.total_amount;
    if (body.actual_end_date && status === 'completed') {
      const start = new Date(order.start_date);
      const end = new Date(body.actual_end_date);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const days = Math.max(1, Math.ceil(hours / 24));
      totalAmount = days * order.daily_rate;
    }

    // 构建更新字段
    let updateSql = 'UPDATE orders SET status = ?, actual_end_date = ?, total_amount = ?, remarks = ?, updated_at = ?';
    const updateParams: Bind[] = [
      status,
      body.actual_end_date ?? null,
      totalAmount,
      body.remarks ?? order.remarks,
      currentTime
    ];

    // 取车时记录取车里程和图片
    if (status === 'active') {
      // 实际取车时间与还车时间对称，未传则取当前时间
      updateSql += ', actual_start_date = ?';
      updateParams.push(body.actual_start_date ?? currentTime);

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
    await batchExecute(db, stmts);

    const statusText = STATUS_MAP[status ?? ''] || status;
    await logAction(db, {
      userId: getAuthUser(c)?.id ?? '',
      action: statusText ?? '更新订单状态',
      entityType: 'order',
      entityId: id,
      details: `订单 ${order.order_no} 状态变更为${statusText}，车辆：${order.plate_number || ''}`,
      ipAddress: getClientIp(c)
    });

    return c.json({ success: true, message: '订单状态更新成功' });
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
}

// 更新订单信息
export async function updateOrder(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
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
      // 未传手机号时保持订单原有客户（customers.phone 非空，绑定 null 查不到任何记录）
      const customer = await queryOne<{ id: string }>(db, 'SELECT id FROM customers WHERE phone = ?', [
        body.customer_phone ?? null
      ]);

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
    if (body.vehicle_id && body.vehicle_id !== order.vehicle_id) {
      if (order.status !== 'pending') {
        return c.json({ success: false, message: '进行中的订单不能更换车辆' }, 400);
      }

      const newVehicle = await queryOne<{ id: string; status: string }>(
        db,
        'SELECT id, status FROM vehicles WHERE id = ?',
        [body.vehicle_id]
      );
      if (!newVehicle) {
        return c.json({ success: false, message: '车辆不存在' }, 400);
      }
      if (newVehicle.status === 'maintenance' || newVehicle.status === 'unavailable') {
        return c.json({ success: false, message: '该车辆当前处于维修或不可用状态' }, 400);
      }

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
    const start = new Date(startDate);
    const end = new Date(endDate);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const days = Math.max(1, Math.ceil(hours / 24));

    // 计算总金额：如果提供了总租金则使用，否则按日租金计算
    let totalAmount = body.total_amount;
    let finalDailyRate = body.daily_rate !== undefined ? body.daily_rate : order.daily_rate;

    if (!totalAmount && finalDailyRate) {
      totalAmount = days * finalDailyRate;
    }

    // 如果只有总租金，反推日租金
    if (totalAmount && !finalDailyRate) {
      finalDailyRate = Math.round(totalAmount / days);
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
    const netAmount = Math.round((totalAmount ?? 0) * (1 - commissionRate / 100));

    // 处理免押相关
    const isDepositWaived = body.deposit_waived ? 1 : 0;
    const finalDeposit = isDepositWaived ? 0 : body.deposit !== undefined ? body.deposit : order.deposit;
    const depositWaivedExpiry = isDepositWaived ? body.deposit_waived_expiry ?? null : null;

    stmts.push({
      sql: `UPDATE orders SET
        customer_id = ?, vehicle_id = ?, source_id = ?, source_name = ?, commission_rate = ?,
        start_date = ?, end_date = ?, daily_rate = ?, total_amount = ?, net_amount = ?,
        deposit = ?, deposit_waived = ?, deposit_waived_expiry = ?, service_type = ?,
        contract_number = ?, pickup_location = ?, return_location = ?, remarks = ?, updated_at = ?
       WHERE id = ?`,
      params: [
        customerId,
        body.vehicle_id || order.vehicle_id,
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
        currentTime,
        id
      ]
    });

    await batchExecute(db, stmts);

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
    const id = c.req.param('id');
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
    const hours = (newEndDateObj.getTime() - currentEndDate.getTime()) / (1000 * 60 * 60);
    const extendDays = Math.max(1, Math.ceil(hours / 24));

    // 使用传入的续租金额
    const newTotalAmount = order.total_amount + extend_amount;

    // 重新计算到账金额
    const commissionRate = order.commission_rate || 0;
    const newNetAmount = newTotalAmount * (1 - commissionRate / 100);

    // 计算新的已付金额
    let newPaidAmount = order.paid_amount || 0;
    const hasPayment = Boolean(has_payment && (payment_amount ?? 0) > 0);
    if (hasPayment) {
      newPaidAmount += payment_amount ?? 0;
    }

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

    // 如果有支付，添加支付记录
    if (hasPayment && payment_method) {
      stmts.push({
        sql: 'INSERT INTO payments (id, order_id, amount, payment_method, payment_type, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [generateId(), id, payment_amount ?? 0, payment_method, 'rent', '续租支付', currentTime]
      });
    }

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
    const id = c.req.param('id');
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
      }
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

// 取消订单
export async function cancelOrder(c: AppContext): Promise<Response> {
  const db = c.env.DB;
  try {
    const id = c.req.param('id');
    const { remarks, cancel_reason } = await c.req.json<{ remarks?: string; cancel_reason?: string }>();

    const order = await queryOne<OrderWithPlate>(db, ORDER_WITH_PLATE_SQL, [id]);
    if (!order) {
      return c.json({ success: false, message: '订单不存在' }, 404);
    }

    if (order.status !== 'pending' && order.status !== 'active') {
      return c.json({ success: false, message: '只能取消待确认或进行中的订单' }, 400);
    }

    const currentTime = now();
    await execute(
      db,
      `UPDATE orders SET status = 'cancelled', remarks = ?, cancel_reason = ?, cancelled_at = ?, updated_at = ? WHERE id = ?`,
      [remarks ?? order.remarks, cancel_reason ?? null, currentTime, currentTime, id]
    );

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
