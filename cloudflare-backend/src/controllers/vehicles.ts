import { Env, query, queryOne, execute, queryWithPagination } from '../db/index.js';
import { generateUuid, errorResponse, successResponse, logAction } from '../utils/helpers.js';

const STATUS_MAP: Record<string, string> = { available: '可用', rented: '已出租', maintenance: '维修中', unavailable: '不可用' };

// Get vehicles list
export async function getVehiclesController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 10;
    const keyword = params.keyword || '';
    const status = params.status || '';
    const brand = params.brand || '';

    let sql = 'SELECT * FROM vehicles WHERE 1=1';
    const queryParams: any[] = [];

    if (keyword) {
      sql += ' AND (plate_number LIKE ? OR brand LIKE ? OR model LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      queryParams.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) {
      sql += ' AND status = ?';
      queryParams.push(status);
    }

    if (brand) {
      sql += ' AND brand = ?';
      queryParams.push(brand);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await queryWithPagination(env.DB, sql, queryParams, page, pageSize);
    
    // Calculate actual status
    const currentTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
    result.data = result.data.map((v: any) => {
      if (['maintenance', 'unavailable'].includes(v.status)) {
        return { ...v, status_text: STATUS_MAP[v.status] || v.status };
      }
      return { ...v, actual_status: 'available', status_text: '可用' }; // Simplified for CF
    });

    return successResponse(result);
  } catch (error) {
    console.error('Get vehicles error:', error);
    return errorResponse('获取车辆列表失败', 500);
  }
}

// Get available vehicles
export async function getAvailableVehiclesController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const start_date = params.start_date;
    const end_date = params.end_date;
    const exclude_order_id = params.exclude_order_id;

    let sql = `SELECT id, plate_number, brand, model, color, daily_rate, deposit, status FROM vehicles WHERE status NOT IN ('maintenance', 'unavailable') ORDER BY plate_number`;
    const vehicles = await query(env.DB, sql);

    if (start_date && end_date) {
      const availableVehicles = [];
      for (const v of vehicles) {
        let conflictSql = `SELECT id FROM orders WHERE vehicle_id = ? AND status NOT IN ('cancelled', 'completed')`;
        const cparams: any[] = [v.id];
        
        if (exclude_order_id) {
          conflictSql += ' AND id != ?';
          cparams.push(exclude_order_id);
        }
        
        conflictSql += ` AND ((start_date <= ? AND end_date > ?) OR (start_date < ? AND end_date >= ?) OR (start_date >= ? AND end_date <= ?))`;
        cparams.push(start_date, start_date, end_date, end_date, start_date, end_date);
        
        const conflict = await queryOne(env.DB, conflictSql, cparams);
        if (!conflict) availableVehicles.push(v);
      }
      return successResponse(availableVehicles);
    }

    return successResponse(vehicles);
  } catch (error) {
    console.error('Get available vehicles error:', error);
    return errorResponse('获取可用车辆失败', 500);
  }
}

