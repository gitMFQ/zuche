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

### 2026-03-21

#### 侧边栏菜单顺序调整
- **修改文件**:
  - `frontend/src/layouts/MainLayout.vue`
- **变更内容**:
  - 客户管理移到订单管理下面

#### 服务类型标签简化
- **修改文件**:
  - `frontend/src/views/Orders.vue`
  - `frontend/src/views/OrderDetail.vue`
- **变更内容**:
  - 服务类型标签从"基础服务/优享服务/尊享服务"简化为"基础/优享/尊享"
  - 优化移动端显示效果

#### 订单合同号功能
- **修改文件**:
  - `backend/src/db/index.ts`
  - `backend/src/controllers/orders.ts`
  - `frontend/src/views/Orders.vue`
  - `frontend/src/views/OrderDetail.vue`
- **变更内容**:
  - 订单表新增 `contract_number` 字段（合同号，非必填）
  - 新建/编辑订单时可填写合同号
  - 订单详情页显示合同号

#### 新能源车标识和车牌样式
- **修改文件**:
  - `backend/src/db/index.ts`
  - `backend/src/controllers/vehicles.ts`
  - `backend/src/controllers/orders.ts`
  - `backend/src/controllers/inspection.ts`
  - `backend/src/controllers/dashboard.ts`
  - `frontend/src/style.css`
  - `frontend/src/components/VehiclesTab.vue`
  - `frontend/src/components/MaintenanceTab.vue`
  - `frontend/src/components/InsuranceTab.vue`
  - `frontend/src/components/ViolationsTab.vue`
  - `frontend/src/components/InspectionTab.vue`
  - `frontend/src/views/Orders.vue`
  - `frontend/src/views/OrderDetail.vue`
  - `frontend/src/views/Dashboard.vue`
- **变更内容**:
  - 车辆表新增 is_new_energy 字段（是否新能源车）
  - 车辆表单添加"新能源"开关选项
  - 所有显示车牌号的地方添加车牌样式：新能源绿底白字，非新能源蓝底白字
  - 涵盖模块：车辆管理、订单、保养、保险、违章、年检证、首页仪表盘

#### 订单管理标签页分类显示
- **修改文件**:
  - `frontend/src/views/Orders.vue`
- **变更内容**:
  - 订单列表改为标签页形式，按状态分类显示
  - 四个标签页：待取车、待还车、已完成、已取消
  - 待取车和待还车标签页显示数量角标
  - 移除原来的状态下拉选择器

#### 登录有效期延长
- **修改文件**:
  - `backend/src/middleware/auth.ts`
- **变更内容**:
  - JWT token 有效期从 7 天改为 1 年

#### 取车还车里程和照片上传
- **修改文件**:
  - `backend/src/db/index.ts`
  - `backend/src/controllers/orders.ts`
  - `frontend/src/api/index.ts`
  - `frontend/src/views/Orders.vue`
  - `frontend/src/views/OrderDetail.vue`
- **变更内容**:
  - 取车时可输入取车里程（非必填）
  - 取车时可上传取车照片（非必填）
  - 还车时可输入还车里程（非必填）
  - 还车时可上传还车照片（非必填）
  - 订单详情页显示取车/还车里程和照片
  - 还车时自动更新车辆里程
  - 订单表新增 `pickup_mileage`、`return_mileage`、`pickup_image`、`return_image` 字段

#### 订单列表快捷操作
- **修改文件**:
  - `frontend/src/views/Orders.vue`
- **变更内容**:
  - 订单列表添加快捷操作按钮
  - 待取车订单：编辑、取车、取消
  - 已取车订单：编辑、还车、续租、取消
  - 移动端和PC端均支持

#### 订单详情和编辑功能完善
- **修改文件**:
  - `backend/src/controllers/orders.ts`
  - `frontend/src/views/OrderDetail.vue`
- **变更内容**:
  - 订单详情页面显示服务类型标签
  - 订单详情页面显示押金/免押状态和免押到期日期
  - 订单编辑支持总租金输入
  - 订单编辑支持服务类型选择
  - 订单编辑支持免押选项

