# 租车公司管理系统 - QWEN.md

## 项目概述

这是一个完整的租车公司管理解决方案，采用前后端分离架构。

**技术栈：**
- **后端**: Node.js + Express 5 + TypeScript + better-sqlite3
- **前端**: Vue 3 + Vite 8 + TypeScript + Element Plus + Pinia
- **特色功能**: 智能调度系统、主题系统、移动端优先、图片上传/导出

**端口：** 后端默认 3001，前端默认 5173

## 目录结构

```
car/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── controllers/     # 业务控制器（按模块划分）
│   │   ├── db/index.ts      # 数据库初始化、表结构、迁移
│   │   ├── middleware/      # 认证中间件
│   │   ├── routes/index.ts  # API 路由
│   │   ├── utils/helpers.ts # 工具函数
│   │   └── index.ts         # 入口文件
│   ├── uploads/             # 上传文件（按类型分子目录）
│   └── data/                # SQLite 数据库
│
├── frontend/                # 前端应用
│   ├── src/
│   │   ├── api/index.ts     # API 接口封装
│   │   ├── components/      # 通用组件
│   │   ├── layouts/         # 布局组件
│   │   ├── router/index.ts  # 路由配置
│   │   ├── stores/          # Pinia 状态管理
│   │   ├── utils/           # 公共工具
│   │   │   ├── constants.ts # 常量定义
│   │   │   └── helpers.ts   # 工具函数
│   │   ├── views/           # 页面视图
│   │   ├── App.vue          # 根组件
│   │   ├── main.ts          # 入口文件
│   │   └── style.css        # 全局样式
│   └── public/              # 静态资源
│
├── README.md                # 项目文档
├── AGENTS.md                # AI Agent 详细指南
└── QWEN.md                  # 本文件
```

## 核心业务模块

| 模块 | 功能 |
|------|------|
| 用户管理 | 登录认证、角色权限（admin/staff）、用户 CRUD |
| 客户管理 | 客户信息、驾照信息、照片上传、常用客户标记、来源标记 |
| 车辆管理 | 车辆 CRUD、状态管理、新能源标识、行驶证/登记证上传 |
| 订单管理 | 订单 CRUD、状态流转、续租、支付记录、免押选项、里程/照片 |
| 违章管理 | 违章记录、多图上传、处理状态 |
| 黑名单管理 | 黑名单添加/移除、手机号/身份证检查 |
| 保养管理 | 保养记录、里程提醒 |
| 保险管理 | 保险记录、多类型（交强险/商业险/座位险）、图片/PDF上传 |
| 年检证管理 | 年检登记、到期提醒、证书图片 |
| 调度管理 | 从订单自动生成取还车调度安排、图片导出 |
| 操作日志 | 操作记录、用户行为追踪 |
| 系统设置 | 系统标题/Logo、主题色、侧边栏风格 |

## 快速开始

### 环境要求
- Node.js 18+
- npm

### 安装依赖

```bash
# 后端
cd backend && npm install

# 前端
cd frontend && npm install
```

### 启动服务

```bash
# 后端开发（热重载）
cd backend && npm run dev

# 前端开发
cd frontend && npm run dev
```

### 构建

```bash
# 后端构建
cd backend && npm run build

# 前端构建
cd frontend && npm run build

# 前端预览
cd frontend && npm run preview
```

### 默认账号
- 用户名：`admin`
- 密码：`admin123`
- JWT Token 有效期：1 年

## 开发约定

### 后端约定

1. **数据库操作** - 使用 better-sqlite3 同步 API：
   ```typescript
   import { getDatabase } from './db/index.js';
   const db = getDatabase();
   
   // 查询多行
   const rows = db.prepare("SELECT * FROM users").all();
   
   // 查询单行
   const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
   
   // 执行 INSERT/UPDATE/DELETE
   const info = db.prepare("INSERT INTO ...").run(params);
   
   // DDL 语句
   db.exec("ALTER TABLE users ADD COLUMN phone TEXT");
   ```

2. **操作日志记录**：
   ```typescript
   import { logAction } from '../utils/helpers.js';
   logAction(req.user?.id || '', '创建订单', 'order', orderId, `创建订单 ${orderNo}`, req.ip);
   ```

3. **认证中间件**：
   ```typescript
   router.get('/users', authMiddleware, adminOnly, usersController.getUsers);
   ```

