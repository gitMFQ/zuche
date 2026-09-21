import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { apiRoutes } from './routes/index';
import { serveUpload } from './routes/upload';
import { execute, queryOne } from './db/helpers';
import type { AppEnv, Bindings } from './types';

const app = new Hono<AppEnv>();

/**
 * 安全响应头。
 *
 * 注意覆盖范围：只有 /api/* 与 /uploads/* 会进 Worker，HTML/JS/CSS 由 Static Assets
 * 直接返回，因此这里加不上页面的 CSP —— 页面的 CSP、X-Frame-Options 需要在
 * Cloudflare Zone 层用 Response Header Transform Rules 配置（见 README 的部署清单）。
 * 这里负责的是接口与文件响应本身：禁止 MIME 嗅探、禁止被 iframe 嵌套、
 * 强制 HTTPS、并且不把带签名的图片 URL 通过 Referer 泄露出去。
 */
app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    },
    referrerPolicy: 'no-referrer',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    xContentTypeOptions: 'nosniff',
    xFrameOptions: 'DENY'
  })
);

// 健康检查：真的探一下 D1 与 R2，否则「返回 ok」没有任何意义
app.get('/health', async (c) => {
  const [database, storage] = await Promise.all([
    queryOne<{ ok: number }>(c.env.DB, 'SELECT 1 AS ok')
      .then((row) => row?.ok === 1)
      .catch(() => false),
    // head 一个不存在的 key 也会返回 null，能正常返回就说明绑定可用
    c.env.UPLOADS.head('__health_probe__')
      .then(() => true)
      .catch(() => false)
  ]);

  const healthy = database && storage;

  return c.json(
    {
      status: healthy ? 'ok' : 'degraded',
      checks: { database, storage },
      timestamp: new Date().toISOString()
    },
    healthy ? 200 : 503
  );
});

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

/** 操作日志保留天数：建单/改单/登录都写一条，只增不删会吃掉 D1 存储并拖慢日志页查询 */
const LOG_RETENTION_DAYS = 180;
/** 登录失败计数保留时长：限流窗口只有 15 分钟，留一天足够排查 */
const LOGIN_ATTEMPT_RETENTION_HOURS = 24;

/**
 * 定时任务（cron 见 wrangler.jsonc 的 triggers，UTC 18:00 = 北京 02:00）。
 * 两个清理互不依赖，用 allSettled 并发执行，任一失败都不影响另一个。
 */
async function scheduled(_event: ScheduledController, env: Bindings): Promise<void> {
  const results = await Promise.allSettled([
    execute(env.DB, `DELETE FROM operation_logs WHERE created_at < datetime('now', '+8 hours', ?)`, [
      `-${LOG_RETENTION_DAYS} days`
    ]),
    execute(env.DB, `DELETE FROM login_attempts WHERE first_at < datetime('now', '+8 hours', ?)`, [
      `-${LOGIN_ATTEMPT_RETENTION_HOURS} hours`
    ])
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('定时清理失败:', result.reason);
    }
  }
}

export default {
  fetch: (request: Request, env: Bindings, ctx: ExecutionContext) => app.fetch(request, env, ctx),
  scheduled
};
