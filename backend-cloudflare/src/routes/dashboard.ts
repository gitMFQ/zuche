import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import type { Env } from '../middleware/auth.js';

export const dashboardRoutes = new Hono();

dashboardRoutes.get('/stats', authMiddleware, async (c: any) => {
  try {
    const db = (c.env as Env).DB;
    return c.json({ 
      success: true, 
      data: { 
        todayPickups: 0, 
        todayReturns: 0, 
        pendingOrders: 0, 
        availableVehicles: 0 
      } 
    });
  } catch (error) {
    return c.json({ success: false, message: '服务器内部错误' }, 500);
  }
});

dashboardRoutes.get('/income', authMiddleware, async (c: any) => {
  return c.json({ success: true, data: [] });
});
