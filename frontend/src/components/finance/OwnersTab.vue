<template>
  <div class="owners-tab">
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="query">
        <el-form-item>
          <el-input v-model="query.keyword" placeholder="姓名/手机号" clearable style="width: 150px" @keyup.enter="reload" />
        </el-form-item>
        <el-form-item>
          <el-select v-model="query.role" placeholder="全部身份" clearable style="width: 130px" @change="reload">
            <el-option v-for="o in OWNER_ROLE_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="reload">搜索</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="action-bar">
      <el-button v-if="canManage" type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon> 新增车主
      </el-button>
    </div>

    <DataState :loading="loading" :error="error" :empty="!loading && !error && rows.length === 0" empty-text="暂无车主档案" skeleton @retry="loadData">
      <div class="mobile-cards">
        <div v-for="row in rows" :key="row.id" class="mobile-card">
          <div class="mobile-card-header">
            <span>{{ row.name }}</span>
            <el-tag size="small" type="info">{{ OWNER_ROLE_TEXT_MAP[row.role] || row.role }}</el-tag>
          </div>
          <div class="mobile-card-grid">
            <div class="mobile-card-row"><span class="label">公司费率</span><span class="value num">{{ row.company_fee_rate }}%</span></div>
            <div class="mobile-card-row"><span class="label">车辆</span><span class="value num">{{ row.vehicle_count ?? 0 }} 台</span></div>
            <div class="mobile-card-row">
              <span class="label">结算应付</span>
              <span class="value num" :class="moneyClass(row.balance)">{{ formatMoney(row.balance) }}</span>
            </div>
            <div class="mobile-card-row">
              <span class="label">往来应付</span>
              <span class="value num" :class="moneyClass(row.advance_balance)">{{ formatMoney(row.advance_balance) }}</span>
            </div>
            <div class="mobile-card-row" v-if="row.phone"><span class="label">手机号</span><span class="value num">{{ row.phone }}</span></div>
          </div>
          <div class="mobile-card-actions">
            <el-button size="small" @click="openStatement(row)">对账单</el-button>
            <el-button size="small" @click="openAdvances(row)">往来账</el-button>
            <el-button v-if="canManage" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="canManage" size="small" type="danger" plain @click="handleDelete(row)">删除</el-button>
          </div>
        </div>
      </div>

      <el-card shadow="never" class="table-card">
        <el-table :data="rows" stripe v-loading="loading">
          <el-table-column prop="name" label="姓名" width="130" />
          <el-table-column label="身份" width="120">
            <template #default="{ row }">{{ OWNER_ROLE_TEXT_MAP[row.role] || row.role }}</template>
          </el-table-column>
          <el-table-column label="公司费率" width="90" align="center">
            <template #default="{ row }">{{ row.company_fee_rate }}%</template>
          </el-table-column>
          <el-table-column label="车辆" width="70" align="center">
            <template #default="{ row }">{{ row.vehicle_count ?? 0 }}</template>
          </el-table-column>
          <el-table-column label="结算应付" width="130" class-name="amount-cell">
            <template #default="{ row }">
              <span :class="moneyClass(row.balance)">{{ formatMoney(row.balance) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="往来应付" width="130" class-name="amount-cell">
            <template #default="{ row }">
              <span :class="moneyClass(row.advance_balance)">{{ formatMoney(row.advance_balance) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="phone" label="手机号" width="120" />
          <el-table-column prop="remarks" label="备注" min-width="120" show-overflow-tooltip />
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openStatement(row)">对账单</el-button>
              <el-button link type="primary" size="small" @click="openAdvances(row)">往来账</el-button>
              <el-button v-if="canManage" link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button v-if="canManage" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        background
        class="pagination"
        @size-change="loadData"
        @current-change="loadData"
      />
    </DataState>

    <OwnerFormDialog v-model:visible="formVisible" :submitting="submitting" :owner="editing" @submit="handleSubmit" />

    <!-- 对账单 -->
    <el-drawer v-model="statementVisible" :title="`${statementOwner?.name || ''} 对账单`" size="90%">
      <div class="drawer-toolbar">
        <AppDatePicker v-model="statementPeriod" type="month" value-format="YYYY-MM" placeholder="结算期" @change="loadStatement" />
        <el-button :loading="statementLoading" @click="exportStatement">导出对账单</el-button>
      </div>
      <div v-if="statement" class="statement-summary">
        <div class="summary-item"><span class="label">期初结转</span><b>{{ formatMoney(statement.summary.opening) }}</b></div>
        <div class="summary-item"><span class="label">本期车主结算</span><b class="money-positive">{{ formatMoney(statement.summary.ownerAmountSum) }}</b></div>
        <div class="summary-item"><span class="label">代垫车辆费用</span><b class="money-negative">{{ formatMoney(statement.summary.ownerExpenseSum) }}</b></div>
        <div class="summary-item"><span class="label">本期付款</span><b class="money-negative">{{ formatMoney(statement.summary.payoutSum) }}</b></div>
        <div class="summary-item is-strong"><span class="label">期末应付</span><b>{{ formatMoney(statement.summary.closing) }}</b></div>
      </div>

      <div v-if="statement">
        <div class="finance-section-title">结算明细（{{ statement.lines.length }} 条）</div>
        <el-table :data="statement.lines" size="small" border>
          <el-table-column prop="line_date" label="用车时间" width="110" />
          <el-table-column label="平台" width="70">
            <template #default="{ row }">{{ row.source_name || '线下' }}</template>
          </el-table-column>
          <el-table-column prop="plate_number" label="车牌" width="105" />
          <el-table-column prop="customer_name" label="客户" width="80" />
          <el-table-column label="天数" width="55" align="center">
            <template #default="{ row }">{{ row.days }}</template>
          </el-table-column>
          <el-table-column label="合计" width="95" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.total_amount) }}</template>
          </el-table-column>
          <el-table-column label="平台管理费" width="100" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.platform_fee) }}</template>
          </el-table-column>
          <el-table-column label="公司管理费" width="100" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.company_fee) }}</template>
          </el-table-column>
          <el-table-column label="其他费用" width="95" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.other_fee, { dashOnZero: true }) }}</template>
          </el-table-column>
          <el-table-column label="车主结算" width="105" class-name="amount-cell">
            <template #default="{ row }"><b>{{ formatMoney(row.owner_amount) }}</b></template>
          </el-table-column>
          <el-table-column prop="remarks" label="备注" min-width="140" show-overflow-tooltip />
        </el-table>

        <div class="finance-section-title" style="margin-top: 16px">代垫车辆费用（{{ statement.expenses.length }} 条）</div>
        <el-table v-if="statement.expenses.length" :data="statement.expenses" size="small" border>
          <el-table-column prop="expense_date" label="日期" width="105" />
          <el-table-column prop="plate_number" label="车牌" width="110" />
          <el-table-column prop="expense_type_name" label="类型" width="90" />
          <el-table-column label="支出" width="100" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.expense_amount, { dashOnZero: true }) }}</template>
          </el-table-column>
          <el-table-column label="收入" width="100" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.income_amount, { dashOnZero: true }) }}</template>
          </el-table-column>
          <el-table-column prop="remarks" label="备注" min-width="140" show-overflow-tooltip />
        </el-table>
        <el-empty v-else description="本期没有代垫费用" :image-size="50" />

        <div class="finance-section-title" style="margin-top: 16px">付款（{{ statement.payouts.length }} 笔）</div>
        <el-table v-if="statement.payouts.length" :data="statement.payouts" size="small" border>
          <el-table-column prop="paid_at" label="日期" width="110" />
          <el-table-column label="类型" width="90">
            <template #default="{ row }">{{ PAYOUT_TYPE_TEXT_MAP[row.payout_type] || row.payout_type }}</template>
          </el-table-column>
          <el-table-column label="金额" width="110" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="remarks" label="备注" min-width="140" show-overflow-tooltip />
        </el-table>
        <el-empty v-else description="本期没有付款" :image-size="50" />
      </div>
    </el-drawer>

    <!-- 往来账 -->
    <el-drawer v-model="advanceVisible" :title="`${advanceOwner?.name || ''} 合伙人往来`" size="90%">
      <div class="drawer-toolbar">
        <span v-if="advanceTotals">
          累计应付增加 <b class="amount-cell">{{ formatMoney(advanceTotals.in_total) }}</b>
          ｜已付 <b class="amount-cell">{{ formatMoney(advanceTotals.out_total) }}</b>
          ｜净额 <b class="amount-cell">{{ formatMoney(advanceTotals.in_total - advanceTotals.out_total) }}</b>
        </span>
        <el-button size="small" type="primary" @click="openAdvanceCreate">新增往来</el-button>
      </div>

      <el-alert
        v-if="advanceTotals && advanceTotals.count > advances.length"
        type="warning"
        :closable="false"
        show-icon
        :title="`共 ${advanceTotals.count} 条往来记录，当前只显示最近 ${advances.length} 条`"
        description="完整明细请用「导出对账单」或按科目筛选后查看。"
        style="margin-bottom: 10px"
      />
      <el-table :data="advances" size="small" border v-loading="advanceLoading">
        <el-table-column prop="advance_date" label="日期" width="110" />
        <el-table-column prop="subject_name" label="科目" width="100" />
        <el-table-column label="方向" width="110">
          <template #default="{ row }">{{ ADVANCE_DIRECTION_TEXT_MAP[row.direction] || row.direction }}</template>
        </el-table-column>
        <el-table-column label="金额" width="110" class-name="amount-cell">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="付款" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.is_paid ? 'success' : 'info'">{{ row.is_paid ? '已付' : '未付' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remarks" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.direction === 'out' && !row.is_paid" link type="primary" size="small" @click="openAdvancePay(row)">标记付款</el-button>
            <el-button v-if="!row.is_paid" link type="primary" size="small" @click="openAdvanceEdit(row)">编辑</el-button>
            <el-button v-if="canManage && !row.is_paid" link type="danger" size="small" @click="handleAdvanceDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!advanceLoading && advances.length === 0" description="暂无往来记录" :image-size="60" />
    </el-drawer>

    <PartnerAdvanceDialog v-model:visible="advanceFormVisible" :submitting="submitting" :advance="editingAdvance" @submit="handleAdvanceSubmit" />

    <el-dialog v-model="advancePayVisible" title="标记已付合伙人" width="90%" :style="{ maxWidth: '400px' }">
      <p class="pay-tip">{{ advancePayTarget?.advance_date }} {{ advancePayTarget?.subject_name }}：{{ formatMoney(advancePayTarget?.amount ?? 0) }}</p>
      <el-form label-width="80px">
        <el-form-item label="付款账户">
          <el-select v-model="advancePayAccountId" placeholder="选择账户" style="width: 100%">
            <el-option v-for="a in accounts" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="付款日期">
          <AppDatePicker v-model="advancePayDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="advancePayVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAdvancePay">确认付款</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 车主 / 合伙人档案与对账单。
 *
 * 列表上有两个**互相独立**的应付口径，不要混着看：
 *   * 结算应付 = 期初 + 结算行车主金额 − 代垫车辆费用 − 结算付款（台账底部「结余」列）
 *   * 往来应付 = 期初 + 往来 in − 往来 out（台账 file-5 的往来账）
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import DataState from '../DataState.vue'
import OwnerFormDialog from './OwnerFormDialog.vue'
import PartnerAdvanceDialog from './PartnerAdvanceDialog.vue'
import AppDatePicker from '../AppDatePicker.vue'
import { financeReportApi, ownerApi } from '../../api'
import type { AccountOption, OwnerItem, OwnerStatement, PartnerAdvanceItem } from '../../api/types'
import { useUserStore } from '../../stores/user'
import { ADVANCE_DIRECTION_TEXT_MAP, OWNER_ROLE_OPTIONS, OWNER_ROLE_TEXT_MAP, PAYOUT_TYPE_TEXT_MAP } from '../../utils/constants'
import { formatMoney, moneyClass } from '../../utils/money'