#### 订单免押功能
- **修改文件**:
  - `backend/src/db/index.ts`
  - `backend/src/controllers/orders.ts`
  - `frontend/src/views/Orders.vue`
- **变更内容**:
  - 新建订单支持免押选项
  - 选免押后押金字段隐藏
  - 免押到期日期默认为还车后30天
  - 订单表新增 `deposit_waived` 和 `deposit_waived_expiry` 字段

#### 订单租金和服务类型优化
- **修改文件**:
  - `backend/src/db/index.ts`
  - `backend/src/controllers/orders.ts`
  - `frontend/src/views/Orders.vue`
- **变更内容**:
  - 日租金改为非必填
  - 新增总租金输入框，可直接填写总租金
  - 新增服务类型单选：基础服务、优享服务、尊享服务
  - 订单表新增 `service_type` 字段

#### 常用客户功能
- **修改文件**:
  - `backend/src/db/index.ts`
  - `backend/src/controllers/customers.ts`
  - `backend/src/routes/index.ts`
  - `frontend/src/api/index.ts`
  - `frontend/src/views/Customers.vue`
  - `frontend/src/views/Orders.vue`
- **变更内容**:
  - 客户表新增 `is_regular` 字段（常用客户标记）
  - 客户管理页面支持设置/取消常用客户
  - 常用客户显示星标图标
  - 新建订单时可直接选择常用客户，自动填充客户信息

### 2026-03-20

#### 局域网访问支持
- **修改文件**:
  - `backend/src/index.ts`
  - `frontend/.env`
- **变更内容**:
  - 后端监听 `0.0.0.0` 支持局域网设备访问
  - 前端 `.env` 配置 `VITE_API_URL` 局域网地址

#### 保险管理重构为车辆列表视图
- **修改文件**:
  - `frontend/src/components/InsuranceTab.vue`
- **变更内容**:
  - 主视图改为显示所有车辆列表，带保险状态摘要
  - 点击车辆进入该车辆的保险记录列表
  - 可为每辆车添加/编辑/删除保险记录

#### 保养管理重构为车辆列表视图
- **修改文件**:
  - `frontend/src/components/MaintenanceTab.vue`
- **变更内容**:
  - 主视图改为显示所有车辆列表，带保养状态摘要
  - 点击车辆进入该车辆的保养记录列表
  - 最近保养和下次保养显示里程信息
  - 里程优先显示（如 `5000km 2026-03-20`）

#### PC端侧边栏按钮优化
- **修改文件**:
  - `frontend/src/layouts/MainLayout.vue`
- **变更内容**:
  - 展开收缩按钮改为 Element Plus 圆形按钮
  - 增大按钮尺寸和点击区域

#### 车辆管理功能增强
- **修改文件**:
  - `backend/src/db/index.ts`
  - `backend/src/controllers/vehicles.ts`
  - `backend/src/index.ts`
  - `frontend/src/components/VehiclesTab.vue`
  - `frontend/src/api/index.ts`
- **变更内容**:
  - 日租金改为非必填
  - 新增字段：车架号(VIN)、发动机号
  - 新增图片上传：行驶证、登记证书
  - 新增上传接口 `/api/upload/vehicle`

#### 保险类型改为复选框
- **修改文件**:
  - `backend/src/controllers/insurance.ts`
  - `frontend/src/components/InsuranceTab.vue`
- **变更内容**:
  - 保险类型改为复选框，选项：交强险、商业险、座位险
  - 支持选择多个保险类型
  - 数据库存储为 JSON 数组

#### 保险统计优化
- **修改文件**:
  - `backend/src/controllers/insurance.ts`
  - `frontend/src/components/InsuranceTab.vue`
- **变更内容**:
  - 已过期只统计最新保险已过期的车辆数量
  - 生效中也只统计最新保险生效中的车辆

#### 保养里程提醒
- **修改文件**:
  - `backend/src/controllers/maintenance.ts`
  - `frontend/src/components/MaintenanceTab.vue`
- **变更内容**:
  - 当前里程 >= 下次保养里程 - 1000km 时提示"待保养"
  - 当前里程 >= 下次保养里程 时显示"已超期"
  - 后端统计待保养数量包含里程接近的车辆
