<template>
  <div class="maintenance-tab">
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
            <span class="label">保养状态</span>
            <span class="value">
              <el-tag :type="getVehicleMaintenanceStatusType(vehicle)" size="small">
                {{ getVehicleMaintenanceStatus(vehicle) }}
              </el-tag>
            </span>
          </div>
          <div class="mobile-card-row" v-if="vehicle.latestOilMaintenance">
            <span class="label">最近保养</span>
            <span class="value"><span v-if="vehicle.latestOilMaintenance.mileage" class="mileage-main">{{ vehicle.latestOilMaintenance.mileage }}km</span><span class="date-sub">{{ vehicle.latestOilMaintenance.maintenance_date }}</span></span>
          </div>
          <div class="mobile-card-row" v-if="vehicle.latestOilMaintenance?.next_maintenance_date || vehicle.latestOilMaintenance?.next_maintenance_mileage">
            <span class="label">下次保养</span>
            <span class="value" :class="{ 'text-danger': vehicle.latestOilMaintenance?.next_maintenance_date && isOverdue(vehicle.latestOilMaintenance.next_maintenance_date), 'text-warning': vehicle.latestOilMaintenance?.next_maintenance_date && isDueSoon(vehicle.latestOilMaintenance.next_maintenance_date) }">
              <span v-if="vehicle.latestOilMaintenance?.next_maintenance_mileage" class="mileage-main">{{ vehicle.latestOilMaintenance.next_maintenance_mileage }}km</span><span class="date-sub" v-if="vehicle.latestOilMaintenance?.next_maintenance_date">{{ vehicle.latestOilMaintenance.next_maintenance_date }}</span>
            </span>
          </div>
          <div class="maintenance-count">
            <el-tag size="small" type="info">{{ vehicle.maintenanceCount || 0 }} 条记录</el-tag>
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
          <el-table-column label="保养状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getVehicleMaintenanceStatusType(row)" size="small">
                {{ getVehicleMaintenanceStatus(row) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="最近保养" min-width="150">
            <template #default="{ row }">
              <div v-if="row.latestOilMaintenance" class="maintenance-cell">
                <span v-if="row.latestOilMaintenance.mileage" class="mileage-main">{{ row.latestOilMaintenance.mileage }}km</span>
                <span class="date-sub">{{ row.latestOilMaintenance.maintenance_date }}</span>
              </div>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="下次保养" min-width="150">
            <template #default="{ row }">
              <div v-if="row.latestOilMaintenance?.next_maintenance_date || row.latestOilMaintenance?.next_maintenance_mileage" class="maintenance-cell" :class="{ 'text-danger': row.latestOilMaintenance?.next_maintenance_date && isOverdue(row.latestOilMaintenance.next_maintenance_date), 'text-warning': row.latestOilMaintenance?.next_maintenance_date && isDueSoon(row.latestOilMaintenance.next_maintenance_date) }">
                <span v-if="row.latestOilMaintenance?.next_maintenance_mileage" class="mileage-main">{{ row.latestOilMaintenance.next_maintenance_mileage }}km</span>
                <span class="date-sub" v-if="row.latestOilMaintenance?.next_maintenance_date">{{ row.latestOilMaintenance.next_maintenance_date }}</span>
              </div>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="记录数" width="80" align="center">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.maintenanceCount || 0 }}</el-tag>
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

    <!-- 车辆保养记录视图 -->
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
          <el-icon><Plus /></el-icon> 添加保养
        </el-button>
      </div>

      <!-- 移动端保养卡片 -->
      <div class="mobile-cards">
        <div v-for="item in maintenanceRecords" :key="item.id" class="mobile-card">
          <div class="mobile-card-header">
            <span class="type">{{ item.type_text }}</span>
            <el-tag :type="getStatusType(item.status)" size="small">{{ item.status_text }}</el-tag>
          </div>
          <div class="mobile-card-row">
            <span class="label">保养日期</span>
            <span class="value">{{ item.maintenance_date }}</span>
          </div>
          <div class="mobile-card-row">
            <span class="label">费用</span>
            <span class="value text-danger">¥{{ item.cost }}</span>
          </div>
          <div class="mobile-card-row" v-if="item.mileage">
            <span class="label">里程</span>
            <span class="value">{{ item.mileage }}km</span>
          </div>
          <div class="mobile-card-row" v-if="item.garage">
            <span class="label">维修店</span>
            <span class="value">{{ item.garage }}</span>
          </div>
          <div class="mobile-card-row" v-if="item.next_maintenance_date || item.next_maintenance_mileage">
            <span class="label">下次保养</span>
            <span class="value text-warning">
              <span v-if="item.next_maintenance_mileage">{{ item.next_maintenance_mileage }}km</span>
              <span v-if="item.next_maintenance_mileage && item.next_maintenance_date"> / </span>
              <span v-if="item.next_maintenance_date">{{ item.next_maintenance_date }}</span>
            </span>
          </div>
          <div class="mobile-card-row" v-if="item.images && item.images.length">
            <span class="label">图片</span>
            <div class="images-preview-mini">
              <img v-for="(img, idx) in item.images.slice(0, 3)" :key="idx" :src="getImageUrl(img)" @click="previewImages(item.images, Number(idx))" />
              <span v-if="item.images.length > 3" class="more">+{{ item.images.length - 3 }}</span>
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
        <div v-if="maintenanceRecords.length === 0 && !loading" class="empty-tip">
          暂无保养记录，点击上方"添加保养"按钮添加
        </div>
      </div>

      <!-- PC端保养表格 -->
      <el-card shadow="never" class="table-card">
        <el-table :data="maintenanceRecords" v-loading="loading" stripe class="hide-mobile">
          <el-table-column prop="type_text" label="类型" min-width="120" />
          <el-table-column prop="maintenance_date" label="保养日期" width="100" />
          <el-table-column prop="cost" label="费用" width="80">
            <template #default="{ row }">¥{{ row.cost }}</template>
          </el-table-column>
          <el-table-column prop="mileage" label="里程" width="80">
            <template #default="{ row }">{{ row.mileage }}km</template>
          </el-table-column>
          <el-table-column prop="garage" label="维修店" min-width="100" show-overflow-tooltip />
          <el-table-column label="图片" width="80">
            <template #default="{ row }">
              <div class="images-mini" v-if="row.images && row.images.length">
                <img :src="getImageUrl(row.images[0])" @click="previewImages(row.images)" />
                <span v-if="row.images.length > 1" class="badge">{{ row.images.length }}</span>
              </div>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="下次保养" min-width="120">
            <template #default="{ row }">
              <div v-if="row.next_maintenance_date || row.next_maintenance_mileage">
                <span v-if="row.next_maintenance_mileage" class="text-warning">{{ row.next_maintenance_mileage }}km</span>
                <span v-if="row.next_maintenance_mileage && row.next_maintenance_date" class="text-muted"> / </span>
                <span v-if="row.next_maintenance_date" class="text-warning">{{ row.next_maintenance_date }}</span>
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
      </el-card>
    </template>

    <!-- 添加/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑保养' : '添加保养'" width="90%" :style="{ maxWidth: '500px' }">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" size="default">
        <el-form-item label="车辆">
          <el-input :value="`${selectedVehicle?.plate_number} - ${selectedVehicle?.brand} ${selectedVehicle?.model}`" disabled />
        </el-form-item>
        <el-form-item label="保养类型" prop="type">
          <el-checkbox-group v-model="form.type" class="type-checkbox-group">
            <el-checkbox v-for="t in typeOptions" :key="t.value" :value="t.value">{{ t.label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-row :gutter="12">
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
          <el-col :span="12">
            <el-form-item label="费用" prop="cost">
              <el-input-number v-model="form.cost" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="里程">
          <el-input-number v-model="form.mileage" :min="0" style="width: 100%" />
        </el-form-item>
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

    <!-- 图片预览 -->
    <el-dialog v-model="imagePreviewVisible" title="保养图片" width="90%" :style="{ maxWidth: '500px' }">
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
import { maintenanceApi, vehicleApi, uploadApi } from '../api'
import { getImageUrl } from '../utils/helpers'

const loading = ref(false)
const submitting = ref(false)
const vehicles = ref<any[]>([])
const selectedVehicle = ref<any>(null)
const maintenanceRecords = ref<any[]>([])
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const fileInput = ref<HTMLInputElement>()
const editingId = ref('')
const imagePreviewVisible = ref(false)
const previewImagesList = ref<string[]>([])
const previewIndex = ref(0)

// 保养类型选项
const typeOptions = [
  { value: 'maintenance', label: '保养' },
  { value: 'oil', label: '机油' },
  { value: 'oil_filter', label: '机滤' },
  { value: 'air_filter', label: '空滤' },
  { value: 'ac_filter', label: '空调滤' },
  { value: 'tire', label: '轮胎' },
  { value: 'coolant', label: '防冻液' },
  { value: 'brake_fluid', label: '刹车油' },
  { value: 'inspection', label: '年检' },
  { value: 'repair', label: '维修' },
  { value: 'other', label: '其它' }
]

const vehicleSearchForm = reactive({ keyword: '' })
const vehiclePagination = reactive({ page: 1, pageSize: 10, total: 0 })
const stats = reactive({ thisMonth: 0, pending: 0, thisMonthCost: 0 })

const form = reactive({
  type: [] as string[],
  maintenance_date: '',
  cost: 0,
  mileage: 0,
  garage: '',
  next_maintenance_date: '',
  next_maintenance_mileage: 0,
  images: [] as string[],
  status: 'completed',
  remarks: ''
})

const rules: FormRules = {
  type: [{ 
    required: true, 
    validator: (_rule, value, callback) => {
      if (!value || value.length === 0) {
        callback(new Error('请选择至少一个保养类型'))
      } else {
        callback()
      }
    },
    trigger: 'change' 
  }],
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

function isOverdue(date: string) {
  return new Date(date) < new Date()
}

function isDueSoon(date: string) {
  const now = new Date()
  const target = new Date(date)
  const diff = target.getTime() - now.getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  return days > 0 && days <= 30
}

function getVehicleMaintenanceStatus(vehicle: any) {
  // 只检查包含机油的保养记录
  const oilMaintenance = vehicle.latestOilMaintenance
  if (!oilMaintenance) return '无记录'
  if (oilMaintenance.status === 'pending') return '待保养'
  
  const currentMileage = vehicle.mileage || 0
  const nextMileage = oilMaintenance.next_maintenance_mileage
  
  // 按里程判断
  if (nextMileage && currentMileage >= nextMileage) return '已超公里'
  if (nextMileage && currentMileage >= nextMileage - 1000) return '待保养'
  
  // 按日期判断
  if (oilMaintenance.next_maintenance_date && isOverdue(oilMaintenance.next_maintenance_date)) return '已超期'
  if (oilMaintenance.next_maintenance_date && isDueSoon(oilMaintenance.next_maintenance_date)) return '即将到期'
  
  return '正常'
}

function getVehicleMaintenanceStatusType(vehicle: any) {
  // 只检查包含机油的保养记录
  const oilMaintenance = vehicle.latestOilMaintenance
  if (!oilMaintenance) return 'info'
  if (oilMaintenance.status === 'pending') return 'warning'
  
  const currentMileage = vehicle.mileage || 0
  const nextMileage = oilMaintenance.next_maintenance_mileage
  
  // 按里程判断
  if (nextMileage && currentMileage >= nextMileage) return 'danger'
  if (nextMileage && currentMileage >= nextMileage - 1000) return 'warning'
  
  // 按日期判断
  if (oilMaintenance.next_maintenance_date && isOverdue(oilMaintenance.next_maintenance_date)) return 'danger'
  if (oilMaintenance.next_maintenance_date && isDueSoon(oilMaintenance.next_maintenance_date)) return 'warning'
  
  return 'success'
}

// 加载车辆列表（带保养信息）
async function loadVehicles() {
  loading.value = true
  try {
    const [vehicleRes, statsRes]: any[] = await Promise.all([
      vehicleApi.getList({ ...vehicleSearchForm, ...vehiclePagination }),
      maintenanceApi.getStats()
    ])
    
    if (vehicleRes.success) {
      const vehicleList = vehicleRes.data.data
      const vehiclesWithMaintenance = await Promise.all(
        vehicleList.map(async (v: any) => {
          try {
            const maintenanceRes: any = await maintenanceApi.getList({ vehicle_id: v.id, pageSize: 100 })
            const records = maintenanceRes.success ? maintenanceRes.data.data : []
            // 获取最新的包含机油的保养记录
            const oilRecord = records.find((r: any) => r.types && r.types.includes('oil'))
            return {
              ...v,
              maintenanceCount: records.length,
              latestMaintenance: records.length > 0 ? records[0] : null,
              latestOilMaintenance: oilRecord || null
            }
          } catch {
            return { ...v, maintenanceCount: 0, latestMaintenance: null, latestOilMaintenance: null }
          }
        })
      )
      vehicles.value = vehiclesWithMaintenance
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

// 选择车辆，加载其保养记录
async function selectVehicle(vehicle: any) {
  selectedVehicle.value = vehicle
  await loadMaintenanceRecords()
}

// 加载选中车辆的保养记录
async function loadMaintenanceRecords() {
  if (!selectedVehicle.value) return
  loading.value = true
  try {
    const res: any = await maintenanceApi.getList({ vehicle_id: selectedVehicle.value.id, pageSize: 100 })
    if (res.success) {
      maintenanceRecords.value = res.data.data
    }
  } catch (error) {
    console.error('加载保养记录失败', error)
  } finally {
    loading.value = false
  }
}

function openDialog(item?: any) {
  editingId.value = item?.id || ''
  Object.assign(form, {
    type: item?.types || (item?.type ? [item.type] : []),
    maintenance_date: item?.maintenance_date || '',
    cost: item?.cost ?? 0,
    mileage: item?.mileage ?? 0,
    garage: item?.garage || '',
    next_maintenance_date: item?.next_maintenance_date || '',
    next_maintenance_mileage: item?.next_maintenance_mileage ?? 0,
    images: item?.images || [],
    status: item?.status || 'completed',
    remarks: item?.remarks || ''
  })
  dialogVisible.value = true
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
    const res = await uploadApi.uploadMaintenance(file)
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

function previewImages(images: string[], index: number = 0) {
  previewImagesList.value = images
  previewIndex.value = Number(index)
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
      res = await maintenanceApi.update(editingId.value, data)
    } else {
      res = await maintenanceApi.create(data)
    }
    if (res.success) {
      ElMessage.success(editingId.value ? '修改成功' : '添加成功')
      dialogVisible.value = false
      loadMaintenanceRecords()
      loadVehicles()
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
      loadMaintenanceRecords()
      loadVehicles()
    }
  } catch (error) {
    console.error('删除失败', error)
  }
}

onMounted(() => loadVehicles())
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

.stat-card.primary { border-left: 3px solid var(--primary-color, #409EFF); }
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

.maintenance-count {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #eee;
  text-align: right;
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

.mileage {
  font-size: 11px;
  color: #909399;
  margin-left: 2px;
}

.mileage-main {
  font-weight: 500;
  color: #303133;
  margin-right: 6px;
}

.date-sub {
  font-size: 12px;
  color: #909399;
}

.maintenance-cell {
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

/* 类型复选框 */
.type-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.type-checkbox-group :deep(.el-checkbox) {
  margin-right: 0;
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
  border-color: var(--primary-color, #409EFF);
  color: var(--primary-color, #409EFF);
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