const userStore = useUserStore()
const canManage = computed(() => userStore.isAdmin())

function today(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().substring(0, 10)
}

const rows = ref<OwnerItem[]>([])
const total = ref(0)
const accounts = ref<AccountOption[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const submitting = ref(false)

const query = reactive({ page: 1, pageSize: 20, keyword: '', role: '' })

const formVisible = ref(false)
const editing = ref<OwnerItem | null>(null)

const statementVisible = ref(false)
const statementOwner = ref<OwnerItem | null>(null)
const statementPeriod = ref(today().substring(0, 7))
const statement = ref<OwnerStatement | null>(null)
const statementLoading = ref(false)

const advanceVisible = ref(false)
const advanceOwner = ref<OwnerItem | null>(null)
const advances = ref<PartnerAdvanceItem[]>([])
const advanceTotals = ref<{ in_total: number; out_total: number; count: number } | null>(null)
const advanceLoading = ref(false)
const advanceFormVisible = ref(false)
const editingAdvance = ref<PartnerAdvanceItem | null>(null)
const advancePayVisible = ref(false)
const advancePayTarget = ref<PartnerAdvanceItem | null>(null)
const advancePayAccountId = ref('')
const advancePayDate = ref(today())

async function loadData(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const res = await ownerApi.getList({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      role: query.role || undefined
    })
    if (res.success && res.data) {
      rows.value = res.data.data
      total.value = res.data.total
    }
  } catch {
    error.value = '加载失败，请重试'
  } finally {
    loading.value = false
  }
}

