import { Response } from 'express';
import { query, queryOne, execute, generateId, now, queryWithPagination, logAction } from '../utils/helpers.js';
import { AuthRequest } from '../middleware/auth.js';

// 获取黑名单列表
export function getBlacklist(req: AuthRequest, res: Response): void {
  try {
    const { page = 1, pageSize = 10, keyword = '' } = req.query;
    
    let sql = 'SELECT * FROM blacklist WHERE status = 1';
    const params: any[] = [];

    if (keyword) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR id_card LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    sql += ' ORDER BY created_at DESC';

    const result = queryWithPagination(sql, params, Number(page), Number(pageSize));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取黑名单列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 检查是否在黑名单（根据手机号或身份证）
export function checkBlacklist(req: AuthRequest, res: Response): void {
  try {
    const { phone, id_card } = req.query;
    
    let sql = 'SELECT * FROM blacklist WHERE status = 1';
    const params: any[] = [];
    
    if (phone) {
      sql += ' AND phone = ?';
      params.push(phone);
    } else if (id_card) {
      sql += ' AND id_card = ?';
      params.push(id_card as string);
    } else {
      res.json({ success: true, data: { isBlacklisted: false } });
      return;
    }

    const record = queryOne(sql, params);

    res.json({ 
      success: true, 
      data: { 
        isBlacklisted: !!record,
        record: record || null
      } 
    });
  } catch (error) {
    console.error('检查黑名单错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 添加到黑名单
export function addToBlacklist(req: AuthRequest, res: Response): void {
  try {
    const { customer_id, name, phone, id_card, reason, order_id } = req.body;

    if (!name || !phone || !reason) {
      res.status(400).json({ success: false, message: '姓名、手机号和拉黑原因不能为空' });
      return;
    }

    // 检查是否已在黑名单
    const existing = queryOne('SELECT * FROM blacklist WHERE phone = ? AND status = 1', [phone]);
    if (existing) {
      res.status(400).json({ success: false, message: '该客户已在黑名单中' });
      return;
    }

    const id = generateId();
    const currentTime = now();
    const operatorId = req.user?.id;
    const operatorName = req.user?.name;

    execute(
      `INSERT INTO blacklist (id, customer_id, name, phone, id_card, reason, order_id, operator_id, operator_name, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, customer_id || null, name, phone, id_card || null, reason, order_id || null, operatorId, operatorName, currentTime, currentTime]
    );

    // 记录操作日志
    logAction(req.user?.id || '', '添加黑名单', 'blacklist', id, `添加黑名单：${name}，原因：${reason}`, req.ip);

    res.json({ 
      success: true, 
      data: { id },
      message: '已添加到黑名单' 
    });
  } catch (error) {
    console.error('添加黑名单错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 从黑名单移除
export function removeFromBlacklist(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    
    const record = queryOne('SELECT * FROM blacklist WHERE id = ?', [id]);
    if (!record) {
      res.status(404).json({ success: false, message: '记录不存在' });
      return;
    }

        execute('UPDATE blacklist SET status = 0, updated_at = ? WHERE id = ?', [now(), id]);

    

        // 记录操作日志

        logAction(req.user?.id || '', '移除黑名单', 'blacklist', id, `移除黑名单：${record.name}`, req.ip);

    

        res.json({ success: true, message: '已从黑名单移除' });
  } catch (error) {
    console.error('移除黑名单错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

// 获取黑名单详情
export function getBlacklistDetail(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const record = queryOne('SELECT * FROM blacklist WHERE id = ?', [id]);

    if (!record) {
      res.status(404).json({ success: false, message: '记录不存在' });
      return;
    }

    res.json({ success: true, data: record });
  } catch (error) {
    console.error('获取黑名单详情错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
