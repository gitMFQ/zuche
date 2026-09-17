# 前端环境变量配置说明

## 问题原因
405 错误是因为前端在 Cloudflare Pages 部署时，API 请求使用了相对路径 `/api`，导致请求被发送到前端 Pages 地址而不是后端 Workers 地址。

## 解决方案

### 1. 已修改的文件
- `src/api/index.ts`: 将 axios 的 baseURL 从硬编码的 `/api` 改为使用环境变量 `import.meta.env.VITE_API_URL || '/api'`

### 2. 环境变量文件
已创建以下环境变量文件：

#### `.env.development` (本地开发)
```
VITE_API_URL=http://localhost:8787/api
```
本地运行 `npm run dev` 时使用，指向本地 Wrangler 开发的后端服务。

#### `.env.production` (生产环境)
```
VITE_API_URL=https://cloudflare-rental-backend.your-subdomain.workers.dev/api
```
构建生产版本时使用，**需要将 `your-subdomain` 替换为你实际的后端 Workers 子域名**。

#### `.env` (默认配置)
作为默认配置，优先级最低。

### 3. 部署前必须做的配置

#### 方法一：修改 .env.production 文件（推荐用于 GitHub 自动部署）
1. 获取你的后端 Workers URL（部署后端后 wrangler 会输出）
   - 格式类似：`https://cloudflare-rental-backend.xxx.workers.dev`
2. 编辑 `.env.production` 文件，将 URL 替换为你的实际地址
3. 提交代码到 GitHub，触发自动重新部署

#### 方法二：在 Cloudflare Pages 面板配置（推荐）
1. 登录 Cloudflare Dashboard
2. 进入你的 Frontend Pages 项目
3. 点击 **Settings** → **Environment variables**
4. 添加生产环境变量：
   - Variable name: `VITE_API_URL`
   - Value: `https://你的后端 workers 地址/api`
   - Environment: `production`
5. 点击 **Save**，然后重新部署

### 4. 本地开发流程
```bash
cd frontend
npm install
npm run dev  # 使用 .env.development，连接到 localhost:8787
```

### 5. 生产部署流程
```bash
cd frontend
npm install
npm run build  # 使用 .env.production，打包时嵌入正确的 API 地址
npx wrangler pages deploy dist
```

或者使用 GitHub 自动部署（推荐）：
1. 在 Cloudflare Pages 连接 GitHub 仓库
2. 配置构建设置：
   - Build command: `npm run build`
   - Build output directory: `dist`
3. 设置环境变量（见方法二）
4. 推送代码到 GitHub 自动触发部署

## 注意事项
- Vite 的环境变量在构建时被编译进代码，所以必须在构建前配置好
- Cloudflare Pages 的环境变量只在构建时生效，运行时无法更改
- 如果部署后仍然报 405，请检查：
  1. 环境变量是否正确配置
  2. 后端 Workers 是否正常部署并运行
  3. 后端 Workers 的 URL 是否正确
