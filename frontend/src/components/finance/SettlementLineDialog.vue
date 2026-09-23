<template>
  <el-dialog v-model="dialogVisible" title="调整结算金额" width="94%" :style="{ maxWidth: '640px' }">
    <div v-if="line" class="line-meta">
      <div class="meta-row">
        <span class="label">车主</span><span>{{ line.owner_name || '-' }}</span>
        <span class="label">车牌</span><span>{{ line.plate_number || '-' }}</span>
      </div>
      <div class="meta-row">
        <span class="label">平台</span><span>{{ line.source_name || '-' }}</span>
        <span class="label">客户</span><span>{{ line.customer_name || '-' }}</span>
        <span class="label">账期</span><span>{{ line.period }}</span>
      </div>
    </div>

    <el-alert
      v-if="line?.amount_overridden"
      type="warning"
      :closable="false"
      show-icon
      title="本行已被人工调整"
      :description="`订单再改价也不会覆盖这里的金额（${line.override_note || '未填写原因'}）。要恢复系统计算请点「恢复自动计算」。`"
      style="margin-bottom: 12px"
    />

    <el-table :data="compareRows" size="small" border>
      <el-table-column prop="label" label="项目" width="110" />
      <el-table-column label="系统算" class-name="amount-cell">
        <template #default="{ row }">{{ formatMoney(row.calc, { dashOnZero: true }) }}</template>
      </el-table-column>
      <el-table-column label="本次填写" class-name="amount-cell">
        <template #default="{ row }">{{ formatMoney(row.final, { dashOnZero: true }) }}</template>
      </el-table-column>
      <el-table-column label="差异" class-name="amount-cell" width="110">
        <template #default="{ row }">
          <span :class="moneyClass(row.diff)">{{ formatMoney(row.diff, { showSign: true, dashOnZero: true }) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <el-form ref="formRef" :model="form" label-width="110px" style="margin-top: 16px">
      <el-form-item label="合计">
        <el-input-number v-model="form.total_amount" :min="0" :precision="2" style="width: 100%" />
      </el-form-item>
      <el-form-item label="平台管理费">
        <el-input-number v-model="form.platform_fee" :min="0" :precision="2" style="width: 100%" />
      </el-form-item>
      <el-form-item>
        <template #label>结算金额<FieldTip content="默认 = 合计 − 平台管理费，可直接改" /></template>
        <el-input-number v-model="form.settlement_amount" :min="0" :precision="2" style="width: 100%" />
      </el-form-item>
      <el-form-item label="公司管理费">
        <el-input-number v-model="form.company_fee" :min="0" :precision="2" style="width: 100%" />
      </el-form-item>
      <el-form-item>
        <template #label>其他费用<FieldTip content="正数 = 车主承担（过路费/洗车/补气），负数 = 反向补贴" /></template>
        <el-input-number v-model="form.other_fee" :precision="2" style="width: 100%" />
      </el-form-item>
      <el-form-item>
        <template #label>车主结算金额<FieldTip content="默认 = 结算金额 − 公司管理费 − 其他费用" /></template>
        <el-input-number v-model="form.owner_amount" :precision="2" style="width: 100%" />
      </el-form-item>
      <el-form-item label="调整原因">
        <el-input v-model="form.override_note" placeholder="如：机场过路费7元+补气5元" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" type="textarea" :rows="2" placeholder="台账备注列原文" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button v-if="line?.amount_overridden" :loading="submitting" @click="handleRestoreAuto">恢复自动计算</el-button>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 结算行人工调整。
 *
 * 核心是「系统算 / 本次填写 / 差异」三列对照 —— 台账的备注列里那些特殊调整
 * （顶车、平台满减、订单有误）必须让用户看见自己改了多少，否则下一次重算时
 * 分不清哪个数是系统给的、哪个是自己填的。
 *
 * 结算金额与车主金额留成可编辑（不强制由公式推），是因为台账里确实存在
 * 「平台管理费不是 15%」「其他费用在结算金额之后才算」这类特例。
 */
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import FieldTip from '../FieldTip.vue'
import type { SettlementLineItem } from '../../api/types'
import { formatMoney, moneyClass } from '../../utils/money'

const props = defineProps<{
  visible: boolean
  submitting?: boolean
  line?: SettlementLineItem | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', payload: Record<string, unknown>): void
  (e: 'restore-auto'): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

const formRef = ref<FormInstance>()
const form = reactive({
  total_amount: 0,
  platform_fee: 0,
  settlement_amount: 0,
  company_fee: 0,
  other_fee: 0,
  owner_amount: 0,
  override_note: '',
  remarks: ''
})

watch(
  () => props.visible,
  (visible) => {
    if (!visible || !props.line) return
    const l = props.line
    form.total_amount = l.total_amount
    form.platform_fee = l.platform_fee
    form.settlement_amount = l.settlement_amount
    form.company_fee = l.company_fee
    form.other_fee = l.other_fee
    form.owner_amount = l.owner_amount
    form.override_note = l.override_note ?? ''
    form.remarks = l.remarks ?? ''
    formRef.value?.clearValidate()
  }
)

interface CompareRow {
  label: string
  calc: number
  final: number
  diff: number
}

const compareRows = computed<CompareRow[]>(() => {
  const l = props.line
  if (!l) return []
  const pairs: Array<[string, number, number]> = [
    ['合计', l.calc_total_amount, form.total_amount],
    ['平台管理费', l.calc_platform_fee, form.platform_fee],
    ['结算金额', l.calc_settlement_amount, form.settlement_amount],
    ['公司管理费', l.calc_company_fee, form.company_fee],
    ['车主结算金额', l.calc_owner_amount, form.owner_amount]
  ]
  return pairs.map(([label, calc, final]) => ({ label, calc, final, diff: Math.round((final - calc) * 1e6) / 1e6 }))
})

function handleSubmit(): void {
  if (form.owner_amount === 0 && form.total_amount === 0) {
    ElMessage.warning('合计与车主结算金额不能同时为 0')
    return
  }
  emit('submit', {
    total_amount: form.total_amount,
    platform_fee: form.platform_fee,
    settlement_amount: form.settlement_amount,
    company_fee: form.company_fee,
    other_fee: form.other_fee,
    owner_amount: form.owner_amount,
    override_note: form.override_note || null,
    remarks: form.remarks || null
  })
}

function handleRestoreAuto(): void {
  emit('restore-auto')
}
</script>

<style scoped>
.line-meta {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--sk-bg-light-gray);
  font-size: 13px;
  color: var(--sk-text-secondary);
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}

.meta-row .label {
  color: var(--sk-text-tertiary);
}
</style>
