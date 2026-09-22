# 租车公司管理系统

一个功能完整的租车公司管理解决方案，支持车辆调度、订单管理、客户管理、财务统计等核心业务功能。

前后端一体部署在 **Cloudflare Worker** 上：Vue 前端构建产物由 Worker 的 Static Assets 托管，API、页面、上传文件共用同一个 Worker 与同一个域名，**只需要发布一次**。

- 开发速查（AI Agent 向）：[AGENTS.md](AGENTS.md)
- 历史变更：[CHANGELOG.md](CHANGELOG.md)

## 技术栈

| 层 | 选型 |
|---|---|
| 运行时 | Cloudflare Workers |
| 后端框架 | Hono 4 + TypeScript |
| 数据库 | Cloudflare D1（SQLite 兼容），17 张表 |
| 对象存储 | Cloudflare R2（上传的图片 / PDF，读取一律走签名 URL） |
| 认证 | JWT（**7 天**有效期，Web Crypto，可按用户吊销） |
| 定时任务 | Cloudflare Cron Triggers（清理过期日志与登录失败计数） |
| 前端 | Vue 3 + Vite + TypeScript + Element Plus（按需引入）+ Pinia |
| 验证 | vitest（后端纯逻辑单测）+ biome（lint）+ tsc / vue-tsc（类型检查） |

## 项目结构

```
zuche/
├── src/                          # Worker 源码
│   ├── index.ts                  # Hono 出口：secure-headers、/health、/uploads/*、
│   │                             #   onError/notFound、scheduled（cron 清理）
│   ├── routes/
│   │   ├── index.ts              # /api 下全部业务路由
│   │   └── upload.ts             # 7 个上传端点 + 从 R2 读回（校验签名）
│   ├── controllers/              # 业务控制器（auth/users/customers/vehicles/orders/
│   │                             #   orderSources/violations/maintenance/insurance/
│   │                             #   inspection/dashboard/schedules/settings/logs/
│   │                             #   blacklist/import）
│   ├── db/
│   │   ├── helpers.ts            # query/queryOne/execute/queryWithPagination/batchExecute
│   │   └── rows.ts               # 各表行类型
│   ├── lib/                      # 纯逻辑，单测就覆盖这一层：
│   │                             #   auth(jwt 签发/校验) / constants(枚举中文名) / errors
│   │                             #   ids(单号) / json(历史 JSON 形态兼容) / log(操作日志)
│   │                             #   orderAmount(金额计算) / request / time(北京时间)
│   │                             #   uploadGuard(文件魔数) / uploadUrl(签名 URL)
│   │                             #   vehicles(在租状态派生)
│   │   └── import/               # 批量导入：normalize(列映射) / templates(平台模板) /
│   │                             #            validate(导入预检)
│   ├── middleware/auth.ts        # authMiddleware、adminOnly
│   └── types.ts                  # Bindings、AppContext
│
├── migrations/                   # D1 迁移 SQL（11 个）
│   ├── 0001_schema.sql           # 13 张基础表
│   ├── 0002_indexes.sql
│   ├── 0003_seed.sql             # 管理员账号等种子数据
│   ├── 0004_import.sql           # 批量导入：order_fees / order_extensions / import_batches
│   ├── 0005_drop_order_source_platform.sql   # 订单来源不再区分所属平台
│   ├── 0006_vehicle_license_images.sql       # 行驶证改为多图（JSON 数组）
│   ├── 0007_timezone_unify.sql   # 存量时间统一到北京时间（含数据修正）
│   ├── 0008_auth_and_snapshot.sql            # 强制改密 / 令牌吊销 / login_attempts /
│   │                             #            订单车牌快照
│   ├── 0009_vehicle_status_derive.sql        # 车辆「已出租」改为由订单推导
│   ├── 0010_missing_indexes.sql
│   └── 0011_brand_color.sql      # 订单来源默认色归一成品牌蓝
├── scripts/
│   ├── seed-demo.sql             # 本地演示数据
│   └── dev-backend.mjs           # 应急本地后端（Node 版，见「本地开发」）
├── test/                         # vitest 单测：7 个文件，只测 src/lib 的纯逻辑
└── frontend/src/                 # 前端源码（构建产物 frontend/dist，不入库）
    ├── api/
    │   ├── index.ts              # API 封装，baseURL 为相对路径 /api
    │   └── types.ts              # 响应信封 / 分页 / 各实体类型
    ├── components/
    │   ├── order/                # 订单域：建单表单、延期、支付、司机指派、里程照片、
    │   │                         #   订单详情分节（6 个组件）
    │   ├── dashboard/            # 仪表盘：统计卡片、甘特图、调度表、订单详情弹窗
    │   ├── vehicle/              # 车辆域弹窗与选择器：保养/保险/违章表单、车辆选择
    │   ├── ImagePreviewDialog.vue、DataState.vue   # 通用展示：图片预览、空/加载/错误态
    │   └── *Tab.vue              # 业务分栏：Vehicles / Maintenance / Insurance /
    │                             #   Inspection / Violations / OrderSources / Users
    ├── composables/              # useMobile（响应式断点）、useQuerySync（筛选同步到 URL）
    ├── layouts/                  # MainLayout
    ├── router/                   # 路由（createWebHistory）
    ├── stores/                   # Pinia：user（登录态）、dict（来源/品牌等字典）
    ├── utils/                    # constants（枚举与映射）、helpers（格式化与状态映射）、
    │                             #   image（上传前压缩）、upload（上传前校验）
    ├── views/                    # 页面：Login/Dashboard/Orders/OrderDetail/OrderImport/
    │                             #   Customers/Vehicles/Settings/Logs/NotFound
    └── style.css                 # 全局样式 + Apple 设计 token（--sk-*）
```

> ⚠️ 用户管理、订单来源与违章**没有独立页面**：入口分别是 `Settings.vue` 里的 `<UsersTab />` 与
> `<OrderSourcesTab />`，以及 `Vehicles.vue` 的 `<ViolationsTab />`。别按菜单入口去找同名页面。

