import { Response } from 'express';
import { query, queryOne, execute, generateId, now, queryWithPagination } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 违章状态映射
const STATUS_MAP: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成'
};

// 违章类型映射
const TYPE_MAP: Record<string, string> = {
  speeding: '超速',
  red_light: '闯红灯',
  parking: '违章停车',
  lane: '违规变道',
  overloading: '超载',
  drunk: '酒驾',
  other: '其他'
};

// 获取违章列表
export function getViolations(req: AuthRequest, res: Response): void {
  try {
    const { page = 1, pageSize = 10, keyword = '', status = '', vehicle_id = '' } = req.query;
    
    let sql = `
      SELECT v.*,
        o.order_no,
        s.name as source_name,
        s.color as source_color
      FROM violations v
      LEFT JOIN orders o ON v.order_id = o.id
      LEFT JOIN order_sources s ON o.source_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (keyword) {
      sql += ' AND (v.customer_name LIKE ? OR v.customer_phone LIKE ? OR v.plate_number LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) {
      sql += ' AND v.status = ?';
      params.push(status);
    }

    if (vehicle_id) {
      sql += ' AND v.vehicle_id = ?';
      params.push(vehicle_id);
    }

    sql += ' ORDER BY v.created_at DESC';

    const result = queryWithPagination(sql, params, Number(page), Number(pageSize));
    
    // 添加状态和类型文本，解析图片数组
    result.data = result.data.map((item: any) => ({
      ...item,
      status_text: STATUS_MAP[item.status] || item.status,
      violation_type_text: TYPE_MAP[item.violation_type] || item.violation_type,
      images: item.images ? JSON.parse(item.images) : []
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取违章列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取单个违章
export function getViolation(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const violation = queryOne('SELECT * FROM violations WHERE id = ?', [id]);

    if (!violation) {
      res.status(404).json({ success: false, message: '违章记录不存在' });
      return;
    }

    res.json({ 
      success: true, 
      data: {
        ...violation,
        status_text: STATUS_MAP[violation.status] || violation.status,
        violation_type_text: TYPE_MAP[violation.violation_type] || violation.violation_type,
        images: violation.images ? JSON.parse(violation.images) : []
      }
    });
  } catch (error) {
    console.error('获取违章错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 创建违章记录
export function createViolation(req: AuthRequest, res: Response): void {
  try {
    const {
      order_id, vehicle_id, customer_id, customer_name, customer_phone,
      plate_number, violation_type, violation_date, location,
      fine_amount, penalty_points, penalty_fee, images, remarks
    } = req.body;

    if (!vehicle_id || !customer_name || !plate_number || !violation_type || !violation_date) {
      res.status(400).json({ success: false, message: '车辆、客户姓名、车牌、违章类型和违章日期不能为空' });
      return;
    }

    // 处理图片数组，最多5张
    let imagesJson = null;
    if (images && Array.isArray(images)) {
      imagesJson = JSON.stringify(images.slice(0, 5));
    }

    const id = generateId();
    const currentTime = now();

    execute(
      `INSERT INTO violations 
        (id, order_id, vehicle_id, customer_id, customer_name, customer_phone, plate_number, 
         violation_type, violation_date, location, fine_amount, penalty_points, penalty_fee, images, status, remarks, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [id, order_id || null, vehicle_id, customer_id || null, customer_name, customer_phone || null, plate_number,
       violation_type, violation_date, location || null, fine_amount || 0, penalty_points || 0, penalty_fee || 0, imagesJson, remarks || null, currentTime, currentTime]
    );

    res.json({ 
      success: true, 
      data: { id },
      message: '违章记录创建成功' 
    });
  } catch (error) {
    console.error('创建违章记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 更新违章记录
export function updateViolation(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const {
      violation_type, violation_date, location, fine_amount, penalty_points, penalty_fee, images, remarks
    } = req.body;

    const violation = queryOne('SELECT * FROM violations WHERE id = ?', [id]);
    if (!violation) {
      res.status(404).json({ success: false, message: '违章记录不存在' });
      return;
    }

    // 处理图片数组，最多5张
    let imagesJson = null;
    if (images && Array.isArray(images)) {
      imagesJson = JSON.stringify(images.slice(0, 5));
    }

    const currentTime = now();

    execute(
      `UPDATE violations SET 
        violation_type = ?, violation_date = ?, location = ?, 
        fine_amount = ?, penalty_points = ?, penalty_fee = ?, images = ?, remarks = ?, updated_at = ? 
       WHERE id = ?`,
      [violation_type, violation_date, location || null, fine_amount || 0, penalty_points || 0, penalty_fee || 0, imagesJson, remarks || null, currentTime, id]
    );

    res.json({ success: true, message: '违章记录更新成功' });
  } catch (error) {
    console.error('更新违章记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 处理违章（标记已处理）
export function handleViolation(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const { status, handle_remarks, handle_type, license_deposit } = req.body;

    const violation = queryOne('SELECT * FROM violations WHERE id = ?', [id]);
    if (!violation) {
      res.status(404).json({ success: false, message: '违章记录不存在' });
      return;
    }

    const currentTime = now();

    execute(
      `UPDATE violations SET status = ?, handle_date = ?, handle_remarks = ?, handle_type = ?, license_deposit = ?, updated_at = ? WHERE id = ?`,
      [status, currentTime, handle_remarks || null, handle_type || 'store', license_deposit || 0, currentTime, id]
    );

    res.json({ success: true, message: '违章状态更新成功' });
  } catch (error) {
    console.error('处理违章错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 收取违章费用（违约金、罚款）
export function collectFee(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const { collected_penalty, collected_fine, fee_remarks } = req.body;

    const violation = queryOne('SELECT * FROM violations WHERE id = ?', [id]);
    if (!violation) {
      res.status(404).json({ success: false, message: '违章记录不存在' });
      return;
    }

    const currentTime = now();

    execute(
      `UPDATE violations SET 
        collected_penalty = ?, collected_fine = ?, fee_remarks = ?, updated_at = ? 
       WHERE id = ?`,
      [collected_penalty || 0, collected_fine || 0, fee_remarks || null, currentTime, id]
    );

    res.json({ success: true, message: '费用记录更新成功' });
  } catch (error) {
    console.error('收取费用错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 删除违章记录
export function deleteViolation(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const violation = queryOne('SELECT * FROM violations WHERE id = ?', [id]);
    
    if (!violation) {
      res.status(404).json({ success: false, message: '违章记录不存在' });
      return;
    }

    execute('DELETE FROM violations WHERE id = ?', [id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除违章记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取违章统计
export function getViolationStats(req: AuthRequest, res: Response): void {
  try {
    const pending = queryOne("SELECT COUNT(*) as count FROM violations WHERE status = 'pending'");
    const processing = queryOne("SELECT COUNT(*) as count FROM violations WHERE status = 'processing'");
    const completed = queryOne("SELECT COUNT(*) as count FROM violations WHERE status = 'completed'");
    const totalFines = queryOne("SELECT SUM(fine_amount) as total FROM violations WHERE status != 'completed'");

    res.json({
      success: true,
      data: {
        pending: pending?.count || 0,
        processing: processing?.count || 0,
        completed: completed?.count || 0,
        pendingFines: totalFines?.total || 0
      }
    });
  } catch (error) {
    console.error('获取违章统计错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
