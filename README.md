# 租车公司管理系统

一个完整的租车公司管理解决方案，包含车辆管理、订单管理、客户管理、年检证管理等功能。

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite (better-sqlite3)
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

### 2026-03-25

#### 调度管理功能
- **新增文件**:
  - `backend/src/controllers/schedules.ts` - 调度控制器
- **修改文件**:
  - `backend/src/routes/index.ts` - 添加调度路由
  - `frontend/src/api/index.ts` - 添加调度 API
  - `frontend/src/views/Dashboard.vue` - 添加调度表格
  - `frontend/package.json` - 添加 html2canvas 依赖
  - `AGENTS.md` - 更新项目文档
- **变更内容**:
  - 仪表盘新增调度表格，从订单自动生成取还车调度安排
  - 送车：从待取车(pending)订单提取取车时间和取车位置
  - 收车：从已取车(active)订单提取还车时间和还车位置
  - 按实时时间往下排，过去时间的调度不显示
  - 取车时间已过但还车时间未到时，只显示还车条目
  - 支持完整视图弹窗，点击行跳转到订单详情
  - 支持导出为图片下载（使用 html2canvas）
  - 平台颜色使用订单来源中设置的颜色
  - 移动端表格列宽限制：平台3字、位置5字，超出滑动显示
  - PC端表格宽度90%居中，容器最大宽度800px
  - 表格样式：浅橙色表头，隔行变色，边框显示

#### 订单详情页面完善
- **修改文件**:
  - `frontend/src/views/OrderDetail.vue`
- **变更内容**:
  - 订单详情新增显示：取车地点、还车地点、备注、创建时间、更新时间
  - 订单编辑表单新增：取车地点、还车地点

### 2026-03-23

#### 支付功能增强
- **修改文件**:
  - `frontend/src/views/Orders.vue`
  - `frontend/src/views/OrderDetail.vue`
- **变更内容**:
  - 支付方式新增"平台支付"选项
  - 支付类型新增"车损"选项
  - 已还车(completed)状态的订单也可以添加支付记录
  - 订单列表页添加支付按钮，支持快捷添加支付记录

#### 代码复用优化
- **新增文件**:
  - `frontend/src/utils/constants.ts` - 公共常量定义
  - `frontend/src/utils/helpers.ts` - 公共工具函数
- **修改文件**:
  - `frontend/src/views/Orders.vue`
  - `frontend/src/views/OrderDetail.vue`
  - `AGENTS.md`
- **变更内容**:
  - 创建公共常量文件，集中管理支付方式、支付类型、服务类型等选项列表
  - 创建公共工具函数文件，统一管理 getImageUrl、formatDateTime、getPaymentMethodText 等函数
  - 重构 Orders.vue 和 OrderDetail.vue，使用公共模块替代重复代码
  - 减少约 100+ 行重复代码，提高代码可维护性

#### 更新项目文档
- **修改文件**:
  - `AGENTS.md`
- **变更内容**:
  - 更新目录结构，添加 utils/ 目录说明
  - 新增代码复用规范章节
  - 添加支付方式和支付类型表格说明
  - 新增"添加新的选项常量"开发任务指南

### 2026-03-22

#### 数据库迁移到 better-sqlite3
- **修改文件**:
  - `backend/src/db/index.ts`
  - `backend/src/utils/helpers.ts`
  - `backend/src/controllers/settings.ts`
  - `backend/src/index.ts`
  - `backend/package.json`
  - `README.md`（技术栈描述）
  - `AGENTS.md`
- **变更内容**:
  - 将 sql.js (WebAssembly) 替换为 better-sqlite3 (原生绑定)
  - 数据库自动持久化，无需手动调用 saveDatabase()
  - 启用 WAL 模式提高并发性能
  - 同步 API，代码更简洁
  - 注意：better-sqlite3 需要在 Docker/标准 Linux 环境运行

#### 主题设置保存到用户本地存储
- **修改文件**:
  - `frontend/src/stores/user.ts`
  - `frontend/src/views/Settings.vue`
  - `frontend/src/layouts/MainLayout.vue`
- **变更内容**:
  - 主题设置（主题色、侧边栏风格、自定义渐变）保存到用户本地 localStorage
  - 每个用户可以有自己的主题偏好
  - 主题设置即时生效，无需点击保存按钮
  - 系统标题和 Logo 仍然是全局设置，影响所有用户

#### 系统主题设置功能
- **修改文件**:
  - `frontend/src/views/Settings.vue`
  - `frontend/src/layouts/MainLayout.vue`
  - `frontend/src/style.css`
  - `frontend/src/components/VehiclesTab.vue`
  - `frontend/src/components/MaintenanceTab.vue`
  - `frontend/src/components/InsuranceTab.vue`
  - `frontend/src/components/InspectionTab.vue`
  - `frontend/src/components/ViolationsTab.vue`
  - `AGENTS.md`
- **变更内容**:
  - 系统设置新增主题色设置（6个预设 + 调色盘自定义）
  - 系统设置新增侧边栏风格设置（6个预设渐变 + 自定义双色渐变）
  - 系统设置新增 Logo 上传功能
  - 侧边栏美化：渐变背景、现代菜单样式、用户卡片
  - 全局 CSS 变量实现主题色动态切换
  - Element Plus 组件主题色覆盖
  - 所有 Tab 组件应用主题色

### 2026-03-21

#### 客户来源标记功能
- **修改文件**:
  - `backend/src/db/index.ts`
  - `backend/src/controllers/customers.ts`
  - `frontend/src/views/Customers.vue`
- **变更内容**:
  - 客户表新增 source_id 和 source_name 字段
  - 客户创建/编辑时可选择客户来源
  - 客户列表和详情显示来源标签（带颜色）

#### 客户管理添加查订单功能
- **修改文件**:
  - `frontend/src/views/Customers.vue`
  - `frontend/src/views/Orders.vue`
- **变更内容**:
  - 客户列表添加"订单"按钮，点击跳转到订单页面查看该客户的订单
  - 订单页面支持通过 URL 参数 customer_id 筛选客户订单

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
