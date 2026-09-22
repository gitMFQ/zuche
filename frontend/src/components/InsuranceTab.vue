<template>
  <div class="insurance-tab">
    <!-- 车辆列表视图：保险口径的统计与列通过 slot 传进去 -->
    <VehiclePicker
      v-if="!selectedVehicle"
      v-model:keyword="vehicleSearchForm.keyword"
      :vehicles="vehicles"
      :loading="loading"
      :page="vehiclePagination.page"
      :page-size="vehiclePagination.pageSize"
      :total="vehiclePagination.total"
      count-field="insuranceCount"
      search-width="150px"
      @update:page="vehiclePagination.page = $event"
      @update:page-size="vehiclePagination.pageSize = $event"
      @search="loadVehicles"
      @reload="loadVehicles"
      @select="selectVehicle"
    >
      <template #stats>
        <div class="stat-card primary">
          <div class="stat-value">{{ stats.activeCount }}</div>
          <div class="stat-label">生效中</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">{{ stats.expiringSoon.length }}</div>
          <div class="stat-label">即将到期</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-value">{{ stats.expiredCount }}</div>
          <div class="stat-label">已过期</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">¥{{ stats.thisYearPremium }}</div>
          <div class="stat-label">本年保费</div>
        </div>
      </template>

      <template #card="{ vehicle }">
        <div class="mobile-card-row">
          <span class="label">车辆</span>
          <span class="value">{{ vehicle.brand }} {{ vehicle.model }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">保险状态</span>
          <span class="value">
            <el-tag :type="getVehicleInsuranceStatusType(vehicle)" size="small">
              {{ getVehicleInsuranceStatus(vehicle) }}
            </el-tag>
          </span>
        </div>
        <div class="mobile-card-row" v-if="vehicle.latestInsurance">
          <span class="label">到期日期</span>
          <span class="value" :class="{ 'text-danger': isExpired(vehicle.latestInsurance.end_date), 'text-warning': isExpiringSoon(vehicle.latestInsurance.end_date) }">
            {{ vehicle.latestInsurance.end_date }}
          </span>
        </div>
        <div class="insurance-count">
          <el-tag size="small" type="info">{{ vehicle.insuranceCount || 0 }} 条记录</el-tag>
        </div>
      </template>

      <template #table-columns>
        <el-table-column label="保险状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getVehicleInsuranceStatusType(row)" size="small">
              {{ getVehicleInsuranceStatus(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最新保险到期" width="120">
          <template #default="{ row }">
            <span v-if="row.latestInsurance" :class="{ 'text-danger': isExpired(row.latestInsurance.end_date), 'text-warning': isExpiringSoon(row.latestInsurance.end_date) }">
              {{ row.latestInsurance.end_date }}
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
      </template>
    </VehiclePicker>

    <!-- 车辆保险记录视图 -->
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
          <el-icon><Plus /></el-icon> 添加保险
        </el-button>
      </div>

      <!-- 移动端保险卡片 -->
      <div class="mobile-cards">
        <div v-for="item in insuranceRecords" :key="item.id" class="mobile-card" :class="{ 'expired': item.status === 'expired' }">
          <div class="mobile-card-header">
            <span class="type">{{ item.type_text }}</span>
            <el-tag :type="getStatusType(item.status)" size="small">{{ item.status_text }}</el-tag>
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
                <img v-if="doc.type !== 'pdf'" :src="getFileUrl(doc.url)" @click="previewDoc(item.documents || [], Number(idx))"  alt="保险附件，点击可放大查看" />
                <div v-else class="pdf-icon" @click="openPdf(doc.url)" role="button" tabindex="0" aria-label="打开 PDF 附件" @keydown.enter.prevent="openPdf(doc.url)" @keydown.space.prevent="openPdf(doc.url)">
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
        <div v-if="insuranceRecords.length === 0 && !loading" class="empty-tip">
          暂无保险记录，点击上方"添加保险"按钮添加
        </div>
      </div>

      <!-- PC端保险表格 -->
      <el-card shadow="never" class="table-card">
        <el-table :data="insuranceRecords" v-loading="loading" stripe class="hide-mobile">
          <el-table-column prop="type_text" label="类型" width="100" />
          <el-table-column prop="insurance_company" label="保险公司" min-width="120" show-overflow-tooltip />
          <el-table-column prop="policy_number" label="保单号" min-width="140" show-overflow-tooltip />
          <el-table-column prop="start_date" label="生效日期" width="100" />
          <el-table-column prop="end_date" label="到期日期" width="100">
            <template #default="{ row }">
              <span :class="{ 'text-danger': isExpired(row.end_date), 'text-warning': isExpiringSoon(row.end_date) }">
                {{ row.end_date }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="premium" label="保费" width="80">
            <template #default="{ row }">¥{{ row.premium }}</template>
          </el-table-column>
          <el-table-column label="附件" width="80">
            <template #default="{ row }">
              <div class="docs-mini" v-if="row.documents && row.documents.length">
                <template v-for="(doc, idx) in row.documents.slice(0, 2)" :key="idx">
                  <img v-if="doc.type !== 'pdf'" :src="getFileUrl(doc.url)" @click="previewDoc(row.documents, idx)"  alt="保险附件，点击可放大查看" />
                  <div v-else class="pdf-icon" @click="openPdf(doc.url)" role="button" tabindex="0" aria-label="打开 PDF 附件" @keydown.enter.prevent="openPdf(doc.url)" @keydown.space.prevent="openPdf(doc.url)">
                    <el-icon><Document /></el-icon>
                  </div>
                </template>
                <span v-if="row.documents.length > 2" class="badge">{{ row.documents.length }}</span>
              </div>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="status_text" label="状态" width="80">
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

    <InsuranceFormDialog
      v-model="dialogVisible"
      :editing-id="editingId"
      :item="editingItem"
      :vehicle-id="selectedVehicle?.id || ''"
      :vehicle-label="vehicleLabel"
      :plate-number="selectedVehicle?.plate_number || ''"
      @success="onFormSuccess"
    />

    <!-- 图片预览 -->
    <el-dialog v-model="imagePreviewVisible" title="附件预览" width="90%" :style="{ maxWidth: '500px' }">
      <el-carousel :initial-index="previewIndex" indicator-position="outside" v-if="previewDocs.length">
        <el-carousel-item v-for="(doc, idx) in previewDocs" :key="idx">
          <img v-if="doc.type !== 'pdf'" :src="getFileUrl(doc.url)" style="width: 100%; height: 100%; object-fit: contain"  alt="保险附件" />
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
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Document, Plus } from '@element-plus/icons-vue'
import { insuranceApi, vehicleApi } from '../api'
import { getImageUrl, isExpired, isExpiringSoon } from '../utils/helpers'
import VehiclePicker from './vehicle/VehiclePicker.vue'
import InsuranceFormDialog from './vehicle/InsuranceFormDialog.vue'

interface DocumentItem {
  url: string
  type?: 'image' | 'pdf' | string
}

const loading = ref(false)
const vehicles = ref<any[]>([])
const selectedVehicle = ref<any>(null)
const insuranceRecords = ref<any[]>([])
const dialogVisible = ref(false)
const editingId = ref('')
const editingItem = ref<Record<string, any> | null>(null)
const imagePreviewVisible = ref(false)
const previewDocs = ref<DocumentItem[]>([])
const previewIndex = ref(0)

const vehicleSearchForm = reactive({ keyword: '' })
const vehiclePagination = reactive({ page: 1, pageSize: 10, total: 0 })
const stats = reactive({ activeCount: 0, expiringSoon: [] as any[], expiredCount: 0, thisYearPremium: 0 })

const vehicleLabel = computed(() =>
  selectedVehicle.value
    ? `${selectedVehicle.value.plate_number} - ${selectedVehicle.value.brand} ${selectedVehicle.value.model}`
    : ''
)

const statusTypeMap: Record<string, string> = {
  active: 'success',
  expired: 'danger',
  pending: 'warning'
}

function getStatusType(status: string) {
  return statusTypeMap[status] || 'info'
}

function getVehicleInsuranceStatus(vehicle: any) {
  if (!vehicle.latestInsurance) return '无保险'
  if (isExpired(vehicle.latestInsurance.end_date)) return '已过期'
  if (isExpiringSoon(vehicle.latestInsurance.end_date)) return '即将到期'
  return '生效中'
}

function getVehicleInsuranceStatusType(vehicle: any) {
  if (!vehicle.latestInsurance) return 'info'
  if (isExpired(vehicle.latestInsurance.end_date)) return 'danger'
  if (isExpiringSoon(vehicle.latestInsurance.end_date)) return 'warning'
  return 'success'
}

function getFileUrl(url: string) {
  return getImageUrl(url)
}

function openPdf(url: string) {
  window.open(getFileUrl(url), '_blank')
}

function previewDoc(docs: DocumentItem[], index: number) {
  previewDocs.value = docs
  previewIndex.value = Number(index)
  imagePreviewVisible.value = true
}

// 加载车辆列表（带保险信息）
async function loadVehicles() {
  loading.value = true
  try {
    const [vehicleRes, statsRes] = await Promise.all([
      vehicleApi.getList({ ...vehicleSearchForm, ...vehiclePagination }),
      insuranceApi.getStats()
    ])

    if (vehicleRes.success && vehicleRes.data) {
      // 为每个车辆获取保险统计
      const vehicleList = vehicleRes.data.data
      const vehiclesWithInsurance = await Promise.all(
        vehicleList.map(async (v: any) => {
          try {
            const insuranceRes = await insuranceApi.getList({ vehicle_id: v.id, pageSize: 100 })
            const records = insuranceRes.success && insuranceRes.data ? insuranceRes.data.data : []
            const activeRecords = records.filter((r: any) => r.status === 'active')
            return {
              ...v,
              insuranceCount: records.length,
              latestInsurance: activeRecords.length > 0 ? activeRecords[0] : (records.length > 0 ? records[0] : null)
            }
          } catch {
            return { ...v, insuranceCount: 0, latestInsurance: null }
          }
        })
      )
      vehicles.value = vehiclesWithInsurance
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

// 选择车辆，加载其保险记录
async function selectVehicle(vehicle: any) {
  selectedVehicle.value = vehicle
  await loadInsuranceRecords()
}

// 加载选中车辆的保险记录
async function loadInsuranceRecords() {
  if (!selectedVehicle.value) return
  loading.value = true
  try {
    const res = await insuranceApi.getList({ vehicle_id: selectedVehicle.value.id, pageSize: 100 })
    if (res.success && res.data) {
      insuranceRecords.value = res.data.data
    }
  } catch (error) {
    console.error('加载保险记录失败', error)
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
  loadInsuranceRecords()
  loadVehicles()
}

async function handleDelete(id: string) {
  try {
    const res = await insuranceApi.delete(id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadInsuranceRecords()
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
.insurance-tab {
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

.mobile-card.expired {
  opacity: 0.7;
}

/* .type 是卡片标题，字号 / 字重 / 颜色交给 .mobile-card-header（17px / 600 / --m-fg-0） */

.mobile-card-row .value.text-danger {
  color: var(--sk-color-danger);
  font-weight: 500;
}

/* 卡片最后一行：右侧一条记录数标签。
   横向内边距与数据行一致（卡片外壳的内边距已经归零） */
.insurance-count {
  position: relative;
  padding: 10px 16px;
  text-align: right;
}

/* 与上一行之间一条 0.5px hairline，左缩进 16px（和 cell 分隔线一致） */
.insurance-count::before {
  content: '';
  position: absolute;
  left: 16px;
  right: 0;
  top: 0;
  height: 1px;
  background-color: var(--m-line);
  transform: scaleY(0.5);
  transform-origin: 0 0;
  pointer-events: none;
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
  color: var(--sk-color-danger);
  cursor: pointer;
}

.docs-mini .more {
  font-size: 12px;
  color: var(--sk-color-info);
}

.docs-mini .badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--sk-color-danger);
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
  color: var(--sk-color-info);
}

.pdf-preview :deep(.el-icon) {
  color: var(--sk-color-danger);
}

/* 暗色模式 */
html.dark .vehicle-info .plate {
  color: var(--text-color);
}

html.dark .vehicle-info .brand,
html.dark .empty-tip,
html.dark .docs-mini .more,
html.dark .pdf-preview {
  color: var(--text-color-secondary);
}

html.dark .vehicle-header {
  background: var(--bg-color-secondary);
  box-shadow: 0 1px 3px var(--shadow-color);
}

html.dark .docs-mini .pdf-icon {
  background: var(--hover-bg-color);
}
</style>
