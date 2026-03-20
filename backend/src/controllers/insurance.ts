import { Response } from 'express';
import { query, queryOne, execute, generateId, now, queryWithPagination } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 保险类型映射
const INSURANCE_TYPE_MAP: Record<string, string> = {
  compulsory: '交强险',
  commercial: '商业险',
  third_party: '第三者责任险',
  theft: '盗抢险',
  scratch: '划痕险',
  glass: '玻璃险',
  comprehensive: '综合险'
};

// 保险状态映射
const STATUS_MAP: Record<string, string> = {
  active: '生效中',
  expired: '已过期',
  pending: '待生效'
};

// 获取保险列表
export function getInsuranceList(req: AuthRequest, res: Response): void {
  try {
    const { page = 1, pageSize = 10, keyword = '', status = '', insurance_type = '', vehicle_id = '' } = req.query;
    
    let sql = `SELECT i.*, v.brand, v.model FROM insurance i 
               LEFT JOIN vehicles v ON i.vehicle_id = v.id WHERE 1=1`;
    const params: any[] = [];

    if (keyword) {
      sql += ' AND (i.plate_number LIKE ? OR i.policy_number LIKE ? OR i.insurance_company LIKE ? OR v.brand LIKE ? OR v.model LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) {
      sql += ' AND i.status = ?';
      params.push(status);
    }

    if (insurance_type) {
      sql += ' AND i.insurance_type = ?';
      params.push(insurance_type);
    }

    if (vehicle_id) {
      sql += ' AND i.vehicle_id = ?';
      params.push(vehicle_id);
    }

    sql += ' ORDER BY i.end_date DESC';

    const result = queryWithPagination(sql, params, Number(page), Number(pageSize));
    
    // 添加文本映射和状态计算
    const today = new Date().toISOString().split('T')[0];
    result.data = result.data.map((i: any) => {
      let actualStatus = i.status;
      if (i.end_date < today) {
        actualStatus = 'expired';
      } else if (i.start_date > today) {
        actualStatus = 'pending';
      } else {
        actualStatus = 'active';
      }
      
      return {
        ...i,
        status: actualStatus,
        type_text: INSURANCE_TYPE_MAP[i.insurance_type] || i.insurance_type,
        status_text: STATUS_MAP[actualStatus] || actualStatus
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取保险列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取保险统计
export function getInsuranceStats(req: AuthRequest, res: Response): void {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // 即将到期（30天内）
    const expiringSoon = query(`
      SELECT i.*, v.brand, v.model FROM insurance i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.end_date >= ? AND i.end_date <= ?
      ORDER BY i.end_date ASC
    `, [today, thirtyDaysLater]);
    
    // 已过期
    const expired = query(`
      SELECT i.*, v.brand, v.model FROM insurance i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.end_date < ?
      ORDER BY i.end_date DESC
    `, [today]);
    
    // 生效中
    const active = queryOne(`
      SELECT COUNT(*) as count FROM insurance
      WHERE start_date <= ? AND end_date >= ?
    `, [today, today]);
    
    // 本年保费总额
    const thisYearPremium = queryOne(`
      SELECT COALESCE(SUM(premium), 0) as total FROM insurance
      WHERE strftime('%Y', start_date) = strftime('%Y', 'now')
    `);

    res.json({
      success: true,
      data: {
        expiringSoon: expiringSoon.map((i: any) => ({
          ...i,
          type_text: INSURANCE_TYPE_MAP[i.insurance_type] || i.insurance_type,
          status_text: '即将到期'
        })),
        expired: expired.map((i: any) => ({
          ...i,
          type_text: INSURANCE_TYPE_MAP[i.insurance_type] || i.insurance_type,
          status_text: '已过期'
        })),
        activeCount: active?.count || 0,
        thisYearPremium: thisYearPremium?.total || 0
      }
    });
  } catch (error) {
    console.error('获取保险统计错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取单个保险记录
export function getInsurance(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const insurance = queryOne(`
      SELECT i.*, v.brand, v.model, v.color, v.year
      FROM insurance i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.id = ?
    `, [id]);

    if (!insurance) {
      res.status(404).json({ success: false, message: '保险记录不存在' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...insurance,
        type_text: INSURANCE_TYPE_MAP[insurance.insurance_type] || insurance.insurance_type
      }
    });
  } catch (error) {
    console.error('获取保险记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 创建保险记录
export function createInsurance(req: AuthRequest, res: Response): void {
  try {
    const {
      vehicle_id,
      plate_number,
      insurance_type,
      insurance_company,
      policy_number,
      start_date,
      end_date,
      premium,
      coverage_amount,
      beneficiary,
      remarks
    } = req.body;

    if (!vehicle_id || !insurance_type || !insurance_company || !start_date || !end_date) {
      res.status(400).json({ success: false, message: '车辆、保险类型、保险公司、生效日期和到期日期不能为空' });
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
    let status = 'active';
    if (start_date > today) {
      status = 'pending';
    } else if (end_date < today) {
      status = 'expired';
    }

    execute(
      `INSERT INTO insurance (
        id, vehicle_id, plate_number, insurance_type, insurance_company, policy_number,
        start_date, end_date, premium, coverage_amount, beneficiary, remarks, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, vehicle_id, plateNum, insurance_type, insurance_company, policy_number || null,
        start_date, end_date, premium || 0, coverage_amount || 0, beneficiary || null,
        remarks || null, status, currentTime, currentTime
      ]
    );

    res.json({
      success: true,
      data: { id, plate_number: plateNum },
      message: '保险记录创建成功'
    });
  } catch (error) {
    console.error('创建保险记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 更新保险记录
export function updateInsurance(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const {
      vehicle_id,
      insurance_type,
      insurance_company,
      policy_number,
      start_date,
      end_date,
      premium,
      coverage_amount,
      beneficiary,
      remarks,
      status
    } = req.body;

    const insurance = queryOne('SELECT * FROM insurance WHERE id = ?', [id]);
    if (!insurance) {
      res.status(404).json({ success: false, message: '保险记录不存在' });
      return;
    }

    execute(
      `UPDATE insurance SET 
        vehicle_id = ?, insurance_type = ?, insurance_company = ?, policy_number = ?,
        start_date = ?, end_date = ?, premium = ?, coverage_amount = ?,
        beneficiary = ?, remarks = ?, status = ?, updated_at = ?
      WHERE id = ?`,
      [
        vehicle_id || insurance.vehicle_id,
        insurance_type,
        insurance_company,
        policy_number || null,
        start_date,
        end_date,
        premium ?? 0,
        coverage_amount ?? 0,
        beneficiary || null,
        remarks || null,
        status || insurance.status,
        now(),
        id
      ]
    );

    res.json({ success: true, message: '保险记录更新成功' });
  } catch (error) {
    console.error('更新保险记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 删除保险记录
export function deleteInsurance(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    execute('DELETE FROM insurance WHERE id = ?', [id]);
    res.json({ success: true, message: '保险记录删除成功' });
  } catch (error) {
    console.error('删除保险记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
