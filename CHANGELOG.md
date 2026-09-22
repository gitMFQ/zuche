# 更新日志

> 本文件从 `README.md` 拆出，最新记录在最前。

## 2026-09-22

### 操作日志收进设置页

原来 `/logs` 是侧边栏的一级菜单，现在改为设置页「操作日志」分栏（`?tab=logs` 可深链），
侧边栏只留「设置」一个入口，路由与 `Logs.vue` 一并删除。筛选、移动端卡片、分页能力全部保留。

### 新增财务/结算模块（依据 5 份手工台账建模）

需求来自用户提供的 5 份 Excel 台账：3 份单车车主结算台账（捷途 宁A8E9K2 / 哈弗H6 宁A173GV /
雅阁 宁A917DE）、1 份公司总台账（车辆档案 / 租金台账 / 车辆费用台账 / 运营开支台账 / 资金流水总账）、
1 份合伙人往来账（牛昭平 / 马跃）。计算链与费率口径全部按台账反推并用真实数字做了回归断言。

**数据库（迁移 `0012`~`0017`，表数 17 → 30）**

- `0012` 车主/合伙人档案 `owners`（一表两角色，费率按车主配）+ `vehicles` 补 12 个档案字段
  （车辆编号 / 车型分类 / 购入日期与价格 / 初始里程 / 车主 / 归属 / 月供与车贷）
- `0013` 资金账户 `fund_accounts` + 流水 `fund_transactions` + 划转 `fund_transfers` + 账期锁定
- `0014` 结算行 `settlement_lines`（calc_* 与最终值双列）+ 期初结转 `settlement_openings` + 付款 `settlement_payouts`
- `0015` 车辆费用 `vehicle_expenses`（收支双列）/ 运营开支 `operating_expenses` + 两套字典 /
  合伙人往来 `partner_advances` + `orders` 补开票与结算状态 4 列
- `0016` 6 个默认账户 + 27 项运营开支字典 + 13 类车辆费用字典；补 `哈啰` 来源并把携程费率归一到 15%
- `0017` 「公司自营」受益人记录 + 自营车回填（让自营车也能进结算与单车月报）

**后端**

- 新增 `lib/money.ts`（6 位精度金额）、`lib/settlement.ts`（结算计算链 + SQL 构造）、
  `lib/ledger.ts`（流水构造与红字冲销）、`lib/fundAccount.ts`（支付方式→账户）、
  `lib/expenseMirror.ts`（业务单据→车辆费用镜像）
- 新增控制器 `owners` / `finance` / `expenses` / `settlement` / `reports` 与 5 组路由
- **全自动联动**：下单预付、订单收款、续租收款、保养/保险/违章、结算付款、合伙人付款
  都会在业务自己的 `batchExecute` 里写资金流水；删订单先读流水再写红字冲销并作废结算行

**前端**

- 新增「财务」一级入口（`/finance`，薄壳 + 6 个页签 + `?tab=` 深链）：
  资金流水 / 车主结算 / 车辆费用 / 运营开支 / 车主合伙人 / 报表，配套 9 个弹窗
- 新增 `utils/money.ts`：金额格式化保留台账的 4 位小数（**不能一刀切成 2 位**）
- 车辆表单与详情补档案、车主、车贷区块；订单表单/列表/详情补开票与结算状态

**验证**

- vitest 从 90 个用例扩到 **178 个**，新增 money / settlement / ledger 三个文件；
  结算链用台账真实行做回归（雅阁 225 元 → 33.75 / 191.25 / 19.125 / 172.125 逐分一致）
- 新增只读体检脚本 `scripts/verify-finance.mjs`：外键、幂等键、冲销链、结算行 calc/final 漂移、
  已付款费用是否都有流水等 30 余项不变量，并逐账户列出「期初 + 流水净额 = 余额」
- 全部接口用 curl 走通真实业务流（建单预付 → 收款 → 删单冲销 → 余额回退、结算生成 → 人工调整
  → 改订单重算 → 作废恢复 → 取消订单联动）

### 代码审查阶段修掉的六个缺陷

复核这批改动时逐项验证（不是读代码猜），确认并修复了 6 处：