async function reload(): Promise<void> {
  query.page = 1
  await loadData()
}

function openCreate(): void {
  editing.value = null
  formVisible.value = true
}

function openEdit(row: OwnerItem): void {
  editing.value = row
  formVisible.value = true
}

async function handleSubmit(payload: Record<string, unknown>): Promise<void> {
  submitting.value = true
  try {
    const res = editing.value ? await ownerApi.update(editing.value.id, payload) : await ownerApi.create(payload)
    if (res.success) {
      ElMessage.success(res.message || '已保存')
      formVisible.value = false
      await loadData()
    }
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: OwnerItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`删除车主「${row.name}」？有车辆挂靠或结算记录时会被拦下。`, '删除', { type: 'warning' })
  } catch {
    return
  }
  const res = await ownerApi.delete(row.id)
  if (res.success) {
    ElMessage.success(res.message || '已删除')
    await loadData()
  }
}

// ---------------- 对账单 ----------------

async function openStatement(row: OwnerItem): Promise<void> {
  statementOwner.value = row
  statementPeriod.value = today().substring(0, 7)
  statementVisible.value = true
  await loadStatement()
}

async function loadStatement(): Promise<void> {
  if (!statementOwner.value) return
  statementLoading.value = true
  try {
    const res = await ownerApi.getStatement(statementOwner.value.id, { period: statementPeriod.value })
    if (res.success && res.data) statement.value = res.data
  } finally {
    statementLoading.value = false
  }
}

