# Cloudflare 部署快速指南

## 架构说明

本项目已重构为支持 Cloudflare 全栈部署：

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Cloudflare     │────▶│  Cloudflare      │────▶│  Cloudflare     │
│  Pages (前端)   │     │  Workers (API)   │     │  D1 (数据库)    │
│  Vue 3 + Vite   │     │  Hono 框架       │     │  SQLite 兼容    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Cloudflare R2   │
                        │  (文件存储)      │
                        └──────────────────┘
```

## 部署步骤

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

### 3. 创建 D1 数据库

```bash
cd backend
wrangler d1 create car-rental-db
```

记录返回的 `database_id`，更新 `backend/wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "car-rental-db"
database_id = "你的 database_id"
```

### 4. 创建 R2 存储桶

```bash
wrangler r2 bucket create car-rental-uploads
```

配置 R2 公开访问（可选）：
- 登录 Cloudflare Dashboard
- 进入 R2 → car-rental-uploads → Settings
- 启用 "Public access" 或配置 CORS

### 5. 初始化数据库

```bash
wrangler d1 execute car-rental-db --file=sql/schema.sql
```

### 6. 设置密钥

```bash
# JWT 密钥（用于认证）
wrangler secret put JWT_SECRET

# 输入一个强随机字符串，例如：
# openssl rand -base64 32
```

### 7. 部署后端 Worker

```bash
cd backend
npm install
npm run deploy
```

记录返回的 Worker URL，例如：`https://car-rental-system.your-subdomain.workers.dev`

### 8. 配置前端 API 地址

创建 `frontend/.env` 文件：

```bash
VITE_API_URL=https://car-rental-system.your-subdomain.workers.dev/api
```

### 9. 部署前端 Pages

```bash
cd frontend
npm install
npm run build
wrangler pages deploy dist --project-name=car-rental-frontend
```

### 10. 访问应用

打开返回的 Pages URL，例如：`https://car-rental-frontend.your-subdomain.pages.dev`

默认账号：
- 用户名：`admin`
- 密码：`admin123`

## 本地开发

### 后端 Worker 本地开发

```bash
cd backend
npm run dev:worker
```

访问：http://localhost:8787

### 前端本地开发

```bash
cd frontend
npm run dev
```

修改 `vite.config.ts`，将代理目标改为 `http://localhost:8787`。

## 项目文件结构

```
/workspace/
├── CLOUDFLARE_DEPLOYMENT.md    # 详细部署文档
├── README_CLOUDFLARE.md        # 本文件（快速指南）
├── backend/
│   ├── src/
│   │   ├── worker.ts           # Cloudflare Worker 入口 (Hono)
│   │   └── ...                 # 原有 Express 代码（保留）
│   ├── sql/
│   │   └── schema.sql          # D1 数据库迁移脚本
│   ├── wrangler.toml           # Worker 配置
│   └── package.json
└── frontend/
    ├── pages.toml              # Pages 配置
    ├── .env                    # 环境变量（需创建）
    └── package.json
```

## 重要注意事项

### 1. 密码加密
当前实现使用简化方案。生产环境应使用：
- `@node-rs/bcrypt-wasm` 或
- 基于 Web Crypto API 的方案

### 2. 文件上传
- 文件存储在 R2 中
- 需要配置 R2 公开访问或使用 signed URLs
- 前端 API 调用已适配 R2

### 3. 数据库差异
- D1 是分布式 SQLite，不支持所有 SQLite 功能
- 避免使用 `PRAGMA` 命令
- 使用参数化查询防止 SQL 注入

### 4. Worker 限制
- 单次请求最长 10 分钟（unbound workers）
- 内存限制 128MB
- CPU 时间限制 50ms（标准）/ 10 秒（unbound）

### 5. 环境变量
敏感信息使用 `wrangler secret` 设置：

```bash
wrangler secret put JWT_SECRET
wrangler secret put DATABASE_URL
```

## 成本估算

| 服务 | 免费额度 | 超出后价格 |
|------|---------|-----------|
| Workers | 100,000 请求/天 | $0.30 / 百万请求 |
| D1 | 5GB 存储，5M 读取/天 | $0.75 / GB/月 |
| R2 | 10GB 存储，10M 操作/月 | $0.015 / GB/月 |
| Pages | 无限请求，500 构建/月 | $0.55 / 额外 500 构建 |

小型租车公司通常可以使用免费套餐。

## 故障排查

### 查看 Worker 日志

```bash
wrangler tail
```

### 查询 D1 数据库

```bash
wrangler d1 execute car-rental-db --command="SELECT * FROM users LIMIT 5"
```

### 检查部署状态

```bash
wrangler whoami
wrangler deployments list
```

### 回滚部署

```bash
wrangler rollback
```

## 后续优化

1. **完整实现所有 API** - 当前 `worker.ts` 实现了核心接口，可继续完善
2. **添加缓存** - 使用 Cloudflare Cache API 加速频繁查询
3. **定时任务** - 使用 Cron Triggers 处理到期订单
4. **监控告警** - 集成 Cloudflare Analytics
5. **CI/CD** - 使用 GitHub Actions 自动部署

## 回滚方案

如遇问题，可回滚到原 Express + SQLite 部署方式：

```bash
# 原有代码保留在 backend/src/index.ts
# 可使用 Docker 或传统服务器部署
docker build -t car-rental-backend ./backend
```
