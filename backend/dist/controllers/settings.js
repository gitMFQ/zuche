import { getDatabase } from '../db/index.js';
// 获取系统设置
export function getSettings(req, res) {
    try {
        const db = getDatabase();
        const rows = db.prepare("SELECT key, value FROM system_settings").all();
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = row.value || '';
        });
        res.json({ success: true, data: settings });
    }
    catch (error) {
        console.error('获取系统设置失败:', error);
        res.status(500).json({ success: false, message: '获取系统设置失败' });
    }
}
// 获取单个设置
export function getSetting(req, res) {
    try {
        const { key } = req.params;
        const db = getDatabase();
        const row = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(key);
        res.json({ success: true, data: row?.value ?? null });
    }
    catch (error) {
        console.error('获取设置失败:', error);
        res.status(500).json({ success: false, message: '获取设置失败' });
    }
}
// 更新系统设置
export function updateSettings(req, res) {
    try {
        const { key, value } = req.body;
        const db = getDatabase();
        if (!key) {
            res.status(400).json({ success: false, message: '缺少设置项名称' });
            return;
        }
        // 使用 INSERT OR REPLACE 来更新或插入
        db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(key, value || '');
        res.json({ success: true, message: '设置保存成功' });
    }
    catch (error) {
        console.error('保存系统设置失败:', error);
        res.status(500).json({ success: false, message: '保存系统设置失败' });
    }
}
