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

    <!-- 即将到期订单 -->
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
            <span class="order-no">{{ item.order_no }}</span>
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
        <el-table-column prop="order_no" label="订单号" width="140" />
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dashboardApi } from '../api'
import dayjs from 'dayjs'

const stats = ref<any>({
  vehicles: {},
  orders: {},
  customerCount: 0,
  monthIncome: 0,
  recentOrders: [],
  expiringOrders: []
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

onMounted(async () => {
  try {
    const res: any = await dashboardApi.getStats()
    if (res.success) {
      stats.value = res.data
    }
  } catch (error) {
    console.error('获取统计数据失败', error)
  }
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