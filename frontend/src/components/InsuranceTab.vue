<template>
  <div class="insurance-tab">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm" size="default">
        <el-form-item>
          <el-input v-model="searchForm.keyword" placeholder="车牌/保单号/保险公司" clearable @keyup.enter="loadData" style="width: 150px" />
        </el-form-item>
        <el-form-item>
          <el-select v-model="searchForm.insurance_type" placeholder="保险类型" clearable style="width: 100px">
            <el-option label="交强险" value="compulsory" />
            <el-option label="商业险" value="commercial" />
            <el-option label="第三者责任险" value="third_party" />
            <el-option label="综合险" value="comprehensive" />
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
        <el-icon><Plus /></el-icon> 添加保险
      </el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card primary">
        <div class="stat-value">{{ stats.activeCount }}</div>
        <div class="stat-label">生效中</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">{{ stats.expiringSoon.length }}</div>
        <div class="stat-label">即将到期</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-value">{{ stats.expired.length }}</div>
        <div class="stat-label">已过期</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">¥{{ stats.thisYearPremium }}</div>
        <div class="stat-label">本年保费</div>
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
          <span class="label">保险类型</span>
          <span class="value">{{ item.type_text }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">保险公司</span>
          <span class="value">{{ item.insurance_company }}</span>
        </div>
        <div class="mobile-card-row" v-if="item.policy_number">
          <span class="label">保单号</span>
          <span class="value">{{ item.policy_number }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">有效期</span>
          <span class="value">{{ item.start_date }} ~ {{ item.end_date }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">保费</span>
          <span class="value text-danger">¥{{ item.premium }}</span>
        </div>
        <div class="mobile-card-row" v-if="item.documents && item.documents.length">
          <span class="label">附件</span>
          <div class="docs-mini">
            <template v-for="(doc, idx) in item.documents.slice(0, 3)" :key="idx">
              <img v-if="doc.type !== 'pdf'" :src="getFileUrl(doc.url)" @click="previewDoc(item.documents, idx)" />
              <div v-else class="pdf-icon" @click="openPdf(doc.url)">
                <el-icon><Document /></el-icon>
              </div>
            </template>
            <span v-if="item.documents.length > 3" class="more">+{{ item.documents.length - 3 }}</span>
          </div>
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
        <el-table-column prop="type_text" label="类型" width="90" />
        <el-table-column prop="insurance_company" label="保险公司" width="100" show-overflow-tooltip />
        <el-table-column prop="policy_number" label="保单号" width="120" show-overflow-tooltip />
        <el-table-column prop="start_date" label="生效日期" width="90" />
        <el-table-column prop="end_date" label="到期日期" width="90">
          <template #default="{ row }">
            <span :class="{ 'text-danger': isExpired(row.end_date), 'text-warning': isExpiringSoon(row.end_date) }">
              {{ row.end_date }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="premium" label="保费" width="70">
          <template #default="{ row }">¥{{ row.premium }}</template>
        </el-table-column>
        <el-table-column label="附件" width="80">
          <template #default="{ row }">
            <div class="docs-mini" v-if="row.documents && row.documents.length">
              <template v-for="(doc, idx) in row.documents.slice(0, 2)" :key="idx">
                <img v-if="doc.type !== 'pdf'" :src="getFileUrl(doc.url)" @click="previewDoc(row.documents, idx)" />
                <div v-else class="pdf-icon" @click="openPdf(doc.url)">
                  <el-icon><Document /></el-icon>
                </div>
              </template>
              <span v-if="row.documents.length > 2" class="badge">{{ row.documents.length }}</span>
            </div>
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
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑保险' : '添加保险'" width="90%" :style="{ maxWidth: '500px' }">
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
        <el-form-item label="保险类型" prop="insurance_type">
          <el-select v-model="form.insurance_type" placeholder="选择类型" style="width: 100%">
            <el-option label="交强险" value="compulsory" />
            <el-option label="商业险" value="commercial" />
            <el-option label="第三者责任险" value="third_party" />
            <el-option label="盗抢险" value="theft" />
            <el-option label="划痕险" value="scratch" />
            <el-option label="玻璃险" value="glass" />
            <el-option label="综合险" value="comprehensive" />
          </el-select>
        </el-form-item>
        <el-form-item label="保险公司" prop="insurance_company">
          <el-input v-model="form.insurance_company" placeholder="保险公司名称" />
        </el-form-item>
        <el-form-item label="保单号">
          <el-input v-model="form.policy_number" placeholder="保单号" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="生效日期" prop="start_date">
              <el-date-picker 
                v-model="form.start_date" 
                type="date" 
                placeholder="生效日期" 
                value-format="YYYY-MM-DD" 
                style="width: 100%" 
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="到期日期" prop="end_date">
              <el-date-picker 
                v-model="form.end_date" 
                type="date" 
                placeholder="到期日期" 
                value-format="YYYY-MM-DD" 
                style="width: 100%" 
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="保费" prop="premium">
              <el-input-number v-model="form.premium" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="保额">
              <el-input-number v-model="form.coverage_amount" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="受益人">
          <el-input v-model="form.beneficiary" placeholder="受益人" />
        </el-form-item>
        <el-form-item label="附件">
          <div class="multi-upload">
            <div class="file-list">
              <div v-for="(doc, idx) in form.documents" :key="idx" class="file-item">
                <img v-if="doc.type !== 'pdf'" :src="getFileUrl(doc.url)" />
                <div v-else class="pdf-thumb">
                  <el-icon><Document /></el-icon>
                  <span>PDF</span>
                </div>
                <div class="file-remove" @click="removeDocument(idx)">×</div>
              </div>
              <div v-if="form.documents.length < 5" class="upload-btn" @click="triggerUpload">
                <el-icon><Plus /></el-icon>
                <span>{{ form.documents.length }}/5</span>
              </div>
            </div>
            <div class="upload-tip">支持图片和PDF文件，最多5个</div>
            <input ref="fileInput" type="file" accept="image/*,.pdf" style="display: none" @change="handleFileSelect" />
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
    <el-dialog v-model="imagePreviewVisible" title="附件预览" width="90%" :style="{ maxWidth: '500px' }">
      <el-carousel :initial-index="previewIndex" indicator-position="outside" v-if="previewDocs.length">
        <el-carousel-item v-for="(doc, idx) in previewDocs" :key="idx">
          <img v-if="doc.type !== 'pdf'" :src="getFileUrl(doc.url)" style="width: 100%; height: 100%; object-fit: contain" />
          <div v-else class="pdf-preview">
            <el-icon :size="60"><Document /></el-icon>
            <p>PDF 文件</p>
            <el-button type="primary" @click="openPdf(doc.url)">打开文件</el-button>
          </div>
        </el-carousel-item>
      </el-carousel>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { insuranceApi, vehicleApi, uploadApi } from '../api'

interface DocumentItem {
  url: string
  type: 'image' | 'pdf'
}

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const fileInput = ref<HTMLInputElement>()
const editingId = ref('')
const vehicles = ref<any[]>([])
const imagePreviewVisible = ref(false)
const previewDocs = ref<DocumentItem[]>([])
const previewIndex = ref(0)

const searchForm = reactive({ keyword: '', insurance_type: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
const stats = reactive({ activeCount: 0, expiringSoon: [] as any[], expired: [] as any[], thisYearPremium: 0 })

const form = reactive({
  vehicle_id: '',
  plate_number: '',
  insurance_type: '',
  insurance_company: '',
  policy_number: '',
  start_date: '',
  end_date: '',
  premium: 0,
  coverage_amount: 0,
  beneficiary: '',
  documents: [] as DocumentItem[],
  remarks: ''
})

const rules: FormRules = {
  vehicle_id: [{ required: true, message: '请选择车辆', trigger: 'change' }],
  insurance_type: [{ required: true, message: '请选择保险类型', trigger: 'change' }],
  insurance_company: [{ required: true, message: '请输入保险公司', trigger: 'blur' }],
  start_date: [{ required: true, message: '请选择生效日期', trigger: 'change' }],
  end_date: [{ required: true, message: '请选择到期日期', trigger: 'change' }]
}

const statusTypeMap: Record<string, string> = {
  active: 'success',
  expired: 'danger',
  pending: 'warning'
}

function getStatusType(status: string) {
  return statusTypeMap[status] || 'info'
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

function getFileUrl(url: string) {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('data:')) return url
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
  return baseUrl + url
}

function openPdf(url: string) {
  window.open(getFileUrl(url), '_blank')
}

function previewDoc(docs: DocumentItem[], index: number) {
  previewDocs.value = docs
  previewIndex.value = index
  imagePreviewVisible.value = true
}

async function loadData() {
  loading.value = true
  try {
    const [listRes, statsRes]: any[] = await Promise.all([
      insuranceApi.getList({ ...searchForm, ...pagination }),
      insuranceApi.getStats()
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
    insurance_type: item?.insurance_type || '',
    insurance_company: item?.insurance_company || '',
    policy_number: item?.policy_number || '',
    start_date: item?.start_date || '',
    end_date: item?.end_date || '',
    premium: item?.premium ?? 0,
    coverage_amount: item?.coverage_amount ?? 0,
    beneficiary: item?.beneficiary || '',
    documents: item?.documents || [],
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

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // 检查文件类型
  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf'
  if (!isImage && !isPdf) {
    ElMessage.error('请选择图片或PDF文件')
    return
  }

  // 检查文件大小
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过10MB')
    return
  }

  // 上传
  try {
    const res = await uploadApi.uploadInsurance(file)
    if (res.success && res.data) {
      form.documents.push({
        url: res.data.url,
        type: res.data.type || (isPdf ? 'pdf' : 'image')
      })
      ElMessage.success('文件上传成功')
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (error: any) {
    console.error('上传失败', error)
    ElMessage.error('上传失败')
  }

  // 清空 input
  target.value = ''
}

function removeDocument(index: number) {
  form.documents.splice(index, 1)
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    let res: any
    if (editingId.value) {
      res = await insuranceApi.update(editingId.value, form)
    } else {
      res = await insuranceApi.create(form)
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
    const res: any = await insuranceApi.delete(id)
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
.insurance-tab {
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

.stat-card.primary { border-left: 3px solid #409EFF; }
.stat-card.warning { border-left: 3px solid #E6A23C; }
.stat-card.danger { border-left: 3px solid #F56C6C; }
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
  align-items: center;
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

/* 文件上传 */
.multi-upload {
  width: 100%;
}

.file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.file-item {
  position: relative;
  width: 70px;
  height: 70px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #dcdfe6;
}

.file-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pdf-thumb {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  color: #909399;
}

.pdf-thumb .el-icon {
  font-size: 28px;
  margin-bottom: 4px;
}

.pdf-thumb span {
  font-size: 10px;
}

.file-remove {
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
  width: 70px;
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
  border-color: #409EFF;
  color: #409EFF;
}

.upload-btn .el-icon {
  font-size: 20px;
  margin-bottom: 4px;
}

.upload-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}

/* 表格/卡片中的小文件 */
.docs-mini {
  display: flex;
  align-items: center;
  gap: 4px;
}

.docs-mini img {
  width: 30px;
  height: 30px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
}

.docs-mini .pdf-icon {
  width: 30px;
  height: 30px;
  background: #f5f7fa;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #F56C6C;
  cursor: pointer;
}

.docs-mini .more {
  font-size: 12px;
  color: #909399;
}

.docs-mini .badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #F56C6C;
  color: #fff;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 8px;
}

/* PDF 预览 */
.pdf-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
}

.pdf-preview .el-icon {
  color: #F56C6C;
}
</style>