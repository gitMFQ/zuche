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

# 后端生产运行
cd backend && npm run start

# 前端构建
cd frontend && npm run build

# 前端预览
cd frontend && npm run preview
```

### 默认账号
- 用户名：`admin`
- 密码：`admin123`
- JWT Token 有效期：1 年

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
| 保险管理 | 保险记录、多类型、图片/PDF 上传 |
| 年检证管理 | 年检登记、到期提醒、证书图片 |
| 调度管理 | 从订单自动生成取还车调度安排、图片导出 |
| 操作日志 | 操作记录、用户行为追踪 |
| 系统设置 | 系统标题/Logo、主题色、侧边栏风格 |

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

## 样式风格（Apple 设计系统）

本项目采用 Apple 风格设计系统，强调极简、产品聚焦和电影化节奏。

### 核心原则
- **产品即主角**：界面退居幕后，产品是唯一焦点
- **极简主义**：每个像素都服务于内容，界面近乎隐形
- **电影化节奏**：通过黑白交替的色块创造沉浸式浏览体验

### 色彩系统

#### 主色调
| 名称 | 色值 | 用途 |
|------|------|------|
| Pure Black | `#000000` | 深色背景、沉浸式展示 |
| Light Gray | `#f5f5f7` | 浅色背景、信息区域 |
| Near Black | `#1d1d1f` | 浅色背景上的主文本 |

#### 交互色
| 名称 | 色值 | 用途 |
|------|------|------|
| Apple Blue | `#0071e3` | **唯一强调色**，仅用于可交互元素 |
| Link Blue (浅) | `#0066cc` | 浅色背景上的链接 |
| Link Blue (深) | `#2997ff` | 深色背景上的链接 |

#### 文本色
| 色值 | 用途 |
|------|------|
| `#ffffff` | 深色背景上的文本 |
| `#1d1d1f` | 浅色背景上的主文本 |
| `rgba(0, 0, 0, 0.8)` | 次要文本 |
| `rgba(0, 0, 0, 0.48)` | 三级文本、禁用状态 |

#### 深色表面
| 色值 | 用途 |
|------|------|
| `#272729` - `#2a2a2d` | 深色卡片背景（5 级微妙变化） |

#### 阴影
| 色值 | 用途 |
|------|------|
| `rgba(0, 0, 0, 0.22) 3px 5px 30px 0px` | 产品卡片柔和阴影 |

### 字体规则

**字体系列：**
- Display（≥20px）：`SF Pro Display, Helvetica Neue, Helvetica, Arial, sans-serif`
- Text（<20px）：`SF Pro Text, Helvetica Neue, Helvetica, Arial, sans-serif`

**字号层级：**
| 角色 | 字号 | 字重 | 行高 | 字间距 | 用途 |
|------|------|------|------|--------|------|
| 大标题 | 56px (3.50rem) | 600 | 1.07 | -0.28px | 产品发布 headline |
| 章节标题 | 40px (2.50rem) | 600 | 1.10 | normal | 功能区块标题 |
| 卡片标题 | 28px (1.75rem) | 400 | 1.14 | 0.196px | 产品卡片标题 |
| 正文 | 17px (1.06rem) | 400 | 1.47 | -0.374px | 标准阅读文本 |
| 强调正文 | 17px (1.06rem) | 600 | 1.24 | -0.374px | 标签、强调文本 |
| 链接 | 14px (0.88rem) | 400 | 1.43 | -0.224px | "了解更多" 链接 |
| 说明 | 14px (0.88rem) | 400 | 1.29 | -0.224px | 次要描述文本 |
| 微小 | 12px (0.75rem) | 400 | 1.33 | -0.12px | 脚注、法律文本 |

**排版原则：**
- 全尺寸负字间距：从标题到正文都使用紧缩字间距
- 极端行高范围：标题压缩至 1.07，正文开放至 1.47
- 字重克制：多数文本使用 400/600，700 仅用于粗体卡片标题

### 组件样式

