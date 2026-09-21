<template>
  <!-- 订单信息 -->
  <el-card shadow="never" class="info-card">
    <template #header>
      <div class="card-header-row">
        <span class="section-title"><el-icon><Document /></el-icon> 订单信息</span>
        <el-tag :type="getStatusType(order.status)" size="large">{{ order.status_text }}</el-tag>
      </div>
    </template>

    <!-- 订单来源和状态 -->
    <div class="order-detail-header" v-if="order.source_name">
      <span class="source-tag" :style="{ background: order.source_color || '#0071e3' }">
        {{ order.source_name }}
      </span>
      <span class="order-no">{{ order.order_no }}</span>
    </div>
    <div class="order-detail-header" v-else>
      <span class="order-no">{{ order.order_no }}</span>
    </div>

    <!-- 信息列表 -->
    <div class="info-list">
      <div class="info-row">
        <span class="label">合同号</span>
        <span class="row-value">{{ order.contract_number || '-' }}</span>
      </div>
      <div class="info-row">
        <span class="label">创建时间</span>
        <span class="row-value">{{ formatDateTime(order.created_at) }}</span>
      </div>
      <div class="info-row" v-if="order.updated_at && order.updated_at !== order.created_at">
        <span class="label">更新时间</span>
        <span class="row-value">{{ formatDateTime(order.updated_at) }}</span>
      </div>
    </div>
  </el-card>

  <!-- 租期时间 -->
  <el-card shadow="never" class="info-card">
    <template #header>
      <span class="section-title"><el-icon><Clock /></el-icon> 租期时间</span>
    </template>

    <div class="info-list">
      <div class="info-row">
        <span class="label">取车时间</span>
        <span class="row-value">{{ formatDateTime(order.start_date) }}</span>
      </div>
      <div class="info-row">
        <span class="label">还车时间</span>
        <span class="row-value">{{ formatDateTime(order.end_date) }}</span>
      </div>
      <div class="info-row" v-if="order.actual_start_date">
        <span class="label">实际取车</span>
        <span class="row-value">{{ formatDateTime(order.actual_start_date) }}</span>
      </div>
      <div class="info-row" v-if="order.actual_end_date">
        <span class="label">实际还车</span>
        <span class="row-value">{{ formatDateTime(order.actual_end_date) }}</span>
      </div>
    </div>
  </el-card>

  <!-- 车辆信息 -->
  <el-card shadow="never" class="info-card">
    <template #header>
      <span class="section-title"><el-icon><Van /></el-icon> 车辆信息</span>
    </template>

    <div class="info-list">
      <div class="info-row">
        <span class="label">车牌号码</span>
        <span class="row-value">
          <span class="plate-number" :class="order.is_new_energy ? 'new-energy' : 'fuel'">{{ order.plate_number }}</span>
        </span>
      </div>
      <div class="info-row">
        <span class="label">车型</span>
        <span class="row-value">{{ order.brand }} {{ order.model }}</span>
      </div>
    </div>
  </el-card>

  <!-- 取还地点 -->
  <el-card shadow="never" class="info-card">
    <template #header>
      <div class="card-header-row">
        <span class="section-title"><el-icon><Location /></el-icon> 取还地点</span>
        <el-button type="primary" size="small" @click="emit('assign-driver')">指派司机</el-button>
      </div>
    </template>

    <div class="info-list">
      <div class="info-row" v-if="order.delivery_type">
        <span class="label">配送方式</span>
        <span class="row-value">{{ deliveryText(order.delivery_type) }}</span>
      </div>
      <div class="info-row">
        <span class="label">取车地点</span>
        <span class="row-value">{{ order.pickup_location || '-' }}</span>
      </div>
      <div class="info-row">
        <span class="label">还车地点</span>
        <span class="row-value">{{ order.return_location || '-' }}</span>
      </div>
      <div class="info-row" v-if="order.pickup_mileage">
        <span class="label">取车里程</span>
        <span class="row-value">{{ order.pickup_mileage }} km</span>
      </div>
      <div class="info-row" v-if="order.return_mileage">
        <span class="label">还车里程</span>
        <span class="row-value">{{ order.return_mileage }} km</span>
      </div>
      <div class="info-row" v-if="order.pickup_driver_name">
        <span class="label">取车司机</span>
        <span class="row-value">{{ order.pickup_driver_name }}</span>
      </div>
      <div class="info-row" v-if="order.return_driver_name">
        <span class="label">还车司机</span>
        <span class="row-value">{{ order.return_driver_name }}</span>
      </div>
    </div>
  </el-card>

  <!-- 客户信息 -->
  <el-card shadow="never" class="info-card">
    <template #header>
      <span class="section-title"><el-icon><User /></el-icon> 客户信息</span>
    </template>

    <div class="info-list">
      <div class="info-row">
        <span class="label">客户姓名</span>
        <span class="row-value">{{ order.customer_name }}</span>
      </div>
      <div class="info-row">
        <span class="label">联系电话</span>
        <span class="row-value"><el-link :href="'tel:' + order.customer_phone" type="primary" underline="always">{{ order.customer_phone }}</el-link></span>
      </div>
      <div class="info-row" v-if="order.id_card">
        <span class="label">身份证</span>
        <span class="row-value">{{ order.id_card }}</span>
      </div>
    </div>
  </el-card>

  <!-- 金额信息 -->
  <el-card shadow="never" class="info-card">
    <template #header>
      <span class="section-title"><el-icon><Money /></el-icon> 金额信息</span>
    </template>

    <div class="info-list">
      <div class="info-row highlight-row">
        <span class="label">订单总额</span>
        <span class="row-value amount">¥{{ order.total_amount }}</span>
      </div>
      <div class="info-row">
        <span class="label">日租金</span>
        <span class="row-value">¥{{ order.daily_rate }}</span>
      </div>
      <div class="info-row">
        <span class="label">押金</span>
        <span class="row-value">
          <template v-if="order.deposit_waived">
            <el-tag type="success" size="small">免押</el-tag>
            <span v-if="order.deposit_waived_expiry" class="deposit-expiry">至 {{ order.deposit_waived_expiry }}</span>
          </template>
          <template v-else>¥{{ order.deposit || 0 }}</template>
        </span>
      </div>
      <div class="info-row">
        <span class="label">服务类型</span>
        <span class="row-value">
          <el-tag :type="getServiceTagType(order.service_type)" size="small">{{ getServiceLabel(order.service_type) }}</el-tag>
        </span>
      </div>
      <div class="info-row" v-if="order.source_name && order.commission_rate > 0">
        <span class="label">服务费</span>
        <span class="row-value">{{ order.commission_rate }}%</span>
      </div>
      <div class="info-row" v-if="order.net_amount">
        <span class="label">到账金额</span>
        <span class="row-value text-success">¥{{ order.net_amount }}</span>
      </div>
      <div class="info-row">
        <span class="label">已付金额</span>
        <span class="row-value" :class="unpaidAmount > 0 ? 'text-warning' : 'text-success'">¥{{ order.paid_amount }}</span>
      </div>
      <div class="info-row" v-if="unpaidAmount > 0">
        <span class="label">待付金额</span>
        <span class="row-value text-danger">¥{{ unpaidAmount }}</span>
      </div>
      <div class="info-row" v-if="order.violation_deposit">
        <span class="label">违章押金</span>
        <span class="row-value">¥{{ order.violation_deposit }}</span>
      </div>
      <div class="info-row" v-if="order.platform">
        <span class="label">来源平台</span>
        <span class="row-value">{{ platformText(order.platform) }}</span>
      </div>
    </div>
  </el-card>

  <!-- 备注信息 -->
  <el-card shadow="never" class="info-card" v-if="order.remarks">
    <template #header>
      <span class="section-title"><el-icon><ChatDotRound /></el-icon> 备注信息</span>
    </template>
    <div class="remarks-content">{{ order.remarks }}</div>
  </el-card>

  <!-- 取还照片 -->
  <el-card shadow="never" class="info-card" v-if="order.pickup_image || order.return_image">
    <template #header>
      <span class="section-title"><el-icon><Picture /></el-icon> 取还照片</span>
    </template>

    <div class="order-images">
      <div v-if="order.pickup_image" class="image-section">
        <span class="image-label">取车照片</span>
        <img :src="getImageUrl(order.pickup_image)" class="order-image" @click="emit('preview', [order.pickup_image], 0)" alt="订单证件照片，点击可放大查看" />
      </div>
      <div v-if="order.return_image" class="image-section">
        <span class="image-label">还车照片</span>
        <img :src="getImageUrl(order.return_image)" class="order-image" @click="emit('preview', [order.return_image], 0)" alt="订单证件照片，点击可放大查看" />
      </div>
    </div>
  </el-card>

  <!-- 支付记录 -->
  <el-card shadow="never" class="info-card">
    <template #header>
      <div class="card-header-row">
        <span class="section-title">支付记录</span>
        <el-button
          v-if="['pending', 'active', 'completed'].includes(order.status)"
          type="primary"
          size="small"
          @click="emit('add-payment')"
        >添加</el-button>
      </div>
    </template>

    <div v-if="order.payments?.length" class="payment-list">
      <div v-for="p in order.payments" :key="p.id" class="payment-item">
        <div class="payment-row">
          <span class="payment-type">{{ getPaymentTypeText(p.payment_type) }}</span>
          <span class="payment-amount">¥{{ p.amount }}</span>
        </div>
        <div class="payment-row">
          <span class="payment-method">{{ getPaymentMethodText(p.payment_method) }}</span>
          <span class="payment-time">{{ formatDateTime(p.created_at) }}</span>
        </div>
      </div>
    </div>
    <el-empty v-else description="暂无支付记录" :image-size="60" />
  </el-card>

  <!-- 费用明细：平台账单拆到具体费用项，含应收/已收/退款 -->
  <el-card shadow="never" class="info-card" v-if="order.fees?.length">
    <template #header>
      <span class="section-title">费用明细</span>
    </template>

    <div class="fee-list">
      <div v-for="fee in order.fees" :key="fee.id" class="fee-item">
        <div class="fee-row">
          <span class="fee-name">{{ fee.fee_name }}</span>
          <span class="fee-amount">¥{{ fee.receivable }}</span>
        </div>
        <div class="fee-row">
          <span class="fee-category">{{ feeCategoryText(fee.fee_category) }}</span>
          <span class="fee-meta">
            已收 ¥{{ fee.received }}
            <template v-if="fee.refunded"> · 退款 ¥{{ fee.refunded }}</template>
          </span>
        </div>
      </div>
    </div>
  </el-card>

  <!-- 续租历史 -->
  <el-card shadow="never" class="info-card" v-if="order.extensions?.length">
    <template #header>
      <span class="section-title">续租历史</span>
    </template>

    <div class="fee-list">
      <div v-for="ext in order.extensions" :key="ext.id" class="fee-item">
        <div class="fee-row">
          <span class="fee-name">续租 {{ ext.extend_days }} 天</span>
          <span class="fee-amount">¥{{ ext.extend_amount }}</span>
        </div>
        <div class="fee-row">
          <span class="fee-category">原还车 {{ formatDateTime(ext.original_end_date) }}</span>
          <span class="fee-meta">延至 {{ formatDateTime(ext.new_end_date) }}</span>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChatDotRound, Clock, Document, Location, Money, Picture, User, Van } from '@element-plus/icons-vue'
