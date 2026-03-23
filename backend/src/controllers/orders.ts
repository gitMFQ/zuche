import { Response } from 'express';
import { query, queryOne, execute, generateId, generateOrderNo, now, queryWithPagination, logAction } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 订单状态映射
const STATUS_MAP: Record<string, string> = {
  pending: '待取车',
  active: '已取车',
  completed: '已还车',
  cancelled: '已取消',
  overdue: '已逾期'
};

// 获取订单列表
export function getOrders(req: AuthRequest, res: Response): void {
  try {
    const { page = 1, pageSize = 10, keyword = '', status = '', customer_id = '', vehicle_id = '' } = req.query;
    
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
    const params: any[] = [];

    if (keyword) {
      sql += ' AND (o.order_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR v.plate_number LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) {
      sql += ' AND o.status = ?';
      params.push(status);
    }

    if (customer_id) {
      sql += ' AND o.customer_id = ?';
      params.push(customer_id);
    }

    if (vehicle_id) {
      sql += ' AND o.vehicle_id = ?';
      params.push(vehicle_id);
    }

    // 根据状态使用不同的排序
    if (status === 'pending') {
      // 待取车：按取车时间升序（近的在前）
      sql += ' ORDER BY o.start_date ASC';
    } else if (status === 'active') {
      // 待还车：按还车时间升序（近的在前）
      sql += ' ORDER BY o.end_date ASC';
    } else if (status === 'completed') {
      // 已完成：按还车完成时间降序（最近完成的在前）
      sql += ' ORDER BY o.actual_end_date DESC, o.updated_at DESC';
    } else {
      // 其他情况：按创建时间降序
      sql += ' ORDER BY o.created_at DESC';
    }

    const result = queryWithPagination(sql, params, Number(page), Number(pageSize));
    
    // 添加状态文本
    result.data = result.data.map((o: any) => ({
      ...o,
      status_text: STATUS_MAP[o.status] || o.status
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取订单列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取单个订单
export function getOrder(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const order = queryOne(`
      SELECT o.*, 
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
      WHERE o.id = ?
    `, [id]);

    if (!order) {
      res.status(404).json({ success: false, message: '订单不存在' });
      return;
    }

    // 解析图片 JSON
    if (order.id_card_images) {
      try {
        order.id_card_images = JSON.parse(order.id_card_images);
      } catch {
        order.id_card_images = [];
      }
    } else {
      order.id_card_images = [];
    }
    
    if (order.license_images) {
      try {
        order.license_images = JSON.parse(order.license_images);
      } catch {
        order.license_images = [];
      }
    } else {
      order.license_images = [];
    }

    // 获取支付记录
    const payments = query('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC', [id]);

    res.json({ 
      success: true, 
      data: { 
        ...order, 
        status_text: STATUS_MAP[order.status] || order.status,
        payments 
      } 
    });
  } catch (error) {
    console.error('获取订单错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 创建订单（支持自动创建客户）
export function createOrder(req: AuthRequest, res: Response): void {
  try {
    const { 
      // 客户信息（直接填写）
      customer_name, customer_phone, customer_id_card, customer_license,
      id_card_images, license_images,
      // 车辆和租期信息
      vehicle_id, start_date, end_date, 
      daily_rate, deposit, total_amount, remarks,
      // 订单来源
      source_id,
      // 服务类型：basic/premium/vip
      service_type,
      // 免押相关
      deposit_waived, deposit_waived_expiry,
      // 合同号
      contract_number,
      // 取还车位置
      pickup_location, return_location,
      // 预付相关
      has_prepay, prepay_amount, prepay_method, prepay_type
    } = req.body;

    // 验证必填字段（日租金和总租金至少填一个）
    if (!customer_name || !customer_phone || !vehicle_id || !start_date || !end_date) {
      res.status(400).json({ success: false, message: '客户姓名、手机号、车辆、起止日期不能为空' });
      return;
    }

    if (!daily_rate && !total_amount) {
      res.status(400).json({ success: false, message: '日租金和总租金至少填写一项' });
      return;
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(customer_phone)) {
      res.status(400).json({ success: false, message: '手机号格式不正确' });
      return;
    }

    // 检查车辆是否存在且非维修/不可用状态
    const vehicle = queryOne('SELECT * FROM vehicles WHERE id = ?', [vehicle_id]);
    if (!vehicle) {
      res.status(400).json({ success: false, message: '车辆不存在' });
      return;
    }
    
    // 检查车辆是否在维修中或不可用
    if (['maintenance', 'unavailable'].includes(vehicle.status)) {
      res.status(400).json({ success: false, message: '车辆当前处于维修或不可用状态' });
      return;
    }

    // 检查车辆在指定时间段内是否与其他订单冲突
    // 冲突条件：存在非取消状态的订单，其时间范围与新订单有交集
    const conflictingOrder = queryOne(`
      SELECT id FROM orders 
      WHERE vehicle_id = ? 
        AND status NOT IN ('cancelled', 'completed')
        AND (
          (start_date <= ? AND end_date > ?)
          OR (start_date < ? AND end_date >= ?)
          OR (start_date >= ? AND end_date <= ?)
        )
    `, [vehicle_id, start_date, start_date, end_date, end_date, start_date, end_date]);
    
    if (conflictingOrder) {
      res.status(400).json({ success: false, message: '该车辆在指定时间段内已被预约' });
      return;
    }

    // 查找或创建客户（根据手机号）
    let customer = queryOne('SELECT id FROM customers WHERE phone = ?', [customer_phone]);
    let customerId: string;
    
    if (customer) {
      // 客户已存在，更新信息
      customerId = customer.id;
      execute(
        'UPDATE customers SET name = ?, id_card = ?, license_number = ?, id_card_images = ?, license_images = ?, updated_at = ? WHERE id = ?',
        [
          customer_name, 
          customer_id_card || null, 
          customer_license || null, 
          id_card_images ? JSON.stringify(id_card_images) : null,
          license_images ? JSON.stringify(license_images) : null,
          now(), 
          customerId
        ]
      );
    } else {
      // 创建新客户
      customerId = generateId();
      execute(
        'INSERT INTO customers (id, name, phone, id_card, license_number, id_card_images, license_images, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
        [
          customerId, 
          customer_name, 
          customer_phone, 
          customer_id_card || null, 
          customer_license || null,
          id_card_images ? JSON.stringify(id_card_images) : null,
          license_images ? JSON.stringify(license_images) : null,
          now(), 
          now()
        ]
      );
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
    let commissionRate = 0;
    let netAmount = totalAmount;
    if (source_id) {
      const source = queryOne('SELECT * FROM order_sources WHERE id = ? AND status = 1', [source_id]);
      if (source) {
        commissionRate = source.commission_rate || 0;
        netAmount = totalAmount * (1 - commissionRate / 100);
      }
    }

    const id = generateId();
    const orderNo = generateOrderNo();
    const currentTime = now();
    const userId = req.user?.id;

    // 处理免押相关
    const isDepositWaived = deposit_waived ? 1 : 0;
    const finalDeposit = isDepositWaived ? 0 : (deposit || 0);
    const depositWaivedExpiry = isDepositWaived ? deposit_waived_expiry : null;

    // 处理预付金额
    const initialPaidAmount = (has_prepay && prepay_amount > 0) ? prepay_amount : 0;

    // 创建订单
    execute(
      `INSERT INTO orders (id, order_no, customer_id, vehicle_id, user_id, start_date, end_date, daily_rate, deposit, total_amount, paid_amount, status, remarks, source_id, commission_rate, net_amount, service_type, deposit_waived, deposit_waived_expiry, contract_number, pickup_location, return_location, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orderNo, customerId, vehicle_id, userId, start_date, end_date, finalDailyRate || 0, finalDeposit, totalAmount, initialPaidAmount, remarks || null, source_id || null, commissionRate, netAmount, service_type || 'basic', isDepositWaived, depositWaivedExpiry, contract_number || null, pickup_location || null, return_location || null, currentTime, currentTime]
    );

    // 如果有预付，添加支付记录
    if (has_prepay && prepay_amount > 0 && prepay_method && prepay_type) {
      const paymentId = generateId();
      execute(
        'INSERT INTO payments (id, order_id, amount, payment_method, payment_type, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [paymentId, id, prepay_amount, prepay_method, prepay_type, '下单时预付', currentTime]
      );
    }

    // 记录操作日志
    logAction(req.user?.id || '', '创建订单', 'order', id, `创建订单 ${orderNo}，客户：${customer_name}，车辆：${vehicle.plate_number}`, req.ip);

    res.json({ 
      success: true, 
      data: { id, order_no: orderNo, total_amount: totalAmount, net_amount: netAmount, commission_rate: commissionRate, days, customer_id: customerId, paid_amount: initialPaidAmount },
      message: '订单创建成功' 
    });
  } catch (error) {
    console.error('创建订单错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 更新订单状态
export function updateOrderStatus(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const { status, actual_end_date, remarks, pickup_mileage, return_mileage, pickup_image, return_image } = req.body;

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      res.status(404).json({ success: false, message: '订单不存在' });
      return;
    }

    const currentTime = now();

    // 如果还车时有里程数据，更新车辆里程
    if (status === 'completed' && return_mileage !== undefined && return_mileage !== null) {
      execute('UPDATE vehicles SET mileage = ?, updated_at = ? WHERE id = ?', [return_mileage, currentTime, order.vehicle_id]);
    }

    // 计算实际金额（如果有实际还车日期）
    let totalAmount = order.total_amount;
    if (actual_end_date && status === 'completed') {
      const start = new Date(order.start_date);
      const end = new Date(actual_end_date);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const days = Math.max(1, Math.ceil(hours / 24));
      totalAmount = days * order.daily_rate;
    }

    // 构建更新字段
    let updateSql = 'UPDATE orders SET status = ?, actual_end_date = ?, total_amount = ?, remarks = ?, updated_at = ?';
    const updateParams: any[] = [status, actual_end_date || null, totalAmount, remarks || order.remarks, currentTime];

    // 取车时记录取车里程和图片
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

    // 还车时记录还车里程和图片
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
    updateParams.push(id);

    execute(updateSql, updateParams);

    // 记录操作日志
    const statusText = STATUS_MAP[status] || status;
    const vehicle = queryOne('SELECT plate_number FROM vehicles WHERE id = ?', [order.vehicle_id]);
    logAction(req.user?.id || '', `${statusText}`, 'order', id, `订单 ${order.order_no} 状态变更为${statusText}，车辆：${vehicle?.plate_number || ''}`, req.ip);

    res.json({ success: true, message: '订单状态更新成功' });
  } catch (error) {
    console.error('更新订单状态错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 更新订单信息
export function updateOrder(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const { 
      customer_name, customer_phone, customer_id_card, customer_license,
      id_card_images, license_images,
      vehicle_id, source_id, start_date, end_date, 
      daily_rate, total_amount, deposit, remarks,
      service_type, deposit_waived, deposit_waived_expiry,
      contract_number,
      pickup_location, return_location
    } = req.body;

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      res.status(404).json({ success: false, message: '订单不存在' });
      return;
    }

    // 只有待确认和进行中的订单可以修改
    if (!['pending', 'active'].includes(order.status)) {
      res.status(400).json({ success: false, message: '只能修改待确认或进行中的订单' });
      return;
    }

    // 验证手机号格式
    if (customer_phone && !/^1[3-9]\d{9}$/.test(customer_phone)) {
      res.status(400).json({ success: false, message: '手机号格式不正确' });
      return;
    }

    const currentTime = now();

    // 处理客户信息更新
    if (customer_name || customer_phone || customer_id_card || customer_license || id_card_images || license_images) {
      // 查找或创建客户
      let customer = queryOne('SELECT id FROM customers WHERE phone = ?', [customer_phone || order.customer_phone]);
      let customerId = order.customer_id;
      
      if (customer && customer.id !== order.customer_id) {
        customerId = customer.id;
      } else if (!customer && customer_phone) {
        customerId = generateId();
        execute(
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

      // 更新订单的客户ID
      if (customerId !== order.customer_id) {
        execute('UPDATE orders SET customer_id = ?, updated_at = ? WHERE id = ?', [customerId, currentTime, id]);
      }

      // 更新客户信息
      execute(
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

    // 处理车辆更换（仅在待确认状态可以换车）
    if (vehicle_id && vehicle_id !== order.vehicle_id) {
      if (order.status === 'pending') {
        const newVehicle = queryOne('SELECT * FROM vehicles WHERE id = ?', [vehicle_id]);
        if (!newVehicle) {
          res.status(400).json({ success: false, message: '车辆不存在' });
          return;
        }
        if (['maintenance', 'unavailable'].includes(newVehicle.status)) {
          res.status(400).json({ success: false, message: '该车辆当前处于维修或不可用状态' });
          return;
        }
        
        // 检查新车辆在订单时间段是否可用
        const startDate = start_date || order.start_date;
        const endDate = end_date || order.end_date;
        const conflictingOrder = queryOne(`
          SELECT id FROM orders 
          WHERE vehicle_id = ? 
            AND id != ?
            AND status NOT IN ('cancelled', 'completed')
            AND (
              (start_date <= ? AND end_date > ?)
              OR (start_date < ? AND end_date >= ?)
              OR (start_date >= ? AND end_date <= ?)
            )
        `, [vehicle_id, id, startDate, startDate, endDate, endDate, startDate, endDate]);
        
        if (conflictingOrder) {
          res.status(400).json({ success: false, message: '该车辆在订单时间段内已被预约' });
          return;
        }
      } else {
        // 进行中的订单不允许换车
        res.status(400).json({ success: false, message: '进行中的订单不能更换车辆' });
        return;
      }
    }

    // 计算天数
    const startDate = start_date || order.start_date;
    const endDate = end_date || order.end_date;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const days = Math.max(1, Math.ceil(hours / 24));

    // 计算总金额：如果提供了总租金则使用，否则按日租金计算
    let totalAmount = total_amount;
    let finalDailyRate = daily_rate !== undefined ? daily_rate : order.daily_rate;
    
    if (!totalAmount && finalDailyRate) {
      totalAmount = days * finalDailyRate;
    }
    
    // 如果只有总租金，反推日租金
    if (totalAmount && !finalDailyRate) {
      finalDailyRate = Math.round(totalAmount / days);
    }

    // 处理订单来源变化
    let sourceId = source_id;
    let sourceName = order.source_name;
    let commissionRate = order.commission_rate || 0;
    
    if (source_id !== undefined) {
      if (source_id) {
        const source = queryOne('SELECT * FROM order_sources WHERE id = ? AND status = 1', [source_id]);
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
    const netAmount = Math.round(totalAmount * (1 - commissionRate / 100));

    // 处理免押相关
    const isDepositWaived = deposit_waived ? 1 : 0;
    const finalDeposit = isDepositWaived ? 0 : (deposit !== undefined ? deposit : order.deposit);
    const depositWaivedExpiry = isDepositWaived ? deposit_waived_expiry : null;

    // 更新订单
    execute(
      `UPDATE orders SET 
        vehicle_id = ?, source_id = ?, source_name = ?, commission_rate = ?, 
        start_date = ?, end_date = ?, daily_rate = ?, total_amount = ?, net_amount = ?, 
        deposit = ?, deposit_waived = ?, deposit_waived_expiry = ?, service_type = ?, 
        contract_number = ?, pickup_location = ?, return_location = ?, remarks = ?, updated_at = ? 
       WHERE id = ?`,
      [
        vehicle_id || order.vehicle_id, 
        sourceId, sourceName, commissionRate,
        startDate, endDate, 
        finalDailyRate || 0, totalAmount, netAmount, 
        finalDeposit, isDepositWaived, depositWaivedExpiry, service_type || order.service_type,
        contract_number ?? order.contract_number, 
        pickup_location !== undefined ? pickup_location : order.pickup_location,
        return_location !== undefined ? return_location : order.return_location,
        remarks ?? order.remarks, currentTime, id
      ]
    );

    res.json({ 
      success: true, 
      data: { total_amount: totalAmount, net_amount: netAmount, days },
      message: '订单更新成功' 
    });
  } catch (error) {
    console.error('更新订单错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 续租订单
export function extendOrder(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const { new_end_date, extend_amount, has_payment, payment_amount, payment_method } = req.body;

    if (!new_end_date) {
      res.status(400).json({ success: false, message: '新的还车时间不能为空' });
      return;
    }

    if (extend_amount === undefined || extend_amount < 0) {
      res.status(400).json({ success: false, message: '续租金额不能为空' });
      return;
    }

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      res.status(404).json({ success: false, message: '订单不存在' });
      return;
    }

    // 只有已取车状态可以续租
    if (order.status !== 'active') {
      res.status(400).json({ success: false, message: '只有已取车的订单可以续租' });
      return;
    }

    // 检查新还车时间必须晚于当前还车时间
    const currentEndDate = new Date(order.end_date);
    const newEndDateObj = new Date(new_end_date);
    
    if (newEndDateObj <= currentEndDate) {
      res.status(400).json({ success: false, message: '新的还车时间必须晚于当前还车时间' });
      return;
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
    if (has_payment && payment_amount > 0) {
      newPaidAmount += payment_amount;
    }

    // 更新订单
    execute(
      'UPDATE orders SET end_date = ?, total_amount = ?, net_amount = ?, paid_amount = ?, updated_at = ? WHERE id = ?',
      [new_end_date, newTotalAmount, newNetAmount, newPaidAmount, currentTime, id]
    );

    // 如果有支付，添加支付记录
    if (has_payment && payment_amount > 0 && payment_method) {
      const paymentId = generateId();
      execute(
        'INSERT INTO payments (id, order_id, amount, payment_method, payment_type, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [paymentId, id, payment_amount, payment_method, 'rent', '续租支付', currentTime]
      );
    }

    // 记录操作日志
    const vehicle = queryOne('SELECT plate_number FROM vehicles WHERE id = ?', [order.vehicle_id]);
    logAction(req.user?.id || '', '续租订单', 'order', id, `订单 ${order.order_no} 续租 ${extendDays} 天，金额：${extend_amount}，车辆：${vehicle?.plate_number || ''}`, req.ip);

    res.json({ 
      success: true, 
      data: { 
        new_end_date, 
        extend_days: extendDays,
        extend_amount: extend_amount,
        new_total_amount: newTotalAmount,
        new_net_amount: newNetAmount,
        new_paid_amount: newPaidAmount
      },
      message: '续租成功' 
    });
  } catch (error) {
    console.error('续租订单错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 添加支付记录
export function addPayment(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const { amount, payment_method, payment_type, remarks } = req.body;

    if (!amount || !payment_method || !payment_type) {
      res.status(400).json({ success: false, message: '金额、支付方式和支付类型不能为空' });
      return;
    }

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      res.status(404).json({ success: false, message: '订单不存在' });
      return;
    }

    const paymentId = generateId();
    const currentTime = now();

    // 添加支付记录
    execute(
      'INSERT INTO payments (id, order_id, amount, payment_method, payment_type, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [paymentId, id, amount, payment_method, payment_type, remarks || null, currentTime]
    );

    // 更新订单已支付金额
    const newPaidAmount = (order.paid_amount || 0) + amount;
    execute('UPDATE orders SET paid_amount = ?, updated_at = ? WHERE id = ?', [newPaidAmount, currentTime, id]);

    // 记录操作日志
    logAction(req.user?.id || '', '添加支付', 'order', id, `订单 ${order.order_no} 添加支付记录：${amount} 元，类型：${payment_type}`, req.ip);

    res.json({ 
      success: true, 
      data: { id: paymentId, amount, new_paid_amount: newPaidAmount },
      message: '支付记录添加成功' 
    });
  } catch (error) {
    console.error('添加支付记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 取消订单
export function cancelOrder(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      res.status(404).json({ success: false, message: '订单不存在' });
      return;
    }

    if (!['pending', 'active'].includes(order.status)) {
      res.status(400).json({ success: false, message: '只能取消待确认或进行中的订单' });
      return;
    }

    const currentTime = now();

    // 更新订单状态
    execute(
      "UPDATE orders SET status = 'cancelled', remarks = ?, updated_at = ? WHERE id = ?",
      [remarks || order.remarks, currentTime, id]
    );

    // 记录操作日志
    const vehicle = queryOne('SELECT plate_number FROM vehicles WHERE id = ?', [order.vehicle_id]);
    logAction(req.user?.id || '', '取消订单', 'order', id, `取消订单 ${order.order_no}，车辆：${vehicle?.plate_number || ''}`, req.ip);

    res.json({ success: true, message: '订单取消成功' });
  } catch (error) {
    console.error('取消订单错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