#### 按钮
| 类型 | 背景 | 文本 | 圆角 | 内边距 | 用途 |
|------|------|------|------|--------|------|
| 主按钮（蓝色 CTA） | `#0071e3` | `#ffffff` | 8px | 8px 15px | 主要行动（购买、提交） |
| 深色按钮 | `#1d1d1f` | `#ffffff` | 8px | 8px 15px | 次要行动 |
| 药丸链接 | 透明 | `#0066cc` 或 `#2997ff` | 980px | 8px 15px | "了解更多"、"进入" |
| 筛选按钮 | `#fafafc` | `rgba(0, 0, 0, 0.8)` | 11px | 0px 14px | 搜索、筛选控件 |
| 媒体控件 | `rgba(210, 210, 215, 0.64)` | `rgba(0, 0, 0, 0.48)` | 50% | - | 播放/暂停、轮播箭头 |

#### 卡片与容器
- 背景：`#f5f5f7`（浅色）或 `#272729`-`#2a2a2d`（深色）
- 边框：**无**（Apple 极少使用可见边框）
- 圆角：5px-8px
- 阴影：`rgba(0, 0, 0, 0.22) 3px 5px 30px 0px`（仅用于 elevated 卡片）
- 悬浮：**无标准悬浮效果**（卡片静态，内部链接可交互）

#### 导航栏
- 背景：`rgba(0, 0, 0, 0.8)` + `backdrop-filter: saturate(180%) blur(20px)`
- 高度：48px
- 文本：`#ffffff`，12px，weight 400
- 毛玻璃效果是 Apple UI 的标志性特征

### 布局原则

#### 间距系统
- 基础单位：8px
- 小尺寸精细调节：2px-11px（1px 步进）
- 大尺寸跳跃：14px, 15px, 17px, 20px, 24px

#### 圆角刻度
- 微小：5px（小容器、标签）
- 标准：8px（按钮、产品卡片）
- 舒适：11px（搜索输入、筛选按钮）
- 大：12px（功能面板、生活图片容器）
- 药丸：980px（CTA 链接）
- 圆形：50%（媒体控件）

#### 布局哲学
- **电影化呼吸感**：每个产品区块占据接近全屏高度
- **色彩分隔**：通过黑白交替背景色块分隔章节，而非留白
- **内紧外松**：文本块内部紧凑（负字间距、紧行高），外部空间广阔

### Do's and Don'ts

#### ✅ 应该做
- Apple Blue (`#0071e3`) 仅用于可交互元素，作为唯一强调色
- 交替使用黑色和浅灰 (`#f5f5f7`) 作为章节背景
- 全尺寸应用负字间距
- 药丸 CTA 使用 980px 圆角
- 导航栏使用毛玻璃效果
- 标题行高压缩至 1.07-1.14
- 产品图片放在纯色背景上，无渐变/纹理

#### ❌ 不应该做
- 引入额外的强调色
- 使用重阴影或多层阴影
- 在卡片/容器上使用可见边框
- 在 SF Pro 上使用宽字间距
- 使用 800/900 字重（最大 700）
- 在背景上添加纹理、图案或渐变（仅纯色）
- 导航栏使用不透明背景
- 居中对齐正文文本（仅标题居中）

### 响应式断点

| 名称 | 宽度 | 关键变化 |
|------|------|----------|
| 手机 | 360-480px | 标准移动端 |
| 平板 | 640-834px | 2 列产品网格 |
| 桌面 | 1070-1440px | 完整布局，最大内容宽度 980px |
| 大桌面 | >1440px | 居中，两侧宽边距 |

**触摸目标：** 主要 CTA 最小 44px 触摸高度

## 注意事项

1. **数据库持久化**：better-sqlite3 自动持久化，数据写入即时保存
2. **跨域**：后端已配置 CORS，支持局域网访问
3. **文件大小限制**：上传文件限制 10MB
4. **移动端优先**：UI 设计时优先考虑移动端体验
5. **无测试**：项目当前没有测试框架，不需要运行测试
6. **环境要求**：better-sqlite3 需要编译原生模块，推荐在 Docker/标准 Linux 环境运行

## 相关文档

- **README.md** - 项目概述和更新日志
- **AGENTS.md** - AI Agent 详细开发指南
