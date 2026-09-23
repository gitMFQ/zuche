<template>
  <el-dialog v-model="dialogVisible" title="订单详情" width="90%" :style="{ maxWidth: '500px' }" :close-on-click-modal="false" class="order-detail-dialog">
    <div v-if="orderData" class="order-detail-content">
      <!-- 头部信息 -->
      <div class="order-detail-header">
        <div class="header-left">
          <span v-if="orderData.source_name" class="source-tag" :style="{ background: orderData.source_color || '#0071e3' }">
            {{ orderData.source_name }}
          </span>
          <el-tag :type="getStatusType(orderData.status)" size="small">
            {{ getStatusText(orderData.status) }}
          </el-tag>
        </div>
      </div>

      <!-- 时间信息 -->
      <div class="order-detail-section">
        <div class="section-title-compact"><el-icon><i class="weui-icon-outlined-time" /></el-icon> 租期时间</div>
        <div class="detail-row-compact">
          <span class="row-label-compact">取车</span>
          <span class="row-value-compact">{{ dayjs(orderData.startDateTime).format('MM-DD HH:mm') }}</span>
        </div>
        <div class="detail-row-compact">
          <span class="row-label-compact">还车</span>
          <span class="row-value-compact">{{ dayjs(orderData.endDateTime).format('MM-DD HH:mm') }}</span>
        </div>
      </div>

      <!-- 车辆信息 -->
      <div class="order-detail-section">
        <div class="section-title-compact"><el-icon><Van /></el-icon> 车辆</div>
        <div class="detail-row-compact">
          <span class="row-label-compact">车牌</span>
          <span class="row-value-compact">
            <span class="plate-number-compact" :class="orderData.is_new_energy ? 'new-energy' : 'fuel'">
              {{ orderData.plate_number }}
            </span>
          </span>
        </div>
        <div class="detail-row-compact">
          <span class="row-label-compact">车型</span>
          <span class="row-value-compact">{{ orderData.brand }} {{ orderData.model }}</span>
        </div>
      </div>

      <!-- 取还地点 -->
      <div class="order-detail-section" v-if="orderData.pickLocation || orderData.returnLocation">
        <div class="section-title-compact"><el-icon><i class="weui-icon-outlined-location" /></el-icon> 取还地点</div>
        <div class="detail-row-compact">
          <span class="row-label-compact">取车</span>
          <span class="row-value-compact">{{ orderData.pickLocation || '-' }}</span>
        </div>
        <div class="detail-row-compact">
          <span class="row-label-compact">还车</span>
          <span class="row-value-compact">{{ orderData.returnLocation || '-' }}</span>
        </div>
      </div>

      <!-- 客户信息 -->
      <div class="order-detail-section">
        <div class="section-title-compact"><el-icon><i class="weui-icon-outlined-me" /></el-icon> 客户</div>
        <div class="detail-row-compact">
          <span class="row-label-compact">姓名</span>
          <span class="row-value-compact">{{ orderData.name }}</span>
        </div>
        <div class="detail-row-compact">
          <span class="row-label-compact">电话</span>
          <span class="row-value-compact"><el-link :href="`tel:${orderData.phone}`" type="primary" underline="never">{{ orderData.phone }}</el-link></span>
        </div>
      </div>

      <!-- 金额信息 -->
      <div class="order-detail-section">
        <div class="section-title-compact"><el-icon><Money /></el-icon> 金额</div>
        <div class="detail-row-compact highlight-compact">
          <span class="row-label-compact">订单金额</span>
          <span class="row-value-compact amount-compact">¥{{ orderData.rmb }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer-compact">
        <el-button type="primary" plain size="small" @click="emit('edit')" v-if="['pending', 'active'].includes(orderData?.status)">编辑</el-button>
        <el-button type="success" size="small" @click="emit('pickup')" v-if="orderData?.status === 'pending'">取车</el-button>
        <el-button type="warning" size="small" @click="emit('complete')" v-if="orderData?.status === 'active'">还车</el-button>
        <el-button type="primary" size="small" @click="emit('detail')">详情</el-button>
        <el-button size="small" @click="dialogVisible = false">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import dayjs from 'dayjs'
import { Money, Van } from '@element-plus/icons-vue'

const props = defineProps<{
  visible: boolean
  order: any
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'edit'): void
  (e: 'pickup'): void
  (e: 'complete'): void
  (e: 'detail'): void
}>()

const dialogVisible = ref(false)
const orderData = ref<any>(null)

watch(() => props.visible, (val) => {
  dialogVisible.value = val
})

watch(() => props.order, (val) => {
  orderData.value = val ?? null
}, { immediate: true, deep: true })

watch(dialogVisible, (val) => {
  emit('update:visible', val)
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
</script>

<style scoped>
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

html.dark .order-detail-header {
  background-color: var(--sk-surface-dark-1);
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
  background: linear-gradient(
    135deg,
    rgba(var(--sk-focus-color-rgb), 0.05) 0%,
    rgba(var(--sk-focus-color-rgb), 0.02) 100%
  );
  padding: 10px 12px;
  border-radius: 6px;
  margin: 0 -4px;
}

html.dark .highlight-compact {
  background: linear-gradient(
    135deg,
    rgba(var(--sk-focus-color-rgb), 0.1) 0%,
    rgba(var(--sk-focus-color-rgb), 0.05) 100%
  );
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

/* 移动端这个弹窗就是 WeUI 底部 sheet：footer 交给全局那套「文字按钮 + 竖 hairline」，
   桌面端「右对齐小按钮簇」（flex-end + gap + max-width 90px / ≤480px 的 70px）不要生效。
   display: contents 让按钮直接成为 .el-dialog__footer 的 flex item，才能吃上全局规则 */
@media (max-width: 767px) {
  .dialog-footer-compact {
    display: contents;
  }

  .dialog-footer-compact .el-button {
    flex: 1 1 25%;
    min-width: 0;
    max-width: none;
    padding: 20px 8px;
    font-size: 17px;
  }

  /* 4 个按钮一行时，全局那条 :nth-child(3n + 1)（为换行准备的）会把第 4 个的左线去掉 */
  .dialog-footer-compact .el-button:nth-child(4) {
    border-left: 1px solid var(--m-line);
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

html.dark .order-detail-dialog :deep(.el-dialog__header) {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

html.dark .order-detail-dialog :deep(.el-dialog__footer) {
  border-top-color: rgba(255, 255, 255, 0.08);
}
</style>
