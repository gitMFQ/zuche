# 租车公司管理系统

一个功能完整的租车公司管理解决方案，支持车辆调度、订单管理、客户管理、财务统计等核心业务功能。

## 技术栈

### 后端（Cloudflare Worker）
- **Runtime**: Cloudflare Workers
- **Framework**: Hono 4
- **Language**: TypeScript
- **Database**: Cloudflare D1（SQLite 兼容）
- **Object Storage**: Cloudflare R2（上传的图片/PDF）
- **Auth**: JWT（1年有效期，Hono JWT / Web Crypto）

前端构建产物由 Worker 的 Static Assets 托管，**前后端一体部署，前端无需单独部署**。

### 前端
- **Framework**: Vue 3 + Vite
- **Language**: TypeScript
- **UI Library**: Element Plus
- **State Management**: Pinia

## 项目结构

```
zuche/
├── src/                          # Worker 源码
│   ├── index.ts                  # Hono 出口：/health、/uploads/*、onError
│   ├── routes/
│   │   ├── index.ts              # /api 下全部业务路由
│   │   └── upload.ts             # 上传端点 + R2 读取
│   ├── controllers/              # 业务控制器
│   │   ├── auth.ts               # 认证
│   │   ├── users.ts              # 用户管理
│   │   ├── customers.ts          # 客户管理
│   │   ├── vehicles.ts           # 车辆管理
│   │   ├── orders.ts             # 订单管理
│   │   ├── orderSources.ts       # 订单来源
│   │   ├── violations.ts         # 违章管理
│   │   ├── maintenance.ts        # 保养管理
│   │   ├── insurance.ts          # 保险管理
│   │   ├── inspection.ts         # 年检证管理
│   │   ├── dashboard.ts          # 仪表盘统计
│   │   ├── schedules.ts          # 调度管理
│   │   ├── settings.ts           # 系统设置
│   │   ├── logs.ts               # 操作日志
│   │   └── blacklist.ts          # 黑名单
│   ├── db/
│   │   ├── helpers.ts            # query/queryOne/execute/queryWithPagination/batchExecute
│   │   └── rows.ts               # 各表行类型
│   ├── lib/                      # auth/ids/time/request/errors/log/json
│   ├── middleware/auth.ts        # authMiddleware、adminOnly
│   └── types.ts                  # Bindings、AppContext
│
├── migrations/                   # D1 迁移 SQL
│   ├── 0001_schema.sql
│   ├── 0002_indexes.sql
│   └── 0003_seed.sql
├── scripts/seed-demo.sql         # 本地演示数据（可选）
│
└── frontend/                     # 前端应用（源码）
    ├── src/
    │   ├── api/                  # API 接口封装
    │   ├── components/            # 公共组件
    │   │   ├── ImageUpload.vue       # 图片上传组件
    │   │   ├── OrderList.vue         # 订单列表组件
    │   │   ├── PaymentDialog.vue     # 支付对话框
    │   │   ├── PaymentList.vue       # 支付记录列表
    │   │   ├── PaymentRecords.vue    # 支付记录组件
    │   │   ├── MaintenanceRecords.vue # 保养记录组件
    │   │   ├── ViolationList.vue     # 违章列表组件
    │   │   └── VehicleDetail.vue     # 车辆详情组件
    │   ├── layouts/              # 布局组件
    │   ├── router/               # 路由配置
    │   ├── stores/               # Pinia 状态管理
    │   ├── utils/                # 工具函数
    │   │   ├── constants.ts      # 公共常量
    │   │   └── helpers.ts        # 辅助函数
    │   └── views/                # 页面视图
    │       ├── Login.vue         # 登录页
    │       ├── Dashboard.vue     # 仪表盘
    │       ├── Users.vue         # 用户管理
    │       ├── Customers.vue     # 客户管理
    │       ├── Vehicles.vue      # 车辆管理入口
    │       ├── Orders.vue        # 订单管理
    │       ├── OrderDetail.vue   # 订单详情
    │       ├── Blacklist.vue     # 黑名单
    │       ├── OrderSources.vue  # 订单来源
    │       ├── Violations.vue    # 违章管理
    │       ├── Settings.vue      # 系统设置
    │       └── Logs.vue          # 操作日志
    └── public/                   # 静态资源
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

### 1. 仪表盘
- 统计卡片：今日取车、今日还车、待处理订单、可用车辆
- 车辆状态分布饼图
- 近30天订单趋势图
- 调度甘特图：可视化车辆占用时间
- 取还车调度表：自动从订单生成送车/收车任务

### 2. 订单管理
- 订单状态分类：待取车、待还车、已完成、已取消
- 创建订单：选择客户、车辆、服务类型（基础/优享/尊享）
- 免押功能：支持免押选项，自动计算免押到期日
- 取还车操作：记录取还车时间、地点、里程、照片
- 订单延期：支持延长租期
- 支付记录：支持多种支付方式和支付类型（租金、车损、违章等）
- 合同号管理

### 3. 客户管理
- 客户信息管理：姓名、电话、身份证、驾照
- 常用客户标记
- 客户来源标记（门店直租、美团、携程、滴滴等）
- 图片上传：身份证照片、驾照照片
- 快速查看客户订单

### 4. 车辆管理
- 车辆 CRUD：车牌、品牌、型号、颜色、年份、座位数
- 新能源车标识
- 车辆图片：行驶证、登记证书
- 车架号(VIN)、发动机号
- 车辆详情弹窗：快速查看车辆完整信息

### 5. 违章管理
- 违章记录登记
- 罚款金额、扣分记录
- 图片上传
- 处理状态跟踪
- 押金处理

### 6. 保养管理
- 按车辆查看保养记录
- 保养类型：常规保养、大保养、小修
- 里程提醒：自动计算下次保养时间
- 保养成本统计

### 7. 保险管理
- 按车辆查看保险记录
- 保险类型：交强险、商业险、座位险（多选）
- 保险到期提醒
- 保费统计

### 8. 年检证管理
- 车辆年检状态列表
- 年检证图片上传
- 到期提醒

### 9. 订单来源管理
- 来源渠道管理：门店直租、美团、携程、滴滴、其他
- 佣金比例设置
- 平台颜色标记

### 10. 黑名单管理
- 客户黑名单添加/移除
- 黑名单原因记录
- 客户状态自动检查

### 11. 用户管理
- 用户 CRUD（管理员）
- 角色权限：admin / staff
- 密码修改

### 12. 系统设置
- 主题色设置：6个预设 + 自定义调色盘
- 侧边栏风格：6个预设渐变 + 自定义双色渐变
- Logo 上传
- 系统标题设置

### 13. 操作日志
- 记录用户关键操作
- 操作类型、详情、时间

## 快速开始

### 环境要求
- Node.js 20+
- npm / pnpm
- Cloudflare 账号（仅上线时需要）

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

一条命令同时起两个服务：
- Worker（含 D1、R2 的本地模拟）：http://localhost:8787
- 前端 Vite（带 HMR，`/api` 与 `/uploads` 已代理到 8787）：http://localhost:5173

首次启动前需要初始化本地数据库：

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

### 部署上线（速查）

```bash
npx wrangler login                    # 1. 登录 Cloudflare
npm run d1:create                     # 2. 创建 D1，把返回的 database_id 填进 wrangler.jsonc
npm run r2:create                     # 3. 创建 R2 桶
npx wrangler secret put JWT_SECRET    # 4. 设置 JWT 密钥
npm run d1:migrate:remote             # 5. 线上建表 + 种子数据
npm run deploy                        # 6. 构建前端并发布（前后端一次发布）
```

> ⚠️ 速查版省略了几个必须注意的前置条件（占位符 `database_id`、默认 JWT 密钥、桶是否已存在）。第一次上线请照下面的 [部署到 Cloudflare（详细指南）](#部署到-cloudflare详细指南) 逐步执行。

### 默认账号
- 用户名：`admin`
- 密码：`admin123`

> ⚠️ 上线后第一件事就是登录并修改密码。`admin123` 是明文写在 `migrations/0003_seed.sql` 里的公开密码，任何拿到这份代码的人都能直接登录你的线上系统。

---

## 部署到 Cloudflare（详细指南）

本项目是**前后端一体部署**：Vue 前端构建产物（`frontend/dist`）由 Worker 以 Static Assets 托管，API、页面、上传文件共用同一个 Worker，**只需要发布一次，没有独立的前端部署**。

配置文件的唯一来源是 **`wrangler.jsonc`**（项目里没有也不需要 `wrangler.toml`）。

### 1. 资源清单

部署后你的 Cloudflare 账号里会出现这些资源：

| 资源 | 名称 / 绑定名 | 说明 | 是否需要手动创建 |
|---|---|---|---|
| Worker | `rental-admin` | 唯一的部署单元，含前端静态资源 | 否，`wrangler deploy` 自动创建 |
| D1 数据库 | `rental-db`，绑定 `DB` | 13 张业务表 | **是**，`npm run d1:create` |
| R2 存储桶 | `rental-uploads`，绑定 `UPLOADS` | 上传的图片 / PDF | **是**，`npm run r2:create` |
| Static Assets | 绑定 `ASSETS`，目录 `./frontend/dist` | 前端产物，每次发布重新打包上传 | 否 |
| Secret | `JWT_SECRET` | JWT 签名密钥 | **是**，`wrangler secret put` |
| 访问域名 | 默认 `https://rental-admin.<你的子域>.workers.dev` | 也可绑自定义域名 | 否 |

