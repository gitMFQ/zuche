import { Env, query, queryOne, execute, queryWithPagination } from '../db/index.js';
import { generateUuid, errorResponse, successResponse, logAction } from '../utils/helpers.js';

const INSURANCE_TYPE_MAP: Record<string, string> = { compulsory: '交强险', commercial: '商业险', seat: '座位险' };
const STATUS_MAP: Record<string, string> = { active: '生效中', expired: '已过期', pending: '待生效' };

function parseTypes(typeStr: string): string[] {
  try { return typeStr ? JSON.parse(typeStr) : []; } catch { return typeStr ? [typeStr] : []; }
}

function getTypeText(typeStr: string): string {
  const types = parseTypes(typeStr);
  return types.map(t => INSURANCE_TYPE_MAP[t] || t).join('、') || '-';
}

// Get insurance list
export async function getInsuranceController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 10;
    const keyword = params.keyword || '';
    const status = params.status || '';
    const insurance_type = params.insurance_type || '';
    const vehicle_id = params.vehicle_id || '';

    let sql = `SELECT i.*, v.brand, v.model FROM insurance i LEFT JOIN vehicles v ON i.vehicle_id = v.id WHERE 1=1`;
    const queryParams: any[] = [];

    if (keyword) {
      sql += ' AND (i.plate_number LIKE ? OR i.policy_number LIKE ? OR i.insurance_company LIKE ? OR v.brand LIKE ? OR v.model LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      queryParams.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) { sql += ' AND i.status = ?'; queryParams.push(status); }
    if (insurance_type) { sql += ' AND i.insurance_type = ?'; queryParams.push(insurance_type); }
    if (vehicle_id) { sql += ' AND i.vehicle_id = ?'; queryParams.push(vehicle_id); }

    sql += ' ORDER BY i.end_date DESC';

    const result = await queryWithPagination(env.DB, sql, queryParams, page, pageSize);
    
    const today = new Date().toISOString().split('T')[0];
    result.data = result.data.map((i: any) => {
      let actualStatus = i.status;
      if (i.end_date < today) actualStatus = 'expired';
      else if (i.start_date > today) actualStatus = 'pending';
      
      let documents = [];
      try { documents = i.documents ? JSON.parse(i.documents) : []; } catch {}
      
      return {
        ...i,
        status: actualStatus,
        type_text: getTypeText(i.insurance_type),
        status_text: STATUS_MAP[actualStatus] || actualStatus,
        insurance_types: parseTypes(i.insurance_type),
        documents
      };
    });

    return successResponse(result);
  } catch (error) {
    console.error('Get insurance error:', error);
    return errorResponse('获取保险列表失败', 500);
  }
}

// Get insurance stats
export async function getInsuranceStatsController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const expiringSoon = await query(env.DB, `
      SELECT i.*, v.brand, v.model FROM insurance i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.end_date >= ? AND i.end_date <= ?
      AND i.end_date = (SELECT MAX(i2.end_date) FROM insurance i2 WHERE i2.vehicle_id = i.vehicle_id)
      ORDER BY i.end_date ASC
    `, [today, thirtyDaysLater]);
    
    const expiredCount: any = await queryOne(env.DB, `
      SELECT COUNT(DISTINCT i.vehicle_id) as count FROM insurance i
      WHERE i.end_date < ?
      AND i.end_date = (SELECT MAX(i2.end_date) FROM insurance i2 WHERE i2.vehicle_id = i.vehicle_id)
    `, [today]);
    
    const activeCount: any = await queryOne(env.DB, `
      SELECT COUNT(DISTINCT i.vehicle_id) as count FROM insurance i
      WHERE i.start_date <= ? AND i.end_date >= ?
      AND i.end_date = (SELECT MAX(i2.end_date) FROM insurance i2 WHERE i2.vehicle_id = i.vehicle_id)
    `, [today, today]);
    
    const thisYearPremium: any = await queryOne(env.DB, `
      SELECT COALESCE(SUM(premium), 0) as total FROM insurance
      WHERE strftime('%Y', start_date) = strftime('%Y', 'now')
    `);

    return successResponse({
      expiringSoon: expiringSoon.map((i: any) => ({ ...i, type_text: getTypeText(i.insurance_type), status_text: '即将到期' })),
      expiredCount: expiredCount?.count || 0,
      activeCount: activeCount?.count || 0,
      thisYearPremium: thisYearPremium?.total || 0
    });
  } catch (error) {
    console.error('Get insurance stats error:', error);
    return errorResponse('获取保险统计失败', 500);
  }
}

