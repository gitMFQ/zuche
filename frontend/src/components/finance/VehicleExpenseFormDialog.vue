<template>
  <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑车辆费用' : '新增车辆费用'" width="90%" :style="{ maxWidth: '500px' }">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
      <el-form-item label="车辆" prop="vehicle_id">
        <!-- 车辆只有十几台，一次拉全用可搜索下拉比套一个页面级选择器合适得多 -->
        <AppSelect v-model="form.vehicle_id" :options="vehicleOptions" filterable placeholder="搜索车牌" style="width: 100%" />
      </el-form-item>
      <el-form-item label="日期" prop="expense_date">
        <AppDatePicker v-model="form.expense_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
      </el-form-item>
      <el-form-item label="费用类型" prop="expense_type">
        <AppSelect v-model="form.expense_type" :options="typeOptions" style="width: 100%" />
      </el-form-item>
      <el-form-item label="支出金额">
        <el-input-number v-model="form.expense_amount" :min="0" :precision="2" style="width: 100%" />
      </el-form-item>
      <el-form-item>
        <template #label>收入金额<FieldTip content="车损赔偿、停运费填这里。同一行可以既有收入又有支出（台账的违章行就是）" /></template>
        <el-input-number v-model="form.income_amount" :min="0" :precision="2" style="width: 100%" />
      </el-form-item>
      <el-form-item label="发票">
        <AppSelect v-model="form.invoice_status" :options="INVOICE_STATUS_OPTIONS" style="width: 100%" />
      </el-form-item>
      <el-form-item>
        <template #label>分摊月数<FieldTip content="保险这类年费填 12，否则续保那个月的单车结余会是一条巨大的负数" /></template>
        <el-input-number v-model="form.amortize_months" :min="1" :max="60" style="width: 100%" />
      </el-form-item>
      <el-form-item v-if="!isEdit">
        <template #label>是否已付款<FieldTip content="只有已付款才会写资金流水；未付款只进费用台账（应付）" /></template>
        <el-switch v-model="form.is_paid" />
      </el-form-item>
      <el-form-item v-if="!isEdit && form.is_paid" label="付款账户" prop="account_id">
        <AppSelect v-model="form.account_id" :options="accountOptions" placeholder="从哪个账户付的" style="width: 100%" />
      </el-form-item>
      <el-form-item v-if="!isEdit && form.is_paid" label="付款日期">
        <AppDatePicker v-model="form.paid_at" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" type="textarea" :rows="2" placeholder="如：贺兰补胎、换轮胎" />
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
 * 车辆费用录入 / 编辑。
 *
 * 编辑时不提供「是否已付款」：已付款的行后端不允许改金额（改了会让已经入账的流水对不上），
 * 付款状态统一走列表上的「标记付款 / 撤销付款」动作。
 */
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import AppDatePicker from '../AppDatePicker.vue'
import AppSelect from '../AppSelect.vue'
import FieldTip from '../FieldTip.vue'
import type { AccountOption, VehicleExpenseItem, VehicleExpenseTypeItem, VehicleItem } from '../../api/types'
import { INVOICE_STATUS_OPTIONS } from '../../utils/constants'

const props = defineProps<{
  visible: boolean
  submitting?: boolean
  accounts: AccountOption[]
  types: VehicleExpenseTypeItem[]
  vehicles: VehicleItem[]
  /** 传了就是编辑模式 */
  expense?: VehicleExpenseItem | null
  /** 从某个车辆维度进来时预选车辆 */
  defaultVehicleId?: string
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
const vehicleOptions = computed(() =>
  props.vehicles.map((v) => ({ label: `${v.plate_number} ${v.brand} ${v.model}`, value: v.id }))
)
const typeOptions = computed(() => props.types.map((t) => ({ label: t.name, value: t.id })))
const accountOptions = computed(() => props.accounts.map((a) => ({ label: a.name, value: a.id })))

function today(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().substring(0, 10)
}

const formRef = ref<FormInstance>()
const form = reactive({
  vehicle_id: '',
  expense_date: today(),
  expense_type: 'repair',
  expense_amount: 0,
  income_amount: 0,
  invoice_status: 'none',
  amortize_months: 1,
  is_paid: false,
  account_id: '',
  paid_at: today(),
  remarks: ''
})

const rules: FormRules = {
  vehicle_id: [{ required: true, message: '请选择车辆', trigger: 'change' }],
  expense_date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  expense_type: [{ required: true, message: '请选择费用类型', trigger: 'change' }],
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
    form.vehicle_id = e?.vehicle_id ?? props.defaultVehicleId ?? ''
    form.expense_date = e?.expense_date ?? today()
    form.expense_type = e?.expense_type ?? props.types[0]?.id ?? 'repair'
    form.expense_amount = e?.expense_amount ?? 0
    form.income_amount = e?.income_amount ?? 0
    form.invoice_status = e?.invoice_status ?? 'none'
    form.amortize_months = e?.amortize_months ?? 1
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
  if (form.expense_amount <= 0 && form.income_amount <= 0) {
    ElMessage.warning('收入与支出不能同时为 0')
    return
  }
  emit('submit', {
    vehicle_id: form.vehicle_id,
    expense_date: form.expense_date,
    expense_type: form.expense_type,
    expense_amount: form.expense_amount,
    income_amount: form.income_amount,
    invoice_status: form.invoice_status,
    amortize_months: form.amortize_months,
    is_paid: form.is_paid,
    account_id: form.is_paid ? form.account_id : null,
    paid_at: form.is_paid ? form.paid_at : null,
    remarks: form.remarks || null
  })
}
</script>