import {
  DELIVERY_TYPE_TEXT_MAP,
  FEE_CATEGORY_TEXT_MAP,
  PLATFORM_TEXT_MAP
} from '../../utils/constants'
import {
  formatDateTime,
  getImageUrl,
  getOrderStatusType as getStatusType,
  getPaymentMethodText,
  getPaymentTypeText,
  getServiceLabel,
  getServiceTagType
} from '../../utils/helpers'

/** 订单详情的只读信息区（订单/租期/车辆/取还地点/客户/金额/备注/照片/支付/费用/续租），按数据分组渲染 */
const props = defineProps<{
  order: any
}>()

const emit = defineEmits<{
  (e: 'assign-driver'): void
  (e: 'add-payment'): void
  (e: 'preview', images: string[], index: number): void
}>()

const unpaidAmount = computed(() => {
  return (props.order.total_amount || 0) - (props.order.paid_amount || 0)
})

function deliveryText(type: string): string {
  return DELIVERY_TYPE_TEXT_MAP[type] ?? type
}

function platformText(platform: string): string {
  return PLATFORM_TEXT_MAP[platform] ?? platform
}

function feeCategoryText(category: string): string {
  return FEE_CATEGORY_TEXT_MAP[category] ?? category
}
</script>

<style scoped>
.info-card {
  margin-bottom: 0;
}

