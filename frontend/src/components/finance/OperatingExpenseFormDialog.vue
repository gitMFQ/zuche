<template>
  <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑开支' : '新增开支'" width="90%" :style="{ maxWidth: '460px' }">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
      <el-form-item label="日期" prop="expense_date">
        <AppDatePicker v-model="form.expense_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
      </el-form-item>
      <el-form-item label="项目" prop="category">
        <AppSelect v-model="form.category" :options="categoryOptions" filterable style="width: 100%" />
      </el-form-item>
      <el-form-item label="金额" prop="amount">
        <el-input-number v-model="form.amount" :min="0.01" :precision="2" :step="10" style="width: 100%" />
      </el-form-item>
      <el-form-item label="收款方">
        <el-input v-model="form.payee" placeholder="可选，如：加油站 / 电信 / 员工姓名" />
      </el-form-item>
      <el-form-item label="发票">
        <AppSelect v-model="form.invoice_status" :options="INVOICE_STATUS_OPTIONS" style="width: 100%" />
      </el-form-item>
      <el-form-item v-if="!isEdit" label="是否已付款">
        <el-switch v-model="form.is_paid" />
      </el-form-item>
      <el-form-item v-if="!isEdit && form.is_paid" label="付款账户" prop="account_id">
        <AppSelect v-model="form.account_id" :options="accountOptions" placeholder="微信 / 公户" style="width: 100%" />
      </el-form-item>
      <el-form-item v-if="!isEdit && form.is_paid" label="付款日期">
        <AppDatePicker v-model="form.paid_at" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" type="textarea" :rows="2" placeholder="如：三桶水 / 还雅阁车贷" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/** 运营开支录入。项目字典来自后端（台账的 27 项），付款状态只在新建时可设，后续走「标记付款」 */
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import AppDatePicker from '../AppDatePicker.vue'
import AppSelect from '../AppSelect.vue'
import type { AccountOption, ExpenseCategoryItem, OperatingExpenseItem } from '../../api/types'
import { INVOICE_STATUS_OPTIONS } from '../../utils/constants'

const props = defineProps<{
  visible: boolean
  submitting?: boolean
  accounts: AccountOption[]
  categories: ExpenseCategoryItem[]
  category?: string
  expense?: OperatingExpenseItem | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', payload: Record<string, unknown>): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

const isEdit = computed(() => Boolean(props.expense?.id))

// AppSelect 的选项
const categoryOptions = computed(() => props.categories.map((c) => ({ label: c.name, value: c.id })))
const accountOptions = computed(() => props.accounts.map((a) => ({ label: a.name, value: a.id })))

function today(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().substring(0, 10)
}

const formRef = ref<FormInstance>()
const form = reactive({
  expense_date: today(),
  category: 'meal',
  amount: 0,
  payee: '',
  invoice_status: 'none',
  is_paid: false,
  account_id: '',
  paid_at: today(),
  remarks: ''
})

const rules: FormRules = {
  expense_date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  category: [{ required: true, message: '请选择项目', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  account_id: [
    {
      validator: (_rule, value: string, callback: (error?: Error) => void) => {
        if (form.is_paid && !value) callback(new Error('标记已付款时必须选择付款账户'))
        else callback()
      },
      trigger: 'change'
    }
  ]
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    const e = props.expense
    form.expense_date = e?.expense_date ?? today()
    form.category = e?.category ?? props.category ?? props.categories[0]?.id ?? 'meal'
    form.amount = e?.amount ?? 0
    form.payee = e?.payee ?? ''
    form.invoice_status = e?.invoice_status ?? 'none'
    form.is_paid = false
    form.account_id = props.accounts[0]?.id ?? ''
    form.paid_at = e?.expense_date ?? today()
    form.remarks = e?.remarks ?? ''
    formRef.value?.clearValidate()
  }
)

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  emit('submit', {
    expense_date: form.expense_date,
    category: form.category,
    amount: form.amount,
    payee: form.payee || null,
    invoice_status: form.invoice_status,
    is_paid: form.is_paid,
    account_id: form.is_paid ? form.account_id : null,
    paid_at: form.is_paid ? form.paid_at : null,
    remarks: form.remarks || null
  })
}
</script>
