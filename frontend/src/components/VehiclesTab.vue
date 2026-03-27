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
          <span class="plate-number" :class="item.is_new_energy ? 'new-energy' : 'fuel'">{{ item.plate_number }}</span>
          <el-tag :type="getStatusType(item.actual_status || item.status)" size="small">{{ item.status_text }}</el-tag>
        </div>
        <div class="mobile-card-row">
          <span class="label">品牌型号</span>
          <span class="value">{{ item.brand }} {{ item.model }}</span>
        </div>
        <div class="mobile-card-row" v-if="item.daily_rate">
          <span class="label">日租金</span>
          <span class="value text-primary">¥{{ item.daily_rate }}</span>
        </div>
        <div class="mobile-card-row" v-if="item.deposit">
          <span class="label">押金</span>
          <span class="value">¥{{ item.deposit }}</span>
        </div>
        <div class="mobile-card-row" v-if="item.vin">
          <span class="label">车架号</span>
          <span class="value">{{ item.vin }}</span>
        </div>
        <div class="mobile-card-row" v-if="item.engine_number">
          <span class="label">发动机号</span>
          <span class="value">{{ item.engine_number }}</span>
        </div>
        <div class="mobile-card-images" v-if="item.license_image || item.registration_image">
          <span class="label">证件</span>
          <div class="image-thumbs">
            <img v-if="item.license_image" :src="getImageUrl(item.license_image)" @click="previewImage(item.license_image)" title="行驶证" />
            <img v-if="item.registration_image" :src="getImageUrl(item.registration_image)" @click="previewImage(item.registration_image)" title="登记证书" />
          </div>
        </div>
        <div class="mobile-card-actions">
          <el-button type="info" size="small" plain @click="openViewDialog(item)">查看</el-button>
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
        <el-table-column prop="plate_number" label="车牌号" width="140">
          <template #default="{ row }">
            <span class="plate-number" :class="row.is_new_energy ? 'new-energy' : 'fuel'">{{ row.plate_number }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="brand" label="品牌" width="80" />
        <el-table-column prop="model" label="型号" width="100" />
        <el-table-column prop="color" label="颜色" width="60" />
        <el-table-column prop="daily_rate" label="日租金" width="80">
          <template #default="{ row }">{{ row.daily_rate ? '¥' + row.daily_rate : '-' }}</template>
        </el-table-column>
        <el-table-column prop="deposit" label="押金" width="80">
          <template #default="{ row }">¥{{ row.deposit || 0 }}</template>
        </el-table-column>
        <el-table-column prop="vin" label="车架号" width="120" show-overflow-tooltip />
        <el-table-column prop="engine_number" label="发动机号" width="100" show-overflow-tooltip />
        <el-table-column label="证件" width="80">
          <template #default="{ row }">
            <div class="image-thumbs" v-if="row.license_image || row.registration_image">
              <img v-if="row.license_image" :src="getImageUrl(row.license_image)" @click="previewImage(row.license_image)" title="行驶证" />
              <img v-if="row.registration_image" :src="getImageUrl(row.registration_image)" @click="previewImage(row.registration_image)" title="登记证书" />
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.actual_status || row.status)" size="small">{{ row.status_text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="180">
          <template #default="{ row }">
            <el-button type="info" link size="small" @click="openViewDialog(row)">查看</el-button>
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
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑车辆' : '添加车辆'" width="90%" :style="{ maxWidth: '550px' }">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" size="default">
        <el-form-item label="车牌号" prop="plate_number">
          <el-input v-model="form.plate_number" placeholder="请输入车牌号" />
        </el-form-item>
        <el-form-item label="新能源">
          <el-switch v-model="form.is_new_energy" active-text="是" inactive-text="否" />
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
            <el-form-item label="日租金">
              <el-input-number v-model="form.daily_rate" :min="0" style="width: 100%" placeholder="可选" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="押金">
              <el-input-number v-model="form.deposit" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="车架号">
          <el-input v-model="form.vin" placeholder="车辆识别代号 (VIN)" />
        </el-form-item>
        <el-form-item label="发动机号">
          <el-input v-model="form.engine_number" placeholder="发动机编号" />
        </el-form-item>
        <el-form-item label="行驶证">
          <div class="image-upload">
            <div v-if="form.license_image" class="image-preview">
              <img :src="getImageUrl(form.license_image)" @click="previewImage(form.license_image)" />
              <div class="image-remove" @click="form.license_image = ''">×</div>
            </div>
            <div v-else class="upload-btn" @click="triggerUpload('license')">
              <el-icon><Plus /></el-icon>
              <span>上传</span>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="登记证书">
          <div class="image-upload">
            <div v-if="form.registration_image" class="image-preview">
              <img :src="getImageUrl(form.registration_image)" @click="previewImage(form.registration_image)" />
              <div class="image-remove" @click="form.registration_image = ''">×</div>
            </div>
            <div v-else class="upload-btn" @click="triggerUpload('registration')">
              <el-icon><Plus /></el-icon>
              <span>上传</span>
            </div>
          </div>
        </el-form-item>
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

    <!-- 图片预览 -->
    <el-dialog v-model="imagePreviewVisible" title="图片预览" width="90%" :style="{ maxWidth: '600px' }">
      <img :src="previewImageUrl" style="width: 100%; max-height: 70vh; object-fit: contain" />
    </el-dialog>

    <!-- 查看详情对话框 -->
    <el-dialog v-model="viewDialogVisible" title="车辆详情" width="90%" :style="{ maxWidth: '550px' }">
      <el-descriptions :column="2" border size="default">
        <el-descriptions-item label="车牌号" :span="2">
          <span class="plate-number" :class="viewData.is_new_energy ? 'new-energy' : 'fuel'">{{ viewData.plate_number }}</span>
          <el-tag v-if="viewData.is_new_energy" type="success" size="small" style="margin-left: 8px">新能源</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="品牌">{{ viewData.brand }}</el-descriptions-item>
        <el-descriptions-item label="型号">{{ viewData.model }}</el-descriptions-item>
        <el-descriptions-item label="颜色">{{ viewData.color || '-' }}</el-descriptions-item>
        <el-descriptions-item label="年份">{{ viewData.year || '-' }}</el-descriptions-item>
        <el-descriptions-item label="座位数">{{ viewData.seats || '-' }}</el-descriptions-item>
        <el-descriptions-item label="里程">{{ viewData.mileage ? viewData.mileage + ' km' : '-' }}</el-descriptions-item>
        <el-descriptions-item label="日租金">
          <span class="view-value text-primary">{{ viewData.daily_rate ? '¥' + viewData.daily_rate : '-' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="押金">{{ viewData.deposit ? '¥' + viewData.deposit : '-' }}</el-descriptions-item>
        <el-descriptions-item label="车架号" :span="2">{{ viewData.vin || '-' }}</el-descriptions-item>
        <el-descriptions-item label="发动机号" :span="2">{{ viewData.engine_number || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(viewData.actual_status || viewData.status)" size="small">{{ viewData.status_text }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ viewData.remarks || '-' }}</el-descriptions-item>
      </el-descriptions>
      <div class="view-images" v-if="viewData.license_image || viewData.registration_image">
        <div class="view-image-item" v-if="viewData.license_image">
          <div class="view-image-label">行驶证</div>
          <img :src="getImageUrl(viewData.license_image)" @click="previewImage(viewData.license_image)" />
        </div>
        <div class="view-image-item" v-if="viewData.registration_image">
          <div class="view-image-label">登记证书</div>
          <img :src="getImageUrl(viewData.registration_image)" @click="previewImage(viewData.registration_image)" />
        </div>
      </div>
      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="viewDialogVisible = false; openDialog(viewData)">编辑</el-button>
      </template>
    </el-dialog>

    <!-- 隐藏的文件输入 -->
    <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="handleFileSelect" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { vehicleApi, uploadApi } from '../api'
import { getImageUrl } from '../utils/helpers'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()
const fileInput = ref<HTMLInputElement>()
const uploadType = ref<'license' | 'registration'>('license')
const imagePreviewVisible = ref(false)
const previewImageUrl = ref('')
const viewDialogVisible = ref(false)
const viewData = reactive<any>({})

const searchForm = reactive({ keyword: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  plate_number: '',
  brand: '',
  model: '',
  color: '',
  year: new Date().getFullYear(),
  seats: 5,
  daily_rate: 0,
  deposit: 0,
  mileage: 0,
  vin: '',
  engine_number: '',
  license_image: '',
  registration_image: '',
  is_new_energy: false,
  status: 'available',
  remarks: ''
})

const rules: FormRules = {
  plate_number: [{ required: true, message: '请输入车牌号', trigger: 'blur' }],
  brand: [{ required: true, message: '请输入品牌', trigger: 'blur' }],
  model: [{ required: true, message: '请输入型号', trigger: 'blur' }]
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

function previewImage(url: string) {
  previewImageUrl.value = getImageUrl(url)
  imagePreviewVisible.value = true
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

function openViewDialog(row: any) {
  Object.assign(viewData, row)
  viewDialogVisible.value = true
}

function openDialog(row?: any) {
  editingId.value = row?.id || ''
  if (row) {
    Object.assign(form, {
      plate_number: row.plate_number || '',
      brand: row.brand || '',
      model: row.model || '',
      color: row.color || '',
      year: row.year || new Date().getFullYear(),
      seats: row.seats || 5,
      daily_rate: row.daily_rate || 0,
      deposit: row.deposit || 0,
      mileage: row.mileage || 0,
      vin: row.vin || '',
      engine_number: row.engine_number || '',
      license_image: row.license_image || '',
      registration_image: row.registration_image || '',
      is_new_energy: row.is_new_energy === 1,
      status: row.status || 'available',
      remarks: row.remarks || ''
    })
  } else {
    Object.assign(form, {
      plate_number: '',
      brand: '',
      model: '',
      color: '',
      year: new Date().getFullYear(),
      seats: 5,
      daily_rate: 0,
      deposit: 0,
      mileage: 0,
      vin: '',
      engine_number: '',
      license_image: '',
      registration_image: '',
      is_new_energy: false,
      status: 'available',
      remarks: ''
    })
  }
  dialogVisible.value = true
}

function triggerUpload(type: 'license' | 'registration') {
  uploadType.value = type
  fileInput.value?.click()
}

async function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }

  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过10MB')
    return
  }

  try {
    const res = await uploadApi.uploadVehicle(file)
    if (res.success && res.data) {
      if (uploadType.value === 'license') {
        form.license_image = res.data.url
      } else {
        form.registration_image = res.data.url
      }
      ElMessage.success('上传成功')
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (error) {
    console.error('上传失败', error)
    ElMessage.error('上传失败')
  }

  target.value = ''
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

.mobile-card-images {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.mobile-card-images .label {
  color: #909399;
  font-size: 13px;
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

/* 图片缩略图 */
.image-thumbs {
  display: flex;
  gap: 4px;
}

.image-thumbs img {
  width: 30px;
  height: 30px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
}

/* 图片上传 */
.image-upload {
  display: flex;
  gap: 8px;
}

.image-preview {
  position: relative;
  width: 100px;
  height: 70px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #dcdfe6;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}

.image-remove {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 20px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
}

.upload-btn {
  width: 100px;
  height: 70px;
  border: 2px dashed #dcdfe6;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #909399;
  font-size: 12px;
}

.upload-btn:hover {
  border-color: var(--primary-color, #409EFF);
  color: var(--primary-color, #409EFF);
}

.upload-btn .el-icon {
  font-size: 20px;
  margin-bottom: 4px;
}

/* 查看详情 */
.view-value {
  font-weight: 500;
}

.view-value.highlight {
  font-size: 16px;
  color: #303133;
}

.view-images {
  margin-top: 16px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.view-image-item {
  flex: 1;
  min-width: 150px;
  max-width: 200px;
}

.view-image-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.view-image-item img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #dcdfe6;
  cursor: pointer;
}

.view-image-item img:hover {
  border-color: var(--primary-color, #409EFF);
}
</style>