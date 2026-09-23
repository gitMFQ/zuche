<template>
  <div class="page-container">
    <!-- 标签页 -->
    <el-tabs v-model="activeTab" class="order-tabs" @tab-change="onTabChange">
      <el-tab-pane label="待取车" name="pending">
        <template #label>
          <span>待取车 <el-badge v-if="tabCounts.pending > 0" :value="tabCounts.pending" /></span>
        </template>
      </el-tab-pane>
      <el-tab-pane label="待还车" name="active">
        <template #label>
          <span>待还车 <el-badge v-if="tabCounts.active > 0" :value="tabCounts.active" /></span>
        </template>
      </el-tab-pane>
      <el-tab-pane label="已完成" name="completed" />
      <el-tab-pane label="已取消" name="cancelled" />
    </el-tabs>

    <!-- 时间筛选按钮（仅待取车和待还车显示，不放入移动端折叠面板）：
         条件直接用 template，不套容器 —— 四个按钮就是 .page-container 的直接子级 -->
    <template v-if="activeTab === 'pending' || activeTab === 'active'">
      <button 
        class="filter-btn"
        :class="{ active: timeFilter === 'overdue' }"
        @click="toggleTimeFilter('overdue')"
      >
        已逾期 <span class="filter-count" :class="{ 'has-overdue': timeFilterCounts.overdue > 0 }">({{ timeFilterCounts.overdue }})</span>
      </button>
      <button 
        class="filter-btn"
        :class="{ active: timeFilter === 'today' }"
        @click="toggleTimeFilter('today')"
      >
        今天 <span class="filter-count">({{ timeFilterCounts.today }})</span>
      </button>
      <button 
        class="filter-btn"
        :class="{ active: timeFilter === 'tomorrow' }"
        @click="toggleTimeFilter('tomorrow')"
      >
        明天 <span class="filter-count">({{ timeFilterCounts.tomorrow }})</span>
      </button>
      <button 
        class="filter-btn"
        :class="{ active: timeFilter === 'dayAfter' }"
        @click="toggleTimeFilter('dayAfter')"
      >
        后天 <span class="filter-count">({{ timeFilterCounts.dayAfter }})</span>
      </button>
    </template>

    <!-- 搜索栏 -->
    <MobileFilterPanel title="搜索筛选">
      <el-card shadow="never" class="search-card">
        <el-form :model="searchForm" size="default" class="search-form">
            <el-form-item label="取车时间" class="date-form-item">
              <!-- PC端使用框架组件 -->
              <el-date-picker
                v-if="!isMobile"
                v-model="pickupDateRange"
                type="daterange"
                range-separator="-"
                start-placeholder="开始"
                end-placeholder="结束"
                value-format="YYYY-MM-DD"
                unlink-panels
                class="date-range-picker"
              />
              <!-- 移动端用 WeUI 滚轮 -->
              <div v-else class="mobile-date-range">
                <AppDatePicker v-model="searchForm.start_date_from" type="date" value-format="YYYY-MM-DD" />
                <span class="date-separator">-</span>
                <AppDatePicker v-model="searchForm.start_date_to" type="date" value-format="YYYY-MM-DD" />
              </div>
            </el-form-item>
            <el-form-item label="还车时间" class="date-form-item">
              <!-- PC端使用框架组件 -->
              <el-date-picker
                v-if="!isMobile"
                v-model="returnDateRange"
                type="daterange"
                range-separator="-"
                start-placeholder="开始"
                end-placeholder="结束"
                value-format="YYYY-MM-DD"
                unlink-panels
                class="date-range-picker"
              />
              <!-- 移动端用 WeUI 滚轮 -->
              <div v-else class="mobile-date-range">
                <AppDatePicker v-model="searchForm.end_date_from" type="date" value-format="YYYY-MM-DD" />
                <span class="date-separator">-</span>
                <AppDatePicker v-model="searchForm.end_date_to" type="date" value-format="YYYY-MM-DD" />
              </div>
            </el-form-item>
            <el-form-item label="订单来源">
              <AppSelect v-model="searchForm.source_id" :options="sourceOptions" placeholder="全部来源" clearable style="width: 100px" />
            </el-form-item>
            <el-form-item label="车牌号">
              <AppSelect v-model="searchForm.plate_number" :options="plateNumberOptions" placeholder="全部车牌" clearable filterable style="width: 140px" />
            </el-form-item>
            <el-form-item label="车型">
              <AppSelect v-model="searchForm.vehicle_model" :options="vehicleModelOptions" placeholder="全部车型" clearable filterable style="width: 160px" />
            </el-form-item>
            <el-form-item label="结算状态">
              <AppSelect v-model="searchForm.settle_status" :options="SETTLE_STATUS_OPTIONS" placeholder="结算状态" clearable style="width: 110px" />
            </el-form-item>
            <el-form-item label="排序">
              <AppSelect v-model="searchForm.order_by" :options="ORDER_SORT_OPTIONS" placeholder="默认排序" clearable style="width: 100px" />
            </el-form-item>
            <el-form-item label="关键词">
              <el-input v-model="searchForm.keyword" placeholder="订单号/客户/电话" clearable @keyup.enter="loadData" style="width: 140px" />
            </el-form-item>
            <el-form-item class="form-actions">
              <el-button type="primary" @click="loadData">
                <el-icon><i class="weui-icon-outlined-search" /></el-icon> 搜索
              </el-button>
              <el-button @click="resetSearch">
                <el-icon><i class="weui-icon-outlined-refresh" /></el-icon> 重置
              </el-button>
            </el-form-item>
        </el-form>
      </el-card>
    </MobileFilterPanel>

    <!-- 操作栏 -->
    <div class="action-bar">
      <el-button type="primary" @click="openDialog()">
        <el-icon><i class="weui-icon-outlined-add" /></el-icon> 新建订单
      </el-button>
      <el-button @click="goImport">批量导入订单</el-button>
    </div>

    <!-- 移动端卡片列表 -->
    <!-- 列表三态（加载中 / 加载失败可重试 / 空数据） -->
    <DataState
      :loading="loading"
      :error="loadError"
      :empty="tableData.length === 0"
      empty-text="暂无订单记录"
      skeleton
      @retry="loadData"
    >
    <div class="mobile-cards">
      <div v-for="item in tableData" :key="item.id" class="mobile-card" @click="goToDetail(item)">
        <div class="mobile-card-header">
          <span>
            <span v-if="item.source_name" class="source-tag" :style="{ background: item.source_color || '#0071e3' }">{{ item.source_name }}</span>
          </span>
          <span class="header-tags">
            <el-tag :type="SETTLE_STATUS_TAG_MAP[item.settle_status] || 'info'" size="small">
              {{ SETTLE_STATUS_TEXT_MAP[item.settle_status] || '未结清' }}
            </el-tag>
            <el-tag :type="getStatusType(item.status)" size="small">{{ item.status_text }}</el-tag>
          </span>
        </div>
        <div class="mobile-card-row">
          <span class="label">客户</span>
          <span class="value">{{ item.customer_name }} <a :href="'tel:' + item.customer_phone">{{ item.customer_phone }}</a></span>
        </div>
        <div class="mobile-card-row">
          <span class="label">车辆</span>
          <span class="value">
            <span class="plate-number" :class="item.is_new_energy ? 'new-energy' : 'fuel'">{{ item.plate_number }}</span>
            | {{ item.model }}
          </span>
        </div>
        <div class="mobile-card-row">
          <span class="label">取车</span>
          <span class="value">{{ formatDateTime(item.start_date) }}<span v-if="item.pickup_location" class="location-text"> ({{ item.pickup_location }})</span></span>
        </div>
        <div class="mobile-card-row">
          <span class="label">还车</span>
          <span class="value">{{ formatDateTime(item.end_date) }}<span v-if="item.return_location" class="location-text"> ({{ item.return_location }})</span></span>
        </div>
        <div class="mobile-card-footer">
          <span class="amount">¥{{ item.total_amount }}</span>
          <span class="paid" :class="{ 'text-warning': item.paid_amount < item.total_amount }">
            已付 ¥{{ item.paid_amount }}
          </span>
        </div>
        <div class="mobile-card-actions" @click.stop>
          <template v-if="item.status === 'pending'">
            <el-button type="primary" size="small" @click="openEditDialog(item)">编辑</el-button>
            <el-button type="success" size="small" @click="openPickupDialog(item)">取车</el-button>
            <el-button type="warning" size="small" @click="openPaymentDialog(item)">支付</el-button>
            <el-button type="danger" size="small" @click="handleCancel(item)">取消</el-button>
          </template>
          <template v-else-if="item.status === 'active'">
            <el-button type="primary" size="small" @click="openEditDialog(item)">编辑</el-button>
            <el-button type="success" size="small" @click="openReturnDialog(item)">还车</el-button>
            <el-button type="warning" size="small" @click="openExtendDialog(item)">续租</el-button>
            <el-button type="info" size="small" @click="openPaymentDialog(item)">支付</el-button>
            <el-button type="danger" size="small" @click="handleCancel(item)">取消</el-button>
          </template>
          <template v-else-if="item.status === 'completed'">
            <el-button type="primary" size="small" @click="openPaymentDialog(item)">支付</el-button>
            <el-button disabled size="small">已结束</el-button>
          </template>
          <el-button v-else disabled size="small">已结束</el-button>
        </div>
      </div>
    </div>

    <!-- PC端表格 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" stripe class="hide-mobile" @row-click="handleRowClick">
        <el-table-column prop="customer_name" label="客户" min-width="80" show-overflow-tooltip />
        <el-table-column prop="customer_phone" label="电话" min-width="110" show-overflow-tooltip />
        <el-table-column prop="plate_number" label="车牌" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="plate-number" :class="row.is_new_energy ? 'new-energy' : 'fuel'">{{ row.plate_number }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="start_date" label="取车" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatDateTime(row.start_date) }}
            <span v-if="row.pickup_location" class="location-text">({{ row.pickup_location }})</span>
          </template>
        </el-table-column>
        <el-table-column prop="end_date" label="还车" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatDateTime(row.end_date) }}
            <span v-if="row.return_location" class="location-text">({{ row.return_location }})</span>
          </template>
        </el-table-column>
        <el-table-column prop="total_amount" label="总金额" min-width="90" show-overflow-tooltip>
          <template #default="{ row }">¥{{ row.total_amount }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" min-width="80" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ row.status_text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="结算" min-width="90">
          <template #default="{ row }">
            <el-tooltip :content="row.settle_remarks || SETTLE_STATUS_TEXT_MAP[row.settle_status] || '未结清'">
              <el-tag size="small" :type="SETTLE_STATUS_TAG_MAP[row.settle_status] || 'info'">
                {{ SETTLE_STATUS_TEXT_MAP[row.settle_status] || '未结清' }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="source_name" label="来源" min-width="90" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.source_name" class="source-tag" :style="{ background: row.source_color || '#0071e3' }">{{ row.source_name }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" min-width="250">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button type="primary" link size="small" @click.stop="openEditDialog(row)">编辑</el-button>
              <el-button type="success" link size="small" @click.stop="openPickupDialog(row)">取车</el-button>
              <el-button type="warning" link size="small" @click.stop="openPaymentDialog(row)">支付</el-button>
              <el-button type="danger" link size="small" @click.stop="handleCancel(row)">取消</el-button>
            </template>
            <template v-else-if="row.status === 'active'">
              <el-button type="primary" link size="small" @click.stop="openEditDialog(row)">编辑</el-button>
              <el-button type="success" link size="small" @click.stop="openReturnDialog(row)">还车</el-button>
              <el-button type="warning" link size="small" @click.stop="openExtendDialog(row)">续租</el-button>
              <el-button type="info" link size="small" @click.stop="openPaymentDialog(row)">支付</el-button>
              <el-button type="danger" link size="small" @click.stop="handleCancel(row)">取消</el-button>
            </template>
            <template v-else-if="row.status === 'completed'">
              <el-button type="primary" link size="small" @click.stop="openPaymentDialog(row)">支付</el-button>
              <span class="text-muted">已结束</span>
            </template>
            <span v-else class="text-muted">已结束</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    </DataState>

    <el-pagination
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next"
      background
      class="pagination"
      @size-change="loadData"
      @current-change="loadData"
    />

    <!-- 新建订单对话框 -->
    <OrderFormDialog
      v-model:visible="dialogVisible"
      :order="null"
      :vehicles="vehicles"
      :order-sources="orderSources"
      :regular-customers="regularCustomers"
      :submitting="submitting"
      @dates-change="onCreateDatesChange"
      @submit="handleCreateSubmit"
      @preview="openPreview"
    />

    <!-- 编辑订单对话框 -->
    <OrderFormDialog
      v-model:visible="editDialogVisible"
      :order="currentEditOrder"
      :vehicles="vehicles"
      :order-sources="orderSources"
      :submitting="submitting"
      @dates-change="onEditDatesChange"
      @submit="handleUpdateSubmit"
      @preview="openPreview"
    />

    <!-- 取车对话框 -->
    <MileagePhotoDialog
      v-model:visible="pickupDialogVisible"
      type="pickup"
      :order="currentOrder"
      :submitting="submitting"
      @submit="handlePickupConfirm"
      @preview="openPreview"
    />

    <!-- 还车对话框 -->
    <MileagePhotoDialog
      v-model:visible="returnDialogVisible"
      type="return"
      :order="currentOrder"
      :default-mileage="currentOrder?.pickup_mileage || null"
      :submitting="submitting"
      @submit="handleReturnConfirm"
      @preview="openPreview"
    />

    <!-- 续租对话框 -->
    <ExtendDialog
      v-model:visible="extendDialogVisible"
      :order="currentOrder"
      :submitting="submitting"
      @submit="handleExtendConfirm"
    />

    <!-- 支付对话框 -->
    <PaymentDialog
      v-model:visible="paymentDialogVisible"
      :submitting="submitting"
      @submit="handlePaymentSubmit"
    />

    <!-- 图片预览 -->
    <ImagePreviewDialog
      v-model:visible="imagePreviewVisible"
      :images="previewImagesList"
      :index="previewIndex"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { orderApi, vehicleApi, customerApi } from '../api'
import { useDictStore } from '../stores/dict'
import DataState from '../components/DataState.vue'
import MobileFilterPanel from '../components/MobileFilterPanel.vue'
import AppDatePicker from '../components/AppDatePicker.vue'
import AppSelect from '../components/AppSelect.vue'
import ImagePreviewDialog from '../components/ImagePreviewDialog.vue'
import ExtendDialog from '../components/order/ExtendDialog.vue'
import MileagePhotoDialog from '../components/order/MileagePhotoDialog.vue'
import OrderFormDialog from '../components/order/OrderFormDialog.vue'
import PaymentDialog from '../components/order/PaymentDialog.vue'
import { useMobile } from '../composables/useMobile'
import { useQuerySync } from '../composables/useQuerySync'
import { formatDateTime, getOrderStatusType as getStatusType } from '../utils/helpers'
import { ORDER_SORT_OPTIONS, SETTLE_STATUS_OPTIONS, SETTLE_STATUS_TAG_MAP, SETTLE_STATUS_TEXT_MAP } from '../utils/constants'

const router = useRouter()
const route = useRoute()

function goImport(): void {
  void router.push('/orders/import')
}
const loading = ref(false)
// 加载失败时的提示文案，非空即由 DataState 展示错误态
const loadError = ref<string | null>(null)
const submitting = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const editDialogVisible = ref(false)
const pickupDialogVisible = ref(false)
const returnDialogVisible = ref(false)
const extendDialogVisible = ref(false)
const paymentDialogVisible = ref(false)
const vehicles = ref<any[]>([])
const filterOptions = reactive({ plateNumbers: [] as string[], models: [] as string[] })
// 订单来源走字典缓存：多个页面共用，避免每个页面各请求一次
const dictStore = useDictStore()
const orderSources = computed(() => dictStore.orderSources)
const regularCustomers = ref<any[]>([])
const imagePreviewVisible = ref(false)
const previewImagesList = ref<string[]>([])
const previewIndex = ref(0)
const currentOrder = ref<any>(null)
// 编辑表单以订单详情为准：证件号、证件照片这些列表行里没有
const currentEditOrder = ref<any>(null)

// 标签页
const activeTab = ref('pending')
const tabCounts = reactive({
  pending: 0,
  active: 0,
  completed: 0,
  cancelled: 0
})

// 时间筛选
const timeFilter = ref('')
const timeFilterCounts = reactive({
  overdue: 0,
  today: 0,
  tomorrow: 0,
  dayAfter: 0
})
// 前端用 dayAfter，后端参数用 day_after
const TIME_FILTER_PARAM: Record<string, string> = {
  overdue: 'overdue',
  today: 'today',
  tomorrow: 'tomorrow',
  dayAfter: 'day_after'
}

const { isMobile } = useMobile()
const searchForm = reactive({
  keyword: '',
  start_date_from: '',
  start_date_to: '',
  end_date_from: '',
  end_date_to: '',
  source_id: '',
  settle_status: '',
  vehicle_model: '',
  plate_number: '',
  order_by: ''
})
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

// 筛选与分页同步到 URL：刷新不丢、可分享。tab 单独处理（它不在 searchForm 里）
const { restore: restoreQuery, snapshot: snapshotQuery } = useQuerySync(searchForm, pagination, {
  defaultPageSize: 10
})
const ORDER_TABS = ['pending', 'active', 'completed', 'cancelled']

/** 挂载时从 URL 恢复筛选；没有 URL 参数时兼容旧的 sessionStorage 行为 */
function restoreFromUrl() {
  const tab = route.query.tab
  if (typeof tab === 'string' && ORDER_TABS.includes(tab)) {
    activeTab.value = tab
  } else {
    const saved = sessionStorage.getItem('orderListTab')
    if (saved && ORDER_TABS.includes(saved)) {
      activeTab.value = saved
    }
  }
  restoreQuery()
}

/** 把当前筛选、分页与 tab 写回 URL */
function syncToUrl() {
  const query: Record<string, string> = snapshotQuery()
  // pending 是默认 tab，不写进地址保持简洁
  if (activeTab.value !== 'pending') {
    query.tab = activeTab.value
  }
  if (JSON.stringify(query) === JSON.stringify(route.query)) return
  void router.replace({ query })
}

// 下拉选项（车牌号 / 车型由后端去重返回，不再拉全量车辆）
const plateNumberOptions = computed(() => {
  return filterOptions.plateNumbers.map(p => ({ label: p, value: p }))
})

const vehicleModelOptions = computed(() => {
  return filterOptions.models.map(m => ({ label: m, value: m }))
})

// AppSelect 的选项（桌面端 el-select 与移动端滚轮共用同一份数据）
const sourceOptions = computed(() => orderSources.value.map((s) => ({ label: s.name, value: s.id })))

// 日期范围（用于 el-date-picker）
const pickupDateRange = computed({
  get: () => searchForm.start_date_from && searchForm.start_date_to 
    ? [searchForm.start_date_from, searchForm.start_date_to] 
    : null,
  set: (val) => {
    if (val && val.length === 2) {
      searchForm.start_date_from = val[0]
      searchForm.start_date_to = val[1]
    } else {
      searchForm.start_date_from = ''
      searchForm.start_date_to = ''
    }
  }
})

const returnDateRange = computed({
  get: () => searchForm.end_date_from && searchForm.end_date_to 
    ? [searchForm.end_date_from, searchForm.end_date_to] 
    : null,
  set: (val) => {
    if (val && val.length === 2) {
      searchForm.end_date_from = val[0]
      searchForm.end_date_to = val[1]
    } else {
      searchForm.end_date_from = ''
      searchForm.end_date_to = ''
    }
  }
})

// 标签页切换
function onTabChange() {
  timeFilter.value = ''
  pagination.page = 1
  loadData()
  loadOrderSources()
}

// 加载各状态数量与时间筛选数量
// 后端一条聚合查询算完；此前是拉 pageSize=10000 的全表在前端 count，
// 被 queryWithPagination 的 100 条上限截断，订单超过 100 条计数就是错的。
async function loadTabCounts() {
  try {
    const res: any = await orderApi.getStats()
    if (res.success) {
      tabCounts.pending = res.data.pending
      tabCounts.active = res.data.active
      tabCounts.completed = res.data.completed
      tabCounts.cancelled = res.data.cancelled
      applyTimeFilterCounts(res.data.timeFilter)
    }
  } catch (error) {
    console.error('加载统计失败', error)
  }
}

// 时间筛选的计数按当前 tab 取（后端按 pending / active 分别算好）
function applyTimeFilterCounts(timeFilter: any) {
  const source = timeFilter?.[activeTab.value] ?? {}
  timeFilterCounts.overdue = source.overdue ?? 0
  timeFilterCounts.today = source.today ?? 0
  timeFilterCounts.tomorrow = source.tomorrow ?? 0
  timeFilterCounts.dayAfter = source.day_after ?? 0
}

async function loadData() {
  loading.value = true
  loadError.value = null
  // 所有筛选、分页、切 tab 最终都会走到这里，统一在此同步到 URL
  syncToUrl()
  try {
    const params: any = {
      status: activeTab.value,
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    
    // 添加筛选条件
    if (searchForm.keyword) params.keyword = searchForm.keyword
    if (searchForm.start_date_from) params.start_date_from = searchForm.start_date_from
    if (searchForm.start_date_to) params.start_date_to = searchForm.start_date_to
    if (searchForm.end_date_from) params.end_date_from = searchForm.end_date_from
    if (searchForm.end_date_to) params.end_date_to = searchForm.end_date_to
    if (searchForm.source_id) params.source_id = searchForm.source_id
    if (searchForm.settle_status) params.settle_status = searchForm.settle_status
    if (searchForm.vehicle_model) params.vehicle_model = searchForm.vehicle_model
    if (searchForm.plate_number) params.plate_number = searchForm.plate_number
    if (searchForm.order_by) params.order_by = searchForm.order_by
    // 时间快捷筛选下推到 SQL，本地不再拉全量做过滤
    if (timeFilter.value) params.time_filter = TIME_FILTER_PARAM[timeFilter.value]

    const res: any = await orderApi.getList(params)
    if (res.success) {
      tableData.value = res.data.data
      pagination.total = res.data.total
    } else {
      loadError.value = res.message || '加载失败，请重试'
    }
  } catch (error) {
    console.error('加载数据失败', error)
    // 原来只打 console，页面上是一张空表格，用户分不清「没有数据」与「加载失败」
    loadError.value = '加载失败，请检查网络后重试'
  } finally {
    loading.value = false
  }
}

// 重置搜索
function resetSearch() {
  searchForm.keyword = ''
  searchForm.start_date_from = ''
  searchForm.start_date_to = ''
  searchForm.end_date_from = ''
  searchForm.end_date_to = ''
  searchForm.source_id = ''
  searchForm.vehicle_model = ''
  searchForm.plate_number = ''
  searchForm.order_by = ''
  timeFilter.value = ''
  loadData()
}

// 切换时间筛选（点击已选中的按钮取消筛选）
function toggleTimeFilter(filter: string) {
  if (timeFilter.value === filter) {
    // 点击已选中的按钮，取消筛选
    timeFilter.value = ''
  } else {
    timeFilter.value = filter
  }
  applyTimeFilter()
}

// 时间筛选下推到后端查询，这里只需要重置到第一页重新拉数据
function applyTimeFilter() {
  pagination.page = 1
  loadData()
}

async function loadVehicles(startDate?: string, endDate?: string, excludeOrderId?: string) {
  try {
    const params: any = {}
    if (startDate && endDate) {
      params.start_date = startDate
      params.end_date = endDate
    }
    if (excludeOrderId) {
      params.exclude_order_id = excludeOrderId
    }
    const res: any = await vehicleApi.getAvailable(params)
    if (res.success) {
      vehicles.value = res.data
    }
  } catch (error) {
    console.error('加载车辆失败', error)
  }
}

// 加载所有车辆（用于筛选下拉框）
// 加载筛选下拉选项（后端去重，避免拉全量车辆被分页上限截断）
async function loadFilterOptions() {
  try {
    const res: any = await vehicleApi.getFilterOptions()
    if (res.success) {
      filterOptions.plateNumbers = res.data.plateNumbers || []
      filterOptions.models = res.data.models || []
    }
  } catch (error) {
    console.error('加载筛选项失败', error)
  }
}

async function loadOrderSources() {
  await dictStore.ensureOrderSources()
}

async function loadRegularCustomers() {
  try {
    const res: any = await customerApi.getRegular()
    if (res.success) {
      regularCustomers.value = res.data || []
    }
  } catch (error) {
    console.error('加载常用客户失败', error)
  }
}

// 子组件只负责告诉父组件「预览哪一组、第几张」
function openPreview(images: string[], index: number) {
  previewImagesList.value = images
  previewIndex.value = index
  imagePreviewVisible.value = true
}

function openDialog() {
  loadOrderSources()
  loadRegularCustomers()
  dialogVisible.value = true
}

// 新建表单初始化与取还时间变动时，都要重新拉该时间段的可用车辆
function onCreateDatesChange(startDate: string, endDate: string) {
  loadVehicles(startDate, endDate)
}

// 黑名单软拦截：后端返回 code=BLACKLISTED，二次确认后可带 force 强制下单（会留痕）
async function handleCreateSubmit(payload: Record<string, unknown>) {
  submitting.value = true
  try {
    const res: any = await orderApi.create(payload)
    if (res.success) {
      ElMessage.success('订单创建成功')
      dialogVisible.value = false
      loadData()
      loadTabCounts()
    }
  } catch (error: any) {
    if (error?.response?.data?.code === 'BLACKLISTED') {
      const record = error.response.data.data?.record ?? {}
      const confirmed = await confirmBlacklistedOrder(record)
      if (confirmed) {
        await submitWithForce(payload)
      }
      return
    }
    console.error('创建失败', error)
  } finally {
    submitting.value = false
  }
}

/** 黑名单风险二次确认，用户点「仍然下单」才返回 true */
async function confirmBlacklistedOrder(record: any): Promise<boolean> {
  const lines = [
    `客户「${record.name ?? '未知'}」在黑名单中。`,
    `原因：${record.reason ?? '未填写'}`,
    record.created_at ? `拉黑时间：${formatDateTime(record.created_at)}` : '',
    record.operator_name ? `操作人：${record.operator_name}` : '',
    '',
    '确认要继续为该客户下单吗？此操作会记入操作日志。'
  ].filter((line) => line !== '')

  try {
    await ElMessageBox.confirm(lines.join('\n'), '风险提示', {
      confirmButtonText: '仍然下单',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'pre-line-message'
    })
    return true
  } catch {
    return false
  }
}

async function submitWithForce(payload: Record<string, unknown>) {
  try {
    const res: any = await orderApi.create({ ...payload, force: true })
    if (res.success) {
      ElMessage.success('订单创建成功（黑名单客户，已记入日志）')
      dialogVisible.value = false
      loadData()
      loadTabCounts()
    }
  } catch (error) {
    console.error('黑名单强制下单失败', error)
  }
}

function handleRowClick(row: any) {
  // 保存当前标签页状态
  sessionStorage.setItem('orderListTab', activeTab.value)
  router.push(`/orders/${row.id}`)
}

// 跳转到订单详情
function goToDetail(item: any) {
  // 保存当前标签页状态
  sessionStorage.setItem('orderListTab', activeTab.value)
  router.push(`/orders/${item.id}`)
}

// 打开编辑对话框
async function openEditDialog(row: any) {
  currentOrder.value = row
  await loadOrderSources()
  // 详情里的字段比列表行完整（证件号、证件照片等），表单以它为准
  const detailRes: any = await orderApi.getOne(row.id)
  currentEditOrder.value = detailRes.success ? detailRes.data : row
  editDialogVisible.value = true
}

// 编辑表单取还时间变动：重新拉可用车辆，排除本单自身占用的车辆
function onEditDatesChange(startDate: string, endDate: string) {
  loadVehicles(startDate, endDate, currentOrder.value?.id)
}

// 提交编辑
async function handleUpdateSubmit(payload: Record<string, unknown>) {
  submitting.value = true
  try {
    const res: any = await orderApi.update(currentOrder.value.id, payload)
    if (res.success) {
      ElMessage.success('订单修改成功')
      editDialogVisible.value = false
      loadData()
    }
  } catch (error) {
    console.error('修改失败', error)
  } finally {
    submitting.value = false
  }
}

// 打开取车对话框
function openPickupDialog(row: any) {
  currentOrder.value = row
  pickupDialogVisible.value = true
}

// 确认取车
async function handlePickupConfirm(payload: { mileage: number | undefined; image: string; datetime: string; remarks: string }) {
  submitting.value = true
  try {
    const data: any = {
      status: 'active',
      pickup_mileage: payload.mileage,
      pickup_image: payload.image || undefined
    }
    if (payload.datetime) {
      // 后端字段名是 actual_start_date；此前误传 actual_pickup_date，导致取车时间从未落库
      data.actual_start_date = payload.datetime.replace('T', ' ') + ':00'
    }
    if (payload.remarks) {
      data.remarks = payload.remarks
    }
    
    const res: any = await orderApi.updateStatus(currentOrder.value.id, data)
    if (res.success) {
      ElMessage.success('取车成功')
      pickupDialogVisible.value = false
      loadData()
      loadTabCounts()
    }
  } catch (error) {
    console.error('取车失败', error)
  } finally {
    submitting.value = false
  }
}

// 打开还车对话框
function openReturnDialog(row: any) {
  currentOrder.value = row
  returnDialogVisible.value = true
}

// 确认还车
async function handleReturnConfirm(payload: { mileage: number | undefined; image: string; datetime: string; remarks: string }) {
  submitting.value = true
  try {
    const res: any = await orderApi.updateStatus(currentOrder.value.id, {
      status: 'completed',
      actual_end_date: payload.datetime,
      remarks: payload.remarks || undefined,
      return_mileage: payload.mileage,
      return_image: payload.image || undefined
    })
    if (res.success) {
      ElMessage.success('还车成功')
      returnDialogVisible.value = false
      loadData()
      loadTabCounts()
    }
  } catch (error) {
    console.error('还车失败', error)
  } finally {
    submitting.value = false
  }
}

// 打开续租对话框
function openExtendDialog(row: any) {
  currentOrder.value = row
  extendDialogVisible.value = true
}

// 确认续租
async function handleExtendConfirm(payload: {
  new_end_date: string
  extend_amount: number
  has_payment: boolean
  payment_amount?: number
  payment_method?: string
}) {
  submitting.value = true
  try {
    const res: any = await orderApi.extend(currentOrder.value.id, payload)
    if (res.success) {
      ElMessage.success(`续租成功，续租金额 ¥${res.data.extend_amount}`)
      extendDialogVisible.value = false
      loadData()
    }
  } catch (error) {
    console.error('续租失败', error)
  } finally {
    submitting.value = false
  }
}

// 打开支付对话框
function openPaymentDialog(row: any) {
  currentOrder.value = row
  paymentDialogVisible.value = true
}

// 添加支付
async function handlePaymentSubmit(payload: { amount: number; payment_method: string; payment_type: string; remarks: string }) {
  submitting.value = true
  try {
    const res: any = await orderApi.addPayment(currentOrder.value.id, payload)
    if (res.success) {
      ElMessage.success('支付添加成功')
      paymentDialogVisible.value = false
      loadData()
    }
  } catch (error) {
    console.error('添加支付失败', error)
  } finally {
    submitting.value = false
  }
}

// 取消订单
async function handleCancel(row: any) {
  try {
    await ElMessageBox.confirm('确定要取消该订单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const res: any = await orderApi.cancel(row.id)
    if (res.success) {
      ElMessage.success('订单已取消')
      loadData()
      loadTabCounts()
    }
  } catch (error) {
    // 取消
  }
}

onMounted(() => {
  // 检查是否从客户管理跳转过来查看订单
  if (route.query.customer_id) {
    searchForm.keyword = route.query.customer_name as string || ''
  }
  // 恢复 URL 里的筛选与 tab（没有则回退到 sessionStorage）
  restoreFromUrl()
  loadData()
  loadTabCounts()
  loadOrderSources()
  loadFilterOptions()
})
</script>

<style scoped>
/* 容器不设 max-width：与财务页一致，铺满主内容区（约定见 style.css 的 .page-container） */
.order-tabs {
  margin-bottom: 12px;
}

.order-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.order-tabs :deep(.el-badge__content) {
  transform: scale(0.8);
}

.filter-btn {
  display: inline-block;
  flex-shrink: 0;
  margin-right: 6px;
  /* 行距原先由 .time-filter-bar 容器给（已删除），挪到按钮自己身上 */
  margin-bottom: 8px;
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  outline: none;
  font-family: inherit;
}

.filter-btn.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}

.filter-btn:active {
  opacity: 0.8;
}

.filter-count {
  font-size: 12px;
  opacity: 0.8;
}

.filter-btn.active .filter-count {
  opacity: 1;
}

.filter-count.has-overdue {
  color: #f56c6c;
  font-weight: 600;
}

.filter-count {
  font-size: 12px;
  opacity: 0.8;
}

.search-card {
  margin-bottom: 12px;
}

.search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px;
}

.search-form .el-form-item {
  margin-bottom: 0;
}

/* PC端筛选框宽度 */
@media (min-width: 768px) {
  .search-form .el-form-item:nth-child(3),  /* 订单来源 */
  .search-form .el-form-item:nth-child(6)   /* 排序 */
  {
    min-width: 150px;
  }
}

/* 移动端样式 */
@media (max-width: 767px) {
  /* 表单项的移动端外观（56px cell、label 左、值左、去盒子的输入框、日期区间两端等分）
     和按钮行（搜索 / 重置 各占一半、间距 16px）都由 style.css 的「Mobile WeUI Form」
     统一提供；时间筛选的四个胶囊按钮是 .page-container 的直接子级（原来那层白底容器已删，
     间距落在 .filter-btn 自己身上） */
  .filter-btn {
    margin-bottom: 12px;
  }
}

/* PC 端样式 */
@media (min-width: 768px) {
  .search-form {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
  }

  .search-form .el-form-item {
    margin-bottom: 0;
  }

  .search-form .el-form-item:not(.form-actions) {
    flex: 0 0 auto;
  }

  .date-range-picker {
    width: 200px;
  }

  .form-actions {
    margin-left: auto;
  }

  .form-actions .el-button + .el-button {
    margin-left: 8px;
  }
}

.action-bar {
  margin-bottom: 12px;
}

/* 整张卡片可点（进订单详情）。触屏用不到，窄窗口的桌面浏览器会用到 */
.mobile-card {
  cursor: pointer;
}

/* 点按反馈挂在整卡上：这张卡片整块都是点击区，点 header 或金额行也该有反馈。
   用 --m-active（WeUI 的点击态 #ececec），深色下由 token 自动切换，不用再写 html.dark */
.mobile-card:active {
  background-color: var(--m-active);
}

.header-tags {
  display: flex;
  align-items: center;
  gap: 6px;
}

.order-no {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.mobile-card-row a {
  color: var(--primary-color);
  text-decoration: none;
  margin-left: 8px;
}

.amount {
  font-weight: 600;
  color: #303133;
}

.paid {
  color: var(--sk-color-success);
}

.text-warning {
  color: var(--sk-color-warning);
}

.text-muted {
  color: var(--sk-color-info);
}

.hide-mobile {
  display: none;
}

.table-card {
  display: none;
}

@media (min-width: 768px) {
  .mobile-cards {
    display: none;
  }
  
  .table-card {
    display: block;
    width: 100%;
  }

  .table-card :deep(.el-card__body) {
    padding: 0;
  }
  
  .hide-mobile {
    display: table;
    width: 100%;
  }
  
  :deep(.el-table__row) {
    cursor: pointer;
  }
}

/* 来源标签 */
.source-tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: #fff;
  margin-left: 6px;
  vertical-align: middle;
}

/* 搜索卡片样式 - 优化折叠高度 */
.search-card {
  margin-bottom: 12px;
}

.search-card :deep(.el-card__body) {
  padding: 0;
}

@media (max-width: 767px) {
  .filter-count.has-overdue,
  html.dark .filter-count.has-overdue {
    color: var(--sk-color-danger);
  }
}

/* 暗色模式样式 */
html.dark .filter-btn {
  border-color: var(--border-color);
  background: var(--bg-color-secondary);
  color: var(--text-color-secondary);
}

html.dark .filter-btn.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}

html.dark .filter-count.has-overdue {
  color: #f56c6c;
}

html.dark .order-no {
  color: var(--text-color);
}

html.dark .amount {
  color: var(--text-color);
}

html.dark .text-muted {
  color: var(--text-color-secondary);
}
</style>
