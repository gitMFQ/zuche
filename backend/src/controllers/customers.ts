import { Response } from 'express';
import { query, queryOne, execute, generateId, now, queryWithPagination } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 获取客户列表
export function getCustomers(req: AuthRequest, res: Response): void {
  try {
    const { page = 1, pageSize = 10, keyword = '', status = '' } = req.query;
    
    let sql = `
      SELECT c.*, s.color as source_color
      FROM customers c
      LEFT JOIN order_sources s ON c.source_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (keyword) {
      sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.id_card LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (status !== '') {
      sql += ' AND c.status = ?';
      params.push(Number(status));
    }

    sql += ' ORDER BY c.created_at DESC';

    const result = queryWithPagination(sql, params, Number(page), Number(pageSize));
    
    // 解析图片JSON
    result.data = result.data.map((c: any) => {
      let idCardImages = [];
      let licenseImages = [];
      try {
        idCardImages = c.id_card_images ? JSON.parse(c.id_card_images) : [];
      } catch {
        idCardImages = [];
      }
      try {
        licenseImages = c.license_images ? JSON.parse(c.license_images) : [];
      } catch {
        licenseImages = [];
      }
      return {
        ...c,
        id_card_images: idCardImages,
        license_images: licenseImages
      };
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取客户列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取单个客户
export function getCustomer(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const customer = queryOne(`
      SELECT c.*, s.color as source_color
      FROM customers c
      LEFT JOIN order_sources s ON c.source_id = s.id
      WHERE c.id = ?
    `, [id]);

    if (!customer) {
      res.status(404).json({ success: false, message: '客户不存在' });
      return;
    }

    // 获取该客户的订单记录
    const orders = query(`
      SELECT o.*, v.plate_number, v.brand, v.model
      FROM orders o
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      WHERE o.customer_id = ?
      ORDER BY o.created_at DESC
      LIMIT 10
    `, [id]);

    res.json({ success: true, data: { ...customer, orders } });
  } catch (error) {
    console.error('获取客户错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 创建客户
export function createCustomer(req: AuthRequest, res: Response): void {
  try {
    const { name, phone, id_card, license_number, license_expiry, address, remarks, id_card_images, license_images, source_id } = req.body;

    if (!name || !phone) {
      res.status(400).json({ success: false, message: '姓名和手机号不能为空' });
      return;
    }

    // 检查手机号是否已存在
    const existing = queryOne('SELECT id FROM customers WHERE phone = ?', [phone]);
    if (existing) {
      res.status(400).json({ success: false, message: '该手机号已存在' });
      return;
    }

    // 检查身份证是否已存在
    if (id_card) {
      const existingIdCard = queryOne('SELECT id FROM customers WHERE id_card = ?', [id_card]);
      if (existingIdCard) {
        res.status(400).json({ success: false, message: '该身份证号已存在' });
        return;
      }
    }

    // 获取来源名称
    let sourceName = null;
    if (source_id) {
      const source = queryOne('SELECT name FROM order_sources WHERE id = ? AND status = 1', [source_id]);
      if (source) {
        sourceName = source.name;
      }
    }

    const id = generateId();
    const currentTime = now();

    execute(
      `INSERT INTO customers (id, name, phone, id_card, license_number, license_expiry, address, remarks, id_card_images, license_images, source_id, source_name, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, name, phone, id_card || null, license_number || null, license_expiry || null, address || null, remarks || null, 
       id_card_images ? JSON.stringify(id_card_images) : null, 
       license_images ? JSON.stringify(license_images) : null, 
       source_id || null, sourceName, currentTime, currentTime]
    );

    res.json({ 
      success: true, 
      data: { id, name, phone },
      message: '客户创建成功' 
    });
  } catch (error) {
    console.error('创建客户错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 更新客户
export function updateCustomer(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const { name, phone, id_card, license_number, license_expiry, address, remarks, status, id_card_images, license_images, source_id } = req.body;

    const customer = queryOne('SELECT id FROM customers WHERE id = ?', [id]);
    if (!customer) {
      res.status(404).json({ success: false, message: '客户不存在' });
      return;
    }

    // 检查手机号是否被其他客户使用
    if (phone) {
      const existingPhone = queryOne('SELECT id FROM customers WHERE phone = ? AND id != ?', [phone, id]);
      if (existingPhone) {
        res.status(400).json({ success: false, message: '该手机号已被其他客户使用' });
        return;
      }
    }

    // 获取来源名称
    let sourceName = null;
    if (source_id) {
      const source = queryOne('SELECT name FROM order_sources WHERE id = ? AND status = 1', [source_id]);
      if (source) {
        sourceName = source.name;
      }
    }

    execute(
      `UPDATE customers SET name = ?, phone = ?, id_card = ?, license_number = ?, license_expiry = ?, address = ?, remarks = ?, status = ?, id_card_images = ?, license_images = ?, source_id = ?, source_name = ?, updated_at = ? WHERE id = ?`,
      [name, phone, id_card || null, license_number || null, license_expiry || null, address || null, remarks || null, status, 
       id_card_images ? JSON.stringify(id_card_images) : null, 
       license_images ? JSON.stringify(license_images) : null, 
       source_id || null, sourceName, now(), id]
    );

    res.json({ success: true, message: '客户更新成功' });
  } catch (error) {
    console.error('更新客户错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 删除客户
export function deleteCustomer(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;

    // 检查是否有未完成的订单
    const activeOrders = queryOne(
      "SELECT COUNT(*) as count FROM orders WHERE customer_id = ? AND status IN ('pending', 'active')",
      [id]
    );

    if (activeOrders && activeOrders.count > 0) {
      res.status(400).json({ success: false, message: '该客户有未完成的订单，无法删除' });
      return;
    }

    execute('DELETE FROM customers WHERE id = ?', [id]);
    res.json({ success: true, message: '客户删除成功' });
  } catch (error) {
    console.error('删除客户错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取常用客户列表
export function getRegularCustomers(req: AuthRequest, res: Response): void {
  try {
    const customers = query(`
      SELECT id, name, phone, id_card, license_number, license_expiry, is_regular
      FROM customers 
      WHERE status = 1 AND is_regular = 1
      ORDER BY name ASC
    `);
    
    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('获取常用客户列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 设置/取消常用客户
export function setRegularCustomer(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const { is_regular } = req.body;

    const customer = queryOne('SELECT id FROM customers WHERE id = ?', [id]);
    if (!customer) {
      res.status(404).json({ success: false, message: '客户不存在' });
      return;
    }

    execute('UPDATE customers SET is_regular = ?, updated_at = ? WHERE id = ?', [is_regular ? 1 : 0, now(), id]);
    
    res.json({ 
      success: true, 
      message: is_regular ? '已设为常用客户' : '已取消常用客户' 
    });
  } catch (error) {
    console.error('设置常用客户错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
