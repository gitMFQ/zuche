<template>
  <div class="page-container" v-loading="loading">
    <el-page-header @back="goBack" title="返回" class="page-header">
      <template #content>
        <span class="order-title">订单详情</span>
      </template>
      <template #extra>
        <el-tag :type="getStatusType(order.status)" size="small">{{ order.status_text }}</el-tag>
      </template>
    </el-page-header>

    <div v-if="order.id" class="order-content">
      <OrderInfoSections
        :order="order"
        @assign-driver="driverDialogVisible = true"
        @add-payment="paymentDialogVisible = true"
        @preview="openPreview"
      />

      <!-- 操作按钮 -->
      <el-card shadow="never" class="info-card">
        <div class="action-buttons">
          <template v-if="order.status === 'pending'">
            <el-button type="primary" plain block @click="openEditDialog">编辑订单</el-button>
            <el-button type="success" block @click="pickupDialogVisible = true">已取车</el-button>
            <el-button type="danger" block @click="handleCancel">取消订单</el-button>
          </template>
          <template v-else-if="order.status === 'active'">
            <el-button type="primary" plain block @click="openEditDialog">编辑订单</el-button>
            <el-button type="warning" block @click="openExtendDialog">续租</el-button>
            <el-button type="success" block @click="completeDialogVisible = true">已还车</el-button>
            <el-button type="danger" block @click="handleCancel">取消订单</el-button>
          </template>
          <el-button v-else disabled block>订单已结束</el-button>
          <el-button type="danger" plain block @click="handleAddToBlacklist">拉黑客户</el-button>
        </div>
      </el-card>

      <!-- 危险操作 -->
      <el-card shadow="never" class="info-card">
        <el-button type="danger" plain block :loading="deleting" @click="handleDelete">删除订单</el-button>
      </el-card>
    </div>

    <!-- 指派司机对话框 -->
    <AssignDriverDialog
      v-model:visible="driverDialogVisible"
      :order="order"
      :submitting="driverSubmitting"
      @submit="submitDrivers"
    />

    <!-- 添加支付对话框 -->
    <PaymentDialog
      v-model:visible="paymentDialogVisible"
      :submitting="submitting"
      @submit="handlePaymentSubmit"
    />

    <!-- 取车对话框 -->
    <MileagePhotoDialog
      v-model:visible="pickupDialogVisible"
      type="pickup"
      :order="order"
      :submitting="submitting"
      @submit="handlePickupConfirm"
      @preview="openPreview"
    />

    <!-- 完成订单对话框 -->
    <MileagePhotoDialog
      v-model:visible="completeDialogVisible"
      type="return"
      :order="order"
      :submitting="submitting"
      title="完成订单"
      confirm-text="确定完成"
      time-label="实际还车时间"
      @submit="handleCompleteConfirm"
      @preview="openPreview"
    />

    <!-- 编辑订单对话框 -->
    <OrderFormDialog
      v-model:visible="editDialogVisible"
      :order="order"
      :vehicles="vehicles"
      :order-sources="orderSources"
      :submitting="submitting"
      phone-required
      vehicle-required
      inline-locations
      @submit="handleUpdateSubmit"
      @preview="openPreview"
    />

    <!-- 续租对话框 -->
    <ExtendDialog
      v-model:visible="extendDialogVisible"
      :order="order"
      :submitting="submitting"
      @submit="handleExtendConfirm"
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
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { orderApi, blacklistApi, vehicleApi } from '../api'
import { useDictStore } from '../stores/dict'
import ImagePreviewDialog from '../components/ImagePreviewDialog.vue'
import AssignDriverDialog from '../components/order/AssignDriverDialog.vue'
import ExtendDialog from '../components/order/ExtendDialog.vue'
import MileagePhotoDialog from '../components/order/MileagePhotoDialog.vue'
import OrderFormDialog from '../components/order/OrderFormDialog.vue'
import OrderInfoSections from '../components/order/OrderInfoSections.vue'
import PaymentDialog from '../components/order/PaymentDialog.vue'
import { formatDateTime, getOrderStatusType as getStatusType } from '../utils/helpers'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const submitting = ref(false)
const deleting = ref(false)
const order = ref<any>({})
const paymentDialogVisible = ref(false)
const completeDialogVisible = ref(false)
const pickupDialogVisible = ref(false)
const editDialogVisible = ref(false)
const extendDialogVisible = ref(false)
const driverDialogVisible = ref(false)
const driverSubmitting = ref(false)
const imagePreviewVisible = ref(false)
const previewImagesList = ref<string[]>([])
const previewIndex = ref(0)
const vehicles = ref<any[]>([])
// 订单来源走字典缓存；司机选项同理
const dictStore = useDictStore()
const orderSources = computed(() => dictStore.orderSources)