// Get single vehicle
export async function getVehicleController(request: Request, env: Env, userId?: string, vehicleId?: string): Promise<Response> {
  try {
    if (!vehicleId) return errorResponse('车辆ID不能为空');

    const vehicle = await queryOne(env.DB, 'SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
    if (!vehicle) return errorResponse('车辆不存在', 404);

    const orders = await query(
      env.DB,
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.vehicle_id = ? ORDER BY o.created_at DESC LIMIT 10`,
      [vehicleId]
    );

    return successResponse({ ...vehicle, status_text: STATUS_MAP[vehicle.status] || vehicle.status, orders });
  } catch (error) {
    console.error('Get vehicle error:', error);
    return errorResponse('获取车辆信息失败', 500);
  }
}

// Create vehicle
export async function createVehicleController(request: Request, env: Env, operatorId?: string): Promise<Response> {
  try {
    const body = await request.json();
    const { plate_number, brand, model, color, year, seats, daily_rate, deposit, mileage, vin, engine_number, license_image, registration_image, is_new_energy, remarks } = body;

    if (!plate_number || !brand || !model) {
      return errorResponse('车牌号、品牌、型号不能为空');
    }

    const existing = await queryOne(env.DB, 'SELECT id FROM vehicles WHERE plate_number = ?', [plate_number]);
    if (existing) return errorResponse('该车牌号已存在');

    const id = generateUuid();
    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);

    await execute(
      env.DB,
      `INSERT INTO vehicles (id, plate_number, brand, model, color, year, seats, daily_rate, deposit, mileage, vin, engine_number, license_image, registration_image, is_new_energy, remarks, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)`,
      [id, plate_number, brand, model, color || null, year || null, seats || 5, daily_rate || 0, deposit || 0, mileage || 0, vin || null, engine_number || null, license_image || null, registration_image || null, is_new_energy ? 1 : 0, remarks || null, currentTime, currentTime]
    );

    await logAction(env.DB, operatorId || null, '创建车辆', 'vehicle', id, `创建车辆 ${plate_number}（${brand} ${model}）`);

    return successResponse({ id, plate_number, brand, model }, '车辆创建成功');
  } catch (error) {
    console.error('Create vehicle error:', error);
    return errorResponse('创建车辆失败', 500);
  }
}

// Update vehicle
export async function updateVehicleController(request: Request, env: Env, operatorId?: string, vehicleId?: string): Promise<Response> {
  try {
    if (!vehicleId) return errorResponse('车辆ID不能为空');

    const body = await request.json();
    const { plate_number, brand, model, color, year, seats, daily_rate, deposit, status, mileage, last_maintenance, vin, engine_number, license_image, registration_image, is_new_energy, remarks } = body;

    const vehicle = await queryOne(env.DB, 'SELECT id FROM vehicles WHERE id = ?', [vehicleId]);
    if (!vehicle) return errorResponse('车辆不存在', 404);

    if (plate_number) {
      const existingPlate = await queryOne(env.DB, 'SELECT id FROM vehicles WHERE plate_number = ? AND id != ?', [plate_number, vehicleId]);
      if (existingPlate) return errorResponse('该车牌号已被其他车辆使用');
    }

    const currentTime = new Date().toISOString().replace('Z', '').slice(0, 19);
    await execute(
      env.DB,
      `UPDATE vehicles SET plate_number = ?, brand = ?, model = ?, color = ?, year = ?, seats = ?, daily_rate = ?, deposit = ?, status = ?, mileage = ?, last_maintenance = ?, vin = ?, engine_number = ?, license_image = ?, registration_image = ?, is_new_energy = ?, remarks = ?, updated_at = ? WHERE id = ?`,
      [plate_number, brand, model, color || null, year || null, seats || 5, daily_rate || 0, deposit || 0, status, mileage || 0, last_maintenance || null, vin || null, engine_number || null, license_image || null, registration_image || null, is_new_energy ? 1 : 0, remarks || null, currentTime, vehicleId]
    );

    await logAction(env.DB, operatorId || null, '更新车辆', 'vehicle', vehicleId, `更新车辆 ${plate_number}`);

    return successResponse(null, '车辆更新成功');
  } catch (error) {
    console.error('Update vehicle error:', error);
    return errorResponse('更新车辆失败', 500);
  }
}

// Delete vehicle
export async function deleteVehicleController(request: Request, env: Env, operatorId?: string, vehicleId?: string): Promise<Response> {
  try {
    if (!vehicleId) return errorResponse('车辆ID不能为空');

    const activeOrders: any = await queryOne(
      env.DB,
      "SELECT COUNT(*) as count FROM orders WHERE vehicle_id = ? AND status IN ('pending', 'active')",
      [vehicleId]
    );

    if (activeOrders && activeOrders.count > 0) {
      return errorResponse('该车辆有未完成的订单，无法删除');
    }

    const vehicle: any = await queryOne(env.DB, 'SELECT plate_number FROM vehicles WHERE id = ?', [vehicleId]);
    await execute(env.DB, 'DELETE FROM vehicles WHERE id = ?', [vehicleId]);

    await logAction(env.DB, operatorId || null, '删除车辆', 'vehicle', vehicleId, `删除车辆 ${vehicle?.plate_number || ''}`);

    return successResponse(null, '车辆删除成功');
  } catch (error) {
    console.error('Delete vehicle error:', error);
    return errorResponse('删除车辆失败', 500);
  }
}

// Get vehicle brands
export async function getVehicleBrandsController(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const brands = await query(env.DB, 'SELECT DISTINCT brand FROM vehicles ORDER BY brand');
    return successResponse(brands.map((b: any) => b.brand));
  } catch (error) {
    console.error('Get brands error:', error);
    return errorResponse('获取品牌列表失败', 500);
  }
}
