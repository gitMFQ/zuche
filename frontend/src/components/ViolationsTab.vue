<template>
  <div class="violations-tab">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm" size="default">
        <el-form-item>
          <el-input v-model="searchForm.keyword" placeholder="客户/车牌" clearable @keyup.enter="loadData" style="width: 130px" />
        </el-form-item>
        <el-form-item>
          <el-select v-model="searchForm.status" placeholder="状态" clearable style="width: 90px">
            <el-option label="待处理" value="pending" />
            <el-option label="处理中" value="processing" />
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
        <el-icon><Plus /></el-icon> 添加违章
      </el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card warning">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">待处理</div>
      </div>
      <div class="stat-card primary">
        <div class="stat-value">{{ stats.processing }}</div>
        <div class="stat-label">处理中</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">{{ stats.completed }}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-value">¥{{ stats.pendingFines }}</div>
        <div class="stat-label">待处理罚款</div>
      </div>
    </div>

    <!-- 移动端卡片列表 -->
    <div class="mobile-cards">
      <div v-for="item in tableData" :key="item.id" class="mobile-card">
        <div class="mobile-card-header">
          <span class="plate">{{ item.plate_number }}</span>
          <el-tag :type="getStatusType(item.status)" size="small">{{ item.status_text }}</el-tag>
        </div>
        <div class="mobile-card-row" v-if="item.order_no">
          <span class="label">订单</span>
          <span class="value link" @click="$router.push(`/orders/${item.order_id}`)">{{ item.order_no }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">客户</span>
          <span class="value">{{ item.customer_name }} <a :href="'tel:' + item.customer_phone">{{ item.customer_phone }}</a></span>
        </div>
        <div class="mobile-card-row">
          <span class="label">类型</span>
          <span class="value">{{ item.violation_type || '-' }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">时间</span>
          <span class="value">{{ item.violation_date }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">地点</span>
          <span class="value">{{ item.location || '-' }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">罚款</span>
          <span class="value text-danger">¥{{ item.fine_amount || 0 }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">扣分</span>
          <span class="value text-warning">{{ item.penalty_points || 0 }}分</span>
        </div>
        <div class="mobile-card-actions">
          <el-button type="primary" size="small" @click="openHandleDialog(item)" v-if="item.status !== 'completed'">处理</el-button>
          <el-button size="small" @click="openDialog(item)">编辑</el-button>
        </div>
      </div>
    </div>

    <!-- PC端表格 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" v-loading="loading" stripe class="hide-mobile">
        <el-table-column prop="order_no" label="订单号" width="130">
          <template #default="{ row }">
            <span v-if="row.order_no" class="link" @click="$router.push(`/orders/${row.order_id}`)">{{ row.order_no }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="plate_number" label="车牌" width="90" />
        <el-table-column prop="customer_name" label="客户" width="80" />
        <el-table-column prop="customer_phone" label="电话" width="110">
          <template #default="{ row }">
            <a :href="'tel:' + row.customer_phone">{{ row.customer_phone }}</a>
          </template>
        </el-table-column>
        <el-table-column prop="violation_type" label="类型" width="80">
          <template #default="{ row }">{{ row.violation_type || '-' }}</template>
        </el-table-column>
        <el-table-column prop="violation_date" label="时间" width="100" />
        <el-table-column prop="location" label="地点" min-width="100" show-overflow-tooltip />
        <el-table-column prop="fine_amount" label="罚款" width="70">
          <template #default="{ row }">¥{{ row.fine_amount }}</template>
        </el-table-column>
        <el-table-column prop="penalty_points" label="扣分" width="50" />
        <el-table-column prop="status" label="状态" width="70">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ row.status_text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="130">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openHandleDialog(row)" v-if="row.status !== 'completed'">处理</el-button>
            <el-button type="primary" link size="small" @click="openDialog(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
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

    <!-- 添加/编辑违章对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑违章' : '添加违章'" width="90%" :style="{ maxWidth: '450px' }">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="70px" size="default">
        <el-form-item label="违章时间" prop="violation_date">
          <el-date-picker 
            v-model="form.violation_date" 
            type="date" 
            placeholder="违章日期" 
            value-format="YYYY-MM-DD" 
            style="width: 100%" 
            @change="onViolationDateChange"
          />
        </el-form-item>
        <el-form-item label="关联订单" v-if="form.violation_date">
          <div class="order-select-wrapper">
            <el-select 
              v-model="form.order_id" 
              :placeholder="recommendedOrders.length ? '推荐订单' : '无匹配订单'" 
              clearable
              filterable
              style="width: 100%" 
              @change="onOrderChange"
            >
              <el-option 
                v-for="o in recommendedOrders" 
                :key="o.id" 
                :label="`${o.order_no} - ${o.customer_name} (${o.plate_number}) ${o.start_date}~${o.end_date}`" 
                :value="o.id" 
              />
            </el-select>
            <div class="form-tip" v-if="recommendedOrders.length">
              <el-icon><InfoFilled /></el-icon>
              找到 {{ recommendedOrders.length }} 个该时段的租车订单
            </div>
            <div class="form-tip warning" v-else>
              <el-icon><WarningFilled /></el-icon>
              该日期无租车记录，请手动填写信息
            </div>
          </div>
        </el-form-item>
        <el-form-item label="车辆" prop="vehicle_id">
          <el-select v-model="form.vehicle_id" placeholder="选择车辆" style="width: 100%" @change="onVehicleChange">
            <el-option 
              v-for="v in vehicles" 
              :key="v.id" 
              :label="`${v.plate_number} - ${v.brand} ${v.model}`" 
              :value="v.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="客户" prop="customer_name">
          <el-input v-model="form.customer_name" placeholder="客户姓名" />
        </el-form-item>
        <el-form-item label="手机">
          <el-input v-model="form.customer_phone" placeholder="手机号" type="tel" />
        </el-form-item>
        <el-form-item label="违章类型" prop="violation_type">
          <el-input v-model="form.violation_type" placeholder="违章类型" />
        </el-form-item>
        <el-form-item label="地点">
          <el-input v-model="form.location" placeholder="违章地点" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="罚款" prop="fine_amount">
              <el-input v-model.number="form.fine_amount" type="number" placeholder="罚款金额" :min="0">
                <template #prepend>¥</template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="扣分" prop="penalty_points">
              <el-input v-model.number="form.penalty_points" type="number" placeholder="扣分" :min="0" :max="12">
                <template #append>分</template>
              </el-input>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="form.remarks" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 处理违章对话框 -->
    <el-dialog v-model="handleDialogVisible" title="处理违章" width="90%" :style="{ maxWidth: '400px' }">
      <el-form :model="handleForm" label-width="70px" size="default">
        <el-form-item label="状态">
          <el-radio-group v-model="handleForm.status">
            <el-radio value="processing">处理中</el-radio>
            <el-radio value="completed">已完成</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="handleForm.handle_remarks" type="textarea" :rows="2" placeholder="处理说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHandle" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { violationApi, vehicleApi, orderApi } from '../api'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const handleDialogVisible = ref(false)
const formRef = ref<FormInstance>()
const editingId = ref('')
const vehicles = ref<any[]>([])
const recommendedOrders = ref<any[]>([])

const searchForm = reactive({ keyword: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
const stats = reactive({ pending: 0, processing: 0, completed: 0, pendingFines: 0 })

const form = reactive({
  order_id: '',
  vehicle_id: '',
  customer_name: '',
  customer_phone: '',
  violation_type: '',
  violation_date: '',
  location: '',
  fine_amount: 0,
  penalty_points: 0,
  remarks: ''
})

const handleForm = reactive({
  status: 'completed',
  handle_remarks: ''
})

const rules: FormRules = {
  vehicle_id: [{ required: true, message: '请选择车辆', trigger: 'change' }],
  customer_name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
  violation_date: [{ required: true, message: '请选择违章日期', trigger: 'change' }],
  violation_type: [{ required: true, message: '请输入违章类型', trigger: 'blur' }],
  fine_amount: [{ required: true, message: '请输入罚款金额', trigger: 'blur' }],
  penalty_points: [{ required: true, message: '请输入扣分', trigger: 'blur' }]
}

const statusTypeMap: Record<string, string> = {
  pending: 'warning',
  processing: 'primary',
  completed: 'success'
}

function getStatusType(status: string) {
  return statusTypeMap[status] || 'info'
}

async function loadData() {
  loading.value = true
  try {
    const [listRes, statsRes]: any[] = await Promise.all([
      violationApi.getList({ ...searchForm, ...pagination }),
      violationApi.getStats()
    ])
    if (listRes.success) {
      tableData.value = listRes.data.data
      pagination.total = listRes.data.total
    }
    if (statsRes.success) {
      Object.assign(stats, statsRes.data)
    }
  } catch (error) {
    console.error('加载数据失败', error)
  } finally {
    loading.value = false
  }
}

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

// 根据违章日期查找匹配的订单
async function onViolationDateChange(date: string) {
  if (!date) {
    recommendedOrders.value = []
    return
  }
  
  try {
    // 获取所有订单（不限状态）
    const res: any = await orderApi.getList({ pageSize: 500 })
    if (res.success) {
      const violationDate = new Date(date)
      // 筛选出违章日期在租车期间的订单
      recommendedOrders.value = res.data.data.filter((o: any) => {
        const startDate = new Date(o.start_date)
        const endDate = new Date(o.end_date)
        return violationDate >= startDate && violationDate <= endDate
      })
      
      // 如果只有一个匹配订单，自动选中
      if (recommendedOrders.value.length === 1) {
        const order = recommendedOrders.value[0]
        form.order_id = order.id
        onOrderChange(order.id)
      }
    }
  } catch (error) {
    console.error('加载订单失败', error)
  }
}

function openDialog(item?: any) {
  editingId.value = item?.id || ''
  Object.assign(form, {
    order_id: item?.order_id || '',
    vehicle_id: item?.vehicle_id || '',
    customer_name: item?.customer_name || '',
    customer_phone: item?.customer_phone || '',
    violation_type: item?.violation_type || '',
    violation_date: item?.violation_date || '',
    location: item?.location || '',
    fine_amount: item?.fine_amount ?? 0,
    penalty_points: item?.penalty_points ?? 0,
    remarks: item?.remarks || ''
  })
  recommendedOrders.value = []
  loadVehicles()
  dialogVisible.value = true
  
  // 编辑时如果有日期，触发订单查询
  if (item?.violation_date) {
    onViolationDateChange(item.violation_date)
  }
}

function onOrderChange(orderId: string) {
  if (!orderId) {
    return
  }
  
  const order = recommendedOrders.value.find(o => o.id === orderId)
  if (order) {
    form.vehicle_id = order.vehicle_id
    form.customer_name = order.customer_name
    form.customer_phone = order.customer_phone
  }
}

function onVehicleChange(id: string) {
  const vehicle = vehicles.value.find(v => v.id === id)
  if (vehicle) {
    form.vehicle_id = id
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    const vehicle = vehicles.value.find(v => v.id === form.vehicle_id)
    const order = recommendedOrders.value.find(o => o.id === form.order_id)
    const data = {
      ...form,
      customer_id: order?.customer_id || null,
      plate_number: vehicle?.plate_number
    }
    
    let res: any
    if (editingId.value) {
      res = await violationApi.update(editingId.value, data)
    } else {
      res = await violationApi.create(data)
    }
    
    if (res.success) {
      ElMessage.success(editingId.value ? '修改成功' : '添加成功')
      dialogVisible.value = false
      loadData()
    }
  } catch (error) {
    console.error('提交失败', error)
  } finally {
    submitting.value = false
  }
}

let currentHandleItem: any = null
function openHandleDialog(item: any) {
  currentHandleItem = item
  handleForm.status = item.status === 'pending' ? 'processing' : 'completed'
  handleForm.handle_remarks = ''
  handleDialogVisible.value = true
}

async function submitHandle() {
  if (!currentHandleItem) return
  
  submitting.value = true
  try {
    const res: any = await violationApi.handle(currentHandleItem.id, handleForm)
    if (res.success) {
      ElMessage.success('处理成功')
      handleDialogVisible.value = false
      loadData()
    }
  } catch (error) {
    console.error('处理失败', error)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定删除这条违章记录吗？', '提示', { type: 'warning' })
    const res: any = await violationApi.delete(row.id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadData()
    }
  } catch (error) {
    // 取消删除
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.violations-tab {
  width: 100%;
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

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.stat-card.warning { border-left: 3px solid #E6A23C; }
.stat-card.primary { border-left: 3px solid #409EFF; }
.stat-card.success { border-left: 3px solid #67C23A; }
.stat-card.danger { border-left: 3px solid #F56C6C; }

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

@media (max-width: 767px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .stat-value {
    font-size: 16px;
  }
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
}

.mobile-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.plate {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.mobile-card-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 13px;
}

.mobile-card-row .label {
  color: #909399;
}

.mobile-card-row .value {
  color: #303133;
}

.mobile-card-row .value.text-danger {
  color: #F56C6C;
  font-weight: 500;
}

.mobile-card-row .value.text-warning {
  color: #E6A23C;
  font-weight: 500;
}

.mobile-card-row a {
  color: #409EFF;
  text-decoration: none;
  margin-left: 8px;
}

.mobile-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.link {
  color: #409EFF;
  cursor: pointer;
}

.link:hover {
  text-decoration: underline;
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
}

:deep(a) {
  color: #409EFF;
  text-decoration: none;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.order-select-wrapper {
  width: 100%;
}

.form-tip {
  font-size: 12px;
  color: #67C23A;
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.form-tip.warning {
  color: #E6A23C;
}

.form-tip .el-icon {
  font-size: 14px;
}
</style>
