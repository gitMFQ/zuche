# 更新日志

> 本文件从 `README.md` 拆出，最新记录在最前。

## 2026-09-20

### 修复保险附件上传后前端看不到

- `insurance.ts` 的 `parseDocuments` 只保留字符串，把前端存的 `{ url, type }` 对象全过滤掉了，
  导致保险附件列表、编辑回显都是空（Express → Worker 迁移时引入）
- 改为统一归一化成 `{ url, type }`：对象按自身 type，纯 URL 字符串按 `.pdf` 后缀推断，
  兼容历史数据与脏数据
- `InsuranceBody.documents` 类型由 `string[]` 改为 `InsuranceDocument[]`

### 图片走 Cloudflare Images 转换

- `getImageUrl` 统一给 `/uploads/...` 拼上 `/cdn-cgi/image/width=600,format=auto` 前缀，外链、base64、PDF 不参与
- 新增 `getLogoUrl`（`width=200`），`MainLayout.vue`、`Settings.vue` 的 Logo 改走它
- 本地 `wrangler dev` 没有 Cloudflare 边缘，`/cdn-cgi/image/*` 不生效（图片会 404），线上才有效果

### 上传文件名语义化

- 7 个上传端点支持可选表单字段 `name`，清洗后与北京时间戳、短随机串拼成 R2 key，
  如 `customer/张三-身份证-20260920-153045-a1b2c3.jpg`；未传时用各类型默认名（年检证/保险单/…）
- `SAFE_NAME` 放开中文（仍禁止路径穿越），`serveUpload` 按原规则校验后回源
- 前端 `uploadApi.*` 增加可选 `name` 参数，各调用点按「车牌号或客户名 + 用途」传名
- 顺带修掉 `Orders.vue` 编辑订单弹窗上传证件照时图片错存进新建表单的问题

### 修复安卓 Chrome 上传直接开相机

- 移除各图片 `<input type="file">` 上的 `capture="environment"`（客户证件、取还车照片、违章、保养、
  年检证 el-upload），恢复系统选择器，用户可自行选相机或相册

## 2026-09-19

### 订单详情支持删除订单

- 新增 `DELETE /api/orders/:id` 与 `deleteOrder`，支付、费用、续租记录随外键级联删除，违章保留（外键 SET NULL）
- 订单详情页底部新增「删除订单」按钮，二次确认后删除并跳回订单列表

### 到店取车不再记录地址

- 新增常量 `STORE_LOCATION_TEXT = '门店'`（前后端各一份），到店取车的取车/还车位置统一记为「门店」
- 导入订单：识别为到店取车（`delivery_type = store`）时忽略平台导出的地址，取还位置写「门店」
- 新建订单：新增「取还方式」选项（送车上门 / 到店取车），选到店取车时自动预填门店，仍可手动改
- `createOrder` 支持写入 `delivery_type`；配送方式文案统一为「送车上门 / 到店取车」

### 订单来源去掉所属平台

- 移除订单来源的「所属平台」：新增/编辑表单、列表列、接口读写、`OrderSourceRow` 全部清理
- 新增 `migrations/0005_drop_order_source_platform.sql` 删除 `order_sources.platform` 列
- 批量导入订单改为**必选订单来源**：整批订单统一挂到所选来源下，不再按渠道名自动新建来源
  （`commitImport` 校验 `default_source_id`，`prepareRows` 移除来源匹配逻辑）
- 订单列表页「批量导入订单」入口从页面顶部移到「新建订单」按钮后面

### 移除主题自定义设置

- 移除「系统设置」中的主题色、侧边栏风格、自定义渐变三项
- 全局样式统一回落：强调色固定 Apple Blue `#0071e3`，不再支持用户自定义
- 侧边栏改为跟随深色模式：默认浅色（白底 + 深色文字），`html.dark` 下保持原纯黑样式
- `system_settings` 无需数据迁移——已确认远端只存有 `system_title` 与 `system_logo`，三项设置从未落库
- 同步更新 `README.md`、`AGENTS.md` 中的相关表述

