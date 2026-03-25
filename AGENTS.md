# 租车公司管理系统 - AI Agent 上下文指南

本文档为 AI 助手（如 iFlow CLI）提供项目上下文，帮助理解代码库结构和开发约定。

## 项目概述

这是一个完整的租车公司管理解决方案，采用前后端分离架构：
- **后端**: Node.js + Express 5 + TypeScript，使用 better-sqlite3（原生 SQLite 绑定）存储数据
- **前端**: Vue 3 + Vite 8 + TypeScript + Element Plus + Pinia
- **特色功能**: 智能调度系统（从订单自动生成取还车安排）、主题系统、移动端优先

### 核心业务模块

| 模块 | 功能描述 |
|------|----------|
| 用户管理 | 登录认证、角色权限（admin/staff）、用户 CRUD |
| 客户管理 | 客户信息、驾照信息、身份证/驾照照片上传、常用客户标记、来源标记 |
| 车辆管理 | 车辆 CRUD、状态管理（可用/已出租/维修中）、新能源标识、行驶证/登记证上传 |
| 订单管理 | 租车订单、状态流转、续租、支付记录、订单来源佣金计算、免押选项、取还车里程/照片/地点 |
| 违章管理 | 违章记录、多图上传、处理状态 |
| 黑名单管理 | 黑名单添加/移除、手机号/身份证检查 |
| 保养管理 | 保养记录、多类型支持、里程提醒 |
| 保险管理 | 保险记录、多类型（交强险/商业险/座位险）、图片/PDF上传 |
| 年检证管理 | 年检登记、到期提醒、证书图片 |
| **调度管理** | **从订单自动生成取还车调度安排，按时间实时显示，支持完整视图和图片导出** |
| 操作日志 | 操作记录、用户行为追踪、筛选查询（管理员可见） |
| 系统设置 | 系统标题/Logo配置、主题色设置、侧边栏风格设置 |

## 目录结构

```
car/
├── backend/
│   ├── src/
│   │   ├── controllers/    # 业务控制器（按模块划分）
│   │   │   ├── auth.ts     # 认证控制器
│   │   │   ├── users.ts    # 用户管理控制器
│   │   │   ├── customers.ts # 客户管理控制器
│   │   │   ├── vehicles.ts # 车辆管理控制器
│   │   │   ├── orders.ts   # 订单管理控制器
│   │   │   ├── violations.ts # 违章管理控制器
│   │   │   ├── blacklist.ts # 黑名单管理控制器
│   │   │   ├── orderSources.ts # 订单来源管理控制器
│   │   │   ├── maintenance.ts # 保养管理控制器
│   │   │   ├── insurance.ts # 保险管理控制器
│   │   │   ├── inspection.ts # 年检证管理控制器
│   │   │   ├── schedules.ts # 调度管理控制器
│   │   │   ├── dashboard.ts # 仪表盘统计控制器
│   │   │   ├── settings.ts # 系统设置控制器
│   │   │   └── logs.ts     # 操作日志控制器
│   │   ├── db/index.ts     # 数据库初始化、表结构、迁移
│   │   ├── middleware/     # 认证中间件
│   │   │   └── auth.ts     # JWT 认证中间件
│   │   ├── routes/index.ts # API 路由定义
│   │   ├── utils/helpers.ts# 工具函数（query、execute、logAction等）
│   │   └── index.ts        # 入口文件、上传路由
│   ├── uploads/            # 上传文件存储（按类型分子目录）
│   │   ├── customer/       # 客户证件照片
│   │   ├── vehicle/        # 车辆证件照片
│   │   ├── inspection/     # 年检证图片
│   │   ├── insurance/      # 保险单据
│   │   ├── maintenance/    # 保养单据
│   │   ├── violation/      # 违章照片
│   │   └── other/          # 其他文件（如系统Logo）
│   └── data/               # SQLite 数据库文件（rental.db）
│
└── frontend/
    ├── src/
    │   ├── api/index.ts    # API 接口封装
    │   ├── components/     # Tab 组件（车辆、保养、保险等）
    │   ├── layouts/        # 主布局（侧边栏导航、主题系统）
    │   ├── router/index.ts # 路由配置
    │   ├── stores/user.ts  # Pinia 用户状态
    │   ├── style.css       # 全局样式、CSS 变量、主题覆盖
    │   ├── utils/          # 公共工具模块
    │   │   ├── constants.ts# 常量定义（选项列表、文本映射）
    │   │   └── helpers.ts  # 工具函数（日期格式化、图片URL等）
    │   └── views/          # 页面视图
    │       ├── Login.vue   # 登录页面
    │       ├── Dashboard.vue # 仪表盘（含调度表格）
    │       ├── Customers.vue # 客户管理页面
    │       ├── Vehicles.vue # 车辆管理页面
    │       ├── Orders.vue  # 订单管理页面
    │       ├── OrderDetail.vue # 订单详情页面
    │       ├── Violations.vue # 违章管理页面
    │       ├── Blacklist.vue # 黑名单管理页面
    │       ├── OrderSources.vue # 订单来源管理页面
    │       ├── Settings.vue # 系统设置页面
    │       ├── Users.vue   # 用户管理页面
    │       └── Logs.vue    # 操作日志页面
    └── public/             # 静态资源
```

