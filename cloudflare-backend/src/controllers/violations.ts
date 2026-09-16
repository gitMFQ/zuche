import { Env, query, queryOne, execute, queryWithPagination } from '../db/index.js';
import { generateUuid, errorResponse, successResponse, logAction } from '../utils/helpers.js';

const STATUS_MAP: Record<string, string> = { pending: '待处理', processing: '处理中', completed: '已完成' };
const TYPE_MAP: Record<string, string> = { speeding: '超速', red_light: '闯红灯', parking: '违章停车', lane: '违规变道', overloading: '超载', drunk: '酒驾', other: '其他' };

// Get violations list
export async function getViolationsController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 10;
    const keyword = params.keyword || '';
    const status = params.status || '';
    const vehicle_id = params.vehicle_id || '';

    let sql = `SELECT v.*, o.order_no, s.name as source_name, s.color as source_color FROM violations v LEFT JOIN orders o ON v.order_id = o.id LEFT JOIN order_sources s ON o.source_id = s.id WHERE 1=1`;
    const queryParams: any[] = [];

    if (keyword) {
      sql += ' AND (v.customer_name LIKE ? OR v.customer_phone LIKE ? OR v.plate_number LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      queryParams.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) {
      sql += ' AND v.status = ?';
      queryParams.push(status);
    }

    if (vehicle_id) {
      sql += ' AND v.vehicle_id = ?';
      queryParams.push(vehicle_id);
    }

    sql += ' ORDER BY v.created_at DESC';

    const result = await queryWithPagination(env.DB, sql, queryParams, page, pageSize);
    
    result.data = result.data.map((item: any) => {
      let images = [];
      try { images = item.images ? JSON.parse(item.images) : []; } catch {}
      return { ...item, status_text: STATUS_MAP[item.status] || item.status, violation_type_text: TYPE_MAP[item.violation_type] || item.violation_type, images };
    });

    return successResponse(result);
  } catch (error) {
    console.error('Get violations error:', error);
    return errorResponse('获取违章列表失败', 500);
  }
}

// Get single violation
export async function getViolationController(request: Request, env: Env, userId?: string, violationId?: string): Promise<Response> {
  try {
    if (!violationId) return errorResponse('违章ID不能为空');

    const violation: any = await queryOne(env.DB, 'SELECT * FROM violations WHERE id = ?', [violationId]);
    if (!violation) return errorResponse('违章记录不存在', 404);

    let images = [];
    try { images = violation.images ? JSON.parse(violation.images) : []; } catch {}

    return successResponse({ ...violation, status_text: STATUS_MAP[violation.status] || violation.status, violation_type_text: TYPE_MAP[violation.violation_type] || violation.violation_type, images });
  } catch (error) {
    console.error('Get violation error:', error);
    return errorResponse('获取违章信息失败', 500);
  }
}

