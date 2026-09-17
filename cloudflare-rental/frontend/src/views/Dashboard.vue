<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="12" class="stat-cards">
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <el-icon :size="24"><Van /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.vehicles?.total || 0 }}</div>
              <div class="stat-label">车辆总数</div>
            </div>
          </div>
          <div class="stat-footer">
            可用：{{ stats.vehicles?.available || 0 }} | 已租：{{ stats.vehicles?.rented || 0 }}
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
              <el-icon :size="24"><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.orders?.total || 0 }}</div>
              <div class="stat-label">订单总数</div>
            </div>
          </div>
          <div class="stat-footer">
            进行中：{{ stats.orders?.active || 0 }}
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
              <el-icon :size="24"><User /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.customerCount || 0 }}</div>
              <div class="stat-label">客户总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
              <el-icon :size="24"><Money /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">¥{{ formatMoney(stats.monthIncome) }}</div>
              <div class="stat-label">本月收入</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

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
      <div class="gantt-container" ref="ganttContainer">
        <div class="gantt-grid" v-if="Object.keys(ganttData).length">
          <!-- 表头行 -->
          <div class="gantt-header-row">
            <div class="gantt-header-cell gantt-header-plate">车牌</div>
            <div v-for="(dateInfo, index) in ganttDateColumns" :key="index"
                 class="gantt-header-cell gantt-header-date"
                 :class="{ 'is-today': dateInfo.isToday, 'is-weekend': dateInfo.isWeekend }">
              <div class="date-text">{{ dateInfo.dateStr }}</div>
              <div class="week-text">{{ dateInfo.weekStr }}</div>
            </div>
          </div>
          
          <!-- 数据行 -->
          <div v-for="(orders, plateNumber) in ganttData" :key="plateNumber" class="gantt-row">
            <div class="gantt-cell-plate"
                 @click="showVehicleDetail(plateNumber)"
                 @mouseenter="showVehicleTooltip"
                 @mousemove="moveTooltip"
                 @mouseleave="hideTooltip"
                 :data-tooltip="getVehicleTooltip(orders)"
                 style="cursor: pointer;">
              <div class="plate-number" :class="orders[0]?.is_new_energy ? 'new-energy' : 'fuel'">{{ plateNumber }}</div>
            </div>
            
            <!-- 日期单元格（背景） -->
            <div v-for="(dateInfo, index) in ganttDateColumns" :key="index"
                 class="gantt-cell"
                 :class="{ 'is-today': dateInfo.isToday, 'is-weekend': dateInfo.isWeekend }">
            </div>
            
            <!-- 订单占用块 -->
            <div v-for="order in orders" :key="order.id"
                 class="gantt-occupation"
                 :style="getOccupationStyle(order)"
                 @click="showOrderDetail(order)"
                 @mouseenter="showTooltip"
                 @mousemove="moveTooltip"
                 @mouseleave="hideTooltip"
                 :data-tooltip="getOccupationTooltip(order)">
              <span class="occupation-text">{{ getOccupationText(order) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-text">暂无订单数据</div>
      </div>
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
          <table class="schedule-table" v-if="schedules.length">
            <thead>
              <tr>
                <th class="time-col">时间</th>
<th class="type-col">待</th>
                <th class="plate-col">车牌</th>
                <th class="platform-col">平台</th>
                <th>位置</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in schedules" :key="item.id" @click="showScheduleOrderDetail(item.id)" class="schedule-row">
                <td class="time-cell">{{ formatScheduleTime(item.schedule_time) }}</td>
                <td class="type-cell"><span class="schedule-type" :class="item.type === '送' ? 'send' : 'receive'">{{ item.type }}</span></td>
                <td class="plate-cell schedule-plate">{{ item.plate_number }}</td>
                <td class="schedule-platform-cell"><span class="schedule-platform" :style="{ color: item.platform_color || '#909399' }">{{ item.platform || '-' }}</span></td>
                <td class="location-cell">{{ item.location || '-' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-text">暂无调度安排</div>
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
            <span v-if="item.source_name" class="source-tag" :style="{ background: item.source_color || '#409EFF' }">{{ item.source_name }}</span>
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
            <span v-if="row.source_name" class="source-tag" :style="{ background: row.source_color || '#409EFF' }">{{ row.source_name }}</span>
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
      <table class="schedule-table full-view-table" v-if="schedules.length">
        <thead>
          <tr>
            <th class="time-col">时间</th>
            <th class="type-col">待</th>
            <th class="plate-col">车牌</th>
            <th class="platform-col">平台</th>
            <th class="location-col">位置</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in schedules" :key="item.id" @click="showScheduleOrderDetail(item.id)" class="schedule-row">
            <td class="time-cell">{{ formatScheduleTime(item.schedule_time) }}</td>
            <td class="type-cell"><span class="schedule-type" :class="item.type === '送' ? 'send' : 'receive'">{{ item.type }}</span></td>
            <td class="plate-cell schedule-plate">{{ item.plate_number }}</td>
            <td class="schedule-platform-cell"><span class="schedule-platform" :style="{ color: item.platform_color || '#909399' }">{{ item.platform || '-' }}</span></td>
            <td class="location-cell">{{ item.location || '-' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-text">暂无调度安排</div>
    </el-dialog>

    <!-- 甘特图完整视图对话框 -->
    <el-dialog v-model="ganttDialogVisible" title="库存日历 - 完整视图" width="95%" :style="{ maxWidth: '1400px' }">
      <template #header>
        <div class="card-header">
          <span>库存日历 - 完整视图</span>
        </div>
      </template>
      <div class="gantt-container full-view" id="dialogGanttContainer">
        <div class="gantt-grid" v-if="Object.keys(ganttData).length">
          <!-- 表头行 -->
          <div class="gantt-header-row">
            <div class="gantt-header-cell gantt-header-plate">车牌</div>
            <div v-for="(dateInfo, index) in ganttDateColumns" :key="index"
                 class="gantt-header-cell gantt-header-date"
                 :class="{ 'is-today': dateInfo.isToday, 'is-weekend': dateInfo.isWeekend }">
              <div class="date-text">{{ dateInfo.dateStr }}</div>
              <div class="week-text">{{ dateInfo.weekStr }}</div>
            </div>
          </div>

          <!-- 数据行 -->
          <div v-for="(orders, plateNumber) in ganttData" :key="plateNumber" class="gantt-row">
            <div class="gantt-cell-plate"
                 @click="showVehicleDetail(plateNumber)"
                 @mouseenter="showVehicleTooltip"
                 @mousemove="moveTooltip"
                 @mouseleave="hideTooltip"
                 :data-tooltip="getVehicleTooltip(orders)"
                 style="cursor: pointer;">
              <div class="plate-number" :class="orders[0]?.is_new_energy ? 'new-energy' : 'fuel'">{{ plateNumber }}</div>
            </div>

            <!-- 日期单元格（背景） -->
            <div v-for="(dateInfo, index) in ganttDateColumns" :key="index"
                 class="gantt-cell"
                 :class="{ 'is-today': dateInfo.isToday, 'is-weekend': dateInfo.isWeekend }">
            </div>

            <!-- 订单占用块 -->
            <div v-for="order in orders" :key="order.id"
                 class="gantt-occupation"
                 :style="getOccupationStyle(order)"
                 @click="showOrderDetail(order)"
                 @mouseenter="showTooltip"
                 @mousemove="moveTooltip"
                 @mouseleave="hideTooltip"
                 :data-tooltip="getOccupationTooltip(order)">
              <span class="occupation-text">{{ getOccupationText(order) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-text">暂无订单数据</div>
      </div>
    </el-dialog>

    <!-- 订单详情对话框 -->
    <el-dialog v-model="orderDetailVisible" title="订单详情" width="90%" :style="{ maxWidth: '500px' }" :close-on-click-modal="false" class="order-detail-dialog">
      <div v-if="selectedOrder" class="order-detail-content">
        <!-- 头部信息 -->
        <div class="order-detail-header">
          <div class="header-left">
            <span v-if="selectedOrder.source_name" class="source-tag" :style="{ background: selectedOrder.source_color || '#409EFF' }">
              {{ selectedOrder.source_name }}
            </span>
            <el-tag :type="getStatusType(selectedOrder.status)" size="small">
              {{ getStatusText(selectedOrder.status) }}
            </el-tag>
          </div>
        </div>

        <!-- 时间信息 -->
        <div class="order-detail-section">
          <div class="section-title-compact"><el-icon><Clock /></el-icon> 租期时间</div>
          <div class="detail-row-compact">
            <span class="row-label-compact">取车</span>
            <span class="row-value-compact">{{ dayjs(selectedOrder.startDateTime).format('MM-DD HH:mm') }}</span>
          </div>
          <div class="detail-row-compact">
            <span class="row-label-compact">还车</span>
            <span class="row-value-compact">{{ dayjs(selectedOrder.endDateTime).format('MM-DD HH:mm') }}</span>
          </div>
        </div>

        <!-- 车辆信息 -->
        <div class="order-detail-section">
          <div class="section-title-compact"><el-icon><Van /></el-icon> 车辆</div>
          <div class="detail-row-compact">
            <span class="row-label-compact">车牌</span>
            <span class="row-value-compact">
              <span class="plate-number-compact" :class="selectedOrder.is_new_energy ? 'new-energy' : 'fuel'">
                {{ selectedOrder.plate_number }}
              </span>
            </span>
          </div>
          <div class="detail-row-compact">
            <span class="row-label-compact">车型</span>
            <span class="row-value-compact">{{ selectedOrder.brand }} {{ selectedOrder.model }}</span>
          </div>
        </div>

        <!-- 取还地点 -->
        <div class="order-detail-section" v-if="selectedOrder.pickLocation || selectedOrder.returnLocation">
          <div class="section-title-compact"><el-icon><Location /></el-icon> 取还地点</div>
          <div class="detail-row-compact">
            <span class="row-label-compact">取车</span>
            <span class="row-value-compact">{{ selectedOrder.pickLocation || '-' }}</span>
          </div>
          <div class="detail-row-compact">
            <span class="row-label-compact">还车</span>
            <span class="row-value-compact">{{ selectedOrder.returnLocation || '-' }}</span>
          </div>
        </div>

        <!-- 客户信息 -->
        <div class="order-detail-section">
          <div class="section-title-compact"><el-icon><User /></el-icon> 客户</div>
          <div class="detail-row-compact">
            <span class="row-label-compact">姓名</span>
            <span class="row-value-compact">{{ selectedOrder.name }}</span>
          </div>
          <div class="detail-row-compact">
            <span class="row-label-compact">电话</span>
            <span class="row-value-compact"><el-link :href="`tel:${selectedOrder.phone}`" type="primary" :underline="false">{{ selectedOrder.phone }}</el-link></span>
          </div>
        </div>

        <!-- 金额信息 -->
        <div class="order-detail-section">
          <div class="section-title-compact"><el-icon><Money /></el-icon> 金额</div>
          <div class="detail-row-compact highlight-compact">
            <span class="row-label-compact">订单金额</span>
            <span class="row-value-compact amount-compact">¥{{ selectedOrder.rmb }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer-compact">
          <el-button type="primary" plain size="small" @click="editOrder" v-if="['pending', 'active'].includes(selectedOrder?.status)">编辑</el-button>
          <el-button type="success" size="small" @click="showPickupDialog" v-if="selectedOrder?.status === 'pending'">取车</el-button>
          <el-button type="warning" size="small" @click="showCompleteDialog" v-if="selectedOrder?.status === 'active'">还车</el-button>
          <el-button type="primary" size="small" @click="goToOrderFromGantt">详情</el-button>
          <el-button size="small" @click="orderDetailVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 取车对话框 -->
    <el-dialog v-model="pickupDialogVisible" title="取车确认" width="90%" :style="{ maxWidth: '400px' }">
      <el-form :model="pickupForm" label-width="100px">
        <el-form-item label="取车里程">
          <el-input-number v-model="pickupForm.pickup_mileage" :min="0" placeholder="公里数（选填）" style="width: 100%" />
        </el-form-item>
        <el-form-item label="取车照片">
          <div class="single-upload">
            <div v-if="pickupForm.pickup_image" class="image-preview">
              <img :src="getImageUrl(pickupForm.pickup_image)" class="upload-preview" />
              <div class="image-remove" @click="pickupForm.pickup_image = ''">×</div>
            </div>
            <div v-else class="upload-btn" @click="triggerPickupUpload">
              <el-icon><Plus /></el-icon>
              <span>上传照片</span>
            </div>
            <input ref="pickupImageInput" type="file" accept="image/*" capture="environment" style="display: none" @change="handlePickupImageUpload" />
          </div>
        </el-form-item>
        <el-form-item label="实际取车时间">
          <input
            type="datetime-local"
            :value="formatDateTimeLocal(pickupForm.actual_pickup_date)"
            class="native-datetime-input"
            @change="onPickupDateTimeChange"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="pickupForm.remarks" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pickupDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handlePickup" :loading="submitting">确定取车</el-button>
      </template>
    </el-dialog>

    <!-- 还车对话框 -->
    <el-dialog v-model="completeDialogVisible" title="完成订单" width="90%" :style="{ maxWidth: '400px' }">
      <el-form :model="completeForm" label-width="100px">
        <el-form-item label="还车里程">
          <el-input-number v-model="completeForm.return_mileage" :min="0" placeholder="公里数（选填）" style="width: 100%" />
        </el-form-item>
        <el-form-item label="还车照片">
          <div class="single-upload">
            <div v-if="completeForm.return_image" class="image-preview">
              <img :src="getImageUrl(completeForm.return_image)" class="upload-preview" />
              <div class="image-remove" @click="completeForm.return_image = ''">×</div>
            </div>
            <div v-else class="upload-btn" @click="triggerReturnUpload">
              <el-icon><Plus /></el-icon>
              <span>上传照片</span>
            </div>
            <input ref="returnImageInput" type="file" accept="image/*" capture="environment" style="display: none" @change="handleReturnImageUpload" />
          </div>
        </el-form-item>
        <el-form-item label="实际还车时间">
          <input
            type="datetime-local"
            :value="formatDateTimeLocal(completeForm.actual_end_date)"
            class="native-datetime-input"
            @change="onCompleteDateTimeChange"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="completeForm.remarks" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleComplete" :loading="submitting">确定完成</el-button>
      </template>
    </el-dialog>

    <!-- 自定义跟随鼠标的 tooltip -->
    <div v-if="tooltipVisible" class="custom-tooltip" :style="{ left: tooltipPosition.left + 'px', top: tooltipPosition.top + 'px' }">
      <div class="custom-tooltip-content">{{ tooltipContent }}</div>
    </div>

    <!-- 车辆详情对话框 -->
    <VehicleDetailDialog v-model:visible="vehicleDialogVisible" :vehicle="vehicleData" @edit="goToVehicleDetail" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi, scheduleApi, orderApi, uploadApi } from '../api'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import VehicleDetailDialog from '../components/VehicleDetailDialog.vue'

const router = useRouter()

const stats = ref<any>({
  vehicles: {},
  orders: {},
  customerCount: 0,
  monthIncome: 0,
  recentOrders: [],
  expiringOrders: []
})

// 自定义 Tooltip 状态
const tooltipVisible = ref(false)
const tooltipContent = ref('')
const tooltipPosition = ref({ left: 0, top: 0 })
const isTouchDevice = ref(false)

// 车辆详情对话框状态
const vehicleDialogVisible = ref(false)
const vehicleData = ref<any>({})

// 显示 tooltip（仅桌面端）
function showTooltip(event: MouseEvent) {
  // 触摸设备不显示 tooltip
  if (isTouchDevice.value) return
  
  const target = event.currentTarget as HTMLElement
  const content = target.getAttribute('data-tooltip')
  if (content) {
    tooltipContent.value = content
    tooltipPosition.value = {
      left: event.clientX + 10,
      top: event.clientY + 10
    }
    tooltipVisible.value = true
  }
}

// 显示车辆 tooltip（仅桌面端）
function showVehicleTooltip(event: MouseEvent) {
  // 触摸设备不显示 tooltip
  if (isTouchDevice.value) return
  
  const target = event.currentTarget as HTMLElement
  const content = target.getAttribute('data-tooltip')
  if (content) {
    tooltipContent.value = content
    tooltipPosition.value = {
      left: event.clientX + 10,
      top: event.clientY + 10
    }
    tooltipVisible.value = true
  }
}

// 移动 tooltip
function moveTooltip(event: MouseEvent) {
  if (isTouchDevice.value) return
  tooltipPosition.value = {
    left: event.clientX + 10,
    top: event.clientY + 10
  }
}

// 隐藏 tooltip
function hideTooltip() {
  if (isTouchDevice.value) return
  tooltipVisible.value = false
}

// 获取车辆信息 tooltip
function getVehicleTooltip(orders: any[]): string {
  if (!orders || !orders.length) return '暂无信息'
  const firstOrder = orders[0]
  const lines = [
    `车牌：${firstOrder.plate_number || '-'}`,
    `车型：${firstOrder.brand || ''} ${firstOrder.model || ''}`.trim(),
    `能源类型：${firstOrder.is_new_energy ? '新能源' : '燃油车'}`,
    `当前订单数：${orders.length}`
  ]
  return lines.filter(line => line).join('\n')
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
    license_image: order.license_image || '',
    registration_image: order.registration_image || '',
    remarks: order.remarks || '-'
  }
  
  vehicleDialogVisible.value = true
}

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
const ganttData = ref<Record<string, any[]>>({})
const ganttDialogVisible = ref(false)
const viewMode = ref('60') // 默认 60 天
const selectedOrder = ref<any>(null)
const orderDetailVisible = ref(false)

// 取车/还车对话框
const pickupDialogVisible = ref(false)
const completeDialogVisible = ref(false)
const submitting = ref(false)

const pickupForm = ref({
  pickup_mileage: 0,
  pickup_image: '',
  actual_pickup_date: dayjs().format('YYYY-MM-DDTHH:mm'),
  remarks: ''
})

const completeForm = ref({
  return_mileage: 0,
  return_image: '',
  actual_end_date: dayjs().format('YYYY-MM-DDTHH:mm'),
  remarks: ''
})

const pickupImageInput = ref<HTMLInputElement | null>(null)
const returnImageInput = ref<HTMLInputElement | null>(null)
const ganttContainer = ref<HTMLElement | null>(null)

// 日期范围配置
const VIEW_MODES = {
  '30': { past: 15, future: 15 },
  '60': { past: 30, future: 30 },
  '90': { past: 45, future: 45 }
}

// 生成甘特图日期列
function generateDateColumns(mode: { past: number; future: number }) {
  const columns: { dateStr: string; weekStr: string; isToday: boolean; isWeekend: boolean; date: Date }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = -mode.past; i <= mode.future; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const dayOfWeek = date.getDay()

    columns.push({
      dateStr: `${date.getMonth() + 1}/${date.getDate()}`,
      weekStr: ['日', '一', '二', '三', '四', '五', '六'][dayOfWeek],
      isToday: i === 0,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      date: date
    })
  }

  return columns
}

const ganttDateColumns = computed(() => {
  const mode = VIEW_MODES[viewMode.value as keyof typeof VIEW_MODES]
  return generateDateColumns(mode)
})

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

function formatMoney(value: number) {
  return (value || 0).toLocaleString()
}

function formatDate(date: string) {
  return dayjs(date).format('MM-DD HH:mm')
}

function formatScheduleTime(date: string) {
  return dayjs(date).format('MM-DD HH:mm')
}

// 获取图片完整 URL
function getImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  // 假设后端上传接口返回的是相对路径，需要拼接后端地址
  const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
  return `${backendUrl}${url.startsWith('/') ? url : '/' + url}`
}

// 格式化为 datetime-local 输入格式
function formatDateTimeLocal(dateStr: string): string {
  if (!dateStr) return dayjs().format('YYYY-MM-DDTHH:mm')
  return dayjs(dateStr).format('YYYY-MM-DDTHH:mm')
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

// 计算占用块样式
function getOccupationStyle(order: any): Record<string, string> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = new Date(order.startDateTime)
  const endDate = new Date(order.endDateTime)

  // 计算开始索引（相对于今天）
  const startDiff = Math.floor((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const endDiff = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // 获取当前视图模式的日期范围
  const mode = VIEW_MODES[viewMode.value as keyof typeof VIEW_MODES]
  const totalDays = mode.past + mode.future + 1

  // 转换为列索引
  let startIdx = startDiff + mode.past
  let endIdx = endDiff + mode.past

  // 限制在可见范围内
  if (startIdx < 0) startIdx = 0
  if (endIdx >= totalDays) endIdx = totalDays - 1

  if (startIdx > endIdx) {
    return { display: 'none' }
  }

  // 计算时间偏移（小时）
  const startHour = startDate.getHours() + startDate.getMinutes() / 60
  const endHour = endDate.getHours() + endDate.getMinutes() / 60

  // 单元格宽度和车牌列宽度
  const cellWidth = 40
  const plateWidth = 90

  // 计算 left 位置（相对于行的左侧）
  const left = plateWidth + startIdx * cellWidth + (startHour / 24) * cellWidth

  // 计算宽度
  const right = plateWidth + (endIdx + 1) * cellWidth - ((24 - endHour) / 24) * cellWidth
  const width = right - left

  // 使用订单来源的颜色作为背景色
  const backgroundColor = order.platform_color || '#409EFF'

  return {
    left: `${left}px`,
    width: `${Math.max(width, 40)}px`,
    backgroundColor: backgroundColor
  }
}

// 获取占用文字
function getOccupationText(order: any): string {
  const start = dayjs(order.startDateTime).format('MM/DD HH:mm')
  const end = dayjs(order.endDateTime).format('MM/DD HH:mm')
  return `${start}-${end}`
}

// 获取悬停提示内容
function getOccupationTooltip(order: any): string {
  const lines = [
    `订单号：${order.order_no || '-'}`,
    `客户：${order.customer_name || '-'}`,
    `电话：${order.customer_phone || '-'}`,
    `取车：${dayjs(order.startDateTime).format('MM-DD HH:mm')}`,
    `还车：${dayjs(order.endDateTime).format('MM-DD HH:mm')}`,
    `平台：${order.source_name || '线下'}`,
    `金额：¥${order.total_amount || 0}`
  ]
  return lines.join('\n')
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

// 显示取车对话框
function showPickupDialog() {
  pickupForm.value = {
    pickup_mileage: 0,
    pickup_image: '',
    actual_pickup_date: dayjs().format('YYYY-MM-DDTHH:mm'),
    remarks: ''
  }
  pickupDialogVisible.value = true
}

// 显示还车对话框
function showCompleteDialog() {
  completeForm.value = {
    return_mileage: 0,
    return_image: '',
    actual_end_date: dayjs().format('YYYY-MM-DDTHH:mm'),
    remarks: ''
  }
  completeDialogVisible.value = true
}

// 触发取车照片上传
function triggerPickupUpload() {
  pickupImageInput.value?.click()
}

// 触发还车照片上传
function triggerReturnUpload() {
  returnImageInput.value?.click()
}

// 处理取车照片上传
async function handlePickupImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  
  try {
    const res: any = await uploadApi.uploadVehicle(file)
    if (res.success && res.data) {
      pickupForm.value.pickup_image = res.data.url
    }
  } catch (error) {
    console.error('上传失败', error)
    ElMessage.error('上传失败，请重试')
  }
}

// 处理还车照片上传
async function handleReturnImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  
  try {
    const res: any = await uploadApi.uploadVehicle(file)
    if (res.success && res.data) {
      completeForm.value.return_image = res.data.url
    }
  } catch (error) {
    console.error('上传失败', error)
    ElMessage.error('上传失败，请重试')
  }
}

// 还车时间变更
function onCompleteDateTimeChange(event: Event) {
  const target = event.target as HTMLInputElement
  completeForm.value.actual_end_date = target.value
}

// 取车时间变更
function onPickupDateTimeChange(event: Event) {
  const target = event.target as HTMLInputElement
  pickupForm.value.actual_pickup_date = target.value
}

// 处理取车
async function handlePickup() {
  if (!selectedOrder.value) return
  
  try {
    submitting.value = true
    const data: any = {}
    if (pickupForm.value.pickup_mileage > 0) {
      data.pickup_mileage = pickupForm.value.pickup_mileage
    }
    if (pickupForm.value.pickup_image) {
      data.pickup_image = pickupForm.value.pickup_image
    }
    if (pickupForm.value.actual_pickup_date) {
      data.actual_pickup_date = pickupForm.value.actual_pickup_date.replace('T', ' ')
    }
    if (pickupForm.value.remarks) {
      data.remarks = pickupForm.value.remarks
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
async function handleComplete() {
  if (!selectedOrder.value) return
  
  try {
    submitting.value = true
    const data: any = {}
    if (completeForm.value.return_mileage > 0) {
      data.return_mileage = completeForm.value.return_mileage
    }
    if (completeForm.value.return_image) {
      data.return_image = completeForm.value.return_image
    }
    if (completeForm.value.actual_end_date) {
      data.actual_end_date = completeForm.value.actual_end_date.replace('T', ' ')
    }
    if (completeForm.value.remarks) {
      data.remarks = completeForm.value.remarks
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

    // 获取表格元素
    const tableElement = document.querySelector('.schedule-table') as HTMLElement
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

  // 检测是否为触摸设备
  isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // 等待 DOM 更新后，将甘特图滚动到当天日期
  await nextTick()
  scrollGanttToToday()
})

// 滚动甘特图到当天日期
function scrollGanttToToday() {
  // 只滚动主页面的甘特图容器（不包括对话框中的）
  const container = document.querySelector('.gantt-container:not(.full-view)') as HTMLElement
  if (container) {
    const mode = VIEW_MODES[viewMode.value as keyof typeof VIEW_MODES]
    const cellWidth = 40
    const plateWidth = 90
    const scrollLeft = plateWidth + (mode.past - 2) * cellWidth - 10
    container.scrollLeft = Math.max(0, scrollLeft)
  }
}
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.stat-cards {
  margin-bottom: 12px;
}

@media (min-width: 768px) {
  .stat-cards {
    margin-bottom: 20px;
  }
}

.stat-card {
  margin-bottom: 12px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

@media (min-width: 768px) {
  .stat-content {
    gap: 16px;
  }
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

@media (min-width: 768px) {
  .stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
  }
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 20px;
  font-weight: bold;
  color: #303133;
}

@media (min-width: 768px) {
  .stat-value {
    font-size: 24px;
  }
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

@media (min-width: 768px) {
  .stat-label {
    font-size: 14px;
    margin-top: 4px;
  }
}

.stat-footer {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #ebeef5;
  font-size: 12px;
  color: #909399;
}

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
  color: #909399;
}

.placeholder-content p {
  margin: 10px 0;
  font-size: 14px;
}

.placeholder-hint {
  font-size: 12px;
  color: #c0c4cc;
}

.schedule-table {
  border-collapse: collapse;
  font-size: 13px;
  width: 100%;
  margin: 0;
  border: 1px solid #dcdfe6;
}

@media (min-width: 768px) {
  .schedule-table {
    font-size: 14px;
  }
}

.schedule-table th {
  background-color: #FFE4B5;
  color: #333;
  font-weight: 700;
  padding: 8px 6px;
  text-align: center;
  white-space: nowrap;
  border: 1px solid #dcdfe6;
}

.schedule-table th.platform-col {
  max-width: 50px;
  overflow: hidden;
}

.schedule-table th.time-col,
.schedule-table td.time-cell {
  width: 65px;
  min-width: 65px;
}

.schedule-table th.type-col,
.schedule-table td.type-cell {
  width: 30px;
  min-width: 30px;
}

.schedule-table th.plate-col,
.schedule-table td.plate-cell {
  width: 90px;
  min-width: 90px;
}

.schedule-table td.location-cell {
  max-width: 80px;
  white-space: nowrap;
  overflow-x: auto;
}

.schedule-table td.location-cell::-webkit-scrollbar {
  display: none;
}

.schedule-table td.location-cell {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

@media (min-width: 768px) {
  .schedule-table td.location-cell {
    max-width: none;
  overflow: visible;
  }
}

@media (min-width: 768px) {
  .schedule-table th.platform-col {
    max-width: 70px;
  }
}

@media (min-width: 768px) {
  .schedule-table th {
    padding: 10px 12px;
  }
}

.schedule-table td {
  padding: 8px 6px;
  text-align: center;
  vertical-align: middle;
  border-bottom: 1px solid #dcdfe6;
  border-left: 1px solid #dcdfe6;
  border-right: 1px solid #dcdfe6;
  white-space: nowrap;
}

@media (min-width: 768px) {
  .schedule-table td {
    padding: 10px 12px;
  }
}

.schedule-table tr:nth-child(even) {
  background-color: #F5F5F5;
}

.schedule-table tr:hover {
  background-color: #e6f0ff;
  cursor: pointer;
}

.schedule-row {
  transition: background-color 0.2s;
}

.schedule-type {
  font-weight: 600;
}

.schedule-type.send {
  color: #dc3545;
}

.schedule-type.receive {
  color: #28a745;
}

.schedule-plate {
  color: #007bff;
  font-weight: 500;
}

.schedule-platform-cell {
  max-width: 50px;
  white-space: nowrap;
  overflow-x: auto;
}

.schedule-platform-cell::-webkit-scrollbar {
  display: none;
}

.schedule-platform-cell {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

@media (min-width: 768px) {
  .schedule-platform-cell {
    max-width: 70px;
  }
}

.schedule-platform {
  font-weight: 500;
}

.empty-text {
  text-align: center;
  color: #909399;
  padding: 20px;
  font-size: 14px;
}

/* 完整视图表格样式 */
.full-view-table {
  font-size: 14px;
  table-layout: fixed;
  width: 100%;
}

.full-view-table th,
.full-view-table td {
  padding: 12px;
  white-space: nowrap;
}

.full-view-table th.time-col,
.full-view-table td.time-cell {
  width: 65px;
}

.full-view-table th.type-col,
.full-view-table td.type-cell {
  width: 30px;
}

.full-view-table th.plate-col,
.full-view-table td.plate-cell {
  width: 90px;
}

.full-view-table th.platform-col {
  width: 70px;
}

.full-view-table td.schedule-platform-cell {
  width: 70px;
  overflow-x: auto;
}

.full-view-table td.schedule-platform-cell::-webkit-scrollbar {
  display: none;
}

.full-view-table th.location-col {
  width: 80px;
}

.full-view-table td.location-cell {
  width: 80px;
  overflow-x: auto;
}

.full-view-table td.location-cell::-webkit-scrollbar {
  display: none;
}

@media (min-width: 768px) {
  .full-view-table th.platform-col,
  .full-view-table td.schedule-platform-cell {
    max-width: 100px;
  }

  .full-view-table td.schedule-platform-cell {
    overflow-x: auto;
  }

  .full-view-table th.location-col,
  .full-view-table td.location-cell {
    max-width: 150px;
    overflow-x: auto;
  }
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
  color: #909399;
}

.mobile-card-row .value {
  color: #303133;
}

.text-primary {
  color: #409EFF;
  font-weight: 500;
}

.text-warning {
  color: #E6A23C;
  font-weight: 500;
}

.text-muted {
  color: #909399;
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

.gantt-container {
  overflow: auto;
  max-height: 300px;
}

.gantt-container.full-view {
  max-height: 500px;
}

.gantt-grid {
  width: max-content;
  font-size: 12px;
}

/* 表头行 */
.gantt-header-row {
  display: flex;
}

.gantt-header-cell {
  background-color: #FFE4B5;
  padding: 4px 2px;
  text-align: center;
  font-weight: 700;
  border: 1px solid #dcdfe6;
  height: 50px;  /* 稍微增加表头高度 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}

.gantt-header-plate {
  position: sticky;
  left: 0;
  z-index: 3;
  width: 90px;
  background-color: #FFE4B5;
  height: 50px;  /* 与表头高度保持一致 */
}

.gantt-header-date {
  width: 40px;
}

.gantt-header-date.is-today {
  background-color: #409EFF;
  color: #fff;
}

.gantt-header-date.is-weekend {
  background-color: #FFF0E5;
}

/* 今天且是周末时，今天的样式优先 */
.gantt-header-date.is-today.is-weekend {
  background-color: #409EFF;
  color: #fff;
}

.gantt-header-date .date-text {
  font-weight: 600;
  font-size: 11px;
}

.gantt-header-date .week-text {
  font-size: 10px;
  color: #666;
}

.gantt-header-date.is-today .week-text {
  color: rgba(255,255,255,0.8);
}

/* 今天且是周末时，week-text 也要白色 */
.gantt-header-date.is-today.is-weekend .week-text {
  color: rgba(255,255,255,0.8);
}

/* 数据行 */
.gantt-row {
  display: flex;
  position: relative;
  height: 40px;
}

.gantt-cell-plate {
  position: sticky;
  left: 0;
  z-index: 2;
  background-color: #fff;
  width: 90px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #dcdfe6;
  flex-shrink: 0;
}

.gantt-header-plate {
  position: sticky;
  left: 0;
  z-index: 3;
  width: 90px;
  background-color: #FFE4B5;
  height: 50px;  /* 与表头高度保持一致 */
}

.gantt-cell-plate .plate-number {
  font-weight: 600;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 3px;
  display: inline-block;
}

.gantt-cell {
  width: 40px;
  height: 40px;
  border: 1px solid #dcdfe6;
  background-color: #fff;
  flex-shrink: 0;
}

.gantt-cell.is-today {
  background-color: #ecf5ff;
}

.gantt-cell.is-weekend {
  background-color: #faf5f0;
}

/* 今天且是周末时，今天的样式优先 */
.gantt-cell.is-today.is-weekend {
  background-color: #ecf5ff;
}

/* 占用块样式 */
.gantt-occupation {
  position: absolute;
  height: 32px;
  top: 4px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  z-index: 1;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.gantt-occupation:hover {
  transform: scaleY(1.1);
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.occupation-text {
  font-size: 11px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 6px 0 8px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 自定义 tooltip 样式 */
.custom-tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 6px;
  padding: 10px 14px;
  color: #fff;
  font-size: 12px;
  line-height: 1.8;
  max-width: 280px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
}

.custom-tooltip-content {
  white-space: pre-wrap;
  word-break: break-all;
}

/* 订单详情弹窗暗色模式 */
html.dark .order-detail-header {
  background-color: var(--sk-surface-dark-1);
}

.order-detail-content {
  padding: 0;
}

.order-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--sk-bg-light-gray);
  border-radius: 8px;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.order-detail-section {
  margin-bottom: 16px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  padding: 12px 16px;
  background-color: var(--sk-bg-light-gray);
}

html.dark .order-detail-section {
  border-color: rgba(255, 255, 255, 0.08);
  background-color: var(--sk-surface-dark-1);
}

.section-title-compact {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 14px;
  color: var(--sk-text-near-black);
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

html.dark .section-title-compact {
  color: var(--sk-text-white);
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.section-title-compact .el-icon {
  color: var(--sk-focus-color);
  font-size: 16px;
}

.detail-row-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
}

.detail-row-compact:not(:last-child) {
  border-bottom: 1px dashed rgba(0, 0, 0, 0.06);
}

html.dark .detail-row-compact:not(:last-child) {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.highlight-compact {
  background: linear-gradient(135deg, rgba(0, 113, 227, 0.05) 0%, rgba(0, 113, 227, 0.02) 100%);
  padding: 10px 12px;
  border-radius: 6px;
  margin: 0 -4px;
}

html.dark .highlight-compact {
  background: linear-gradient(135deg, rgba(0, 113, 227, 0.1) 0%, rgba(0, 113, 227, 0.05) 100%);
}

.row-label-compact {
  color: var(--sk-text-tertiary);
  font-size: 13px;
}

.row-value-compact {
  color: var(--sk-text-near-black);
  font-weight: 500;
  text-align: right;
  font-size: 14px;
}

html.dark .row-value-compact {
  color: var(--sk-text-white);
}

.row-value-compact.amount-compact {
  font-size: 18px;
  font-weight: 700;
  color: var(--sk-focus-color);
}

.dialog-footer-compact {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.dialog-footer-compact .el-button {
  min-width: 64px;
  flex: 1 1 auto;
  max-width: 90px;
}

@media (max-width: 480px) {
  .dialog-footer-compact {
    gap: 4px;
  }
  .dialog-footer-compact .el-button {
    min-width: 50px;
    max-width: 70px;
    padding: 8px 4px;
    font-size: 12px;
  }
}

/* 车牌样式 - 紧凑版 */
.plate-number-compact {
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
}

.plate-number-compact.new-energy {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: #fff;
}

.plate-number-compact.fuel {
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  color: #fff;
}

/* 来源标签 */
.source-tag {
  color: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}

/* 上传组件样式 */
.single-upload {
  width: 100%;
}

.upload-btn {
  width: 100px;
  height: 100px;
  border: 2px dashed rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s;
  background-color: var(--sk-bg-light-gray);
}

html.dark .upload-btn {
  border-color: rgba(255, 255, 255, 0.08);
  background-color: var(--sk-surface-dark-1);
}

.upload-btn:hover {
  border-color: var(--sk-focus-color);
}

.upload-btn .el-icon {
  font-size: 24px;
  color: var(--sk-text-tertiary);
  margin-bottom: 4px;
}

.upload-btn span {
  font-size: 12px;
  color: var(--sk-text-tertiary);
}

.image-preview {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-remove {
  position: absolute;
  top: 0;
  right: 0;
  width: 24px;
  height: 24px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  border-radius: 0 8px 0 0;
}

.upload-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}

/* 原生时间选择器样式 */
.native-datetime-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  font-size: 14px;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  outline: none;
  transition: border-color 0.2s;
  background-color: var(--bg-color-secondary);
  color: var(--sk-text-near-black);
}

html.dark .native-datetime-input {
  background-color: var(--sk-surface-dark-1);
  border-color: rgba(255, 255, 255, 0.08);
  color: var(--sk-text-white);
}

.native-datetime-input:focus {
  border-color: var(--sk-focus-color);
  box-shadow: 0 0 0 2px rgba(0, 113, 227, 0.1);
}

.native-datetime-input::-webkit-calendar-picker-indicator {
  cursor: pointer;
}

.native-datetime-input::-webkit-calendar-picker-indicator:hover {
  opacity: 0.8;
}

/* 暗色模式 */
html.dark .stat-value {
  color: var(--text-color);
}

html.dark .stat-label,
html.dark .stat-footer,
html.dark .placeholder-content,
html.dark .placeholder-hint {
  color: var(--text-color-secondary);
}

html.dark .stat-footer {
  border-top-color: var(--border-color);
}

html.dark .schedule-table {
  border-color: var(--border-color);
}

html.dark .schedule-table th {
  background-color: var(--hover-bg-color);
  color: var(--text-color);
  border-color: var(--border-color);
}

html.dark .schedule-table td {
  border-color: var(--border-color);
}

html.dark .native-datetime-input {
  background: var(--bg-color-secondary);
  border-color: var(--border-color);
  color: var(--text-color);
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

html.dark .image-preview {
  border-color: var(--border-color);
}

html.dark .upload-btn {
  border-color: var(--border-color);
  color: var(--text-color-secondary);
}

/* 甘特图暗色模式 */
html.dark .gantt-header-cell {
  background-color: var(--hover-bg-color);
  border-color: var(--border-color);
}

html.dark .gantt-header-plate {
  background-color: var(--hover-bg-color);
  border-color: var(--border-color);
}

html.dark .gantt-header-date.is-weekend {
  background-color: #3a3a3a;
}

html.dark .gantt-header-date.is-today .week-text {
  color: rgba(255,255,255,0.8);
}

html.dark .gantt-cell-plate {
  background-color: var(--bg-color-secondary);
  border-color: var(--border-color);
}

html.dark .gantt-cell {
  background-color: var(--bg-color-secondary);
  border-color: var(--border-color);
}

html.dark .gantt-cell.is-today {
  background-color: #2a3a4a;
}

html.dark .gantt-cell.is-weekend {
  background-color: #3a3a3a;
}

html.dark .plate-number {
  color: var(--text-color);
}

html.dark .gantt-occupation {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

html.dark .gantt-occupation:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.8);
}

/* 调度表格暗色模式 */
html.dark .schedule-table tr:nth-child(even) {
  background-color: var(--bg-color-secondary);
}

html.dark .schedule-table tr:hover {
  background-color: var(--hover-bg-color);
}

html.dark .schedule-plate {
  color: var(--primary-color);
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

html.dark .order-detail-dialog .el-dialog__header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

html.dark .order-detail-dialog .el-dialog__footer {
  border-top-color: rgba(255, 255, 255, 0.08);
}
</style>
