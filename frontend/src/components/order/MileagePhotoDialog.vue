<template>
  <el-dialog v-model="dialogVisible" :title="dialogTitle" width="90%" :style="{ maxWidth: '400px' }">
    <el-form :model="form" :label-width="labelWidth">
      <el-form-item :label="mileageLabel">
        <el-input-number v-model="form.mileage" :min="0" placeholder="公里数（选填）" style="width: 100%" />
      </el-form-item>
      <el-form-item :label="photoLabel">
        <div class="single-upload">
          <div v-if="form.image" class="image-preview">
            <img :src="getImageUrl(form.image)" @click="previewImage([form.image], 0)" alt="订单证件照片，点击可放大查看" />
            <div class="image-remove" @click="form.image = ''" role="button" tabindex="0" aria-label="删除这张照片" @keydown.enter.prevent="form.image = ''" @keydown.space.prevent="form.image = ''">×</div>
          </div>
          <div v-else class="upload-btn" @click="triggerUpload" role="button" tabindex="0" aria-label="上传照片" @keydown.enter.prevent="triggerUpload" @keydown.space.prevent="triggerUpload">
            <el-icon><i class="weui-icon-outlined-add" /></el-icon>
            <span>上传照片</span>
          </div>
          <input ref="imageInput" type="file" accept="image/*" style="display: none" @change="handleUpload" />
        </div>
      </el-form-item>
      <el-form-item :label="timeLabel || defaultTimeLabel">
        <AppDatePicker
          v-model="form.datetime"
          type="datetime"
          format="YYYY-MM-DD HH:mm"
          :value-format="isPickup ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD HH:mm:ss'"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" type="textarea" :rows="2" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">{{ confirmText || defaultConfirmText }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { uploadApi } from '../../api'
import AppDatePicker from '../AppDatePicker.vue'
import { getImageUrl } from '../../utils/helpers'
import dayjs from 'dayjs'

/**
 * 取车 / 还车（里程 + 照片 + 时间）弹窗。
 *
 * Orders 的取车、Orders 的还车、OrderDetail 的取车与「完成订单」四处表单结构完全一致，
 * 差别只在文案（单据收入系统在详情里叫「完成订单」，按钮与成分）与申报时间格式，
 * 通过 type + 可选的文案 props 表达。
 */
const props = defineProps<{
  visible: boolean
  type: 'pickup' | 'return'
  order?: any
  submitting?: boolean
  title?: string
  confirmText?: string
  timeLabel?: string
  defaultMileage?: number | null
  /** 上传落哪个目录；Orders/OrderDetail 用 other，Dashboard 历史上用 vehicle */
  uploadType?: 'other' | 'vehicle'
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', payload: { mileage: number | undefined; image: string; datetime: string; remarks: string }): void
  (e: 'preview', images: string[], index: number): void
}>()

const isPickup = computed(() => props.type === 'pickup')

const dialogTitle = computed(() => props.title || (isPickup.value ? '取车确认' : '还车确认'))
const defaultConfirmText = computed(() => (isPickup.value ? '确定取车' : '确定还车'))
const defaultTimeLabel = computed(() => (isPickup.value ? '实际取车时间' : '还车时间'))
const labelWidth = computed(() => (isPickup.value ? '100px' : '80px'))
const mileageLabel = computed(() => (isPickup.value ? '取车里程' : '还车里程'))
const photoLabel = computed(() => (isPickup.value ? '取车照片' : '还车照片'))

const dialogVisible = ref(false)
const imageInput = ref<HTMLInputElement>()

const form = reactive({
  mileage: undefined as number | undefined,
  image: '',
  datetime: '',
  remarks: ''
})

watch(
  () => props.visible,
  (val) => {
    dialogVisible.value = val
    if (val) {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      Object.assign(form, {
        mileage: props.defaultMileage ?? undefined,
        image: '',
        // 取车侧沿用带 T 的 16 位格式（Orders/OrderDetail/Dashboard 的提交逻辑依赖它，
        // 那边会做 replace('T',' ') + ':00'），还车侧用后端落库的 YYYY-MM-DD HH:mm:ss
        datetime: isPickup.value
          ? dayjs().format('YYYY-MM-DDTHH:mm')
          : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:00`,
        remarks: ''
      })
    }
  }
)

watch(dialogVisible, (val) => {
  emit('update:visible', val)
})

function previewImage(images: string[], index: number) {
  emit('preview', images, index)
}

function triggerUpload() {
  imageInput.value?.click()
}

async function handleUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const order = props.order
  const prefix = order?.plate_number || order?.order_no || '订单'
  const label = isPickup.value ? '取车照片' : '还车照片'
  try {
  const res =
    props.uploadType === 'vehicle'
      ? await uploadApi.uploadVehicle(file, `${prefix}-${label}`)
      : await uploadApi.uploadOther(file, `${prefix}-${label}`)
    if (res.success && res.data) {
      form.image = res.data.url
      ElMessage.success('上传成功')
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (error) {
    ElMessage.error('上传失败')
  }
  target.value = ''
}

function handleSubmit() {
  emit('submit', {
    mileage: form.mileage,
    image: form.image,
    datetime: form.datetime,
    remarks: form.remarks
  })
}
</script>

<style scoped>
/* 单图上传 */
.single-upload {
  width: 100%;
}

.single-upload .image-preview {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #dcdfe6;
}

.single-upload .image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}

.single-upload .image-remove {
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

.single-upload .upload-btn {
  width: 80px;
  height: 80px;
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

.single-upload .upload-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.single-upload .upload-btn .el-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

/* 暗色模式 */
html.dark .single-upload .upload-btn {
  border-color: var(--border-color);
  color: var(--text-color-secondary);
}

html.dark .single-upload .upload-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}
</style>