- **逐行余额在带日期筛选时是错的**（最严重）：窗口函数在 WHERE 之后的行集上计算，
  于是「余额」退化成「筛选区间内的累加和」—— 按 2 月起筛选时余额会凭空少掉 1 月的收款。
  修法是把筛选写在**外层**子查询、窗口始终算全量，并新增接口层断言锁住这个行为
- **「车辆收益」页签永远加载不出来**：懒加载守卫用了全局 `hasShown` 标记，
  它在第一次切换页签后就变 true，导致该页签只有在被第一个点开时才会发请求，否则一直空表且不报错
- **部分更新车辆会静默清空车主与归属**：`PUT /vehicles/:id` 是全量替换语义，
  不带 `owner_id` 时会被重置为 null，该车随即掉出车主对账单、结算也悄悄按 0 费率算。
  新增的 12 个档案字段改为「缺省则沿用原值」
- **自动镜像的费用行实际可改金额**：守卫读的是 `amount_overridden`，但那个标记**没有任何写入方**，
  所以守卫恒为假。改为按 `source_type !== 'manual'` 拦截（与删除路径一致）
- 删掉未注册路由的死代码 `restoreSettlementByOrder` 及其无消费方的 SQL 构造器
- 车主往来账抽屉一次只拉 100 条且无分页，超出时静默截断 → 加显式提示

其中「逐行余额」那条尤其值得记一笔：它是我自己先写下、又自己推翻的一个错误断言 ——
第一版断言把筛选写进了窗口层，等于复现 bug 而非检测它，在正确代码上也会失败。
最终改为接口层断言，并**特意把缺陷放回去验证过它会失败**。

### 落地过程中修掉的四个真实缺陷

- **台账精度是 4 位小数，不是 2 位**：`702.95 × 15% = 105.4425`。原计划按分（2 位）舍入会让
  每一行与台账差半分、几百行累计后总额对不上，改为 6 位精度（`MONEY_SCALE`）
- **公司费率不是全局统一的**：捷途 15%、雅阁 10%、自营车 0 —— 印证了「按车主配费率」的设计，
  并顺手修正了公司月报的口径（自营车的结算额应全额计入公司收入，而不是被相减成 0）
- **SQL 里算金额会留浮点尾数**：`334.9 - 50.235` 直接算出来是 `284.66499999999996`，
  落库即成脏数据；所有金额表达式都套上 `ROUND(..., 6)`
- **资金流水按 `opening_date` 过滤会让补录的历史流水静默消失**（明细查不到、余额也不计），
  改为「期初余额 = 系统里第一条流水之前的余额」，所有录入的流水都叠加在它之上

### 页面容器宽度统一到「铺满主内容区」

财务页当初没写宽度上限，宽屏下能铺满；其余页面各自在 scoped 里写了一份
`max-width: 1200px; margin: 0 auto`（操作日志是 1400px），宽屏两侧空一大块。现在统一按
财务页的基准：去掉首页 / 车辆 / 订单 / 客户 / 黑名单 / 设置 / 操作日志的上限与居中。

- 约定写进 `style.css` 的 `.page-container` 注释，新页面不要再把上限加回来
- **订单详情页例外**，保留 600px 单列：它的操作按钮是整行铺满的（`block`），
  放到 1600px 会拉成一条长带
- 登录页 / 404 页不在主布局内，宽度不动
- 只是去掉上限，字号、间距、配色、断点都没变；≤1200px 的屏幕（含全部移动端）视觉零变化

**紧接着的补丁：三个列表的列宽改成弹性，让表格也一起变宽**

容器放开后，订单 / 车辆 / 客户三个列表看上去仍然很窄 —— 因为它们的列**全部**写死了 `width`。
Element Plus 的 `table-layout` 里 `flexColumns = columns.filter(c => !isNumber(c.width))`，
弹性列为空时 `bodyWidth` 直接取「列宽之和」，所以容器再宽表格也不跟着长（右侧留白 400~550px）。
黑名单和操作日志没这个问题，它们本来就有个 `min-width` 的弹性列。

改法：把三张表所有列的 `width` 换成 `min-width`，整表按各列的最小宽度**等比例**铺满容器。
窄屏（列宽之和 > 可用宽度）行为不变，仍是横向滚动、各列保持原宽度：

