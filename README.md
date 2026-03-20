# 租车公司管理系统

一个完整的租车公司管理解决方案，包含车辆管理、订单管理、客户管理、年检证管理等功能。

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite (sql.js)
- JWT 认证

### 前端
- Vue 3 + Vite
- TypeScript
- Element Plus
- Pinia

## 项目结构

```
car/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── controllers/     # 控制器
│   │   ├── db/              # 数据库配置
│   │   ├── middleware/      # 中间件
│   │   ├── routes/          # 路由
│   │   ├── utils/           # 工具函数
│   │   └── index.ts         # 入口文件
│   ├── uploads/             # 上传文件目录
│   └── data/                # SQLite 数据库文件
│
└── frontend/                # 前端应用
    ├── src/
    │   ├── api/             # API 接口
    │   ├── components/      # 组件
    │   ├── layouts/         # 布局
    │   ├── router/          # 路由
    │   ├── stores/          # 状态管理
    │   ├── utils/           # 工具函数
    │   └── views/           # 页面视图
    └── public/              # 静态资源
```

## 功能模块

### 1. 用户管理
- 用户登录/登出
- 密码修改
- 用户 CRUD（管理员）
- 角色权限控制（admin/staff）

### 2. 客户管理
- 客户信息 CRUD
- 驾照信息管理
- 客户搜索

### 3. 车辆管理
- 车辆 CRUD
- 车辆状态管理（可用/已出租/维修中）
- 车辆品牌统计

### 4. 订单管理
- 租车订单 CRUD
- 订单状态流转
- 订单延期
- 支付记录

### 5. 违章管理
- 违章记录 CRUD
- 违章状态处理
- 违章统计

### 6. 黑名单管理
- 黑名单添加/移除
- 客户黑名单检查

### 7. 订单来源管理
- 来源渠道管理
- 佣金比例设置

### 8. 保养管理
- 保养记录 CRUD
- 保养统计

### 9. 保险管理
- 保险记录 CRUD
- 保险到期提醒

### 10. 年检证管理
- 车辆年检状态列表
- 年检证登记/编辑
- 年检证图片上传
- 到期提醒

## 快速开始

### 环境要求
- Node.js 18+
- npm 或 pnpm

### 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd frontend
npm install
```

### 启动服务

```bash
# 启动后端（开发模式，支持热重载）
cd backend
npm run dev

# 启动前端
cd frontend
npm run dev
```

### 默认账号
- 用户名：`admin`
- 密码：`admin123`

## API 接口

### 认证
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户
- `PUT /api/auth/password` - 修改密码

### 用户管理
- `GET /api/users` - 用户列表
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

### 车辆管理
- `GET /api/vehicles` - 车辆列表
- `GET /api/vehicles/available` - 可用车辆
- `POST /api/vehicles` - 创建车辆
- `PUT /api/vehicles/:id` - 更新车辆
- `DELETE /api/vehicles/:id` - 删除车辆

### 年检证管理
- `GET /api/inspections` - 车辆年检状态列表
- `GET /api/inspections/stats` - 年检统计
- `PUT /api/inspections/:vehicle_id` - 登记/更新年检证
- `DELETE /api/inspections/:vehicle_id` - 删除年检证

### 文件上传
- `POST /api/upload` - 上传图片

---

## 更新日志

> **给 iFlow CLI 的提示：每次修改代码后，请在此处添加更新记录，并进行 git commit。**

### 2026-03-20

#### 年检证管理重构
- **修改文件**: 
  - `backend/src/controllers/inspection.ts`
  - `backend/src/routes/index.ts`
  - `frontend/src/components/InspectionTab.vue`
  - `frontend/src/api/index.ts`
- **变更内容**:
  - 重构年检证列表为车辆列表视图，显示每辆车的年检证状态
  - 每辆车只保留一条年检证记录（自动判断新增或更新）
  - 新增"未登记"状态统计
  - 优化图片上传错误提示

#### 图片上传功能修复
- **修改文件**:
  - `backend/src/index.ts`
  - `frontend/src/api/index.ts`
  - `frontend/src/components/InspectionTab.vue`
- **变更内容**:
  - 修复上传 URL 构造错误
  - 添加 multer 错误处理，返回友好的错误提示
  - 添加前端文件大小校验（10MB）
