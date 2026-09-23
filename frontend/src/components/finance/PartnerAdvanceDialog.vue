<template>
  <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑往来记录' : '新增往来记录'" width="90%" :style="{ maxWidth: '480px' }">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
      <el-form-item label="日期" prop="advance_date">
        <AppDatePicker v-model="form.advance_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
      </el-form-item>
      <el-form-item label="科目" prop="subject">
        <AppSelect v-model="form.subject" :options="ADVANCE_SUBJECT_OPTIONS" style="width: 100%" />
      </el-form-item>
      <el-form-item label="方向" prop="direction">
        <el-radio-group v-model="form.direction">
          <el-radio-button value="in">公司应付增加</el-radio-button>
          <el-radio-button value="out">已付合伙人</el-radio-button>
        </el-radio-group>
        <div class="field-hint">
          「公司应付增加」用于合伙人替公司垫钱（开办费、垫资、借款）；
          「已付合伙人」用于还款、报销、发工资 —— 这类记录保存后还要单独标记付款才会出流水。
        </div>
      </el-form-item>
      <el-form-item label="金额" prop="amount">
        <el-input-number v-model="form.amount" :min="0.01" :precision="2" style="width: 100%" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" type="textarea" :rows="3" placeholder="明细写这里，如：房租押金35000、买电脑2台3300" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/** 合伙人往来账（台账 file-5 的「科目/金额/备注」）。direction=out 的记录才需要标记付款 */
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import AppDatePicker from '../AppDatePicker.vue'
import AppSelect from '../AppSelect.vue'
import type { PartnerAdvanceItem } from '../../api/types'
import { ADVANCE_SUBJECT_OPTIONS } from '../../utils/constants'

const props = defineProps<{
  visible: boolean
  submitting?: boolean
  advance?: PartnerAdvanceItem | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', payload: Record<string, unknown>): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

const isEdit = computed(() => Boolean(props.advance?.id))
const formRef = ref<FormInstance>()
const form = reactive({
  advance_date: new Date(Date.now() + 8 * 3600 * 1000).toISOString().substring(0, 10),
  subject: 'setup',
  direction: 'in' as 'in' | 'out',
  amount: 0,
  remarks: ''
})

const rules: FormRules = {
  advance_date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  subject: [{ required: true, message: '请选择科目', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }]
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    const a = props.advance
    form.advance_date = a?.advance_date ?? new Date(Date.now() + 8 * 3600 * 1000).toISOString().substring(0, 10)
    form.subject = a?.subject ?? 'setup'
    form.direction = (a?.direction as 'in' | 'out') ?? 'in'
    form.amount = a?.amount ?? 0
    form.remarks = a?.remarks ?? ''
    formRef.value?.clearValidate()
  }
)

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  emit('submit', { ...form, remarks: form.remarks || null })
}
</script>

<style scoped>
.field-hint {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--sk-text-tertiary);
}
</style>
