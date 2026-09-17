# Cloudflare Workers + GitHub 自动部署指南

## 📋 前置准备

### 1. 确保代码已推送到 GitHub
```bash
cd /workspace/cloudflare-rental
git init
git add .
git commit -m "Initial commit for Cloudflare deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cloudflare-rental.git
git push -u origin main
```

### 2. 在 Cloudflare 面板配置自动部署

---

## 🚀 使用 Wrangler CLI 部署（推荐）

### 步骤 1：安装 Wrangler CLI
```bash
npm install -g wrangler
```

### 步骤 2：登录 Cloudflare
```bash
wrangler login
```
这会打开浏览器，授权 Wrangler 访问你的 Cloudflare 账号。

### 步骤 3：创建 D1 数据库
```bash
# 创建数据库
wrangler d1 create rental-db

# 记录返回的 database_id，更新到 wrangler.toml 中
```

### 步骤 4：创建 KV Namespace
```bash
# 创建 KV
wrangler kv:namespace create rental-settings

# 记录返回的 namespace_id，更新到 wrangler.toml 中
```

### 步骤 5：创建 R2 Bucket
```bash
# 创建 R2 bucket
wrangler r2 bucket create rental-uploads
```

### 步骤 6：配置环境变量
```bash
# 设置 JWT_SECRET
wrangler secret put JWT_SECRET
# 输入你的强随机密钥

# 设置 ADMIN_PASSWORD
wrangler secret put ADMIN_PASSWORD
# 输入管理员密码
```

### 步骤 7：初始化数据库
```bash
cd backend
wrangler d1 execute rental-db --remote --file=src/db/migrations/001_initial.sql
```

### 步骤 8：部署后端
```bash
cd backend
npm install
npm run deploy
# 或者直接使用：
# npx wrangler deploy
```

### 步骤 9：获取 Workers URL
部署成功后，Wrangler 会输出类似以下信息：
```
Published cloudflare-rental-backend (https://cloudflare-rental-backend.your-subdomain.workers.dev)
```
记录这个 URL，用于前端配置。

### 步骤 10：部署前端
```bash
cd frontend
npm install
npm run build
npx wrangler pages deploy dist --project-name=cloudflare-rental-frontend
```

### 步骤 11：配置前端 API 地址
```bash
cd frontend
wrangler pages project update cloudflare-rental-frontend --production-branch=main
wrangler secret put VITE_API_URL
# 输入后端 Workers 的 URL，例如：https://cloudflare-rental-backend.your-subdomain.workers.dev
```

---

## 🚀 后端部署配置（Cloudflare Workers）

