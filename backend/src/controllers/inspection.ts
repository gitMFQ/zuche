import { Response } from 'express';
import { query, queryOne, execute, generateId, now, queryWithPagination } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 年检状态映射
const STATUS_MAP: Record<string, string> = {
  valid: '有效',
  expired: '已过期',
  pending: '待检'
};

// 获取年检列表
export function getInspectionList(req: AuthRequest, res: Response): void {
  try {
    const { page = 1, pageSize = 10, keyword = '', status = '', vehicle_id = '' } = req.query;
    
    let sql = `SELECT i.*, v.brand, v.model FROM inspections i 
               LEFT JOIN vehicles v ON i.vehicle_id = v.id WHERE 1=1`;
    const params: any[] = [];

    if (keyword) {
      sql += ' AND (i.plate_number LIKE ? OR v.brand LIKE ? OR v.model LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) {
      sql += ' AND i.status = ?';
      params.push(status);
    }

    if (vehicle_id) {
      sql += ' AND i.vehicle_id = ?';
      params.push(vehicle_id);
    }

    sql += ' ORDER BY i.expiry_date DESC';

    const result = queryWithPagination(sql, params, Number(page), Number(pageSize));
    
    // 添加文本映射和状态计算
    const today = new Date().toISOString().split('T')[0];
    result.data = result.data.map((i: any) => {
      let actualStatus = i.status;
      if (i.expiry_date < today) {
        actualStatus = 'expired';
      } else {
        actualStatus = 'valid';
      }
      
      return {
        ...i,
        status: actualStatus,
        status_text: STATUS_MAP[actualStatus] || actualStatus
      };
    });

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
    
    // 即将到期（30天内）
    const expiringSoon = query(`
      SELECT i.*, v.brand, v.model FROM inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.expiry_date >= ? AND i.expiry_date <= ?
      ORDER BY i.expiry_date ASC
    `, [today, thirtyDaysLater]);
    
    // 已过期
    const expired = query(`
      SELECT i.*, v.brand, v.model FROM inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.expiry_date < ?
      ORDER BY i.expiry_date DESC
    `, [today]);
    
    // 有效数量
    const valid = queryOne(`
      SELECT COUNT(*) as count FROM inspections
      WHERE expiry_date >= ?
    `, [today]);

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
        validCount: valid?.count || 0
      }
    });
  } catch (error) {
    console.error('获取年检统计错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取单个年检记录
export function getInspection(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const inspection = queryOne(`
      SELECT i.*, v.brand, v.model, v.color, v.year
      FROM inspections i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.id = ?
    `, [id]);

    if (!inspection) {
      res.status(404).json({ success: false, message: '年检记录不存在' });
      return;
    }

    res.json({ success: true, data: inspection });
  } catch (error) {
    console.error('获取年检记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 创建年检记录
export function createInspection(req: AuthRequest, res: Response): void {
  try {
    const { vehicle_id, plate_number, expiry_date, certificate_image, remarks } = req.body;

    if (!vehicle_id || !expiry_date) {
      res.status(400).json({ success: false, message: '车辆和到期日期不能为空' });
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

    const id = generateId();
    const currentTime = now();

    // 计算状态
    const today = new Date().toISOString().split('T')[0];
    let status = 'valid';
    if (expiry_date < today) {
      status = 'expired';
    }

    execute(
      `INSERT INTO inspections (
        id, vehicle_id, plate_number, expiry_date, certificate_image, remarks, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, vehicle_id, plateNum, expiry_date, certificate_image || null, remarks || null, status, currentTime, currentTime]
    );

    res.json({
      success: true,
      data: { id, plate_number: plateNum },
      message: '年检记录创建成功'
    });
  } catch (error) {
    console.error('创建年检记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 更新年检记录
export function updateInspection(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const { vehicle_id, expiry_date, certificate_image, remarks } = req.body;

    const inspection = queryOne('SELECT * FROM inspections WHERE id = ?', [id]);
    if (!inspection) {
      res.status(404).json({ success: false, message: '年检记录不存在' });
      return;
    }

    // 计算状态
    const today = new Date().toISOString().split('T')[0];
    let status = 'valid';
    if (expiry_date < today) {
      status = 'expired';
    }

    execute(
      `UPDATE inspections SET 
        vehicle_id = ?, expiry_date = ?, certificate_image = ?, remarks = ?, status = ?, updated_at = ?
      WHERE id = ?`,
      [vehicle_id, expiry_date, certificate_image || null, remarks || null, status, now(), id]
    );

    res.json({ success: true, message: '年检记录更新成功' });
  } catch (error) {
    console.error('更新年检记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 删除年检记录
export function deleteInspection(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    execute('DELETE FROM inspections WHERE id = ?', [id]);
    res.json({ success: true, message: '年检记录删除成功' });
  } catch (error) {
    console.error('删除年检记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}