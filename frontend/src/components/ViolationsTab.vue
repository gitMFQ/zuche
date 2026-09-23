<template>
  <div class="violations-tab">
    <!-- 车辆列表视图：搜索/统计卡/分页由 VehiclePicker 兜，违章口径的字段通过 slot 传进去 -->
    <VehiclePicker
      v-if="!selectedVehicle"
      v-model:keyword="vehicleSearchForm.keyword"
      :vehicles="vehicles"
      :loading="loading"
      :page="vehiclePagination.page"
      :page-size="vehiclePagination.pageSize"
      :total="vehiclePagination.total"
      count-field="violationCount"
      @update:page="vehiclePagination.page = $event"
      @update:page-size="vehiclePagination.pageSize = $event"
      @search="loadVehicles"
      @reload="loadVehicles"
      @select="selectVehicle"
    >
      <template #stats>
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
      </template>

      <template #card="{ vehicle }">
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
      </template>

      <template #table-columns>
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
      </template>
    </VehiclePicker>

    <!-- 车辆违章记录视图 -->
    <template v-else>
      <!-- 返回按钮和车辆信息 -->
      <div class="vehicle-header">
        <el-button @click="selectedVehicle = null" class="back-btn">
          <el-icon><i class="weui-icon-outlined-back" /></el-icon> 返回
        </el-button>
        <div class="vehicle-info">
          <span class="plate-number" :class="selectedVehicle.is_new_energy ? 'new-energy' : 'fuel'">{{ selectedVehicle.plate_number }}</span>
          <span class="brand">{{ selectedVehicle.brand }} {{ selectedVehicle.model }}</span>
        </div>
      </div>

      <!-- 操作栏 -->
      <div class="action-bar">
        <el-button type="primary" @click="openDialog()">
          <el-icon><i class="weui-icon-outlined-add" /></el-icon> 添加违章
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
            <span class="value">
              <span class="link" @click="$router.push(`/orders/${item.order_id}`)">{{ item.order_no }}</span>
              <span v-if="item.source_name" class="source-tag" :style="{ background: item.source_color || '#0071e3' }">{{ item.source_name }}</span>
            </span>
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
          <div class="mobile-card-row" v-if="item.penalty_fee > 0">
            <span class="label">违约金</span>
            <span class="value text-danger">¥{{ item.penalty_fee }}</span>
          </div>
          <div class="mobile-card-row" v-if="item.collected_penalty > 0 || item.collected_fine > 0">
            <span class="label">已收</span>
            <span class="value text-success">
              <span v-if="item.collected_penalty > 0">违约金¥{{ item.collected_penalty }}</span>
              <span v-if="item.collected_penalty > 0 && item.collected_fine > 0">，</span>
              <span v-if="item.collected_fine > 0">罚款¥{{ item.collected_fine }}</span>
            </span>
          </div>
          <div class="mobile-card-row" v-if="item.handle_type">
            <span class="label">处理方式</span>
            <span class="value">{{ item.handle_type === 'self' ? '客户自行处理' : '门店代为处理' }}</span>
          </div>
          <div class="mobile-card-row" v-if="item.handle_type === 'self' && item.license_deposit > 0">
            <span class="label">行驶证押金</span>
            <span class="value text-danger">¥{{ item.license_deposit }}</span>
          </div>
          <div class="mobile-card-row" v-if="item.images && item.images.length">
            <span class="label">图片</span>
            <div class="images-preview-mini">
              <img v-for="(img, idx) in item.images.slice(0, 3)" :key="idx" :src="getImageUrl(img)" @click="previewImages(item.images)"  alt="违章照片，点击可放大查看" />
              <span v-if="item.images.length > 3" class="more">+{{ item.images.length - 3 }}</span>
            </div>
          </div>
          <div class="mobile-card-actions">
            <el-button type="warning" size="small" @click="openFeeDialog(item)">费用</el-button>
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
          <el-table-column prop="order_no" label="订单号" width="180">
            <template #default="{ row }">
              <span v-if="row.order_no">
                <span class="link" @click="$router.push(`/orders/${row.order_id}`)">{{ row.order_no }}</span>
                <span v-if="row.source_name" class="source-tag" :style="{ background: row.source_color || '#0071e3' }">{{ row.source_name }}</span>
              </span>
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
                <img :src="getImageUrl(row.images[0])" @click="previewImages(row.images)"  alt="违章照片，点击可放大查看" />
                <span v-if="row.images.length > 1" class="badge">{{ row.images.length }}</span>
              </div>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="违约金" width="80">
            <template #default="{ row }">
              <span v-if="row.penalty_fee > 0" class="text-danger">¥{{ row.penalty_fee }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="已收" width="100">
            <template #default="{ row }">
              <span v-if="row.collected_penalty > 0 || row.collected_fine > 0" class="text-success">
                {{ (row.collected_penalty || 0) + (row.collected_fine || 0) }}
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="处理方式" width="110">
            <template #default="{ row }">
              <span v-if="row.handle_type">{{ row.handle_type === 'self' ? '客户自处理' : '门店代处理' }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="行驶证押金" width="90">
            <template #default="{ row }">
              <span v-if="row.handle_type === 'self' && row.license_deposit > 0" class="text-danger">¥{{ row.license_deposit }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">{{ row.status_text }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" fixed="right" width="190">
            <template #default="{ row }">
              <el-button type="warning" link size="small" @click="openFeeDialog(row)">费用</el-button>
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

    <ViolationFormDialog
      v-model="dialogVisible"
      :editing-id="editingId"
      :item="editingItem"
      :vehicle-id="selectedVehicle?.id || ''"
      :vehicle-label="vehicleLabel"
      :plate-number="selectedVehicle?.plate_number || ''"
      @success="onFormSuccess"
    />

    <!-- 处理违章对话框 -->
    <el-dialog v-model="handleDialogVisible" title="处理违章" width="90%" :style="{ maxWidth: '400px' }">
      <el-form :model="handleForm" label-width="100px" size="default">
        <el-form-item label="处理方式">
          <el-radio-group v-model="handleForm.handle_type">
            <el-radio value="store">门店代为处理</el-radio>
            <el-radio value="self">客户自行处理</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="行驶证押金" v-if="handleForm.handle_type === 'self'">
          <el-input v-model.number="handleForm.license_deposit" type="number" :min="0" placeholder="行驶证出借押金">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
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

    <!-- 费用对话框 -->
    <el-dialog v-model="feeDialogVisible" title="费用收取" width="90%" :style="{ maxWidth: '400px' }">
      <el-form :model="feeForm" label-width="90px" size="default">
        <el-form-item label="违约金">
          <el-input v-model.number="feeForm.penalty_fee" type="number" :min="0" disabled>
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="已收违约金">
          <el-input v-model.number="feeForm.collected_penalty" type="number" :min="0" placeholder="已收取金额">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="已收罚款">
          <el-input v-model.number="feeForm.collected_fine" type="number" :min="0" placeholder="已收取金额">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="feeForm.fee_remarks" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="feeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitFee" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 图片预览 -->
    <ImagePreviewDialog v-model:visible="imagePreviewVisible" :images="previewImagesList" :index="previewIndex" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { violationApi, vehicleApi } from '../api'
import { getImageUrl } from '../utils/helpers'
import VehiclePicker from './vehicle/VehiclePicker.vue'
import ViolationFormDialog from './vehicle/ViolationFormDialog.vue'
import ImagePreviewDialog from './ImagePreviewDialog.vue'

const loading = ref(false)
const submitting = ref(false)
const vehicles = ref<any[]>([])
const selectedVehicle = ref<any>(null)
const violationRecords = ref<any[]>([])
const dialogVisible = ref(false)
const editingId = ref('')
const editingItem = ref<Record<string, any> | null>(null)
const imagePreviewVisible = ref(false)
const previewImagesList = ref<string[]>([])
const previewIndex = ref(0)

const vehicleSearchForm = reactive({ keyword: '' })
const vehiclePagination = reactive({ page: 1, pageSize: 10, total: 0 })
const stats = reactive({ pending: 0, processing: 0, completed: 0, pendingFines: 0 })

const vehicleLabel = computed(() =>
  selectedVehicle.value
    ? `${selectedVehicle.value.plate_number} - ${selectedVehicle.value.brand} ${selectedVehicle.value.model}`
    : ''
)

const handleDialogVisible = ref(false)
const handleForm = reactive({
  status: 'completed',
  handle_type: 'store',
  license_deposit: 0,
  handle_remarks: ''
})

const feeDialogVisible = ref(false)
const feeForm = reactive({
  id: '',
  penalty_fee: 0,
  collected_penalty: 0,
  collected_fine: 0,
  fee_remarks: ''
})

const statusTypeMap: Record<string, string> = {
  pending: 'warning',
  processing: 'primary',
  completed: 'success'
}

function getStatusType(status: string) {
  return statusTypeMap[status] || 'info'
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
    const [vehicleRes, statsRes] = await Promise.all([
      vehicleApi.getList({ ...vehicleSearchForm, ...vehiclePagination }),
      violationApi.getStats()
    ])

    if (vehicleRes.success && vehicleRes.data) {
      const vehicleList = vehicleRes.data.data
      const vehiclesWithViolations = await Promise.all(
        vehicleList.map(async (v: any) => {
          try {
            const violationRes = await violationApi.getList({ vehicle_id: v.id, pageSize: 100 })
            const records = violationRes.success && violationRes.data ? violationRes.data.data : []
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

    if (statsRes.success && statsRes.data) {
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
    const res = await violationApi.getList({ vehicle_id: selectedVehicle.value.id, pageSize: 100 })
    if (res.success && res.data) {
      violationRecords.value = res.data.data
    }
  } catch (error) {
    console.error('加载违章记录失败', error)
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
  loadViolationRecords()
  loadVehicles()
}

function previewImages(images: string[], index = 0) {
  previewImagesList.value = images
  previewIndex.value = index
  imagePreviewVisible.value = true
}

let currentHandleItem: any = null
function openHandleDialog(item: any) {
  currentHandleItem = item
  handleForm.status = item.status === 'pending' ? 'processing' : 'completed'
  handleForm.handle_type = item.handle_type || 'store'
  handleForm.license_deposit = item.license_deposit || 0
  handleForm.handle_remarks = item.handle_remarks || ''
  handleDialogVisible.value = true
}

async function submitHandle() {
  if (!currentHandleItem) return

  submitting.value = true
  try {
    const res = await violationApi.handle(currentHandleItem.id, handleForm)
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

// 打开费用对话框
function openFeeDialog(item: any) {
  feeForm.id = item.id
  feeForm.penalty_fee = item.penalty_fee ?? 0
  feeForm.collected_penalty = item.collected_penalty ?? 0
  feeForm.collected_fine = item.collected_fine ?? 0
  feeForm.fee_remarks = item.fee_remarks || ''
  feeDialogVisible.value = true
}

// 提交费用
async function submitFee() {
  submitting.value = true
  try {
    const res = await violationApi.collectFee(feeForm.id, {
      collected_penalty: feeForm.collected_penalty,
      collected_fine: feeForm.collected_fine,
      fee_remarks: feeForm.fee_remarks
    })
    if (res.success) {
      ElMessage.success('费用记录成功')
      feeDialogVisible.value = false
      loadViolationRecords()
    }
  } catch (error) {
    console.error('费用记录失败', error)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id: string) {
  try {
    const res = await violationApi.delete(id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadViolationRecords()
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
.violations-tab {
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

.plate, .type {
  font-size: 15px;
  font-weight: 600;
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

.mobile-card-row a {
  color: var(--primary-color);
  text-decoration: none;
  margin-left: 8px;
}

/* 卡片最后一行：右侧一组统计标签。
   横向内边距与数据行一致（卡片外壳的内边距已经归零） */
.violation-count {
  position: relative;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 10px 16px;
}

/* 与上一行之间一条 0.5px hairline，左缩进 16px（和 cell 分隔线一致） */
.violation-count::before {
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

.date-main {
  font-weight: 500;
  color: #303133;
  margin-right: 6px;
}

.type-sub {
  font-size: 12px;
  color: var(--sk-color-info);
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

.link {
  color: var(--primary-color);
  cursor: pointer;
}

.link:hover {
  text-decoration: underline;
}

:deep(a) {
  color: var(--primary-color);
  text-decoration: none;
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
html.dark .date-main {
  color: var(--text-color);
}

html.dark .vehicle-info .brand,
html.dark .empty-tip,
html.dark .type-sub,
html.dark .images-preview-mini .more {
  color: var(--text-color-secondary);
}

html.dark .vehicle-header {
  background: var(--bg-color-secondary);
  box-shadow: 0 1px 3px var(--shadow-color);
}
</style>
