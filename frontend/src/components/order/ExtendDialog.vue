<template>
  <el-dialog v-model="dialogVisible" title="续租" width="90%" :style="{ maxWidth: '400px' }">
    <el-form :model="form" label-width="80px">
      <el-form-item label="当前还车">
        <span>{{ formatDateTime(order?.end_date || '') }}</span>
      </el-form-item>
      <el-form-item label="新时间">
        <input
          type="datetime-local"
          :value="formatDateTimeLocal(form.new_end_date)"
          class="native-datetime-input"
          @change="onDateTimeChange"
        />
      </el-form-item>
      <el-form-item label="续租时长">
        <span>{{ durationText }}</span>
      </el-form-item>
      <el-form-item label="续租金额">
        <el-input-number v-model="form.extend_amount" :min="0" style="width: 100%" />
      </el-form-item>
      <el-form-item label="已支付">
        <el-switch v-model="form.has_payment" />
      </el-form-item>
      <template v-if="form.has_payment">
        <el-form-item label="支付金额">
          <el-input-number v-model="form.payment_amount" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="支付方式">
          <el-select v-model="form.payment_method" placeholder="选择支付方式" style="width: 100%">
            <el-option v-for="item in PAYMENT_METHOD_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
      </template>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">确定续租</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { PAYMENT_METHOD_OPTIONS } from '../../utils/constants'
import { formatDateTime, formatDateTimeLocal } from '../../utils/helpers'

/**
 * 续租弹窗。新还车时间默认在原还车时间上加一天，续租金额默认带出日租金，
 * 打开时按当前订单重新初始化，父级只需要处理 extend 请求。
 */
const props = defineProps<{
  visible: boolean
  order?: any
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', payload: {
    new_end_date: string
    extend_amount: number
    has_payment: boolean
    payment_amount?: number
    payment_method?: string
  }): void
}>()

const dialogVisible = ref(false)

const form = reactive({
  new_end_date: '',
  extend_amount: 0,
  has_payment: false,
  payment_amount: 0,
  payment_method: 'wechat'
})

watch(
  () => props.visible,
  (val) => {
    dialogVisible.value = val
    if (val) initForm()
  }
)

watch(dialogVisible, (val) => {
  emit('update:visible', val)
})

function initForm() {
  const order = props.order
  // 默认新还车时间为当前还车时间加1天
  let newEnd = ''
  if (order?.end_date) {
    const date = new Date(order.end_date)
    date.setDate(date.getDate() + 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    newEnd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  }
  Object.assign(form, {
    new_end_date: newEnd,
    // 默认续租金额为日租金
    extend_amount: order?.daily_rate || 0,
    has_payment: false,
    payment_amount: 0,
    payment_method: 'wechat'
  })
}

// 续租时长（小时数）
const extendHours = computed(() => {
  if (props.order?.end_date && form.new_end_date) {
    const oldEnd = new Date(props.order.end_date)
    const newEnd = new Date(form.new_end_date)
    return Math.max(0, Math.ceil((newEnd.getTime() - oldEnd.getTime()) / (1000 * 60 * 60)))
  }
  return 0
})

// 续租时长文本（几天几小时）
const durationText = computed(() => {
  const totalHours = extendHours.value
  if (totalHours <= 0) return '0小时'
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (days > 0 && hours > 0) {
    return `${days}天${hours}小时`
  } else if (days > 0) {
    return `${days}天`
  } else {
    return `${hours}小时`
  }
})

function onDateTimeChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.value) {
    form.new_end_date = target.value.replace('T', ' ') + ':00'
  }
}

function handleSubmit() {
  if (!form.new_end_date) {
    ElMessage.warning('请选择新的还车时间')
    return
  }
  emit('submit', {
    new_end_date: form.new_end_date,
    extend_amount: form.extend_amount,
    has_payment: form.has_payment,
    payment_amount: form.has_payment ? form.payment_amount : undefined,
    payment_method: form.has_payment ? form.payment_method : undefined
  })
}
</script>

<style scoped>
/* 原生日期时间输入框样式 */
.native-datetime-input {
  width: 100%;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  color: #606266;
  background: #fff;
  outline: none;
  transition: border-color 0.2s;
  -webkit-appearance: none;
}

.native-datetime-input:focus {
  border-color: var(--primary-color);
}

.native-datetime-input::-webkit-datetime-edit {
  padding: 0;
}

.native-datetime-input::-webkit-calendar-picker-indicator {
  width: 20px;
  height: 20px;
  cursor: pointer;
  opacity: 0.6;
}

.native-datetime-input::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
}
</style>
