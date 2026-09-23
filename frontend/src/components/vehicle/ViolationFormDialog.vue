<template>
  <el-dialog v-model="visible" :title="editingId ? '编辑违章' : '添加违章'" width="90%" :style="{ maxWidth: '450px' }">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="70px" size="default">
      <el-form-item label="车辆">
        <el-input :value="vehicleLabel" disabled />
      </el-form-item>
      <el-form-item label="时间" prop="violation_date">
        <AppDatePicker
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
          <AppSelect
            v-model="form.order_id"
            :options="orderOptions"
            :placeholder="recommendedOrders.length ? '推荐订单' : '无匹配订单'"
            clearable
            filterable
            style="width: 100%"
            @change="onOrderChange"
          />
          <div class="form-tip" v-if="recommendedOrders.length">
            <el-icon><i class="weui-icon-filled-info" /></el-icon>
            找到 {{ recommendedOrders.length }} 个该时段的租车订单
          </div>
          <div class="form-tip warning" v-else>
            <el-icon><i class="weui-icon-filled-report-problem" /></el-icon>
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
      <el-form-item label="类型" prop="violation_type">
        <el-input v-model="form.violation_type" placeholder="类型" />
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
      <el-form-item label="违约金">
        <el-input v-model.number="form.penalty_fee" type="number" placeholder="违约金" :min="0">
          <template #prepend>¥</template>
        </el-input>
      </el-form-item>
      <el-form-item label="图片">
        <div class="multi-upload">
          <div class="image-list">
            <div v-for="(img, idx) in form.images" :key="idx" class="image-item">
              <img :src="getImageUrl(img)" alt="违章照片" />
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
              <el-icon><i class="weui-icon-outlined-add" /></el-icon>
              <span>{{ form.images.length }}/5</span>
            </div>
          </div>
          <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="handleImageSelect" />
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
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import AppDatePicker from '../AppDatePicker.vue'
import AppSelect from '../AppSelect.vue'
import { violationApi, orderApi, uploadApi, type OrderListItem } from '../../api'
import { getImageUrl } from '../../utils/helpers'

/** 违章表单弹窗：新增与编辑共用，编辑时由外部把整条记录塞进来 */
const props = defineProps<{
  modelValue: boolean
  /** 非空表示编辑模式 */
  editingId: string
  /** 正在编辑的违章记录，新增时传 null */
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
const recommendedOrders = ref<OrderListItem[]>([])
// AppSelect 的选项。这个是全项目最长的 label（订单号-客户-车牌-起止），
// 手机上滚轮居中一行放不下，会截断尾部，前缀的订单号与客户名可见
const orderOptions = computed(() =>
  recommendedOrders.value.map((o) => ({
    label: `${o.order_no} - ${o.customer_name} (${o.plate_number}) ${o.start_date}~${o.end_date}`,
    value: o.id
  }))
)

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
  order_id: '',
  customer_name: '',
  customer_phone: '',
  violation_type: '',
  violation_date: '',
  location: '',
  fine_amount: 0,
  penalty_points: 0,
  penalty_fee: 0,
  images: [] as string[],
  remarks: ''
})

const rules: FormRules = {
  customer_name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
  violation_date: [{ required: true, message: '请选择违章日期', trigger: 'change' }],
  violation_type: [{ required: true, message: '请输入类型', trigger: 'blur' }],
  fine_amount: [{ required: true, message: '请输入罚款金额', trigger: 'blur' }],
  penalty_points: [{ required: true, message: '请输入扣分', trigger: 'blur' }]
}

function resetForm(item: Record<string, any> | null) {
  Object.assign(form, {
    order_id: item?.order_id || '',
    customer_name: item?.customer_name || '',
    customer_phone: item?.customer_phone || '',
    violation_type: item?.violation_type || '',
    violation_date: item?.violation_date || '',
    location: item?.location || '',
    fine_amount: item?.fine_amount ?? 0,
    penalty_points: item?.penalty_points ?? 0,
    penalty_fee: item?.penalty_fee ?? 0,
    images: item?.images || [],
    remarks: item?.remarks || ''
  })
  recommendedOrders.value = []
  if (item?.violation_date) {
    void loadRecommendedOrders(item.violation_date)
  }
}

// 根据违章日期查找匹配的订单
function onViolationDateChange(value: string) {
  if (!value) {
    recommendedOrders.value = []
    return
  }
  void loadRecommendedOrders(value)
}

async function loadRecommendedOrders(date: string) {
  try {
    const res = await orderApi.getList({ pageSize: 500, vehicle_id: props.vehicleId })
    if (res.success && res.data) {
      const violationDate = new Date(date)
      recommendedOrders.value = res.data.data.filter((o) => {
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

function onOrderChange(orderId: string) {
  if (!orderId) return

  const order = recommendedOrders.value.find(o => o.id === orderId)
  if (order) {
    form.customer_name = order.customer_name ?? ''
    form.customer_phone = order.customer_phone ?? ''
  }
}

function triggerUpload() {
  fileInput.value?.click()
}

async function handleImageSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const res = await uploadApi.uploadViolation(file, `${props.plateNumber || form.customer_name || '车辆'}-违章照片`)
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
      res = await violationApi.update(props.editingId, data)
    } else {
      res = await violationApi.create(data)
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
.order-select-wrapper {
  width: 100%;
}

.form-tip {
  font-size: 12px;
  color: var(--sk-color-success);
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.form-tip.warning {
  color: var(--sk-color-warning);
}

.form-tip :deep(.el-icon) {
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
html.dark .form-tip {
  color: var(--sk-color-success);
}

html.dark .image-item {
  border-color: var(--border-color);
}

html.dark .upload-btn {
  border-color: var(--border-color);
  color: var(--text-color-secondary);
}
</style>