| 表格 | 列宽合计 | 1920 屏铺满后的变化（示例） |
|---|---|---|
| 订单 | 1260 | 客户 80→107、取车/还车 170→214、操作 250→315 |
| 客户 | 1120 | 身份证号 180→255、操作 280→398 |
| 车辆 | 1300 | 车牌号 140→180、车架号 120→146、操作 180→220 |

**同一批：财务「报表」页的单车月报 / 车辆收益两张表**

这两张表的列也全部写死了 `width`（合计 1100 / 905），在同一个页签里其余三张表都已铺满，
唯独它们右侧留白。同样把所有列的 `width` 换成 `min-width`。同页的「资金流水」报表不用改，
它的「收入 / 支出」两列本来就没写宽度，是天然的弹性列。

## 2026-09-21

### 同步三份文档到当前仓库状态

- `README.md` / `AGENTS.md`：表数统一为 17 张（`0001` 建 13 张，`0004` 加 3 张、`0008` 加 1 张），
  JWT 有效期统一为 7 天，去掉指向已删文件的入口说明
- 补录 `67ee686`（修复 11 个前端存量类型错误）—— 该提交此前从未进过本文件
- 抽查过的数字：vitest 仍是 7 个文件 90 个用例；迁移 `0007` 涉及 16 张表、`0010` 新增 7 个索引；
  组件拆分的行数变化按 `git show` 实测值写；构建产物体积按 `frontend/dist/assets` 实测值写
- 只改文档，无代码行为变化

### 删除无路由引用的孤儿页面 Users.vue 与 OrderSources.vue

- 两者在 `router/index.ts` 没有路由注册，全仓也没有任何 import（与上一个提交删掉的
  `views/Violations.vue` 是同一类）；用户管理与订单来源的能力由 `Settings.vue` 里的
  `<UsersTab />` 与 `<OrderSourcesTab />` 承载
- 已通过 `npm run verify`（typecheck / lint / 90 项单测）

### 统一支付方式 bank 的中文名

- `frontend/src/utils/constants.ts` 的 `PAYMENT_METHOD_OPTIONS` 写的是「银行转账」，与后端
  `src/lib/constants.ts`、前端 `PAYMENT_METHOD_TEXT_MAP` 以及 README 的「银行卡」不一致，
  下拉框与列表回显会出现两种叫法；统一为「银行卡」

### 修正库存日历浮窗读取的客户与金额字段名

- `getGanttData` 序列化后客户信息下发的是 `name`/`phone`/`rmb`，`GanttChart.vue` 的浮窗却读
  `customer_name`/`customer_phone`/`total_amount`，导致悬浮时客户与电话恒为 `-`、金额恒为 ¥0
- 按后端实际字段修正 `getOccupationTooltip`；只改前端展示，**无数据迁移**

### 删除无路由引用的孤儿页面 Violations.vue

- `frontend/src/views/Violations.vue`（787 行）在 `router/index.ts` 没有任何路由注册，全仓也没有 import 引用；
  全量违章列表的能力已由车辆页的 `ViolationsTab` 承载，直接删除避免死代码误导后续维护
- 已通过 `npm run verify`（typecheck / lint / 90 项单测）与 `npm run build:web`

### 本机改用 Node 版本地后端

- 新增 `scripts/dev-backend.mjs`：本机跑不起 workerd，改用 esbuild 把同一份 `src/index.ts` 打成 Node ESM，
  DB 换成 `node:sqlite`、UPLOADS 换成本地目录，接口路径与签名机制保持不变
- `vite.config.ts` 增加 `/cdn-cgi` 代理：剥掉 `getImageUrl()` 拼出的图像转换前缀再转发，
  否则本地图片会落到 SPA 回退变成 index.html
- 仅影响本地开发，不参与部署

### 拆分巨型页面与 Tab 为可复用子组件

- 新增 15 个组件：订单域 `components/order/` 下 `OrderFormDialog`、`OrderInfoSections`、
  `MileagePhotoDialog`、`ExtendDialog`、`PaymentDialog`、`AssignDriverDialog`；
  仪表盘 `components/dashboard/` 下 `GanttChart`、`OrderDetailDialog`、`ScheduleTable`、`StatCards`；
  车辆域 `components/vehicle/` 下 `ViolationFormDialog`、`InsuranceFormDialog`、`VehiclePicker`、
  `MaintenanceFormDialog`；公共 `components/ImagePreviewDialog.vue`
