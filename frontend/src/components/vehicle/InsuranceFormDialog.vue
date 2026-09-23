<template>
  <el-dialog v-model="visible" :title="editingId ? '编辑保险' : '添加保险'" width="90%" :style="{ maxWidth: '500px' }">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" size="default">
      <el-form-item label="车辆">
        <el-input :value="vehicleLabel" disabled />
      </el-form-item>
      <el-form-item label="保险类型" prop="insurance_types">
        <el-checkbox-group v-model="form.insurance_types" class="type-checkbox-group">
          <el-checkbox value="compulsory">交强险</el-checkbox>
          <el-checkbox value="commercial">商业险</el-checkbox>
          <el-checkbox value="seat">座位险</el-checkbox>
        </el-checkbox-group>
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
            <AppDatePicker
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
            <AppDatePicker
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
              <img v-if="doc.type !== 'pdf'" :src="getFileUrl(doc.url)" alt="保险附件" />
              <div v-else class="pdf-thumb">
                <el-icon><i class="weui-icon-outlined-note" /></el-icon>
                <span>PDF</span>
              </div>
              <div
                class="file-remove"
                @click="removeDocument(idx)"
                role="button"
                tabindex="0"
                aria-label="删除这个附件"
                @keydown.enter.prevent="removeDocument(idx)"
                @keydown.space.prevent="removeDocument(idx)"
              >×</div>
            </div>
            <div
              v-if="form.documents.length < 5"
              class="upload-btn"
              @click="triggerUpload"
              role="button"
              tabindex="0"
              aria-label="上传照片"
              @keydown.enter.prevent="triggerUpload"
              @keydown.space.prevent="triggerUpload"
            >
              <el-icon><i class="weui-icon-outlined-add" /></el-icon>
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
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import AppDatePicker from '../AppDatePicker.vue'
import { insuranceApi, uploadApi } from '../../api'
import { getImageUrl } from '../../utils/helpers'

interface InsuranceDocument {
  url: string
  type?: 'image' | 'pdf' | string
}

/** 保险表单弹窗：车辆由外部锁定，附件支持图片与 PDF */
const props = defineProps<{
  modelValue: boolean
  /** 非空表示编辑模式 */
  editingId: string
  /** 正在编辑的保险记录，新增时传 null */
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

const form = reactive({
  insurance_types: [] as string[],
  insurance_company: '',
  policy_number: '',
  start_date: '',
  end_date: '',
  premium: 0,
  coverage_amount: 0,
  beneficiary: '',
  documents: [] as InsuranceDocument[],
  remarks: ''
})

const rules: FormRules = {
  insurance_types: [{
    required: true,
    validator: (_rule, value, callback) => {
      if (!value || value.length === 0) {
        callback(new Error('请选择至少一个保险类型'))
      } else {
        callback()
      }
    },
    trigger: 'change'
  }],
  insurance_company: [{ required: true, message: '请输入保险公司', trigger: 'blur' }],
  start_date: [{ required: true, message: '请选择生效日期', trigger: 'change' }],
  end_date: [{ required: true, message: '请选择到期日期', trigger: 'change' }]
}

function resetForm(item: Record<string, any> | null) {
  Object.assign(form, {
    insurance_types: item?.insurance_types || (item?.insurance_type ? [item.insurance_type] : []),
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
}

function getFileUrl(url: string) {
  return getImageUrl(url)
}

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const isPdf = file.type === 'application/pdf'
  try {
    const res = await uploadApi.uploadInsurance(file, `${props.plateNumber || '车辆'}-${isPdf ? '保单' : '保险照片'}`)
    if (res.success && res.data) {
      form.documents.push({
        url: res.data.url,
        type: (res.data.type || (isPdf ? 'pdf' : 'image')) as 'image' | 'pdf'
      })
      ElMessage.success('文件上传成功')
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch {
    ElMessage.error('上传失败')
  }

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
    const data = {
      ...form,
      vehicle_id: props.vehicleId,
      plate_number: props.plateNumber
    }

    let res
    if (props.editingId) {
      res = await insuranceApi.update(props.editingId, data)
    } else {
      res = await insuranceApi.create(data)
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
  color: var(--sk-color-info);
}

.pdf-thumb :deep(.el-icon) {
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

.upload-tip {
  font-size: 12px;
  color: var(--sk-color-info);
  margin-top: 8px;
}

/* 暗色模式 */
html.dark .file-item {
  border-color: var(--border-color);
}

html.dark .pdf-thumb {
  background: var(--hover-bg-color);
  color: var(--text-color-secondary);
}

html.dark .upload-btn {
  border-color: var(--border-color);
  color: var(--text-color-secondary);
}

html.dark .upload-tip {
  color: var(--text-color-secondary);
}
</style>