/* 分区标题样式 */
.section-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-title .el-icon {
  color: var(--primary-color);
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 订单头部 */
.order-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ebef 100%);
  border-radius: 8px;
  margin-bottom: 16px;
}

.order-no {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
}

.info-row:not(:last-child) {
  border-bottom: 1px dashed #ebeef5;
}

/* 高亮行样式 */
.info-row.highlight-row {
  background: linear-gradient(135deg, #fef0f0 0%, #fef7f7 100%);
  padding: 10px 12px;
  border-radius: 6px;
  margin: 0 -4px;
}

.info-row .label {
  color: var(--sk-color-info);
  font-size: 13px;
}

.info-row .row-value {
  color: #303133;
  font-weight: 500;
  text-align: right;
}

.info-row .row-value.amount {
  font-size: 18px;
  font-weight: 700;
  color: #f56c6c;
}

.info-row .value {
  color: #303133;
}

.info-row a {
  color: var(--primary-color);
  text-decoration: none;
}

/* 来源标签 */
.source-tag {
  color: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}

/* 备注内容 */
.remarks-content {
  padding: 12px;
  background-color: #fafafa;
  border-radius: 6px;
  color: #606266;
  line-height: 1.6;
}

/* 图片样式 */
.order-images {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.image-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.image-label {
  font-size: 13px;
  color: var(--sk-color-info);
}

.order-image {
  max-width: 200px;
  max-height: 150px;
  border-radius: 6px;
  cursor: pointer;
  transition: transform 0.2s;
}

.order-image:hover {
  transform: scale(1.05);
}

/* 支付记录样式 */
.payment-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.payment-item {
  background: #fafafa;
  border-radius: 6px;
  padding: 10px;
}

.payment-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.payment-row:last-child {
  margin-bottom: 0;
}

.payment-type {
  color: #303133;
  font-size: 14px;
}

.payment-amount {
  color: var(--primary-color);
  font-weight: 500;
}

.fee-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fee-item {
  background: #fafafa;
  border-radius: 6px;
  padding: 10px;
}

.fee-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.fee-row:last-child {
  margin-bottom: 0;
}

.fee-name {
  color: #303133;
  font-size: 14px;
}

.fee-amount {
  color: var(--primary-color);
  font-weight: 500;
}

.fee-category {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.48);
}

.fee-meta {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.48);
}

