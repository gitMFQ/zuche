<template>
  <div class="page-container" v-loading="loading">
    <el-page-header @back="$router.back()" title="返回" class="page-header">
      <template #content>
        <span class="order-title">订单详情</span>
      </template>
      <template #extra>
        <el-tag :type="getStatusType(order.status)" size="small">{{ order.status_text }}</el-tag>
      </template>
    </el-page-header>

    <div v-if="order.id" class="order-content">
      <!-- 订单信息 -->
      <el-card shadow="never" class="info-card">
        <template #header>
          <span class="section-title">订单信息</span>
        </template>
        
        <!-- 移动端信息列表 -->
        <div class="info-list">
          <div class="info-row">
            <span class="label">订单号</span>
            <span class="value">{{ order.order_no }}</span>
          </div>
          <div class="info-row">
            <span class="label">客户</span>
            <span class="value">{{ order.customer_name }}</span>
          </div>
          <div class="info-row">
            <span class="label">电话</span>
            <span class="value"><a :href="'tel:' + order.customer_phone">{{ order.customer_phone }}</a></span>
          </div>
          <div class="info-row" v-if="order.id_card">
            <span class="label">身份证</span>
            <span class="value">{{ order.id_card }}</span>
          </div>
          <div class="info-row">
            <span class="label">车辆</span>
            <span class="value">{{ order.plate_number }} | {{ order.brand }} {{ order.model }}</span>
          </div>
          <div class="info-row">
            <span class="label">起租日期</span>
            <span class="value">{{ order.start_date }}</span>
          </div>
          <div class="info-row">
            <span class="label">还车日期</span>
            <span class="value">{{ order.end_date }}</span>
          </div>
          <div class="info-row">
            <span class="label">日租金</span>
            <span class="value">¥{{ order.daily_rate }}</span>
          </div>
          <div class="info-row">
            <span class="label">总金额</span>
            <span class="value text-primary">¥{{ order.total_amount }}</span>
          </div>
          <div class="info-row" v-if="order.source_name">
            <span class="label">订单来源</span>
            <span class="value">{{ order.source_name }}</span>
          </div>
          <div class="info-row" v-if="order.commission_rate > 0">
            <span class="label">平台抽成</span>
            <span class="value">{{ order.commission_rate }}%</span>
          </div>
          <div class="info-row" v-if="order.net_amount">
            <span class="label">到账金额</span>
            <span class="value text-success">¥{{ order.net_amount }}</span>
          </div>
          <div class="info-row">
            <span class="label">已付金额</span>
            <span class="value" :class="unpaidAmount > 0 ? 'text-warning' : 'text-success'">¥{{ order.paid_amount }}</span>
          </div>
          <div class="info-row" v-if="unpaidAmount > 0">
            <span class="label">待付金额</span>
            <span class="value text-danger">¥{{ unpaidAmount }}</span>
          </div>
        </div>
      </el-card>

      <!-- 支付记录 -->
      <el-card shadow="never" class="info-card">
        <template #header>
          <div class="card-header-row">
            <span class="section-title">支付记录</span>
            <el-button 
              v-if="['pending', 'active'].includes(order.status)" 
              type="primary" 
              size="small"
              @click="paymentDialogVisible = true"
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

      <!-- 操作按钮 -->
      <el-card shadow="never" class="info-card">
        <div class="action-buttons">
          <template v-if="order.status === 'pending'">
            <el-button type="primary" plain block @click="openEditDialog">编辑订单</el-button>
            <el-button type="success" block @click="handleStatusChange('active')">已取车</el-button>
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
    </div>

    <!-- 添加支付对话框 -->
    <el-dialog v-model="paymentDialogVisible" title="添加支付" width="90%" :style="{ maxWidth: '400px' }">
      <el-form ref="paymentFormRef" :model="paymentForm" :rules="paymentRules" label-width="70px">
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="paymentForm.amount" :min="0" :precision="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="方式" prop="payment_method">
          <el-select v-model="paymentForm.payment_method" style="width: 100%">
            <el-option label="现金" value="cash" />
            <el-option label="微信" value="wechat" />
            <el-option label="支付宝" value="alipay" />
            <el-option label="银行卡" value="bank" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型" prop="payment_type">
          <el-select v-model="paymentForm.payment_type" style="width: 100%">
            <el-option label="租金" value="rental" />
            <el-option label="押金" value="deposit" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="paymentForm.remarks" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="paymentDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAddPayment" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 完成订单对话框 -->
    <el-dialog v-model="completeDialogVisible" title="完成订单" width="90%" :style="{ maxWidth: '400px' }">
      <el-form ref="completeFormRef" :model="completeForm" label-width="90px">
        <el-form-item label="实际还车日期">
          <el-date-picker v-model="completeForm.actual_end_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
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

    <!-- 编辑订单对话框 -->
    <el-dialog v-model="editDialogVisible" title="编辑订单" width="90%" :style="{ maxWidth: '500px' }">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="70px" size="default">
        <el-divider content-position="left">客户信息</el-divider>
        <el-form-item label="姓名" prop="customer_name">
          <el-input v-model="editForm.customer_name" placeholder="客户姓名" />
        </el-form-item>
        <el-form-item label="手机" prop="customer_phone">
          <el-input v-model="editForm.customer_phone" placeholder="手机号" type="tel" />
        </el-form-item>
        <el-form-item label="身份证">
          <el-input v-model="editForm.customer_id_card" placeholder="身份证号（可选）" />
        </el-form-item>
        <el-form-item label="驾照">
          <el-input v-model="editForm.customer_license" placeholder="驾驶证号（可选）" />
        </el-form-item>
        
        <el-divider content-position="left">车辆信息</el-divider>
        <el-form-item label="车辆" prop="vehicle_id">
          <el-select 
            v-model="editForm.vehicle_id" 
            placeholder="选择车辆" 
            style="width: 100%" 
            :disabled="order.status === 'active'"
            @change="onVehicleChange"
          >
            <el-option 
              v-for="v in vehicles" 
              :key="v.id" 
              :label="`${v.plate_number} - ${v.brand} ${v.model} (¥${v.daily_rate}/天)`" 
              :value="v.id" 
            />
          </el-select>
        </el-form-item>
        
        <el-divider content-position="left">租期信息</el-divider>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="起租" prop="start_date">
              <el-date-picker v-model="editForm.start_date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="还车" prop="end_date">
              <el-date-picker v-model="editForm.end_date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="日租金">
              <el-input-number v-model="editForm.daily_rate" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="押金">
              <el-input-number v-model="editForm.deposit" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="订单来源">
          <el-select v-model="editForm.source_id" placeholder="选择订单来源（可选）" style="width: 100%" clearable>
            <el-option 
              v-for="s in orderSources" 
              :key="s.id" 
              :label="`${s.name} (${s.commission_rate}%抽成)`" 
              :value="s.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.remarks" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
        <el-form-item label="预估">
          <span class="estimate">{{ editEstimatedDays }} 天，共 ¥{{ editEstimatedTotal }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleEditSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 续租对话框 -->
    <el-dialog v-model="extendDialogVisible" title="续租" width="90%" :style="{ maxWidth: '400px' }">
      <el-form :model="extendForm" label-width="70px">
        <el-form-item label="当前还车">
          <span>{{ order.end_date }}</span>
        </el-form-item>
        <el-form-item label="续租天数">
          <el-input-number v-model="extendForm.extend_days" :min="1" :max="90" style="width: 100%" />
        </el-form-item>
        <el-form-item label="日租金">
          <el-input-number v-model="extendForm.daily_rate" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="续租金额">
          <span class="text-primary">¥{{ extendAmount }}</span>
        </el-form-item>
        <el-form-item label="新还车日">
          <span>{{ newEndDate }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="extendDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleExtend" :loading="submitting">确定续租</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { orderApi, blacklistApi, vehicleApi, orderSourceApi } from '../api'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const submitting = ref(false)
const order = ref<any>({})
const paymentDialogVisible = ref(false)
const completeDialogVisible = ref(false)
const editDialogVisible = ref(false)
const extendDialogVisible = ref(false)
const paymentFormRef = ref<FormInstance>()
const editFormRef = ref<FormInstance>()
const vehicles = ref<any[]>([])
const orderSources = ref<any[]>([])

const paymentForm = reactive({
  amount: 0,
  payment_method: 'cash',
  payment_type: 'rental',
  remarks: ''
})

const paymentRules: FormRules = {
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  payment_method: [{ required: true, message: '请选择支付方式', trigger: 'change' }],
  payment_type: [{ required: true, message: '请选择支付类型', trigger: 'change' }]
}

const completeForm = reactive({
  actual_end_date: '',
  remarks: ''
})

const editForm = reactive({
  customer_name: '',
  customer_phone: '',
  customer_id_card: '',
  customer_license: '',
  vehicle_id: '',
  source_id: '',
  start_date: '',
  end_date: '',
  daily_rate: 200,
  deposit: 0,
  remarks: ''
})

const editRules: FormRules = {
  customer_name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
  customer_phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  vehicle_id: [{ required: true, message: '请选择车辆', trigger: 'change' }],
  start_date: [{ required: true, message: '请选择起租日期', trigger: 'change' }],
  end_date: [{ required: true, message: '请选择还车日期', trigger: 'change' }]
}

const extendForm = reactive({
  extend_days: 1,
  daily_rate: 200
})

const statusTypeMap: Record<string, string> = {
  pending: 'warning',
  active: 'primary',
  completed: 'success',
  cancelled: 'info',
  overdue: 'danger'
}

function getStatusType(status: string) {
  return statusTypeMap[status] || 'info'
}

function getPaymentTypeText(type: string) {
  const map: Record<string, string> = { rental: '租金', deposit: '押金', other: '其他' }
  return map[type] || type
}

function getPaymentMethodText(method: string) {
  const map: Record<string, string> = { cash: '现金', wechat: '微信', alipay: '支付宝', bank: '银行卡' }
  return map[method] || method
}

const unpaidAmount = computed(() => {
  return (order.value.total_amount || 0) - (order.value.paid_amount || 0)
})

const editEstimatedDays = computed(() => {
  if (editForm.start_date && editForm.end_date) {
    const start = new Date(editForm.start_date)
    const end = new Date(editForm.end_date)
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }
  return 0
})

const editEstimatedTotal = computed(() => {
  return editEstimatedDays.value * editForm.daily_rate
})

const extendAmount = computed(() => {
  return extendForm.extend_days * extendForm.daily_rate
})

const newEndDate = computed(() => {
  if (order.value.end_date) {
    const date = new Date(order.value.end_date)
    date.setDate(date.getDate() + extendForm.extend_days)
    return date.toISOString().slice(0, 10)
  }
  return ''
})

function formatDateTime(date: string) {
  return dayjs(date).format('MM-DD HH:mm')
}

async function loadOrder() {
  loading.value = true
  try {
    const res: any = await orderApi.getOne(route.params.id as string)
    if (res.success) {
      order.value = res.data
      completeForm.actual_end_date = dayjs().format('YYYY-MM-DD')
    }
  } catch (error) {
    console.error('加载订单失败', error)
    router.push('/orders')
  } finally {
    loading.value = false
  }
}

async function handleStatusChange(status: string) {
  try {
    const res: any = await orderApi.updateStatus(order.value.id, { status })
    if (res.success) {
      ElMessage.success('状态更新成功')
      loadOrder()
    }
  } catch (error) {
    console.error('更新失败', error)
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

async function handleAddPayment() {
  const valid = await paymentFormRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    const res: any = await orderApi.addPayment(order.value.id, paymentForm)
    if (res.success) {
      ElMessage.success('支付记录添加成功')
      paymentDialogVisible.value = false
      paymentForm.amount = 0
      paymentForm.remarks = ''
      loadOrder()
    }
  } catch (error) {
    console.error('添加支付失败', error)
  } finally {
    submitting.value = false
  }
}

async function handleComplete() {
  submitting.value = true
  try {
    const res: any = await orderApi.updateStatus(order.value.id, {
      status: 'completed',
      actual_end_date: completeForm.actual_end_date || undefined,
      remarks: completeForm.remarks || undefined
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

// 拉黑客户
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
  try {
    const res: any = await orderSourceApi.getList({ pageSize: 100 })
    if (res.success) {
      // 后端返回的是 data 数组，不是 data.data
      orderSources.value = Array.isArray(res.data) ? res.data : (res.data.data || [])
    }
  } catch (error) {
    console.error('加载订单来源失败', error)
  }
}

// 打开编辑对话框
async function openEditDialog() {
  await Promise.all([loadVehicles(), loadOrderSources()])
  Object.assign(editForm, {
    customer_name: order.value.customer_name,
    customer_phone: order.value.customer_phone,
    customer_id_card: order.value.customer_id_card || '',
    customer_license: order.value.customer_license || '',
    vehicle_id: order.value.vehicle_id,
    source_id: order.value.source_id || '',
    start_date: order.value.start_date,
    end_date: order.value.end_date,
    daily_rate: order.value.daily_rate,
    deposit: order.value.deposit || 0,
    remarks: order.value.remarks || ''
  })
  editDialogVisible.value = true
}

// 车辆选择变化
function onVehicleChange(id: string) {
  const vehicle = vehicles.value.find(v => v.id === id)
  if (vehicle) {
    editForm.daily_rate = vehicle.daily_rate
    editForm.deposit = vehicle.deposit
  }
}

// 提交编辑
async function handleEditSubmit() {
  const valid = await editFormRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    const res: any = await orderApi.update(order.value.id, editForm)
    if (res.success) {
      ElMessage.success('订单修改成功')
      editDialogVisible.value = false
      loadOrder()
    }
  } catch (error) {
    console.error('修改失败', error)
  } finally {
    submitting.value = false
  }
}

// 打开续租对话框
function openExtendDialog() {
  extendForm.extend_days = 1
  extendForm.daily_rate = order.value.daily_rate
  extendDialogVisible.value = true
}

// 提交续租
async function handleExtend() {
  submitting.value = true
  try {
    const res: any = await orderApi.extend(order.value.id, {
      extend_days: extendForm.extend_days,
      daily_rate: extendForm.daily_rate
    })
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

onMounted(() => loadOrder())
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

.section-title {
  font-weight: 500;
  font-size: 14px;
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  padding: 4px 0;
}

.info-row .label {
  color: #909399;
}

.info-row .value {
  color: #303133;
}

.info-row a {
  color: #409EFF;
  text-decoration: none;
}

.text-primary { color: #409EFF; font-weight: 500; }
.text-success { color: #67C23A; }
.text-warning { color: #E6A23C; }
.text-danger { color: #F56C6C; font-weight: 500; }

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
  color: #409EFF;
  font-weight: 500;
}

.payment-method, .payment-time {
  color: #909399;
  font-size: 12px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.estimate {
  font-weight: 500;
  color: #409EFF;
}

:deep(.el-divider__text) {
  font-size: 13px;
  color: #909399;
  padding: 0 10px;
}
</style>