# 租车管理系统 - Cloudflare 迁移指南

## 概述

本项目已从传统的 Node.js + Express + SQLite 架构迁移到 Cloudflare 全栈平台。

## 项目结构

```
/workspace/
├── backend/                    # 原后端 (保留用于参考)
├── frontend/                   # 前端 (可部署到 Cloudflare Pages)
├── cloudflare-backend/         # 新的 Cloudflare Workers 后端
│   ├── src/
│   │   ├── controllers/        # 控制器
│   │   ├── db/                 # 数据库配置和 Schema
│   │   ├── middleware/         # 中间件 (认证)
│   │   ├── utils/              # 工具函数
│   │   └── index.ts            # Workers 入口
│   ├── package.json
│   ├── wrangler.toml           # Cloudflare 配置
│   ├── tsconfig.json
│   └── README.md
└── CLOUDFLARE_MIGRATION.md     # 本文件
```

## 技术栈对比

| 组件 | 原架构 | Cloudflare 架构 |
|------|--------|-----------------|
| Runtime | Node.js 18+ | Cloudflare Workers |
| 框架 | Express 5 | Hono (轻量路由) |
| 数据库 | better-sqlite3 (本地文件) | D1 (分布式 SQLite) |
| 文件存储 | 本地文件系统 | R2 (对象存储) |
| 认证 | JWT + bcryptjs | JWT (原生 crypto) + bcryptjs |
| 部署 | 手动/VPS | Wrangler CLI |
| CDN | 需额外配置 | 内置全球 Edge 网络 |

## 快速开始

### 前置条件

1. Cloudflare 账号 (免费版即可)
2. Node.js 18+
3. npm 或 pnpm

### 第一步：安装依赖

```bash
cd cloudflare-backend
npm install
```

### 第二步：登录 Cloudflare

```bash
npx wrangler login
```

这会打开浏览器让你授权 Wrangler 访问你的 Cloudflare 账号。

### 第三步：创建 D1 数据库

```bash
npx wrangler d1 create rental-db
```

命令输出示例：
```
✅ Successfully created DB 'rental-db' in region UNKNOWN
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "rental-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**重要**: 复制 `database_id`，填入 `wrangler.toml`。

### 第四步：初始化数据库

```bash
npx wrangler d1 execute rental-db --file=src/db/schema.sql
```

这会创建所有数据表并插入默认管理员账号。

### 第五步：创建 R2 Bucket

```bash
npx wrangler r2 bucket create rental-uploads
```

### 第六步：更新配置文件

编辑 `wrangler.toml`:

```toml
name = "rental-admin-backend"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "rental-db"
database_id = "你的 database_id"  # 填入第三步的 ID

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "rental-uploads"

