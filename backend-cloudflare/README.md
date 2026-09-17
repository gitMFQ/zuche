# Cloudflare Workers 适配版本

本目录包含将租车管理系统迁移到 Cloudflare Workers 的适配代码。

## 主要变更

### 1. 数据库迁移：SQLite → D1
- **原实现**: better-sqlite3 (本地文件数据库)
- **新实现**: Cloudflare D1 (基于 SQLite 的云数据库)
- **影响**: 需要修改所有数据库操作代码

### 2. 文件存储：本地文件系统 → R2
- **原实现**: 本地 uploads 目录
- **新实现**: Cloudflare R2 对象存储
- **影响**: 文件上传/下载逻辑需要重写

### 3. 运行时环境：Node.js → Cloudflare Workers
- **原实现**: Express.js + Node.js APIs
- **新实现**: Hono 框架 (轻量级，兼容 Workers)
- **影响**: 
  - 移除 express、multer、cors 等 Node.js 特定依赖
  - 使用 Workers 原生 APIs (fetch, Request, Response)
  - JWT 验证逻辑保持不变

### 4. 前端部署
- **原实现**: Vite 开发服务器 + 独立部署
- **新实现**: Workers Static Assets
- **影响**: 前端构建后直接由 Workers 提供

## 目录结构

```
backend-cloudflare/
├── src/
│   ├── db/
│   │   └── index.ts          # D1 数据库初始化和迁移
│   ├── middleware/
│   │   └── auth.ts           # JWT 认证中间件 (适配 Hono)
│   ├── controllers/          # 业务逻辑 (需要适配 D1)
│   ├── routes/
│   │   └── index.ts          # 路由定义 (适配 Hono)
│   ├── utils/
│   │   └── helpers.ts        # 辅助函数
│   └── index.ts              # 入口文件 (Hono 应用)
├── package.json              # 依赖配置
└── tsconfig.json             # TypeScript 配置
```

## 迁移步骤

### 第一步：创建 D1 数据库
```bash
wrangler d1 create rental-admin-db
```

### 第二步：安装依赖
```bash
cd backend-cloudflare
npm install
```

### 第三步：本地开发
```bash
npm run dev
```

### 第四步：部署
```bash
npm run deploy
```

## API 兼容性

所有 API 接口路径和响应格式保持不变，确保前端无需修改。

## 注意事项

1. **环境变量**: 在 wrangler.toml 或 Cloudflare Dashboard 中配置
2. **数据库迁移**: 首次部署需要执行初始化脚本
3. **文件上传**: 使用 R2 替代本地存储，需要配置 bucket
4. **CORS**: Hono 默认处理 CORS，无需额外中间件

## 技术栈对比

| 功能 | 原实现 | Cloudflare 实现 |
|------|--------|----------------|
| 运行时 | Node.js 18+ | Cloudflare Workers |
| 框架 | Express 5 | Hono |
| 数据库 | better-sqlite3 | D1 |
| 文件存储 | 本地文件系统 | R2 |
| 认证 | JWT | JWT (不变) |
| 前端托管 | 独立服务器 | Workers Static Assets |

## 成本估算

- **Workers**: 免费额度 100,000 请求/天
- **D1**: 免费额度 5GB 存储，100 万读操作/天
- **R2**: 免费额度 10GB 存储，1000 万读操作/月

对于小型租车公司，免费额度基本够用。