- `Orders` 与 `OrderDetail` 改为共用同一套编辑表单、取还车表单与预览逻辑；仪表盘的取车/还车弹窗
  复用 `order/MileagePhotoDialog`；三个车辆 Tab 的图片预览统一走 `ImagePreviewDialog`
- 行数变化：`Dashboard.vue` 2245→756、`OrderDetail.vue` 1970→516、`Orders.vue` 2869→1676、
  `ViolationsTab.vue` 1292→840、`MaintenanceTab.vue` 1063→674、`InsuranceTab.vue` 1048→636
- 顺带修掉两个问题：编辑弹窗删照片时误改到新建表单的数组；`OrderDetail` 编辑回写把身份证清空
- 纯结构重构，UI 与接口契约不变，**无数据迁移**

### 忽略本地 MCP 配置文件

- `.gitignore` 增加 `.mcp.json`（含个人密钥，不入库）

### 修复按需引入后图标全部不显示

- 改造为按需引入时删掉了 `main.ts` 里全局注册图标的循环，但 `ElementPlusResolver` 只解析 `/^El[A-Z]/`
  开头的组件名，裸图标名（如 `<Plus />`）不会被自动导入，模板里的图标全部渲染不出来
- 18 个 `.vue` 文件补上 `@element-plus/icons-vue` 的手动 import
- 字符串式图标改为绑定式：`el-avatar` 的 `icon`、收起/展开与主题切换按钮的 `:icon`、
  `el-switch` 的 `active-icon` / `inactive-icon`
- `MainLayout` 与 `Login.vue` 里图标包不存在的 `<Car />` 改为 `<Van />`；
  `el-link` 的 `underline` 适配 Element Plus 3.0 的 `'always'|'hover'|'never'`
- `vite.config.ts` 用 `optimizeDeps.include` 预热，避免 dev 期依赖重新预构建打断在飞请求
  （表现为 `ERR_CONNECTION_CLOSED`）

### 修复 /health 在生产不可达

- `wrangler.jsonc` 的 `run_worker_first` 加入 `/health`：它原先不在列表里，会被 SPA 回落吃掉，
  线上访问 `/health` 返回的是 index.html 而不是 JSON，等于该端点从未生效（部署后实测发现）
- `.github/workflows/ci.yml` 的 `actions/checkout` 与 `setup-node` 由 v4 升到 v7
  （v4 系列目标 Node 20 已进入弃用流程）

### 统一时区并修正存量时间（迁移 0007）

- `src/lib/time.ts` 的 `now()` 改为北京时间基准，11 处 SQL 的日期时间函数加 `+8 hours`
- `migrations/0007_timezone_unify.sql` 按列来源分别修正存量：系统写入的审计列加 8 小时，
  用户录入的业务列不动；`orders.actual_start_date` 只修 `import_batch_id IS NULL` 的行
  （导入单的时间来自平台数据，不是系统时间）
- 格式异常行用 `COALESCE(datetime(x,'+8 hours'), x)` 兜底，避免个别脏值让整表 UPDATE 失败
- 涉及 16 张表的存量 UPDATE，**需执行 `npm run d1:migrate`（本地）/ `npm run d1:migrate:remote`（远端）**

### 新增订单聚合统计与年检状态下推

- 新增 `GET /api/orders/stats`：原先前端拉全表再自己数，会被分页上限截断导致计数偏小；
  改为一条 SQL 聚合出各状态数量与今日/明日/逾期计数
- `src/controllers/inspection.ts` 把年检状态判定下推到 SQL，且 SELECT 与 WHERE 复用同一段
  `INSPECTION_STATUS_CASE` 表达式，修掉「先分页后过滤」导致的筛选结果不完整、计数与筛选对不上

### 引入订单状态机并修正派生字段

- 新增 `ORDER_STATUS_TRANSITIONS`（`src/lib/constants.ts`），订单状态变更改为按白名单流转
- 还车时同步写入 `net_amount`；「逾期」改为按日期派生，不再存成一个状态
- 订单号随机段由 4 位加长到 6 位（`src/lib/ids.ts`，100 万种组合），并在撞唯一约束时换号重试
- 修掉取车时间字段名不匹配：前端传 `actual_pickup_date`、后端读 `actual_start_date`，该字段从未落库