[vars]
JWT_SECRET = "change-this-to-a-strong-secret"
```

### 第七步：设置密钥

```bash
npx wrangler secret put JWT_SECRET
```

输入一个强密码（至少 32 字符）。

### 第八步：本地测试

```bash
npm run dev
```

访问 http://localhost:3001/health 验证服务正常。

### 第九步：部署

```bash
npm run deploy
```

部署成功后会显示 Worker URL，例如：
```
https://rental-admin-backend.your-subdomain.workers.dev
```

## 前端部署 (Cloudflare Pages)

### 方法一：通过 GitHub 自动部署

1. 将代码推送到 GitHub
2. 在 Cloudflare Dashboard 创建 Pages 项目
3. 连接 GitHub 仓库
4. 构建设置：
   - Framework preset: Vite
   - Build command: `npm run build`
   - Build output: `dist`
5. 环境变量：
   - `VITE_API_URL`: 填入后端 Worker URL

### 方法二：手动部署

```bash
cd frontend
npm install
npm run build
npx wrangler pages deploy dist
```

## API 迁移状态

| API | 状态 | 备注 |
|-----|------|------|
| POST /api/auth/login | ✅ 已完成 | JWT 认证 |
| GET /api/auth/me | ✅ 已完成 | 获取当前用户 |
| PUT /api/auth/password | ✅ 已完成 | 修改密码 |
| POST /api/upload/* | ✅ 已完成 | R2 存储 |
| GET /uploads/* | ✅ 已完成 | R2 读取 |
| 其他 API | 🔄 待迁移 | 见下方详细列表 |

## 待迁移的 API 列表

以下 API 需要从原 `backend/src/controllers/` 迁移：

### 用户管理
- GET /api/users
- POST /api/users
- PUT /api/users/:id
- DELETE /api/users/:id
- PUT /api/users/:id/reset-password

### 客户管理
- GET /api/customers
- POST /api/customers
- PUT /api/customers/:id
- DELETE /api/customers/:id
- PUT /api/customers/:id/regular

### 车辆管理
- GET /api/vehicles
- GET /api/vehicles/available
- POST /api/vehicles
- PUT /api/vehicles/:id
- DELETE /api/vehicles/:id

### 订单管理
- GET /api/orders
- POST /api/orders
- GET /api/orders/:id
- PUT /api/orders/:id
- PUT /api/orders/:id/pickup
- PUT /api/orders/:id/return
- PUT /api/orders/:id/extend
- PUT /api/orders/:id/cancel
- POST /api/orders/:id/payments

### 调度管理
- GET /api/schedules/recent
- GET /api/schedules/gantt

### 违章管理
- GET /api/violations
- POST /api/violations
- PUT /api/violations/:id
- DELETE /api/violations/:id
- PUT /api/violations/:id/handle
- PUT /api/violations/:id/fee

### 黑名单
- GET /api/blacklist
- POST /api/blacklist
- DELETE /api/blacklist/:id
- GET /api/blacklist/check

### 保养管理
- GET /api/maintenance
- POST /api/maintenance
- PUT /api/maintenance/:id
- DELETE /api/maintenance/:id

### 保险管理
- GET /api/insurance
- POST /api/insurance
- PUT /api/insurance/:id
- DELETE /api/insurance/:id

### 年检证管理
- GET /api/inspections
- PUT /api/inspections/:vehicle_id
- DELETE /api/inspections/:vehicle_id

### 订单来源
- GET /api/order-sources
- POST /api/order-sources
- PUT /api/order-sources/:id
- DELETE /api/order-sources/:id

### 系统设置
- GET /api/settings
- PUT /api/settings

### 操作日志
- GET /api/logs
- GET /api/logs/action-types
- GET /api/logs/entity-types
- GET /api/logs/users

### 仪表盘
- GET /api/dashboard/stats

## 前端配置

修改 `frontend/src/api/index.ts`:

```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://rental-admin-backend.your-subdomain.workers.dev/api',
  timeout: 10000
})
```

创建 `.env.production`:

```bash
VITE_API_URL=https://rental-admin-backend.your-subdomain.workers.dev/api
```

## 成本估算

### 免费额度 (适合小型应用)

| 服务 | 免费额度 | 超出后价格 |
|------|----------|-----------|
| Workers | 10 万次请求/天 | $0.15 / 百万次 |
| D1 | 500 万行读取/天 | $0.25 / 百万行 |
| R2 | 10GB 存储 + 1000 万次读取/月 | $0.015 / GB |
| Pages | 500 次构建/天 + 无限流量 | - |

### 典型场景 (日活 100 用户)

- 每日请求：~5000 次
- 每月 D1 读取：~15 万行
- 存储：~2GB
- **月成本：$0** (完全在免费额度内)

## 优势

1. **零运维**: 无需管理服务器、数据库备份、安全更新
2. **全球加速**: 自动 CDN，用户就近访问 Edge 节点
3. **自动扩展**: 按需分配资源，无容量规划压力
4. **成本效益**: 按使用量付费，低流量时几乎免费
5. **高可用**: 多区域冗余，99.9% SLA
6. **开发者体验**: 本地开发 → 一键部署

## 注意事项

### D1 限制
- 单条 SQL 最多影响 1000 行
- 每次写入最多 1MB
- 不支持 PRAGMA 语句 (除少数白名单)
- 外键约束默认关闭

### R2 限制
- 单文件最大 5TB
- 支持 S3 API 兼容
- 跨域访问需在 Bucket 设置中配置 CORS

### Workers 限制
- CPU 时间：10ms (免费) / 50ms (付费)
- 内存：128MB
- 不支持 WebSocket (需用 Cloudflare Durable Objects)

## 故障排查

### 常见问题

1. **D1 数据库未找到**
   ```bash
   npx wrangler d1 list
   # 检查 database_id 是否正确
   ```

2. **R2 Bucket 权限错误**
   ```bash
   npx wrangler r2 bucket list
   # 确认 bucket 名称匹配
   ```

3. **JWT 认证失败**
   - 检查 JWT_SECRET 是否已正确设置
   - 确认客户端 token 格式正确

4. **CORS 错误**
   - Workers 已内置 CORS 处理
   - 检查前端请求头是否正确

### 查看日志

```bash
npx wrangler tail
```

实时查看 Worker 日志输出。

## 后续优化建议

1. **缓存层**: 使用 KV Namespace 缓存热点数据
2. **图片优化**: 集成 Cloudflare Images 自动压缩
3. **API 限流**: 实现速率限制防止滥用
4. **批量操作**: 优化批量查询减少 D1 读取次数
5. **监控告警**: 配置 Cloudflare Analytics 和告警规则
6. **CI/CD**: 使用 GitHub Actions 自动部署

## 参考资料

- [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)
- [D1 数据库](https://developers.cloudflare.com/d1/)
- [R2 对象存储](https://developers.cloudflare.com/r2/)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Workers 运行时 API](https://developers.cloudflare.com/workers/runtime-apis/)

## 回滚方案

如需回滚到原架构：

1. 导出 D1 数据：
   ```bash
   npx wrangler d1 export rental-db --output=backup.sql
   ```

2. 转换 SQLite 格式 (如需要)

3. 恢复原后端服务

## 联系支持

如有问题，请查阅：
- Cloudflare 社区论坛
- GitHub Issues
- 官方文档

---

最后更新：2025-01-XX