### 2. 前置准备

**环境要求**：Node.js 20+、npm、Cloudflare 账号（免费账号即可），依赖已安装（`npm install`）。

**登录 Cloudflare**（有浏览器的交互方式，推荐）：

```bash
npx wrangler login     # 浏览器授权
npx wrangler whoami    # 确认身份，并拿到 Account ID
```

`whoami` 输出里的 `Account ID` 后面配 GitHub Actions 时要用到，也可以在 Dashboard 右侧栏复制。

无浏览器环境（服务器 / CI）改用 API Token：

```bash
export CLOUDFLARE_API_TOKEN=你的令牌
export CLOUDFLARE_ACCOUNT_ID=0123456789abcdef0123456789abcdef
```

**发布前必做类型检查**（本项目没有单元测试，类型检查是唯一的验证手段）：

```bash
npm run typecheck
```

### 3. 首次部署

#### 步骤 1｜创建 D1 数据库，回填 `database_id`

```bash
npm run d1:create          # = wrangler d1 create rental-db
```

输出里会给出一段 `[[d1_databases]]` 配置，把其中的 `database_id` 填进 `wrangler.jsonc`：

```jsonc
{
  "binding": "DB",
  "database_name": "rental-db",
  "database_id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",   // ← 必须替换成真实 UUID
  "migrations_dir": "migrations"
}
```

