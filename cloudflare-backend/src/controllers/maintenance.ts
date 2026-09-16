import { Env, query, queryOne, execute, queryWithPagination } from '../db/index.js';
import { generateUuid, errorResponse, successResponse, logAction } from '../utils/helpers.js';

const TYPE_MAP: Record<string, string> = { maintenance: '保养', oil: '机油', oil_filter: '机滤', air_filter: '空滤', ac_filter: '空调滤', tire: '轮胎', coolant: '防冻液', brake_fluid: '刹车油', inspection: '年检', repair: '维修', other: '其它' };
const STATUS_MAP: Record<string, string> = { pending: '待保养', in_progress: '保养中', completed: '已完成' };

function parseTypes(typeStr: string): string[] {
  try { return typeStr ? JSON.parse(typeStr) : []; } catch { return typeStr ? [typeStr] : []; }
}

function getTypeText(typeStr: string): string {
  const types = parseTypes(typeStr);
  return types.map(t => TYPE_MAP[t] || t).join('、') || '-';
}

// Get maintenance list
export async function getMaintenanceController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 10;
    const keyword = params.keyword || '';
    const status = params.status || '';
    const type = params.type || '';
    const vehicle_id = params.vehicle_id || '';

    let sql = `SELECT m.*, v.brand, v.model FROM maintenance m LEFT JOIN vehicles v ON m.vehicle_id = v.id WHERE 1=1`;
    const queryParams: any[] = [];

    if (keyword) {
      sql += ' AND (m.plate_number LIKE ? OR v.brand LIKE ? OR v.model LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      queryParams.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) { sql += ' AND m.status = ?'; queryParams.push(status); }
    if (type) { sql += ' AND m.type LIKE ?'; queryParams.push(`%"${type}"%`); }
    if (vehicle_id) { sql += ' AND m.vehicle_id = ?'; queryParams.push(vehicle_id); }

    sql += ' ORDER BY m.maintenance_date DESC';

    const result = await queryWithPagination(env.DB, sql, queryParams, page, pageSize);
    
    result.data = result.data.map((m: any) => {
      let images = [];
      try { images = m.images ? JSON.parse(m.images) : []; } catch {}
      
      return {
        ...m,
        type_text: getTypeText(m.type),
        status_text: STATUS_MAP[m.status] || m.status,
        types: parseTypes(m.type),
        images
      };
    });

    return successResponse(result);
  } catch (error) {
    console.error('Get maintenance error:', error);
    return errorResponse('获取保养列表失败', 500);
  }
}

// Get maintenance stats
export async function getMaintenanceStatsController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const thisMonth: any = await queryOne(env.DB, `
      SELECT COUNT(*) as count FROM maintenance 
      WHERE strftime('%Y-%m', maintenance_date) = strftime('%Y-%m', 'now')
    `);
    
    const pending: any = await queryOne(env.DB, `
      SELECT COUNT(DISTINCT m.vehicle_id) as count FROM maintenance m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      WHERE (m.type LIKE '%"oil"%' OR m.type = 'oil')
      AND (m.status = 'pending' OR (m.next_maintenance_mileage IS NOT NULL AND v.mileage >= m.next_maintenance_mileage - 1000))
    `);
    
    const thisMonthCost: any = await queryOne(env.DB, `
      SELECT COALESCE(SUM(cost), 0) as total FROM maintenance 
      WHERE strftime('%Y-%m', maintenance_date) = strftime('%Y-%m', 'now')
    `);
    
    const upcomingExpire = await query(env.DB, `
      SELECT m.*, v.brand, v.model, v.mileage as vehicle_mileage FROM maintenance m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      WHERE (m.type LIKE '%"oil"%' OR m.type = 'oil')
      AND (
        (m.next_maintenance_date IS NOT NULL AND m.next_maintenance_date >= date('now') AND m.next_maintenance_date <= date('now', '+30 days'))
        OR (m.next_maintenance_mileage IS NOT NULL AND v.mileage >= m.next_maintenance_mileage - 1000)
      )
      ORDER BY m.next_maintenance_date ASC
    `);

    return successResponse({
      thisMonth: thisMonth?.count || 0,
      pending: pending?.count || 0,
      thisMonthCost: thisMonthCost?.total || 0,
      upcomingExpire: upcomingExpire.map((m: any) => ({ ...m, type_text: getTypeText(m.type), status_text: STATUS_MAP[m.status] || m.status }))
    });
  } catch (error) {
    console.error('Get maintenance stats error:', error);
    return errorResponse('获取保养统计失败', 500);
  }
}

