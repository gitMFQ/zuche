<template>
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
</template>

<script setup lang="ts">
import { Document, Money, User, Van } from '@element-plus/icons-vue'

defineProps<{
  stats: {
    vehicles?: { total?: number; available?: number; rented?: number }
    orders?: { total?: number; active?: number }
    customerCount?: number
    monthIncome?: number
  }
}>()

function formatMoney(value?: number) {
  return (value || 0).toLocaleString()
}
</script>

<style scoped>
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
  color: var(--sk-color-info);
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
  color: var(--sk-color-info);
}

/* 暗色模式 */
html.dark .stat-value {
  color: var(--text-color);
}

html.dark .stat-label,
html.dark .stat-footer {
  color: var(--text-color-secondary);
}

html.dark .stat-footer {
  border-top-color: var(--border-color);
}
</style>
