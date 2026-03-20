<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm" size="default">
        <el-form-item>
          <el-input v-model="searchForm.keyword" placeholder="订单号/客户/车牌" clearable @keyup.enter="loadData" style="width: 150px" />
        </el-form-item>
        <el-form-item>
          <el-select v-model="searchForm.status" placeholder="状态" clearable style="width: 90px">
            <el-option label="待确认" value="pending" />
            <el-option label="进行中" value="active" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">搜索</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 操作栏 -->
    <div class="action-bar">
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon> 新建订单
      </el-button>
    </div>

    <!-- 移动端卡片列表 -->
    <div class="mobile-cards">
      <div v-for="item in tableData" :key="item.id" class="mobile-card" @click="$router.push(`/orders/${item.id}`)">
        <div class="mobile-card-header">
          <span class="order-no">{{ item.order_no }}</span>
          <el-tag :type="getStatusType(item.status)" size="small">{{ item.status_text }}</el-tag>
        </div>
        <div class="mobile-card-row">
          <span class="label">客户</span>
          <span class="value">{{ item.customer_name }} <a :href="'tel:' + item.customer_phone">{{ item.customer_phone }}</a></span>
        </div>
        <div class="mobile-card-row">
          <span class="label">车辆</span>
          <span class="value">{{ item.plate_number }} | {{ item.brand }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">日期</span>
          <span class="value">{{ item.start_date }} ~ {{ item.end_date }}</span>
        </div>
        <div class="mobile-card-footer">
          <span class="amount">¥{{ item.total_amount }}</span>
          <div class="footer-actions">
            <span class="paid" :class="{ 'text-warning': item.paid_amount < item.total_amount }">
              已付 ¥{{ item.paid_amount }}
            </span>
            <el-button type="danger" size="small" @click.stop="handleAddToBlacklist(item)">拉黑</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- PC端表格 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" v-loading="loading" stripe class="hide-mobile" @row-click="handleRowClick">
        <el-table-column prop="order_no" label="订单号" width="140" />
        <el-table-column prop="customer_name" label="客户" width="80" />
        <el-table-column prop="customer_phone" label="电话" width="110" />
        <el-table-column prop="plate_number" label="车牌" width="80" />
        <el-table-column prop="start_date" label="起租" width="100" />
        <el-table-column prop="end_date" label="还车" width="100" />
        <el-table-column prop="total_amount" label="总金额" width="90">
          <template #default="{ row }">¥{{ row.total_amount }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ row.status_text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="140">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click.stop="$router.push(`/orders/${row.id}`)">详情</el-button>
            <el-button type="danger" link size="small" @click.stop="handleAddToBlacklist(row)">拉黑</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, prev, pager, next"
        background
        class="pagination"
        @size-change="loadData"
        @current-change="loadData"
      />
    </el-card>

    <!-- 新建订单对话框 -->
    <el-dialog v-model="dialogVisible" title="新建订单" width="90%" :style="{ maxWidth: '500px' }">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="70px" size="default">
        <el-divider content-position="left">客户信息</el-divider>
        <el-form-item label="姓名" prop="customer_name">
          <el-input v-model="form.customer_name" placeholder="客户姓名" />
        </el-form-item>
        <el-form-item label="手机" prop="customer_phone">
          <el-input v-model="form.customer_phone" placeholder="手机号" type="tel" @blur="checkBlacklist" />
        </el-form-item>
        <el-alert 
          v-if="blacklistWarning" 
          :title="blacklistWarning" 
          type="warning" 
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        >
          <template #default>
            <span>拉黑原因：{{ blacklistReason }}</span>
            <el-button type="warning" size="small" link @click="addToBlacklistFromOrder">继续下单并拉黑</el-button>
          </template>
        </el-alert>
        <el-form-item label="身份证">
          <el-input v-model="form.customer_id_card" placeholder="身份证号（可选）" />
        </el-form-item>
        <el-form-item label="驾照">
          <el-input v-model="form.customer_license" placeholder="驾驶证号（可选）" />
        </el-form-item>
        
        <el-divider content-position="left">车辆信息</el-divider>
        <el-form-item label="车辆" prop="vehicle_id">
          <el-select v-model="form.vehicle_id" placeholder="选择车辆" style="width: 100%" @change="onVehicleChange">
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
              <el-date-picker v-model="form.start_date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="还车" prop="end_date">
              <el-date-picker v-model="form.end_date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="日租金">
              <el-input-number v-model="form.daily_rate" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="押金">
              <el-input-number v-model="form.deposit" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-divider content-position="left">订单来源</el-divider>
        <el-form-item label="来源" prop="source_id">
          <el-select v-model="form.source_id" placeholder="选择订单来源" style="width: 100%">
            <el-option 
              v-for="s in orderSources" 
              :key="s.id" 
              :label="`${s.name} (${s.commission_rate}%抽成)`" 
              :value="s.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remarks" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
        <el-form-item label="预估">
          <span class="estimate">{{ estimatedDays }} 天，共 ¥{{ estimatedTotal }}</span>
          <span v-if="selectedSource" class="net-amount">，到账 ¥{{ netAmount }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { orderApi, vehicleApi, blacklistApi, orderSourceApi } from '../api'

const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const vehicles = ref<any[]>([])
const orderSources = ref<any[]>([])
const blacklistWarning = ref('')
const blacklistReason = ref('')

const searchForm = reactive({ keyword: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
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

const rules: FormRules = {
  customer_name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
  customer_phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  vehicle_id: [{ required: true, message: '请选择车辆', trigger: 'change' }],
  source_id: [{ required: true, message: '请选择订单来源', trigger: 'change' }],
  start_date: [{ required: true, message: '请选择起租日期', trigger: 'change' }],
  end_date: [{ required: true, message: '请选择还车日期', trigger: 'change' }]
}

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

const estimatedDays = computed(() => {
  if (form.start_date && form.end_date) {
    const start = new Date(form.start_date)
    const end = new Date(form.end_date)
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }
  return 0
})

const estimatedTotal = computed(() => {
  return estimatedDays.value * form.daily_rate
})

const selectedSource = computed(() => {
  return orderSources.value.find(s => s.id === form.source_id)
})

const netAmount = computed(() => {
  if (selectedSource.value) {
    const rate = selectedSource.value.commission_rate || 0
    return Math.round(estimatedTotal.value * (100 - rate) / 100)
  }
  return estimatedTotal.value
})

async function loadData() {
  loading.value = true
  try {
    const res: any = await orderApi.getList({ ...searchForm, ...pagination })
    if (res.success) {
      tableData.value = res.data.data
      pagination.total = res.data.total
    }
  } catch (error) {
    console.error('加载数据失败', error)
  } finally {
    loading.value = false
  }
}

async function loadVehicles() {
  try {
    const res: any = await vehicleApi.getAvailable()
    if (res.success) {
      vehicles.value = res.data
    }
  } catch (error) {
    console.error('加载车辆失败', error)
  }
}

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

function openDialog() {
  Object.assign(form, {
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
  blacklistWarning.value = ''
  blacklistReason.value = ''
  loadVehicles()
  loadOrderSources()
  dialogVisible.value = true
}

// 检查黑名单
async function checkBlacklist() {
  if (!form.customer_phone || !/^1[3-9]\d{9}$/.test(form.customer_phone)) {
    blacklistWarning.value = ''
    blacklistReason.value = ''
    return
  }
  
  try {
    const res: any = await blacklistApi.check({ phone: form.customer_phone })
    if (res.success && res.data.isBlacklisted) {
      blacklistWarning.value = `该客户在黑名单中！`
      blacklistReason.value = res.data.record?.reason || '未知'
    } else {
      blacklistWarning.value = ''
      blacklistReason.value = ''
    }
  } catch (error) {
    console.error('检查黑名单失败', error)
  }
}

// 从订单添加到黑名单
async function addToBlacklistFromOrder() {
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入拉黑原因', '添加到黑名单', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: '其他问题',
      inputValidator: (val) => !!val || '请输入拉黑原因'
    })
    
    const res: any = await blacklistApi.add({
      name: form.customer_name,
      phone: form.customer_phone,
      id_card: form.customer_id_card,
      reason
    })
    
    if (res.success) {
      ElMessage.success('已添加到黑名单')
      blacklistWarning.value = ''
    }
  } catch (error) {
    // 取消
  }
}

function onVehicleChange(id: string) {
  const vehicle = vehicles.value.find(v => v.id === id)
  if (vehicle) {
    form.daily_rate = vehicle.daily_rate
    form.deposit = vehicle.deposit
  }
}

function onSourceChange() {
  // 来源变化时自动重新计算到账金额
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    const res: any = await orderApi.create(form)
    if (res.success) {
      ElMessage.success('订单创建成功')
      dialogVisible.value = false
      loadData()
    }
  } catch (error) {
    console.error('创建失败', error)
  } finally {
    submitting.value = false
  }
}

function handleRowClick(row: any) {
  router.push(`/orders/${row.id}`)
}

// 从订单列表拉黑客户
async function handleAddToBlacklist(row: any) {
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入拉黑原因', '添加到黑名单', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入拉黑原因',
      inputValidator: (val) => !!val?.trim() || '请输入拉黑原因'
    })
    
    const res: any = await blacklistApi.add({
      name: row.customer_name,
      phone: row.customer_phone,
      id_card: row.customer_id_card,
      reason: reason.trim()
    })
    
    if (res.success) {
      ElMessage.success('已添加到黑名单')
    }
  } catch (error) {
    // 取消
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
}