> ⚠️ **`wrangler.jsonc` 里默认是占位符 `00000000-0000-0000-0000-000000000000`。** 不替换的话 `wrangler deploy` 依然会显示成功，但线上所有接口都会报错（找不到该 D1）。这是最容易踩的一步。

```bash
npx wrangler d1 list            # 确认库已存在
npx wrangler d1 info rental-db  # 查看详情
```

#### 步骤 2｜创建 R2 桶

```bash
npm run r2:create          # = wrangler r2 bucket create rental-uploads
npx wrangler r2 bucket list    # 确认
```

> ⚠️ **部署不会自动创建桶。** 桶缺失时页面能打开，但图片上传会失败（典型报错 `The specified bucket does not exist`）。桶名必须与 `wrangler.jsonc` 里的 `bucket_name` 一致（默认 `rental-uploads`）。

`/uploads/*` 是 Worker 从 R2 读回后返回的（`src/routes/upload.ts`），**不是公开桶**，因此不需要配置公开访问、CORS 或自定义域，只要绑定存在即可。

#### 步骤 3｜设置 `JWT_SECRET`

```bash
npx wrangler secret put JWT_SECRET
```

先本地生成一个强随机值，再粘贴到交互提示里：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

成功后输出 `✨ Success! Uploaded secret JWT_SECRET`，用 `npx wrangler secret list` 确认（只列名字，不显示值）。

> ⚠️ 不设置也能跑：`src/lib/auth.ts` 里硬编码了默认值 `rental-admin-secret-key-2026`。这个字符串就在公开代码里，任何人都能用它伪造任意用户的 JWT，**上线必须设置**。
> ⚠️ **更换 `JWT_SECRET` 会让所有已签发的 token 立即失效，全体用户被迫重新登录**（JWT 有效期 1 年，前端存 `localStorage.token`）。给已上线的系统换密钥请挑低峰期。