## 开发命令

```bash
# 后端开发（热重载）
cd backend && npm run dev

# 前端开发
cd frontend && npm run dev

# 后端生产运行
cd backend && npm run start

# 前端构建
cd frontend && npm run build

# 前端预览构建结果
cd frontend && npm run preview
```

## 技术约定

### 后端约定

1. **数据库操作**: 使用 `utils/helpers.ts` 中的辅助函数
   ```typescript
   import { query, queryOne, execute, queryWithPagination, generateId, now, logAction } from '../utils/helpers.js';
   ```

2. **操作日志记录**: 在关键操作后调用 `logAction` 函数
   ```typescript
   // 函数签名
   logAction(userId, action, entityType?, entityId?, details?, ipAddress?)
   
   // 使用示例
   logAction(req.user?.id || '', '创建订单', 'order', orderId, `创建订单 ${orderNo}，客户：${customerName}`, req.ip);
   ```

3. **认证**: 所有 API 需要 `authMiddleware`，管理员操作需要 `adminOnly`
   ```typescript
   router.get('/users', authMiddleware, adminOnly, usersController.getUsers);
   ```

4. **响应格式**: 统一返回 `{ success: boolean, data?: any, message?: string }`

5. **数据库迁移**: 在 `db/index.ts` 的 `runMigrations()` 中添加新字段/表

6. **文件上传**: 使用 Multer，按类型分目录存储
   - 接口格式: `POST /api/upload/:type`
   - 类型: `inspection`, `insurance`, `violation`, `maintenance`, `vehicle`, `customer`, `other`

### 前端约定

1. **API 调用**: 使用 `src/api/index.ts` 中封装的 API 对象
   ```typescript
   import { orderApi, vehicleApi, uploadApi, logApi, scheduleApi } from '../api';
   const res = await orderApi.getList({ page: 1, pageSize: 10 });
   ```

2. **公共常量**: 使用 `src/utils/constants.ts` 中的常量
   ```typescript
   import { PAYMENT_METHOD_OPTIONS, PAYMENT_TYPE_OPTIONS, SERVICE_TYPE_OPTIONS } from '../utils/constants';
   // 模板中使用
   <el-option v-for="item in PAYMENT_METHOD_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
   ```

3. **工具函数**: 使用 `src/utils/helpers.ts` 中的函数
   ```typescript
   import { getImageUrl, formatDateTime, getPaymentMethodText, getPaymentTypeText } from '../utils/helpers';
   ```

4. **路由守卫**: 已配置 token 检查，未登录自动跳转 `/login`

5. **移动端适配**: 使用 CSS 媒体查询 `@media (min-width: 768px)`
   - 移动端显示卡片列表
   - PC 端显示表格

6. **时间选择器**: 移动端优先使用原生 `datetime-local` 输入框

7. **图片上传**: 使用 `uploadApi.uploadXxx(file)` 方法
   ```typescript
   const res = await uploadApi.uploadCustomer(file);
   if (res.success && res.data) {
     form.images.push(res.data.url);
   }
   ```

8. **主题系统**: 使用 CSS 变量实现动态主题
   - 核心变量: `--primary-color`, `--primary-color-light`, `--primary-color-dark`, `--primary-color-rgb`
   - 在 `style.css` 中定义默认值，通过 JS 动态更新
   - Element Plus 组件主题覆盖在 `style.css` 中定义

9. **图片导出**: 使用 `html2canvas` 库将 DOM 元素转换为图片下载
   ```typescript
   import html2canvas from 'html2canvas';
   const canvas = await html2canvas(element, { scale: 2 });
   // canvas.toDataURL() 生成图片数据
   ```

## 业务规则

### 订单状态流转
```
pending (待取车) → active (已取车) → completed (已还车)
                 ↘ cancelled (已取消)
```

### 订单天数计算
- 按小时精确计算，向上取整天数（最少1天）
- 示例：10:00取车 → 次日09:00还车 = 1天