// Get single insurance
export async function getInsuranceDetailController(request: Request, env: Env, userId?: string, insuranceId?: string): Promise<Response> {
  try {
    if (!insuranceId) return errorResponse('保险ID不能为空');

    const insurance: any = await queryOne(env.DB, `
      SELECT i.*, v.brand, v.model, v.color, v.year
      FROM insurance i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.id = ?
    `, [insuranceId]);

    if (!insurance) return errorResponse('保险记录不存在', 404);

    let documents = [];
    try { documents = insurance.documents ? JSON.parse(insurance.documents) : []; } catch {}

    return successResponse({
      ...insurance,
      type_text: INSURANCE_TYPE_MAP[insurance.insurance_type] || insurance.insurance_type,
      documents
    });
  } catch (error) {
    console.error('Get insurance detail error:', error);
    return errorResponse('获取保险记录失败', 500);
  }
}

// Create insurance
export async function createInsuranceController(request: Request, env: Env, operatorId?: string): Promise<Response> {
  try {
    const body = await request.json();
    const { vehicle_id, plate_number, insurance_type, insurance_types, insurance_company, policy_number, start_date, end_date, premium, coverage_amount, beneficiary, documents, remarks } = body;

    const typeStr = insurance_types ? (Array.isArray(insurance_types) ? JSON.stringify(insurance_types) : insurance_types) : (insurance_type || '');
    
    if (!vehicle_id || !typeStr || !insurance_company || !start_date || !end_date) {
      return errorResponse('车辆、保险类型、保险公司、生效日期和到期日期不能为空');
    }

    let plateNum = plate_number;
    if (!plateNum) {
      const vehicle: any = await queryOne(env.DB, 'SELECT plate_number FROM vehicles WHERE id = ?', [vehicle_id]);
      if (vehicle) plateNum = vehicle.plate_number;
    }

    const id = generateUuid();
    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    const today = new Date().toISOString().split('T')[0];
    let status = 'active';
    if (start_date > today) status = 'pending';
    else if (end_date < today) status = 'expired';

    await execute(
      env.DB,
      `INSERT INTO insurance (id, vehicle_id, plate_number, insurance_type, insurance_company, policy_number, start_date, end_date, premium, coverage_amount, beneficiary, documents, remarks, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, vehicle_id, plateNum, typeStr, insurance_company, policy_number || null, start_date, end_date, premium || 0, coverage_amount || 0, beneficiary || null, documents ? JSON.stringify(documents) : null, remarks || null, status, currentTime, currentTime]
    );

    return successResponse({ id, plate_number: plateNum }, '保险记录创建成功');
  } catch (error) {
    console.error('Create insurance error:', error);
    return errorResponse('创建保险记录失败', 500);
  }
}

// Update insurance
export async function updateInsuranceController(request: Request, env: Env, operatorId?: string, insuranceId?: string): Promise<Response> {
  try {
    if (!insuranceId) return errorResponse('保险ID不能为空');

    const body = await request.json();
    const { vehicle_id, insurance_type, insurance_types, insurance_company, policy_number, start_date, end_date, premium, coverage_amount, beneficiary, documents, remarks, status } = body;

    const insurance: any = await queryOne(env.DB, 'SELECT * FROM insurance WHERE id = ?', [insuranceId]);
    if (!insurance) return errorResponse('保险记录不存在', 404);

    const typeStr = insurance_types ? (Array.isArray(insurance_types) ? JSON.stringify(insurance_types) : insurance_types) : (insurance_type || insurance.insurance_type);

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
    await execute(
      env.DB,
      `UPDATE insurance SET vehicle_id = ?, insurance_type = ?, insurance_company = ?, policy_number = ?, start_date = ?, end_date = ?, premium = ?, coverage_amount = ?, beneficiary = ?, documents = ?, remarks = ?, status = ?, updated_at = ? WHERE id = ?`,
      [vehicle_id || insurance.vehicle_id, typeStr, insurance_company, policy_number || null, start_date, end_date, premium ?? 0, coverage_amount ?? 0, beneficiary || null, documents ? JSON.stringify(documents) : null, remarks || null, status || insurance.status, currentTime, insuranceId]
    );

    return successResponse(null, '保险记录更新成功');
  } catch (error) {
    console.error('Update insurance error:', error);
    return errorResponse('更新保险记录失败', 500);
  }
}

// Delete insurance
export async function deleteInsuranceController(request: Request, env: Env, operatorId?: string, insuranceId?: string): Promise<Response> {
  try {
    if (!insuranceId) return errorResponse('保险ID不能为空');

    await execute(env.DB, 'DELETE FROM insurance WHERE id = ?', [insuranceId]);
    return successResponse(null, '保险记录删除成功');
  } catch (error) {
    console.error('Delete insurance error:', error);
    return errorResponse('删除保险记录失败', 500);
  }
}