#### 步骤 4｜执行线上数据库迁移

```bash
npm run d1:migrate:remote  # = wrangler d1 migrations apply rental-db --remote
```

预期输出：

```
Migrations to be applied:
└ migrations/0001_schema.sql
└ migrations/0002_indexes.sql
└ migrations/0003_seed.sql

🌀 executing 3 migrations
✅ Successfully applied 3 migrations
```

说明：

- 迁移是**增量**的，执行过的不会重复执行，重复跑这条命令是安全的。
- `0003_seed.sql` 用 `INSERT OR IGNORE` 写入管理员账号，会把 `admin / admin123` 带到线上；再跑一次**不会**覆盖你已经改过的密码。
- Wrangler 在 apply 完成后会自动为该数据库打一个备份快照。
- 某个迁移报错时只有该迁移被回滚，之前成功的保持原样。

#### 步骤 5｜构建并发布

```bash
npm run deploy             # = npm run build:web && wrangler deploy
```

等价的分步写法：

```bash
npm run build:web          # vite build → frontend/dist
npx wrangler deploy
```

输出末尾会给出访问地址和 `Current Version ID`，**记下 Version ID，回滚时要用到**：

```
Your Worker has access to the following bindings:
- D1: DB
- R2: UPLOADS
- Assets: ASSETS
Uploaded rental-admin (x.xx sec)
  https://rental-admin.<你的子域>.workers.dev
Current Version ID: 9f8e7d6c-5b4a-3928-1000-abcdefabcdef
```

> ⚠️ 如果报 `The directory specified by the assets.directory field does not exist: frontend/dist`，说明没跑构建。`frontend/dist` 被 `.gitignore` 忽略，不会进 Git，每次部署都必须重新构建——用 `npm run deploy`，不要裸跑 `wrangler deploy`。

#### 步骤 6｜验收

```bash
curl https://rental-admin.<你的子域>.workers.dev/health
# {"status":"ok","timestamp":"2026-09-18T12:34:56.789Z"}

curl https://rental-admin.<你的子域>.workers.dev/api/nope
# {"success":false,"message":"接口不存在"}   ← 说明 /api/* 正确进了 Worker，而不是落到静态资源
```

浏览器打开根路径，用 `admin / admin123` 登录后**立刻修改密码**。

### 4. 绑定自定义域名

> **前提**：域名必须托管在同一个 Cloudflare 账号下。
> **前提**：`vite.config.ts` 没有配置 `base`，前端资源用绝对路径 `/assets/...`，所以**只能部署在根路径**。可以绑 `rental.example.com` 或根域名 `example.com`，但**不能**绑 `example.com/rental/` 这种带子路径的形式，否则静态资源全部 404。

**方式一：写进 `wrangler.jsonc`（推荐，可复现）**

```jsonc
{
  // ... 其他配置
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

Custom Domain 会自动写入 DNS 记录和 SSL 证书，不需要手动加 CNAME。需要 `www` 就再单独添加一条。

前端无需改任何代码：`frontend/src/api/index.ts` 的 `baseURL` 是相对路径 `/api`，图片也直接用后端返回的 `/uploads/...` 相对路径，换域名自动生效。

### 5. 后续更新、灰度与回滚

**常规更新**（前端或后端有任何改动都要重新发布，因为静态资源是 Worker 版本的一部分）：

```bash
git pull
npm ci                     # 依赖有变化时
npm run typecheck          # 必做
npm run deploy
npm run d1:migrate:remote  # 仅当 migrations/ 新增了文件时才需要
```

**查看部署历史**：

```bash
npx wrangler deployments list      # 最近 10 次部署
npx wrangler deployments status    # 当前线上状态
npx wrangler versions list         # 最近 10 个版本
```

**回滚**：

```bash
npx wrangler rollback <version-id> -m "回滚原因：xx 版本发布后订单列表白屏"
```

也可以在 Dashboard → `rental-admin` → **Deployments** 里选历史版本点 **Rollback**。排查线上错误用 `npx wrangler tail` 看实时日志。

> ⚠️ **回滚只回滚代码，不回滚数据库。** 如果新版带过删列 / 改列的迁移，回滚代码不会把数据库改回去。回滚前先做一次 `d1 export` 备份，必要时手写补偿迁移或用 D1 Time Travel 恢复。

**灰度发布**（可选）：

```bash
npx wrangler versions upload --message "v2.1: 新增催缴记录导出"
# 输出 Version ID: 01234567-89ab-cdef-0123-456789abcdef