## 功能模块

### 业务规则

**订单状态流转：**
```
pending (待取车) → active (已取车) → completed (已还车)
                 ↘ cancelled (已取消)
```

`overdue`（已逾期）**不是库里的状态**，而是派生出来的：`active` 且 `end_date` 早于当前时间的订单即视为逾期，
展示与筛选都走派生，不落库、也不需要定时任务去改写它。

**支付方式：** platform（平台支付）、wechat（微信）、alipay（支付宝）、cash（现金）、bank（**银行卡**）、other（其他）

**支付类型：** rent（租金）、deposit（押金）、rent_deposit（租金+押金）、violation_deposit（违章押金）、damage（车损）、other（其他）

**调度生成规则：**
- 送车任务：从待取车 (pending) 订单提取取车时间和位置
- 收车任务：从已取车 (active) 订单提取还车时间和位置
- 仅显示当前时间及以后的调度，按时间升序排列

### 模块一览

| 模块 | 功能 |
|---|---|
| 仪表盘 | 今日取/还车、待处理订单、可用车辆；车辆状态分布、近 30 天订单趋势；调度甘特图与取还车调度表 |
| 订单管理 | 状态分类、服务类型（基础/优享/尊享）、免押与免押到期日、取还车（时间/地点/里程/照片）、延期、支付记录、合同号、司机指派 |
| 订单批量导入 | 上传携程 / 自有平台导出的 Excel → 预检（逐行校验 + 与客户车辆匹配）→ 提交入库 → 按批次撤销 |
| 客户管理 | 客户信息、常用客户标记、来源标记、证件与驾照照片、快速查看历史订单 |
| 车辆管理 | 车辆 CRUD、新能源标识、VIN/发动机号、行驶证多图（正副页）、详情弹窗；分页签承载保养/保险/年检/违章 |
| 违章管理 | 违章登记、罚款与扣分、多图上传、处理状态跟踪、押金扣款（车辆页「违章」分栏） |
| 黑名单 | 添加/移除、原因记录、手机号与身份证检查（客户管理页「黑名单」分栏） |
| 保养管理 | 按车辆查看、保养类型（常规/大保养/小修）、里程提醒、成本统计 |
| 保险管理 | 按车辆查看、险种多选（交强险/商业险/座位险）、到期提醒、保费统计 |
| 年检证 | 年检状态列表、证书图片、到期提醒 |
| 订单来源 | 渠道管理（门店直租/美团/携程/滴滴等）、佣金比例、渠道颜色（设置页分栏） |
| 用户管理 | 用户 CRUD、角色 admin/staff、改密与重置密码（设置页分栏） |
| 系统设置 | Logo、系统标题 |
| 操作日志 | 关键操作记录（操作类型、对象、详情、时间、IP） |

---

## 关键机制（接手前必读）

这几条是「为什么这么定」，改动前先看一眼，能省掉大量踩坑。

### 时区：全系统统一北京时间

`src/lib/time.ts` 的 `now()` 返回北京时间（`Asia/Shanghai`，固定 +8），SQL 侧对应写 `datetime('now','+8 hours')`。

早期实现直接 `toISOString()` 写 UTC，而用户通过 `datetime-local` 录入的时间是北京时间，
同一个库里出现过两套基准：车辆「是否在租」判定错 8 小时、调度列表边界错 8 小时、日志时间显示早 8 小时。
迁移 `0007_timezone_unify.sql` 对存量做了**分列修正**：系统写入的审计列（`created_at` / `updated_at` 等）统一 +8，
用户录入的业务列（订单起止时间、保养/违章/保险日期等）一律不动。

### 派生状态：不落库的两种状态

| 状态 | 怎么来的 |
|---|---|
| 订单 `overdue`（已逾期） | `active` 且 `end_date` < 当前时间 |
| 车辆「已出租」 | 存在 `pending`/`active` 订单且当前时间落在取还车区间内，见 `src/lib/vehicles.ts` 的 `busyVehicleIds()` |

`vehicles.status` 只表达**人工设定的可用性**（`available` / `maintenance` / `unavailable`），
早期它还能取 `rented`，但订单流转从不维护它，于是仪表盘「已出租」恒为 0、而列表又另算一套，
两处永远对不上。迁移 `0009` 把存量的 `rented` 归一成 `available`，是否在租一律由订单推导。

### 鉴权与安全

| 机制 | 现状 |
|---|---|
| JWT 有效期 | **7 天**（早期是 1 年），前端存 `localStorage.token` |
| 令牌吊销 | JWT 里带 `tv`（签发时的 `users.token_version`），中间件逐请求比对；改密码 / 重置密码 / 禁用 / 改角色时自增 |
| 登录限流 | 15 分钟内 `username:IP` 失败 5 次，锁定 15 分钟（`login_attempts` 表）。key 带 username 是因为门店常共用出口 IP，只按 IP 会互相误伤 |
| 密码哈希 | bcrypt cost 10（约 80ms，仍在 Workers CPU 限制内；12 约 300ms，不建议） |
| 首次登录强制改密 | 种子管理员带 `must_change_password=1`，登录返回该标记，前端据此弹出改密弹窗 |
| `JWT_SECRET` | **必填**。`src/lib/auth.ts` 已删掉默认密钥兜底，缺失时登录直接报「服务未正确配置」 |

登录支持用户名、姓名、手机号、邮箱任一匹配；失败登录也会写操作日志，否则被撞库时没有任何线索。
退出登录（`POST /api/auth/logout`）只落审计日志，**刻意不自增 `token_version`** —— 那会把该账号在其它设备上的会话一起踢掉。

### 上传文件：签名 URL

`/uploads/*` **不再公开可读**。对外 URL 形态是 `/uploads/{exp}.{sig}/{dir}/{file}`，
`serveUpload`（`src/routes/upload.ts`）校验 HMAC 与 7 天过期时间，无效一律 403。