### 加固用户与角色权限

- 角色改为白名单校验；禁止改自己的角色与状态；保护最后一个管理员不被降级或禁用
- 新增密码强度校验（`src/lib/auth.ts` 的 `validatePassword`）；种子管理员首次登录强制改密
  （`users.must_change_password`）

### 加固认证：密钥、有效期、吊销与限流

- `src/lib/auth.ts` 移除 JWT 默认密钥兜底：`JWT_SECRET` 缺失时直接抛错，登录报「服务未正确配置」。
  **部署前必须确认线上已执行 `wrangler secret put JWT_SECRET`**，否则所有人无法登录
- 令牌有效期由 1 年缩短到 7 天，配合 `users.token_version` 实现吊销：改密码 / 重置密码 / 禁用 /
  删除用户时自增，`src/middleware/auth.ts` 每个请求比对一次
- 新增登出接口；登录失败按 `username:IP` 限流，15 分钟内失败 5 次锁 15 分钟
  （带 username 是因为门店常共用同一个出口 IP，只按 IP 会互相误伤；只按 username 又拦不住换号撞库）
- bcrypt cost 由 8 提到 10
- 迁移 0008 新增 `login_attempts` 表存放限流计数

### 上传改为签名 URL 并校验文件魔数

- `/uploads/*` 改为签名 URL：对外形态 `/uploads/{exp}.{sig}/{dir}/{file}`，HMAC 签名 + 7 天过期；
  存储侧仍是 `/uploads/{dir}/{file}`，只在响应时签（`src/lib/uploadUrl.ts` 挂在 `/api` 上递归替换）
- 签名放路径而非 query，是因为前端会拼 `/cdn-cgi/image/<opts>/<路径>`，图像转换层不透传 query
- 新增 `src/lib/uploadGuard.ts` 校验文件魔数，MIME 与真实格式不符直接 400

### 给接口与文件响应加安全响应头

- `src/index.ts` 挂 `hono/secure-headers`：CSP、`X-Frame-Options: DENY`、HSTS、`nosniff`、
  `Referrer-Policy: no-referrer`（最后一项是为了不让带签名的图片 URL 通过 Referer 泄露）
- **覆盖范围只有 `/api/*` 与 `/uploads/*`**：HTML/JS/CSS 由 Static Assets 直接返回不进 Worker，
  页面级 CSP 与 X-Frame-Options 需在 Cloudflare Zone 层用 Response Header Transform Rules 配

### 前端类型化与列表三态

- 新增 `frontend/src/api/types.ts`：响应信封、分页、实体全部类型化，`api/index.ts` 消除 `any`
- 新增 `components/DataState.vue` 统一加载中 / 失败可重试 / 空三态
- 新增字典 Pinia（`stores/dict.ts`，订单来源与用户选项，带 TTL 与失效），替换 5 处重复请求
- 筛选与分页同步到 URL（`composables/useQuerySync.ts`）；路由加角色守卫与 404 页；
  修掉刷新后 `user` 丢失导致管理员菜单消失
- 上传校验下沉到 API 层——原先 23 处重复校验仍然漏了仪表盘

### 按需引入瘦身主包

- Element Plus 与图标改为按需引入，主包 874KB → 约 45KB（gzip 约 18KB）
- 删除 5 个零引用组件与示例资源，清理 49 条无用 CSS，色值收敛到语义 token
- 修 8 处 resize 监听未解绑的内存泄漏；补 43 个图片 `alt` 与 40 个可点击元素的键盘可达性
- 修复深色模式下文本色未反转（黑底黑字）

### 健康检查真探依赖并开启日志

- `/health` 改为真的探 D1（`SELECT 1`）与 R2（`UPLOADS.head`），任一不可用即返回 `degraded` 与 503
- `wrangler.jsonc` 开启 Workers Logs；仪表盘统计加缓存
- `src/index.ts` 定时清理操作日志（保留 180 天）与登录限流记录

### 工程化：单测、biome 与 CI

- 新增 vitest：`test/` 下 7 个文件共 90 个用例，覆盖时区、金额、订单号、签名 URL、魔数校验、导入列映射
- 新增 biome（`biome.json` 只覆盖 `src/` 与 `test/`，`.vue` 有意排除——biome 不认识 `<script setup>`
  模板用法会误报）与 `.github/workflows/ci.yml`
