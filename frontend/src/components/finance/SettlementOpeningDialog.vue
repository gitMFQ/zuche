<template>
  <el-dialog v-model="dialogVisible" title="期初结转" width="90%" :style="{ maxWidth: '440px' }">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="历史明细不迁移，只结转这一个数"
      description="填「年初时公司应付车主的余额」。填在同一年同一车主上会覆盖，所以重复保存是安全的。"
      style="margin-bottom: 12px"
    />
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="车主" prop="owner_id">
        <el-select v-model="form.owner_id" placeholder="选择车主" style="width: 100%">
          <el-option v-for="o in owners" :key="o.id" :label="o.name" :value="o.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="车辆">
        <el-select v-model="form.vehicle_id" clearable placeholder="留空 = 按车主汇总" style="width: 100%">
          <el-option v-for="v in vehicles" :key="v.id" :label="v.plate_number" :value="v.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="年份" prop="fiscal_year">
        <el-input-number v-model="form.fiscal_year" :min="2000" :max="2100" style="width: 100%" />
      </el-form-item>
      <el-form-item label="结转金额" prop="amount">
        <el-input-number v-model="form.amount" :precision="2" style="width: 100%" />
        <div class="field-hint">正数 = 公司应付车主；负数 = 车主欠公司</div>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" placeholder="如：2024年余额" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/** 年初结转（台账里的「2024年余额 5387」「2025年月 8186.83」）。同车主+车辆+年份是覆盖语义 */
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { OwnerOption, VehicleItem } from '../../api/types'

const props = defineProps<{
  visible: boolean
  submitting?: boolean
  owners: OwnerOption[]
  vehicles: VehicleItem[]
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

const formRef = ref<FormInstance>()
const form = reactive({ owner_id: '', vehicle_id: '', fiscal_year: new Date().getFullYear(), amount: 0, remarks: '' })

const rules: FormRules = {
  owner_id: [{ required: true, message: '请选择车主', trigger: 'change' }],
  fiscal_year: [{ required: true, message: '请填写年份', trigger: 'blur' }]
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    form.owner_id = props.defaultOwnerId ?? ''
    form.vehicle_id = ''
    form.fiscal_year = new Date().getFullYear()
    form.amount = 0
    form.remarks = ''
    formRef.value?.clearValidate()
  }
)

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  emit('submit', { ...form, vehicle_id: form.vehicle_id || null, remarks: form.remarks || null })
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