- **签名放在路径里而不是 query 上**：前端展示图片会拼成 `/cdn-cgi/image/<opts>/<源路径>`，
  Cloudflare 的图像转换层不透传 query，只有路径能保证签名到达 Worker。
- **签名是响应后处理统一加的**：`src/lib/uploadUrl.ts` 的 `signUploadUrls` 中间件挂在 `/api` 上，
  递归替换响应体里所有 `/uploads/` 字符串。所以新增返回图片的接口**不用手动签名**；
  反过来，也别在接口里返回已经签好的绝对链接，交给中间件。
- 库里存规范路径即可（即使存着带签名的旧值也安全：对外前会先剥掉旧签名再重签）。
- 签名密钥由 `JWT_SECRET` 派生（不额外引入 secret），因此 **`JWT_SECRET` 缺失会让 `/uploads/*` 全部 403**。

### 健康检查与定时任务

`GET /health` 会**真探一次** D1 与 R2，返回 `{ status: ok|degraded, checks: { database, storage } }`，
`degraded` 时状态码 503 —— 只返回 200 的健康检查等于没有。它是公开的，不需要登录。

`wrangler.jsonc` 的 `triggers.crons`（`0 18 * * *`，UTC 18:00 = 北京 02:00）每天跑一次 `scheduled`：
清理 180 天前的操作日志与 24 小时前的登录失败计数。两者互不依赖，用 `allSettled` 并发，任一失败不影响另一个。

### 前端：Element Plus 按需引入与图标硬约束

组件由 `unplugin-vue-components` + `ElementPlusResolver` 按需引入（`vite.config.ts`），
早期是 `app.use(ElementPlus)` 全量注册，tree-shaking 完全失效，主包 874KB；改完主包约 45KB，各组件独立分包。
样式仍走全量 `element-plus/dist/index.css`（CSS 是独立产物，不影响主 JS 体积，全量更稳，不会漏 ElMessage 这类命令式 API 的样式）。

**由此带来的坑**：图标不再全局注册，必须逐个 `import { Plus } from '@element-plus/icons-vue'`。
裸图标名不会被自动解析，字符串式 `icon="Plus"` **永远不显示**，必须写成绑定式 `:icon="Plus"`。
排查「按钮/菜单图标不显示」时先看这一条。

---

## 快速开始

### 环境要求
- Node.js **20.19+ / 22.12+**（Vite 8 的硬性要求；Node 后端方案用到 `node:sqlite`，需 22.5+）
- npm
- Cloudflare 账号（仅上线时需要）

### 安装与开发

```bash
npm install
npm run dev
```

`npm run dev` 同时起两个服务：
- Worker（含 D1、R2 本地模拟）：http://localhost:8787
- 前端 Vite（HMR，`/api`、`/uploads`、`/cdn-cgi` 已代理到 8787）：http://localhost:5173

首次启动前初始化本地数据库：

```bash
npm run d1:migrate                                  # 应用 migrations/ 到本地 D1
npx wrangler d1 execute zjzc --local \
  --file=./scripts/seed-demo.sql                    # 可选：灌入演示数据
```

### 本地开发：如果 `wrangler dev` 起不来

某些环境（典型是 aarch64 且用户态虚拟地址空间不足 48 位）里 workerd 一启动就 Aborted：

```
tcmalloc: MmapAligned() failed - unable to allocate with tag (alignment=1073741824)
CHECK in AllocSlow: FATAL ERROR: Out of memory trying to allocate internal tcmalloc data
```

（`wrangler --version` 能跑是因为它不启动 workerd。）这时改用 Node 版本地后端 `scripts/dev-backend.mjs`：
它用 esbuild 把**同一份** `src/index.ts` 打成 Node ESM，起一个 `node:http` 服务，把绑定换成等价的本地实现
—— D1 → `node:sqlite`（数据文件 `.wrangler/state/dev-node/data.sqlite`，开启外键）、
R2 → 本地目录 `.wrangler/state/dev-node/r2`、`caches.default` → 空实现。
接口路径、签名机制与真实 Worker 一致。

```bash
node scripts/dev-backend.mjs        # 默认 8787，PORT=9000 可改
npm run dev:web                     # 前端单独起（需要对外访问时加 -- --host 0.0.0.0）
```

- 启动时会**自动**按序跑完 `migrations/*.sql` 并灌入 `scripts/seed-demo.sql`，不需要再手工执行迁移
- 重置数据 = 删掉 `.wrangler/state/dev-node/data.sqlite`
- `JWT_SECRET` 默认 `local-dev-jwt-secret`
- 它**不参与部署**，`package.json` 里也没有对应 script（正常环境请用 `npm run dev`）

配套的 Vite 代理有三条（见 `vite.config.ts`）：`/api`、`/uploads`，以及 `/cdn-cgi` —— 后者会剥掉
`/cdn-cgi/image/<opts>` 前缀再转发，因为本机没有 Cloudflare 图像转换层，不剥的话请求会落到 SPA 回落，
图片全变成 index.html。

### 验证（提交前跑这个）

```bash
npm run verify             # typecheck + lint + test，一条命令跑完
npm run typecheck          # 前后端一起检查（worker: tsc / web: vue-tsc）
npm run typecheck:worker   # 仅 Worker
npm run typecheck:web      # 仅前端
npm run test               # vitest run（7 个文件 / 90 个用例）
npm run test:watch         # vitest 监听模式
npm run lint               # biome check
npm run lint:fix           # biome check --write
```

- **单测只覆盖后端纯逻辑**：时区基准（`lib/time.ts`）、金额计算（`lib/orderAmount.ts`）、订单号（`lib/ids.ts`）、
  签名 URL（`lib/uploadUrl.ts`）、上传魔数（`lib/uploadGuard.ts`）、历史 JSON 形态兼容（`lib/json.ts`）、
  导入列映射（`lib/import/normalize.ts`）。跑在 `node` 环境，不涉及 Vue 组件与 D1。
  改这几个模块必须先让 `npm run test` 通过。
