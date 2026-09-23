<template>
  <div class="dashboard">
    <!-- 库存日历区域 -->
    <el-card class="section-card gantt-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span><el-icon><Calendar /></el-icon> 库存日历</span>
          <div class="header-actions">
            <el-button type="primary" link @click="backToToday">
              <el-icon><RefreshLeft /></el-icon> 回到今天
            </el-button>
            <el-button type="primary" link @click="ganttDialogVisible = true">
              <el-icon><FullScreen /></el-icon> 完整视图
            </el-button>
          </div>
        </div>
      </template>
      <GanttChart
        ref="ganttRef"
        :vehicles="ganttData.vehicles"
        :orders="ganttData.orders"
        :start-date="windowStart"
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

    <!-- 调度完整视图对话框 -->
    <el-dialog v-model="scheduleDialogVisible" title="待收送 - 完整视图" width="90%" :style="{ maxWidth: '600px' }">
      <ScheduleTable :schedules="schedules" full-view @row-click="showScheduleOrderDetail" />
    </el-dialog>

    <!-- 甘特图完整视图对话框 -->
    <el-dialog v-model="ganttDialogVisible" title="库存日历 - 完整视图" width="95%" :style="{ maxWidth: '1400px' }">
      <template #header>
        <div class="card-header dialog-header">
          <span class="dialog-title">库存日历 - 完整视图</span>
          <div class="header-actions">
            <AppDatePicker
              v-model="centerDate"
              type="date"
              size="small"
              placeholder="选择日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              :clearable="false"
              class="window-picker"
            />
            <el-button type="primary" link @click="backToToday">
              <el-icon><RefreshLeft /></el-icon> 回到今天
            </el-button>
          </div>
        </div>
      </template>
      <GanttChart
        ref="ganttDialogRef"
        :vehicles="ganttData.vehicles"
        :orders="ganttData.orders"
        :start-date="windowStart"
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
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { scheduleApi, orderApi } from '../api'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { Calendar, Download, FullScreen, Grid, RefreshLeft } from '@element-plus/icons-vue'
import VehicleDetailDialog from '../components/VehicleDetailDialog.vue'
import AppDatePicker from '../components/AppDatePicker.vue'
import GanttChart from '../components/dashboard/GanttChart.vue'
import ScheduleTable from '../components/dashboard/ScheduleTable.vue'
import OrderDetailDialog from '../components/dashboard/OrderDetailDialog.vue'
import MileagePhotoDialog from '../components/order/MileagePhotoDialog.vue'

const router = useRouter()

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
const ganttDialogRef = ref<InstanceType<typeof GanttChart> | null>(null)
const ganttData = ref<{ vehicles: any[]; orders: Record<string, any[]> }>({ vehicles: [], orders: {} })
const ganttDialogVisible = ref(false)
const selectedOrder = ref<any>(null)
const orderDetailVisible = ref(false)

// 库存日历窗口：以「中心日」往前 30 天、往后 60 天（共 91 天）。
// 日期选择器选的是中心日，默认中心就是今天 —— 用来翻看别的档期。
const WINDOW_DAYS = 91
const PAST_DAYS = 30
const anchorDate = ref('')

// 窗口中心日（日期选择器绑这个值）
const centerDate = computed({
  get: () => anchorDate.value || dayjs().format('YYYY-MM-DD'),
  set: (value: string) => {
    if (!value || value === centerDate.value) return
    applyWindow(value)
  }
})

// 窗口首日 = 中心日往前 30 天
const windowStart = computed(() => dayjs(centerDate.value).subtract(PAST_DAYS, 'day').format('YYYY-MM-DD'))

// 切换窗口（传中心日，不传则回到今天）：重新拉数据，并把两处日历都定位到今天
// （今天不在窗口内时，组件会定位到窗口首日）
async function applyWindow(center?: string) {
  anchorDate.value = center ? dayjs(center).format('YYYY-MM-DD') : ''
  await loadGanttData()
  await nextTick()
  ganttRef.value?.scrollToToday()
  ganttDialogRef.value?.scrollToToday()
}

// 回到默认窗口（以今天为基准）
function backToToday() {
  applyWindow()
}

// 打开完整视图时定位到今天，否则默认停在窗口首日（可能是 30 天前）
watch(ganttDialogVisible, async (visible) => {
  if (!visible) return
  await nextTick()
  ganttDialogRef.value?.scrollToToday()
})

// 取车/还车对话框
const pickupDialogVisible = ref(false)
const completeDialogVisible = ref(false)
const submitting = ref(false)

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

// 加载甘特图数据（窗口随 windowStart 走，换档期要重新拉）
async function loadGanttData() {
  try {
    const start = windowStart.value
    const end = dayjs(start).add(WINDOW_DAYS - 1, 'day').format('YYYY-MM-DD')
    const res: any = await scheduleApi.getGantt({ start_date: start, end_date: end })
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

// 显示车辆详情（车牌来自车辆表本身，窗口内没有订单也能打开）
function showVehicleDetail(plateNumber: string) {
  const vehicle = ganttData.value.vehicles.find(v => v.plate_number === plateNumber)
  if (!vehicle) {
    ElMessage.warning('未找到车辆信息')
    return
  }

  vehicleData.value = {
    ...vehicle,
    color: vehicle.color || '-',
    year: vehicle.year || '-',
    seats: vehicle.seats || '-',
    mileage: vehicle.mileage || 0,
    daily_rate: vehicle.daily_rate || 0,
    deposit: vehicle.deposit || 0,
    vin: vehicle.vin || '-',
    engine_number: vehicle.engine_number || '-',
    status: vehicle.status || 'available',
    license_images: vehicle.license_images || [],
    registration_image: vehicle.registration_image || '',
    remarks: vehicle.remarks || '-'
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
  align-items: center;
  gap: 8px;
  /* 标题被隐藏时（窄屏）也要靠右 */
  margin-left: auto;
}

/* 弹窗标题行：标题 + 日期选择器 + 回到今天，撑满整行、控件靠右 */
.dialog-header {
  flex: 1;
  gap: 10px;
  min-width: 0;
}

.dialog-title {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.window-picker {
  width: 70px;
  flex-shrink: 0;
}

/* 窄屏：标题让位给日期选择器 */
@media (max-width: 767px) {
  .dialog-title {
    display: none;
  }

  /* 标题栏收紧：默认上下 18px 内边距 + 21px 标题在手机上太占高度，
     缩成上下 2px + 17px 标题，高度从约 61px 降到约 29px */
  .dashboard .section-card :deep(.el-card__header) {
    padding: 2px 12px;
  }

  .dashboard .card-header > span {
    font-size: 17px;
  }

  /* 底部 sheet 的统一规则在 style.css；这里只压缩甘特图自身的头部控件，
     不再写 padding 覆盖全局 sheet 的 24px 横向留白 */
  .el-dialog :deep(.window-picker) {
    width: 90px;
  }
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

@media (max-width: 767px) {
  .schedule-card {
    height: auto;
    min-height: 0;
  }
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

/* 甘特图样式 */
.gantt-card {
  padding: 0 !important;
}

.gantt-card :deep(.el-card__body) {
  padding: 0 !important;
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
</style>
