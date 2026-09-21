<template>
  <el-dialog v-model="visible" :title="editingId ? '编辑保养' : '添加保养'" width="90%" :style="{ maxWidth: '500px' }">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" size="default">
      <el-form-item label="车辆">
        <el-input :value="vehicleLabel" disabled />
      </el-form-item>
      <el-form-item label="保养类型" prop="type">
        <el-checkbox-group v-model="form.type" class="type-checkbox-group">
          <el-checkbox v-for="t in typeOptions" :key="t.value" :value="t.value">{{ t.label }}</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="保养日期" prop="maintenance_date">
            <input
              v-if="isMobile"
              type="date"
              v-model="form.maintenance_date"
              class="native-date-input"
              style="width: 100%"
            />
            <el-date-picker
              v-else
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
            <input
              v-if="isMobile"
              type="date"
              v-model="form.next_maintenance_date"
              class="native-date-input"
              style="width: 100%"
            />
            <el-date-picker
              v-else
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
              <img :src="getImageUrl(img)" alt="保养照片" />
              <div
                class="image-remove"
                @click="removeImage(idx)"
                role="button"
                tabindex="0"
                aria-label="删除这张照片"
                @keydown.enter.prevent="removeImage(idx)"
                @keydown.space.prevent="removeImage(idx)"
              >×</div>
            </div>
            <div
              v-if="form.images.length < 5"
              class="upload-btn"
              @click="triggerUpload"
              role="button"
              tabindex="0"
              aria-label="上传照片"
              @keydown.enter.prevent="triggerUpload"
              @keydown.space.prevent="triggerUpload"
            >
              <el-icon><Plus /></el-icon>
              <span>{{ form.images.length }}/5</span>
            </div>
          </div>
          <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="handleImageSelect" />
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
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { maintenanceApi, uploadApi } from '../../api'
import { getImageUrl } from '../../utils/helpers'
import { useMobile } from '../../composables/useMobile'

/** 保养表单弹窗：车辆由外部锁定，这里只负责单条保养记录的字段 */
const props = defineProps<{
  modelValue: boolean
  /** 非空表示编辑模式 */
  editingId: string
  /** 正在编辑的保养记录，新增时传 null */
  item: Record<string, any> | null
  /** 所属车辆 id */
  vehicleId: string
  /** 车辆展示文案，如「京A12345 - 大众 朗逸」 */
  vehicleLabel: string
  /** 车牌号，用于上传文件的语义化命名 */
  plateNumber: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  /** 提交成功后抛出，由外部刷新列表 */
  (e: 'success'): void
}>()

const { isMobile } = useMobile()
const submitting = ref(false)
const formRef = ref<FormInstance>()
const fileInput = ref<HTMLInputElement>()

const visible = ref(props.modelValue)
watch(
  () => props.modelValue,
  (val) => {
    visible.value = val
    if (val) resetForm(props.item)
  }
)
watch(visible, (val) => emit('update:modelValue', val))

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

function resetForm(item: Record<string, any> | null) {
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
}

function triggerUpload() {
  fileInput.value?.click()
}

async function handleImageSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const res = await uploadApi.uploadMaintenance(file, `${props.plateNumber || '车辆'}-保养照片`)
    if (res.success && res.data) {
      form.images.push(res.data.url)
      ElMessage.success('图片上传成功')
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch {
    ElMessage.error('上传失败')
  }

  target.value = ''
}

function removeImage(index: number) {
  form.images.splice(index, 1)
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    const data = {
      ...form,
      vehicle_id: props.vehicleId,
      plate_number: props.plateNumber
    }

    let res
    if (props.editingId) {
      res = await maintenanceApi.update(props.editingId, data)
    } else {
      res = await maintenanceApi.create(data)
    }
    if (res.success) {
      ElMessage.success(props.editingId ? '修改成功' : '添加成功')
      visible.value = false
      emit('success')
    }
  } catch (error) {
    console.error('提交失败', error)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
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
  color: var(--sk-color-info);
  font-size: 12px;
}

.upload-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.upload-btn :deep(.el-icon) {
  font-size: 20px;
  margin-bottom: 4px;
}

/* 暗色模式 */
html.dark .image-item {
  border-color: var(--border-color);
}

html.dark .upload-btn {
  border-color: var(--border-color);
  color: var(--text-color-secondary);
}
</style>
