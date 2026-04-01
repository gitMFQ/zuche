# 租车公司管理系统

一个功能完整的租车公司管理解决方案，支持车辆调度、订单管理、客户管理、财务统计等核心业务功能。

## 技术栈

### 后端
- **Runtime**: Node.js 18+
- **Framework**: Express 5
- **Language**: TypeScript
- **Database**: SQLite (better-sqlite3)
- **Auth**: JWT (1年有效期)

### 前端
- **Framework**: Vue 3 + Vite
- **Language**: TypeScript
- **UI Library**: Element Plus
- **State Management**: Pinia

## 项目结构

```
car/
├── backend/                      # 后端服务
│   ├── src/
│   │   ├── controllers/          # 业务控制器
│   │   │   ├── auth.ts           # 认证
│   │   │   ├── users.ts          # 用户管理
│   │   │   ├── customers.ts      # 客户管理
│   │   │   ├── vehicles.ts       # 车辆管理
│   │   │   ├── orders.ts         # 订单管理
│   │   │   ├── orderSources.ts   # 订单来源
│   │   │   ├── violations.ts     # 违章管理
│   │   │   ├── maintenance.ts    # 保养管理
│   │   │   ├── insurance.ts      # 保险管理
│   │   │   ├── inspection.ts     # 年检证管理
│   │   │   ├── dashboard.ts      # 仪表盘统计
│   │   │   ├── schedules.ts       # 调度管理
│   │   │   ├── settings.ts       # 系统设置
│   │   │   ├── logs.ts           # 操作日志
│   │   │   └── blacklist.ts      # 黑名单
│   │   ├── db/                   # 数据库
│   │   │   └── index.ts          # better-sqlite3 配置与迁移
│   │   ├── middleware/           # 中间件
│   │   ├── routes/               # 路由
│   │   ├── utils/                # 工具函数
│   │   └── index.ts              # 入口文件
│   ├── uploads/                  # 上传文件目录
│   └── data/                     # SQLite 数据库文件
│
└── frontend/                     # 前端应用
    ├── src/
    │   ├── api/                  # API 接口封装
    │   ├── components/            # 公共组件
    │   │   ├── VehiclesTab.vue       # 车辆管理 Tab
    │   │   ├── MaintenanceTab.vue    # 保养管理 Tab
    │   │   ├── InsuranceTab.vue      # 保险管理 Tab
    │   │   ├── InspectionTab.vue     # 年检证 Tab
    │   │   ├── ViolationsTab.vue     # 违章管理 Tab
    │   │   └── VehicleDetailDialog.vue  # 车辆详情弹窗
    │   ├── layouts/              # 布局组件
    │   ├── router/               # 路由配置
    │   ├── stores/               # Pinia 状态管理
    │   ├── utils/                # 工具函数
    │   │   ├── constants.ts      # 公共常量
    │   │   └── helpers.ts        # 辅助函数
    │   └── views/                # 页面视图
    │       ├── Login.vue         # 登录页
    │       ├── Dashboard.vue      # 仪表盘
    │       ├── Users.vue          # 用户管理
    │       ├── Customers.vue      # 客户管理
    │       ├── Vehicles.vue       # 车辆管理入口
    │       ├── Orders.vue         # 订单管理
    │       ├── OrderDetail.vue    # 订单详情
    │       ├── Blacklist.vue      # 黑名单
    │       ├── OrderSources.vue   # 订单来源
    │       ├── Violations.vue     # 违章管理
    │       ├── Settings.vue       # 系统设置
    │       └── Logs.vue           # 操作日志
    └── public/                   # 静态资源
```

## 功能模块

### 1. 仪表盘
- 统计卡片：今日取车、今日还车、待处理订单、可用车辆
- 车辆状态分布饼图
- 近30天订单趋势图
- 调度甘特图：可视化车辆占用时间
- 取还车调度表：自动从订单生成送车/收车任务