// Create violation
export async function createViolationController(request: Request, env: Env, operatorId?: string): Promise<Response> {
  try {
    const body = await request.json();
    const { order_id, vehicle_id, customer_id, customer_name, customer_phone, plate_number, violation_type, violation_date, location, fine_amount, penalty_points, penalty_fee, images, remarks } = body;

    if (!vehicle_id || !customer_name || !plate_number || !violation_type || !violation_date) {
      return errorResponse('车辆、客户姓名、车牌、违章类型和违章日期不能为空');
    }

    let imagesJson = null;
    if (images && Array.isArray(images)) {
      imagesJson = JSON.stringify(images.slice(0, 5));
    }

    const id = generateUuid();
    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    await execute(
      env.DB,
      `INSERT INTO violations (id, order_id, vehicle_id, customer_id, customer_name, customer_phone, plate_number, violation_type, violation_date, location, fine_amount, penalty_points, penalty_fee, images, status, remarks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [id, order_id || null, vehicle_id, customer_id || null, customer_name, customer_phone || null, plate_number, violation_type, violation_date, location || null, fine_amount || 0, penalty_points || 0, penalty_fee || 0, imagesJson, remarks || null, currentTime, currentTime]
    );

    await logAction(env.DB, operatorId || null, '创建违章', 'violation', id, `创建违章记录：${plate_number}，${TYPE_MAP[violation_type] || violation_type}`);

    return successResponse({ id }, '违章记录创建成功');
  } catch (error) {
    console.error('Create violation error:', error);
    return errorResponse('创建违章记录失败', 500);
  }
}

// Update violation
export async function updateViolationController(request: Request, env: Env, operatorId?: string, violationId?: string): Promise<Response> {
  try {
    if (!violationId) return errorResponse('违章ID不能为空');

    const body = await request.json();
    const { violation_type, violation_date, location, fine_amount, penalty_points, penalty_fee, images, remarks } = body;

    const violation = await queryOne(env.DB, 'SELECT * FROM violations WHERE id = ?', [violationId]);
    if (!violation) return errorResponse('违章记录不存在', 404);

    let imagesJson = null;
    if (images && Array.isArray(images)) {
      imagesJson = JSON.stringify(images.slice(0, 5));
    }

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
    await execute(
      env.DB,
      `UPDATE violations SET violation_type = ?, violation_date = ?, location = ?, fine_amount = ?, penalty_points = ?, penalty_fee = ?, images = ?, remarks = ?, updated_at = ? WHERE id = ?`,
      [violation_type, violation_date, location || null, fine_amount || 0, penalty_points || 0, penalty_fee || 0, imagesJson, remarks || null, currentTime, violationId]
    );

    return successResponse(null, '违章记录更新成功');
  } catch (error) {
    console.error('Update violation error:', error);
    return errorResponse('更新违章记录失败', 500);
  }
}

// Handle violation
export async function handleViolationController(request: Request, env: Env, operatorId?: string, violationId?: string): Promise<Response> {
  try {
    if (!violationId) return errorResponse('违章ID不能为空');

    const body = await request.json();
    const { status, handle_remarks, handle_type, license_deposit } = body;

    const violation: any = await queryOne(env.DB, 'SELECT * FROM violations WHERE id = ?', [violationId]);
    if (!violation) return errorResponse('违章记录不存在', 404);

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
    await execute(
      env.DB,
      `UPDATE violations SET status = ?, handle_date = ?, handle_remarks = ?, handle_type = ?, license_deposit = ?, updated_at = ? WHERE id = ?`,
      [status, currentTime, handle_remarks || null, handle_type || 'store', license_deposit || 0, currentTime, violationId]
    );

    const statusText = STATUS_MAP[status] || status;
    await logAction(env.DB, operatorId || null, '处理违章', 'violation', violationId, `违章处理：${violation.plate_number}，状态：${statusText}`);

    return successResponse(null, '违章状态更新成功');
  } catch (error) {
    console.error('Handle violation error:', error);
    return errorResponse('处理违章失败', 500);
  }
}

// Collect fee
export async function collectFeeController(request: Request, env: Env, operatorId?: string, violationId?: string): Promise<Response> {
  try {
    if (!violationId) return errorResponse('违章ID不能为空');

    const body = await request.json();
    const { collected_penalty, collected_fine, fee_remarks } = body;

    const violation = await queryOne(env.DB, 'SELECT * FROM violations WHERE id = ?', [violationId]);
    if (!violation) return errorResponse('违章记录不存在', 404);

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
    await execute(
      env.DB,
      `UPDATE violations SET collected_penalty = ?, collected_fine = ?, fee_remarks = ?, updated_at = ? WHERE id = ?`,
      [collected_penalty || 0, collected_fine || 0, fee_remarks || null, currentTime, violationId]
    );

    return successResponse(null, '费用记录更新成功');
  } catch (error) {
    console.error('Collect fee error:', error);
    return errorResponse('收取费用失败', 500);
  }
}

// Delete violation
export async function deleteViolationController(request: Request, env: Env, operatorId?: string, violationId?: string): Promise<Response> {
  try {
    if (!violationId) return errorResponse('违章ID不能为空');

    const violation: any = await queryOne(env.DB, 'SELECT * FROM violations WHERE id = ?', [violationId]);
    if (!violation) return errorResponse('违章记录不存在', 404);

    await execute(env.DB, 'DELETE FROM violations WHERE id = ?', [violationId]);
    await logAction(env.DB, operatorId || null, '删除违章', 'violation', violationId, `删除违章记录：${violation.plate_number}`);

    return successResponse(null, '删除成功');
  } catch (error) {
    console.error('Delete violation error:', error);
    return errorResponse('删除违章记录失败', 500);
  }
}

// Get violation stats
export async function getViolationStatsController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const pending: any = await queryOne(env.DB, "SELECT COUNT(*) as count FROM violations WHERE status = 'pending'");
    const processing: any = await queryOne(env.DB, "SELECT COUNT(*) as count FROM violations WHERE status = 'processing'");
    const completed: any = await queryOne(env.DB, "SELECT COUNT(*) as count FROM violations WHERE status = 'completed'");
    const totalFines: any = await queryOne(env.DB, "SELECT SUM(fine_amount) as total FROM violations WHERE status != 'completed'");

    return successResponse({
      pending: pending?.count || 0,
      processing: processing?.count || 0,
      completed: completed?.count || 0,
      pendingFines: totalFines?.total || 0
    });
  } catch (error) {
    console.error('Get violation stats error:', error);
    return errorResponse('获取违章统计失败', 500);
  }
}