## 2026-09-18

### 架构迁移：Express → Cloudflare Worker

- 后端由 Express 5 + better-sqlite3 迁移到 **Cloudflare Worker（Hono 4）**
- 数据库换成 **D1**，上传文件改存 **R2**
- 前端构建产物改由 Worker 的 Static Assets 托管，**前后端一体部署**，不再需要单独部署前端
- 删除 `backend/`，后端源码统一到 `src/`；数据库变更改为 `migrations/*.sql` 迁移文件

### 首次上线

- 创建远端 D1 `rental-db` 与 R2 `rental-uploads`，执行迁移建表并写入种子数据
- 绑定自定义域名（写在 `wrangler.jsonc` 的 `routes`，`custom_domain: true`）
- 用 `wrangler secret put` 设置线上 `JWT_SECRET`，不再使用代码里的默认密钥
- 关闭 Workers Logs（`observability.enabled: false`）

### 文档整理

- 删除 `QWEN.md`，有效内容核对后合并进 `AGENTS.md`
- 更新日志从 `README.md` 拆到本文件
- 修正 `README.md` 中过时的项目结构、API 列表与环境要求

## 2026-04-08

### 文档重构

- 精简 `AGENTS.md`，改为中文版快速参考指南
- `QWEN.md` 新增 Apple 设计系统完整规范（色彩系统、字体规则、组件样式、布局原则）

### 前端样式优化

- 提取订单详情弹窗样式至全局 `style.css`，统一所有页面弹窗圆角为 12px
- 添加订单详情弹窗暗色模式支持
- 移除 Dashboard.vue 中重复的暗色模式规则和冗余样式

## 2026-04-01

### 移动端体验优化

- 所有移动端日期/时间输入框改用原生选择器
- 提升移动端操作友好性，无需加载第三方组件
- 兼容暗色模式

### 仪表盘调度功能优化

- 优化待收送表格显示逻辑
- 送车任务：所有未完成订单中取车时间在未来的都显示
- 收车任务：所有未完成订单中还车时间在未来的都显示
- 不论订单是否已取车，根据日期自动显示待办任务

## 2026-03-29

### 车辆详情弹窗组件

- 新增 `VehicleDetailDialog.vue` 组件
- 显示车牌号、品牌、型号、颜色、年份、座位数、里程等完整信息
- 支持新能源车标识、行驶证/登记证书图片预览

### 甘特图数据增强

- 甘特图数据返回完整车辆信息
- 支持查看详细订单信息

### 订单管理界面优化

- Orders.vue 和 OrderDetail.vue 大幅重构

### 仪表盘功能增强

- Dashboard.vue 界面优化，甘特图功能增强

## 2026-03-25

### 调度管理功能

- 从订单自动生成取还车调度安排
- 支持导出为图片下载
- 平台颜色使用订单来源中设置的颜色

## 2026-03-23

### 支付功能增强

- 支付方式新增"平台支付"
- 支付类型新增"车损"
- 已还车订单也可添加支付记录

### 代码复用优化

- 新增 `utils/constants.ts` 和 `utils/helpers.ts`
- 减少重复代码约 100+ 行

## 2026-03-22

### 数据库迁移

- sql.js 替换为 better-sqlite3
- 自动持久化，启用 WAL 模式

### 系统主题设置

- 主题色、侧边栏风格自定义
- Logo 上传功能

## 2026-03-21

### 新能源车标识

- 车辆支持新能源标记
- 车牌样式：新能源绿底白字，非新能源蓝底白字

### 服务类型

- 订单支持服务类型：基础/优享/尊享

### 免押功能

- 订单支持免押选项
- 自动计算免押到期日期

### 取还车增强

- 取车/还车支持里程记录
- 取车/还车支持照片上传
