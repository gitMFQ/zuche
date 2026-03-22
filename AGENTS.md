# 租车公司管理系统 - AI Agent 上下文指南

本文档为 AI 助手（如 iFlow CLI）提供项目上下文，帮助理解代码库结构和开发约定。

## 项目概述

这是一个完整的租车公司管理解决方案，采用前后端分离架构：
- **后端**: Node.js + Express + TypeScript，使用 sql.js（内存 SQLite）存储数据
- **前端**: Vue 3 + Vite + TypeScript + Element Plus + Pinia

### 核心业务模块

| 模块 | 功能描述 |
|------|----------|
| 用户管理 | 登录认证、角色权限（admin/staff）、用户 CRUD |
| 客户管理 | 客户信息、驾照信息、身份证/驾照照片上传、常用客户标记、来源标记 |
| 车辆管理 | 车辆 CRUD、状态管理（可用/已出租/维修中）、新能源标识、行驶证/登记证上传 |
| 订单管理 | 租车订单、状态流转、续租、支付记录、订单来源佣金计算、免押选项、取还车里程/照片 |
| 违章管理 | 违章记录、多图上传、处理状态 |
| 黑名单管理 | 黑名单添加/移除、手机号/身份证检查 |
| 保养管理 | 保养记录、多类型支持、里程提醒 |
| 保险管理 | 保险记录、多类型（交强险/商业险/座位险）、图片/PDF上传 |
| 年检证管理 | 年检登记、到期提醒、证书图片 |
| 系统设置 | 系统标题/Logo配置、主题色设置、侧边栏风格设置 |

## 目录结构

```
car/
├── backend/
│   ├── src/
│   │   ├── controllers/    # 业务控制器（按模块划分）
│   │   ├── db/index.ts     # 数据库初始化、表结构、迁移
│   │   ├── middleware/     # 认证中间件
│   │   ├── routes/index.ts # API 路由定义
│   │   ├── utils/helpers.ts# 工具函数（query、execute、分页等）
│   │   └── index.ts        # 入口文件、上传路由
│   ├── uploads/            # 上传文件存储（按类型分子目录）
│   │   ├── customer/       # 客户证件照片
│   │   ├── vehicle/        # 车辆证件照片
│   │   ├── inspection/     # 年检证图片
│   │   ├── insurance/      # 保险单据
│   │   ├── maintenance/    # 保养单据
│   │   ├── violation/      # 违章照片
│   │   └── other/          # 其他文件（如系统Logo）
│   └── data/               # SQLite 数据库文件
│
└── frontend/
    ├── src/
    │   ├── api/index.ts    # API 接口封装
    │   ├── components/     # Tab 组件（车辆、保养、保险等）
    │   ├── layouts/        # 主布局（侧边栏导航、主题系统）
    │   ├── router/index.ts # 路由配置
    │   ├── stores/user.ts  # Pinia 用户状态
    │   ├── style.css       # 全局样式、CSS 变量、主题覆盖
    │   └── views/          # 页面视图
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
```

## 技术约定

### 后端约定

1. **数据库操作**: 使用 `utils/helpers.ts` 中的辅助函数
   ```typescript
   import { query, queryOne, execute, queryWithPagination, generateId, now } from '../utils/helpers.js';
   ```

2. **认证**: 所有 API 需要 `authMiddleware`，管理员操作需要 `adminOnly`
   ```typescript
   router.get('/users', authMiddleware, adminOnly, usersController.getUsers);
   ```

3. **响应格式**: 统一返回 `{ success: boolean, data?: any, message?: string }`

4. **数据库迁移**: 在 `db/index.ts` 的 `runMigrations()` 中添加新字段/表

5. **文件上传**: 使用 Multer，按类型分目录存储
   - 接口格式: `POST /api/upload/:type`
   - 类型: `inspection`, `insurance`, `violation`, `maintenance`, `vehicle`, `customer`, `other`

### 前端约定

1. **API 调用**: 使用 `src/api/index.ts` 中封装的 API 对象
   ```typescript
   import { orderApi, vehicleApi, uploadApi } from '../api';
   const res = await orderApi.getList({ page: 1, pageSize: 10 });
   ```

2. **路由守卫**: 已配置 token 检查，未登录自动跳转 `/login`

3. **移动端适配**: 使用 CSS 媒体查询 `@media (min-width: 768px)`
   - 移动端显示卡片列表
   - PC 端显示表格

4. **时间选择器**: 移动端优先使用原生 `datetime-local` 输入框

5. **图片上传**: 使用 `uploadApi.uploadXxx(file)` 方法
   ```typescript
   const res = await uploadApi.uploadCustomer(file);
   if (res.success && res.data) {
     form.images.push(res.data.url);
   }
   ```

6. **主题系统**: 使用 CSS 变量实现动态主题
   - 核心变量: `--primary-color`, `--primary-color-light`, `--primary-color-dark`, `--primary-color-rgb`
   - 在 `style.css` 中定义默认值，通过 JS 动态更新
   - Element Plus 组件主题覆盖在 `style.css` 中定义

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

## 主题系统

### 主题色设置
- 6 个预设主题色：靛蓝、蓝色、绿色、红色、橙色、灰色
- 支持调色盘自定义任意颜色
- 主题色通过 CSS 变量全局应用

### 侧边栏风格
- 6 个预设风格：深邃蓝紫、暗黑、深蓝、墨绿、暗紫、棕色
- 支持自定义渐变（起始色 + 结束色两个调色盘）
- 风格通过动态 CSS 类和内联样式实现

### 系统设置存储
- 主题设置保存在 `system_settings` 表中
- 设置项：`theme_color`, `sidebar_style`, `custom_sidebar_color_start`, `custom_sidebar_color_end`
- 通过自定义事件通知布局组件更新

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

### 添加新的主题色相关样式
1. 在 `frontend/src/style.css` 中添加使用 CSS 变量的样式
2. 确保 Element Plus 组件覆盖样式正确
3. 测试主题切换后的效果

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

## 注意事项

1. **数据库持久化**: sql.js 使用内存数据库，修改后需调用 `saveDatabase()`
2. **跨域**: 后端已配置 CORS，支持局域网访问
3. **文件大小限制**: 上传文件限制 10MB
4. **移动端优先**: UI 设计时优先考虑移动端体验
5. **响应式设计**: 使用 Element Plus 的栅格系统配合媒体查询
6. **主题一致性**: 新增组件样式应使用 CSS 变量以支持主题切换
7. **代码提交规范**: 每次修改代码后，必须更新 `README.md` 的更新日志部分，然后进行 `git commit` 提交更改