- 新增 `npm run verify`：typecheck + lint + test 一条命令跑完

### 补齐查询索引（迁移 0010）

- `migrations/0010_missing_indexes.sql` 新增 7 个索引：收入报表与客户/车辆/订单来源/违章列表的
  `created_at`、订单 `actual_end_date`、以及车辆占用判定用的
  `orders(vehicle_id, status, start_date, end_date)`

### 车辆状态改为派生并给订单存车牌快照

- 迁移 0009：`vehicles.status` 只表达人工设定的可用性，是否在租一律由订单推导，存量 `rented`
  归一为 `available`（仪表盘「已出租」原先恒为 0，因为订单流转从不维护这一列）
- 迁移 0008：`orders` 新增 `plate_number` 车牌快照并按车辆回填，车辆删除后历史订单仍可读到车牌
- 迁移 0011：订单来源默认色由 Element 蓝 `#409EFF` 归一到品牌蓝 `#0071e3`；用户自行配置的渠道色不动
  （那是渠道身份标识，不属于主题色）

### 黑名单接入建单与改单

- 建单 / 改单命中黑名单改为软拦截：返回命中记录（姓名、电话、原因）交给前端二次确认，
  带 `force` 才放行，并写操作日志留痕
- 无手机号时黑名单按姓名匹配
- 0007-0011 这五个迁移已按提交说明在线上执行并逐条校验；本地环境仍需 `npm run d1:migrate` 才会生效

## 2026-09-20

### 修复移动端翻页按钮不可见

- 分页组件原先写在 `<el-card class="table-card">` 内，移动端 `.table-card` 被 `display:none` 隐藏，
  翻页按钮一并消失
- 把 `el-pagination` 移出 table-card，移动端与桌面端共用同一份分页；`.pagination` 在移动端居中并允许
  换行，`@media (min-width: 768px)` 内恢复右对齐
- 覆盖 11 个文件：车辆列表、客户、订单、用户、黑名单、违章管理，以及车辆详情的保养/保险/年检/违章 Tab

### 云端资源切换到 zjzc

- `wrangler.jsonc`：D1 `database_name` / `database_id` 改为 `zjzc`，R2 `bucket_name` 改为 `zjzc`
- `package.json` 的 `d1:*` / `r2:*` 脚本、`README.md` 与 `scripts/seed-demo.sql` 里的命令同步改名
- 只改配置与文档；**部署前需确认新的 D1 与 R2 已创建并跑过迁移**，否则线上接口查不到表、
  历史上传的文件也读不回来

### 上传前统一压缩图片（≤500KB / 1600px / WebP）

- 新增 `frontend/src/utils/image.ts`：canvas 编码循环，先降质量（0.82→0.5）、再缩尺寸（×0.8），
  最长边 1600px、目标 500KB；输出 WebP（浏览器能编码的最小格式，且支持透明），
  `format=auto` 交付时再自动协商成 AVIF/WebP
- 接入点在 `uploadApi.uploadImage`，14 个上传入口零改动；>3MB 的原图显示「正在压缩图片…」
- 跳过与兜底：PDF/GIF/空文件原样上传；WebP 不可用的浏览器降级为 PNG（含透明）或 JPEG；
  解码/编码失败、压不到目标（返回最小结果）、重编码后反而更大（保留原图）都不会阻断上传
- 新增 `frontend/src/utils/upload.ts`：`validateUploadFile` 统一上传前校验，
  原始体积上限由 10MB 放宽到 50MB（否则 12MB 的手机照会在压缩前就被拒），
  替换 11 处重复校验并给仪表盘取还车照片补上校验（原先没有）
- 后端 10MB 限制与 MIME 白名单不变（`image/webp` 已在白名单内）

### 行驶证支持上传两张（正页/副页）

- 新增 `migrations/0006_vehicle_license_images.sql`：`vehicles` 增加 `license_images`（JSON 数组）、
  旧 `license_image` 用 `json_array()` 回填后删除，字段语义与 `customers.license_images` 对齐
- 车辆列表/详情/甘特图接口统一输出 `license_images: string[]`，写入走 `stringifyArray`；
  `VehicleBody` 仍接受旧的 `license_image`，避免部署瞬间未刷新的页面保存时把照片清掉
