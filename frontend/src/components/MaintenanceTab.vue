<template>
  <div class="maintenance-tab">
    <!-- 车辆列表视图：保养口径的统计与列通过 slot 传进去 -->
    <VehiclePicker
      v-if="!selectedVehicle"
      v-model:keyword="vehicleSearchForm.keyword"
      :vehicles="vehicles"
      :loading="loading"
      :page="vehiclePagination.page"
      :page-size="vehiclePagination.pageSize"
      :total="vehiclePagination.total"
      count-field="maintenanceCount"
      :stats-columns="3"
      :stack-stats-on-mobile="false"
      @update:page="vehiclePagination.page = $event"
      @update:page-size="vehiclePagination.pageSize = $event"
      @search="loadVehicles"
      @reload="loadVehicles"
      @select="selectVehicle"
    >
      <template #stats>
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
      </template>

      <template #card="{ vehicle }">
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
      </template>

      <template #table-columns>
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
      </template>
    </VehiclePicker>

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
              <img v-for="(img, idx) in item.images.slice(0, 3)" :key="idx" :src="getImageUrl(img)" @click="previewImages(item.images, Number(idx))"  alt="保养照片，点击可放大查看" />
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
                <img :src="getImageUrl(row.images[0])" @click="previewImages(row.images)"  alt="保养照片，点击可放大查看" />
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

    <MaintenanceFormDialog
      v-model="dialogVisible"
      :editing-id="editingId"
      :item="editingItem"
      :vehicle-id="selectedVehicle?.id || ''"
      :vehicle-label="vehicleLabel"
      :plate-number="selectedVehicle?.plate_number || ''"
      @success="onFormSuccess"
    />

    <!-- 图片预览 -->
    <ImagePreviewDialog v-model:visible="imagePreviewVisible" :images="previewImagesList" :index="previewIndex" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Plus } from '@element-plus/icons-vue'
import { maintenanceApi, vehicleApi } from '../api'
import { getImageUrl } from '../utils/helpers'
import VehiclePicker from './vehicle/VehiclePicker.vue'
import MaintenanceFormDialog from './vehicle/MaintenanceFormDialog.vue'
import ImagePreviewDialog from './ImagePreviewDialog.vue'

const loading = ref(false)
const vehicles = ref<any[]>([])
const selectedVehicle = ref<any>(null)
const maintenanceRecords = ref<any[]>([])
const dialogVisible = ref(false)
const editingId = ref('')
const editingItem = ref<Record<string, any> | null>(null)
const imagePreviewVisible = ref(false)
const previewImagesList = ref<string[]>([])
const previewIndex = ref(0)

const vehicleSearchForm = reactive({ keyword: '' })
const vehiclePagination = reactive({ page: 1, pageSize: 10, total: 0 })
const stats = reactive({ thisMonth: 0, pending: 0, thisMonthCost: 0 })

const vehicleLabel = computed(() =>
  selectedVehicle.value
    ? `${selectedVehicle.value.plate_number} - ${selectedVehicle.value.brand} ${selectedVehicle.value.model}`
    : ''
)

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
    const [vehicleRes, statsRes] = await Promise.all([
      vehicleApi.getList({ ...vehicleSearchForm, ...vehiclePagination }),
      maintenanceApi.getStats()
    ])

    if (vehicleRes.success && vehicleRes.data) {
      const vehicleList = vehicleRes.data.data
      const vehiclesWithMaintenance = await Promise.all(
        vehicleList.map(async (v: any) => {
          try {
            const maintenanceRes = await maintenanceApi.getList({ vehicle_id: v.id, pageSize: 100 })
            const records = maintenanceRes.success && maintenanceRes.data ? maintenanceRes.data.data : []
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

    if (statsRes.success && statsRes.data) {
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
    const res = await maintenanceApi.getList({ vehicle_id: selectedVehicle.value.id, pageSize: 100 })
    if (res.success && res.data) {
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
  editingItem.value = item ?? null
  dialogVisible.value = true
}

// 表单提交成功：记录列表与车辆列表的统计都要跟着变
function onFormSuccess() {
  loadMaintenanceRecords()
  loadVehicles()
}

function previewImages(images: string[], index: number = 0) {
  previewImagesList.value = images
  previewIndex.value = Number(index)
  imagePreviewVisible.value = true
}

async function handleDelete(id: string) {
  try {
    const res = await maintenanceApi.delete(id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadMaintenanceRecords()
      loadVehicles()
    }
  } catch (error) {
    console.error('删除失败', error)
  }
}

onMounted(() => {
  loadVehicles()
})
</script>

<style scoped>
.maintenance-tab {
  width: 100%;
}

.action-bar {
  margin-bottom: 12px;
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
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
  color: var(--sk-color-info);
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
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
  color: var(--sk-color-info);
}

.mobile-card-row .value {
  color: #303133;
}

.mobile-card-row .value.text-danger {
  color: var(--sk-color-danger);
  font-weight: 500;
}

.mobile-card-row .value.text-warning {
  color: var(--sk-color-warning);
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
  color: var(--sk-color-info);
  font-size: 14px;
}

.hide-mobile {
  display: none;
}

.table-card {
  display: none;
}

.text-danger {
  color: var(--sk-color-danger);
}

.text-warning {
  color: var(--sk-color-warning);
}

.text-muted {
  color: var(--sk-color-info);
}

.mileage {
  font-size: 11px;
  color: var(--sk-color-info);
  margin-left: 2px;
}

.mileage-main {
  font-weight: 500;
  color: #303133;
  margin-right: 6px;
}

.date-sub {
  font-size: 12px;
  color: var(--sk-color-info);
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
  background: var(--sk-color-danger);
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
  color: var(--sk-color-info);
}

/* 暗色模式 */
html.dark .vehicle-info .plate,
html.dark .mobile-card-header .plate,
html.dark .mobile-card-header .type,
html.dark .mobile-card-row .value,
html.dark .mileage-main {
  color: var(--text-color);
}

html.dark .vehicle-info .brand,
html.dark .mobile-card-row .label,
html.dark .date-sub,
html.dark .empty-tip,
html.dark .images-preview-mini .more {
  color: var(--text-color-secondary);
}

html.dark .vehicle-header {
  background: var(--bg-color-secondary);
  box-shadow: 0 1px 3px var(--shadow-color);
}

html.dark .mobile-card {
  background: var(--bg-color-secondary);
  box-shadow: 0 1px 3px var(--shadow-color);
}

html.dark .maintenance-count,
html.dark .mobile-card-actions {
  border-top-color: var(--border-color);
}
</style>
