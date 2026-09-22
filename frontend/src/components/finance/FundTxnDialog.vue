<template>
  <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑记账' : '手工记账'" width="90%" :style="{ maxWidth: '480px' }">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="账户" prop="account_id">
        <el-select v-model="form.account_id" placeholder="选择账户" style="width: 100%">
          <el-option v-for="a in accounts" :key="a.id" :label="a.name" :value="a.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="日期" prop="txn_date">
        <el-date-picker v-model="form.txn_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
      </el-form-item>
      <el-form-item label="方向" prop="direction">
        <el-radio-group v-model="form.direction">
          <el-radio-button value="in">收入</el-radio-button>
          <el-radio-button value="out">支出</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="金额" prop="amount">
        <el-input-number v-model="form.amount" :min="0.01" :precision="2" :step="100" style="width: 100%" />
      </el-form-item>
      <el-form-item label="分类">
        <el-select v-model="form.category" clearable placeholder="可选" style="width: 100%">
          <el-option v-for="(label, value) in FUND_CATEGORY_TEXT_MAP" :key="value" :label="label" :value="value" />
        </el-select>
      </el-form-item>
      <el-form-item label="对方">
        <el-input v-model="form.counterparty" placeholder="客户 / 车牌 / 供应商" />
      </el-form-item>
      <el-form-item label="摘要" prop="summary">
        <el-input v-model="form.summary" placeholder="如：公户转马跃垫付款" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" type="textarea" :rows="2" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ isEdit ? '保存' : '记账' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 手工记账 / 编辑手工流水。
 *
 * 只有手工录入的流水能改金额（后端会按 source_type 拦），编辑时账户与日期也一起提交，
 * 因为后端要拿旧日期和新日期各校验一次账期锁定。
 */
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { AccountOption, FundTransactionItem } from '../../api/types'
import { FUND_CATEGORY_TEXT_MAP, FUND_DIRECTION_OPTIONS } from '../../utils/constants'

const props = defineProps<{
  visible: boolean
  submitting?: boolean
  accounts: AccountOption[]
  /** 传了就是编辑模式 */
  transaction?: FundTransactionItem | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', payload: Record<string, unknown>): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

const isEdit = computed(() => Boolean(props.transaction?.id))
const formRef = ref<FormInstance>()
const form = reactive({
  account_id: '',
  txn_date: '',
  direction: 'in' as 'in' | 'out',
  amount: 0,
  category: 'other',
  counterparty: '',
  summary: '',
  remarks: ''
})

const rules: FormRules = {
  account_id: [{ required: true, message: '请选择账户', trigger: 'change' }],
  txn_date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  summary: [{ required: true, message: '请输入摘要', trigger: 'blur' }]
}

function today(): string {
  const d = new Date()
  // 北京时间的当天，避免用 UTC 日期导致晚上 8 点后录成前一天
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().substring(0, 10)
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    const t = props.transaction
    form.account_id = t?.account_id ?? props.accounts[0]?.id ?? ''
    form.txn_date = t?.txn_date ?? today()
    form.direction = (t?.direction as 'in' | 'out') ?? 'in'
    form.amount = t?.amount ?? 0
    form.category = t?.category ?? 'other'
    form.counterparty = t?.counterparty ?? ''
    form.summary = t?.summary ?? ''
    form.remarks = t?.remarks ?? ''
    formRef.value?.clearValidate()
  }
)

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  emit('submit', {
    account_id: form.account_id,
    txn_date: form.txn_date,
    direction: form.direction,
    amount: form.amount,
    category: form.category,
    counterparty: form.counterparty || null,
    summary: form.summary,
    remarks: form.remarks || null
  })
}

// 供父组件在成功后复位
defineExpose({ reset: () => formRef.value?.resetFields() })

// 方向提示用（模板里没直接用 radio-group 的 options，保留常量引用避免未用告警）
void FUND_DIRECTION_OPTIONS
</script>