### 佣金计算
- 订单来源可设置佣金比例
- 到账金额 = 总金额 × (100% - 佣金比例)

### 保养里程提醒
- 当前里程 >= 下次保养里程 - 1000km → "待保养"
- 当前里程 >= 下次保养里程 → "已超期"

### 车牌样式
- 新能源车：绿底白字（显示 `is_new_energy` 标识）
- 非新能源：蓝底白字

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
| rent_deposit | 租金+押金 |
| violation_deposit | 违章押金 |
| damage | 车损 |
| other | 其他 |

### 支付记录添加权限
- 待取车(pending)、待还车(active)、已完成(completed) 状态的订单均可添加支付记录

### 调度数据生成规则
- **送车**：从待取车(pending)订单中提取，显示取车时间和取车位置
- **收车**：从已取车(active)订单中提取，显示还车时间和还车位置
- **时间范围**：显示当前时间及以后的调度安排，过去的不显示
- **状态判断**：
  - 待取车订单：只显示 `status='pending'` 且 `start_date >= 当前时间` 的送车条目
  - 已取车订单：只显示 `status='active'` 且 `end_date >= 当前时间` 的收车条目
  - 当取车时间已过但还车时间未到时，如果订单状态已变为 active，则只显示还车条目
- **排序**：按时间升序排列
- **数据来源**：直接从订单表查询，不单独存储
- **只读功能**：调度表格为只读展示，不支持手动添加/编辑/删除

### 调度表格样式规则
- **移动端**：
  - 表格宽度 100%，无内边距
  - 平台列：3个汉字宽，超出滑动显示
  - 位置列：5个汉字宽，超出滑动显示
  - 字体 13px，内边距 8px 6px
- **PC端**：
  - 表格宽度 90%，居中显示
  - 容器最大宽度 800px
  - 无列宽限制
  - 字体 14px，内边距 10px 12px
- **完整视图**：
  - 无列宽限制
  - 使用稍大的字体和内边距（14px, 12px）
  - 支持点击行跳转到订单详情

## 操作日志

### 记录的操作类型

| 模块 | 记录的操作 |
|------|-----------|
| 认证 | 登录 |
| 用户 | 创建、更新、删除 |
| 客户 | 创建、更新、删除 |
| 车辆 | 创建、更新、删除 |
| 订单 | 创建、取车、还车、取消、续租、添加支付 |
| 违章 | 创建、处理、删除 |
| 黑名单 | 添加、移除 |
| 订单来源 | 创建、更新、删除 |

### 日志记录规范

在添加新的操作日志时，遵循以下规范：
- `userId`: 操作用户ID（从 `req.user?.id` 获取）
- `action`: 操作类型（中文，如"创建订单"、"取车"）
- `entityType`: 实体类型（user/customer/vehicle/order/violation/blacklist/order_source）
- `entityId`: 实体ID
- `details`: 详细描述（包含关键信息，如订单号、客户姓名等）
- `ipAddress`: 客户端IP（从 `req.ip` 获取）

## 主题系统

### 主题色设置
- 6 个预设主题色：靛蓝、蓝色、绿色、红色、橙色、灰色
- 支持调色盘自定义任意颜色
- 主题色通过 CSS 变量全局应用

### 侧边栏风格
- 6 个预设风格：深邃蓝紫、暗黑、深蓝、墨绿、暗紫、棕色
- 支持自定义渐变（起始色 + 结束色两个调色盘）
- 风格通过动态 CSS 类和内联样式实现

### 主题设置存储
- **主题设置**保存在用户本地 `localStorage` 中，每个用户可以有自己的主题偏好
- 设置项：`theme_color`, `sidebar_style`, `custom_sidebar_color_start`, `custom_sidebar_color_end`
- 通过 `userStore.themeSettings` 管理，自动同步到 localStorage
- 主题设置即时生效，无需点击保存按钮
- **系统标题和 Logo** 保存在 `system_settings` 表中，影响所有用户
- 通过自定义事件通知布局组件更新

## 数据库技术

### better-sqlite3 特点
- **原生绑定**: C++ 原生模块，性能优于 WebAssembly 方案
- **同步 API**: 所有数据库操作为同步调用，代码更简洁
- **自动持久化**: 数据自动写入磁盘，无需手动保存
- **WAL 模式**: 启用 Write-Ahead Logging 提高并发性能

### 运行环境要求
- better-sqlite3 需要编译原生模块
- 推荐在 Docker 容器或标准 Linux 环境中运行
- Android Termux 环境需要 Android NDK 支持

### 数据库初始化
```typescript
import { initDatabase, getDatabase } from './db/index.js';

// 初始化数据库（同步，无需 await）
initDatabase();

// 获取数据库实例
const db = getDatabase();
```

