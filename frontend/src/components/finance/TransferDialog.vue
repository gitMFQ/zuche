<template>
  <el-dialog v-model="dialogVisible" title="账户划转" width="90%" :style="{ maxWidth: '440px' }">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="转出" prop="from_account_id">
        <AppSelect v-model="form.from_account_id" :options="accountOptions" placeholder="选择转出账户" style="width: 100%" />
      </el-form-item>
      <el-form-item label="转入" prop="to_account_id">
        <AppSelect v-model="form.to_account_id" :options="accountOptions" placeholder="选择转入账户" style="width: 100%" />
      </el-form-item>
      <el-form-item label="金额" prop="amount">
        <el-input-number v-model="form.amount" :min="0.01" :precision="2" :step="1000" style="width: 100%" />
      </el-form-item>
      <el-form-item label="日期" prop="transfer_date">
        <AppDatePicker v-model="form.transfer_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" placeholder="如：微信提现到公户 / 平台打款入公户" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">划转</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 账户间划转。一次划转会在后端产生 out + in 两条流水，
 * 所以这里不做金额校验之外的事 —— 余额是否足够不是拒绝理由（现实里也有先转后补的）。
 */
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import AppDatePicker from '../AppDatePicker.vue'
import AppSelect from '../AppSelect.vue'
import type { AccountOption } from '../../api/types'

const props = defineProps<{
  visible: boolean
  submitting?: boolean
  accounts: AccountOption[]
  /** 默认转出账户（从资金页点进来时带上当前账户） */
  defaultAccountId?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', payload: Record<string, unknown>): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

const formRef = ref<FormInstance>()
const form = reactive({ from_account_id: '', to_account_id: '', amount: 0, transfer_date: '', remarks: '' })

// AppSelect 的选项
const accountOptions = computed(() => props.accounts.map((a) => ({ label: a.name, value: a.id })))

const rules: FormRules = {
  from_account_id: [{ required: true, message: '请选择转出账户', trigger: 'change' }],
  to_account_id: [
    { required: true, message: '请选择转入账户', trigger: 'change' },
    {
      validator: (_rule, value: string, callback: (error?: Error) => void) => {
        if (value && value === form.from_account_id) callback(new Error('转出与转入账户不能相同'))
        else callback()
      },
      trigger: 'change'
    }
  ],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  transfer_date: [{ required: true, message: '请选择日期', trigger: 'change' }]
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    form.from_account_id = props.defaultAccountId ?? props.accounts[0]?.id ?? ''
    form.to_account_id = ''
    form.amount = 0
    form.transfer_date = new Date(Date.now() + 8 * 3600 * 1000).toISOString().substring(0, 10)
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