- `VehiclesTab` 表单改为最多两张（带 `n/2` 计数、逐张删除），上传时按 `行驶证1`/`行驶证2` 命名；
  列表缩略图、`VehicleDetailDialog` 支持两张，证件列宽由 80 调到 110

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

### 首页统计排除已取消订单

- `src/controllers/dashboard.ts`：订单数 `COUNT(*)` 未过滤 `cancelled`，取消后总数不减；
  本月收入直接汇总 `payments`，取消订单的收款仍计入收入
- 两处都加上 `status != 'cancelled'`，收入报表同样处理；并给 JOIN 后的 `created_at` 补上表别名
  避免字段歧义

### 客户手机号由必填改为选填

- 平台导出的客户没有完整手机号，强制必填会挡住录入
- 后端：创建 / 更新客户时手机号留空不再报错，也不参与重复性判断（否则第二个无手机号客户会被上一个
  空串拦住）；`customers.phone` 是 NOT NULL，所以空白收敛成空串而不是 NULL
- 建单 / 改单时无手机号改为按姓名匹配客户——若仍按 `phone` 查，空串会命中库里第一个无手机号的客户，
  把订单错挂到别人名下
- 前端：客户与订单表单去掉 `required`，保留格式校验（`^(1[3-9]\d{9})?$`）

### 修复添加客户时空身份证撞唯一约束导致 500

- 前端不填身份证时传的是空串，原逻辑 `if (id_card)` 判假跳过重复检查，但空串在 UNIQUE 索引里
  是实打实的值，第二个客户插入即 `UNIQUE constraint failed`
- `src/controllers/customers.ts` 新增 `normalizeOptional`，把空白串收敛成 NULL（NULL 之间互不冲突），
  create 与 update 都处理

### 修复创建订单时插入列与占位符数量不匹配

- 0004 迁移给 `orders` 加了 `delivery_type` 并同步进 `createOrder` 的列列表，但 VALUES 占位符多了一个，
  导致所有新建订单报 500（26 values for 25 columns）

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

### 新增订单批量导入功能

- 新增 `src/controllers/import.ts` 与 `src/lib/import/`（`normalize` / `templates` / `validate`），
  新增 `frontend/src/views/OrderImport.vue`（531 行）并在 `router/index.ts` 注册
- 携程与自有平台两套导出模板，按表头列名嗅探而非 sheet 名；preview 只校验不落库、commit 才写入，
  按外部订单号幂等；客户按姓名匹配、车辆按车牌匹配，匹配不到就自动建
- 迁移 `migrations/0004_import.sql`：`orders` 补 `platform`、`external_no`、`import_batch_id`、
  `actual_start_date`、`violation_deposit`、`cancel_reason`、`cancelled_at`、`delivery_type`、
  取还司机 id/name、`booked_model`；`vehicles` 补 `transmission`、`fuel_type`、`body_type`、`doors`；
  `order_sources` 补 `platform` 支持「平台 → 渠道」两级；新建 `order_fees`（费用明细）、
  `order_extensions`（续租历史）、`import_batches`（导入批次，支持整批撤销）
- 顺带补全：取车时记录实际取车时间（原先只有还车时间）、取消订单记录原因与时间、
  续租与添加支付写入历史与费用明细
- **需执行 `npm run d1:migrate`（本地）/ `npm run d1:migrate:remote`（远端）**

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

### 修复 11 个前端存量类型错误

- `SkButton.vue` / `SkCard.vue` / `SkSection.vue` / `SkTypography.vue` 四个基础组件用了 `computed`
  却没有导入，渲染时会抛 `ReferenceError`，分别补上 `import { computed } from 'vue'`
- `ViolationsTab.vue` 与 `views/Violations.vue` 的 `onViolationDateChange` 同时被原生 `<input>` 与
  `el-date-picker` 绑定，前者传 `Event` 后者传字符串，函数按 `string` 使用会让移动端日期匹配失效；
  改为接收 `string | Event | null` 并统一归一化
- `MainLayout.vue` 删掉 3 个未接入模板的导航样式 `computed` 及随之失效的 `colorWithAlpha()`；
  `Dashboard.vue` 删掉未被使用的 `ganttContainer` ref
- 前端类型检查由 11 个错误降为 0

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
