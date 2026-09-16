# Cloudflare 部署指南

本项目已重构为支持 Cloudflare 部署，包含以下组件：

## 架构说明

### 前端 (Pages)
- 使用 Vite 构建的 Vue 3 应用
- 静态资源通过 Cloudflare Pages 部署
- API 请求指向 Worker URL

### 后端 (Workers)
- 使用 Hono 框架构建的轻量级 API
- 运行在 Cloudflare Workers 上
- 使用 D1 数据库存储数据
- 使用 R2 存储上传的文件

## 前置要求

1. **Cloudflare 账号** - 需要免费的 Cloudflare 账号
2. **Node.js 18+** - 本地开发环境
3. **Wrangler CLI** - Cloudflare 命令行工具

## 快速开始

### 1. 安装 Wrangler

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

### 3. 创建 D1 数据库

```bash
wrangler d1 create car-rental-db
```

记录返回的 `database_id`，然后更新 `wrangler.toml` 中的 `database_id` 字段。

### 4. 创建 R2 存储桶

```bash
wrangler r2 bucket create car-rental-uploads
```

### 5. 初始化数据库

```bash
wrangler d1 execute car-rental-db --file=backend/sql/schema.sql
```

### 6. 配置环境变量

编辑 `wrangler.toml`，设置以下变量：

```toml
[vars]
JWT_SECRET = "your-secure-random-secret"
FRONTEND_URL = "https://your-pages-subdomain.pages.dev"
```

### 7. 部署后端 (Worker)

```bash
cd backend
npm install
npm run deploy
```

### 8. 部署前端 (Pages)

```bash
cd frontend
npm install
npm run build
wrangler pages deploy dist --project-name=car-rental-frontend
```

### 9. 更新前端 API 地址

在前端项目中创建 `.env` 文件：

```bash
VITE_API_URL=https://car-rental-system.your-subdomain.workers.dev/api
```

重新构建并部署前端。

## 本地开发

### 后端 Worker 本地开发

```bash
cd backend
npm run dev:worker
```

这将在 localhost:8787 启动本地 Worker。

### 前端本地开发

```bash
cd frontend
npm run dev
```

更新 `vite.config.ts` 中的代理目标为 `http://localhost:8787`。

## 项目结构

```
/workspace/
├── wrangler.toml              # Cloudflare 配置
├── backend/
│   ├── src/
│   │   ├── worker.ts          # Cloudflare Worker 入口
│   │   └── ...                # 原有 Express 代码（保留）
│   ├── sql/
│   │   └── schema.sql         # D1 数据库迁移脚本
│   └── package.json
└── frontend/
    ├── src/
    │   └── ...                # Vue 3 前端代码
    └── package.json
```

## 重要注意事项

### 1. 密码加密
由于 bcrypt 在 Workers 中不可用，当前实现使用简化方案。生产环境建议：
- 使用 @node-rs/bcrypt-wasm
- 或迁移到基于 Web Crypto API 的方案

### 2. 文件上传
文件存储在 R2 中，需要配置公开访问或使用 signed URLs。

### 3. 数据库迁移
D1 数据库的 schema 需要从 SQLite 迁移，参考 `backend/sql/schema.sql`。

### 4. 环境变量
敏感信息应通过 Cloudflare Dashboard 或 `wrangler secret` 命令设置：

```bash
wrangler secret put JWT_SECRET
```

## 成本估算

- **Workers**: 每天 100,000 次请求免费
- **D1**: 每月 5GB 存储免费
- **R2**: 每月 10GB 存储免费
- **Pages**: 无限请求，500 次构建/月

对于小型租车公司，免费套餐应该足够使用。

## 故障排查

### Worker 日志
```bash
wrangler tail
```

### D1 查询
```bash
wrangler d1 execute car-rental-db --command="SELECT * FROM users LIMIT 5"
```

### 检查部署状态
```bash
wrangler whoami
wrangler deployments list
```

## 后续优化建议

1. **完整实现所有 API 端点** - 当前 worker.ts 仅实现了核心接口
2. **添加缓存策略** - 使用 Cloudflare Cache API
3. **实现定时任务** - 使用 Cron Triggers 处理到期订单
4. **添加监控** - 集成 Cloudflare Analytics
5. **CI/CD** - 使用 GitHub Actions 自动部署

## 回滚方案

如果遇到问题，可以回滚到原来的 Express + SQLite 部署方式：

```bash
# 原有的后端代码保留在 backend/src/index.ts
# 使用 Docker 或传统服务器部署
```