npx wrangler versions deploy 01234567-89ab-cdef-0123-456789abcdef@10%   # 也可 @50%
```

流量比例可在 Dashboard → Deployment → **Version(s)** 里随时调整。

### 6. GitHub Actions 自动部署

项目目前没有任何 CI 配置（无 `.github` 目录），按下面流程添加。

#### 6.1 获取 `CLOUDFLARE_ACCOUNT_ID`

见上文 `npx wrangler whoami` 的输出，或 Dashboard 右侧栏。

#### 6.2 创建 API Token

打开 <https://dash.cloudflare.com/profile/api-tokens> → **Create Custom Token**，按最小权限配置：

| Scope | Item | Permission |
|---|---|---|
| Account | Workers Scripts | Edit |
| Account | Workers R2 Storage | Edit |
| Account | D1 | Edit |
| Account | Workers Routes | Edit |
| Account | Account Settings | Read |
| User | User Details | Read |
| Zone（仅当绑定了自定义域名） | Workers Routes | Edit |

Account Resources → Include 选你的账号。建议设置 TTL，令牌过期后需重新生成并更新 GitHub Secret。令牌**只显示一次**，立即复制。

> 嫌麻烦可直接用内置模板 **Edit Cloudflare Workers**，省事但权限偏大。

#### 6.3 配置 GitHub Secrets

仓库 **Settings → Secrets and variables → Actions → New repository secret**：

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 上一步复制的令牌 |
| `CLOUDFLARE_ACCOUNT_ID` | 32 位十六进制 Account ID |

> ⚠️ **不要把 `JWT_SECRET` 放进 CI 里每次部署重设。** Secret 是一次性资源，每次被换成新值都会让全体已登录用户掉线。本地 `wrangler secret put` 之后就不再动它。

#### 6.4 workflow 文件

新建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  workflow_dispatch:      # 允许在 Actions 页面手动触发

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false   # 部署不要被打断，排队执行

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Build frontend
        run: npm run build:web

      - name: Apply D1 migrations
        run: npx wrangler d1 migrations apply rental-db --remote

      - name: Deploy Worker + Static Assets
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          wranglerVersion: "4.134.0"   # 与本地 wrangler 保持一致，避免行为差异
          command: deploy

      - name: Smoke test
        run: |
          URL="https://rental-admin.<你的子域>.workers.dev/health"
          curl -fsS "$URL" | tee health.json
          grep -q '"status":"ok"' health.json
```

要点：

- **`npm run build:web` 这步不能省**：`wrangler-action` 只负责 `wrangler deploy`，不会替你跑 `vite build`，而 `frontend/dist` 不在 Git 里。
- **迁移排在部署之前**：旧代码跑新表结构通常没问题，新代码跑旧表一定报错。
- **`wranglerVersion` 必须显式指定**，否则 Action 用它自带的默认版本，可能与本地不一致。
- 迁移那一步靠 `env` 里的 API Token 认证，因为 `wrangler-action` 只给自己那一步注入凭据。
- 不用 Action 的话，Deploy 步骤可换成 `run: npx wrangler deploy`（env 里的凭据同样生效）。

> ⚠️ **首次部署仍需在本地手工做一遍**：创建 D1 / R2、回填 `database_id`、`secret put` 都是一次性资源准备，CI 只负责后续发布。

### 7. D1 数据管理

#### 备份（导出）

```bash
# 完整备份（结构 + 数据），定时任务建议用这条
npx wrangler d1 export rental-db --remote --output=backup-$(date +%Y%m%d-%H%M).sql

# 只要结构 / 只要数据
npx wrangler d1 export rental-db --remote --no-data   --output=schema-only.sql
npx wrangler d1 export rental-db --remote --no-schema --output=data-only.sql

# 只导出指定表（--table 可重复）
npx wrangler d1 export rental-db --remote --table=orders --table=vehicles --output=partial.sql

# 无人值守时跳过确认
npx wrangler d1 export rental-db --remote --output=nightly.sql -y
```

