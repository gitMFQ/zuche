<template>
  <div class="inspection-tab">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm" size="default">
        <el-form-item>
          <el-input v-model="searchForm.keyword" placeholder="车牌/品牌" clearable @keyup.enter="loadData" style="width: 140px" />
        </el-form-item>
        <el-form-item>
          <el-select v-model="searchForm.status" placeholder="年检状态" clearable style="width: 100px">
            <el-option label="有效" value="valid" />
            <el-option label="已过期" value="expired" />
            <el-option label="未登记" value="none" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">搜索</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card success">
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
      <div class="stat-card info">
        <div class="stat-value">{{ stats.noneCount }}</div>
        <div class="stat-label">未登记</div>
      </div>
    </div>

    <!-- 移动端卡片列表 -->
    <div class="mobile-cards">
      <div v-for="item in tableData" :key="item.vehicle_id" class="mobile-card" :class="item.inspection_status">
        <div class="mobile-card-header">
          <span class="plate-number" :class="item.is_new_energy ? 'new-energy' : 'fuel'">{{ item.plate_number }}</span>
          <el-tag :type="getStatusType(item.inspection_status)" size="small">{{ item.status_text }}</el-tag>
        </div>
        <div class="mobile-card-row">
          <span class="label">车辆</span>
          <span class="value">{{ item.brand }} {{ item.model }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">到期日期</span>
          <span class="value" :class="getDateClass(item)">
            {{ item.expiry_date || '-' }}
          </span>
        </div>
        <div class="mobile-card-row" v-if="item.certificate_image">
          <span class="label">年检证</span>
          <el-button type="primary" link size="small" @click="previewImage(item.certificate_image)">查看</el-button>
        </div>
        <div class="mobile-card-actions">
          <el-button type="primary" size="small" @click="openDialog(item)">
            {{ item.inspection_id ? '编辑' : '登记' }}
          </el-button>
          <el-popconfirm v-if="item.inspection_id" title="确定删除年检证?" @confirm="handleDelete(item.vehicle_id)">
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
        <el-table-column prop="plate_number" label="车牌" width="120">
          <template #default="{ row }">
            <span class="plate-number" :class="row.is_new_energy ? 'new-energy' : 'fuel'">{{ row.plate_number }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="brand" label="车辆" width="140">
          <template #default="{ row }">{{ row.brand }} {{ row.model }}</template>
        </el-table-column>
        <el-table-column prop="expiry_date" label="到期日期" width="120">
          <template #default="{ row }">
            <span :class="getDateClass(row)">
              {{ row.expiry_date || '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="年检证" width="80">
          <template #default="{ row }">
            <el-button v-if="row.certificate_image" type="primary" link size="small" @click="previewImage(row.certificate_image)">查看</el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status_text" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.inspection_status)" size="small">{{ row.status_text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="140">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDialog(row)">
              {{ row.inspection_id ? '编辑' : '登记' }}
            </el-button>
            <el-popconfirm v-if="row.inspection_id" title="确定删除年检证?" @confirm="handleDelete(row.vehicle_id)">
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
    <el-dialog v-model="dialogVisible" :title="formTitle" width="90%" :style="{ maxWidth: '450px' }">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" size="default">
        <el-form-item label="车辆">
          <div class="vehicle-info">
            <span class="plate-number" :class="currentVehicle?.is_new_energy ? 'new-energy' : 'fuel'">{{ currentVehicle?.plate_number }}</span>
            <span class="detail">{{ currentVehicle?.brand }} {{ currentVehicle?.model }}</span>
          </div>
        </el-form-item>
        
        <el-form-item label="到期日期" prop="expiry_date">
          <input 
            v-if="isMobile"
            type="date" 
            v-model="form.expiry_date" 
            class="native-date-input"
            style="width: 100%"
          />
          <el-date-picker 
            v-else
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
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
import { inspectionApi, uploadApi } from '../api'
import { getImageUrl, isExpired, isExpiringSoon } from '../utils/helpers'

const loading = ref(false)
const submitting = ref(false)
const isMobile = ref(window.innerWidth < 768)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const currentVehicle = ref<any>(null)
const imagePreviewVisible = ref(false)
const previewImageUrl = ref('')

const searchForm = reactive({ keyword: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
const stats = reactive({ validCount: 0, expiringSoon: [] as any[], expired: [] as any[], noneCount: 0 })

const form = reactive({
  vehicle_id: '',
  expiry_date: '',
  certificate_image: '',
  remarks: ''
})

const formTitle = computed(() => currentVehicle.value?.inspection_id ? '编辑年检证' : '登记年检证')

const rules: FormRules = {
  expiry_date: [{ required: true, message: '请选择到期日期', trigger: 'change' }]
}

const statusTypeMap: Record<string, string> = {
  valid: 'success',
  expired: 'danger',
  none: 'info'
}

function getStatusType(status: string) {
  return statusTypeMap[status] || 'info'
}

function getDateClass(item: any) {
  if (!item.expiry_date) return ''
  if (isExpired(item.expiry_date)) return 'text-danger'
  if (isExpiringSoon(item.expiry_date)) return 'text-warning'
  return 'text-success'
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
      // 计算未登记数量
      stats.noneCount = pagination.total - stats.validCount - stats.expired.length
    }
  } catch (error) {
    console.error('加载数据失败', error)
  } finally {
    loading.value = false
  }
}

function openDialog(item: any) {
  currentVehicle.value = item
  Object.assign(form, {
    vehicle_id: item.vehicle_id,
    expiry_date: item.expiry_date || '',
    certificate_image: item.certificate_image || '',
    remarks: item.remarks || ''
  })
  dialogVisible.value = true
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

  // 检查文件大小 (10MB)
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过10MB')
    return
  }

  // 上传文件到服务器（年检证专用目录）
  try {
    const res = await uploadApi.uploadInspection(file)
    if (res.success && res.data) {
      form.certificate_image = res.data.url
      ElMessage.success('图片上传成功')
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (error: any) {
    console.error('上传失败', error)
    ElMessage.error(error.message || '上传失败，请重试')
  }
}

function clearImage() {
  form.certificate_image = ''
}

function previewImage(url: string) {
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
  previewImageUrl.value = url.startsWith('http') ? url : baseUrl + url
  imagePreviewVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    const res: any = await inspectionApi.update(form.vehicle_id, form)
    if (res.success) {
      ElMessage.success(currentVehicle.value?.inspection_id ? '修改成功' : '登记成功')
      dialogVisible.value = false
      loadData()
    }
  } catch (error) {
    console.error('提交失败', error)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(vehicleId: string) {
  try {
    const res: any = await inspectionApi.delete(vehicleId)
    if (res.success) {
      ElMessage.success('删除成功')
      loadData()
    }
  } catch (error) {
    console.error('删除失败', error)
  }
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth < 768
  })
})
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

.stat-card.success { border-left: 3px solid #67C23A; }
.stat-card.warning { border-left: 3px solid #E6A23C; }
.stat-card.danger { border-left: 3px solid #F56C6C; }
.stat-card.info { border-left: 3px solid #909399; }

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
  border-left: 3px solid #F56C6C;
}

.mobile-card.valid {
  border-left: 3px solid #67C23A;
}

.mobile-card.none {
  border-left: 3px solid #909399;
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

.mobile-card-row .value.text-success {
  color: #67C23A;
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

.text-success {
  color: #67C23A;
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

.vehicle-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.vehicle-info .plate {
  font-weight: 600;
  color: #303133;
}

.vehicle-info .detail {
  color: #606266;
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
  border-color: var(--primary-color, #409EFF);
  background: rgba(var(--primary-color-rgb, 64, 158, 255), 0.05);
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

/* 暗色模式 */
html.dark .stat-card {
  background: var(--bg-color-secondary);
  box-shadow: 0 1px 3px var(--shadow-color);
}

html.dark .stat-value,
html.dark .mobile-card-header .plate,
html.dark .mobile-card-row .value,
html.dark .vehicle-info .plate {
  color: var(--text-color);
}

html.dark .stat-label,
html.dark .mobile-card-row .label,
html.dark .vehicle-info .detail,
html.dark .upload-icon,
html.dark .upload-text {
  color: var(--text-color-secondary);
}

html.dark .mobile-card {
  background: var(--bg-color-secondary);
  box-shadow: 0 1px 3px var(--shadow-color);
}

html.dark .mobile-card-actions {
  border-top-color: var(--border-color);
}

html.dark .upload-trigger {
  border-color: var(--border-color);
  background: var(--hover-bg-color);
}
</style>