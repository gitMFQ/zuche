import { Response } from 'express';
import { query, queryOne, execute, generateId, now, queryWithPagination } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 年检状态映射
const STATUS_MAP: Record<string, string> = {
  valid: '有效',
  expired: '已过期',
  none: '未登记'
};

// 获取车辆年检状态列表（显示所有车辆）
export function getInspectionList(req: AuthRequest, res: Response): void {
  try {
    const { page = 1, pageSize = 10, keyword = '', status = '' } = req.query;
    
    // 查询所有车辆，关联年检证信息
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
    const params: any[] = [];

    if (keyword) {
      sql += ' AND (v.plate_number LIKE ? OR v.brand LIKE ? OR v.model LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    sql += ' ORDER BY v.plate_number ASC';

    const result = queryWithPagination(sql, params, Number(page), Number(pageSize));
    
    // 计算年检状态
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
      
      return {
        ...item,
        inspection_status: inspectionStatus,
        status_text: statusText
      };
    });

    // 按状态筛选（在获取数据后筛选）
    if (status) {
      result.data = result.data.filter((item: any) => item.inspection_status === status);
      result.total = result.data.length;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取年检列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取年检统计
export function getInspectionStats(req: AuthRequest, res: Response): void {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // 车辆总数
    const vehicleTotal = queryOne('SELECT COUNT(*) as count FROM vehicles');
    
    // 已登记年检证数量
    const inspectionTotal = queryOne('SELECT COUNT(*) as count FROM inspections');
    
    // 即将到期（30天内）
    const expiringSoon = query(`
      SELECT i.*, v.brand, v.model, v.plate_number FROM inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.expiry_date >= ? AND i.expiry_date <= ?
      ORDER BY i.expiry_date ASC
    `, [today, thirtyDaysLater]);
    
    // 已过期
    const expired = query(`
      SELECT i.*, v.brand, v.model, v.plate_number FROM inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.expiry_date < ?
      ORDER BY i.expiry_date DESC
    `, [today]);
    
    // 有效数量
    const valid = queryOne(`
      SELECT COUNT(*) as count FROM inspections
      WHERE expiry_date >= ?
    `, [today]);

    // 未登记数量
    const noneCount = (vehicleTotal?.count || 0) - (inspectionTotal?.count || 0);

    res.json({
      success: true,
      data: {
        expiringSoon: expiringSoon.map((i: any) => ({
          ...i,
          status_text: '即将到期'
        })),
        expired: expired.map((i: any) => ({
          ...i,
          status_text: '已过期'
        })),
        validCount: valid?.count || 0,
        noneCount: noneCount > 0 ? noneCount : 0
      }
    });
  } catch (error) {
    console.error('获取年检统计错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 创建或更新年检记录（每辆车只保留一条记录）
export function createInspection(req: AuthRequest, res: Response): void {
  try {
    const { vehicle_id, expiry_date, certificate_image, remarks } = req.body;

    if (!vehicle_id || !expiry_date) {
      res.status(400).json({ success: false, message: '车辆和到期日期不能为空' });
      return;
    }

    // 获取车辆信息
    const vehicle = queryOne('SELECT plate_number FROM vehicles WHERE id = ?', [vehicle_id]);
    if (!vehicle) {
      res.status(400).json({ success: false, message: '车辆不存在' });
      return;
    }

    const currentTime = now();

    // 检查是否已存在年检记录
    const existing = queryOne('SELECT id FROM inspections WHERE vehicle_id = ?', [vehicle_id]);

    if (existing) {
      // 更新现有记录
      execute(
        `UPDATE inspections SET expiry_date = ?, certificate_image = ?, remarks = ?, updated_at = ? WHERE vehicle_id = ?`,
        [expiry_date, certificate_image || null, remarks || null, currentTime, vehicle_id]
      );
      res.json({ success: true, message: '年检证更新成功' });
    } else {
      // 创建新记录
      const id = generateId();
      execute(
        `INSERT INTO inspections (id, vehicle_id, plate_number, expiry_date, certificate_image, remarks, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'valid', ?, ?)`,
        [id, vehicle_id, vehicle.plate_number, expiry_date, certificate_image || null, remarks || null, currentTime, currentTime]
      );
      res.json({ success: true, message: '年检证创建成功' });
    }
  } catch (error) {
    console.error('创建年检记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误: ' + (error as Error).message });
  }
}

// 更新年检记录（通过车辆ID）
export function updateInspection(req: AuthRequest, res: Response): void {
  try {
    const { vehicle_id } = req.params;
    const { expiry_date, certificate_image, remarks } = req.body;

    if (!expiry_date) {
      res.status(400).json({ success: false, message: '到期日期不能为空' });
      return;
    }

    // 检查年检记录是否存在
    const inspection = queryOne('SELECT id FROM inspections WHERE vehicle_id = ?', [vehicle_id]);
    
    if (!inspection) {
      // 不存在则创建
      const vehicle = queryOne('SELECT plate_number FROM vehicles WHERE id = ?', [vehicle_id]);
      if (!vehicle) {
        res.status(404).json({ success: false, message: '车辆不存在' });
        return;
      }
      
      const id = generateId();
      const currentTime = now();
      execute(
        `INSERT INTO inspections (id, vehicle_id, plate_number, expiry_date, certificate_image, remarks, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'valid', ?, ?)`,
        [id, vehicle_id, vehicle.plate_number, expiry_date, certificate_image || null, remarks || null, currentTime, currentTime]
      );
    } else {
      // 更新现有记录
      execute(
        `UPDATE inspections SET expiry_date = ?, certificate_image = ?, remarks = ?, updated_at = ? WHERE vehicle_id = ?`,
        [expiry_date, certificate_image || null, remarks || null, now(), vehicle_id]
      );
    }

    res.json({ success: true, message: '年检记录更新成功' });
  } catch (error) {
    console.error('更新年检记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 删除年检记录（通过车辆ID）
export function deleteInspection(req: AuthRequest, res: Response): void {
  try {
    const { vehicle_id } = req.params;
    execute('DELETE FROM inspections WHERE vehicle_id = ?', [vehicle_id]);
    res.json({ success: true, message: '年检记录删除成功' });
  } catch (error) {
    console.error('删除年检记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}