/** 导出对账单：三段（结算/代垫/付款）+ 汇总，与台账底部支出区一致 */
async function exportStatement(): Promise<void> {
  if (!statement.value) {
    ElMessage.warning('请先加载对账单')
    return
  }
  const XLSX = await import('xlsx')
  const s = statement.value
  const lines: unknown[][] = [
    [`${s.owner.name} 对账单（${s.period}）`],
    ['期初结转', s.summary.opening],
    ['本期车主结算', s.summary.ownerAmountSum],
    ['代垫车辆费用', s.summary.ownerExpenseSum],
    ['本期付款', s.summary.payoutSum],
    ['期末应付', s.summary.closing],
    [],
    ['月份', '序号', '平台', '姓名', '用车时间', '还车时间', '数量', '单价', '合计', '平台管理费', '结算金额', '公司管理费', '其他费用', '车主结算金额', '备注']
  ]
  s.lines.forEach((line, index) => {
    lines.push([
      line.period, index + 1, line.source_name ?? '线下', line.customer_name ?? '',
      line.start_date ?? line.line_date, line.end_date ?? '', line.days, line.unit_price,
      line.total_amount, line.platform_fee, line.settlement_amount, line.company_fee,
      line.other_fee, line.owner_amount, line.remarks ?? ''
    ])
  })
  lines.push([], ['代垫车辆费用'], ['日期', '车牌', '类型', '收入', '支出', '备注'])
  s.expenses.forEach((e) => lines.push([e.expense_date, e.plate_number ?? '', e.expense_type_name, e.income_amount, e.expense_amount, e.remarks ?? '']))
  lines.push([], ['付款'], ['日期', '类型', '金额', '备注'])
  s.payouts.forEach((p) => lines.push([p.paid_at, PAYOUT_TYPE_TEXT_MAP[p.payout_type] ?? p.payout_type, p.amount, p.remarks ?? '']))

  const sheet = XLSX.utils.aoa_to_sheet(lines)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '对账单')
  XLSX.writeFile(book, `对账单_${s.owner.name}_${s.period}.xlsx`)
}

