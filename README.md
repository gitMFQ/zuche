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

### 部署上线

```bash
npx wrangler login                    # 1. 登录 Cloudflare
npm run d1:create                     # 2. 创建 D1，把返回的 database_id 填进 wrangler.jsonc
npm run r2:create                     # 3. 创建 R2 桶
npx wrangler secret put JWT_SECRET    # 4. 设置 JWT 密钥（可选，不设则用默认值）
npm run d1:migrate:remote             # 5. 线上建表 + 种子数据
npm run deploy                        # 6. 构建前端并发布（前后端一次发布）
```

### 默认账号
- 用户名：`admin`
- 密码：`admin123`

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