### better-sqlite3 API 用法

**重要**: better-sqlite3 与 sql.js 或 node-sqlite3 的 API 不同，必须使用以下模式：

```typescript
const db = getDatabase();

// 执行查询（返回所有行）
const rows = db.prepare("SELECT * FROM users WHERE status = ?").all(1);

// 查询单行
const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

// 执行 INSERT/UPDATE/DELETE
const stmt = db.prepare("INSERT INTO users (id, name) VALUES (?, ?)");
const info = stmt.run(id, name);
console.log(info.changes, info.lastInsertRowid);

// DDL 语句（CREATE/ALTER TABLE）
db.exec("CREATE TABLE IF NOT EXISTS ...");
db.exec("ALTER TABLE users ADD COLUMN phone TEXT");
```

**常见错误**:
- ❌ `db.run(sql, params)` - 不存在此方法
- ❌ `db.exec(sql, params)` - exec 不支持参数
- ❌ `await initDatabase()` - 这是同步函数，不需要 await
- ✅ `db.prepare(sql).run(...params)` - 正确用法
- ✅ `db.prepare(sql).all(...params)` - 正确用法
- ✅ `db.prepare(sql).get(...params)` - 正确用法

## 默认账号

- 用户名: `admin`
- 密码: `admin123`
- JWT Token 有效期: 1 年

## 常见开发任务

### 添加新的数据库字段
1. 在 `backend/src/db/index.ts` 的 `runMigrations()` 中添加 ALTER TABLE
2. 在对应的控制器中更新 SQL 语句
3. 更新前端表单和显示

### 添加新的上传类型
1. 在 `backend/src/index.ts` 中添加新的 uploader 和路由
2. 在 `frontend/src/api/index.ts` 的 `uploadApi` 中添加方法
3. 确保 `uploads/` 目录下有对应子目录

### 添加新的页面/模块
1. 后端: 在 `controllers/` 创建控制器，在 `routes/index.ts` 注册路由
2. 前端: 在 `views/` 创建页面，在 `router/index.ts` 添加路由
3. 在 `layouts/MainLayout.vue` 侧边栏添加菜单项

### 添加新的操作日志
1. 在控制器中导入 `logAction`
2. 在关键操作成功后调用 `logAction(userId, action, entityType, entityId, details, ipAddress)`
3. 更新 `controllers/logs.ts` 中的 `ACTION_MAP` 和 `ENTITY_TYPE_MAP`（如需要）

### 添加新的主题色相关样式
1. 在 `frontend/src/style.css` 中添加使用 CSS 变量的样式
2. 确保 Element Plus 组件覆盖样式正确
3. 测试主题切换后的效果

### 添加新的选项常量
1. 在 `frontend/src/utils/constants.ts` 中添加选项数组和文本映射
2. 在需要使用的组件中导入并使用
3. 示例：添加新的支付方式只需修改 `PAYMENT_METHOD_OPTIONS` 和 `PAYMENT_METHOD_TEXT_MAP`

### 添加仪表盘统计模块
1. 后端: 在 `controllers/dashboard.ts` 的 `getDashboardStats` 函数中添加数据查询
2. 前端: 在 `views/Dashboard.vue` 中添加对应的展示组件
3. 更新 stats 接口类型定义（如使用 TypeScript）

### 添加图片导出功能
1. 安装依赖：`npm install html2canvas`
2. 在组件中动态导入：`const html2canvas = (await import('html2canvas')).default`
3. 使用 html2canvas 捕获 DOM 元素并转换为图片
4. 创建临时链接下载图片

## 数据库表结构要点

### 用户表 (users)
- 基本信息：username, password, name, role, phone, email
- 角色类型：admin（管理员）, staff（员工）

### 客户表 (customers)
- 新增字段：is_regular（常用客户）, source_id, source_name（来源标记）
- 图片字段：id_card_images, license_images（JSON 数组）

### 车辆表 (vehicles)
- 新增字段：vin（车架号）, engine_number（发动机号）, is_new_energy（新能源标识）
- 图片字段：license_image（行驶证）, registration_image（登记证）

### 订单表 (orders)
- 来源字段：source_id, source_name, commission_rate, net_amount
- 服务字段：service_type（基础/优享/尊享）
- 免押字段：deposit_waived, deposit_waived_expiry
- 里程字段：pickup_mileage, return_mileage
- 照片字段：pickup_image, return_image
- 合同字段：contract_number
- 地址字段：pickup_location, return_location
- 时间字段：start_date, end_date, actual_end_date, created_at, updated_at
- 其他字段：remarks（备注）

