import { Response } from 'express';
import { query, queryOne, execute, generateId, now, queryWithPagination } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 保险类型映射
const INSURANCE_TYPE_MAP: Record<string, string> = {
  compulsory: '交强险',
  commercial: '商业险',
  seat: '座位险'
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
  return types.map(t => INSURANCE_TYPE_MAP[t] || t).join('、') || '-';
}

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
      
      // 解析 documents JSON
      let documents = [];
      try {
        documents = i.documents ? JSON.parse(i.documents) : [];
      } catch {
        documents = [];
      }
      
      return {
        ...i,
        status: actualStatus,
        type_text: getTypeText(i.insurance_type),
        status_text: STATUS_MAP[actualStatus] || actualStatus,
        insurance_types: parseTypes(i.insurance_type),
        documents
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
    
    // 即将到期（30天内）- 只看最新保险
    const expiringSoon = query(`
      SELECT i.*, v.brand, v.model FROM insurance i
      LEFT JOIN vehicles v ON i.vehicle_id = v.id
      WHERE i.end_date >= ? AND i.end_date <= ?
      AND i.end_date = (
        SELECT MAX(i2.end_date) FROM insurance i2 WHERE i2.vehicle_id = i.vehicle_id
      )
      ORDER BY i.end_date ASC
    `, [today, thirtyDaysLater]);
    
    // 已过期 - 只统计最新保险已过期的车辆数
    const expiredCount = queryOne(`
      SELECT COUNT(DISTINCT i.vehicle_id) as count FROM insurance i
      WHERE i.end_date < ?
      AND i.end_date = (
        SELECT MAX(i2.end_date) FROM insurance i2 WHERE i2.vehicle_id = i.vehicle_id
      )
    `, [today]);
    
    // 生效中 - 只统计最新保险生效中的车辆数
    const activeCount = queryOne(`
      SELECT COUNT(DISTINCT i.vehicle_id) as count FROM insurance i
      WHERE i.start_date <= ? AND i.end_date >= ?
      AND i.end_date = (
        SELECT MAX(i2.end_date) FROM insurance i2 WHERE i2.vehicle_id = i.vehicle_id
      )
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
          type_text: getTypeText(i.insurance_type),
          status_text: '即将到期'
        })),
        expiredCount: expiredCount?.count || 0,
        activeCount: activeCount?.count || 0,
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
      insurance_types,
      insurance_company,
      policy_number,
      start_date,
      end_date,
      premium,
      coverage_amount,
      beneficiary,
      documents,
      remarks
    } = req.body;

    // 支持数组或单个值
    const typeStr = insurance_types 
      ? (Array.isArray(insurance_types) ? JSON.stringify(insurance_types) : insurance_types)
      : (insurance_type || '');
    
    if (!vehicle_id || !typeStr || !insurance_company || !start_date || !end_date) {
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
        start_date, end_date, premium, coverage_amount, beneficiary, documents, remarks, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, vehicle_id, plateNum, typeStr, insurance_company, policy_number || null,
        start_date, end_date, premium || 0, coverage_amount || 0, beneficiary || null,
        documents ? JSON.stringify(documents) : null,
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
      insurance_types,
      insurance_company,
      policy_number,
      start_date,
      end_date,
      premium,
      coverage_amount,
      beneficiary,
      documents,
      remarks,
      status
    } = req.body;

    const insurance = queryOne('SELECT * FROM insurance WHERE id = ?', [id]);
    if (!insurance) {
      res.status(404).json({ success: false, message: '保险记录不存在' });
      return;
    }

    // 支持数组或单个值
    const typeStr = insurance_types 
      ? (Array.isArray(insurance_types) ? JSON.stringify(insurance_types) : insurance_types)
      : (insurance_type || insurance.insurance_type);

    execute(
      `UPDATE insurance SET 
        vehicle_id = ?, insurance_type = ?, insurance_company = ?, policy_number = ?,
        start_date = ?, end_date = ?, premium = ?, coverage_amount = ?,
        beneficiary = ?, documents = ?, remarks = ?, status = ?, updated_at = ?
      WHERE id = ?`,
      [
        vehicle_id || insurance.vehicle_id,
        typeStr,
        insurance_company,
        policy_number || null,
        start_date,
        end_date,
        premium ?? 0,
        coverage_amount ?? 0,
        beneficiary || null,
        documents ? JSON.stringify(documents) : null,
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
