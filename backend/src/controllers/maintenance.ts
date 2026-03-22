import { Response } from 'express';
import { query, queryOne, execute, generateId, now, queryWithPagination } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 保养类型映射
const TYPE_MAP: Record<string, string> = {
  maintenance: '保养',
  oil: '机油',
  oil_filter: '机滤',
  air_filter: '空滤',
  ac_filter: '空调滤',
  tire: '轮胎',
  coolant: '防冻液',
  brake_fluid: '刹车油',
  inspection: '年检',
  repair: '维修',
  other: '其它'
};

// 保养状态映射
const STATUS_MAP: Record<string, string> = {
  pending: '待保养',
  in_progress: '保养中',
  completed: '已完成'
};

// 解析类型数组
function parseTypes(typeStr: string): string[] {
  try {
    return typeStr ? JSON.parse(typeStr) : [];
  } catch {
    return typeStr ? [typeStr] : [];
  }
}

// 获取类型文本
function getTypeText(typeStr: string): string {
  const types = parseTypes(typeStr);
  return types.map(t => TYPE_MAP[t] || t).join('、') || '-';
}

// 获取保养列表
export function getMaintenanceList(req: AuthRequest, res: Response): void {
  try {
    const { page = 1, pageSize = 10, keyword = '', status = '', type = '', vehicle_id = '' } = req.query;
    
    let sql = `SELECT m.*, v.brand, v.model FROM maintenance m 
               LEFT JOIN vehicles v ON m.vehicle_id = v.id WHERE 1=1`;
    const params: any[] = [];

    if (keyword) {
      sql += ' AND (m.plate_number LIKE ? OR v.brand LIKE ? OR v.model LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) {
      sql += ' AND m.status = ?';
      params.push(status);
    }

    if (type) {
      sql += ' AND m.type LIKE ?';
      params.push(`%"${type}"%`);
    }

    if (vehicle_id) {
      sql += ' AND m.vehicle_id = ?';
      params.push(vehicle_id);
    }

    sql += ' ORDER BY m.maintenance_date DESC';

    const result = queryWithPagination(sql, params, Number(page), Number(pageSize));
    
    // 添加文本映射
    result.data = result.data.map((m: any) => {
      // 解析图片
      let images = [];
      try {
        images = m.images ? JSON.parse(m.images) : [];
      } catch {
        images = [];
      }
      
      return {
        ...m,
        type_text: getTypeText(m.type),
        status_text: STATUS_MAP[m.status] || m.status,
        types: parseTypes(m.type),
        images
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取保养列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取保养统计
export function getMaintenanceStats(req: AuthRequest, res: Response): void {
  try {
    // 本月保养数量
    const thisMonth = queryOne(`
      SELECT COUNT(*) as count FROM maintenance 
      WHERE strftime('%Y-%m', maintenance_date) = strftime('%Y-%m', 'now')
    `);
    
    // 待保养数量（只检查包含机油的记录）
    // 检查type字段是否包含"oil"
    const pending = queryOne(`
      SELECT COUNT(DISTINCT m.vehicle_id) as count FROM maintenance m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      WHERE (m.type LIKE '%"oil"%' OR m.type = 'oil')
      AND (m.status = 'pending'
      OR (m.next_maintenance_mileage IS NOT NULL 
          AND v.mileage >= m.next_maintenance_mileage - 1000))
    `);
    
    // 本月保养费用
    const thisMonthCost = queryOne(`
      SELECT COALESCE(SUM(cost), 0) as total FROM maintenance 
      WHERE strftime('%Y-%m', maintenance_date) = strftime('%Y-%m', 'now')
    `);
    
    // 即将到期保养（只检查包含机油的记录，根据next_maintenance_date或里程）
    const upcomingExpire = query(`
      SELECT m.*, v.brand, v.model, v.mileage as vehicle_mileage FROM maintenance m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      WHERE (m.type LIKE '%"oil"%' OR m.type = 'oil')
      AND (
        (m.next_maintenance_date IS NOT NULL 
         AND m.next_maintenance_date >= date('now')
         AND m.next_maintenance_date <= date('now', '+30 days'))
        OR (m.next_maintenance_mileage IS NOT NULL 
            AND v.mileage >= m.next_maintenance_mileage - 1000)
      )
      ORDER BY m.next_maintenance_date ASC
    `);

    res.json({
      success: true,
      data: {
        thisMonth: thisMonth?.count || 0,
        pending: pending?.count || 0,
        thisMonthCost: thisMonthCost?.total || 0,
        upcomingExpire: upcomingExpire.map((m: any) => ({
          ...m,
          type_text: getTypeText(m.type),
          status_text: STATUS_MAP[m.status] || m.status
        }))
      }
    });
  } catch (error) {
    console.error('获取保养统计错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取单个保养记录
export function getMaintenance(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const maintenance = queryOne(`
      SELECT m.*, v.brand, v.model, v.color, v.year
      FROM maintenance m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      WHERE m.id = ?
    `, [id]);

    if (!maintenance) {
      res.status(404).json({ success: false, message: '保养记录不存在' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...maintenance,
        type_text: TYPE_MAP[maintenance.type] || maintenance.type,
        status_text: STATUS_MAP[maintenance.status] || maintenance.status
      }
    });
  } catch (error) {
    console.error('获取保养记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 创建保养记录
export function createMaintenance(req: AuthRequest, res: Response): void {
  try {
    const {
      vehicle_id,
      plate_number,
      type,
      maintenance_date,
      cost,
      mileage,
      garage,
      next_maintenance_date,
      next_maintenance_mileage,
      images,
      remarks,
      status
    } = req.body;

    if (!vehicle_id || !type || !maintenance_date) {
      res.status(400).json({ success: false, message: '车辆、保养类型和保养日期不能为空' });
      return;
    }

    // 获取车牌号
    let plateNum = plate_number;
    if (!plateNum) {
      const vehicle = queryOne('SELECT plate_number FROM vehicles WHERE id = ?', [vehicle_id]);
      if (vehicle) {
        plateNum = vehicle.plate_number;
      }
    }

    // 处理类型（支持数组或单个值）
    const typeStr = Array.isArray(type) ? JSON.stringify(type) : type;
    
    // 处理图片
    const imagesStr = images && images.length > 0 ? JSON.stringify(images) : null;

    const id = generateId();
    const currentTime = now();

    execute(
      `INSERT INTO maintenance (
        id, vehicle_id, plate_number, type, maintenance_date, cost, mileage, 
        garage, next_maintenance_date, next_maintenance_mileage, images, remarks, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, vehicle_id, plateNum, typeStr, maintenance_date, cost || 0, mileage || 0,
        garage || null, next_maintenance_date || null, next_maintenance_mileage || null,
        imagesStr, remarks || null, status || 'completed', currentTime, currentTime
      ]
    );

    // 更新车辆的里程和上次保养日期
    if (mileage) {
      execute(
        'UPDATE vehicles SET mileage = ?, last_maintenance = ?, updated_at = ? WHERE id = ?',
        [mileage, maintenance_date, currentTime, vehicle_id]
      );
    }

    res.json({
      success: true,
      data: { id, plate_number: plateNum },
      message: '保养记录创建成功'
    });
  } catch (error) {
    console.error('创建保养记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 更新保养记录
export function updateMaintenance(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const {
      vehicle_id,
      type,
      maintenance_date,
      cost,
      mileage,
      garage,
      next_maintenance_date,
      next_maintenance_mileage,
      images,
      remarks,
      status
    } = req.body;

    const maintenance = queryOne('SELECT * FROM maintenance WHERE id = ?', [id]);
    if (!maintenance) {
      res.status(404).json({ success: false, message: '保养记录不存在' });
      return;
    }

    // 处理类型（支持数组或单个值）
    const typeStr = Array.isArray(type) ? JSON.stringify(type) : type;
    
    // 处理图片
    const imagesStr = images && images.length > 0 ? JSON.stringify(images) : null;

    execute(
      `UPDATE maintenance SET 
        vehicle_id = ?, type = ?, maintenance_date = ?, cost = ?, mileage = ?,
        garage = ?, next_maintenance_date = ?, next_maintenance_mileage = ?, 
        images = ?, remarks = ?, status = ?, updated_at = ?
      WHERE id = ?`,
      [
        vehicle_id || maintenance.vehicle_id,
        typeStr,
        maintenance_date,
        cost ?? 0,
        mileage ?? 0,
        garage || null,
        next_maintenance_date || null,
        next_maintenance_mileage || null,
        imagesStr,
        remarks || null,
        status || maintenance.status,
        now(),
        id
      ]
    );

    res.json({ success: true, message: '保养记录更新成功' });
  } catch (error) {
    console.error('更新保养记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 删除保养记录
export function deleteMaintenance(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    execute('DELETE FROM maintenance WHERE id = ?', [id]);
    res.json({ success: true, message: '保养记录删除成功' });
  } catch (error) {
    console.error('删除保养记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
