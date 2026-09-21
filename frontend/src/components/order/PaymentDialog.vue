<template>
  <el-dialog v-model="dialogVisible" title="添加支付" width="90%" :style="{ maxWidth: '400px' }">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="70px">
      <el-form-item label="金额" prop="amount">
        <el-input-number v-model="form.amount" :min="0" :precision="0" style="width: 100%" />
      </el-form-item>
      <el-form-item label="方式" prop="payment_method">
        <el-select v-model="form.payment_method" style="width: 100%">
          <el-option v-for="item in PAYMENT_METHOD_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="类型" prop="payment_type">
        <el-select v-model="form.payment_type" style="width: 100%">
          <el-option v-for="item in PAYMENT_TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" placeholder="备注信息" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { PAYMENT_METHOD_OPTIONS, PAYMENT_TYPE_OPTIONS } from '../../utils/constants'

/**
 * 添加支付记录弹窗。Orders 列表页与 OrderDetail 详情页原先各有一份逐行相同的实现。
 * 组件只负责收集并校验，真正的 addPayment 请求留给父级（两边的后续刷新不同）。
 */
const props = defineProps<{
  visible: boolean
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', payload: { amount: number; payment_method: string; payment_type: string; remarks: string }): void
}>()

const dialogVisible = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  amount: 0,
  payment_method: 'cash',
  payment_type: 'rent',
  remarks: ''
})

const rules: FormRules = {
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  payment_method: [{ required: true, message: '请选择支付方式', trigger: 'change' }],
  payment_type: [{ required: true, message: '请选择支付类型', trigger: 'change' }]
}

watch(
  () => props.visible,
  (val) => {
    dialogVisible.value = val
    if (val) {
      Object.assign(form, {
        amount: 0,
        payment_method: 'cash',
        payment_type: 'rent',
        remarks: ''
      })
    }
  }
)

watch(dialogVisible, (val) => {
  emit('update:visible', val)
})

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  emit('submit', {
    amount: form.amount,
    payment_method: form.payment_method,
    payment_type: form.payment_type,
    remarks: form.remarks
  })
}
</script>
