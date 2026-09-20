# AGENTS.md - 租车公司管理系统

面向 AI Agent 的开发速查。按这份文件写就不会走偏；详细的部署与运维步骤见 `README.md`，历史变更见 `CHANGELOG.md`。

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

> 环境要求：Node **20.19+ / 22.12+**（Vite 8 的硬性要求）。

## 目录结构
```
src/index.ts               Hono 出口、/health、/uploads/*、onError/notFound
src/routes/index.ts        /api 下的全部业务路由
src/routes/upload.ts       7 个上传端点 + 从 R2 读回
src/controllers/*.ts       业务处理，签名统一 async (c: AppContext) => Promise<Response>
src/db/helpers.ts          query/queryOne/execute/queryWithPagination/batchExecute
src/db/rows.ts             各表行类型
src/lib/*                  auth(jwt)/ids/time/request/errors/log/json
src/middleware/auth.ts     authMiddleware、adminOnly
src/types.ts               Bindings、AppContext

migrations/                D1 迁移 SQL（0001_schema / 0002_indexes / 0003_seed）

frontend/src/
├── api/index.ts           API 封装，baseURL 是相对路径 /api
├── components/            公共组件（Sk* 为 Apple 风格基础件，*Tab.vue 为业务分栏）
├── layouts/               布局组件
├── router/                路由（createWebHistory）
├── stores/                Pinia
├── utils/constants.ts     公共常量（支付/订单/服务类型映射）
├── utils/helpers.ts       格式化与状态映射工具
├── views/                 页面视图
└── style.css              全局样式，Apple 设计 token 都在里面
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
- 本地 `wrangler dev` 的数据在 `.wrangler/state`，删掉即重置

**操作日志**（`src/lib/log.ts`，失败不影响主业务）：
```typescript
await logAction(db, {
  userId: getAuthUser(c)?.id ?? '',
  action: '创建订单',
  entityType: 'order',
  entityId: orderId,
  details: `创建订单 ${orderNo}`,
  ipAddress: getClientIp(c)
});
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
JWT 有效期 1 年，前端存 `localStorage.token`。密钥取自 `c.env.JWT_SECRET`，
**不要**依赖 `src/lib/auth.ts` 里的 `DEFAULT_SECRET`（公开代码里的默认值，仅本地兜底）。

## 文件上传
- 端点：`/api/upload` 或 `/api/upload/{inspection|insurance|violation|maintenance|vehicle|customer}`
- 表单字段名固定为 `image`；仅 `insurance` 支持 PDF，其余仅图片；上限 10MB
- 可选字段 `name`：语义化文件名（如 `京A12345-行驶证`），后端清洗后拼成
  `{dir}/{name}-{YYYYMMDD-HHmmss}-{随机6位}.jpg`，未传时用各类型默认名
- 返回 `{ success: true, data: { filename, url: '/uploads/{dir}/{file}', type } }`
- `/uploads/*` 由 Worker 从 R2 读回，带 `Cache-Control: immutable`
- key 允许中文，`serveUpload` 用 `SAFE_NAME` 逐段校验防路径穿越，两边规则要一起改

## 业务规则
**订单状态流转：**
```
pending (待取车) → active (已取车) → completed (已还车)
                 ↘ cancelled (已取消)
```

**支付方式：** `platform` 平台支付、`wechat` 微信、`alipay` 支付宝、`cash` 现金、`bank` 银行转账、`other` 其他

**支付类型：** `rent` 租金、`deposit` 押金、`rent_deposit` 租金+押金、`violation_deposit` 违章押金、`damage` 车损、`other` 其他

**调度生成规则**（`GET /api/schedules/recent`）：
- 送车任务：从待取车 (pending) 订单提取取车时间和位置
- 收车任务：从已取车 (active) 订单提取还车时间和位置
- 仅显示当前时间及以后的调度，按时间升序排列

