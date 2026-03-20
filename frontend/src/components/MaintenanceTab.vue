<template>
  <div class="maintenance-tab">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm" size="default">
        <el-form-item>
          <el-input v-model="searchForm.keyword" placeholder="车牌/品牌/型号" clearable @keyup.enter="loadData" style="width: 130px" />
        </el-form-item>
        <el-form-item>
          <el-select v-model="searchForm.type" placeholder="保养类型" clearable style="width: 100px">
            <el-option label="常规保养" value="routine" />
            <el-option label="维修" value="repair" />
            <el-option label="年检" value="inspection" />
            <el-option label="轮胎更换" value="tire" />
            <el-option label="换油" value="oil" />
            <el-option label="其他" value="other" />
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
        <el-icon><Plus /></el-icon> 添加保养
      </el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card primary">
        <div class="stat-value">{{ stats.thisMonth }}</div>
        <div class="stat-label">本月保养</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">待保养</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">¥{{ stats.thisMonthCost }}</div>
        <div class="stat-label">本月费用</div>
      </div>
    </div>

    <!-- 移动端卡片列表 -->
    <div class="mobile-cards">
      <div v-for="item in tableData" :key="item.id" class="mobile-card">
        <div class="mobile-card-header">
          <span class="plate">{{ item.plate_number }}</span>
          <el-tag :type="getStatusType(item.status)" size="small">{{ item.status_text }}</el-tag>
        </div>
        <div class="mobile-card-row">
          <span class="label">车辆</span>
          <span class="value">{{ item.brand }} {{ item.model }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">类型</span>
          <span class="value">{{ item.type_text }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">日期</span>
          <span class="value">{{ item.maintenance_date }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">费用</span>
          <span class="value text-danger">¥{{ item.cost }}</span>
        </div>
        <div class="mobile-card-row" v-if="item.garage">
          <span class="label">维修店</span>
          <span class="value">{{ item.garage }}</span>
        </div>
        <div class="mobile-card-row" v-if="item.next_maintenance_date">
          <span class="label">下次保养</span>
          <span class="value text-warning">{{ item.next_maintenance_date }}</span>
        </div>
        <div class="mobile-card-actions">
          <el-button type="primary" size="small" @click="openDialog(item)">编辑</el-button>
          <el-popconfirm title="确定删除?" @confirm="handleDelete(item.id)">
            <template #reference>
              <el-button type="danger" size="small">删除</el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>
    </div>

    <!-- PC端表格 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" v-loading="loading" stripe class="hide-mobile">
        <el-table-column prop="plate_number" label="车牌" width="90" />
        <el-table-column prop="brand" label="品牌" width="70">
          <template #default="{ row }">{{ row.brand }} {{ row.model }}</template>
        </el-table-column>
        <el-table-column prop="type_text" label="类型" width="80" />
        <el-table-column prop="maintenance_date" label="保养日期" width="100" />
        <el-table-column prop="cost" label="费用" width="80">
          <template #default="{ row }">¥{{ row.cost }}</template>
        </el-table-column>
        <el-table-column prop="mileage" label="里程" width="80">
          <template #default="{ row }">{{ row.mileage }}km</template>
        </el-table-column>
        <el-table-column prop="garage" label="维修店" min-width="100" show-overflow-tooltip />
        <el-table-column prop="next_maintenance_date" label="下次保养" width="100">
          <template #default="{ row }">
            <span v-if="row.next_maintenance_date" class="text-warning">{{ row.next_maintenance_date }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status_text" label="状态" width="70">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ row.status_text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="130">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDialog(row)">编辑</el-button>
            <el-popconfirm title="确定删除?" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button type="danger" link size="small">删除</el-button>
              </template>
            </el-popconfirm>
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

    <!-- 添加/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑保养' : '添加保养'" width="90%" :style="{ maxWidth: '500px' }">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" size="default">
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
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="保养类型" prop="type">
              <el-select v-model="form.type" placeholder="选择类型" style="width: 100%">
                <el-option label="常规保养" value="routine" />
                <el-option label="维修" value="repair" />
                <el-option label="年检" value="inspection" />
                <el-option label="轮胎更换" value="tire" />
                <el-option label="换油" value="oil" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="保养日期" prop="maintenance_date">
              <el-date-picker 
                v-model="form.maintenance_date" 
                type="date" 
                placeholder="选择日期" 
                value-format="YYYY-MM-DD" 
                style="width: 100%" 
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="费用" prop="cost">
              <el-input-number v-model="form.cost" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="里程">
              <el-input-number v-model="form.mileage" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="维修店">
          <el-input v-model="form.garage" placeholder="维修店名称" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="下次日期">
              <el-date-picker 
                v-model="form.next_maintenance_date" 
                type="date" 
                placeholder="下次保养日期" 
                value-format="YYYY-MM-DD" 
                style="width: 100%" 
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="下次里程">
              <el-input-number v-model="form.next_maintenance_mileage" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="pending">待保养</el-radio>
            <el-radio value="completed">已完成</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remarks" type="textarea" :rows="2" placeholder="备注信息" />
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { maintenanceApi, vehicleApi } from '../api'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const editingId = ref('')
const vehicles = ref<any[]>([])

const searchForm = reactive({ keyword: '', type: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
const stats = reactive({ thisMonth: 0, pending: 0, thisMonthCost: 0, upcomingExpire: [] })

const form = reactive({
  vehicle_id: '',
  plate_number: '',
  type: 'routine',
  maintenance_date: '',
  cost: 0,
  mileage: 0,
  garage: '',
  next_maintenance_date: '',
  next_maintenance_mileage: 0,
  status: 'completed',
  remarks: ''
})

const rules: FormRules = {
  vehicle_id: [{ required: true, message: '请选择车辆', trigger: 'change' }],
  type: [{ required: true, message: '请选择保养类型', trigger: 'change' }],
  maintenance_date: [{ required: true, message: '请选择保养日期', trigger: 'change' }]
}

const statusTypeMap: Record<string, string> = {
  pending: 'warning',
  in_progress: 'primary',
  completed: 'success'
}

function getStatusType(status: string) {
  return statusTypeMap[status] || 'info'
}

async function loadData() {
  loading.value = true
  try {
    const [listRes, statsRes]: any[] = await Promise.all([
      maintenanceApi.getList({ ...searchForm, ...pagination }),
      maintenanceApi.getStats()
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

function openDialog(item?: any) {
  editingId.value = item?.id || ''
  Object.assign(form, {
    vehicle_id: item?.vehicle_id || '',
    plate_number: item?.plate_number || '',
    type: item?.type || 'routine',
    maintenance_date: item?.maintenance_date || '',
    cost: item?.cost ?? 0,
    mileage: item?.mileage ?? 0,
    garage: item?.garage || '',
    next_maintenance_date: item?.next_maintenance_date || '',
    next_maintenance_mileage: item?.next_maintenance_mileage ?? 0,
    status: item?.status || 'completed',
    remarks: item?.remarks || ''
  })
  loadVehicles()
  dialogVisible.value = true
}

function onVehicleChange(id: string) {
  const vehicle = vehicles.value.find(v => v.id === id)
  if (vehicle) {
    form.plate_number = vehicle.plate_number
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    let res: any
    if (editingId.value) {
      res = await maintenanceApi.update(editingId.value, form)
    } else {
      res = await maintenanceApi.create(form)
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

async function handleDelete(id: string) {
  try {
    const res: any = await maintenanceApi.delete(id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadData()
    }
  } catch (error) {
    console.error('删除失败', error)
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.maintenance-tab {
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
  grid-template-columns: repeat(3, 1fr);
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

.stat-card.primary { border-left: 3px solid #409EFF; }
.stat-card.warning { border-left: 3px solid #E6A23C; }
.stat-card.success { border-left: 3px solid #67C23A; }

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

.mobile-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.hide-mobile {
  display: none;
}

.table-card {
  display: none;
}

.text-warning {
  color: #E6A23C;
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

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
