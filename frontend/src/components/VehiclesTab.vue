<template>
  <div class="vehicles-tab">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm" size="default">
        <el-form-item>
          <el-input v-model="searchForm.keyword" placeholder="车牌/品牌/型号" clearable @keyup.enter="loadData" style="width: 150px" />
        </el-form-item>
        <el-form-item>
          <el-select v-model="searchForm.status" placeholder="状态" clearable style="width: 90px">
            <el-option label="可用" value="available" />
            <el-option label="已出租" value="rented" />
            <el-option label="维修中" value="maintenance" />
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
        <el-icon><Plus /></el-icon> 添加
      </el-button>
    </div>

    <!-- 移动端卡片列表 -->
    <div class="mobile-cards">
      <div v-for="item in tableData" :key="item.id" class="mobile-card">
        <div class="mobile-card-header">
          <span class="plate-number">{{ item.plate_number }}</span>
          <el-tag :type="getStatusType(item.status)" size="small">{{ item.status_text }}</el-tag>
        </div>
        <div class="mobile-card-row">
          <span class="label">品牌型号</span>
          <span class="value">{{ item.brand }} {{ item.model }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">日租金</span>
          <span class="value text-primary">¥{{ item.daily_rate }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">押金</span>
          <span class="value">¥{{ item.deposit }}</span>
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
        <el-table-column prop="plate_number" label="车牌号" width="100" />
        <el-table-column prop="brand" label="品牌" width="80" />
        <el-table-column prop="model" label="型号" width="100" />
        <el-table-column prop="color" label="颜色" width="60" />
        <el-table-column prop="daily_rate" label="日租金" width="80">
          <template #default="{ row }">¥{{ row.daily_rate }}</template>
        </el-table-column>
        <el-table-column prop="deposit" label="押金" width="80">
          <template #default="{ row }">¥{{ row.deposit }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ row.status_text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="150">
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

    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑车辆' : '添加车辆'" width="90%" :style="{ maxWidth: '500px' }">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="70px" size="default">
        <el-form-item label="车牌号" prop="plate_number">
          <el-input v-model="form.plate_number" placeholder="请输入车牌号" />
        </el-form-item>
        <el-form-item label="品牌" prop="brand">
          <el-input v-model="form.brand" placeholder="请输入品牌" />
        </el-form-item>
        <el-form-item label="型号" prop="model">
          <el-input v-model="form.model" placeholder="请输入型号" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="颜色">
              <el-input v-model="form.color" placeholder="颜色" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="年份">
              <el-input-number v-model="form.year" :min="2000" :max="2030" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="座位">
              <el-input-number v-model="form.seats" :min="2" :max="9" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="里程">
              <el-input-number v-model="form.mileage" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="日租金" prop="daily_rate">
              <el-input-number v-model="form.daily_rate" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="押金">
              <el-input-number v-model="form.deposit" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="状态" v-if="editingId">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="可用" value="available" />
            <el-option label="已出租" value="rented" />
            <el-option label="维修中" value="maintenance" />
            <el-option label="不可用" value="unavailable" />
          </el-select>
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
import { vehicleApi } from '../api'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()

const searchForm = reactive({ keyword: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  plate_number: '',
  brand: '',
  model: '',
  color: '',
  year: new Date().getFullYear(),
  seats: 5,
  daily_rate: 200,
  deposit: 1000,
  mileage: 0,
  status: 'available',
  remarks: ''
})

const rules: FormRules = {
  plate_number: [{ required: true, message: '请输入车牌号', trigger: 'blur' }],
  brand: [{ required: true, message: '请输入品牌', trigger: 'blur' }],
  model: [{ required: true, message: '请输入型号', trigger: 'blur' }],
  daily_rate: [{ required: true, message: '请输入日租金', trigger: 'blur' }]
}

const statusTypeMap: Record<string, string> = {
  available: 'success',
  rented: 'warning',
  maintenance: 'info',
  unavailable: 'danger'
}

function getStatusType(status: string) {
  return statusTypeMap[status] || 'info'
}

async function loadData() {
  loading.value = true
  try {
    const res: any = await vehicleApi.getList({ ...searchForm, ...pagination })
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

function openDialog(row?: any) {
  editingId.value = row?.id || ''
  if (row) {
    Object.assign(form, row)
  } else {
    Object.assign(form, {
      plate_number: '',
      brand: '',
      model: '',
      color: '',
      year: new Date().getFullYear(),
      seats: 5,
      daily_rate: 200,
      deposit: 1000,
      mileage: 0,
      status: 'available',
      remarks: ''
    })
  }
  dialogVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    let res: any
    if (editingId.value) {
      res = await vehicleApi.update(editingId.value, form)
    } else {
      res = await vehicleApi.create(form)
    }
    if (res.success) {
      ElMessage.success(editingId.value ? '更新成功' : '创建成功')
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
    const res: any = await vehicleApi.delete(id)
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
.vehicles-tab {
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
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.plate-number {
  font-size: 16px;
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

.text-primary {
  color: #409EFF;
  font-weight: 500;
}

.mobile-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #eee;
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

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
