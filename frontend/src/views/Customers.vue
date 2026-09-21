<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm" size="default">
        <el-form-item>
          <el-input v-model="searchForm.keyword" placeholder="姓名/手机/身份证" clearable @keyup.enter="loadData" style="width: 150px" />
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

    <!-- 列表三态（加载中 / 加载失败可重试 / 空数据） -->
    <DataState
      :loading="loading"
      :error="loadError"
      :empty="tableData.length === 0"
      empty-text="还没有客户，点右上角添加第一个"
      skeleton
      @retry="loadData"
    >
      <!-- 移动端卡片列表 -->
      <div class="mobile-cards">
      <div v-for="item in tableData" :key="item.id" class="mobile-card">
        <div class="mobile-card-header">
          <span class="customer-name">
            <el-icon v-if="item.is_regular" class="regular-star" @click="toggleRegular(item)"><Star /></el-icon>
            {{ item.name }}
          </span>
          <el-tag :type="item.status === 1 ? 'success' : 'danger'" size="small">
            {{ item.status === 1 ? '正常' : '禁用' }}
          </el-tag>
        </div>
        <div class="mobile-card-row">
          <span class="label">手机号</span>
          <span class="value"><a :href="'tel:' + item.phone">{{ item.phone }}</a></span>
        </div>
        <div class="mobile-card-row" v-if="item.id_card">
          <span class="label">身份证</span>
          <span class="value">{{ item.id_card }}</span>
        </div>
        <div class="mobile-card-row" v-if="item.license_expiry">
          <span class="label">驾照到期</span>
          <span class="value">{{ item.license_expiry }}</span>
        </div>
        <div class="mobile-card-row" v-if="item.source_name">
          <span class="label">来源</span>
          <span class="value">
            <span class="source-tag" :style="{ background: item.source_color || '#0071e3' }">{{ item.source_name }}</span>
          </span>
        </div>
        <div class="mobile-card-actions">
          <el-button type="info" size="small" plain @click="openViewDialog(item)">查看</el-button>
          <el-button type="warning" size="small" plain @click="viewOrders(item)">订单</el-button>
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
      <el-table :data="tableData" stripe class="hide-mobile">
        <el-table-column prop="name" label="姓名" width="100">
          <template #default="{ row }">
            <span>
              <el-icon v-if="row.is_regular" class="regular-star" @click="toggleRegular(row)"><Star /></el-icon>
              {{ row.name }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" width="120" />
        <el-table-column prop="id_card" label="身份证号" width="180" />
        <el-table-column prop="license_number" label="驾驶证号" width="180" />
        <el-table-column prop="license_expiry" label="驾照到期" width="100" />
        <el-table-column prop="source_name" label="来源" width="90">
          <template #default="{ row }">
            <span v-if="row.source_name" class="source-tag" :style="{ background: row.source_color || '#0071e3' }">{{ row.source_name }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="70">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="280">
          <template #default="{ row }">
            <el-button type="info" link size="small" @click="openViewDialog(row)">查看</el-button>
            <el-button type="warning" link size="small" @click="viewOrders(row)">订单</el-button>
            <el-button :type="row.is_regular ? 'warning' : 'default'" link size="small" @click="toggleRegular(row)">
              {{ row.is_regular ? '取消常用' : '设为常用' }}
            </el-button>
            <el-button type="primary" link size="small" @click="openDialog(row)">编辑</el-button>
            <el-popconfirm title="确定删除?" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button type="danger" link size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    </DataState>

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

    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑客户' : '添加客户'" width="90%" :style="{ maxWidth: '500px' }">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="70px" size="default">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="选填，留空表示暂无手机号" type="tel" />
        </el-form-item>
        <el-form-item label="身份证">
          <el-input v-model="form.id_card" placeholder="请输入身份证号" />
        </el-form-item>
        <el-form-item label="身份证照片">
          <div class="multi-upload">
            <div class="image-list">
              <div v-for="(img, idx) in form.id_card_images" :key="idx" class="image-item">
                <img :src="getImageUrl(img)" @click="previewImage(form.id_card_images, idx)"  alt="客户证件照片，点击可放大查看" />
                <div class="image-remove" @click="removeIdCardImage(idx)" role="button" tabindex="0" aria-label="删除这张照片" @keydown.enter.prevent="removeIdCardImage(idx)" @keydown.space.prevent="removeIdCardImage(idx)">×</div>
              </div>
              <div v-if="form.id_card_images.length < 2" class="upload-btn" @click="triggerUpload('id_card')" role="button" tabindex="0" aria-label="上传照片" @keydown.enter.prevent="triggerUpload('id_card')" @keydown.space.prevent="triggerUpload('id_card')">
                <el-icon><Plus /></el-icon>
                <span>{{ form.id_card_images.length }}/2</span>
              </div>
            </div>
            <input ref="idCardInput" type="file" accept="image/*" style="display: none" @change="handleUpload($event, 'id_card')" />
          </div>
        </el-form-item>
        <el-form-item label="驾驶证">
          <el-input v-model="form.license_number" placeholder="请输入驾驶证号" />
        </el-form-item>
        <el-form-item label="驾驶证照片">
          <div class="multi-upload">
            <div class="image-list">
              <div v-for="(img, idx) in form.license_images" :key="idx" class="image-item">
                <img :src="getImageUrl(img)" @click="previewImage(form.license_images, idx)"  alt="客户证件照片，点击可放大查看" />
                <div class="image-remove" @click="removeLicenseImage(idx)" role="button" tabindex="0" aria-label="删除这张照片" @keydown.enter.prevent="removeLicenseImage(idx)" @keydown.space.prevent="removeLicenseImage(idx)">×</div>
              </div>
              <div v-if="form.license_images.length < 2" class="upload-btn" @click="triggerUpload('license')" role="button" tabindex="0" aria-label="上传照片" @keydown.enter.prevent="triggerUpload('license')" @keydown.space.prevent="triggerUpload('license')">
                <el-icon><Plus /></el-icon>
                <span>{{ form.license_images.length }}/2</span>
              </div>
            </div>
            <input ref="licenseInput" type="file" accept="image/*" style="display: none" @change="handleUpload($event, 'license')" />
          </div>
        </el-form-item>
        <el-form-item label="驾照到期">
          <input 
            v-if="isMobile"
            type="date" 
            v-model="form.license_expiry" 
            class="native-date-input"
            style="width: 100%"
          />
          <el-date-picker 
            v-else
            v-model="form.license_expiry" 
            type="date" 
            placeholder="选择日期" 
            value-format="YYYY-MM-DD" 
            style="width: 100%" 
          />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="form.address" placeholder="请输入地址" />
        </el-form-item>
        <el-form-item label="状态" v-if="editingId">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">正常</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="客户来源">
          <el-select v-model="form.source_id" placeholder="选择客户来源（可选）" style="width: 100%" clearable>
            <el-option 
              v-for="s in orderSources" 
              :key="s.id" 
              :label="s.name" 
              :value="s.id" 
            />
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
    <el-dialog v-model="imagePreviewVisible" title="图片预览" width="90%" :style="{ maxWidth: '500px' }">
      <el-carousel :initial-index="previewIndex" indicator-position="outside">
        <el-carousel-item v-for="(img, idx) in previewImagesList" :key="idx">
          <img :src="getImageUrl(img)" style="width: 100%; height: 100%; object-fit: contain"  alt="客户证件照片" />
        </el-carousel-item>
      </el-carousel>
    </el-dialog>

    <!-- 查看详情对话框 -->
    <el-dialog v-model="viewDialogVisible" title="客户详情" width="90%" :style="{ maxWidth: '500px' }">
      <el-descriptions :column="1" border size="default">
        <el-descriptions-item label="姓名">
          <span class="view-value highlight">{{ viewData.name }}</span>
          <el-icon v-if="viewData.is_regular" class="regular-star"><Star /></el-icon>
        </el-descriptions-item>
        <el-descriptions-item label="手机号">
          <a :href="'tel:' + viewData.phone">{{ viewData.phone }}</a>
        </el-descriptions-item>
        <el-descriptions-item label="身份证">{{ viewData.id_card || '-' }}</el-descriptions-item>
        <el-descriptions-item label="驾驶证号">{{ viewData.license_number || '-' }}</el-descriptions-item>
        <el-descriptions-item label="驾照到期">
          <span :class="{ 'text-danger': isLicenseExpiringSoon(viewData.license_expiry) }">
            {{ viewData.license_expiry || '-' }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="客户来源">
          <span v-if="viewData.source_name" class="source-tag" :style="{ background: viewData.source_color || '#0071e3' }">{{ viewData.source_name }}</span>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="地址">{{ viewData.address || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="viewData.status === 1 ? 'success' : 'danger'" size="small">
            {{ viewData.status === 1 ? '正常' : '禁用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="备注">{{ viewData.remarks || '-' }}</el-descriptions-item>
      </el-descriptions>
      <div class="view-images" v-if="viewData.id_card_images?.length || viewData.license_images?.length">
        <div class="view-image-group" v-if="viewData.id_card_images?.length">
          <div class="view-image-label">身份证照片</div>
          <div class="view-image-list">
            <img v-for="(img, idx) in viewData.id_card_images" :key="idx" :src="getImageUrl(img)" @click="previewImage(viewData.id_card_images || [], Number(idx))"  alt="客户证件照片，点击可放大查看" />
          </div>
        </div>
        <div class="view-image-group" v-if="viewData.license_images?.length">
          <div class="view-image-label">驾驶证照片</div>
          <div class="view-image-list">
            <img v-for="(img, idx) in viewData.license_images" :key="idx" :src="getImageUrl(img)" @click="previewImage(viewData.license_images || [], Number(idx))"  alt="客户证件照片，点击可放大查看" />
          </div>
        </div>
      </div>
      <template #footer>
        <el-button :type="viewData.is_regular ? 'warning' : 'default'" @click="toggleRegular(viewData)">
          {{ viewData.is_regular ? '取消常用' : '设为常用' }}
        </el-button>
        <el-button type="warning" @click="viewDialogVisible = false; addToBlacklist(viewData)">拉黑</el-button>
        <el-button type="primary" @click="viewDialogVisible = false; openDialog(viewData)">编辑</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Star } from '@element-plus/icons-vue'
import { customerApi, blacklistApi, uploadApi } from '../api'
import { useDictStore } from '../stores/dict'
import DataState from '../components/DataState.vue'
import { useMobile } from '../composables/useMobile'
import { getImageUrl } from '../utils/helpers'

const router = useRouter()
const loading = ref(false)
const loadError = ref<string | null>(null)
const submitting = ref(false)
const { isMobile } = useMobile()
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()
const idCardInput = ref<HTMLInputElement>()
const licenseInput = ref<HTMLInputElement>()
const imagePreviewVisible = ref(false)
const previewImagesList = ref<string[]>([])
const previewIndex = ref(0)
const viewDialogVisible = ref(false)
const viewData = reactive<any>({})
// 订单来源走字典缓存：多个页面共用，避免每个页面各请求一次
const dictStore = useDictStore()
const orderSources = computed(() => dictStore.orderSources)

const searchForm = reactive({ keyword: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  name: '',
  phone: '',
  id_card: '',
  id_card_images: [] as string[],
  license_number: '',
  license_images: [] as string[],
  license_expiry: '',
  address: '',
  status: 1,
  source_id: '',
  remarks: ''
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  // 手机号选填：平台导出的客户没有完整手机号，留空时只做格式校验
  phone: [{ pattern: /^(1[3-9]\d{9})?$/, message: '手机号格式不正确', trigger: 'blur' }]
}

function previewImage(images: string[], index: number) {
  previewImagesList.value = images
  previewIndex.value = Number(index)
  imagePreviewVisible.value = true
}

function triggerUpload(type: 'id_card' | 'license') {
  if (type === 'id_card') {
    idCardInput.value?.click()
  } else {
    licenseInput.value?.click()
  }
}

async function handleUpload(e: Event, type: 'id_card' | 'license') {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const label = type === 'id_card' ? '身份证' : '驾驶证'
    const res = await uploadApi.uploadCustomer(file, `${form.name || '客户'}-${label}`)
    if (res.success && res.data) {
      if (type === 'id_card') {
        form.id_card_images.push(res.data.url)
      } else {
        form.license_images.push(res.data.url)
      }
      ElMessage.success('图片上传成功')
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (error) {
    ElMessage.error('上传失败')
  }

  target.value = ''
}

function removeIdCardImage(index: number) {
  form.id_card_images.splice(index, 1)
}

function removeLicenseImage(index: number) {
  form.license_images.splice(index, 1)
}

async function loadData() {
  loading.value = true
  loadError.value = null
  try {
    const res: any = await customerApi.getList({ ...searchForm, ...pagination })
    if (res.success) {
      tableData.value = res.data.data
      pagination.total = res.data.total
    } else {
      loadError.value = res.message || '加载失败，请重试'
    }
  } catch (error) {
    console.error('加载数据失败', error)
    // 原来只打 console，页面上是一张空表格，用户看不出是「没有数据」还是「加载失败」
    loadError.value = '加载失败，请检查网络后重试'
  } finally {
    loading.value = false
  }
}

function openViewDialog(row: any) {
  Object.assign(viewData, row)
  viewDialogVisible.value = true
}

function isLicenseExpiringSoon(date: string) {
  if (!date) return false
  const expiry = new Date(date)
  const now = new Date()
  const diff = expiry.getTime() - now.getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  return days <= 30 && days > 0
}

function openDialog(row?: any) {
  editingId.value = row?.id || ''
  loadOrderSources()
  if (row) {
    Object.assign(form, {
      name: row.name,
      phone: row.phone,
      id_card: row.id_card,
      id_card_images: row.id_card_images || [],
      license_number: row.license_number,
      license_images: row.license_images || [],
      license_expiry: row.license_expiry,
      address: row.address,
      status: row.status,
      source_id: row.source_id || '',
      remarks: row.remarks
    })
  } else {
    Object.assign(form, {
      name: '',
      phone: '',
      id_card: '',
      id_card_images: [],
      license_number: '',
      license_images: [],
      license_expiry: '',
      address: '',
      status: 1,
      source_id: '',
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
      res = await customerApi.update(editingId.value, form)
    } else {
      res = await customerApi.create(form)
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
    const res: any = await customerApi.delete(id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadData()
    }
  } catch (error) {
    console.error('删除失败', error)
  }
}

// 添加到黑名单
async function addToBlacklist(customer: any) {
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入拉黑原因', '添加到黑名单', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '如：逾期不还车、损坏车辆等',
      inputValidator: (val) => !!val || '请输入拉黑原因'
    })
    
    const res: any = await blacklistApi.add({
      customer_id: customer.id,
      name: customer.name,
      phone: customer.phone,
      id_card: customer.id_card,
      reason
    })
    
    if (res.success) {
      ElMessage.success('已添加到黑名单')
    }
  } catch (error) {
    // 取消操作
  }
}

// 设置/取消常用客户
async function toggleRegular(customer: any) {
  try {
    const newStatus = !customer.is_regular
    const res: any = await customerApi.setRegular(customer.id, newStatus)
    if (res.success) {
      customer.is_regular = newStatus
      // 同步更新列表中的数据
      const listItem = tableData.value.find(item => item.id === customer.id)
      if (listItem) {
        listItem.is_regular = newStatus
      }
      ElMessage.success(newStatus ? '已设为常用客户' : '已取消常用客户')
    }
  } catch (error) {
    console.error('设置常用客户失败', error)
  }
}

// 加载订单来源
async function loadOrderSources() {
  await dictStore.ensureOrderSources()
}

// 查看客户订单
function viewOrders(customer: any) {
  router.push({ path: '/orders', query: { customer_id: customer.id, customer_name: customer.name } })
}

onMounted(() => {
  loadData()

})
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
}

.mobile-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.customer-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.regular-star {
  color: #F7BA2A;
  margin-right: 4px;
  cursor: pointer;
  vertical-align: middle;
}

.mobile-card-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}

.mobile-card-row .label {
  color: var(--sk-color-info);
}

.mobile-card-row .value {
  color: #303133;
}

.mobile-card-row a {
  color: var(--primary-color);
  text-decoration: none;
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

  .pagination {
    justify-content: flex-end;
  }
}

.pagination {
  margin-top: 16px;
  justify-content: center;
  flex-wrap: wrap;
  row-gap: 8px;
}

/* 多图上传 */
.multi-upload {
  width: 100%;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.image-item {
  position: relative;
  width: 70px;
  height: 70px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #dcdfe6;
}

.image-item img {
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
  width: 70px;
  height: 70px;
  border: 2px dashed #dcdfe6;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--sk-color-info);
  font-size: 12px;
}

.upload-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
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
}

.view-image-group {
  margin-bottom: 16px;
}

.view-image-label {
  font-size: 13px;
  color: var(--sk-color-info);
  margin-bottom: 8px;
}

.view-image-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.view-image-list img {
  width: 100px;
  height: 70px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #dcdfe6;
  cursor: pointer;
}

.view-image-list img:hover {
  border-color: var(--primary-color);
}

.text-danger {
  color: var(--sk-color-danger);
}

.text-muted {
  color: var(--sk-color-info);
}

/* 来源标签 */
.source-tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: #fff;
}

/* 暗色模式 */
html.dark .mobile-card {
  background: var(--bg-color-secondary);
  box-shadow: 0 1px 3px var(--shadow-color);
}

html.dark .mobile-card-header {
  border-bottom-color: var(--border-color);
}

html.dark .mobile-card-row .label {
  color: var(--text-color-secondary);
}

html.dark .mobile-card-row .value {
  color: var(--text-color);
}

html.dark .mobile-card-actions {
  border-top-color: var(--border-color);
}

html.dark .image-preview,
html.dark .view-image-list img {
  border-color: var(--border-color);
}

html.dark .text-muted {
  color: var(--text-color-secondary);
}

html.dark .upload-btn {
  border-color: var(--border-color);
  color: var(--text-color-secondary);
}
</style>