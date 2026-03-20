<template>
  <div class="inspection-tab">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm" size="default">
        <el-form-item>
          <el-input v-model="searchForm.keyword" placeholder="车牌" clearable @keyup.enter="loadData" style="width: 120px" />
        </el-form-item>
        <el-form-item>
          <el-select v-model="searchForm.status" placeholder="状态" clearable style="width: 90px">
            <el-option label="有效" value="valid" />
            <el-option label="已过期" value="expired" />
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
        <el-icon><Plus /></el-icon> 添加年检
      </el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card primary">
        <div class="stat-value">{{ stats.validCount }}</div>
        <div class="stat-label">有效</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">{{ stats.expiringSoon.length }}</div>
        <div class="stat-label">即将到期</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-value">{{ stats.expired.length }}</div>
        <div class="stat-label">已过期</div>
      </div>
    </div>

    <!-- 移动端卡片列表 -->
    <div class="mobile-cards">
      <div v-for="item in tableData" :key="item.id" class="mobile-card" :class="{ 'expired': item.status === 'expired' }">
        <div class="mobile-card-header">
          <span class="plate">{{ item.plate_number }}</span>
          <el-tag :type="getStatusType(item.status)" size="small">{{ item.status_text }}</el-tag>
        </div>
        <div class="mobile-card-row">
          <span class="label">车辆</span>
          <span class="value">{{ item.brand }} {{ item.model }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">到期日期</span>
          <span class="value" :class="{ 'text-danger': isExpired(item.expiry_date), 'text-warning': isExpiringSoon(item.expiry_date) }">
            {{ item.expiry_date }}
          </span>
        </div>
        <div class="mobile-card-row" v-if="item.certificate_image">
          <span class="label">年检证</span>
          <el-button type="primary" link size="small" @click="previewImage(item.certificate_image)">查看</el-button>
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
        <el-table-column prop="plate_number" label="车牌" width="100" />
        <el-table-column prop="brand" label="车辆" width="120">
          <template #default="{ row }">{{ row.brand }} {{ row.model }}</template>
        </el-table-column>
        <el-table-column prop="expiry_date" label="到期日期" width="120">
          <template #default="{ row }">
            <span :class="{ 'text-danger': isExpired(row.expiry_date), 'text-warning': isExpiringSoon(row.expiry_date) }">
              {{ row.expiry_date }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="年检证" width="80">
          <template #default="{ row }">
            <el-button v-if="row.certificate_image" type="primary" link size="small" @click="previewImage(row.certificate_image)">查看</el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status_text" label="状态" width="80">
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

    <!-- 添加/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑年检证' : '添加年检证'" width="90%" :style="{ maxWidth: '450px' }">
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
        
        <el-form-item label="到期日期" prop="expiry_date">
          <el-date-picker 
            v-model="form.expiry_date" 
            type="date" 
            placeholder="选择到期日期" 
            value-format="YYYY-MM-DD" 
            style="width: 100%" 
          />
        </el-form-item>

        <el-form-item label="年检证">
          <div class="upload-area">
            <el-upload
              ref="uploadRef"
              class="certificate-uploader"
              :auto-upload="false"
              :show-file-list="false"
              accept="image/*"
              capture="environment"
              @change="handleImageChange"
            >
              <div v-if="form.certificate_image" class="image-preview">
                <img :src="getImageUrl(form.certificate_image)" alt="年检证" />
                <div class="image-actions">
                  <el-button type="primary" size="small" @click.stop>更换图片</el-button>
                  <el-button type="danger" size="small" @click.stop="clearImage">删除</el-button>
                </div>
              </div>
              <div v-else class="upload-trigger">
                <el-icon class="upload-icon"><Camera /></el-icon>
                <div class="upload-text">
                  <span>点击拍照或上传年检证</span>
                </div>
              </div>
            </el-upload>
          </div>
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

    <!-- 图片预览 -->
    <el-dialog v-model="imagePreviewVisible" title="年检证" width="90%" :style="{ maxWidth: '500px' }">
      <img :src="previewImageUrl" style="width: 100%" alt="年检证" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
import { inspectionApi, vehicleApi, uploadApi } from '../api'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const uploadRef = ref()
const editingId = ref('')
const vehicles = ref<any[]>([])
const imagePreviewVisible = ref(false)
const previewImageUrl = ref('')

const searchForm = reactive({ keyword: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
const stats = reactive({ validCount: 0, expiringSoon: [] as any[], expired: [] as any[], thisMonthCost: 0 })

const form = reactive({
  vehicle_id: '',
  plate_number: '',
  expiry_date: '',
  certificate_image: '',
  remarks: ''
})

const rules: FormRules = {
  vehicle_id: [{ required: true, message: '请选择车辆', trigger: 'change' }],
  expiry_date: [{ required: true, message: '请选择到期日期', trigger: 'change' }]
}

const statusTypeMap: Record<string, string> = {
  valid: 'success',
  expired: 'danger',
  pending: 'warning'
}

function getStatusType(status: string) {
  return statusTypeMap[status] || 'info'
}

function getImageUrl(url: string) {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('data:')) return url
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
  return baseUrl + url
}

function isExpired(date: string) {
  return new Date(date) < new Date()
}

function isExpiringSoon(date: string) {
  const now = new Date()
  const target = new Date(date)
  const diff = target.getTime() - now.getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  return days > 0 && days <= 30
}

async function loadData() {
  loading.value = true
  try {
    const [listRes, statsRes]: any[] = await Promise.all([
      inspectionApi.getList({ ...searchForm, ...pagination }),
      inspectionApi.getStats()
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
    expiry_date: item?.expiry_date || '',
    certificate_image: item?.certificate_image || '',
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

// 处理图片选择
async function handleImageChange(uploadFile: UploadFile) {
  const file = uploadFile.raw
  if (!file) return

  // 检查文件类型
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }

  // 上传文件到服务器
  try {
    const res = await uploadApi.uploadImage(file)
    if (res.success && res.data) {
      form.certificate_image = res.data.url
      ElMessage.success('图片上传成功')
    } else {
      ElMessage.error('上传失败')
    }
  } catch (error) {
    console.error('上传失败', error)
    ElMessage.error('上传失败')
  }
}

function clearImage() {
  form.certificate_image = ''
}

function previewImage(url: string) {
  // 处理相对路径
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
  previewImageUrl.value = url.startsWith('http') ? url : baseUrl + url
  imagePreviewVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    let res: any
    if (editingId.value) {
      res = await inspectionApi.update(editingId.value, form)
    } else {
      res = await inspectionApi.create(form)
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
    const res: any = await inspectionApi.delete(id)
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
.inspection-tab {
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

.mobile-card.expired {
  opacity: 0.7;
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

.text-danger {
  color: #F56C6C;
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

/* 上传区域样式 */
.upload-area {
  width: 100%;
}

.certificate-uploader {
  width: 100%;
}

.certificate-uploader :deep(.el-upload) {
  width: 100%;
}

.upload-trigger {
  width: 100%;
  height: 120px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #fafafa;
}

.upload-trigger:hover {
  border-color: #409EFF;
  background: #f0f7ff;
}

.upload-icon {
  font-size: 32px;
  color: #909399;
  margin-bottom: 8px;
}

.upload-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 14px;
  color: #606266;
}

.image-preview {
  width: 100%;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  display: block;
}

.image-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  gap: 8px;
}
</style>