### 步骤 1：登录 Cloudflare Dashboard
1. 访问 [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. 登录你的 Cloudflare 账号

### 步骤 2：创建 Workers 项目
1. 点击左侧菜单 **Workers & Pages** → **Create application**
2. 选择 **Workers** 标签
3. 点击 **Deploy with GitHub**

### 步骤 3：连接 GitHub 仓库
1. 授权 Cloudflare 访问你的 GitHub 账号
2. 选择 `cloudflare-rental` 仓库
3. 选择 `backend` 目录作为项目根目录
4. 点击 **Begin setup**

### 步骤 4：配置 Workers 项目
- **Project name**: `cloudflare-rental-backend`
- **Production branch**: `main`
- **Root Directory**: `backend`
- **Build command**: 
  ```bash
  npm install && npm run build
  ```
- **Deploy command**: 
  ```bash
  npx wrangler deploy
  ```

### 步骤 5：配置环境变量
在 **Settings** → **Environment variables** 中添加：

| Variable name | Value | Production | Preview |
|--------------|-------|------------|---------|
| `JWT_SECRET` | 你的强随机密钥 | ✅ | ✅ |
| `ADMIN_PASSWORD` | 管理员密码 | ✅ | ❌ |

### 步骤 6：绑定 D1 数据库
1. 先创建 D1 数据库：
   - 进入 **Workers & Pages** → **D1**
   - 点击 **Create database**
   - 名称：`rental-db`
   - 记录 database ID

2. 在 Workers 项目中绑定：
   - 进入项目 → **Settings** → **Bindings** → **Add** → **D1 Database**
   - 添加绑定：
     - Variable name: `DB`
     - Database: `rental-db`

3. 初始化数据库表：
   ```bash
   npx wrangler d1 execute rental-db --remote --file=backend/src/db/migrations/001_initial.sql
   ```

### 步骤 7：绑定 KV Namespace
1. 创建 KV：
   - 进入 **Workers & Pages** → **KV**
   - 点击 **Create namespace**
   - 名称：`rental-settings`
   - 记录 namespace ID

2. 在 Workers 项目中绑定：
   - 进入项目 → **Settings** → **Bindings** → **Add** → **KV Namespace**
   - 添加绑定：
     - Variable name: `SETTINGS_KV`
     - KV namespace: `rental-settings`

### 步骤 8：绑定 R2 Bucket
1. 创建 R2：
   - 进入 **R2** → **Create bucket**
   - 名称：`rental-uploads`
   - 设置公开访问（可选）

2. 在 Workers 项目中绑定：
   - 进入项目 → **Settings** → **Bindings** → **Add** → **R2 Bucket**
   - 添加绑定：
     - Variable name: `UPLOADS`
     - R2 bucket: `rental-uploads`

### 步骤 9：保存并部署
点击 **Save and Deploy**，Cloudflare 会自动构建并部署后端

---

## 🎨 前端部署配置（Cloudflare Pages）

### 步骤 1：创建新的 Pages 项目
1. 同样在 **Workers & Pages** → **Create application** → **Pages**
2. 选择同一个 GitHub 仓库 `cloudflare-rental`

### 步骤 2：配置前端项目
- **Project name**: `cloudflare-rental-frontend`
- **Production branch**: `main`
- **Framework preset**: `Vite`
- **Build command**: 
  ```bash
  cd frontend && npm install && npm run build
  ```
- **Build output directory**: `frontend/dist`
- **Root Directory**: 留空

### 步骤 3：配置环境变量
在 **Settings** → **Environment variables** 中添加：

| Variable name | Value | Production | Preview |
|--------------|-------|------------|---------|
| `VITE_API_URL` | `https://cloudflare-rental-backend.workers.dev` | ✅ | ✅ |
| `NODE_VERSION` | `20` | ✅ | ✅ |

> ⚠️ **重要**：将 `VITE_API_URL` 替换为你后端项目的实际域名

### 步骤 4：保存并部署
点击 **Save and Deploy**

---

## 🔗 配置自定义域名（可选）

### 方法 1：前后端使用同一域名
1. 进入前端项目 → **Custom domains**
2. 添加你的域名：`yourdomain.com`
3. 进入后端项目 → **Triggers** → **Custom domains**
4. 添加子域名：`api.yourdomain.com`

### 方法 2：更新前端 API 地址
如果使用同一域名不同路径：
- 前端环境变量 `VITE_API_URL` 设置为：`/api`
- 后端配置 rewrite rule 将 `/api/*` 转发到后端

---

## ⚙️ 高级配置

### 配置预览部署（Preview Deployments）
1. 进入项目 → **Settings** → **Builds & deployments**
2. 配置 **Preview deployments** 为所有分支启用
3. 可为预览环境配置独立的环境变量

### 配置自动回滚
1. 进入项目 → **Deployments**
2. 找到之前的成功部署
3. 点击 **⋮** → **Rollback**

### 查看部署日志
1. 进入项目 → **Deployments**
2. 点击任意部署记录查看详细日志
3. 支持实时查看构建过程

---

## 🧪 本地测试部署

### 后端本地测试
```bash
cd backend
npm install
npm run dev
```

### 前端本地测试
```bash
cd frontend
npm install
npm run dev
```

### 使用 Wrangler 模拟生产环境
```bash
# 后端 (Workers)
cd backend
npx wrangler dev

# 前端 (Pages)
cd frontend
npx wrangler pages dev dist
```

---

## 🔐 安全建议

1. **生产环境变量**：
   - 使用强随机的 `JWT_SECRET`（至少 32 字符）
   - 修改默认 `ADMIN_PASSWORD`
   - 不要在代码中硬编码敏感信息

2. **CORS 配置**：
   - 在后端限制允许的源
   - 仅允许你的前端域名访问 API

3. **R2 权限**：
   - 谨慎设置公开访问
   - 对敏感文件使用签名 URL

4. **GitHub 集成**：
   - 保护 `main` 分支，要求 PR 审查
   - 启用分支保护规则

---

## 📊 监控与分析

1. **Analytics**：
   - 进入项目 → **Analytics** 查看访问量、带宽等

2. **Error Tracking**：
   - 查看 **Functions** → **Logs** 排查错误

3. **性能优化**：
   - 启用 **Automatic platform optimization**
   - 配置缓存策略

---

## 🆘 常见问题

### Q: 部署失败怎么办？
A: 检查构建日志，常见问题：
- Node 版本不匹配 → 设置 `NODE_VERSION`
- 依赖安装失败 → 检查 package.json
- 环境变量缺失 → 在 Settings 中补充

### Q: 如何更新部署？
A: 推送代码到 GitHub 后自动触发重新部署

### Q: 可以手动触发部署吗？
A: 可以，进入项目 → **Deployments** → **Create deployment**

### Q: 如何查看生产环境的数据库？
A: 使用 Wrangler CLI：
```bash
npx wrangler d1 execute rental-db --remote
```

---

## 📝 检查清单

- [ ] 代码推送到 GitHub
- [ ] 后端 Workers 项目创建完成
- [ ] 前端 Pages 项目创建完成
- [ ] D1 数据库创建并绑定
- [ ] KV Namespace 创建并绑定
- [ ] R2 Bucket 创建并绑定
- [ ] 环境变量配置完成
- [ ] 自定义域名配置（可选）
- [ ] 测试前后端通信正常
- [ ] 安全配置检查完成

祝你部署顺利！🎉
