# AGENTS.md - 租车公司管理系统

## 技术栈
- 后端: Node.js + Express 5 + TypeScript + better-sqlite3 + zod
- 前端: Vue 3 + Vite + TypeScript + Element Plus + Pinia
- 端口: 后端 3001, 前端 5173

## 启动命令
```bash
# 后端
cd backend && npm run dev    # 开发模式 (tsx watch)
cd backend && npm run build # 编译 TypeScript

# 前端
cd frontend && npm run dev   # 开发服务器
cd frontend && npm run build # 构建 (含类型检查)

# 类型检查
cd backend && npx tsc --noEmit
cd frontend && npx vue-tsc --noEmit
```

**无测试框架或 lint 工具，类型检查是唯一的验证方式。**

## 数据库 (better-sqlite3)
**必须使用辅助函数，绝不直接调用 db.prepare/run/exec：**
```typescript
import { query, queryOne, execute } from '../utils/helpers.js';
const rows = query("SELECT * FROM users WHERE status = ?", [1]);
const user = queryOne("SELECT * FROM users WHERE id = ?", [userId]);
execute("INSERT INTO users (id, name) VALUES (?, ?)", [id, name]);
```
分页: `queryWithPagination()` → `{ data, total, page, pageSize, totalPages }`
迁移: 在 `backend/src/db/index.ts` 的 `runMigrations()` 中添加 `ALTER TABLE`

## API 约定
- 所有响应格式: `{ success: boolean, data?: any, message?: string }`
- JWT 有效期 1 年，存储在 `localStorage.token`
- 认证中间件: `authMiddleware`，用户信息: `req.user?.id`, `req.user?.role`
- 管理员权限: `adminOnly` 中间件

## 文件上传
- 端点: `/api/upload` (通用) 或 `/api/upload/{inspection|insurance|violation|maintenance|vehicle|customer}`
- 保险端点支持 PDF，其他仅支持图片
- 文件大小限制: 10MB
- 返回: `{ success: true, data: { url: string } }`

## 代码规范
- 后端: `.js` 扩展名导入本地模块，函数返回 `void`，try-catch 包裹所有控制器
- 前端: Composition API + `<script setup>`，Pinia 状态管理
- 命名: 文件 kebab-case，函数 camelCase，数据库 snake_case

## 默认账号
用户名: `admin` / 密码: `admin123`

## 绝对禁止
- 类型抑制 (`as any`, `@ts-ignore`)
- 空 catch 块
- SQL 字符串拼接
- 跳过类型检查提交
- 日志中记录敏感信息 (密码、token)