## 数据表（13 张）
| 表名 | 说明 |
|---|---|
| users | 用户（username, password, role, phone, email） |
| customers | 客户（is_regular、source_id、证件照片） |
| vehicles | 车辆（is_new_energy、vin、engine_number、证件照片） |
| orders | 订单（来源、服务类型、免押、里程、取还车照片） |
| payments | 支付记录 |
| order_sources | 订单来源（佣金比例、颜色） |
| violations | 违章记录 |
| blacklist | 黑名单 |
| maintenance | 保养记录 |
| insurance | 保险记录 |
| inspections | 年检证 |
| system_settings | 系统设置 |
| operation_logs | 操作日志 |

## 前端约定
- **API 调用**：统一走 `frontend/src/api/index.ts` 封装的对象，不要裸写 axios
- **常量与映射**：用 `utils/constants.ts`（`PAYMENT_METHOD_OPTIONS`、`ORDER_STATUS_TYPE_MAP` 等），不要在组件里硬编码中文映射
- **工具函数**：用 `utils/helpers.ts`（`getImageUrl`、`formatDateTime`、`isExpiringSoon` 等）
- **移动端优先**：断点以 `@media (min-width: 768px)` 区分移动端与桌面
- **图片导出**：调度图导出用 `html2canvas`
- **同源部署**：前后端同一个域，图片直接用后端返回的 `/uploads/...` 相对路径，不要拼域名
- **图片链接**：一律经 `getImageUrl`（`/cdn-cgi/image/width=600,format=auto` 前缀），
  Logo 用 `getLogoUrl`（`width=200`）；直接写 `:src="row.image"` 会绕过 CDN 压缩

## 设计系统（Apple 风格）
设计 token 全部定义在 `frontend/src/style.css`（`--sk-*` 变量），`frontend/src/components/Sk*.vue`
是对应的基础组件（SkButton/SkCard/SkSection/SkTypography/SkNavGlass）。业务页面用的是 Element Plus
组件，主题色已固定为全局 Apple Blue `#0071e3`（`--sk-focus-color`），不支持用户在系统设置里自定义。

- **唯一强调色** Apple Blue `#0071e3`，只用在可交互元素上
- **背景**：纯黑 `#000000` 与浅灰 `#f5f5f7` 交替分章节；深色卡片 `#272729`-`#2a2a2d`
- **文本**：`#1d1d1f` 主文本、`rgba(0,0,0,.8)` 次要、`rgba(0,0,0,.48)` 三级
- **字体**：SF Pro Display（≥20px）/ SF Pro Text（<20px），全尺寸负字间距；标题行高 1.07-1.14，正文 1.47
- **圆角**：5px 小容器、8px 按钮/卡片、11px 输入框与筛选、980px 药丸 CTA、50% 圆形控件
- **间距**：8px 基础单位，大尺寸取 14/15/17/20/24px
- **阴影**：只给 elevated 卡片用 `rgba(0,0,0,.22) 3px 5px 30px 0px`
- **导航栏**：毛玻璃 `backdrop-filter: saturate(180%) blur(20px)`，高度 48px

**禁忌**：额外强调色、重阴影/多层阴影、卡片可见边框、宽字间距、800/900 字重、背景纹理或渐变、
不透明导航栏、正文居中对齐。

## 代码规范
- 后端：controller 返回 `Promise<Response>`，错误统一交给 `handleError`
- 前端：Composition API + `<script setup>`，Pinia 状态管理
- 命名：文件 kebab-case，函数 camelCase，数据库 snake_case

## 默认账号
用户名: `admin` / 密码: `admin123`（写在 `migrations/0003_seed.sql`，上线后必须改）

## 绝对禁止
- 类型抑制 (`as any`, `@ts-ignore`)
- 空 catch 块
- SQL 字符串拼接（含 LIMIT/OFFSET，必须参数绑定）
- 跳过类型检查提交
- 日志中记录敏感信息 (密码、token)