### 操作日志表 (operation_logs)
- 主键：id
- 用户信息：user_id（关联 users 表）
- 操作信息：action（操作类型）、entity_type（实体类型）、entity_id（实体ID）
- 详情：details（操作详情）、ip_address（客户端IP）
- 时间：created_at

### 订单来源表 (order_sources)
- 主键：id
- 名称：name
- 佣金比例：commission_rate（百分比）
- 颜色：color（用于前端显示标签颜色）
- 状态：status（1: 启用, 0: 禁用）

### 系统设置表 (system_settings)
- 主键：key
- 值：value（JSON 字符串）
- 更新时间：updated_at

## 代码复用规范

### 公共常量文件 (`utils/constants.ts`)
集中管理选项列表和文本映射，避免在多个组件中重复定义：
- `PAYMENT_METHOD_OPTIONS` - 支付方式选项
- `PAYMENT_TYPE_OPTIONS` - 支付类型选项
- `SERVICE_TYPE_OPTIONS` - 服务类型选项
- `ORDER_STATUS_TYPE_MAP` - 订单状态标签颜色映射
- `PAYMENT_METHOD_TEXT_MAP` - 支付方式文本映射
- `PAYMENT_TYPE_TEXT_MAP` - 支付类型文本映射

### 公共工具函数 (`utils/helpers.ts`)
集中管理通用工具函数：
- `getImageUrl(url)` - 获取图片完整URL
- `formatDateTime(dateStr)` - 格式化日期时间 (MM-DD HH:mm)
- `formatFullDateTime(dateStr)` - 格式化完整日期时间
- `formatDateTimeLocal(dateStr)` - 格式化为 datetime-local 输入格式
- `getOrderStatusType(status)` - 获取订单状态标签类型
- `getPaymentMethodText(method)` - 获取支付方式文本
- `getPaymentTypeText(type)` - 获取支付类型文本
- `getServiceLabel(type)` - 获取服务类型文本
- `getServiceTagType(type)` - 获取服务类型标签颜色
- `isExpired(date)` - 检查是否过期
- `isExpiringSoon(date, days)` - 检查是否即将到期

## API 接口说明

### 调度相关接口

#### 获取最近调度安排
```
GET /api/schedules/recent
```
- 描述：获取当前时间及以后的取还车调度安排
- 认证：需要登录
- 返回数据：
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "订单ID",
        "schedule_time": "2026-03-25 10:00:00",
        "type": "送",
        "plate_number": "宁A173GV",
        "platform": "携程",
        "platform_color": "#0056b3",
        "location": "银川汽车站",
        "order_no": "订单号"
      }
    ]
  }
  ```
- 数据来源：
  - 送车：从 status='pending' 且 start_date >= 当前时间 的订单中查询取车时间和取车位置
  - 收车：从 status='active' 且 end_date >= 当前时间 的订单中查询还车时间和还车位置
- 排序：按 schedule_time 升序
- 特性：取车时间已过但还车时间未到时，只显示还车条目

### 仪表盘相关接口

#### 获取统计数据
```
GET /api/dashboard/stats
```
- 描述：获取仪表盘各项统计数据
- 认证：需要登录
- 返回数据：
  ```json
  {
    "success": true,
    "data": {
      "vehicles": { "total": 10, "available": 7, "rented": 3 },
      "orders": { "total": 50, "active": 3 },
      "customerCount": 25,
      "monthIncome": 15000,
      "recentOrders": [...],
      "expiringOrders": [...]
    }
  }
  ```

## 注意事项

1. **数据库持久化**: better-sqlite3 自动持久化，数据写入即时保存，无需调用 saveDatabase
2. **跨域**: 后端已配置 CORS，支持局域网访问
3. **文件大小限制**: 上传文件限制 10MB
4. **移动端优先**: UI 设计时优先考虑移动端体验
5. **响应式设计**: 使用 Element Plus 的栅格系统配合媒体查询
6. **主题一致性**: 新增组件样式应使用 CSS 变量以支持主题切换
7. **操作日志**: 新增关键操作时应添加日志记录
8. **代码复用**: 新增选项列表时优先添加到 `utils/constants.ts`，新工具函数添加到 `utils/helpers.ts`
9. **代码提交规范**: 每次修改代码后，必须更新 `README.md` 的更新日志部分，然后进行 `git commit` 提交更改
10. **调度功能**: 调度数据从订单自动生成，不需要手动添加，修改订单会自动更新调度显示
11. **图片导出**: 使用 html2canvas 库实现调度表格导出为图片功能，需要在前端安装该依赖