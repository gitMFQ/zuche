<template>
  <div class="violations-tab">
    <!-- 车辆列表视图 -->
    <template v-if="!selectedVehicle">
      <!-- 搜索栏 -->
      <el-card shadow="never" class="search-card">
        <el-form :inline="true" :model="vehicleSearchForm" size="default">
          <el-form-item>
            <el-input v-model="vehicleSearchForm.keyword" placeholder="车牌/品牌/型号" clearable @keyup.enter="loadVehicles" style="width: 130px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadVehicles">搜索</el-button>
          </el-form-item>
        </el-form>
      </el-card>

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

      <!-- 移动端车辆卡片 -->
      <div class="mobile-cards">
        <div v-for="vehicle in vehicles" :key="vehicle.id" class="mobile-card" @click="selectVehicle(vehicle)">
          <div class="mobile-card-header">
            <span class="plate-number" :class="vehicle.is_new_energy ? 'new-energy' : 'fuel'">{{ vehicle.plate_number }}</span>
            <el-icon><ArrowRight /></el-icon>
          </div>
          <div class="mobile-card-row">
            <span class="label">车辆</span>
            <span class="value">{{ vehicle.brand }} {{ vehicle.model }}</span>
          </div>
          <div class="mobile-card-row">
            <span class="label">违章状态</span>
            <span class="value">
              <el-tag :type="getVehicleViolationStatusType(vehicle)" size="small">
                {{ getVehicleViolationStatus(vehicle) }}
              </el-tag>
            </span>
          </div>
          <div class="mobile-card-row" v-if="vehicle.latestViolation">
            <span class="label">最近违章</span>
            <span class="value">
              <span class="date-main">{{ vehicle.latestViolation.violation_date }}</span>
              <span class="type-sub">{{ vehicle.latestViolation.violation_type }}</span>
            </span>
          </div>
          <div class="mobile-card-row" v-if="vehicle.pendingFines > 0">
            <span class="label">待处理罚款</span>
            <span class="value text-danger">¥{{ vehicle.pendingFines }}</span>
          </div>
          <div class="violation-count">
            <el-tag size="small" type="info">{{ vehicle.violationCount || 0 }} 条记录</el-tag>
            <el-tag size="small" type="warning" v-if="vehicle.pendingCount > 0">{{ vehicle.pendingCount }} 待处理</el-tag>
          </div>
        </div>
      </div>

      <!-- PC端车辆表格 -->
      <el-card shadow="never" class="table-card">
        <el-table :data="vehicles" v-loading="loading" stripe class="hide-mobile" @row-click="selectVehicle" style="cursor: pointer">
          <el-table-column prop="plate_number" label="车牌" width="120">
            <template #default="{ row }">
              <span class="plate-number" :class="row.is_new_energy ? 'new-energy' : 'fuel'">{{ row.plate_number }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="brand" label="品牌型号" min-width="120">
            <template #default="{ row }">{{ row.brand }} {{ row.model }}</template>
          </el-table-column>
          <el-table-column label="违章状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getVehicleViolationStatusType(row)" size="small">
                {{ getVehicleViolationStatus(row) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="最近违章" min-width="140">
            <template #default="{ row }">
              <div v-if="row.latestViolation" class="violation-cell">
                <span class="date-main">{{ row.latestViolation.violation_date }}</span>
                <span class="type-sub">{{ row.latestViolation.violation_type }}</span>
              </div>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="待处理罚款" width="100">
            <template #default="{ row }">
              <span v-if="row.pendingFines > 0" class="text-danger">¥{{ row.pendingFines }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="记录数" width="80" align="center">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.violationCount || 0 }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click.stop="selectVehicle(row)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="vehiclePagination.page"
          v-model:page-size="vehiclePagination.pageSize"
          :total="vehiclePagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, prev, pager, next"
          background
          class="pagination"
          @size-change="loadVehicles"
          @current-change="loadVehicles"
        />
      </el-card>
    </template>

    <!-- 车辆违章记录视图 -->
    <template v-else>
      <!-- 返回按钮和车辆信息 -->
      <div class="vehicle-header">
        <el-button @click="selectedVehicle = null" class="back-btn">
          <el-icon><ArrowLeft /></el-icon> 返回
        </el-button>
        <div class="vehicle-info">
          <span class="plate-number" :class="selectedVehicle.is_new_energy ? 'new-energy' : 'fuel'">{{ selectedVehicle.plate_number }}</span>
          <span class="brand">{{ selectedVehicle.brand }} {{ selectedVehicle.model }}</span>
        </div>
      </div>

      <!-- 操作栏 -->
      <div class="action-bar">
        <el-button type="primary" @click="openDialog()">
          <el-icon><Plus /></el-icon> 添加违章
        </el-button>
      </div>

      <!-- 移动端违章卡片 -->
      <div class="mobile-cards">
        <div v-for="item in violationRecords" :key="item.id" class="mobile-card">
          <div class="mobile-card-header">
            <span class="type">{{ item.violation_type }}</span>
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
            <span class="label">时间</span>
            <span class="value">{{ item.violation_date }}</span>
          </div>
          <div class="mobile-card-row" v-if="item.location">
            <span class="label">地点</span>
            <span class="value">{{ item.location }}</span>
          </div>
          <div class="mobile-card-row">
            <span class="label">罚款</span>
            <span class="value text-danger">¥{{ item.fine_amount || 0 }}</span>
          </div>
          <div class="mobile-card-row">
            <span class="label">扣分</span>
            <span class="value text-warning">{{ item.penalty_points || 0 }}分</span>
          </div>
          <div class="mobile-card-row" v-if="item.images && item.images.length">
            <span class="label">图片</span>
            <div class="images-preview-mini">
              <img v-for="(img, idx) in item.images.slice(0, 3)" :key="idx" :src="getImageUrl(img)" @click="previewImages(item.images)" />
              <span v-if="item.images.length > 3" class="more">+{{ item.images.length - 3 }}</span>
            </div>
          </div>
          <div class="mobile-card-actions">
            <el-button type="primary" size="small" @click="openHandleDialog(item)" v-if="item.status !== 'completed'">处理</el-button>
            <el-button size="small" @click="openDialog(item)">编辑</el-button>
            <el-popconfirm title="确定删除?" @confirm="handleDelete(item.id)">
              <template #reference>
                <el-button type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
        <div v-if="violationRecords.length === 0 && !loading" class="empty-tip">
          暂无违章记录，点击上方"添加违章"按钮添加
        </div>
      </div>

      <!-- PC端违章表格 -->
      <el-card shadow="never" class="table-card">
        <el-table :data="violationRecords" v-loading="loading" stripe class="hide-mobile">
          <el-table-column prop="order_no" label="订单号" width="130">
            <template #default="{ row }">
              <span v-if="row.order_no" class="link" @click="$router.push(`/orders/${row.order_id}`)">{{ row.order_no }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="violation_type" label="类型" width="100" />
          <el-table-column prop="violation_date" label="时间" width="100" />
          <el-table-column prop="location" label="地点" min-width="120" show-overflow-tooltip />
          <el-table-column prop="fine_amount" label="罚款" width="80">
            <template #default="{ row }">
              <span class="text-danger">¥{{ row.fine_amount }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="penalty_points" label="扣分" width="60" />
          <el-table-column label="图片" width="80">
            <template #default="{ row }">
              <div class="images-mini" v-if="row.images && row.images.length">
                <img :src="getImageUrl(row.images[0])" @click="previewImages(row.images)" />
                <span v-if="row.images.length > 1" class="badge">{{ row.images.length }}</span>
              </div>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">{{ row.status_text }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" fixed="right" width="150">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="openHandleDialog(row)" v-if="row.status !== 'completed'">处理</el-button>
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
    </template>

    <!-- 添加/编辑违章对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑违章' : '添加违章'" width="90%" :style="{ maxWidth: '450px' }">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="70px" size="default">
        <el-form-item label="车辆">
          <el-input :value="`${selectedVehicle?.plate_number} - ${selectedVehicle?.brand} ${selectedVehicle?.model}`" disabled />
        </el-form-item>
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
        <el-form-item label="图片">
          <div class="multi-upload">
            <div class="image-list">
              <div v-for="(img, idx) in form.images" :key="idx" class="image-item">
                <img :src="getImageUrl(img)" />
                <div class="image-remove" @click="removeImage(idx)">×</div>
              </div>
              <div v-if="form.images.length < 5" class="upload-btn" @click="triggerUpload">
                <el-icon><Plus /></el-icon>
                <span>{{ form.images.length }}/5</span>
              </div>
            </div>
            <input ref="fileInput" type="file" accept="image/*" capture="environment" style="display: none" @change="handleImageSelect" />
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

    <!-- 图片预览 -->
    <el-dialog v-model="imagePreviewVisible" title="违章图片" width="90%" :style="{ maxWidth: '500px' }">
      <el-carousel :initial-index="previewIndex" indicator-position="outside">
        <el-carousel-item v-for="(img, idx) in previewImagesList" :key="idx">
          <img :src="getImageUrl(img)" style="width: 100%; height: 100%; object-fit: contain" />
        </el-carousel-item>
      </el-carousel>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { violationApi, vehicleApi, orderApi, uploadApi } from '../api'

const loading = ref(false)
const submitting = ref(false)
const vehicles = ref<any[]>([])
const selectedVehicle = ref<any>(null)
const violationRecords = ref<any[]>([])
const dialogVisible = ref(false)
const handleDialogVisible = ref(false)
const formRef = ref<FormInstance>()
const fileInput = ref<HTMLInputElement>()
const editingId = ref('')
const recommendedOrders = ref<any[]>([])
const imagePreviewVisible = ref(false)
const previewImagesList = ref<string[]>([])
const previewIndex = ref(0)

const vehicleSearchForm = reactive({ keyword: '' })
const vehiclePagination = reactive({ page: 1, pageSize: 10, total: 0 })
const stats = reactive({ pending: 0, processing: 0, completed: 0, pendingFines: 0 })

const form = reactive({
  order_id: '',
  customer_name: '',
  customer_phone: '',
  violation_type: '',
  violation_date: '',
  location: '',
  fine_amount: 0,
  penalty_points: 0,
  images: [] as string[],
  remarks: ''
})

const handleForm = reactive({
  status: 'completed',
  handle_remarks: ''
})

const rules: FormRules = {
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

function getImageUrl(url: string) {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('data:')) return url
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
  return baseUrl + url
}

function getVehicleViolationStatus(vehicle: any) {
  if (!vehicle.violationCount) return '无记录'
  if (vehicle.pendingCount > 0) return '待处理'
  return '已处理'
}

function getVehicleViolationStatusType(vehicle: any) {
  if (!vehicle.violationCount) return 'info'
  if (vehicle.pendingCount > 0) return 'warning'
  return 'success'
}

// 加载车辆列表（带违章信息）
async function loadVehicles() {
  loading.value = true
  try {
    const [vehicleRes, statsRes]: any[] = await Promise.all([
      vehicleApi.getList({ ...vehicleSearchForm, ...vehiclePagination }),
      violationApi.getStats()
    ])
    
    if (vehicleRes.success) {
      const vehicleList = vehicleRes.data.data
      const vehiclesWithViolations = await Promise.all(
        vehicleList.map(async (v: any) => {
          try {
            const violationRes: any = await violationApi.getList({ vehicle_id: v.id, pageSize: 100 })
            const records = violationRes.success ? violationRes.data.data : []
            const pendingRecords = records.filter((r: any) => r.status !== 'completed')
            const pendingFines = pendingRecords.reduce((sum: number, r: any) => sum + (r.fine_amount || 0), 0)
            return {
              ...v,
              violationCount: records.length,
              pendingCount: pendingRecords.length,
              pendingFines,
              latestViolation: records.length > 0 ? records[0] : null
            }
          } catch {
            return { ...v, violationCount: 0, pendingCount: 0, pendingFines: 0, latestViolation: null }
          }
        })
      )
      vehicles.value = vehiclesWithViolations
      vehiclePagination.total = vehicleRes.data.total
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

// 选择车辆，加载其违章记录
async function selectVehicle(vehicle: any) {
  selectedVehicle.value = vehicle
  await loadViolationRecords()
}

// 加载选中车辆的违章记录
async function loadViolationRecords() {
  if (!selectedVehicle.value) return
  loading.value = true
  try {
    const res: any = await violationApi.getList({ vehicle_id: selectedVehicle.value.id, pageSize: 100 })
    if (res.success) {
      violationRecords.value = res.data.data
    }
  } catch (error) {
    console.error('加载违章记录失败', error)
  } finally {
    loading.value = false
  }
}

// 根据违章日期查找匹配的订单
async function onViolationDateChange(date: string) {
  if (!date) {
    recommendedOrders.value = []
    return
  }
  
  try {
    const res: any = await orderApi.getList({ pageSize: 500, vehicle_id: selectedVehicle.value?.id })
    if (res.success) {
      const violationDate = new Date(date)
      recommendedOrders.value = res.data.data.filter((o: any) => {
        const startDate = new Date(o.start_date)
        const endDate = new Date(o.end_date)
        return violationDate >= startDate && violationDate <= endDate
      })
      
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
    customer_name: item?.customer_name || '',
    customer_phone: item?.customer_phone || '',
    violation_type: item?.violation_type || '',
    violation_date: item?.violation_date || '',
    location: item?.location || '',
    fine_amount: item?.fine_amount ?? 0,
    penalty_points: item?.penalty_points ?? 0,
    images: item?.images || [],
    remarks: item?.remarks || ''
  })
  recommendedOrders.value = []
  dialogVisible.value = true
  
  if (item?.violation_date) {
    onViolationDateChange(item.violation_date)
  }
}

function onOrderChange(orderId: string) {
  if (!orderId) return
  
  const order = recommendedOrders.value.find(o => o.id === orderId)
  if (order) {
    form.customer_name = order.customer_name
    form.customer_phone = order.customer_phone
  }
}

function triggerUpload() {
  fileInput.value?.click()
}

async function handleImageSelect(e: Event) {
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
    const res = await uploadApi.uploadViolation(file)
    if (res.success && res.data) {
      form.images.push(res.data.url)
      ElMessage.success('图片上传成功')
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (error: any) {
    console.error('上传失败', error)
    ElMessage.error('上传失败')
  }

  target.value = ''
}

function removeImage(index: number) {
  form.images.splice(index, 1)
}

function previewImages(images: string[], index = 0) {
  previewImagesList.value = images
  previewIndex.value = index
  imagePreviewVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    const data = {
      ...form,
      vehicle_id: selectedVehicle.value.id,
      plate_number: selectedVehicle.value.plate_number
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
      loadViolationRecords()
      loadVehicles()
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
      loadViolationRecords()
      loadVehicles()
    }
  } catch (error) {
    console.error('处理失败', error)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id: string) {
  try {
    const res: any = await violationApi.delete(id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadViolationRecords()
      loadVehicles()
    }
  } catch (error) {
    console.error('删除失败', error)
  }
}

onMounted(() => loadVehicles())
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

/* 车辆头部 */
.vehicle-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.back-btn {
  padding: 8px 12px;
}

.vehicle-info {
  display: flex;
  flex-direction: column;
}

.vehicle-info .plate {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.vehicle-info .brand {
  font-size: 13px;
  color: #909399;
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

.mobile-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.plate, .type {
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

.mobile-card-row .value.text-warning {
  color: #E6A23C;
  font-weight: 500;
}

.mobile-card-row a {
  color: #409EFF;
  text-decoration: none;
  margin-left: 8px;
}

.violation-count {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.mobile-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.empty-tip {
  text-align: center;
  padding: 30px;
  color: #909399;
  font-size: 14px;
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

.text-muted {
  color: #909399;
}

.date-main {
  font-weight: 500;
  color: #303133;
  margin-right: 6px;
}

.type-sub {
  font-size: 12px;
  color: #909399;
}

.violation-cell {
  white-space: nowrap;
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

.link {
  color: #409EFF;
  cursor: pointer;
}

.link:hover {
  text-decoration: underline;
}

:deep(a) {
  color: #409EFF;
  text-decoration: none;
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

/* 表格中的小图 */
.images-mini {
  position: relative;
  width: 40px;
  height: 40px;
}

.images-mini img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
}

.images-mini .badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #F56C6C;
  color: #fff;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 8px;
}

/* 移动端小图预览 */
.images-preview-mini {
  display: flex;
  align-items: center;
  gap: 4px;
}

.images-preview-mini img {
  width: 30px;
  height: 30px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
}

.images-preview-mini .more {
  font-size: 12px;
  color: #909399;
}
</style>