function openPreview(images: string[], index: number) {
  previewImagesList.value = images
  previewIndex.value = index
  imagePreviewVisible.value = true
}

async function submitDrivers(payload: { pickup_driver_id: string | null; return_driver_id: string | null }): Promise<void> {
  driverSubmitting.value = true
  try {
    await orderApi.assignDrivers(String(route.params.id), payload)
    ElMessage.success('司机指派成功')
    driverDialogVisible.value = false
    await loadOrder()
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    driverSubmitting.value = false
  }
}

async function loadOrder() {
  loading.value = true
  try {
    const res: any = await orderApi.getOne(route.params.id as string)
    if (res.success) {
      order.value = res.data
    }
  } catch (error) {
    console.error('加载订单失败', error)
    router.push('/orders')
  } finally {
    loading.value = false
  }
}

async function handleCancel() {
  try {
    await ElMessageBox.confirm('确定要取消该订单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const res: any = await orderApi.cancel(order.value.id)
    if (res.success) {
      ElMessage.success('订单已取消')
      loadOrder()
    }
  } catch (error) {
    // 用户取消操作
  }
}

async function handleDelete() {
  try {
    await ElMessageBox.confirm(
      `删除后订单 ${order.value.order_no} 及其支付、费用、续租记录将一并移除，无法恢复。`,
      '删除订单',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  deleting.value = true
  try {
    const res: any = await orderApi.delete(order.value.id)
    if (res.success) {
      ElMessage.success('订单已删除')
      void router.push('/orders')
    }
  } catch (error) {
    console.error('删除订单失败', error)
  } finally {
    deleting.value = false
  }
}

async function handleAddToBlacklist() {
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入拉黑原因', '添加到黑名单', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入拉黑原因',
      inputValidator: (val) => !!val?.trim() || '请输入拉黑原因'
    })
    
    const res: any = await blacklistApi.add({
      name: order.value.customer_name,
      phone: order.value.customer_phone,
      id_card: order.value.customer_id_card,
      reason: reason.trim()
    })
    
    if (res.success) {
      ElMessage.success('已添加到黑名单')
    }
  } catch (error) {
    // 取消
  }
}

// 加载可用车辆
async function loadVehicles() {
  try {
    const res: any = await vehicleApi.getList({ pageSize: 1000 })
    if (res.success) {
      vehicles.value = res.data.data
    }
  } catch (error) {
    console.error('加载车辆失败', error)
  }
}

// 加载订单来源
async function loadOrderSources() {
  await dictStore.ensureOrderSources()
}

// 打开编辑对话框
async function openEditDialog() {
  await Promise.all([loadVehicles(), loadOrderSources()])
  editDialogVisible.value = true
}

// 提交编辑
async function handleUpdateSubmit(payload: Record<string, unknown>) {
  submitting.value = true
  try {
    const res: any = await orderApi.update(order.value.id, payload)
    if (res.success) {
      ElMessage.success('订单修改成功')
      editDialogVisible.value = false
      loadOrder()
    }
  } catch (error: any) {
    // 换客户时命中黑名单：与新建订单同一套软拦截 + 二次确认
    if (error?.response?.data?.code === 'BLACKLISTED') {
      const record = error.response.data.data?.record ?? {}
      const confirmed = await confirmBlacklistedOrder(record)
      if (confirmed) {
        try {
          const retry: any = await orderApi.update(order.value.id, { ...payload, force: true })
          if (retry.success) {
            ElMessage.success('订单修改成功（黑名单客户，已记入日志）')
            editDialogVisible.value = false
            loadOrder()
          }
        } catch (retryError) {
          console.error('黑名单强制修改失败', retryError)
        }
      }
      return
    }
    console.error('修改失败', error)
  } finally {
    submitting.value = false
  }
}

