import { Hono } from 'hono';
import { apiRoutes } from './routes/index';
import { serveUpload } from './routes/upload';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

// 健康检查
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 上传文件的读取（R2），保持 /uploads/{dir}/{file} 的 URL 语义
app.get('/uploads/*', serveUpload);

// 业务 API
app.route('/api', apiRoutes);

// 未命中的 /api 请求返回 JSON，而不是静态资源的 index.html
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ success: false, message: '接口不存在' }, 404);
  }
  return c.json({ success: false, message: '页面不存在' }, 404);
});

app.onError((error, c) => {
  console.error('未处理异常:', error);
  return c.json({ success: false, message: '服务器内部错误' }, 500);
});

export default app;