4. **响应格式**：统一返回 `{ success: boolean, data?: any, message?: string }`

5. **数据库迁移**：在 `db/index.ts` 的 `runMigrations()` 中添加新字段/表

6. **文件上传**：使用 Multer，按类型分目录存储
   - 接口：`POST /api/upload/:type`
   - 类型：`inspection`, `insurance`, `violation`, `maintenance`, `vehicle`, `customer`, `other`

### 前端约定

1. **API 调用**：使用 `src/api/index.ts` 中封装的 API 对象

2. **公共常量**：使用 `src/utils/constants.ts` 中的常量
   ```typescript
   import { PAYMENT_METHOD_OPTIONS } from '../utils/constants';
   ```

3. **工具函数**：使用 `src/utils/helpers.ts` 中的函数
   ```typescript
   import { getImageUrl, formatDateTime } from '../utils/helpers';
   ```

4. **移动端适配**：使用 CSS 媒体查询 `@media (min-width: 768px)`

5. **主题系统**：使用 CSS 变量实现动态主题
   - 核心变量：`--primary-color`, `--primary-color-light`, `--primary-color-dark`

6. **图片导出**：使用 `html2canvas` 库

## 业务规则

### 订单状态流转
```
pending (待取车) → active (已取车) → completed (已还车)
                 ↘ cancelled (已取消)
```

### 支付方式
| 值 | 显示文本 |
|------|----------|
| platform | 平台支付 |
| wechat | 微信 |
| alipay | 支付宝 |
| cash | 现金 |
| bank | 银行转账 |
| other | 其他 |

### 支付类型
| 值 | 显示文本 |
|------|----------|
| rent | 租金 |
| deposit | 押金 |
| rent_deposit | 租金 + 押金 |
| violation_deposit | 违章押金 |
| damage | 车损 |
| other | 其他 |

### 调度数据生成规则
- **送车**：从待取车 (pending) 订单中提取取车时间和位置
- **收车**：从已取车 (active) 订单中提取还车时间和位置
- **时间范围**：只显示当前时间及以后的调度
- **排序**：按时间升序排列

## 数据库表结构

### 主要数据表

| 表名 | 描述 |
|------|------|
| users | 用户表（username, password, role, phone, email） |
| customers | 客户表（含 is_regular, source_id, 图片字段） |
| vehicles | 车辆表（含 is_new_energy, vin, engine_number, 图片字段） |
| orders | 订单表（含来源、服务类型、免押、里程、照片字段） |
| violations | 违章记录表 |
| blacklist | 黑名单表 |
| order_sources | 订单来源表（含佣金比例、颜色） |
| maintenance | 保养记录表 |
| insurance | 保险记录表 |
| inspections | 年检证表 |
| operation_logs | 操作日志表 |
| system_settings | 系统设置表 |

## 注意事项

1. **数据库持久化**：better-sqlite3 自动持久化，数据写入即时保存
2. **跨域**：后端已配置 CORS，支持局域网访问
3. **文件大小限制**：上传文件限制 10MB
4. **移动端优先**：UI 设计时优先考虑移动端体验
5. **环境要求**：better-sqlite3 需要编译原生模块，推荐在 Docker/标准 Linux 环境运行
6. **无测试**：项目当前没有测试框架，不需要运行测试

## 常见开发任务

### 添加新的数据库字段
1. 在 `backend/src/db/index.ts` 的 `runMigrations()` 中添加 ALTER TABLE
2. 在对应的控制器中更新 SQL 语句
3. 更新前端表单和显示

### 添加新的上传类型
1. 在 `backend/src/index.ts` 中添加新的 uploader 和路由
2. 在 `frontend/src/api/index.ts` 的 `uploadApi` 中添加方法
3. 确保 `uploads/` 目录下有对应子目录

### 添加新的操作日志
1. 在控制器中导入 `logAction`
2. 在关键操作成功后调用 `logAction(userId, action, entityType, entityId, details, ipAddress)`

### 添加新的选项常量
1. 在 `frontend/src/utils/constants.ts` 中添加选项数组和文本映射
2. 在需要使用的组件中导入并使用

## 相关文档

- **README.md** - 项目概述和更新日志
- **AGENTS.md** - AI Agent 详细开发指南（包含完整的 API 接口、代码示例、开发规范）
