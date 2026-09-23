<template>
  <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑车主' : '新增车主'" width="90%" :style="{ maxWidth: '520px' }">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
      <el-form-item label="姓名" prop="name">
        <el-input v-model="form.name" placeholder="车主 / 合伙人姓名" />
      </el-form-item>
      <el-form-item label="身份" prop="role">
        <el-select v-model="form.role" style="width: 100%">
          <el-option v-for="o in OWNER_ROLE_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="公司费率(%)" prop="company_fee_rate">
        <el-input-number v-model="form.company_fee_rate" :min="0" :max="100" :precision="2" style="width: 100%" />
        <div class="field-hint">
          从「平台结算金额」里公司抽成的比例。台账里捷途是 15%、雅阁是 10%，自营车填 0。
          改费率只影响之后生成的结算行，已生成的不会被改写。
        </div>
      </el-form-item>
      <el-form-item label="手机号">
        <el-input v-model="form.phone" placeholder="可选" />
      </el-form-item>
      <el-form-item label="身份证号">
        <el-input v-model="form.id_card" placeholder="可选" />
      </el-form-item>
      <el-form-item label="开户银行">
        <el-input v-model="form.bank_name" placeholder="可选" />
      </el-form-item>
      <el-form-item label="银行账号">
        <el-input v-model="form.bank_account" placeholder="可选" />
      </el-form-item>
      <el-form-item label="往来期初">
        <el-input-number v-model="form.opening_balance" :precision="2" style="width: 100%" />
        <div class="field-hint">正数 = 公司应付此人。只填开始用系统时的余额，不要填历史累计</div>
      </el-form-item>
      <el-form-item label="期初日期">
        <AppDatePicker v-model="form.opening_date" type="date" value-format="YYYY-MM-DD" placeholder="可选" style="width: 100%" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" type="textarea" :rows="2" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/** 车主 / 合伙人档案。一个实体两种角色（台账里牛昭平、马跃两种身份都有） */
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import AppDatePicker from '../AppDatePicker.vue'
import type { OwnerItem } from '../../api/types'
import { OWNER_ROLE_OPTIONS } from '../../utils/constants'

const props = defineProps<{
  visible: boolean
  submitting?: boolean
  owner?: OwnerItem | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', payload: Record<string, unknown>): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

const isEdit = computed(() => Boolean(props.owner?.id))
const formRef = ref<FormInstance>()
const form = reactive({
  name: '',
  role: 'owner',
  company_fee_rate: 15,
  phone: '',
  id_card: '',
  bank_name: '',
  bank_account: '',
  opening_balance: 0,
  opening_date: '',
  remarks: ''
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择身份', trigger: 'change' }]
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    const o = props.owner
    form.name = o?.name ?? ''
    form.role = o?.role ?? 'owner'
    form.company_fee_rate = o?.company_fee_rate ?? 15
    form.phone = o?.phone ?? ''
    form.id_card = o?.id_card ?? ''
    form.bank_name = o?.bank_name ?? ''
    form.bank_account = o?.bank_account ?? ''
    form.opening_balance = o?.opening_balance ?? 0
    form.opening_date = o?.opening_date ?? ''
    form.remarks = o?.remarks ?? ''
    formRef.value?.clearValidate()
  }
)

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  emit('submit', {
    ...form,
    phone: form.phone || null,
    id_card: form.id_card || null,
    bank_name: form.bank_name || null,
    bank_account: form.bank_account || null,
    opening_date: form.opening_date || null,
    remarks: form.remarks || null
  })
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
