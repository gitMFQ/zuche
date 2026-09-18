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
| 数据库 | Cloudflare D1（SQLite 兼容） |
| 对象存储 | Cloudflare R2（上传的图片 / PDF） |
| 认证 | JWT（1 年有效期，Web Crypto） |
| 前端 | Vue 3 + Vite + TypeScript + Element Plus + Pinia |

## 项目结构

```
zuche/
├── src/                          # Worker 源码
│   ├── index.ts                  # Hono 出口：/health、/uploads/*、onError
│   ├── routes/
│   │   ├── index.ts              # /api 下全部业务路由
│   │   └── upload.ts             # 上传端点 + 从 R2 读回
│   ├── controllers/              # 业务控制器（auth/users/customers/vehicles/orders/
│   │                             #   orderSources/violations/maintenance/insurance/
│   │                             #   inspection/dashboard/schedules/settings/logs/blacklist）
│   ├── db/
│   │   ├── helpers.ts            # query/queryOne/execute/queryWithPagination/batchExecute
│   │   └── rows.ts               # 各表行类型
│   ├── lib/                      # auth / errors / ids / json / log / request / time
│   ├── middleware/auth.ts        # authMiddleware、adminOnly
│   └── types.ts                  # Bindings、AppContext
│
├── migrations/                   # D1 迁移 SQL
│   ├── 0001_schema.sql           # 13 张表
│   ├── 0002_indexes.sql
│   └── 0003_seed.sql             # 管理员账号等种子数据
├── scripts/seed-demo.sql         # 本地演示数据（可选）
│
└── frontend/src/                 # 前端源码（构建产物 frontend/dist，不入库）
    ├── api/                      # API 封装，baseURL 为相对路径 /api
    ├── components/               # 公共组件
    │   ├── SkButton/SkCard/SkSection/SkTypography/SkNavGlass   # Apple 风格基础件
    │   └── *Tab.vue              # 业务分栏（车辆/违章/保养/保险/年检/来源/用户）
    ├── layouts/                  # 布局
    ├── router/                   # 路由（createWebHistory）
    ├── stores/                   # Pinia
    ├── utils/                    # constants.ts（映射常量）、helpers.ts（格式化）
    ├── views/                    # 页面：Login/Dashboard/Orders/OrderDetail/Customers/
    │                             #   Vehicles/Users/Violations/Blacklist/OrderSources/
    │                             #   Settings/Logs
    └── style.css                 # 全局样式 + Apple 设计 token
```

## 功能模块

### 业务规则

**订单状态流转：**
```
pending (待取车) → active (已取车) → completed (已还车)
                 ↘ cancelled (已取消)
```

**支付方式：** platform（平台支付）、wechat（微信）、alipay（支付宝）、cash（现金）、bank（银行转账）、other（其他）

**支付类型：** rent（租金）、deposit（押金）、rent_deposit（租金+押金）、violation_deposit（违章押金）、damage（车损）、other（其他）

**调度生成规则：**
- 送车任务：从待取车 (pending) 订单提取取车时间和位置
- 收车任务：从已取车 (active) 订单提取还车时间和位置
- 仅显示当前时间及以后的调度，按时间升序排列

### 模块一览

| 模块 | 功能 |
|---|---|
| 仪表盘 | 今日取/还车、待处理订单、可用车辆；车辆状态分布、近 30 天订单趋势；调度甘特图与取还车调度表 |
| 订单管理 | 状态分类、服务类型（基础/优享/尊享）、免押与免押到期日、取还车（时间/地点/里程/照片）、延期、支付记录、合同号 |
| 客户管理 | 客户信息、常用客户标记、来源标记、证件与驾照照片、快速查看历史订单 |
| 车辆管理 | 车辆 CRUD、新能源标识、VIN/发动机号、行驶证与登记证图片、详情弹窗 |
| 违章管理 | 违章登记、罚款与扣分、多图上传、处理状态跟踪、押金扣款 |
| 黑名单 | 添加/移除、原因记录、手机号与身份证检查 |
| 保养管理 | 按车辆查看、保养类型（常规/大保养/小修）、里程提醒、成本统计 |
| 保险管理 | 按车辆查看、险种多选（交强险/商业险/座位险）、到期提醒、保费统计 |
| 年检证 | 年检状态列表、证书图片、到期提醒 |
| 订单来源 | 渠道管理（门店直租/美团/携程/滴滴等）、佣金比例、平台颜色 |
| 用户管理 | 用户 CRUD、角色 admin/staff、改密与重置密码 |
| 系统设置 | 主题色（6 预设 + 自定义）、侧边栏风格、Logo、系统标题 |
| 操作日志 | 关键操作记录（操作类型、对象、详情、时间、IP） |

