import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { customerRoutes } from './routes/customers.js';
import { vehicleRoutes } from './routes/vehicles.js';
import { orderRoutes } from './routes/orders.js';
import { violationRoutes } from './routes/violations.js';
import { blacklistRoutes } from './routes/blacklist.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { orderSourceRoutes } from './routes/orderSources.js';
import { maintenanceRoutes } from './routes/maintenance.js';
import { insuranceRoutes } from './routes/insurance.js';
import { inspectionRoutes } from './routes/inspections.js';
import { settingRoutes } from './routes/settings.js';
import { logRoutes } from './routes/logs.js';
import { scheduleRoutes } from './routes/schedules.js';
import { uploadRoutes } from './routes/uploads.js';

import { initDatabase, runMigrations } from './db/index.js';

const app = new Hono();

// 中间件
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// 初始化数据库 (仅在本地开发时使用)
app.use('*', async (c, next) => {
  if (!c.env.DB) {
    // 如果没有绑定 D1，使用内存数据库用于测试
    console.warn('⚠️ 未检测到 D1 数据库绑定，使用内存数据库');
  }
  await next();
});

// 路由注册
app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/customers', customerRoutes);
app.route('/api/vehicles', vehicleRoutes);
app.route('/api/orders', orderRoutes);
app.route('/api/violations', violationRoutes);
app.route('/api/blacklist', blacklistRoutes);
app.route('/api/dashboard', dashboardRoutes);
app.route('/api/order-sources', orderSourceRoutes);
app.route('/api/maintenance', maintenanceRoutes);
app.route('/api/insurance', insuranceRoutes);
app.route('/api/inspections', inspectionRoutes);
app.route('/api/settings', settingRoutes);
app.route('/api/logs', logRoutes);
app.route('/api/schedules', scheduleRoutes);
app.route('/api/upload', uploadRoutes);

// 健康检查
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'development'
  });
});

// 404 处理
app.notFound((c) => {
  return c.json({ 
    success: false, 
    message: `Route ${c.req.method} ${c.req.path} not found` 
  }, 404);
});

// 错误处理
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ 
    success: false, 
    message: err.message || '服务器内部错误' 
  }, 500);
});

export default app;