.search-card {
  margin-bottom: 12px;
}

.search-card :deep(.el-form-item) {
  margin-bottom: 8px;
}

@media (min-width: 768px) {
  .search-card {
    margin-bottom: 16px;
  }
  
  .search-card :deep(.el-form-item) {
    margin-bottom: 0;
  }
}

.action-bar {
  margin-bottom: 12px;
}

.mobile-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.mobile-card {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  cursor: pointer;
}

.mobile-card:active {
  background: #f5f5f5;
}

.mobile-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.order-no {
  font-size: 14px;
  font-weight: 600;
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

.mobile-card-row a {
  color: #409EFF;
  text-decoration: none;
  margin-left: 8px;
}

.mobile-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
  font-size: 14px;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.amount {
  font-weight: 600;
  color: #303133;
}

.paid {
  color: #67C23A;
}

.text-warning {
  color: #E6A23C;
}

.estimate {
  font-weight: 500;
  color: #409EFF;
}

.net-amount {
  font-weight: 500;
  color: #67C23A;
  margin-left: 8px;
}

.hide-mobile {
  display: none;
}

.table-card {
  display: none;
}

@media (min-width: 768px) {
  .mobile-cards {
    display: none;
  }
  
  .table-card {
    display: block;
  }
  
  .hide-mobile {
    display: table;
  }
  
  :deep(.el-table__row) {
    cursor: pointer;
  }
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

:deep(.el-divider__text) {
  font-size: 13px;
  color: #909399;
  padding: 0 10px;
}
</style>