- **lint 只覆盖 `src/**` 与 `test/**`**（`biome.json`，另含两个 vite 配置文件）。
  `.vue` 被排除是**刻意**的：biome 不认 `<script setup>` 的模板用法，会把模板里用到的导入全误报成
  `noUnusedImports`。前端的类型与用法由 `vue-tsc` 把关。
- **CI**：`.github/workflows/ci.yml` 在 push（`master` / `main`）与所有 PR 上触发，Node 22，
  依次跑 `npm ci` → `typecheck` → `lint` → `test` → `build:web`；同一分支连续推送会取消上一次未完成的运行。
  本地 `npm run verify` 覆盖其中的 typecheck + lint + test 三步（CI 多一步构建，用来挡「类型过了但打包失败」）。

### 默认账号
- 用户名：`admin`
- 密码：`admin123`

> ⚠️ 上线后第一件事就是登录并修改密码。`admin123` 明文写在 `migrations/0003_seed.sql` 里，任何拿到这份代码的人都能直接登录你的线上系统。
> 种子账号带 `must_change_password=1`，登录后前端会强制弹改密弹窗，改完才放行。

---

## 部署到 Cloudflare

配置文件的唯一来源是 **`wrangler.jsonc`**（项目里没有也不需要 `wrangler.toml`）。

> ⚠️ **fork 陷阱**：`wrangler.jsonc` 里有两处写死的是本项目真实值，搬到自己的账号前必须改：
> `d1_databases[0].database_id`（一个真实 UUID）和 `routes[0].pattern`（真实域名 `nxzj.wsad.eu.org`）。
> 前者不改会部署「成功」但线上接口全挂；后者不改会把别人的域名解析到你自己的 Worker 上。

### 速查

```bash
npx wrangler login                    # 1. 登录 Cloudflare
npm run d1:create                     # 2. 创建 D1，把返回的 database_id 填进 wrangler.jsonc
npm run r2:create                     # 3. 创建 R2 桶
npx wrangler secret put JWT_SECRET    # 4. 设置 JWT 密钥
npm run d1:migrate:remote             # 5. 线上建表 + 种子数据（老库则是增量迁移）
npm run deploy                        # 6. 构建前端并发布（前后端一次发布）
```

> ⚠️ 速查版省略了几个必须注意的前置条件（占位符 `database_id`、写死的 `routes`、桶是否已存在）。第一次上线请照下面的详细步骤执行。

### 1. 资源清单

| 资源 | 名称 / 绑定名 | 说明 | 是否需要手动创建 |
|---|---|---|---|
| Worker | `rental-admin` | 唯一的部署单元，含前端静态资源与 cron | 否，`wrangler deploy` 自动创建 |
| D1 数据库 | `zjzc`，绑定 `DB` | 17 张业务表 | **是**，`npm run d1:create` |
| R2 存储桶 | `zjzc`，绑定 `UPLOADS` | 上传的图片 / PDF | **是**，`npm run r2:create` |
| Static Assets | 绑定 `ASSETS`，目录 `./frontend/dist` | 前端产物，每次发布重新打包上传 | 否 |
| Cron Trigger | `wrangler.jsonc` 的 `triggers.crons` | 每日清理过期日志与登录失败计数 | 否，随部署生效 |
| Secret | `JWT_SECRET` | JWT 签名密钥 + 上传 URL 签名密钥 | **是**，`wrangler secret put` |
| 访问域名 | `wrangler.jsonc` 的 `routes` 指定，或默认 `*.workers.dev` | 仓库里写死的是 `nxzj.wsad.eu.org`，**fork 后必须改** | 否 |

### 2. 登录

```bash
npx wrangler login     # 浏览器授权
npx wrangler whoami    # 确认身份，并拿到 Account ID
```

无浏览器环境（服务器 / CI）改用 API Token：

```bash
export CLOUDFLARE_API_TOKEN=你的令牌
export CLOUDFLARE_ACCOUNT_ID=0123456789abcdef0123456789abcdef
```

### 3. 创建 D1 数据库并回填 `database_id`

```bash
npm run d1:create          # = wrangler d1 create zjzc
```

把输出里的 `database_id` 填进 `wrangler.jsonc`：

```jsonc
{
  "binding": "DB",
  "database_name": "zjzc",
  "database_id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",   // ← 必须替换成真实 UUID
  "migrations_dir": "migrations"
}
```

> ⚠️ 仓库里当前的 `database_id`（`8ec3c62f-...`）指向本项目已建好的库。换成自己的库时必须替换成真实 UUID，否则 `wrangler deploy` 依然会显示成功，但线上所有接口都会报错（找不到该 D1）。这是最容易踩的一步。

```bash
npx wrangler d1 list            # 确认库已存在
npx wrangler d1 info zjzc       # 查看详情
```

### 4. 创建 R2 桶

```bash
npm run r2:create              # = wrangler r2 bucket create zjzc
npx wrangler r2 bucket list    # 确认
```

> ⚠️ 部署不会自动创建桶。桶缺失时页面能打开，但图片上传会失败（`The specified bucket does not exist`）。桶名必须与 `wrangler.jsonc` 的 `bucket_name` 一致。

`/uploads/*` 由 Worker 从 R2 读回后返回，**不是公开桶**，不需要配置公开访问、CORS 或自定义域；
而且读取必须带有效签名（见「关键机制：上传文件」）。

