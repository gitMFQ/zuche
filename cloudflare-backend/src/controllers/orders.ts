import { Env, query, queryOne, execute, queryWithPagination } from '../db/index.js';
import { generateUuid, errorResponse, successResponse, logAction } from '../utils/helpers.js';

// Order status mapping
const STATUS_MAP: Record<string, string> = {
  pending: '待取车',
  active: '已取车',
  completed: '已还车',
  cancelled: '已取消',
  overdue: '已逾期'
};

// Get orders list
export async function getOrdersController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 10;
    const keyword = params.keyword || '';
    const status = params.status || '';
    const customer_id = params.customer_id || '';
    const vehicle_id = params.vehicle_id || '';
    const start_date_from = params.start_date_from || '';
    const start_date_to = params.start_date_to || '';
    const end_date_from = params.end_date_from || '';
    const end_date_to = params.end_date_to || '';
    const source_id = params.source_id || '';
    const vehicle_model = params.vehicle_model || '';
    const plate_number = params.plate_number || '';
    const order_by = params.order_by || '';

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
    const queryParams: any[] = [];

    if (keyword) {
      sql += ' AND (o.order_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR v.plate_number LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      queryParams.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) {
      sql += ' AND o.status = ?';
      queryParams.push(status);
    }

    if (customer_id) {
      sql += ' AND o.customer_id = ?';
      queryParams.push(customer_id);
    }

    if (vehicle_id) {
      sql += ' AND o.vehicle_id = ?';
      queryParams.push(vehicle_id);
    }

    if (start_date_from) {
      sql += ' AND o.start_date >= ?';
      queryParams.push(`${start_date_from} 00:00:00`);
    }
    if (start_date_to) {
      sql += ' AND o.start_date <= ?';
      queryParams.push(`${start_date_to} 23:59:59`);
    }

    if (end_date_from) {
      sql += ' AND o.end_date >= ?';
      queryParams.push(`${end_date_from} 00:00:00`);
    }
    if (end_date_to) {
      sql += ' AND o.end_date <= ?';
      queryParams.push(`${end_date_to} 23:59:59`);
    }

    if (source_id) {
      sql += ' AND o.source_id = ?';
      queryParams.push(source_id);
    }

    if (vehicle_model) {
      sql += ' AND (v.brand LIKE ? OR v.model LIKE ?)';
      const likeModel = `%${vehicle_model}%`;
      queryParams.push(likeModel, likeModel);
    }

    if (plate_number) {
      sql += ' AND v.plate_number LIKE ?';
      queryParams.push(`%${plate_number}%`);
    }

    // Sorting
    if (order_by) {
      switch (order_by) {
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
          sql += ' ORDER BY o.created_at DESC';
      }
    } else {
      if (status === 'pending') {
        sql += ' ORDER BY o.start_date ASC';
      } else if (status === 'active') {
        sql += ' ORDER BY o.end_date ASC';
      } else if (status === 'completed') {
        sql += ' ORDER BY o.actual_end_date DESC, o.updated_at DESC';
      } else {
        sql += ' ORDER BY o.created_at DESC';
      }
    }

    const result = await queryWithPagination(env.DB, sql, queryParams, page, pageSize);

    // Add status text
    result.data = result.data.map((o: any) => ({
      ...o,
      status_text: STATUS_MAP[o.status] || o.status
    }));

    return successResponse(result);
  } catch (error) {
    console.error('Get orders error:', error);
    return errorResponse('获取订单列表失败', 500);
  }
}

// Get single order
export async function getOrderController(request: Request, env: Env, userId?: string, orderId?: string): Promise<Response> {
  try {
    if (!orderId) {
      return errorResponse('订单ID不能为空');
    }

    const order: any = await queryOne(
      env.DB,
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
      [orderId]
    );

    if (!order) {
      return errorResponse('订单不存在', 404);
    }

    // Parse images
    let idCardImages = [], licenseImages = [];
    try { idCardImages = order.id_card_images ? JSON.parse(order.id_card_images) : []; } catch {}
    try { licenseImages = order.license_images ? JSON.parse(order.license_images) : []; } catch {}

    // Get payments
    const payments = await query(env.DB, 'SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC', [orderId]);

    return successResponse({
      ...order,
      id_card_images: idCardImages,
      license_images: licenseImages,
      status_text: STATUS_MAP[order.status] || order.status,
      payments
    });
  } catch (error) {
    console.error('Get order error:', error);
    return errorResponse('获取订单信息失败', 500);
  }
}

