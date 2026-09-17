import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'

// 导入路由
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import customerRoutes from './routes/customers.js'
import vehicleRoutes from './routes/vehicles.js'
import orderRoutes from './routes/orders.js'
import violationRoutes from './routes/violations.js'
import blacklistRoutes from './routes/blacklist.js'
import maintenanceRoutes from './routes/maintenance.js'
import insuranceRoutes from './routes/insurance.js'
import inspectionRoutes from './routes/inspections.js'
import scheduleRoutes from './routes/schedules.js'
import settingsRoutes from './routes/settings.js'
import logRoutes from './routes/logs.js'
import uploadRoutes from './routes/upload.js'

export type Bindings = {
  DB: D1Database
  SETTINGS_KV: KVNamespace
  UPLOADS: R2Bucket
  JWT_SECRET: string
  ADMIN_PASSWORD: string
}

export type Variables = {
  userId: string
  username: string
  role: string
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 中间件
app.use('*', logger())
app.use('*', secureHeaders())
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// 健康检查
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: 'cloudflare-workers'
  })
})

// API 路由
app.route('/api/auth', authRoutes)
app.route('/api/users', userRoutes)
app.route('/api/customers', customerRoutes)
app.route('/api/vehicles', vehicleRoutes)
app.route('/api/orders', orderRoutes)
app.route('/api/violations', violationRoutes)
app.route('/api/blacklist', blacklistRoutes)
app.route('/api/maintenance', maintenanceRoutes)
app.route('/api/insurance', insuranceRoutes)
app.route('/api/inspections', inspectionRoutes)
app.route('/api/schedules', scheduleRoutes)
app.route('/api/settings', settingsRoutes)
app.route('/api/logs', logRoutes)
app.route('/api/upload', uploadRoutes)
app.route('/api/uploads', uploadRoutes)

// 404 处理
app.notFound((c) => {
  return c.json({ success: false, message: 'Not Found' }, 404)
})

// 错误处理
app.onError((err, c) => {
  console.error('Error:', err)
  return c.json({ success: false, message: 'Internal Server Error' }, 500)
})

export default app
