<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <StatCards :stats="stats" />

    <!-- 库存日历区域 -->
    <el-card class="section-card gantt-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span><el-icon><Calendar /></el-icon> 库存日历</span>
          <div class="header-actions">
            <el-button type="primary" link @click="ganttDialogVisible = true">
              <el-icon><FullScreen /></el-icon> 完整视图
            </el-button>
          </div>
        </div>
      </template>
      <GanttChart
        ref="ganttRef"
        :data="ganttData"
        :view-mode="viewMode"
        @order-click="showOrderDetail"
        @vehicle-click="showVehicleDetail"
      />
    </el-card>

    <!-- 调度表格区域 -->
    <el-row :gutter="20" class="schedule-section">
      <!-- 左侧：调度表格 -->
      <el-col :xs="24" :sm="12">
        <el-card class="section-card schedule-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span><el-icon><Calendar /></el-icon> 待收送</span>
              <div class="header-actions">
                <el-button type="primary" link @click="scheduleDialogVisible = true">
                  <el-icon><FullScreen /></el-icon> 完整视图
                </el-button>
                <el-button type="primary" link @click="shareSchedule" :loading="shareLoading">
                  <el-icon><Download /></el-icon> 下载
                </el-button>
              </div>
            </div>
          </template>

          <!-- 调度表格（移动端和 PC 端都用表格） -->
          <ScheduleTable :schedules="schedules" @row-click="showScheduleOrderDetail" />
        </el-card>
      </el-col>

      <!-- 右侧：占位容器（PC 端显示） -->
      <el-col :xs="0" :sm="12">
        <el-card class="section-card placeholder-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span><el-icon><Grid /></el-icon> 快捷操作</span>
            </div>
          </template>
          <div class="placeholder-content">
            <p>待开发功能区域</p>
            <p class="placeholder-hint">可添加常用快捷操作入口</p>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最近订单 -->
    <el-card class="section-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span><el-icon><Clock /></el-icon> 最近订单</span>
          <el-button type="primary" link @click="$router.push('/orders')">查看全部</el-button>
        </div>
      </template>

      <!-- 移动端卡片 -->
      <div class="mobile-cards" v-if="stats.recentOrders?.length">
        <div v-for="item in stats.recentOrders" :key="item.order_no" class="mobile-card" @click="$router.push('/orders')">
          <div class="mobile-card-header">
            <span v-if="item.source_name" class="source-tag" :style="{ background: item.source_color || '#0071e3' }">{{ item.source_name }}</span>
            <span v-else class="text-muted">-</span>
            <el-tag :type="getStatusType(item.status)" size="small">{{ getStatusText(item.status) }}</el-tag>
          </div>
          <div class="mobile-card-row">
            <span class="label">客户</span>
            <span class="value">{{ item.customer_name }}</span>
          </div>
          <div class="mobile-card-row">
            <span class="label">车牌</span>
            <span class="value"><span class="plate-number" :class="item.is_new_energy ? 'new-energy' : 'fuel'">{{ item.plate_number }}</span></span>
          </div>
          <div class="mobile-card-row">
            <span class="label">金额</span>
            <span class="value text-primary">¥{{ item.total_amount }}</span>
          </div>
          <div class="mobile-card-row">
            <span class="label">时间</span>
            <span class="value">{{ formatDate(item.created_at) }}</span>
          </div>
        </div>
      </div>

      <!-- PC 端表格 -->
      <el-table :data="stats.recentOrders" stripe size="small" class="hide-mobile">
        <el-table-column label="来源" width="100">
          <template #default="{ row }">
            <span v-if="row.source_name" class="source-tag" :style="{ background: row.source_color || '#0071e3' }">{{ row.source_name }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户" />
        <el-table-column prop="plate_number" label="车牌" width="120">
          <template #default="{ row }">
            <span class="plate-number" :class="row.is_new_energy ? 'new-energy' : 'fuel'">{{ row.plate_number }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="total_amount" label="金额" width="100">
          <template #default="{ row }">¥{{ row.total_amount }}</template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 调度完整视图对话框 -->
    <el-dialog v-model="scheduleDialogVisible" title="待收送 - 完整视图" width="90%" :style="{ maxWidth: '600px' }">
      <ScheduleTable :schedules="schedules" full-view @row-click="showScheduleOrderDetail" />
    </el-dialog>

    <!-- 甘特图完整视图对话框 -->
    <el-dialog v-model="ganttDialogVisible" title="库存日历 - 完整视图" width="95%" :style="{ maxWidth: '1400px' }">
      <template #header>
        <div class="card-header">
          <span>库存日历 - 完整视图</span>
        </div>
      </template>
      <GanttChart
        :data="ganttData"
        :view-mode="viewMode"
        full-view
        @order-click="showOrderDetail"
        @vehicle-click="showVehicleDetail"
      />
    </el-dialog>

    <!-- 订单详情对话框 -->
    <OrderDetailDialog
      v-model:visible="orderDetailVisible"
      :order="selectedOrder"
      @edit="editOrder"
      @pickup="showPickupDialog"
      @complete="showCompleteDialog"
      @detail="goToOrderFromGantt"
    />

    <!-- 取车对话框 -->
    <MileagePhotoDialog
      v-model:visible="pickupDialogVisible"
      type="pickup"
      :order="selectedOrder"
      :submitting="submitting"
      upload-type="vehicle"
      @submit="handlePickupConfirm"
    />

    <!-- 还车对话框 -->
    <MileagePhotoDialog
      v-model:visible="completeDialogVisible"
      type="return"
      :order="selectedOrder"
      :submitting="submitting"
      title="完成订单"
      confirm-text="确定完成"
      time-label="实际还车时间"
      upload-type="vehicle"
      @submit="handleCompleteConfirm"
    />

    <!-- 车辆详情对话框 -->
    <VehicleDetailDialog v-model:visible="vehicleDialogVisible" :vehicle="vehicleData" @edit="goToVehicleDetail" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi, scheduleApi, orderApi } from '../api'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { Calendar, Clock, Download, FullScreen, Grid } from '@element-plus/icons-vue'
import VehicleDetailDialog from '../components/VehicleDetailDialog.vue'
import StatCards from '../components/dashboard/StatCards.vue'
import GanttChart from '../components/dashboard/GanttChart.vue'
import ScheduleTable from '../components/dashboard/ScheduleTable.vue'
import OrderDetailDialog from '../components/dashboard/OrderDetailDialog.vue'
import MileagePhotoDialog from '../components/order/MileagePhotoDialog.vue'

const router = useRouter()

const stats = ref<any>({
  vehicles: {},
  orders: {},
  customerCount: 0,
  monthIncome: 0,
  recentOrders: [],
  expiringOrders: []
})

// 车辆详情对话框状态
const vehicleDialogVisible = ref(false)
const vehicleData = ref<any>({})

// 跳转到车辆详情页
function goToVehicleDetail() {
  if (vehicleData.value.id) {
    router.push(`/vehicles?tab=vehicles&id=${vehicleData.value.id}`)
    vehicleDialogVisible.value = false
  }
}

const schedules = ref<any[]>([])
const scheduleDialogVisible = ref(false)
const shareLoading = ref(false)

// 甘特图相关数据
const ganttRef = ref<InstanceType<typeof GanttChart> | null>(null)
const ganttData = ref<Record<string, any[]>>({})
const ganttDialogVisible = ref(false)
const viewMode = ref('60') // 默认 60 天
const selectedOrder = ref<any>(null)
const orderDetailVisible = ref(false)

// 取车/还车对话框
const pickupDialogVisible = ref(false)
const completeDialogVisible = ref(false)
const submitting = ref(false)

const statusMap: Record<string, { text: string; type: string }> = {
  pending: { text: '待取车', type: 'warning' },
  active: { text: '已取车', type: 'primary' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'info' },
  overdue: { text: '已逾期', type: 'danger' }
}

function getStatusText(status: string) {
  return statusMap[status]?.text || status
}

function getStatusType(status: string) {
  return statusMap[status]?.type || 'info'
}

function formatDate(date: string) {
  return dayjs(date).format('MM-DD HH:mm')
}

async function loadSchedules() {
  try {
    const res: any = await scheduleApi.getRecent()
    if (res.success) {
      schedules.value = res.data
    }
  } catch (error) {
    console.error('获取调度数据失败', error)
  }
}

// 加载甘特图数据
async function loadGanttData() {
  try {
    const res: any = await scheduleApi.getGantt()
    if (res.success) {
      ganttData.value = res.data
    }
  } catch (error) {
    console.error('获取甘特图数据失败', error)
  }
}

// 显示订单详情
function showOrderDetail(order: any) {
  selectedOrder.value = order
  orderDetailVisible.value = true
}

// 从甘特图跳转到订单
function goToOrderFromGantt() {
  if (selectedOrder.value) {
    router.push(`/orders/${selectedOrder.value.id}`)
    orderDetailVisible.value = false
  }
}

// 显示车辆详情
function showVehicleDetail(plateNumber: string) {
  // 从甘特图数据中查找该车辆的所有订单
  const orders = ganttData.value[plateNumber]
  if (!orders || !orders.length) {
    ElMessage.warning('未找到车辆信息')
    return
  }

  // 使用第一个订单中的车辆数据（所有订单共享同一辆车）
  const order = orders[0]
  vehicleData.value = {
    id: order.vehicle_id || '',
    plate_number: order.plate_number,
    brand: order.brand,
    model: order.model,
    color: order.color || '-',
    year: order.year || '-',
    seats: order.seats || '-',
    mileage: order.mileage || 0,
    daily_rate: order.daily_rate || 0,
    deposit: order.deposit || 0,
    vin: order.vin || '-',
    engine_number: order.engine_number || '-',
    is_new_energy: order.is_new_energy,
    status: order.vehicle_status || 'available',
    license_images: order.license_images || [],
    registration_image: order.registration_image || '',
    remarks: order.remarks || '-'
  }

  vehicleDialogVisible.value = true
}

// 显示调度订单详情
async function showScheduleOrderDetail(orderId: string) {
  try {
    const res: any = await orderApi.getOne(orderId)
    if (res.success && res.data) {
      const order = res.data
      // 将订单数据转换为弹窗需要的格式
      selectedOrder.value = {
        id: order.id,
        order_no: order.order_no,
        startDateTime: order.start_date,
        endDateTime: order.end_date,
        status: order.status,
        plate_number: order.plate_number,
        brand: order.brand,
        model: order.model,
        platform: order.source_name || '线下',
        platform_color: order.source_color,
        source_name: order.source_name,
        source_color: order.source_color,
        name: order.customer_name,
        phone: order.customer_phone,
        pickLocation: order.pickup_location,
        returnLocation: order.return_location,
        rmb: order.total_amount,
        is_new_energy: order.is_new_energy
      }
      orderDetailVisible.value = true
    }
  } catch (error) {
    console.error('获取订单详情失败', error)
  }
}

// 编辑订单
function editOrder() {
  if (selectedOrder.value) {
    // 跳转到订单详情页，并传递 edit 参数
    router.push(`/orders/${selectedOrder.value.id}?edit=1`)
    orderDetailVisible.value = false
  }
}

// 显示取车对话框（表单初值由 MileagePhotoDialog 在每次打开时自行重置）
function showPickupDialog() {
  pickupDialogVisible.value = true
}

// 显示还车对话框
function showCompleteDialog() {
  completeDialogVisible.value = true
}

// 处理取车
async function handlePickupConfirm(payload: { mileage: number | undefined; image: string; datetime: string; remarks: string }) {
  if (!selectedOrder.value) return

  try {
    submitting.value = true
    const data: any = {}
    if (payload.mileage !== undefined && payload.mileage > 0) {
      data.pickup_mileage = payload.mileage
    }
    if (payload.image) {
      data.pickup_image = payload.image
    }
    if (payload.datetime) {
      // 后端字段名是 actual_start_date；此前误传 actual_pickup_date，导致取车时间从未落库
      data.actual_start_date = payload.datetime.replace('T', ' ') + ':00'
    }
    if (payload.remarks) {
      data.remarks = payload.remarks
    }

    const res: any = await orderApi.updateStatus(selectedOrder.value.id, { 
      status: 'active',
      ...data
    })

    if (res.success) {
      ElMessage.success('取车成功')
      pickupDialogVisible.value = false
      orderDetailVisible.value = false
      // 刷新数据
      loadSchedules()
      loadGanttData()
    }
  } catch (error) {
    console.error('取车失败', error)
    ElMessage.error('取车失败，请重试')
  } finally {
    submitting.value = false
  }
}

// 处理还车
async function handleCompleteConfirm(payload: { mileage: number | undefined; image: string; datetime: string; remarks: string }) {
  if (!selectedOrder.value) return

  try {
    submitting.value = true
    const data: any = {}
    if (payload.mileage !== undefined && payload.mileage > 0) {
      data.return_mileage = payload.mileage
    }
    if (payload.image) {
      data.return_image = payload.image
    }
    if (payload.datetime) {
      data.actual_end_date = payload.datetime
    }
    if (payload.remarks) {
      data.remarks = payload.remarks
    }

    const res: any = await orderApi.updateStatus(selectedOrder.value.id, { 
      status: 'completed',
      ...data
    })

    if (res.success) {
      ElMessage.success('还车成功')
      completeDialogVisible.value = false
      orderDetailVisible.value = false
      // 刷新数据
      loadSchedules()
      loadGanttData()
    }
  } catch (error) {
    console.error('还车失败', error)
    ElMessage.error('还车失败，请重试')
  } finally {
    submitting.value = false
  }
}

async function shareSchedule() {
  try {
    shareLoading.value = true

    // 动态导入 html2canvas
    const html2canvas = (await import('html2canvas')).default

    // 获取表格元素（取页面卡片里的那份，避免命中完整视图对话框里的副本）
    const tableElement = document.querySelector('.schedule-section .schedule-table') as HTMLElement
    if (!tableElement) {
      throw new Error('找不到表格元素')
    }

    // 创建 canvas
    const canvas = await html2canvas(tableElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true
    })

    // 转换为图片
    const imageData = canvas.toDataURL('image/png')

    // 创建下载链接
    const link = document.createElement('a')
    link.download = `待收送_${dayjs().format('YYYY-MM-DD_HH-mm')}.png`
    link.href = imageData
    link.click()

  } catch (error) {
    console.error('分享失败:', error)
    if (error instanceof Error && error.message.includes('html2canvas')) {
      alert('需要安装 html2canvas 库：npm install html2canvas')
    } else {
      alert('分享失败，请重试')
    }
  } finally {
    shareLoading.value = false
  }
}