// Create order
export async function createOrderController(request: Request, env: Env, operatorId?: string): Promise<Response> {
  try {
    const body = await request.json();
    const {
      customer_name, customer_phone, customer_id_card, customer_license,
      id_card_images, license_images,
      vehicle_id, start_date, end_date,
      daily_rate, deposit, total_amount, remarks,
      source_id, service_type,
      deposit_waived, deposit_waived_expiry,
      contract_number,
      pickup_location, return_location,
      has_prepay, prepay_amount, prepay_method, prepay_type
    } = body;

    // Validation
    if (!customer_name || !customer_phone || !vehicle_id || !start_date || !end_date) {
      return errorResponse('客户姓名、手机号、车辆、起止日期不能为空');
    }

    if (!daily_rate && !total_amount) {
      return errorResponse('日租金和总租金至少填写一项');
    }

    // Phone validation
    if (!/^1[3-9]\d{9}$/.test(customer_phone)) {
      return errorResponse('手机号格式不正确');
    }

    // Check vehicle exists
    const vehicle: any = await queryOne(env.DB, 'SELECT * FROM vehicles WHERE id = ?', [vehicle_id]);
    if (!vehicle) {
      return errorResponse('车辆不存在');
    }

    // Check vehicle status
    if (['maintenance', 'unavailable'].includes(vehicle.status)) {
      return errorResponse('车辆当前处于维修或不可用状态');
    }

    // Check vehicle availability
    const conflictingOrder: any = await queryOne(
      env.DB,
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
      return errorResponse('该车辆在指定时间段内已被预约');
    }

    // Find or create customer
    let customer: any = await queryOne(env.DB, 'SELECT id FROM customers WHERE phone = ?', [customer_phone]);
    let customerId: string;

    if (customer) {
      customerId = customer.id;
      const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
      await execute(
        env.DB,
        'UPDATE customers SET name = ?, id_card = ?, license_number = ?, id_card_images = ?, license_images = ?, updated_at = ? WHERE id = ?',
        [
          customer_name,
          customer_id_card || null,
          customer_license || null,
          id_card_images ? JSON.stringify(id_card_images) : null,
          license_images ? JSON.stringify(license_images) : null,
          currentTime,
          customerId
        ]
      );
    } else {
      customerId = generateUuid();
      const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
      await execute(
        env.DB,
        'INSERT INTO customers (id, name, phone, id_card, license_number, id_card_images, license_images, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
        [
          customerId,
          customer_name,
          customer_phone,
          customer_id_card || null,
          customer_license || null,
          id_card_images ? JSON.stringify(id_card_images) : null,
          license_images ? JSON.stringify(license_images) : null,
          currentTime,
          currentTime
        ]
      );
    }

    // Calculate days
    const start = new Date(start_date);
    const end = new Date(end_date);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const days = Math.max(1, Math.ceil(hours / 24));

    // Calculate total amount
    let totalAmount = total_amount;
    let finalDailyRate = daily_rate;

    if (!totalAmount && daily_rate) {
      totalAmount = days * daily_rate;
    }

    if (totalAmount && !daily_rate) {
      finalDailyRate = Math.round(totalAmount / days);
    }

    // Calculate commission and net amount
    let commissionRate = 0;
    let netAmount = totalAmount;
    if (source_id) {
      const source: any = await queryOne(env.DB, 'SELECT * FROM order_sources WHERE id = ? AND status = 1', [source_id]);
      if (source) {
        commissionRate = source.commission_rate || 0;
        netAmount = totalAmount * (1 - commissionRate / 100);
      }
    }

    const id = generateUuid();
    const orderNo = 'ORD' + Date.now() + Math.random().toString(36).slice(2, 8).toUpperCase();
    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    // Handle deposit waiver
    const isDepositWaived = deposit_waived ? 1 : 0;
    const finalDeposit = isDepositWaived ? 0 : (deposit || 0);
    const depositWaivedExpiry = isDepositWaived ? deposit_waived_expiry : null;

    // Handle prepay
    const initialPaidAmount = (has_prepay && prepay_amount > 0) ? prepay_amount : 0;

    // Create order
    await execute(
      env.DB,
      `INSERT INTO orders (id, order_no, customer_id, vehicle_id, user_id, start_date, end_date, daily_rate, deposit, total_amount, paid_amount, status, remarks, source_id, commission_rate, net_amount, service_type, deposit_waived, deposit_waived_expiry, contract_number, pickup_location, return_location, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orderNo, customerId, vehicle_id, operatorId || null, start_date, end_date, finalDailyRate || 0, finalDeposit, totalAmount, initialPaidAmount, remarks || null, source_id || null, commissionRate, netAmount, service_type || 'basic', isDepositWaived, depositWaivedExpiry, contract_number || null, pickup_location || null, return_location || null, currentTime, currentTime]
    );

    // Add payment record if prepay
    if (has_prepay && prepay_amount > 0 && prepay_method && prepay_type) {
      const paymentId = generateUuid();
      await execute(
        env.DB,
        'INSERT INTO payments (id, order_id, amount, payment_method, payment_type, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [paymentId, id, prepay_amount, prepay_method, prepay_type, '下单时预付', currentTime]
      );
    }

    // Log action
    await logAction(env.DB, operatorId || null, '创建订单', 'order', id, `创建订单 ${orderNo}，客户：${customer_name}，车辆：${vehicle.plate_number}`);

    return successResponse(
      { id, order_no: orderNo, total_amount: totalAmount, net_amount: netAmount, commission_rate: commissionRate, days, customer_id: customerId, paid_amount: initialPaidAmount },
      '订单创建成功'
    );
  } catch (error) {
    console.error('Create order error:', error);
    return errorResponse('创建订单失败', 500);
  }
}

// Update order status
export async function updateOrderStatusController(request: Request, env: Env, operatorId?: string, orderId?: string): Promise<Response> {
  try {
    if (!orderId) {
      return errorResponse('订单ID不能为空');
    }

    const body = await request.json();
    const { status, actual_end_date, remarks, pickup_mileage, return_mileage, pickup_image, return_image } = body;

    const order: any = await queryOne(env.DB, 'SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return errorResponse('订单不存在', 404);
    }

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    // Update vehicle mileage on return
    if (status === 'completed' && return_mileage !== undefined && return_mileage !== null) {
      await execute(env.DB, 'UPDATE vehicles SET mileage = ?, updated_at = ? WHERE id = ?', [return_mileage, currentTime, order.vehicle_id]);
    }

    // Calculate actual amount
    let totalAmount = order.total_amount;
    if (actual_end_date && status === 'completed') {
      const start = new Date(order.start_date);
      const end = new Date(actual_end_date);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const days = Math.max(1, Math.ceil(hours / 24));
      totalAmount = days * order.daily_rate;
    }

    // Build update SQL
    let updateSql = 'UPDATE orders SET status = ?, actual_end_date = ?, total_amount = ?, remarks = ?, updated_at = ?';
    const updateParams: any[] = [status, actual_end_date || null, totalAmount, remarks || order.remarks, currentTime];

    if (status === 'active') {
      if (pickup_mileage !== undefined && pickup_mileage !== null) {
        updateSql += ', pickup_mileage = ?';
        updateParams.push(pickup_mileage);
      }
      if (pickup_image) {
        updateSql += ', pickup_image = ?';
        updateParams.push(pickup_image);
      }
    }

    if (status === 'completed') {
      if (return_mileage !== undefined && return_mileage !== null) {
        updateSql += ', return_mileage = ?';
        updateParams.push(return_mileage);
      }
      if (return_image) {
        updateSql += ', return_image = ?';
        updateParams.push(return_image);
      }
    }

    updateSql += ' WHERE id = ?';
    updateParams.push(orderId);

    await execute(env.DB, updateSql, updateParams);

    // Log action
    const statusText = STATUS_MAP[status] || status;
    const vehicle: any = await queryOne(env.DB, 'SELECT plate_number FROM vehicles WHERE id = ?', [order.vehicle_id]);
    await logAction(env.DB, operatorId || null, statusText, 'order', orderId, `订单 ${order.order_no} 状态变更为${statusText}，车辆：${vehicle?.plate_number || ''}`);

    return successResponse(null, '订单状态更新成功');
  } catch (error) {
    console.error('Update order status error:', error);
    return errorResponse('更新订单状态失败', 500);
  }
}

// Update order
export async function updateOrderController(request: Request, env: Env, operatorId?: string, orderId?: string): Promise<Response> {
  try {
    if (!orderId) {
      return errorResponse('订单ID不能为空');
    }

    const body = await request.json();
    const {
      customer_name, customer_phone, customer_id_card, customer_license,
      id_card_images, license_images,
      vehicle_id, source_id, start_date, end_date,
      daily_rate, total_amount, deposit, remarks,
      service_type, deposit_waived, deposit_waived_expiry,
      contract_number,
      pickup_location, return_location
    } = body;

    const order: any = await queryOne(env.DB, 'SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return errorResponse('订单不存在', 404);
    }

    // Only pending and active orders can be modified
    if (!['pending', 'active'].includes(order.status)) {
      return errorResponse('只能修改待确认或进行中的订单');
    }

    // Phone validation
    if (customer_phone && !/^1[3-9]\d{9}$/.test(customer_phone)) {
      return errorResponse('手机号格式不正确');
    }

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    // Handle customer info
    if (customer_name || customer_phone || customer_id_card || customer_license || id_card_images || license_images) {
      let customer: any = await queryOne(env.DB, 'SELECT id FROM customers WHERE phone = ?', [customer_phone || order.customer_phone]);
      let customerId = order.customer_id;

      if (customer && customer.id !== order.customer_id) {
        customerId = customer.id;
      } else if (!customer && customer_phone) {
        customerId = generateUuid();
        await execute(
          env.DB,
          'INSERT INTO customers (id, name, phone, id_card, license_number, id_card_images, license_images, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
          [
            customerId,
            customer_name,
            customer_phone,
            customer_id_card || null,
            customer_license || null,
            id_card_images ? JSON.stringify(id_card_images) : null,
            license_images ? JSON.stringify(license_images) : null,
            currentTime,
            currentTime
          ]
        );
      }

      if (customerId !== order.customer_id) {
        await execute(env.DB, 'UPDATE orders SET customer_id = ?, updated_at = ? WHERE id = ?', [customerId, currentTime, orderId]);
      }

      await execute(
        env.DB,
        'UPDATE customers SET name = ?, phone = ?, id_card = ?, license_number = ?, id_card_images = ?, license_images = ?, updated_at = ? WHERE id = ?',
        [
          customer_name,
          customer_phone,
          customer_id_card || null,
          customer_license || null,
          id_card_images ? JSON.stringify(id_card_images) : null,
          license_images ? JSON.stringify(license_images) : null,
          currentTime,
          customerId
        ]
      );
    }

    // Handle vehicle change (only for pending orders)
    if (vehicle_id && vehicle_id !== order.vehicle_id) {
      if (order.status === 'pending') {
        const newVehicle: any = await queryOne(env.DB, 'SELECT * FROM vehicles WHERE id = ?', [vehicle_id]);
        if (!newVehicle) {
          return errorResponse('车辆不存在');
        }
        if (['maintenance', 'unavailable'].includes(newVehicle.status)) {
          return errorResponse('该车辆当前处于维修或不可用状态');
        }

        const startDate = start_date || order.start_date;
        const endDate = end_date || order.end_date;
        const conflictingOrder: any = await queryOne(
          env.DB,
          `SELECT id FROM orders 
           WHERE vehicle_id = ? 
             AND id != ?
             AND status NOT IN ('cancelled', 'completed')
             AND (
               (start_date <= ? AND end_date > ?)
               OR (start_date < ? AND end_date >= ?)
               OR (start_date >= ? AND end_date <= ?)
             )`,
          [vehicle_id, orderId, startDate, startDate, endDate, endDate, startDate, endDate]
        );

        if (conflictingOrder) {
          return errorResponse('该车辆在订单时间段内已被预约');
        }
      } else {
        return errorResponse('进行中的订单不能更换车辆');
      }
    }

    // Calculate days
    const startDate = start_date || order.start_date;
    const endDate = end_date || order.end_date;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const days = Math.max(1, Math.ceil(hours / 24));

    // Calculate total amount
    let totalAmount = total_amount;
    let finalDailyRate = daily_rate !== undefined ? daily_rate : order.daily_rate;

    if (!totalAmount && finalDailyRate) {
      totalAmount = days * finalDailyRate;
    }

    if (totalAmount && !finalDailyRate) {
      finalDailyRate = Math.round(totalAmount / days);
    }

    // Handle source change
    let sourceId = source_id;
    let commissionRate = order.commission_rate || 0;

    if (source_id !== undefined) {
      if (source_id) {
        const source: any = await queryOne(env.DB, 'SELECT * FROM order_sources WHERE id = ? AND status = 1', [source_id]);
        if (source) {
          commissionRate = source.commission_rate || 0;
        }
      } else {
        sourceId = null;
        commissionRate = 0;
      }
    }

    // Recalculate net amount
    const netAmount = totalAmount * (1 - commissionRate / 100);

    // Handle deposit waiver
    const isDepositWaived = deposit_waived ? 1 : 0;
    const finalDeposit = isDepositWaived ? 0 : (deposit !== undefined ? deposit : order.deposit);
    const depositWaivedExpiry = isDepositWaived ? deposit_waived_expiry : null;

    // Update order
    await execute(
      env.DB,
      `UPDATE orders SET 
        vehicle_id = ?, source_id = ?, commission_rate = ?, 
        start_date = ?, end_date = ?, daily_rate = ?, total_amount = ?, net_amount = ?, 
        deposit = ?, deposit_waived = ?, deposit_waived_expiry = ?, service_type = ?, 
        contract_number = ?, pickup_location = ?, return_location = ?, remarks = ?, updated_at = ? 
       WHERE id = ?`,
      [
        vehicle_id || order.vehicle_id,
        sourceId, commissionRate,
        startDate, endDate,
        finalDailyRate || 0, totalAmount, netAmount,
        finalDeposit, isDepositWaived, depositWaivedExpiry, service_type || order.service_type,
        contract_number ?? order.contract_number,
        pickup_location !== undefined ? pickup_location : order.pickup_location,
        return_location !== undefined ? return_location : order.return_location,
        remarks ?? order.remarks, currentTime, orderId
      ]
    );

    return successResponse({ total_amount: totalAmount, net_amount: netAmount, days }, '订单更新成功');
  } catch (error) {
    console.error('Update order error:', error);
    return errorResponse('更新订单失败', 500);
  }
}

// Extend order
export async function extendOrderController(request: Request, env: Env, operatorId?: string, orderId?: string): Promise<Response> {
  try {
    if (!orderId) {
      return errorResponse('订单ID不能为空');
    }

    const body = await request.json();
    const { new_end_date, extend_amount, has_payment, payment_amount, payment_method } = body;

    if (!new_end_date) {
      return errorResponse('新的还车时间不能为空');
    }

    if (extend_amount === undefined || extend_amount < 0) {
      return errorResponse('续租金额不能为空');
    }

    const order: any = await queryOne(env.DB, 'SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return errorResponse('订单不存在', 404);
    }

    if (order.status !== 'active') {
      return errorResponse('只有已取车的订单可以续租');
    }

    const currentEndDate = new Date(order.end_date);
    const newEndDateObj = new Date(new_end_date);

    if (newEndDateObj <= currentEndDate) {
      return errorResponse('新的还车时间必须晚于当前还车时间');
    }

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    // Calculate extend days
    const hours = (newEndDateObj.getTime() - currentEndDate.getTime()) / (1000 * 60 * 60);
    const extendDays = Math.max(1, Math.ceil(hours / 24));

    const newTotalAmount = order.total_amount + extend_amount;

    // Recalculate net amount
    const commissionRate = order.commission_rate || 0;
    const newNetAmount = newTotalAmount * (1 - commissionRate / 100);

    let newPaidAmount = order.paid_amount || 0;
    if (has_payment && payment_amount > 0) {
      newPaidAmount += payment_amount;
    }

    // Update order
    await execute(
      env.DB,
      'UPDATE orders SET end_date = ?, total_amount = ?, net_amount = ?, paid_amount = ?, updated_at = ? WHERE id = ?',
      [new_end_date, newTotalAmount, newNetAmount, newPaidAmount, currentTime, orderId]
    );

    // Add payment record if needed
    if (has_payment && payment_amount > 0 && payment_method) {
      const paymentId = generateUuid();
      await execute(
        env.DB,
        'INSERT INTO payments (id, order_id, amount, payment_method, payment_type, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [paymentId, orderId, payment_amount, payment_method, 'rent', '续租支付', currentTime]
      );
    }

    // Log action
    const vehicle: any = await queryOne(env.DB, 'SELECT plate_number FROM vehicles WHERE id = ?', [order.vehicle_id]);
    await logAction(env.DB, operatorId || null, '续租订单', 'order', orderId, `订单 ${order.order_no} 续租 ${extendDays} 天，金额：${extend_amount}，车辆：${vehicle?.plate_number || ''}`);

    return successResponse(
      {
        new_end_date,
        extend_days: extendDays,
        extend_amount: extend_amount,
        new_total_amount: newTotalAmount,
        new_net_amount: newNetAmount,
        new_paid_amount: newPaidAmount
      },
      '续租成功'
    );
  } catch (error) {
    console.error('Extend order error:', error);
    return errorResponse('续租失败', 500);
  }
}

// Add payment
export async function addPaymentController(request: Request, env: Env, operatorId?: string, orderId?: string): Promise<Response> {
  try {
    if (!orderId) {
      return errorResponse('订单ID不能为空');
    }

    const body = await request.json();
    const { amount, payment_method, payment_type, remarks } = body;

    if (!amount || !payment_method || !payment_type) {
      return errorResponse('金额、支付方式和支付类型不能为空');
    }

    const order: any = await queryOne(env.DB, 'SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return errorResponse('订单不存在', 404);
    }

    const paymentId = generateUuid();
    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    // Add payment record
    await execute(
      env.DB,
      'INSERT INTO payments (id, order_id, amount, payment_method, payment_type, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [paymentId, orderId, amount, payment_method, payment_type, remarks || null, currentTime]
    );

    // Update order paid amount
    const newPaidAmount = (order.paid_amount || 0) + amount;
    await execute(env.DB, 'UPDATE orders SET paid_amount = ?, updated_at = ? WHERE id = ?', [newPaidAmount, currentTime, orderId]);

    // Log action
    await logAction(env.DB, operatorId || null, '添加支付', 'order', orderId, `订单 ${order.order_no} 添加支付记录：${amount} 元，类型：${payment_type}`);

    return successResponse(
      { id: paymentId, amount, new_paid_amount: newPaidAmount },
      '支付记录添加成功'
    );
  } catch (error) {
    console.error('Add payment error:', error);
    return errorResponse('添加支付记录失败', 500);
  }
}

// Cancel order
export async function cancelOrderController(request: Request, env: Env, operatorId?: string, orderId?: string): Promise<Response> {
  try {
    if (!orderId) {
      return errorResponse('订单ID不能为空');
    }

    const body = await request.json();
    const { remarks } = body;

    const order: any = await queryOne(env.DB, 'SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return errorResponse('订单不存在', 404);
    }

    if (!['pending', 'active'].includes(order.status)) {
      return errorResponse('只能取消待确认或进行中的订单');
    }

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    // Update order status
    await execute(
      env.DB,
      "UPDATE orders SET status = 'cancelled', remarks = ?, updated_at = ? WHERE id = ?",
      [remarks || order.remarks, currentTime, orderId]
    );

    // Log action
    const vehicle: any = await queryOne(env.DB, 'SELECT plate_number FROM vehicles WHERE id = ?', [order.vehicle_id]);
    await logAction(env.DB, operatorId || null, '取消订单', 'order', orderId, `取消订单 ${order.order_no}，车辆：${vehicle?.plate_number || ''}`);

    return successResponse(null, '订单取消成功');
  } catch (error) {
    console.error('Cancel order error:', error);
    return errorResponse('取消订单失败', 500);
  }
}