### 2. 订单管理
- 订单状态分类：待取车、待还车、已完成、已取消
- 创建订单：选择客户、车辆、服务类型（基础/优享/尊享）
- 免押功能：支持免押选项，自动计算免押到期日
- 取还车操作：记录取还车时间、地点、里程、照片
- 订单延期：支持延长租期
- 支付记录：支持多种支付方式和支付类型（租金、车损、违章等）
- 合同号管理

### 3. 客户管理
- 客户信息管理：姓名、电话、身份证、驾照
- 常用客户标记
- 客户来源标记（门店直租、美团、携程、滴滴等）
- 图片上传：身份证照片、驾照照片
- 快速查看客户订单

### 4. 车辆管理
- 车辆 CRUD：车牌、品牌、型号、颜色、年份、座位数
- 新能源车标识
- 车辆图片：行驶证、登记证书
- 车架号(VIN)、发动机号
- 车辆详情弹窗：快速查看车辆完整信息

### 5. 违章管理
- 违章记录登记
- 罚款金额、扣分记录
- 图片上传
- 处理状态跟踪
- 押金处理

### 6. 保养管理
- 按车辆查看保养记录
- 保养类型：常规保养、大保养、小修
- 里程提醒：自动计算下次保养时间
- 保养成本统计

### 7. 保险管理
- 按车辆查看保险记录
- 保险类型：交强险、商业险、座位险（多选）
- 保险到期提醒
- 保费统计

### 8. 年检证管理
- 车辆年检状态列表
- 年检证图片上传
- 到期提醒

### 9. 订单来源管理
- 来源渠道管理：门店直租、美团、携程、滴滴、其他
- 佣金比例设置
- 平台颜色标记

### 10. 黑名单管理
- 客户黑名单添加/移除
- 黑名单原因记录
- 客户状态自动检查

### 11. 用户管理
- 用户 CRUD（管理员）
- 角色权限：admin / staff
- 密码修改

### 12. 系统设置
- 主题色设置：6个预设 + 自定义调色盘
- 侧边栏风格：6个预设渐变 + 自定义双色渐变
- Logo 上传
- 系统标题设置

### 13. 操作日志
- 记录用户关键操作
- 操作类型、详情、时间

## 快速开始

### 环境要求
- Node.js 18+
- npm / pnpm

### 安装依赖

```bash
# 后端
cd backend && npm install

# 前端
cd frontend && npm install
```

### 启动服务

```bash
# 终端1：启动后端（开发模式，热重载）
cd backend && npm run dev

# 终端2：启动前端
cd frontend && npm run dev
```

访问 http://localhost:5173

### 默认账号
- 用户名：`admin`
- 密码：`admin123`

## 数据表结构

| 表名 | 说明 |
|------|------|
| users | 用户表 |
| customers | 客户表 |
| vehicles | 车辆表 |
| orders | 订单表 |
| payments | 支付记录表 |
| order_sources | 订单来源表 |
| violations | 违章记录表 |
| blacklist | 黑名单表 |
| maintenance | 保养记录表 |
| insurance | 保险记录表 |
| inspections | 年检证表 |
| system_settings | 系统设置表 |
| operation_logs | 操作日志表 |

## API 接口概览

### 认证
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户
- `PUT /api/auth/password` - 修改密码

### 用户管理
- `GET/POST /api/users` - 列表/创建
- `PUT/DELETE /api/users/:id` - 更新/删除

### 客户管理
- `GET/POST /api/customers` - 列表/创建
- `PUT/DELETE /api/customers/:id` - 更新/删除
- `PUT /api/customers/:id/regular` - 设置常用客户

### 车辆管理
- `GET/POST /api/vehicles` - 列表/创建
- `GET /api/vehicles/available` - 可用车辆
- `PUT/DELETE /api/vehicles/:id` - 更新/删除

