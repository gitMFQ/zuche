import { Request, Response } from 'express';
import { getDatabase, saveDatabase } from '../db/index.js';

// 获取系统设置
export function getSettings(req: Request, res: Response) {
  try {
    const db = getDatabase();
    const result = db.exec("SELECT key, value FROM system_settings");
    
    const settings: Record<string, string> = {};
    if (result.length > 0) {
      result[0].values.forEach((row: unknown[]) => {
        settings[row[0] as string] = row[1] as string || '';
      });
    }
    
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('获取系统设置失败:', error);
    res.status(500).json({ success: false, message: '获取系统设置失败' });
  }
}

// 获取单个设置
export function getSetting(req: Request, res: Response) {
  try {
    const { key } = req.params;
    const db = getDatabase();
    const result = db.exec("SELECT value FROM system_settings WHERE key = ?", [key]);
    
    if (result.length === 0 || result[0].values.length === 0) {
      res.json({ success: true, data: null });
      return;
    }
    
    res.json({ success: true, data: result[0].values[0][0] });
  } catch (error) {
    console.error('获取设置失败:', error);
    res.status(500).json({ success: false, message: '获取设置失败' });
  }
}

// 更新系统设置
export function updateSettings(req: Request, res: Response) {
  try {
    const { key, value } = req.body;
    const db = getDatabase();
    
    if (!key) {
      res.status(400).json({ success: false, message: '缺少设置项名称' });
      return;
    }
    
    // 使用 INSERT OR REPLACE 来更新或插入
    db.run(
      "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
      [key, value || '']
    );
    
    saveDatabase();
    res.json({ success: true, message: '设置保存成功' });
  } catch (error) {
    console.error('保存系统设置失败:', error);
    res.status(500).json({ success: false, message: '保存系统设置失败' });
  }
}