onMounted(async () => {
  try {
    const res: any = await dashboardApi.getStats()
    if (res.success) {
      stats.value = res.data
    }
  } catch (error) {
    console.error('获取统计数据失败', error)
  }

  loadSchedules()

  // 加载甘特图数据
  await loadGanttData()

  // 等待 DOM 更新后，将甘特图滚动到当天日期
  await nextTick()
  ganttRef.value?.scrollToToday()
})
</script>

<style scoped>
/* 容器不设 max-width：与财务页一致，铺满主内容区（约定见 style.css 的 .page-container） */
.section-card {
  margin-bottom: 12px;
}

@media (min-width: 768px) {
  .section-card {
    margin-bottom: 20px;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-header span {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* 调度表格样式 */
.schedule-section {
  margin-bottom: 12px;
}

@media (min-width: 768px) {
  .schedule-section {
    margin-bottom: 20px;
  }
}

.schedule-card {
  padding: 0 !important;
  margin-bottom: 0 !important;
  height: 400px;
  display: flex;
  flex-direction: column;
}

.schedule-card :deep(.el-card__body) {
  padding: 0 !important;
  flex: 1;
  overflow: auto;
}

/* 占位容器样式 */
.placeholder-card {
  height: 400px;
}

.placeholder-content {
  padding: 40px 20px;
  text-align: center;
  color: var(--sk-color-info);
}

.placeholder-content p {
  margin: 10px 0;
  font-size: 14px;
}

.placeholder-hint {
  font-size: 12px;
  color: #c0c4cc;
}

/* 移动端卡片样式 */
.mobile-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mobile-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.mobile-card:hover {
  background: #f0f0f0;
}

.mobile-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.mobile-card-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}

.mobile-card-row .label {
  color: var(--sk-color-info);
}

.mobile-card-row .value {
  color: #303133;
}

.text-primary {
  color: var(--primary-color);
  font-weight: 500;
}

.text-warning {
  color: var(--sk-color-warning);
  font-weight: 500;
}

.text-muted {
  color: var(--sk-color-info);
}

/* PC 端隐藏表格 */
.hide-mobile {
  display: none;
}

@media (min-width: 768px) {
  .mobile-cards {
    display: none;
  }

  .hide-mobile {
    display: table;
  }
}

/* 甘特图样式 */
.gantt-card {
  padding: 0 !important;
}

.gantt-card :deep(.el-card__body) {
  padding: 0 !important;
}

/* 来源标签 */
.source-tag {
  color: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}

/* 暗色模式 */
html.dark .placeholder-content,
html.dark .placeholder-hint {
  color: var(--text-color-secondary);
}

html.dark .calendar-day-cell {
  border-color: var(--border-color);
}

html.dark .calendar-day-header {
  border-color: var(--border-color);
}

html.dark .order-card {
  background: var(--bg-color-secondary);
  border-color: var(--border-color);
}

html.dark .order-info {
  color: var(--text-color);
}

html.dark .order-label {
  color: var(--text-color-secondary);
}

html.dark .plate-number {
  color: var(--text-color);
}

/* 移动端卡片暗色模式 */
html.dark .mobile-card {
  background: var(--bg-color-secondary);
}

html.dark .mobile-card:hover {
  background: var(--hover-bg-color);
}

html.dark .mobile-card-header {
  border-bottom-color: var(--border-color);
}

html.dark .mobile-card-row .label {
  color: var(--text-color-secondary);
}

html.dark .mobile-card-row .value {
  color: var(--text-color);
}
</style>
