# 租车管理系统 - Cloudflare Workers 后端

这是将原有 Express + SQLite 后端迁移到 Cloudflare Workers 平台的版本。

## 架构变化

### 原架构
- **Runtime**: Node.js + Express
- **Database**: better-sqlite3 (本地文件)
- **File Storage**: 本地文件系统
- **Auth**: JWT + bcryptjs

### 新架构 (Cloudflare)
- **Runtime**: Cloudflare Workers (Edge)
- **Database**: D1 (SQLite on Edge)
- **File Storage**: R2 (对象存储)
- **Auth**: JWT (原生 crypto API) + bcryptjs

## 部署步骤

### 1. 安装依赖

```bash
cd cloudflare-backend
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 创建 D1 数据库

```bash
npx wrangler d1 create rental-db
```

记录返回的 `database_id`，填入 `wrangler.toml`。

### 4. 初始化数据库

```bash
npx wrangler d1 execute rental-db --file=src/db/schema.sql
```

### 5. 创建 R2 Bucket

```bash
npx wrangler r2 bucket create rental-uploads
```

### 6. 更新 wrangler.toml

将 D1 database_id 和 R2 bucket 名称填入配置文件。

### 7. 设置环境变量

```bash
npx wrangler secret put JWT_SECRET
```

输入一个强密码作为 JWT 密钥。

### 8. 部署

```bash
npm run deploy
```

### 9. 本地开发

```bash
npm run dev
```

## 前端配置

需要修改前端的 API 地址指向 Cloudflare Workers URL：

```typescript
// frontend/src/api/index.ts
const api = axios.create({
  baseURL: 'https://rental-admin-backend.your-subdomain.workers.dev/api',
  timeout: 10000
})
```

或者使用环境变量：

```bash
VITE_API_URL=https://rental-admin-backend.your-subdomain.workers.dev/api
```

## 注意事项

1. **D1 限制**: 
   - 每次写入最多 1MB
   - 每秒最多 100 次写入
   - 适合读多写少的场景

2. **R2 限制**:
   - 免费额度：每月 10GB 存储，1000 万次读取，100 万次写入
   - 上传文件大小限制 5TB

3. **Workers 限制**:
   - CPU 时间：每次请求最多 10ms (免费版) / 50ms (付费版)
   - 内存：128MB

4. **不兼容的功能**:
   - 不支持 WebSocket
   - 不支持 TCP/UDP 连接
   - 不支持本地文件系统

## 迁移清单

- [x] 数据库 Schema 迁移
- [x] JWT 认证迁移
- [x] 文件上传迁移 (R2)
- [x] 用户管理 API
- [x] 客户管理 API
- [x] 车辆管理 API
- [x] 订单管理 API (含支付、续租、取消)
- [x] 违章管理 API
- [x] 保养管理 API
- [x] 保险管理 API
- [x] 年检证管理 API
- [x] 黑名单管理 API
- [x] 订单来源管理 API
- [x] 仪表盘统计 API
- [x] 调度管理 API
- [x] 系统设置 API
- [x] 操作日志 API

## 成本估算

对于小型租车公司（日活 < 100）：
- Workers: 免费版 (每天 10 万次请求)
- D1: 免费版 (每天 500 万行读取)
- R2: 免费版 (10GB 存储)

预计月成本：**$0** (在免费额度内)

## 优势

1. **零运维**: 无需管理服务器
2. **全球加速**: Edge 网络自动 CDN
3. **自动扩展**: 按需分配资源
4. **成本效益**: 按使用量付费，低流量时几乎免费
5. **高可用**: 多区域冗余

## 后续优化建议

1. 添加缓存层 (KV Namespace)
2. 实现图片压缩和缩略图
3. 添加 API 限流
4. 实现批量操作优化
5. 添加监控和告警
