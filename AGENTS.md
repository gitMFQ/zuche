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
# 验证方式（CI 会跑 verify 里的全部内容，见 .github/workflows/ci.yml）
npm run verify             # typecheck + lint + test 一条命令跑完（提交前跑这个）
npm run typecheck          # 前后端都检查
npm run typecheck:worker   # npx tsc -p tsconfig.worker.json --noEmit
npm run typecheck:web      # npx vue-tsc -p tsconfig.frontend.json --noEmit
npm run test               # vitest run（后端纯逻辑单测，test/ 目录）
npm run lint               # biome check（只覆盖 src/ 与 test/，见下方说明）
```

> **单测范围**：`test/` 下覆盖时区基准、金额计算、订单号、签名 URL、魔数校验、
> JSON 兼容、导入列映射这些纯逻辑。改这些模块（尤其 `lib/time.ts`、`lib/import/`、
> `lib/orderAmount.ts`）必须先让 `npm run test` 通过。
>
> **lint 范围**：`biome.json` 只包含 `src/**` 与 `test/**`。`.vue` 文件被排除是**有意**的 ——
> biome 不认识 `<script setup>` 的模板用法，会对模板里用到的导入报一堆
> `noUnusedImports` 误报。前端类型由 `vue-tsc` 把关。
>
> 环境要求：Node **20.19+ / 22.12+**（Vite 8 的硬性要求）。

## 目录结构
```
src/index.ts               Hono 出口、/health、/uploads/*、onError/notFound
src/routes/index.ts        /api 下的全部业务路由
src/routes/upload.ts       7 个上传端点 + 从 R2 读回
src/controllers/*.ts       业务处理，签名统一 async (c: AppContext) => Promise<Response>
src/db/helpers.ts          query/queryOne/execute/queryWithPagination/batchExecute
src/db/rows.ts             各表行类型
src/lib/*                  auth(jwt)/ids/time/request/errors/log/json/constants
                           /orderAmount/vehicles/uploadGuard/uploadUrl
src/lib/import/            批量导入：normalize/templates/validate
src/middleware/auth.ts     authMiddleware、adminOnly
src/types.ts               Bindings、AppContext

scripts/dev-backend.mjs    本机跑不起 workerd 时的本地后端：node:sqlite + 本地目录替代 D1/R2，
                           首次启动自动跑 migrations/ 并灌 scripts/seed-demo.sql

migrations/                D1 迁移 SQL（0001_schema … 0017_self_owned_owner，按文件名顺序 apply）

frontend/src/
├── api/index.ts           API 封装，baseURL 是相对路径 /api
├── api/types.ts           前端接口类型，与后端 src/db/rows.ts 行类型对应
├── components/            公共组件：order/（订单表单与各业务弹窗）、dashboard/（甘特图、统计卡）、
│                          vehicle/（车辆选择器与车务表单弹窗）；另有 *Tab.vue 业务分栏、
│                          ImagePreviewDialog.vue、DataState.vue
├── composables/           useMobile（768px 断点）、useQuerySync（筛选/分页与 URL query 同步）
├── layouts/               布局组件
├── router/                路由（createWebHistory）
├── stores/                Pinia
├── utils/constants.ts     公共常量（支付/订单/服务类型映射）
├── utils/helpers.ts       格式化与状态映射工具
├── utils/image.ts         上传前压缩（最长边 1600px、≤500KB、WebP）
├── utils/upload.ts        validateUploadFile 上传前校验
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
JWT 有效期 7 天，前端存 `localStorage.token`。密钥取自 `c.env.JWT_SECRET`，
**必填**：`lib/auth.ts` 已移除默认值兜底，缺失时登录报「服务未正确配置」。
令牌可吊销：`users.token_version` 与 JWT 里的 `tv` 比对，改密码/重置密码/禁用/改角色时自增
（`middleware/auth.ts` 每个请求会多查一次 users 主键）。

## 文件上传
- 端点：`/api/upload` 或 `/api/upload/{inspection|insurance|violation|maintenance|vehicle|customer}`
- 表单字段名固定为 `image`；仅 `insurance` 支持 PDF，其余仅图片；**后端**上限 10MB
- **前端上传前统一压缩**（`frontend/src/api/index.ts` 的 `uploadImage` → `utils/image.ts`）：
  最长边 1600px、≤500KB、输出 WebP；PDF/GIF 与失败情况自动退回原图，绝不阻断上传
- 上传前校验统一用 `utils/upload.ts` 的 `validateUploadFile`（原始体积上限 50MB，只做防呆）
- 可选字段 `name`：语义化文件名（如 `京A12345-行驶证`），后端清洗后拼成
  `{dir}/{name}-{YYYYMMDD-HHmmss}-{随机6位}.webp`，未传时用各类型默认名
- 返回 `{ success: true, data: { filename, url: '/uploads/{dir}/{file}', type } }`
- **读回必须带签名**：对外 URL 形态是 `/uploads/{exp}.{sig}/{dir}/{file}`，`serveUpload` 校验
  HMAC 与过期时间（7 天）。签名放路径而非 query，因为前端会拼 `/cdn-cgi/image/<opts>/<路径>`，
  图像转换层不会透传 query。
- 签名是**响应后处理统一加的**（`lib/uploadUrl.ts` 的 `signUploadUrls` 中间件挂在 `/api` 上，
  递归替换响应体里所有 `/uploads/` 字符串）。新增返回图片的接口不需要手动签名；
  但**别在接口里返回已经签好的绝对链接**，让中间件统一处理
- 库里存规范路径即可（即使存到带签名的旧值也安全：对外前会先剥旧签名再重签）
- `/uploads/*` 由 Worker 从 R2 读回
- key 允许中文，`serveUpload` 用 `SAFE_NAME` 逐段校验防路径穿越，两边规则要一起改
- 上传前会校验文件魔数（`lib/uploadGuard.ts`），MIME 与真实格式不符直接 400

## 业务规则
**订单状态流转：**
```
pending (待取车) → active (已取车) → completed (已还车)
                 ↘ cancelled (已取消)
```

**支付方式：** `platform` 平台支付、`wechat` 微信、`alipay` 支付宝、`cash` 现金、`bank` 银行卡、`other` 其他

**支付类型：** `rent` 租金、`deposit` 押金、`rent_deposit` 租金+押金、`violation_deposit` 违章押金、`damage` 车损、`other` 其他

**调度生成规则**（`GET /api/schedules/recent`）：
- 送车任务：从待取车 (pending) 订单提取取车时间和位置
- 收车任务：从已取车 (active) 订单提取还车时间和位置
- 仅显示当前时间及以后的调度，按时间升序排列

## 数据表（30 张）
| 表名 | 说明 |
|---|---|
| users | 用户（username, password, role, phone, email） |
| customers | 客户（is_regular、source_id、证件照片） |
| vehicles | 车辆（is_new_energy、vin、engine_number、证件照片） |
| orders | 订单（来源、服务类型、免押、里程、取还车照片） |
| order_fees | 订单费用明细（fee_category 租金/服务费/押金/违约金/附加，保留平台原始名） |
| order_extensions | 续租记录（原/新还车时间、续租天数与金额） |
| import_batches | 批量导入批次（平台、文件名、成功/跳过行数） |
| payments | 支付记录 |
| order_sources | 订单来源（佣金比例、颜色） |
| violations | 违章记录 |
| blacklist | 黑名单 |
| maintenance | 保养记录 |
| insurance | 保险记录 |
| inspections | 年检证 |
| system_settings | 系统设置 |
| operation_logs | 操作日志 |
| login_attempts | 登录失败计数与锁定时长（限流） |
| owners | 车主/合伙人档案（role 一表两角色、company_fee_rate 公司费率、往来期初） |
| fund_accounts | 资金账户（公户/微信/支付宝/现金/虚拟，method_key 映射支付方式，opening_balance 期初） |
| fund_transactions | 资金流水（**余额不落库**、幂等键 source_type+source_id+source_kind、红字冲销链） |
| fund_transfers | 账户间划转（一次划转 = out + in 两条流水） |
| finance_period_locks | 账期锁定（锁住的月份禁止改流水与结算） |
| settlement_lines | 车主结算行（calc_* 系统口径 + 最终值双列，amount_overridden 保护人工调整） |
| settlement_openings | 年初结转（唯一键含冗余的 owner_vehicle_key，绕开 SQLite 里 NULL 互不相等） |
| settlement_payouts | 结算付款（结车款/预付款，每条产生一条 out 流水） |
| vehicle_expenses | 车辆费用台账（收支双列、发票状态、is_paid 决定是否写流水、业务单据镜像） |
| vehicle_expense_types | 车辆费用类型字典（12 类，default_direction 指明收支倾向） |
| operating_expenses | 运营开支台账（27 类项目，微信/公户） |
| expense_categories | 运营开支项目字典（台账原样的 27 项） |
| partner_advances | 合伙人往来账（开办费/垫资/工资/下账，direction in/out） |

## 财务模块（改动前必读）

三条口径**不能混着比较**：经营收入（`payments`，排除取消单）/ 结算收入（`settlement_lines`，
保留台账的 4 位小数）/ 现金余额（账户期初 + 流水净额）。详见 README 的「财务口径」。

- **余额不落库**，一律 `opening_balance + SUM(流水)` 派生（`lib/ledger.ts` 文件头有为什么不落库）。
  求和**不按 `opening_date` 过滤** —— 过滤会让补录的历史流水静默消失。
- **余额求和不能按 `status` 过滤**：冲销是「红字 + 原行标 reversed」两步，只算 posted 会让
  「原行 in 100 + 红字 out 100」变成 −100。
- **资金流水不物理删除**，删业务单据走红字冲销（`buildReverseStmts`）。
- **自动流水必须写进业务自己的 `batchExecute`**，绝不用 `logAction` 那种 catch-and-ignore，
  否则会出现「有收款无流水」且没有任何报错。账户解析不到时会被跳过而不是抛错（`buildFundTxnStmt`）。
- **结算金额双列**：`calc_*` 是系统口径、其余是最终值。重算一律
  `CASE WHEN amount_overridden = 1 THEN 原值 ELSE 新值 END`，否则用户手填的「其他费用」会被悄悄改回去。
- **金额精度用 6 位**（`lib/money.ts` 的 `MONEY_SCALE`），**不要**用 `lib/orderAmount.ts` 的
  `calcNetAmount`（整元）：台账的「公司管理费」是 4 位小数（`702.95 × 15% = 105.4425`），
  降到 2 位会让每一行与台账差半分。SQL 里计算金额要套 `ROUND(x, 6)`。
- **业务单据的车辆费用镜像行是只读的**：改金额去源单据，改付款状态在车辆费用页。
  已付款的镜像行会拦住源单据的金额修改与删除。
- 一致性体检分两层，`npm run verify` **都不包含**：
  `scripts/verify-finance.mjs`（只读数据库，34 项不变量）+ `scripts/verify-finance-api.mjs`
  （打接口验查询逻辑，需要后端在跑）。后者专盯「余额筛选不得改变余额绝对值」这类
  数据库层面看不出来的错误，改动 `getFundTransactions` 的 SQL 分层后必须跑。

## 前端约定
- **API 调用**：统一走 `frontend/src/api/index.ts` 封装的对象，不要裸写 axios
- **常量与映射**：用 `utils/constants.ts`（`PAYMENT_METHOD_OPTIONS`、`ORDER_STATUS_TYPE_MAP` 等），不要在组件里硬编码中文映射
- **工具函数**：用 `utils/helpers.ts`（`getImageUrl`、`formatDateTime`、`isExpiringSoon` 等）；
  上传相关的额外两个文件：`utils/image.ts`（压缩）、`utils/upload.ts`（上传前校验）
- **别在组件里手写上传校验**（MIME / 体积），统一用 `validateUploadFile`
- **移动端优先**：断点以 `@media (min-width: 768px)` 区分移动端与桌面
- **页面宽度**：业务页容器（`.page-container` / 首页的 `.dashboard`）**不设 `max-width`**，
  一律铺满主内容区；不要在 scoped 里加 `max-width: 1200px; margin: 0 auto`。
  唯一例外是订单详情页（600px 单列，它的按钮是整行 `block` 的）
- **表格列宽**：`<el-table-column>` 用 `min-width` 而不是 `width`。全列写死 `width` 时
  Element Plus 会把表格宽度定死为列宽之和（`table-layout` 里弹性列为空的分支），
  容器再宽表格也不铺满、右侧留一条空白
- **图片导出**：调度图导出用 `html2canvas`
- **同源部署**：前后端同一个域，图片直接用后端返回的 `/uploads/...` 相对路径，不要拼域名
- **图片链接**：一律经 `getImageUrl`（`/cdn-cgi/image/width=600,format=auto` 前缀），
  Logo 用 `getLogoUrl`（`width=200`）；直接写 `:src="row.image"` 会绕过 CDN 压缩

## 设计系统（Apple 风格）
设计 token 全部定义在 `frontend/src/style.css`（`--sk-*` 变量），业务页面用的是 Element Plus 组件，
主题色已固定为全局 Apple Blue `#0071e3`（`--sk-focus-color`），不支持用户在系统设置里自定义。
（早年的 `Sk*.vue` 基础组件已删除，样式一律走 style.css 的 token，不要再建同名组件。）

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