/** 黑名单风险二次确认，用户点「仍然保存」才返回 true */
async function confirmBlacklistedOrder(record: any): Promise<boolean> {
  const lines = [
    `客户「${record.name ?? '未知'}」在黑名单中。`,
    `原因：${record.reason ?? '未填写'}`,
    record.created_at ? `拉黑时间：${formatDateTime(record.created_at)}` : '',
    record.operator_name ? `操作人：${record.operator_name}` : '',
    '',
    '确认要继续保存吗？此操作会记入操作日志。'
  ].filter((line) => line !== '')

  try {
    await ElMessageBox.confirm(lines.join('\n'), '风险提示', {
      confirmButtonText: '仍然保存',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'pre-line-message'
    })
    return true
  } catch {
    return false
  }
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
    
    const res: any = await orderApi.updateStatus(order.value.id, data)
    if (res.success) {
      ElMessage.success('取车成功')
      pickupDialogVisible.value = false
      loadOrder()
    }
  } catch (error) {
    console.error('取车失败', error)
  } finally {
    submitting.value = false
  }
}

// 确认完成订单（还车）
async function handleCompleteConfirm(payload: { mileage: number | undefined; image: string; datetime: string; remarks: string }) {
  submitting.value = true
  try {
    const res: any = await orderApi.updateStatus(order.value.id, {
      status: 'completed',
      actual_end_date: payload.datetime || undefined,
      remarks: payload.remarks || undefined,
      return_mileage: payload.mileage,
      return_image: payload.image || undefined
    })
    if (res.success) {
      ElMessage.success('订单已完成')
      completeDialogVisible.value = false
      loadOrder()
    }
  } catch (error) {
    console.error('完成订单失败', error)
  } finally {
    submitting.value = false
  }
}

// 添加支付
async function handlePaymentSubmit(payload: { amount: number; payment_method: string; payment_type: string; remarks: string }) {
  submitting.value = true
  try {
    const res: any = await orderApi.addPayment(order.value.id, payload)
    if (res.success) {
      ElMessage.success('支付记录添加成功')
      paymentDialogVisible.value = false
      loadOrder()
    }
  } catch (error) {
    console.error('添加支付失败', error)
  } finally {
    submitting.value = false
  }
}

// 打开续租对话框
function openExtendDialog() {
  extendDialogVisible.value = true
}

// 提交续租
async function handleExtendConfirm(payload: {
  new_end_date: string
  extend_amount: number
  has_payment: boolean
  payment_amount?: number
  payment_method?: string
}) {
  submitting.value = true
  try {
    const res: any = await orderApi.extend(order.value.id, payload)
    if (res.success) {
      ElMessage.success(`续租成功，续租金额 ¥${res.data.extend_amount}`)
      extendDialogVisible.value = false
      loadOrder()
    }
  } catch (error) {
    console.error('续租失败', error)
  } finally {
    submitting.value = false
  }
}

// 返回订单列表
function goBack() {
  router.back()
}

onMounted(async () => {
  await loadOrder()
  // 检查 URL 参数，如果 edit=1 则自动打开编辑对话框
  if (route.query.edit === '1') {
    await openEditDialog()
  }
})
</script>

<style scoped>
.page-container {
  max-width: 600px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 12px;
}

.order-title {
  font-size: 16px;
  font-weight: 500;
}

.order-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-card {
  margin-bottom: 0;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-buttons .el-button {
  width: 100%;
  margin: 0;
  justify-content: center;
}

/* 暗色模式 */
html.dark .detail-card {
  background: var(--bg-color-secondary);
}

html.dark .detail-label {
  color: var(--text-color-secondary);
}

html.dark .detail-value {
  color: var(--text-color);
}

html.dark .timeline-date,
html.dark .timeline-desc {
  color: var(--text-color-secondary);
}

html.dark .image-preview,
html.dark .image-item {
  border-color: var(--border-color);
}

html.dark .upload-btn {
  border-color: var(--border-color);
  color: var(--text-color-secondary);
}

html.dark .file-item {
  border-color: var(--border-color);
}

html.dark .text-muted {
  color: var(--text-color-secondary);
}
</style>
