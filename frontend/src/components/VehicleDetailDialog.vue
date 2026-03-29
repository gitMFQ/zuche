<template>
  <el-dialog v-model="dialogVisible" title="车辆详情" width="90%" :style="{ maxWidth: '550px' }">
    <el-descriptions :column="2" border size="default" v-if="vehicleData.id">
      <el-descriptions-item label="车牌号" :span="2">
        <span class="plate-number" :class="vehicleData.is_new_energy ? 'new-energy' : 'fuel'">{{ vehicleData.plate_number }}</span>
        <el-tag v-if="vehicleData.is_new_energy" type="success" size="small" style="margin-left: 8px">新能源</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="品牌">{{ vehicleData.brand }}</el-descriptions-item>
      <el-descriptions-item label="型号">{{ vehicleData.model }}</el-descriptions-item>
      <el-descriptions-item label="颜色">{{ vehicleData.color || '-' }}</el-descriptions-item>
      <el-descriptions-item label="年份">{{ vehicleData.year || '-' }}</el-descriptions-item>
      <el-descriptions-item label="座位数">{{ vehicleData.seats || '-' }}</el-descriptions-item>
      <el-descriptions-item label="里程">{{ vehicleData.mileage ? vehicleData.mileage + ' km' : '-' }}</el-descriptions-item>
      <el-descriptions-item label="日租金">
        <span class="view-value text-primary">{{ vehicleData.daily_rate ? '¥' + vehicleData.daily_rate : '-' }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="押金">{{ vehicleData.deposit ? '¥' + vehicleData.deposit : '-' }}</el-descriptions-item>
      <el-descriptions-item label="车架号" :span="2">{{ vehicleData.vin || '-' }}</el-descriptions-item>
      <el-descriptions-item label="发动机号" :span="2">{{ vehicleData.engine_number || '-' }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="getStatusType(vehicleData.status)" size="small">{{ getStatusText(vehicleData.status) }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="备注" :span="2">{{ vehicleData.remarks || '-' }}</el-descriptions-item>
    </el-descriptions>
    <div class="view-images" v-if="vehicleData.license_image || vehicleData.registration_image">
      <div class="view-image-item" v-if="vehicleData.license_image">
        <div class="view-image-label">行驶证</div>
        <img :src="getImageUrl(vehicleData.license_image)" @click="previewImage(vehicleData.license_image)" />
      </div>
      <div class="view-image-item" v-if="vehicleData.registration_image">
        <div class="view-image-label">登记证书</div>
        <img :src="getImageUrl(vehicleData.registration_image)" @click="previewImage(vehicleData.registration_image)" />
      </div>
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">关闭</el-button>
      <el-button type="primary" @click="goToDetail">查看完整信息</el-button>
    </template>

    <!-- 图片预览对话框 -->
    <el-dialog v-model="imagePreviewVisible" title="图片预览" width="90%" :style="{ maxWidth: '600px' }">
      <img :src="previewImageUrl" style="width: 100%; display: block;" />
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { getImageUrl } from '../utils/helpers'

const props = defineProps<{
  visible: boolean
  vehicle: any
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'edit', vehicle: any): void
}>()

const dialogVisible = ref(false)
const vehicleData = ref<any>({})
const imagePreviewVisible = ref(false)
const previewImageUrl = ref('')

watch(() => props.visible, (val) => {
  dialogVisible.value = val
})

watch(() => props.vehicle, (val) => {
  if (val) {
    vehicleData.value = { ...val }
  }
}, { immediate: true, deep: true })

watch(dialogVisible, (val) => {
  emit('update:visible', val)
})

function getStatusType(status: string): string {
  const map: Record<string, string> = {
    available: 'success',
    rented: 'warning',
    maintenance: 'info',
    unavailable: 'danger'
  }
  return map[status] || 'info'
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    available: '可用',
    rented: '已出租',
    maintenance: '维修中',
    unavailable: '不可用'
  }
  return map[status] || status
}

function previewImage(imageUrl: string) {
  previewImageUrl.value = getImageUrl(imageUrl)
  imagePreviewVisible.value = true
}

function goToDetail() {
  if (vehicleData.value.id) {
    emit('edit', vehicleData.value)
    dialogVisible.value = false
  }
}
</script>

<style scoped>
.view-images {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.view-image-item {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  overflow: hidden;
}

.view-image-label {
  background: #f5f7fa;
  padding: 6px 10px;
  font-size: 12px;
  color: #606266;
  font-weight: 500;
}

.view-image-item img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.2s;
}

.view-image-item img:hover {
  transform: scale(1.05);
}

.view-value {
  font-weight: 600;
}

.plate-number {
  font-weight: 600;
  font-size: 14px;
}

.plate-number.new-energy {
  background: linear-gradient(135deg, #00c853 0%, #69f0ae 100%);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
}

.plate-number.fuel {
  background: linear-gradient(135deg, #1976d2 0%, #63b3ed 100%);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
}
</style>
