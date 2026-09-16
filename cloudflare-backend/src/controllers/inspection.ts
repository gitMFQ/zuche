import { Env, query, queryOne, execute, queryWithPagination } from '../db/index.js';
import { generateUuid, errorResponse, successResponse, logAction } from '../utils/helpers.js';

const STATUS_MAP: Record<string, string> = { valid: '有效', expired: '已过期', none: '未登记' };

// Get inspection list
export async function getInspectionController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 10;
    const keyword = params.keyword || '';
    const status = params.status || '';

    let sql = `
      SELECT 
        v.id as vehicle_id,
        v.plate_number,
        v.brand,
        v.model,
        v.color,
        v.status as vehicle_status,
        v.is_new_energy,
        i.id as inspection_id,
        i.expiry_date,
        i.certificate_image,
        i.remarks,
        i.created_at as inspection_created_at
      FROM vehicles v
      LEFT JOIN inspections i ON v.id = i.vehicle_id
      WHERE 1=1
    `;
    const queryParams: any[] = [];

    if (keyword) {
      sql += ' AND (v.plate_number LIKE ? OR v.brand LIKE ? OR v.model LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      queryParams.push(likeKeyword, likeKeyword, likeKeyword);
    }

    sql += ' ORDER BY v.plate_number ASC';

    const result = await queryWithPagination(env.DB, sql, queryParams, page, pageSize);
    
    const today = new Date().toISOString().split('T')[0];
    result.data = result.data.map((item: any) => {
      let inspectionStatus = 'none';
      let statusText = '未登记';
      
      if (item.inspection_id) {
        if (item.expiry_date < today) {
          inspectionStatus = 'expired';
          statusText = '已过期';
        } else {
          inspectionStatus = 'valid';
          statusText = '有效';
        }
      }
      
      return { ...item, inspection_status: inspectionStatus, status_text: statusText };
    });

    if (status) {
      result.data = result.data.filter((item: any) => item.inspection_status === status);
      result.total = result.data.length;
    }

    return successResponse(result);
  } catch (error) {
    console.error('Get inspection error:', error);
    return errorResponse('获取年检列表失败', 500);
  }
}

// Get inspection stats
export async function getInspectionStatsController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const vehicleTotal: any = await queryOne(env.DB, 'SELECT COUNT(*) as count FROM vehicles');
    const inspectionTotal: any = await queryOne(env.DB, 'SELECT COUNT(*) as count FROM inspections');
    
    const expiringSoon = await query(env.DB, `
      SELECT i.*, v.brand, v.model, v.plate_number FROM inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.expiry_date >= ? AND i.expiry_date <= ?
      ORDER BY i.expiry_date ASC
    `, [today, thirtyDaysLater]);
    
    const expired = await query(env.DB, `
      SELECT i.*, v.brand, v.model, v.plate_number FROM inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.expiry_date < ?
      ORDER BY i.expiry_date DESC
    `, [today]);
    
    const valid: any = await queryOne(env.DB, `
      SELECT COUNT(*) as count FROM inspections
      WHERE expiry_date >= ?
    `, [today]);

    const noneCount = (vehicleTotal?.count || 0) - (inspectionTotal?.count || 0);

    return successResponse({
      expiringSoon: expiringSoon.map((i: any) => ({ ...i, status_text: '即将到期' })),
      expired: expired.map((i: any) => ({ ...i, status_text: '已过期' })),
      validCount: valid?.count || 0,
      noneCount: noneCount > 0 ? noneCount : 0
    });
  } catch (error) {
    console.error('Get inspection stats error:', error);
    return errorResponse('获取年检统计失败', 500);
  }
}

// Create or update inspection
export async function createOrUpdateInspectionController(request: Request, env: Env, operatorId?: string): Promise<Response> {
  try {
    const body = await request.json();
    const { vehicle_id, expiry_date, certificate_image, remarks } = body;

    if (!vehicle_id || !expiry_date) {
      return errorResponse('车辆和到期日期不能为空');
    }

    const vehicle: any = await queryOne(env.DB, 'SELECT plate_number FROM vehicles WHERE id = ?', [vehicle_id]);
    if (!vehicle) return errorResponse('车辆不存在', 404);

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    const existing: any = await queryOne(env.DB, 'SELECT id FROM inspections WHERE vehicle_id = ?', [vehicle_id]);

    if (existing) {
      await execute(
        env.DB,
        `UPDATE inspections SET expiry_date = ?, certificate_image = ?, remarks = ?, updated_at = ? WHERE vehicle_id = ?`,
        [expiry_date, certificate_image || null, remarks || null, currentTime, vehicle_id]
      );
      return successResponse(null, '年检证更新成功');
    } else {
      const id = generateUuid();
      await execute(
        env.DB,
        `INSERT INTO inspections (id, vehicle_id, plate_number, expiry_date, certificate_image, remarks, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'valid', ?, ?)`,
        [id, vehicle_id, vehicle.plate_number, expiry_date, certificate_image || null, remarks || null, currentTime, currentTime]
      );
      return successResponse({ id }, '年检证创建成功');
    }
  } catch (error) {
    console.error('Create/update inspection error:', error);
    return errorResponse('保存年检记录失败', 500);
  }
}

// Update inspection by vehicle_id
export async function updateInspectionByVehicleController(request: Request, env: Env, operatorId?: string, vehicleId?: string): Promise<Response> {
  try {
    if (!vehicleId) return errorResponse('车辆ID不能为空');

    const body = await request.json();
    const { expiry_date, certificate_image, remarks } = body;

    if (!expiry_date) return errorResponse('到期日期不能为空');

    const inspection: any = await queryOne(env.DB, 'SELECT id FROM inspections WHERE vehicle_id = ?', [vehicleId]);
    
    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    if (!inspection) {
      const vehicle: any = await queryOne(env.DB, 'SELECT plate_number FROM vehicles WHERE id = ?', [vehicleId]);
      if (!vehicle) return errorResponse('车辆不存在', 404);
      
      const id = generateUuid();
      await execute(
        env.DB,
        `INSERT INTO inspections (id, vehicle_id, plate_number, expiry_date, certificate_image, remarks, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'valid', ?, ?)`,
        [id, vehicleId, vehicle.plate_number, expiry_date, certificate_image || null, remarks || null, currentTime, currentTime]
      );
    } else {
      await execute(
        env.DB,
        `UPDATE inspections SET expiry_date = ?, certificate_image = ?, remarks = ?, updated_at = ? WHERE vehicle_id = ?`,
        [expiry_date, certificate_image || null, remarks || null, currentTime, vehicleId]
      );
    }

    return successResponse(null, '年检记录更新成功');
  } catch (error) {
    console.error('Update inspection error:', error);
    return errorResponse('更新年检记录失败', 500);
  }
}

// Delete inspection by vehicle_id
export async function deleteInspectionByVehicleController(request: Request, env: Env, operatorId?: string, vehicleId?: string): Promise<Response> {
  try {
    if (!vehicleId) return errorResponse('车辆ID不能为空');

    await execute(env.DB, 'DELETE FROM inspections WHERE vehicle_id = ?', [vehicleId]);
    return successResponse(null, '年检记录删除成功');
  } catch (error) {
    console.error('Delete inspection error:', error);
    return errorResponse('删除年检记录失败', 500);
  }
}