## 快速开始

### 环境要求
- Node.js **20.19+ / 22.12+**（Vite 8 的硬性要求）
- npm
- Cloudflare 账号（仅上线时需要）

### 安装与开发

```bash
npm install
npm run dev
```

`npm run dev` 同时起两个服务：
- Worker（含 D1、R2 本地模拟）：http://localhost:8787
- 前端 Vite（HMR，`/api` 与 `/uploads` 已代理到 8787）：http://localhost:5173

首次启动前初始化本地数据库：

```bash
npm run d1:migrate                                  # 应用 migrations/ 到本地 D1
npx wrangler d1 execute rental-db --local \
  --file=./scripts/seed-demo.sql                    # 可选：灌入演示数据
```

### 类型检查

```bash
npm run typecheck          # 前后端一起检查
npm run typecheck:worker   # 仅 Worker
npm run typecheck:web      # 仅前端
```

本项目没有单元测试和 lint，**类型检查是提交前唯一的验证手段**。

### 默认账号
- 用户名：`admin`
- 密码：`admin123`

> ⚠️ 上线后第一件事就是登录并修改密码。`admin123` 明文写在 `migrations/0003_seed.sql` 里，任何拿到这份代码的人都能直接登录你的线上系统。

---

## 部署到 Cloudflare

配置文件的唯一来源是 **`wrangler.jsonc`**（项目里没有也不需要 `wrangler.toml`）。

### 速查

```bash
npx wrangler login                    # 1. 登录 Cloudflare
npm run d1:create                     # 2. 创建 D1，把返回的 database_id 填进 wrangler.jsonc
npm run r2:create                     # 3. 创建 R2 桶
npx wrangler secret put JWT_SECRET    # 4. 设置 JWT 密钥
npm run d1:migrate:remote             # 5. 线上建表 + 种子数据
npm run deploy                        # 6. 构建前端并发布（前后端一次发布）
```

> ⚠️ 速查版省略了几个必须注意的前置条件（占位符 `database_id`、默认 JWT 密钥、桶是否已存在）。第一次上线请照下面的详细步骤执行。

### 1. 资源清单

