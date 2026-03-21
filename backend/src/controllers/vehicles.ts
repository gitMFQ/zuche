import { Response } from 'express';
import { query, queryOne, execute, generateId, now, queryWithPagination } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 车辆状态映射
const STATUS_MAP: Record<string, string> = {
  available: '可用',
  rented: '已出租',
  maintenance: '维修中',
  unavailable: '不可用'
};

// 获取车辆列表
export function getVehicles(req: AuthRequest, res: Response): void {
  try {
    const { page = 1, pageSize = 10, keyword = '', status = '', brand = '' } = req.query;
    
    let sql = 'SELECT * FROM vehicles WHERE 1=1';
    const params: any[] = [];

    if (keyword) {
      sql += ' AND (plate_number LIKE ? OR brand LIKE ? OR model LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (brand) {
      sql += ' AND brand = ?';
      params.push(brand);
    }

    sql += ' ORDER BY created_at DESC';

    const result = queryWithPagination(sql, params, Number(page), Number(pageSize));
    
    // 添加状态文本
    result.data = result.data.map((v: any) => ({
      ...v,
      status_text: STATUS_MAP[v.status] || v.status
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取车辆列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取可用车辆（下拉选择用）
export function getAvailableVehicles(req: AuthRequest, res: Response): void {
  try {
    const vehicles = query(`
      SELECT id, plate_number, brand, model, color, daily_rate, deposit
      FROM vehicles 
      WHERE status = 'available'
      ORDER BY plate_number
    `);

    res.json({ success: true, data: vehicles });
  } catch (error) {
    console.error('获取可用车辆错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取单个车辆
export function getVehicle(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const vehicle = queryOne('SELECT * FROM vehicles WHERE id = ?', [id]);

    if (!vehicle) {
      res.status(404).json({ success: false, message: '车辆不存在' });
      return;
    }

    // 获取该车辆的订单记录
    const orders = query(`
      SELECT o.*, c.name as customer_name, c.phone as customer_phone
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.vehicle_id = ?
      ORDER BY o.created_at DESC
      LIMIT 10
    `, [id]);

    res.json({ 
      success: true, 
      data: { 
        ...vehicle, 
        status_text: STATUS_MAP[vehicle.status] || vehicle.status,
        orders 
      } 
    });
  } catch (error) {
    console.error('获取车辆错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 创建车辆
export function createVehicle(req: AuthRequest, res: Response): void {
  try {
    const { plate_number, brand, model, color, year, seats, daily_rate, deposit, mileage, vin, engine_number, license_image, registration_image, is_new_energy, remarks } = req.body;

    if (!plate_number || !brand || !model) {
      res.status(400).json({ success: false, message: '车牌号、品牌、型号不能为空' });
      return;
    }

    // 检查车牌号是否已存在
    const existing = queryOne('SELECT id FROM vehicles WHERE plate_number = ?', [plate_number]);
    if (existing) {
      res.status(400).json({ success: false, message: '该车牌号已存在' });
      return;
    }

    const id = generateId();
    const currentTime = now();

    execute(
      `INSERT INTO vehicles (id, plate_number, brand, model, color, year, seats, daily_rate, deposit, mileage, vin, engine_number, license_image, registration_image, is_new_energy, remarks, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)`,
      [id, plate_number, brand, model, color || null, year || null, seats || 5, daily_rate || 0, deposit || 0, mileage || 0, vin || null, engine_number || null, license_image || null, registration_image || null, is_new_energy ? 1 : 0, remarks || null, currentTime, currentTime]
    );

    res.json({ 
      success: true, 
      data: { id, plate_number, brand, model },
      message: '车辆创建成功' 
    });
  } catch (error) {
    console.error('创建车辆错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 更新车辆
export function updateVehicle(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const { plate_number, brand, model, color, year, seats, daily_rate, deposit, status, mileage, last_maintenance, vin, engine_number, license_image, registration_image, is_new_energy, remarks } = req.body;

    const vehicle = queryOne('SELECT id FROM vehicles WHERE id = ?', [id]);
    if (!vehicle) {
      res.status(404).json({ success: false, message: '车辆不存在' });
      return;
    }

    // 检查车牌号是否被其他车辆使用
    if (plate_number) {
      const existingPlate = queryOne('SELECT id FROM vehicles WHERE plate_number = ? AND id != ?', [plate_number, id]);
      if (existingPlate) {
        res.status(400).json({ success: false, message: '该车牌号已被其他车辆使用' });
        return;
      }
    }

    execute(
      `UPDATE vehicles SET plate_number = ?, brand = ?, model = ?, color = ?, year = ?, seats = ?, daily_rate = ?, deposit = ?, status = ?, mileage = ?, last_maintenance = ?, vin = ?, engine_number = ?, license_image = ?, registration_image = ?, is_new_energy = ?, remarks = ?, updated_at = ? WHERE id = ?`,
      [plate_number, brand, model, color || null, year || null, seats || 5, daily_rate || 0, deposit || 0, status, mileage || 0, last_maintenance || null, vin || null, engine_number || null, license_image || null, registration_image || null, is_new_energy ? 1 : 0, remarks || null, now(), id]
    );

    res.json({ success: true, message: '车辆更新成功' });
  } catch (error) {
    console.error('更新车辆错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 删除车辆
export function deleteVehicle(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;

    // 检查是否有未完成的订单
    const activeOrders = queryOne(
      "SELECT COUNT(*) as count FROM orders WHERE vehicle_id = ? AND status IN ('pending', 'active')",
      [id]
    );

    if (activeOrders && activeOrders.count > 0) {
      res.status(400).json({ success: false, message: '该车辆有未完成的订单，无法删除' });
      return;
    }

    execute('DELETE FROM vehicles WHERE id = ?', [id]);
    res.json({ success: true, message: '车辆删除成功' });
  } catch (error) {
    console.error('删除车辆错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取车辆品牌列表
export function getVehicleBrands(req: AuthRequest, res: Response): void {
  try {
    const brands = query('SELECT DISTINCT brand FROM vehicles ORDER BY brand');
    res.json({ success: true, data: brands.map((b: any) => b.brand) });
  } catch (error) {
    console.error('获取品牌列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
