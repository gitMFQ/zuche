import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import type { Env } from '../middleware/auth.js';

export const vehicleRoutes = new Hono();

vehicleRoutes.get('/', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const vehicles = await db.prepare('SELECT * FROM vehicles ORDER BY created_at DESC').all();
    return c.json({ success: true, data: vehicles.results || [] });
  } catch (error) {
    console.error('获取车辆列表失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

vehicleRoutes.get('/available', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const vehicles = await db.prepare("SELECT * FROM vehicles WHERE status = 'available'").all();
    return c.json({ success: true, data: vehicles.results || [] });
  } catch (error) {
    console.error('获取可用车辆失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

vehicleRoutes.get('/brands', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const brands = await db.prepare('SELECT DISTINCT brand FROM vehicles').all();
    return c.json({ success: true, data: brands.results.map((b: any) => b.brand) });
  } catch (error) {
    console.error('获取品牌列表失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

vehicleRoutes.get('/:id', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    const vehicle = await db.prepare('SELECT * FROM vehicles WHERE id = ?').bind(c.req.param('id')).first();
    if (!vehicle) return c.json({ success: false, message: '车辆不存在' }, 404);
    return c.json({ success: true, data: vehicle });
  } catch (error) {
    console.error('获取车辆失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

vehicleRoutes.post('/', authMiddleware, async (c: any) => {
  try {
    const body = await c.req.json();
    const { plate_number, brand, model, color, year, seats, mileage, daily_rate, weekly_rate, monthly_rate, deposit, vin, engine_number, license_image, registration_image, is_new_energy } = body;
    
    if (!plate_number || !brand || !model) {
      return c.json({ success: false, message: '车牌号、品牌和型号为必填项' }, 400);
    }
    
    const vehicleId = crypto.randomUUID();
    const db = (c.env as Env).DB;
    await db.prepare(
      'INSERT INTO vehicles (id, plate_number, brand, model, color, year, seats, mileage, daily_rate, weekly_rate, monthly_rate, deposit, vin, engine_number, license_image, registration_image, is_new_energy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(vehicleId, plate_number, brand, model, color, year, seats, mileage, daily_rate, weekly_rate, monthly_rate, deposit, vin, engine_number, license_image, registration_image, is_new_energy ? 1 : 0).run();
    
    return c.json({ success: true, message: '车辆创建成功' });
  } catch (error) {
    console.error('创建车辆失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

vehicleRoutes.put('/:id', authMiddleware, async (c: any) => {
  try {
    const body = await c.req.json();
    const { plate_number, brand, model, color, year, seats, mileage, daily_rate, weekly_rate, monthly_rate, deposit, status, vin, engine_number, license_image, registration_image, is_new_energy } = body;
    const vehicleId = c.req.param('id');
    
    const db = (c.env as Env).DB;
    await db.prepare(
      'UPDATE vehicles SET plate_number = ?, brand = ?, model = ?, color = ?, year = ?, seats = ?, mileage = ?, daily_rate = ?, weekly_rate = ?, monthly_rate = ?, deposit = ?, status = ?, vin = ?, engine_number = ?, license_image = ?, registration_image = ?, is_new_energy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(plate_number, brand, model, color, year, seats, mileage, daily_rate, weekly_rate, monthly_rate, deposit, status, vin, engine_number, license_image, registration_image, is_new_energy ? 1 : 0, vehicleId).run();
    
    return c.json({ success: true, message: '车辆更新成功' });
  } catch (error) {
    console.error('更新车辆失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

vehicleRoutes.delete('/:id', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    await db.prepare('DELETE FROM vehicles WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ success: true, message: '车辆删除成功' });
  } catch (error) {
    console.error('删除车辆失败:', error);
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});