### 5. 设置 `JWT_SECRET`

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # 生成强随机值
npx wrangler secret put JWT_SECRET                                              # 粘贴进去
npx wrangler secret list                                                        # 确认（只列名字）
```

> ⚠️ **必须设置**。`src/lib/auth.ts` 已不再提供默认密钥：`JWT_SECRET` 缺失时登录接口会直接报「服务未正确配置」，`/uploads/*` 也会因为无法校验签名而全部 403。改完代码后若不设置，整个系统不可用。
> ⚠️ 更换 `JWT_SECRET` 会让所有已签发的 token 立即失效（JWT 有效期 7 天，前端存 `localStorage.token`），换密钥请挑低峰期。
> ℹ️ 上传文件的签名 URL 用 `JWT_SECRET` 派生出的子密钥签名，换密钥会让已加载页面里的图片链接失效，刷新即可。

### 6. 执行线上数据库迁移

```bash
npm run d1:migrate:remote  # = wrangler d1 migrations apply zjzc --remote
```

- 迁移是**增量**的，执行过的不会重复执行，重复跑是安全的
- `0003_seed.sql` 用 `INSERT OR IGNORE` 写入管理员账号，再跑一次**不会**覆盖已改过的密码
- 某个迁移报错时只有该迁移被回滚，之前成功的保持原样

两个需要特别对待的迁移：

- **`0007_timezone_unify.sql` 含存量数据修正**：把系统写入的审计列统一 +8 到北京时间，用户录入的业务列不动。
  上线前先 `npx wrangler d1 export zjzc --remote --output=backup-before-0007.sql` 备份，
  跑完抽查几条订单的 `created_at` 与 `start_date` 是否符合预期。
- **`0008_auth_and_snapshot.sql` 引入令牌吊销**（`users.token_version`，配合代码里 JWT 有效期从 1 年改为 7 天）：
  上线后所有人都会被踢下线、需要重新登录，种子管理员还会被标记为强制改密。安排在低峰期，并提前通知门店。

从旧版本升级时，需要执行的完整迁移是 `0004`–`0011`（`0001`–`0003` 建库时已执行）。

### 7. 构建并发布

```bash
npm run deploy             # = npm run build:web && wrangler deploy
```

输出末尾会给出访问地址和 `Current Version ID`，**记下 Version ID，回滚时要用到**。

> ⚠️ 若报 `The directory specified by the assets.directory field does not exist: frontend/dist`，说明没跑构建。`frontend/dist` 被 `.gitignore` 忽略，每次部署都必须重新构建——用 `npm run deploy`，不要裸跑 `wrangler deploy`。

### 8. 验收

```bash
curl https://<你的域名>/health
# {"status":"ok","checks":{"database":true,"storage":true},"timestamp":"..."}
#   ← 真探了 D1 与 R2；任一项 false 会返回 degraded 且状态码 503

curl https://<你的域名>/api/nope
# {"success":false,"message":"接口不存在"}   ← 说明 /api/* 正确进了 Worker，而不是落到静态资源
```

浏览器打开根路径，用 `admin / admin123` 登录后**立刻修改密码**（会被强制弹窗）。

### 9. 绑定自定义域名

> **前提**：域名必须托管在同一个 Cloudflare 账号下。
> **前提**：`vite.config.ts` 没有配置 `base`，前端资源用绝对路径 `/assets/...`，所以**只能部署在根路径**，不能绑 `example.com/rental/` 这类带子路径的域名，否则静态资源全部 404。

**方式一：写进 `wrangler.jsonc`（推荐，可复现）**

```jsonc
{
  "routes": [
    { "pattern": "rental.example.com", "custom_domain": true }
  ]
}
```

然后 `npm run deploy`。从配置里删掉这条再发布，域名会被解绑。

**方式二：命令行一次性指定**

```bash
npx wrangler deploy --domain rental.example.com
```

**方式三：Dashboard**

Workers & Pages → `rental-admin` → **Settings** → **Domains & Routes** → **Add** → **Custom domain**。

Custom Domain 会自动写入 DNS 记录和 SSL 证书，不需要手动加 CNAME。前端无需改代码：`frontend/src/api/index.ts` 的 `baseURL` 是相对路径 `/api`，图片也用后端返回的 `/uploads/...` 相对路径，换域名自动生效。

### 10. 后续更新、灰度与回滚

```bash
git pull
npm ci                     # 依赖有变化时
npm run verify             # 必做（typecheck + lint + test，与 CI 保持一致）
npm run deploy
npm run d1:migrate:remote  # 仅当 migrations/ 新增了文件时需要
```

```bash
npx wrangler deployments list      # 最近 10 次部署
npx wrangler versions list         # 最近 10 个版本
npx wrangler rollback <version-id> -m "回滚原因：xx 版本发布后订单列表白屏"
npx wrangler tail                  # 实时日志（排查线上错误）
```

> ⚠️ **回滚只回滚代码，不回滚数据库。** 新版带过删列 / 改列的迁移时，回滚代码不会把数据库改回去。回滚前先 `d1 export` 备份，必要时手写补偿迁移或用 D1 Time Travel 恢复。

灰度发布（可选）：

```bash
npx wrangler versions upload --message "v2.1: 新增催缴记录导出"
npx wrangler versions deploy <version-id>@10%     # 也可 @50%，比例可在 Dashboard 调整
```

### 11. 自动部署

**方式 A：Workers Builds（推荐，无需配 Secret）**

Workers & Pages → `rental-admin` → **Settings → Builds** → 关联 GitHub/GitLab 仓库。Cloudflare 会自动生成 API Token，push 即构建发布。

| 配置项 | 值 |
|---|---|
| Git branch | 你的默认分支（**默认是 `main`，仓库用 `master` 要手动改**） |
| Build command | `npm ci && npm run build:web` |
| Deploy command | `npx wrangler deploy`（默认） |
| Root directory | 留空（项目在仓库根） |
| Non-production branch builds | 建议保持关闭 |

注意两点：
1. `wrangler deploy` 要读 `frontend/dist`，**构建命令不能省**，否则上传的是空目录
2. Cloudflare 自动生成的 Token **不含 D1 编辑权限**，迁移仍需在本地跑 `npm run d1:migrate:remote`

若构建报 Node 版本错误，在 Build 的环境变量里加 `NODE_VERSION=22`。

**方式 B：GitHub Actions**

仓库里已经有 `.github/workflows/ci.yml`，但它做的是**校验**，不是部署：push 到 `master` / `main` 与所有 PR 时触发
（同一分支连续推送会取消上一次未完成的运行），在 Node 22 上依次跑
`npm ci` → `npm run typecheck` → `npm run lint` → `npm run test` → `npm run build:web`。
也就是说它能挡住「类型不过 / lint 报错 / 单测挂 / 打包失败」的提交，但不会发布任何东西。

要 push 即部署，在这个 workflow 的 `verify` job 之后加一个 deploy job：

```yaml
  deploy:
    needs: verify
    if: github.event_name == 'push' && (github.ref == 'refs/heads/master' || github.ref == 'refs/heads/main')
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - run: npm run build:web          # wrangler deploy 要读 frontend/dist，不能省
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

仓库 **Settings → Secrets and variables → Actions** 需要两个 Secret：

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | <https://dash.cloudflare.com/profile/api-tokens> 创建，模板选「编辑 Cloudflare Workers」；要用 CI 跑迁移再加 `账号 - D1 - 编辑` |
| `CLOUDFLARE_ACCOUNT_ID` | `wrangler whoami` 输出里的 Account ID |

> ⚠️ **不要把 `JWT_SECRET` 放进 CI 每次重设。** Secret 每次被换成新值都会让全体已登录用户掉线，本地 `wrangler secret put` 之后就不再动它。
> ⚠️ **首次部署仍需在本地手工做一遍**：创建 D1 / R2、回填 `database_id`、`secret put` 都是一次性资源准备，CI 只负责后续发布。
> ⚠️ 两种方式**只选一种**，同时开启会重复部署。

### 12. D1 数据管理

```bash
# 备份（结构 + 数据）
npx wrangler d1 export zjzc --remote --output=backup-$(date +%Y%m%d-%H%M).sql
npx wrangler d1 export zjzc --remote --no-data   --output=schema-only.sql
npx wrangler d1 export zjzc --remote --no-schema --output=data-only.sql

# 恢复（没有 d1 import，就是把 SQL 灌回去）
npx wrangler d1 execute zjzc --remote --file=backup-20260918-1200.sql

# Time Travel
npx wrangler d1 time-travel info zjzc
npx wrangler d1 time-travel restore zjzc --timestamp=2026-09-18T10:00:00Z

# 本地数据搬到线上
npx wrangler d1 export zjzc --local --output=local-dump.sql
npx wrangler d1 execute zjzc --remote --file=local-dump.sql
```

> ⚠️ 导入前确认 `wrangler.jsonc` 的 `database_id` 指向目标库。导出的 SQL 含 `DROP TABLE` / `CREATE TABLE`，会覆盖同名表数据，先备份。

新增迁移的流程：`migrations/` 下新建 `NNNN_xxx.sql` → `npm run d1:migrate` 本地验证 → `npm run d1:migrate:remote` 上线 → 迁移文件随代码一起提交。

### 13. 常见问题排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 部署成功但所有接口报错，日志含 `Couldn't find D1 DB` | `database_id` 还是占位符 / 别人的 UUID | 用 `npx wrangler d1 info zjzc` 取真实 UUID 填回配置，重新 `npm run deploy` |
| 上传图片失败，报 `The specified bucket does not exist` | R2 桶没建或名字对不上 | `npm run r2:create`，确认桶名与 `bucket_name` 一致 |
| `...assets.directory field does not exist: frontend/dist` | 没构建前端 | 用 `npm run deploy`（含 `build:web`） |
| 部署后页面是旧的 | 浏览器缓存或漏了构建 | 强刷（Cmd/Ctrl+Shift+R）；确认输出里有 `Uploaded` |
| 刷新子路由（如 `/orders`）404 | `assets.not_found_handling` 被改掉 | 保持 `single-page-application` |
| API 返回 HTML 而不是 JSON | `/api/*` 没走 Worker | 确认 `assets.run_worker_first` 包含 `/api/*`（完整应为 `["/api/*", "/uploads/*", "/health"]`） |
| 线上 `/health` 返回 index.html 或 404 | `/health` 没进 `run_worker_first`，被 SPA 回落吃掉了 | 保持 `run_worker_first` 为 `["/api/*", "/uploads/*", "/health"]` 三项 |
| 图片全部 403 / 打不开 | `JWT_SECRET` 未配置，或签名过期（7 天） | 确认已 `secret put JWT_SECRET`；刷新页面重新取签名链接 |
| 换完 `JWT_SECRET` 后所有人被踢下线 | 正常现象：旧 token 与旧签名都失效 | 重新登录即可；换密钥挑低峰期 |
| 上传报超过 10MB / 类型不支持 | 后端硬限制：10MB，仅 `insurance` 允许 PDF；并按文件头校验真实格式 | 前端上传前已自动压缩（≤500KB/WebP），仍报错说明压缩被跳过（PDF/GIF）或压缩失败；表单字段名必须固定为 `image` |
| 界面按钮/菜单的图标不显示 | 图标按需引入后必须逐个 import，且要写成 `:icon="Plus"` | 见「关键机制」里的图标约束；`icon="Plus"` 永远不显示 |
| 本地图片全变成 index.html | 本地没有图像转换层，`/cdn-cgi/...` 落到 SPA 回落 | Vite 已配 `/cdn-cgi` 代理剥前缀；直连后端时改用不带 `/cdn-cgi` 的路径 |
| `wrangler dev` 启动即 Aborted（tcmalloc / 虚拟地址空间） | 本机 workerd 起不来 | 改用 `node scripts/dev-backend.mjs`（见「本地开发」） |
| 迁移执行失败 | 目标表/列已存在，或 SQL 语法问题 | 按报错行号修 SQL；已成功的迁移不会被回退 |
| `wrangler: command not found` | 依赖没装或没走 npx | `npm install`；脚本里统一用 `npx wrangler ...` |

### 14. 上线安全检查清单

- [ ] `wrangler.jsonc` 的 `database_id` 已换成真实 UUID（不是 `00000000-...`，也不是 fork 来源仓库里的 UUID）
- [ ] `wrangler.jsonc` 的 `routes` 已换成自己的域名（仓库里写死的是 `nxzj.wsad.eu.org`）
- [ ] R2 桶 `zjzc` 已创建，桶名与配置一致
- [ ] 已 `wrangler secret put JWT_SECRET`（**必须**，代码里已无默认密钥兜底；它同时是上传 URL 的签名密钥）
- [ ] 已执行 `npm run d1:migrate:remote`，且 `0004`–`0011` 全部跑完
- [ ] 上线前已备份：`npx wrangler d1 export zjzc --remote --output=backup-$(date +%Y%m%d).sql`
      （**`0007` 含存量数据修正、`0008` 会让全员重新登录**，建议低峰期执行）
- [ ] 已登录并改掉 `admin123`（会强制弹出改密弹窗，改完才放行）
- [ ] **页面级安全响应头已在 Zone 层配置**（Worker 的 `secure-headers` 只覆盖 `/api/*` 与 `/uploads/*`，
      HTML/JS/CSS 由 Static Assets 直接返回）：Cloudflare Dashboard →
      规则 → Transform Rules → Modify Response Header，对 `/**` 添加
      `Content-Security-Policy`、`X-Frame-Options: DENY`、`Strict-Transport-Security`。
      建议先用 `Content-Security-Policy-Report-Only` 观察一轮再切强制
- [ ] `npm run verify` 通过（typecheck + lint + test，与 CI 一致）
- [ ] 备份策略已就绪（定期 `d1 export`）

#### 已知依赖问题：xlsx

`npm audit` 会报 `xlsx@0.18.5` 的 **Prototype Pollution**（GHSA-4r6h-8v6p-xvw6，CVSS 7.8）。
SheetJS 在 0.18.5 之后不再往 npm 发布，受影响范围是 `<0.19.3`，`npm audit` 提示 npm 上暂无修复版本。

**风险判断**：影响面有限。xlsx 只在前端「订单批量导入」页用于解析**用户自己选择**的 Excel 文件，
触发条件是自己上传一个恶意构造的表格，不涉及服务端解析或他人投递，因此暂不阻断上线。

**为什么至今没换**：唯一的修复路径是从 SheetJS 官方源安装（非 npm registry），
而 CI（GitHub Actions）与 Cloudflare Builds 的网络环境不一定能访问该地址，
一旦拉不到包就是**构建直接失败**，属于用确定的构建风险去换一个不确定的低危漏洞，因此暂缓。

**修复方式**（确认构建环境可达后再做），API 完全兼容，改动仅一行 package.json：

```bash
npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

### 15. 费用与额度提醒

- **免费额度**：D1 5GB 存储 + 每日读写额度；Workers 每日 10 万请求；Static Assets 单文件上限 10MiB
- **产物体积**（按需引入后，远低于上限）：主包 `index-*.js` 约 45KB（gzip 约 18KB），
  最大单文件是 `xlsx` 的 chunk 约 424KB，全量 CSS 约 384KB
- **R2 需绑定支付方式**（即便完全在免费额度内），免费额度为每月 10GB 存储，出流量免费
- `wrangler.jsonc` 的 `observability.enabled` 控制 Workers Logs，当前为 `true`（开启，用于线上排查）；若在意日志存储开销可改回 `false`
- `/uploads/*` 配了 `run_worker_first`，每次读取都会进 Worker（有 `caches.default` 缓存兜底）并产生一次 R2 读操作；
  图片 URL 现在是带签名的（`/uploads/{exp}.{sig}/{dir}/{file}`），换 `JWT_SECRET` 会让旧链接失效
- 每日 cron 会清理 180 天前的操作日志，长期看 D1 存储不会无限增长，但**每次清理前数据库仍在增长**，备份与额度检查仍要定期做

---

## 数据表结构

| 表名 | 说明 |
|---|---|
| users | 用户表（含 `token_version` 令牌吊销、`must_change_password` 强制改密） |
| customers | 客户表 |
| vehicles | 车辆表（`status` 只表达人工可用性，是否在租由订单推导） |
| orders | 订单表（含 `platform` / `external_no` / `plate_number` 车牌快照等） |
| order_fees | 订单费用明细表（`0004` 新增，按 `fee_category` 分类，随订单级联删除） |
| order_extensions | 订单续租记录表（`0004` 新增） |
| import_batches | 批量导入批次台账（`0004` 新增，支持整批撤销与溯源） |
| payments | 支付记录表 |
| order_sources | 订单来源表 |
| violations | 违章记录表 |
| blacklist | 黑名单表 |
| maintenance | 保养记录表 |
| insurance | 保险记录表 |
| inspections | 年检证表 |
| system_settings | 系统设置表 |
| operation_logs | 操作日志表 |
| login_attempts | 登录失败计数表（`0008` 新增，cron 清理 24 小时前的记录） |

## 开发约定与注意事项

- **同源部署**：前后端同一个 Worker，不存在跨域问题；图片直接用后端返回的相对路径
- **数据库**：D1 异步，必须用 `src/db/helpers.ts` 的辅助函数，禁止直接 `c.env.DB.prepare()`
- **时区**：一律北京时间。JS 侧用 `src/lib/time.ts` 的 `now()`，SQL 侧对应 `datetime('now','+8 hours')`；
  别再写 `toISOString()` 入库
- **上传**：前端上传前压到 ≤500KB / 1600px / WebP（`frontend/src/utils/image.ts`，PDF 与 GIF 跳过），
  上传前校验统一走 `frontend/src/utils/upload.ts` 的 `validateUploadFile`，
  后端再卡 10MB、MIME 白名单与文件头魔数，存 R2；读取走带签名的 `/uploads/*`（7 天有效）
- **SPA 刷新**：`not_found_handling: single-page-application`，直接刷新子路由不会 404
- **本地数据**：`wrangler dev` 的本地 D1/R2 数据在 `.wrangler/state`，删掉即重置；
  Node 后端方案的数据在 `.wrangler/state/dev-node`（删 `data.sqlite` 重置）
- **提交前验证**：`npm run verify`（typecheck + lint + test）。单测只覆盖 `src/lib` 的纯逻辑，
  类型检查覆盖面更广但挡不住运行时问题，涉及金额、时区、导入映射的改动请补单测

详细的请求写法、业务规则、前端约定、设计系统规范见 [AGENTS.md](AGENTS.md)。

## 设计系统

本项目采用 **Apple 设计系统**：唯一强调色 Apple Blue (`#0071e3`)、无可见边框、毛玻璃导航栏。
设计 token 定义在 `frontend/src/style.css`（`--sk-*` 变量），业务页面统一用 Element Plus 组件
（早期那套 `Sk*` 基础组件已移除），强调色固定为全局 Apple Blue `#0071e3`（`--sk-focus-color`），
不再支持在系统设置里自定义。完整规范见 [AGENTS.md](AGENTS.md#设计系统apple-风格)。

## API 接口概览

所有业务接口均需登录（`Authorization: Bearer <token>`），除登录接口与 `/health` 外。
标注「管理员」的接口额外经过 `adminOnly`。响应格式统一 `{ success, data?, message?, code? }`。

### 认证
- `POST /api/auth/login` - 登录（返回 token 与 `must_change_password`）
- `GET /api/auth/me` - 获取当前用户
- `PUT /api/auth/password` - 修改密码（会自增 `token_version`，同时返回新 token）
- `POST /api/auth/logout` - 退出登录（只落审计日志，不吊销其它设备的 token）

### 用户管理（管理员）
- `GET/POST /api/users` - 列表/创建
- `GET/PUT/DELETE /api/users/:id` - 详情/更新/删除
- `PUT /api/users/:id/reset-password` - 重置密码
- `GET /api/users/options` - 用户下拉选项（仅 id/name，员工可用，供司机指派）

### 客户管理
- `GET /api/customers/regular` - 常用客户
- `GET/POST /api/customers` - 列表/创建
- `GET/PUT/DELETE /api/customers/:id` - 详情/更新/删除
- `PUT /api/customers/:id/regular` - 设置常用客户

### 车辆管理
- `GET /api/vehicles/available` - 可用车辆
- `GET /api/vehicles/brands` - 品牌列表
- `GET /api/vehicles/options` - 筛选选项
- `GET/POST /api/vehicles` - 列表/创建
- `GET/PUT/DELETE /api/vehicles/:id` - 详情/更新/删除

### 订单管理
- `GET/POST /api/orders` - 列表/创建
- `GET /api/orders/stats` - 订单统计
- `GET /api/orders/:id` - 订单详情
- `PUT /api/orders/:id` - 更新订单
- `PUT /api/orders/:id/status` - 取车/还车状态流转
- `PUT /api/orders/:id/extend` - 延期
- `PUT /api/orders/:id/cancel` - 取消
- `PUT /api/orders/:id/drivers` - 指派司机
- `DELETE /api/orders/:id` - 删除订单
- `POST /api/orders/:id/payments` - 添加支付记录

### 订单批量导入
- `POST /api/orders/import/preview` - 预检（解析 Excel、逐行校验、匹配客户/车辆，只读不写）
- `POST /api/orders/import` - 提交导入（生成 `import_batches` 记录）
- `GET /api/orders/import/batches` - 导入批次列表
- `DELETE /api/orders/import/batches/:id` - 撤销整批导入

### 调度管理
- `GET /api/schedules/recent` - 待办调度列表
- `GET /api/schedules/gantt` - 甘特图数据

### 违章管理
- `GET /api/violations/stats` - 统计
- `GET/POST /api/violations` - 列表/创建
- `GET/PUT/DELETE /api/violations/:id` - 详情/更新/删除
- `PUT /api/violations/:id/fee` - 押金扣款
- `PUT /api/violations/:id/handle` - 标记处理

### 黑名单
- `GET /api/blacklist/check` - 检查
- `GET/POST /api/blacklist` - 列表/添加
- `GET /api/blacklist/:id` - 详情
- `DELETE /api/blacklist/:id` - 移除

### 订单来源
- `GET/POST /api/order-sources` - 列表/创建（创建需管理员）
- `GET/PUT/DELETE /api/order-sources/:id` - 详情/更新/删除（更新删除需管理员）

### 保养 / 保险 / 年检
- `GET /api/maintenance/stats`、`GET/POST /api/maintenance`、`GET/PUT/DELETE /api/maintenance/:id`
- `GET /api/insurance/stats`、`GET/POST /api/insurance`、`GET/PUT/DELETE /api/insurance/:id`
- `GET /api/inspections/stats`、`GET/POST /api/inspections`、`PUT/DELETE /api/inspections/:vehicle_id`

### 仪表盘 / 设置 / 日志
- `GET /api/dashboard/stats` - 统计卡片
- `GET /api/dashboard/income` - 收入报表
- `GET/PUT /api/settings` - 获取/更新设置（更新需管理员）
- `GET /api/settings/:key` - 单个设置项
- `GET /api/logs` - 日志列表（管理员）
- `GET /api/logs/:id`、`GET /api/logs/action-types`、`GET /api/logs/entity-types`、`GET /api/logs/users`（管理员）

### 文件上传

表单字段名固定为 `image`，可选字段 `name` 用于语义化文件名。仅 `insurance` 支持 PDF，其余仅图片，后端上限 10MB。
上传接口返回的 `url` 也会被 `signUploadUrls` 中间件签名，可直接用于预览。

- `POST /api/upload` - 其它文件
- `POST /api/upload/inspection` - 年检证
- `POST /api/upload/insurance` - 保险单（唯一允许 PDF）
- `POST /api/upload/violation` - 违章照片
- `POST /api/upload/maintenance` - 保养照片
- `POST /api/upload/vehicle` - 车辆照片
- `POST /api/upload/customer` - 客户证件

### 健康检查
- `GET /health` - 真探 D1 与 R2，返回 `{ status, checks: { database, storage }, timestamp }`，`degraded` 时 503

---

## 更新日志

历史变更已迁到 **[CHANGELOG.md](CHANGELOG.md)**。