#### 恢复

Wrangler 没有 `d1 import`，恢复就是把导出的 SQL 灌回去：

```bash
npx wrangler d1 execute rental-db --remote --file=backup-20260918-1200.sql
```

> ⚠️ 导入前先确认 `wrangler.jsonc` 的 `database_id` 指向的是目标库。导出的 SQL 里包含 `DROP TABLE` / `CREATE TABLE`，会覆盖同名表的数据，建议先跑一次上面的备份。

#### Time Travel（时间点恢复）

```bash
npx wrangler d1 time-travel info rental-db            # 查看可恢复的时间点
npx wrangler d1 time-travel restore rental-db --timestamp=2026-09-18T10:00:00Z
```

恢复前 Wrangler 会自动为当前状态打一个快照。

#### 把本地数据搬到线上

```bash
npx wrangler d1 export rental-db --local  --output=local-dump.sql
npx wrangler d1 execute rental-db --remote --file=local-dump.sql
```

只想灌演示数据（客户 / 车辆 / 订单样例）：

```bash
npx wrangler d1 execute rental-db --remote --file=./scripts/seed-demo.sql
```

> `scripts/seed-demo.sql` 默认只在本地使用，不会随迁移自动上云。生产环境导入前先确认里面没有你想保留的同名数据。

#### 新增迁移

1. 在 `migrations/` 下新建 `NNNN_xxx.sql`（序号递增）。
2. 本地验证：`npm run d1:migrate`（`--local`）。
3. 上线：`npm run d1:migrate:remote`。
4. 提交时把迁移文件一起提交，CI 里已包含这一步。

### 8. 常见问题排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 部署成功但所有接口报错，日志含 `Couldn't find D1 DB` | `wrangler.jsonc` 的 `database_id` 还是占位符 | 用 `npx wrangler d1 info rental-db` 取真实 UUID 填回配置，重新 `npm run deploy` |
| 上传图片失败，报 `The specified bucket does not exist` | R2 桶没建或名字对不上 | `npm run r2:create`，确认桶名与 `wrangler.jsonc` 的 `bucket_name` 一致 |
| `The directory specified by the assets.directory field does not exist: frontend/dist` | 没构建前端 | 用 `npm run deploy`（含 `build:web`），不要裸跑 `wrangler deploy` |
| 部署后页面是旧的 | 浏览器缓存或漏了构建 | 强刷（Cmd/Ctrl+Shift+R）；确认 `npm run deploy` 的输出里有 `Uploaded` |
| 刷新子路由（如 `/orders`）404 | `assets.not_found_handling` 被改掉 | 保持 `single-page-application`，见 `wrangler.jsonc` |
| API 返回 HTML 而不是 JSON | `/api/*` 没走 Worker | 确认 `assets.run_worker_first` 包含 `/api/*` |
| 换完 `JWT_SECRET` 后所有人被踢下线 | 正常现象：旧 token 签名失效 | 重新登录即可；换密钥请挑低峰期 |
| 上传报超过 10MB / 类型不支持 | 后端硬限制：10MB，仅 `insurance` 允许 PDF | 压缩图片后再传；表单字段名必须固定为 `image` |
| 图片打不开（404） | 文件不在 R2，或 key 与数据库记录不一致 | `npx wrangler r2 object list rental-uploads` 核对 |
| 迁移执行失败 | 目标表 / 列已存在，或 SQL 语法问题 | 看报错行号修 SQL；已成功的迁移不会被回退 |
| `wrangler: command not found` | 依赖没装或没走 npx | `npm install`；脚本里统一用 `npx wrangler ...` |
| 接口偶发超时 / 计费异常 | D1 免费额度打满 | 看 Dashboard 用量；D1 免费版为 5GB 存储 + 每日读写额度 |

### 9. 上线安全检查清单

- [ ] `wrangler.jsonc` 的 `database_id` 已换成真实 UUID（不是 `00000000-...`）
- [ ] R2 桶 `rental-uploads` 已创建，桶名与配置一致
- [ ] 已 `wrangler secret put JWT_SECRET`（不使用代码里的默认密钥）
- [ ] 已登录并改掉 `admin123`
- [ ] 已 `npm run typecheck` 通过
- [ ] 备份策略已就绪（定期 `d1 export`）