| 资源 | 名称 / 绑定名 | 说明 | 是否需要手动创建 |
|---|---|---|---|
| Worker | `rental-admin` | 唯一的部署单元，含前端静态资源 | 否，`wrangler deploy` 自动创建 |
| D1 数据库 | `rental-db`，绑定 `DB` | 13 张业务表 | **是**，`npm run d1:create` |
| R2 存储桶 | `rental-uploads`，绑定 `UPLOADS` | 上传的图片 / PDF | **是**，`npm run r2:create` |
| Static Assets | 绑定 `ASSETS`，目录 `./frontend/dist` | 前端产物，每次发布重新打包上传 | 否 |
| Secret | `JWT_SECRET` | JWT 签名密钥 | **是**，`wrangler secret put` |
| 访问域名 | `wrangler.jsonc` 的 `routes` 指定，或默认 `*.workers.dev` | | 否 |

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
npm run d1:create          # = wrangler d1 create rental-db
```

把输出里的 `database_id` 填进 `wrangler.jsonc`：

```jsonc
{
  "binding": "DB",
  "database_name": "rental-db",
  "database_id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",   // ← 必须替换成真实 UUID
  "migrations_dir": "migrations"
}
```

> ⚠️ 仓库里的默认值是占位符 `00000000-0000-0000-0000-000000000000`。不替换的话 `wrangler deploy` 依然会显示成功，但线上所有接口都会报错（找不到该 D1）。这是最容易踩的一步。

```bash
npx wrangler d1 list            # 确认库已存在
npx wrangler d1 info rental-db  # 查看详情
```

### 4. 创建 R2 桶

```bash
npm run r2:create              # = wrangler r2 bucket create rental-uploads
npx wrangler r2 bucket list    # 确认
```

> ⚠️ 部署不会自动创建桶。桶缺失时页面能打开，但图片上传会失败（`The specified bucket does not exist`）。桶名必须与 `wrangler.jsonc` 的 `bucket_name` 一致。

`/uploads/*` 由 Worker 从 R2 读回后返回，**不是公开桶**，不需要配置公开访问、CORS 或自定义域。

### 5. 设置 `JWT_SECRET`

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # 生成强随机值
npx wrangler secret put JWT_SECRET                                              # 粘贴进去
npx wrangler secret list                                                        # 确认（只列名字）
```

> ⚠️ 不设置也能跑：`src/lib/auth.ts` 里硬编码了默认值 `rental-admin-secret-key-2026`，这个字符串就在公开代码里，任何人都能用它伪造 JWT，**上线必须设置**。
> ⚠️ 更换 `JWT_SECRET` 会让所有已签发的 token 立即失效（JWT 有效期 1 年，前端存 `localStorage.token`），换密钥请挑低峰期。

### 6. 执行线上数据库迁移

```bash
npm run d1:migrate:remote  # = wrangler d1 migrations apply rental-db --remote
```

- 迁移是**增量**的，执行过的不会重复执行，重复跑是安全的
- `0003_seed.sql` 用 `INSERT OR IGNORE` 写入管理员账号，再跑一次**不会**覆盖已改过的密码
- 某个迁移报错时只有该迁移被回滚，之前成功的保持原样

### 7. 构建并发布

```bash
npm run deploy             # = npm run build:web && wrangler deploy
```

输出末尾会给出访问地址和 `Current Version ID`，**记下 Version ID，回滚时要用到**。

> ⚠️ 若报 `The directory specified by the assets.directory field does not exist: frontend/dist`，说明没跑构建。`frontend/dist` 被 `.gitignore` 忽略，每次部署都必须重新构建——用 `npm run deploy`，不要裸跑 `wrangler deploy`。

### 8. 验收

```bash
curl https://<你的域名>/api/nope
# {"success":false,"message":"接口不存在"}   ← 说明 /api/* 正确进了 Worker，而不是落到静态资源
```

浏览器打开根路径，用 `admin / admin123` 登录后**立刻修改密码**。

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
npm run typecheck          # 必做
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

新建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [master]
  workflow_dispatch:

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build:web
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
npx wrangler d1 export rental-db --remote --output=backup-$(date +%Y%m%d-%H%M).sql
npx wrangler d1 export rental-db --remote --no-data   --output=schema-only.sql
npx wrangler d1 export rental-db --remote --no-schema --output=data-only.sql

# 恢复（没有 d1 import，就是把 SQL 灌回去）
npx wrangler d1 execute rental-db --remote --file=backup-20260918-1200.sql

# Time Travel
npx wrangler d1 time-travel info rental-db
npx wrangler d1 time-travel restore rental-db --timestamp=2026-09-18T10:00:00Z

# 本地数据搬到线上
npx wrangler d1 export rental-db --local --output=local-dump.sql
npx wrangler d1 execute rental-db --remote --file=local-dump.sql
```

> ⚠️ 导入前确认 `wrangler.jsonc` 的 `database_id` 指向目标库。导出的 SQL 含 `DROP TABLE` / `CREATE TABLE`，会覆盖同名表数据，先备份。

新增迁移的流程：`migrations/` 下新建 `NNNN_xxx.sql` → `npm run d1:migrate` 本地验证 → `npm run d1:migrate:remote` 上线 → 迁移文件随代码一起提交。

### 13. 常见问题排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 部署成功但所有接口报错，日志含 `Couldn't find D1 DB` | `database_id` 还是占位符 | 用 `npx wrangler d1 info rental-db` 取真实 UUID 填回配置，重新 `npm run deploy` |
| 上传图片失败，报 `The specified bucket does not exist` | R2 桶没建或名字对不上 | `npm run r2:create`，确认桶名与 `bucket_name` 一致 |
| `...assets.directory field does not exist: frontend/dist` | 没构建前端 | 用 `npm run deploy`（含 `build:web`） |
| 部署后页面是旧的 | 浏览器缓存或漏了构建 | 强刷（Cmd/Ctrl+Shift+R）；确认输出里有 `Uploaded` |
| 刷新子路由（如 `/orders`）404 | `assets.not_found_handling` 被改掉 | 保持 `single-page-application` |
| API 返回 HTML 而不是 JSON | `/api/*` 没走 Worker | 确认 `assets.run_worker_first` 包含 `/api/*` |
| 换完 `JWT_SECRET` 后所有人被踢下线 | 正常现象：旧 token 签名失效 | 重新登录即可；换密钥挑低峰期 |
| 上传报超过 10MB / 类型不支持 | 后端硬限制：10MB，仅 `insurance` 允许 PDF | 压缩图片；表单字段名必须固定为 `image` |
| 图片打不开（404） | 文件不在 R2，或 key 与数据库记录不一致 | `npx wrangler r2 object list rental-uploads` 核对 |
| 迁移执行失败 | 目标表/列已存在，或 SQL 语法问题 | 按报错行号修 SQL；已成功的迁移不会被回退 |
| `wrangler: command not found` | 依赖没装或没走 npx | `npm install`；脚本里统一用 `npx wrangler ...` |

### 14. 上线安全检查清单

- [ ] `wrangler.jsonc` 的 `database_id` 已换成真实 UUID（不是 `00000000-...`）
- [ ] R2 桶 `rental-uploads` 已创建，桶名与配置一致
- [ ] 已 `wrangler secret put JWT_SECRET`（不使用代码里的默认密钥）
- [ ] 已登录并改掉 `admin123`
- [ ] `npm run typecheck` 通过
- [ ] 备份策略已就绪（定期 `d1 export`）

### 15. 费用与额度提醒

- **免费额度**：D1 5GB 存储 + 每日读写额度；Workers 每日 10 万请求；Static Assets 单文件上限 10MiB（当前产物最大约 874KB，安全）
- **R2 需绑定支付方式**（即便完全在免费额度内），免费额度为每月 10GB 存储，出流量免费
- `wrangler.jsonc` 的 `observability.enabled` 控制 Workers Logs，当前为 `false`（关闭）；开启会产生日志存储与采样开销
- `/uploads/*` 配了 `run_worker_first`，每次读取都会进 Worker（有 `caches.default` 缓存兜底）并产生一次 R2 读操作

## 数据表结构

| 表名 | 说明 |
|---|---|
| users | 用户表 |
| customers | 客户表 |
| vehicles | 车辆表 |
| orders | 订单表 |
| payments | 支付记录表 |
| order_sources | 订单来源表 |
| violations | 违章记录表 |
| blacklist | 黑名单表 |
| maintenance | 保养记录表 |
| insurance | 保险记录表 |
| inspections | 年检证表 |
| system_settings | 系统设置表 |
| operation_logs | 操作日志表 |

## 开发约定与注意事项

- **同源部署**：前后端同一个 Worker，不存在跨域问题；图片直接用后端返回的相对路径
- **数据库**：D1 异步，必须用 `src/db/helpers.ts` 的辅助函数，禁止直接 `c.env.DB.prepare()`
- **上传**：限制 10MB，存 R2；`/uploads/*` 由 Worker 读回并带长缓存
- **SPA 刷新**：`not_found_handling: single-page-application`，直接刷新子路由不会 404
- **本地数据**：`wrangler dev` 的本地 D1/R2 数据在 `.wrangler/state`，删掉即重置
- **无测试框架**：类型检查是唯一的验证方式

详细的请求写法、业务规则、前端约定、设计系统规范见 [AGENTS.md](AGENTS.md)。

## 设计系统

本项目采用 **Apple 设计系统**：唯一强调色 Apple Blue (`#0071e3`)、无可见边框、毛玻璃导航栏。
设计 token 定义在 `frontend/src/style.css`（`--sk-*` 变量），业务页面用 Element Plus 组件 +
系统设置里可配置的 `--primary-color` 主题色。完整规范见 [AGENTS.md](AGENTS.md#设计系统apple-风格)。

## API 接口概览

所有业务接口均需登录（`Authorization: Bearer <token>`），除登录接口外。

### 认证
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户
- `PUT /api/auth/password` - 修改密码

### 用户管理（管理员）
- `GET/POST /api/users` - 列表/创建
- `GET/PUT/DELETE /api/users/:id` - 详情/更新/删除
- `PUT /api/users/:id/reset-password` - 重置密码

### 客户管理
- `GET /api/customers/regular` - 常用客户
- `GET/POST /api/customers` - 列表/创建
- `GET/PUT/DELETE /api/customers/:id` - 详情/更新/删除
- `PUT /api/customers/:id/regular` - 设置常用客户

### 车辆管理
- `GET /api/vehicles/available` - 可用车辆
- `GET /api/vehicles/brands` - 品牌列表
- `GET/POST /api/vehicles` - 列表/创建
- `GET/PUT/DELETE /api/vehicles/:id` - 详情/更新/删除

### 订单管理
- `GET/POST /api/orders` - 列表/创建
- `GET /api/orders/:id` - 订单详情
- `PUT /api/orders/:id` - 更新订单
- `PUT /api/orders/:id/status` - 取车/还车状态流转
- `PUT /api/orders/:id/extend` - 延期
- `PUT /api/orders/:id/cancel` - 取消
- `POST /api/orders/:id/payments` - 添加支付记录

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
- `GET /api/logs/:id`、`GET /api/logs/action-types`、`GET /api/logs/entity-types`、`GET /api/logs/users`

### 文件上传
- `POST /api/upload/:type` - type: vehicle | customer | inspection | insurance | maintenance | violation
- `POST /api/upload` - other

---

## 更新日志

历史变更已迁到 **[CHANGELOG.md](CHANGELOG.md)**。
