import { Response } from 'express';
import { query, queryOne, execute, generateId, now, queryWithPagination } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 获取订单来源列表
export function getOrderSources(req: AuthRequest, res: Response): void {
  try {
    const { page, pageSize, keyword } = req.query;
    
    let sql = 'SELECT * FROM order_sources WHERE status = 1';
    const params: any[] = [];

    if (keyword) {
      sql += ' AND name LIKE ?';
      params.push(`%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC';

    if (page && pageSize) {
      const result = queryWithPagination(sql, params, Number(page), Number(pageSize));
      res.json({ success: true, data: result });
    } else {
      const sources = query(sql, params);
      res.json({ success: true, data: sources });
    }
  } catch (error) {
    console.error('获取订单来源列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取单个订单来源
export function getOrderSource(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const source = queryOne('SELECT * FROM order_sources WHERE id = ?', [id]);

    if (!source) {
      res.status(404).json({ success: false, message: '订单来源不存在' });
      return;
    }

    res.json({ success: true, data: source });
  } catch (error) {
    console.error('获取订单来源错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 创建订单来源
export function createOrderSource(req: AuthRequest, res: Response): void {
  try {
    const { name, commission_rate, remarks } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: '来源名称不能为空' });
      return;
    }

    // 检查名称是否已存在
    const existing = queryOne('SELECT * FROM order_sources WHERE name = ? AND status = 1', [name]);
    if (existing) {
      res.status(400).json({ success: false, message: '该来源名称已存在' });
      return;
    }

    const id = generateId();
    const currentTime = now();

    execute(
      'INSERT INTO order_sources (id, name, commission_rate, remarks, status, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
      [id, name, commission_rate || 0, remarks || null, currentTime, currentTime]
    );

    res.json({ 
      success: true, 
      data: { id, name, commission_rate: commission_rate || 0 },
      message: '订单来源创建成功' 
    });
  } catch (error) {
    console.error('创建订单来源错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 更新订单来源
export function updateOrderSource(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const { name, commission_rate, remarks } = req.body;

    const source = queryOne('SELECT * FROM order_sources WHERE id = ?', [id]);
    if (!source) {
      res.status(404).json({ success: false, message: '订单来源不存在' });
      return;
    }

    // 检查名称是否与其他记录重复
    if (name && name !== source.name) {
      const existing = queryOne('SELECT * FROM order_sources WHERE name = ? AND status = 1 AND id != ?', [name, id]);
      if (existing) {
        res.status(400).json({ success: false, message: '该来源名称已存在' });
        return;
      }
    }

    const currentTime = now();

    execute(
      'UPDATE order_sources SET name = ?, commission_rate = ?, remarks = ?, updated_at = ? WHERE id = ?',
      [name || source.name, commission_rate ?? source.commission_rate, remarks ?? source.remarks, currentTime, id]
    );

    res.json({ success: true, message: '订单来源更新成功' });
  } catch (error) {
    console.error('更新订单来源错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 删除订单来源
export function deleteOrderSource(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    
    const source = queryOne('SELECT * FROM order_sources WHERE id = ?', [id]);
    if (!source) {
      res.status(404).json({ success: false, message: '订单来源不存在' });
      return;
    }

    // 检查是否有订单使用该来源
    const orders = queryOne('SELECT COUNT(*) as count FROM orders WHERE source_id = ?', [id]);
    if (orders && orders.count > 0) {
      res.status(400).json({ success: false, message: '该来源已被订单使用，无法删除' });
      return;
    }

    execute('UPDATE order_sources SET status = 0, updated_at = ? WHERE id = ?', [now(), id]);

    res.json({ success: true, message: '订单来源删除成功' });
  } catch (error) {
    console.error('删除订单来源错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