### 10. 费用与额度提醒

- **免费额度**：D1 5GB 存储 + 每日读写额度；Workers 每日 10 万请求；Static Assets 单文件上限 10MiB（当前产物最大约 874KB，安全）。
- **R2 需绑定支付方式**（即便完全在免费额度内），免费额度为每月 10GB 存储，出流量免费。
- `wrangler.jsonc` 里 `observability.enabled: true` 会在部署时提示开启 Workers Observability，免费计划日志采样有限，不需要可在配置里关掉。
- `/uploads/*` 因为配了 `run_worker_first`，每次读取都会进 Worker（有 `caches.default` 缓存兜底）并产生一次 R2 读操作。

## 数据表结构

| 表名 | 说明 |
|------|------|
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

## 开发约定

### 数据库操作
- **必须使用辅助函数**：`query()`、`queryOne()`、`execute()`，禁止直接调用 `c.env.DB.prepare()`
- **D1 是异步的**：所有数据库调用都要 `await`；每个 handler 第一行 `const db = c.env.DB;`
- **分页查询**：使用 `queryWithPagination()` → `{ data, total, page, pageSize, totalPages }`
- **复合写操作**：多条 INSERT/UPDATE 放进 `batchExecute()`，D1 的 batch 是隐式事务
- **数据库迁移**：在 `migrations/` 下新增 `NNNN_xxx.sql`，然后执行 `npm run d1:migrate`
- **外键**：D1 外键始终开启，改表结构时必须显式决定 `ON DELETE` 行为

### API 响应格式
统一返回 `{ success: boolean, data?: any, message?: string }`

### 代码规范
- **控制器签名**：统一为 `async (c: AppContext): Promise<Response>`
- **命名约定**：文件 kebab-case，函数 camelCase，数据库 snake_case
- **错误处理**：控制器保留 try-catch，统一 `return handleError(c, '标签:', error)`
- **操作日志**：使用 `logAction()` 辅助函数记录关键操作

### 开发禁忌
- ❌ 类型抑制（`as any`、`@ts-ignore`）
- ❌ 空 catch 块
- ❌ SQL 字符串拼接（必须使用参数化查询）
- ❌ 跳过类型检查提交
- ❌ 日志中记录敏感信息（密码、token）

## 注意事项

- **同源部署**：前后端由同一个 Worker 提供，不存在跨域问题，图片直接用相对路径
- **文件大小限制**：上传文件限制 10MB，存 R2；`/uploads/*` 由 Worker 读回并带长缓存
- **SPA 刷新**：`not_found_handling: single-page-application`，直接刷新子路由不会 404
- **本地数据位置**：`wrangler dev` 的本地 D1/R2 数据在 `.wrangler/state`，删掉即重置
- **无测试框架**：项目当前没有测试，类型检查是唯一的验证方式
- **免费额度**：D1 每次调用上限 50 条查询，R2 出流量免费（存储 10GB/月）

## 设计系统

本项目采用 **Apple 设计系统**，强调极简、产品聚焦和电影化节奏。核心原则：
- **唯一强调色**：Apple Blue (`#0071e3`)
- **无可见边框**：卡片/容器不使用边框，通过背景色和阴影区分层级
- **毛玻璃导航栏**：`backdrop-filter: saturate(180%) blur(20px)`
- **完整规范**：详见 [QWEN.md](QWEN.md)

## API 接口概览

### 认证
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户
- `PUT /api/auth/password` - 修改密码

### 用户管理
- `GET/POST /api/users` - 列表/创建
- `PUT/DELETE /api/users/:id` - 更新/删除

### 客户管理
- `GET/POST /api/customers` - 列表/创建
- `PUT/DELETE /api/customers/:id` - 更新/删除
- `PUT /api/customers/:id/regular` - 设置常用客户

### 车辆管理
- `GET/POST /api/vehicles` - 列表/创建
- `GET /api/vehicles/available` - 可用车辆
- `PUT/DELETE /api/vehicles/:id` - 更新/删除

### 订单管理
- `GET/POST /api/orders` - 列表/创建
- `GET /api/orders/:id` - 订单详情
- `PUT /api/orders/:id` - 更新订单
- `PUT /api/orders/:id/pickup` - 取车
- `PUT /api/orders/:id/return` - 还车
- `PUT /api/orders/:id/extend` - 延期
- `PUT /api/orders/:id/cancel` - 取消
- `POST /api/orders/:id/payments` - 添加支付

