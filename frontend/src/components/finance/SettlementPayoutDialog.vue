<template>
  <el-dialog v-model="dialogVisible" title="结算付款" width="90%" :style="{ maxWidth: '460px' }">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="车主" prop="owner_id">
        <el-select v-model="form.owner_id" placeholder="选择车主" style="width: 100%">
          <el-option v-for="o in owners" :key="o.id" :label="o.name" :value="o.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="结算期" prop="period">
        <el-date-picker v-model="form.period" type="month" value-format="YYYY-MM" placeholder="归属月份" style="width: 100%" />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="form.payout_type" style="width: 100%">
          <el-option v-for="o in PAYOUT_TYPE_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="金额" prop="amount">
        <el-input-number v-model="form.amount" :min="0.01" :precision="2" :step="1000" style="width: 100%" />
      </el-form-item>
      <el-form-item label="付款账户" prop="account_id">
        <el-select v-model="form.account_id" placeholder="从哪个账户付的" style="width: 100%">
          <el-option v-for="a in accounts" :key="a.id" :label="a.name" :value="a.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="付款日期" prop="paid_at">
        <el-date-picker v-model="form.paid_at" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" placeholder="如：结车款 / 微信转" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 结算付款（台账底部支出区的「结车款」）。
 * 后端会把付款记录与 out 流水写在同一个 batch 里，所以这里只需要挑账户与日期。
 */
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { AccountOption, OwnerOption } from '../../api/types'
import { PAYOUT_TYPE_OPTIONS } from '../../utils/constants'

const props = defineProps<{
  visible: boolean
  submitting?: boolean
  accounts: AccountOption[]
  owners: OwnerOption[]
  defaultOwnerId?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', payload: Record<string, unknown>): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

function today(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().substring(0, 10)
}

const formRef = ref<FormInstance>()
const form = reactive({
  owner_id: '',
  period: today().substring(0, 7),
  payout_type: 'settlement',
  amount: 0,
  account_id: '',
  paid_at: today(),
  remarks: ''
})

const rules: FormRules = {
  owner_id: [{ required: true, message: '请选择车主', trigger: 'change' }],
  period: [{ required: true, message: '请选择结算期', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  account_id: [{ required: true, message: '请选择付款账户', trigger: 'change' }],
  paid_at: [{ required: true, message: '请选择付款日期', trigger: 'change' }]
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    form.owner_id = props.defaultOwnerId ?? ''
    form.period = today().substring(0, 7)
    form.payout_type = 'settlement'
    form.amount = 0
    form.account_id = props.accounts[0]?.id ?? ''
    form.paid_at = today()
    form.remarks = ''
    formRef.value?.clearValidate()
  }
)

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  emit('submit', { ...form, remarks: form.remarks || null })
}
</script>