// ---------------- 往来账 ----------------

async function openAdvances(row: OwnerItem): Promise<void> {
  advanceOwner.value = row
  advanceVisible.value = true
  await loadAdvances()
}

async function loadAdvances(): Promise<void> {
  if (!advanceOwner.value) return
  advanceLoading.value = true
  try {
    const res = await ownerApi.getAdvances(advanceOwner.value.id, { page: 1, pageSize: 100 })
    if (res.success && res.data) {
      advances.value = res.data.data
      advanceTotals.value = res.data.totals
    }
  } finally {
    advanceLoading.value = false
  }
}

function openAdvanceCreate(): void {
  editingAdvance.value = null
  advanceFormVisible.value = true
}

function openAdvanceEdit(row: PartnerAdvanceItem): void {
  editingAdvance.value = row
  advanceFormVisible.value = true
}

async function handleAdvanceSubmit(payload: Record<string, unknown>): Promise<void> {
  if (!advanceOwner.value) return
  submitting.value = true
  try {
    const res = editingAdvance.value
      ? await ownerApi.updateAdvance(advanceOwner.value.id, editingAdvance.value.id, payload)
      : await ownerApi.createAdvance(advanceOwner.value.id, payload)
    if (res.success) {
      ElMessage.success(res.message || '已保存')
      advanceFormVisible.value = false
      await loadAdvances()
      await loadData()
    }
  } finally {
    submitting.value = false
  }
}

function openAdvancePay(row: PartnerAdvanceItem): void {
  advancePayTarget.value = row
  advancePayAccountId.value = accounts.value[0]?.id ?? ''
  advancePayDate.value = today()
  advancePayVisible.value = true
}

async function handleAdvancePay(): Promise<void> {
  if (!advanceOwner.value || !advancePayTarget.value || !advancePayAccountId.value) {
    ElMessage.warning('请选择付款账户')
    return
  }
  submitting.value = true
  try {
    const res = await ownerApi.payAdvance(advanceOwner.value.id, advancePayTarget.value.id, {
      account_id: advancePayAccountId.value,
      paid_at: advancePayDate.value
    })
    if (res.success) {
      ElMessage.success(res.message || '已标记付款')
      advancePayVisible.value = false
      await loadAdvances()
      await loadData()
    }
  } finally {
    submitting.value = false
  }
}

async function handleAdvanceDelete(row: PartnerAdvanceItem): Promise<void> {
  if (!advanceOwner.value) return
  try {
    await ElMessageBox.confirm(`删除「${row.subject_name}」${formatMoney(row.amount)}？`, '删除', { type: 'warning' })
  } catch {
    return
  }
  const res = await ownerApi.deleteAdvance(advanceOwner.value.id, row.id)
  if (res.success) {
    ElMessage.success(res.message || '已删除')
    await loadAdvances()
    await loadData()
  }
}

onMounted(async () => {
  const dictRes = await financeReportApi.getDicts()
  if (dictRes.success && dictRes.data) accounts.value = dictRes.data.accounts
  await loadData()
})
</script>

<style scoped>
.owners-tab {
  width: 100%;
}

.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.drawer-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--sk-text-secondary);
}

.statement-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 14px;
  padding: 12px;
  border-radius: 8px;
  background: var(--sk-bg-light-gray);
}

@media (min-width: 768px) {
  .statement-summary {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 13px;
}

.summary-item .label {
  color: var(--sk-text-tertiary);
}

.summary-item b {
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  color: var(--sk-text-near-black);
}

html.dark .summary-item b {
  color: var(--sk-text-white);
}

.summary-item.is-strong b {
  color: var(--sk-focus-color);
  font-size: 18px;
}

.pay-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--sk-text-secondary);
}
</style>