### 订单管理
- `GET/POST /api/orders` - 列表/创建
- `GET /api/orders/:id` - 订单详情
- `PUT /api/orders/:id` - 更新订单
- `PUT /api/orders/:id/pickup` - 取车
- `PUT /api/orders/:id/return` - 还车
- `PUT /api/orders/:id/extend` - 延期
- `PUT /api/orders/:id/cancel` - 取消
- `POST /api/orders/:id/payments` - 添加支付

### 调度管理
- `GET /api/schedules` - 调度列表
- `GET /api/schedules/gantt` - 甘特图数据

### 违章管理
- `GET/POST /api/violations` - 列表/创建
- `PUT/DELETE /api/violations/:id` - 更新/删除

### 黑名单
- `GET/POST /api/blacklist` - 列表/添加
- `DELETE /api/blacklist/:id` - 移除

### 订单来源
- `GET/POST /api/order-sources` - 列表/创建
- `PUT/DELETE /api/order-sources/:id` - 更新/删除

### 保养管理
- `GET/POST /api/maintenance` - 列表/创建
- `PUT/DELETE /api/maintenance/:id` - 更新/删除

### 保险管理
- `GET/POST /api/insurance` - 列表/创建
- `PUT/DELETE /api/insurance/:id` - 更新/删除

### 年检证
- `GET /api/inspections` - 车辆年检状态列表
- `GET /api/inspections/stats` - 统计
- `PUT /api/inspections/:vehicle_id` - 登记/更新
- `DELETE /api/inspections/:vehicle_id` - 删除

### 系统设置
- `GET/PUT /api/settings` - 获取/更新设置

### 操作日志
- `GET /api/logs` - 日志列表

### 文件上传
- `POST /api/upload/:type` - 上传文件（type: vehicle|customer|inspection|insurance|maintenance|violation|other）

---

## 更新日志

### 2026-04-01

#### 移动端体验优化
- 所有移动端日期/时间输入框改用原生选择器
- 提升移动端操作友好性，无需加载第三方组件
- 兼容暗色模式

#### 仪表盘调度功能优化
- 优化待收送表格显示逻辑
- 送车任务：所有未完成订单中取车时间在未来的都显示
- 收车任务：所有未完成订单中还车时间在未来的都显示
- 不论订单是否已取车，根据日期自动显示待办任务

### 2026-03-29

#### 车辆详情弹窗组件
- 新增 `VehicleDetailDialog.vue` 组件
- 显示车牌号、品牌、型号、颜色、年份、座位数、里程等完整信息
- 支持新能源车标识、行驶证/登记证书图片预览

#### 甘特图数据增强
- 甘特图数据返回完整车辆信息
- 支持查看详细订单信息

#### 订单管理界面优化
- Orders.vue 和 OrderDetail.vue 大幅重构

#### 仪表盘功能增强
- Dashboard.vue 界面优化，甘特图功能增强

### 2026-03-25

#### 调度管理功能
- 从订单自动生成取还车调度安排
- 支持导出为图片下载
- 平台颜色使用订单来源中设置的颜色

### 2026-03-23

#### 支付功能增强
- 支付方式新增"平台支付"
- 支付类型新增"车损"
- 已还车订单也可添加支付记录

#### 代码复用优化
- 新增 `utils/constants.ts` 和 `utils/helpers.ts`
- 减少重复代码约 100+ 行

### 2026-03-22

#### 数据库迁移
- sql.js 替换为 better-sqlite3
- 自动持久化，启用 WAL 模式

#### 系统主题设置
- 主题色、侧边栏风格自定义
- Logo 上传功能

### 2026-03-21

#### 新能源车标识
- 车辆支持新能源标记
- 车牌样式：新能源绿底白字，非新能源蓝底白字

#### 服务类型
- 订单支持服务类型：基础/优享/尊享

#### 免押功能
- 订单支持免押选项
- 自动计算免押到期日期

#### 取还车增强
- 取车/还车支持里程记录
- 取车/还车支持照片上传