// Get single maintenance
export async function getMaintenanceDetailController(request: Request, env: Env, userId?: string, maintenanceId?: string): Promise<Response> {
  try {
    if (!maintenanceId) return errorResponse('保养ID不能为空');

    const maintenance: any = await queryOne(env.DB, `
      SELECT m.*, v.brand, v.model, v.color, v.year
      FROM maintenance m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      WHERE m.id = ?
    `, [maintenanceId]);

    if (!maintenance) return errorResponse('保养记录不存在', 404);

    let images = [];
    try { images = maintenance.images ? JSON.parse(maintenance.images) : []; } catch {}

    return successResponse({
      ...maintenance,
      type_text: TYPE_MAP[maintenance.type] || maintenance.type,
      status_text: STATUS_MAP[maintenance.status] || maintenance.status,
      images
    });
  } catch (error) {
    console.error('Get maintenance detail error:', error);
    return errorResponse('获取保养记录失败', 500);
  }
}

// Create maintenance
export async function createMaintenanceController(request: Request, env: Env, operatorId?: string): Promise<Response> {
  try {
    const body = await request.json();
    const { vehicle_id, plate_number, type, maintenance_date, cost, mileage, garage, next_maintenance_date, next_maintenance_mileage, images, remarks, status } = body;

    if (!vehicle_id || !type || !maintenance_date) {
      return errorResponse('车辆、保养类型和保养日期不能为空');
    }

    let plateNum = plate_number;
    if (!plateNum) {
      const vehicle: any = await queryOne(env.DB, 'SELECT plate_number FROM vehicles WHERE id = ?', [vehicle_id]);
      if (vehicle) plateNum = vehicle.plate_number;
    }

    const typeStr = Array.isArray(type) ? JSON.stringify(type) : type;
    const imagesStr = images && images.length > 0 ? JSON.stringify(images) : null;

    const id = generateUuid();
    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    await execute(
      env.DB,
      `INSERT INTO maintenance (id, vehicle_id, plate_number, type, maintenance_date, cost, mileage, garage, next_maintenance_date, next_maintenance_mileage, images, remarks, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, vehicle_id, plateNum, typeStr, maintenance_date, cost || 0, mileage || 0, garage || null, next_maintenance_date || null, next_maintenance_mileage || null, imagesStr, remarks || null, status || 'completed', currentTime, currentTime]
    );

    if (mileage) {
      await execute(env.DB, 'UPDATE vehicles SET mileage = ?, last_maintenance = ?, updated_at = ? WHERE id = ?', [mileage, maintenance_date, currentTime, vehicle_id]);
    }

    return successResponse({ id, plate_number: plateNum }, '保养记录创建成功');
  } catch (error) {
    console.error('Create maintenance error:', error);
    return errorResponse('创建保养记录失败', 500);
  }
}

// Update maintenance
export async function updateMaintenanceController(request: Request, env: Env, operatorId?: string, maintenanceId?: string): Promise<Response> {
  try {
    if (!maintenanceId) return errorResponse('保养ID不能为空');

    const body = await request.json();
    const { vehicle_id, type, maintenance_date, cost, mileage, garage, next_maintenance_date, next_maintenance_mileage, images, remarks, status } = body;

    const maintenance: any = await queryOne(env.DB, 'SELECT * FROM maintenance WHERE id = ?', [maintenanceId]);
    if (!maintenance) return errorResponse('保养记录不存在', 404);

    const typeStr = Array.isArray(type) ? JSON.stringify(type) : type;
    const imagesStr = images && images.length > 0 ? JSON.stringify(images) : null;

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
    await execute(
      env.DB,
      `UPDATE maintenance SET vehicle_id = ?, type = ?, maintenance_date = ?, cost = ?, mileage = ?, garage = ?, next_maintenance_date = ?, next_maintenance_mileage = ?, images = ?, remarks = ?, status = ?, updated_at = ? WHERE id = ?`,
      [vehicle_id || maintenance.vehicle_id, typeStr, maintenance_date, cost ?? 0, mileage ?? 0, garage || null, next_maintenance_date || null, next_maintenance_mileage || null, imagesStr, remarks || null, status || maintenance.status, currentTime, maintenanceId]
    );

    return successResponse(null, '保养记录更新成功');
  } catch (error) {
    console.error('Update maintenance error:', error);
    return errorResponse('更新保养记录失败', 500);
  }
}

// Delete maintenance
export async function deleteMaintenanceController(request: Request, env: Env, operatorId?: string, maintenanceId?: string): Promise<Response> {
  try {
    if (!maintenanceId) return errorResponse('保养ID不能为空');

    await execute(env.DB, 'DELETE FROM maintenance WHERE id = ?', [maintenanceId]);
    return successResponse(null, '保养记录删除成功');
  } catch (error) {
    console.error('Delete maintenance error:', error);
    return errorResponse('删除保养记录失败', 500);
  }
}
