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
            可用: {{ stats.vehicles?.available || 0 }} | 已租: {{ stats.vehicles?.rented || 0 }}
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
            进行中: {{ stats.orders?.active || 0 }}
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

    <!-- 调度表格区域 -->
    <el-row :gutter="20" class="schedule-section">
      <!-- 左侧：调度表格 -->
      <el-col :xs="24" :sm="12">
        <el-card class="section-card schedule-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span><el-icon><Calendar /></el-icon> 调度安排</span>
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
          
          <!-- 调度表格（移动端和PC端都用表格） -->
          <table class="schedule-table" v-if="schedules.length">
            <thead>
              <tr>
                <th>时间</th>
                <th>送/收</th>
                <th>车牌</th>
                <th>平台</th>
                <th>位置</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in schedules" :key="item.id" @click="goToOrder(item.id)" class="schedule-row">
                <td>{{ formatScheduleTime(item.schedule_time) }}</td>
                <td><span class="schedule-type" :class="item.type === '送' ? 'send' : 'receive'">{{ item.type }}</span></td>
                <td class="schedule-plate">{{ item.plate_number }}</td>
                <td><span class="schedule-platform" :style="{ color: item.platform_color || '#909399' }">{{ item.platform || '-' }}</span></td>
                <td>{{ item.location || '-' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-text">暂无调度安排</div>
        </el-card>
      </el-col>
      
      <!-- 右侧：占位容器（PC端显示） -->
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
    </el-row>    <!-- 即将到期订单 -->
    <el-card v-if="stats.expiringOrders?.length" class="section-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span><el-icon><Warning /></el-icon> 即将到期</span>
        </div>
      </template>
      
      <!-- 移动端卡片 -->
      <div class="mobile-cards">
        <div v-for="item in stats.expiringOrders" :key="item.order_no" class="mobile-card">
          <div class="mobile-card-row">
            <span class="label">订单号</span>
            <span class="value">{{ item.order_no }}</span>
          </div>
          <div class="mobile-card-row">
            <span class="label">客户</span>
            <span class="value">{{ item.customer_name }} {{ item.phone }}</span>
          </div>
          <div class="mobile-card-row">
            <span class="label">车牌</span>
            <span class="value"><span class="plate-number" :class="item.is_new_energy ? 'new-energy' : 'fuel'">{{ item.plate_number }}</span></span>
          </div>
          <div class="mobile-card-row">
            <span class="label">到期</span>
            <span class="value text-warning">{{ item.end_date }}</span>
          </div>
        </div>
      </div>
      
      <!-- PC端表格 -->
      <el-table :data="stats.expiringOrders" stripe size="small" class="hide-mobile">
        <el-table-column prop="order_no" label="订单号" width="140" />
        <el-table-column prop="customer_name" label="客户" />
        <el-table-column prop="phone" label="电话" width="120" />
        <el-table-column prop="plate_number" label="车牌" width="120">
          <template #default="{ row }">
            <span class="plate-number" :class="row.is_new_energy ? 'new-energy' : 'fuel'">{{ row.plate_number }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="end_date" label="到期日期" width="120" />
        <el-table-column prop="total_amount" label="金额" width="100">
          <template #default="{ row }">¥{{ row.total_amount }}</template>
        </el-table-column>
      </el-table>
    </el-card>

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
      
      <!-- PC端表格 -->
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
    <el-dialog v-model="scheduleDialogVisible" title="调度安排 - 完整视图" width="90%" :style="{ maxWidth: '1200px' }">
      <table class="schedule-table full-view-table" v-if="schedules.length">
        <thead>
          <tr>
            <th>时间</th>
            <th>送/收</th>
            <th>车牌</th>
            <th>平台</th>
            <th>位置</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in schedules" :key="item.id" @click="goToOrder(item.id)" class="schedule-row">
            <td>{{ formatScheduleTime(item.schedule_time) }}</td>
            <td><span class="schedule-type" :class="item.type === '送' ? 'send' : 'receive'">{{ item.type }}</span></td>
            <td class="schedule-plate">{{ item.plate_number }}</td>
            <td><span class="schedule-platform" :style="{ color: item.platform_color || '#909399' }">{{ item.platform || '-' }}</span></td>
            <td>{{ item.location || '-' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-text">暂无调度安排</div>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi, scheduleApi } from '../api'
import dayjs from 'dayjs'

const router = useRouter()

const stats = ref<any>({
  vehicles: {},
  orders: {},
  customerCount: 0,
  monthIncome: 0,
  recentOrders: [],
  expiringOrders: []
})

const schedules = ref<any[]>([])
const scheduleDialogVisible = ref(false)
const shareLoading = ref(false)

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
  // 使用完整的日期+时间格式
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

function goToOrder(orderId: string) {
  router.push(`/orders/${orderId}`)
}

async function shareSchedule() {
  try {
    shareLoading.value = true
    
    // 动态导入html2canvas
    const html2canvas = (await import('html2canvas')).default
    
    // 获取表格元素
    const tableElement = document.querySelector('.schedule-table') as HTMLElement
    if (!tableElement) {
      throw new Error('找不到表格元素')
    }
    
    // 创建canvas
    const canvas = await html2canvas(tableElement, {
      backgroundColor: '#ffffff',
      scale: 2, // 提高清晰度
      useCORS: true
    })
    
    // 转换为图片
    const imageData = canvas.toDataURL('image/png')
    
    // 创建下载链接
    const link = document.createElement('a')
    link.download = `调度安排_${dayjs().format('YYYY-MM-DD_HH-mm')}.png`
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
})
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

/* 移动端列宽限制 */
@media (max-width: 767px) {
  .schedule-table th:nth-child(1),
  .schedule-table td:nth-child(1) {
    min-width: 80px;
    max-width: 80px;
  }

  .schedule-table th:nth-child(2),
  .schedule-table td:nth-child(2) {
    min-width: 50px;
    max-width: 50px;
  }

  .schedule-table th:nth-child(3),
  .schedule-table td:nth-child(3) {
    min-width: 70px;
    max-width: 70px;
  }

  /* 平台列：3个汉字宽，超出滑动显示 */
  .schedule-table th:nth-child(4),
  .schedule-table td:nth-child(4) {
    min-width: 3em;
    max-width: 3em;
    overflow-x: auto;
    white-space: nowrap;
    text-align: center;
  }

  .schedule-table td:nth-child(4)::-webkit-scrollbar {
    height: 3px;
  }

  .schedule-table td:nth-child(4)::-webkit-scrollbar-thumb {
    background: #dcdfe6;
    border-radius: 3px;
  }

  /* 位置列：5个汉字宽，超出滑动显示 */
  .schedule-table th:nth-child(5),
  .schedule-table td:nth-child(5) {
    min-width: 5em;
    max-width: 5em;
    overflow-x: auto;
    white-space: nowrap;
    text-align: center;
  }

  .schedule-table td:nth-child(5)::-webkit-scrollbar {
    height: 3px;
  }

  .schedule-table td:nth-child(5)::-webkit-scrollbar-thumb {
    background: #dcdfe6;
    border-radius: 3px;
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
}

.full-view-table th,
.full-view-table td {
  padding: 12px;
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

.order-no {
  font-weight: 500;
  color: #303133;
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

/* PC端隐藏表格 */
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
</style>