### 调度管理
- `GET /api/schedules` - 调度列表
- `GET /api/schedules/gantt` - 甘特图数据

### 违章管理
- `GET/POST /api/violations` - 列表/创建
- `PUT/DELETE /api/violations/:id` - 更新/删除

### 黑名单
- `GET/POST /api/blacklist` - 列表/添加
- `DELETE /api/blacklist/:id` - 移除

### 订单来源
- `GET/POST /api/order-sources` - 列表/创建
- `PUT/DELETE /api/order-sources/:id` - 更新/删除

### 保养管理
- `GET/POST /api/maintenance` - 列表/创建
- `PUT/DELETE /api/maintenance/:id` - 更新/删除

### 保险管理
- `GET/POST /api/insurance` - 列表/创建
- `PUT/DELETE /api/insurance/:id` - 更新/删除

### 年检证
- `GET /api/inspections` - 车辆年检状态列表
- `GET /api/inspections/stats` - 统计
- `PUT /api/inspections/:vehicle_id` - 登记/更新
- `DELETE /api/inspections/:vehicle_id` - 删除

### 系统设置
- `GET/PUT /api/settings` - 获取/更新设置

### 操作日志
- `GET /api/logs` - 日志列表

### 文件上传
- `POST /api/upload/:type` - 上传文件（type: vehicle|customer|inspection|insurance|maintenance|violation|other）

---

## 更新日志

### 2026-04-08

#### 文档重构
- 精简 `AGENTS.md`，改为中文版快速参考指南
- `QWEN.md` 新增 Apple 设计系统完整规范（色彩系统、字体规则、组件样式、布局原则）

#### 前端样式优化
- 提取订单详情弹窗样式至全局 `style.css`，统一所有页面弹窗圆角为 12px
- 添加订单详情弹窗暗色模式支持
- 移除 Dashboard.vue 中重复的暗色模式规则和冗余样式

### 2026-04-01

#### 移动端体验优化
- 所有移动端日期/时间输入框改用原生选择器
- 提升移动端操作友好性，无需加载第三方组件
- 兼容暗色模式

#### 仪表盘调度功能优化
- 优化待收送表格显示逻辑
- 送车任务：所有未完成订单中取车时间在未来的都显示
- 收车任务：所有未完成订单中还车时间在未来的都显示
- 不论订单是否已取车，根据日期自动显示待办任务

### 2026-03-29

#### 车辆详情弹窗组件
- 新增 `VehicleDetailDialog.vue` 组件
- 显示车牌号、品牌、型号、颜色、年份、座位数、里程等完整信息
- 支持新能源车标识、行驶证/登记证书图片预览

#### 甘特图数据增强
- 甘特图数据返回完整车辆信息
- 支持查看详细订单信息

#### 订单管理界面优化
- Orders.vue 和 OrderDetail.vue 大幅重构

#### 仪表盘功能增强
- Dashboard.vue 界面优化，甘特图功能增强

### 2026-03-25

#### 调度管理功能
- 从订单自动生成取还车调度安排
- 支持导出为图片下载
- 平台颜色使用订单来源中设置的颜色

### 2026-03-23

#### 支付功能增强
- 支付方式新增"平台支付"
- 支付类型新增"车损"
- 已还车订单也可添加支付记录

#### 代码复用优化
- 新增 `utils/constants.ts` 和 `utils/helpers.ts`
- 减少重复代码约 100+ 行

### 2026-03-22

#### 数据库迁移
- sql.js 替换为 better-sqlite3
- 自动持久化，启用 WAL 模式

#### 系统主题设置
- 主题色、侧边栏风格自定义
- Logo 上传功能

### 2026-03-21

#### 新能源车标识
- 车辆支持新能源标记
- 车牌样式：新能源绿底白字，非新能源蓝底白字

#### 服务类型
- 订单支持服务类型：基础/优享/尊享

#### 免押功能
- 订单支持免押选项
- 自动计算免押到期日期

#### 取还车增强
- 取车/还车支持里程记录
- 取车/还车支持照片上传
