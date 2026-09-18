# AGENTS.md - 租车公司管理系统

## 技术栈
- 运行时：Cloudflare **Worker**（Hono 4），前后端一体部署
- 数据库：**D1**（SQLite 兼容），上传文件存 **R2**
- 前端：Vue 3 + Vite + TypeScript + Element Plus + Pinia
- 前端构建产物由 Worker 的 Static Assets 托管，**不需要单独部署**

## 启动命令
```bash
npm run dev         # 同时起 Worker(8787) 与 Vite(5173)
npm run dev:worker  # 只起 Worker：wrangler dev --port 8787
npm run dev:web     # 只起前端：vite
npm run build:web   # 构建前端到 frontend/dist
npm run deploy      # 构建前端 + wrangler deploy（一条命令上线）
```

```bash
# 类型检查（无测试框架、无 lint，这是唯一的验证方式）
npm run typecheck          # 前后端都检查
npm run typecheck:worker   # npx tsc -p tsconfig.worker.json --noEmit
npm run typecheck:web      # npx vue-tsc -p tsconfig.frontend.json --noEmit
```

## 数据库（D1）
**D1 是异步的，必须使用辅助函数，绝不直接调用 `c.env.DB.prepare()`：**
```typescript
import { query, queryOne, execute, queryWithPagination } from '../db/helpers';
const db = c.env.DB;                                  // 每个 handler 第一行取 db
const rows = await query<VehicleRow>(db, 'SELECT * FROM vehicles WHERE status = ?', [1]);
const vehicle = await queryOne<VehicleRow>(db, 'SELECT * FROM vehicles WHERE id = ?', [id]);
await execute(db, 'INSERT INTO vehicles (id, name) VALUES (?, ?)', [id, name]);
```
- 分页：`await queryWithPagination(db, sql, params, page, pageSize)`
  → `{ data, total, page, pageSize, totalPages }`，LIMIT/OFFSET 走参数绑定
- 多条写操作必须放进 `batchExecute(db, stmts)`（D1 的 batch 是隐式事务）
- 迁移：在 `migrations/` 下新增 `NNNN_xxx.sql`，然后
  `npm run d1:migrate`（本地）/ `npm run d1:migrate:remote`（线上）
- **D1 外键始终开启**：改动 schema 时必须显式决定 `ON DELETE` 行为
- 绑定参数传 `undefined` 会抛 `D1_TYPE_ERROR`，helpers 已兜底转成 `null`

## Worker 代码结构
```
src/index.ts              Hono 出口、/health、/uploads/*、onError/notFound
src/routes/index.ts       /api 下的全部业务路由
src/routes/upload.ts      7 个上传端点 + 从 R2 读回
src/controllers/*.ts      业务处理，签名统一为 async (c: AppContext) => Promise<Response>
src/db/helpers.ts         query/queryOne/execute/queryWithPagination/batchExecute
src/db/rows.ts            各表行类型
src/lib/*                 auth(jwt)/ids/time/request/errors/log/json
src/middleware/auth.ts    authMiddleware、adminOnly
```

## 请求上下文写法
| 旧 Express 写法 | 现在的写法 |
|---|---|
| `req.params.id` | `c.req.param('id')` |
| `req.query.page` | `c.req.query('page')` |
| `req.body` | `await c.req.json<T>()` |
| `res.json(d)` / `res.status(400).json(d)` | `return c.json(d)` / `return c.json(d, 400)` |
| `req.ip` | `getClientIp(c)`（优先 `cf-connecting-ip`） |
| `req.user?.id` | `getAuthUser(c)?.id` |
| try/catch → 500 | `return handleError(c, '标签:', error)` |

响应格式统一 `{ success: boolean, data?: any, message?: string }`。
JWT 有效期 1 年，前端存 `localStorage.token`。

## 文件上传
- 端点：`/api/upload` 或 `/api/upload/{inspection|insurance|violation|maintenance|vehicle|customer}`
- 表单字段名固定为 `image`；仅 `insurance` 支持 PDF，其余仅图片；上限 10MB
- 返回 `{ success: true, data: { filename, url: '/uploads/{dir}/{file}', type } }`
- `/uploads/*` 由 Worker 从 R2 读回，带 `Cache-Control: immutable`

## 代码规范
- 后端：controller 返回 `Promise<Response>`，错误统一交给 `handleError`
- 前端：Composition API + `<script setup>`，Pinia 状态管理
- 命名：文件 kebab-case，函数 camelCase，数据库 snake_case
- 前端与后端同源，图片直接用后端返回的相对路径，不要拼域名

## 默认账号
用户名: `admin` / 密码: `admin123`

## 绝对禁止
- 类型抑制 (`as any`, `@ts-ignore`)
- 空 catch 块
- SQL 字符串拼接（含 LIMIT/OFFSET，必须参数绑定）
- 跳过类型检查提交
- 日志中记录敏感信息 (密码、token)