.payment-method, .payment-time {
  color: var(--sk-color-info);
  font-size: 12px;
}

/* 工具类 */
.text-primary { color: var(--primary-color); font-weight: 500; }
.text-success { color: var(--sk-color-success); }
.text-warning { color: var(--sk-color-warning); }
.text-danger { color: var(--sk-color-danger); font-weight: 500; }

/* 免押到期日期 */
.deposit-expiry {
  margin-left: 8px;
  color: var(--sk-color-info);
  font-size: 12px;
}

/* 取车还车照片 */
.order-images {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.order-images .image-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.order-images .image-label {
  font-size: 12px;
  color: var(--sk-color-info);
  margin-bottom: 8px;
}

.order-images .order-image {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid #dcdfe6;
}

.order-images .order-image:hover {
  border-color: var(--primary-color);
}

/* 来源标签 */
.source-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
}

/* 暗色模式 */
html.dark .order-detail-header {
  background: linear-gradient(135deg, var(--hover-bg-color) 0%, var(--bg-color-secondary) 100%);
}

html.dark .order-no {
  color: var(--text-color);
}

html.dark .info-row .label {
  color: var(--text-color-secondary);
}

html.dark .info-row .row-value {
  color: var(--text-color);
}

html.dark .info-row .row-value.amount {
  color: #f56c6c;
}

html.dark .info-row .value {
  color: var(--text-color);
}

html.dark .info-row:not(:last-child) {
  border-bottom-color: var(--border-color);
}

html.dark .info-row.highlight-row {
  background: linear-gradient(135deg, #3a3a3a 0%, #404040 100%);
}

html.dark .remarks-content {
  background-color: var(--bg-color-secondary);
  color: var(--text-color-secondary);
}

html.dark .payment-item {
  background: var(--bg-color-secondary);
}

html.dark .payment-type {
  color: var(--text-color);
}

html.dark .payment-amount {
  color: var(--primary-color);
}

html.dark .payment-method,
html.dark .payment-time {
  color: var(--text-color-secondary);
}

html.dark .image-label {
  color: var(--text-color-secondary);
}

html.dark .order-image {
  border-color: var(--border-color);
}

html.dark .section-title {
  color: var(--text-color);
}

html.dark .text-primary {
  color: var(--primary-color);
}

html.dark .text-success {
  color: var(--sk-color-success);
}

html.dark .text-warning {
  color: var(--sk-color-warning);
}

html.dark .text-danger {
  color: var(--sk-color-danger);
}

html.dark .text-muted {
  color: var(--text-color-secondary);
}
</style>
