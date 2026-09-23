<template>
  <div class="settlement-tab">
    <!-- 筛选 -->
    <MobileFilterPanel title="结算筛选">
      <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="query">
        <el-form-item>
          <AppDatePicker v-model="query.period" type="month" value-format="YYYY-MM" placeholder="结算期" style="width: 130px" @change="reload" />
        </el-form-item>
        <el-form-item>
          <AppSelect v-model="query.owner_id" :options="ownerOptions" placeholder="全部车主" clearable style="width: 140px" @change="reload" />
        </el-form-item>
        <el-form-item>
          <AppSelect v-model="query.vehicle_id" :options="vehicleOptions" placeholder="全部车辆" clearable filterable style="width: 150px" @change="reload" />
        </el-form-item>
        <el-form-item>
          <AppSelect v-model="query.status" :options="SETTLEMENT_LINE_STATUS_OPTIONS" placeholder="状态" clearable style="width: 110px" @change="reload" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="query.keyword" placeholder="客户/订单号/车牌/备注" clearable style="width: 180px" @keyup.enter="reload" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="reload">搜索</el-button>
        </el-form-item>
        </el-form>
      </el-card>
    </MobileFilterPanel>

    <!-- 合计条 -->
    <div class="totals-bar">
      <span>合计 <b class="amount-cell">{{ formatMoney(totals.total_amount) }}</b></span>
      <span>平台管理费 <b class="amount-cell">{{ formatMoney(totals.platform_fee) }}</b></span>
      <span>结算金额 <b class="amount-cell">{{ formatMoney(totals.settlement_amount) }}</b></span>
      <span>公司管理费 <b class="amount-cell">{{ formatMoney(totals.company_fee) }}</b></span>
      <span>其他费用 <b class="amount-cell">{{ formatMoney(totals.other_fee) }}</b></span>
      <span class="totals-strong">车主结算 <b class="amount-cell">{{ formatMoney(totals.owner_amount) }}</b></span>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <el-button v-if="canManage" type="primary" :loading="generating" @click="openGenerate">
        <el-icon><i class="weui-icon-outlined-refresh" /></el-icon> 生成本期结算
      </el-button>
      <el-button v-if="canManage" @click="openPayout">结算付款</el-button>
      <el-button v-if="canManage" @click="openOpening">期初结转</el-button>
      <el-button @click="exportExcel">导出</el-button>
    </div>

    <DataState :loading="loading" :error="error" :empty="!loading && !error && rows.length === 0" empty-text="该结算期还没有记录，点「生成本期结算」" skeleton @retry="loadData">
      <!-- 移动端 -->
      <div class="mobile-cards">
        <div v-for="row in rows" :key="row.id" class="mobile-card">
          <div class="mobile-card-header">
            <span>{{ row.plate_number || '-' }} <el-tag size="small" type="info">{{ row.source_name || '线下' }}</el-tag></span>
            <span>{{ formatMoney(row.owner_amount) }}</span>
          </div>
          <div class="mobile-card-grid">
            <div class="mobile-card-row"><span class="label">客户</span><span class="value">{{ row.customer_name || '-' }}</span></div>
            <div class="mobile-card-row"><span class="label">用车时间</span><span class="value num">{{ row.line_date }}</span></div>
          </div>
          <div class="mobile-card-grid">
            <div class="mobile-card-row"><span class="label">天数 × 单价</span><span class="value num">{{ row.days }} × {{ formatMoney(row.unit_price) }}</span></div>
            <div class="mobile-card-row"><span class="label">合计</span><span class="value num">{{ formatMoney(row.total_amount) }}</span></div>
            <div class="mobile-card-row"><span class="label">平台管理费</span><span class="value num">{{ formatMoney(row.platform_fee) }}</span></div>
            <div class="mobile-card-row"><span class="label">结算金额</span><span class="value num">{{ formatMoney(row.settlement_amount) }}</span></div>
            <div class="mobile-card-row"><span class="label">公司管理费</span><span class="value num">{{ formatMoney(row.company_fee) }}</span></div>
            <div class="mobile-card-row" v-if="row.other_fee"><span class="label">其他费用</span><span class="value num">{{ formatMoney(row.other_fee) }}</span></div>
          </div>
          <div class="mobile-card-row is-block" v-if="row.remarks"><span class="label">备注</span><span class="value">{{ row.remarks }}</span></div>
          <div class="mobile-card-row">
            <span class="label">状态</span>
            <span class="value">
              <el-tag v-if="row.status === 'void'" size="small" type="info">已作废</el-tag>
              <el-tag v-else-if="row.amount_overridden" size="small" type="warning">人工调整</el-tag>
              <el-tag v-else size="small" type="success">正常</el-tag>
            </span>
          </div>
          <div class="mobile-card-actions">
            <el-button v-if="canManage" size="small" @click="openEdit(row)">调整金额</el-button>
            <el-button v-if="canManage && row.status === 'posted'" size="small" type="danger" plain @click="handleVoid(row)">作废</el-button>
            <el-button v-if="canManage && row.status === 'void'" size="small" @click="handleRestore(row)">恢复</el-button>
          </div>
        </div>
      </div>

      <!-- PC -->
      <el-card shadow="never" class="table-card">
        <el-table :data="rows" stripe v-loading="loading" :row-class-name="rowClassName">
          <el-table-column label="用车时间" width="110">
            <template #default="{ row }">{{ (row.line_date || '').substring(0, 10) }}</template>
          </el-table-column>
          <el-table-column label="平台" width="80">
            <template #default="{ row }">{{ row.source_name || '线下' }}</template>
          </el-table-column>
          <el-table-column prop="plate_number" label="车牌" width="110" />
          <el-table-column prop="customer_name" label="客户" width="90" show-overflow-tooltip />
          <el-table-column label="天数" width="60" align="center">
            <template #default="{ row }">{{ row.days }}</template>
          </el-table-column>
          <el-table-column label="单价" width="90" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.unit_price) }}</template>
          </el-table-column>
          <el-table-column label="合计" width="100" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.total_amount) }}</template>
          </el-table-column>
          <el-table-column label="平台管理费" width="110" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.platform_fee) }}</template>
          </el-table-column>
          <el-table-column label="结算金额" width="110" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.settlement_amount) }}</template>
          </el-table-column>
          <el-table-column label="公司管理费" width="110" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.company_fee) }}</template>
          </el-table-column>
          <el-table-column label="其他费用" width="100" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.other_fee, { dashOnZero: true }) }}</template>
          </el-table-column>
          <el-table-column label="车主结算" width="110" class-name="amount-cell">
            <template #default="{ row }"><b>{{ formatMoney(row.owner_amount) }}</b></template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'void'" size="small" type="info">已作废</el-tag>
              <el-tooltip v-else-if="row.amount_overridden" :content="row.override_note || '人工调整过金额'">
                <el-tag size="small" type="warning">人工调整</el-tag>
              </el-tooltip>
              <el-tag v-else size="small" type="success">正常</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remarks" label="备注" min-width="160" show-overflow-tooltip />
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button v-if="canManage" link type="primary" size="small" @click="openEdit(row)">调整</el-button>
              <el-button v-if="canManage && row.status === 'posted'" link type="danger" size="small" @click="handleVoid(row)">作废</el-button>
              <el-button v-if="canManage && row.status === 'void'" link type="primary" size="small" @click="handleRestore(row)">恢复</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        background
        class="pagination"
        @size-change="loadData"
        @current-change="loadData"
      />
    </DataState>

    <SettlementLineDialog
      v-model:visible="lineVisible"
      :submitting="submitting"
      :line="editingLine"
      @submit="handleLineSubmit"
      @restore-auto="handleRestoreAuto"
    />
    <SettlementPayoutDialog
      v-model:visible="payoutVisible"
      :submitting="submitting"
      :accounts="accounts"
      :owners="owners"
      :default-owner-id="query.owner_id"
      @submit="handlePayoutSubmit"
    />
    <SettlementOpeningDialog
      v-model:visible="openingVisible"
      :submitting="submitting"
      :owners="owners"
      :vehicles="vehicles"
      :default-owner-id="query.owner_id"
      @submit="handleOpeningSubmit"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 车主结算台账（台账 file-1/2/3 的三份单车台账）。
 *
 * 生成是显式动作：订单会取消、改价、续租、还车重算，下单即生成的台账全是噪音且要反复维护。
 * 生成幂等，重复点只是把系统口径刷新一遍；人工改过的行由 CASE 守卫保护，不会被覆盖。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DataState from '../DataState.vue'
import MobileFilterPanel from '../MobileFilterPanel.vue'
import SettlementLineDialog from './SettlementLineDialog.vue'
import SettlementPayoutDialog from './SettlementPayoutDialog.vue'
import SettlementOpeningDialog from './SettlementOpeningDialog.vue'
import AppDatePicker from '../AppDatePicker.vue'
import AppSelect from '../AppSelect.vue'
import { financeReportApi, ownerApi, settlementApi, vehicleApi } from '../../api'
import type { AccountOption, OwnerOption, SettlementLineItem, SettlementTotals, VehicleItem } from '../../api/types'
import { useUserStore } from '../../stores/user'
import { formatMoney } from '../../utils/money'
import { SETTLEMENT_LINE_STATUS_OPTIONS } from '../../utils/constants'

const userStore = useUserStore()
const canManage = computed(() => userStore.isAdmin())

function currentPeriod(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().substring(0, 7)
}

const rows = ref<SettlementLineItem[]>([])
const total = ref(0)
const totals = ref<SettlementTotals>({
  total_amount: 0,
  platform_fee: 0,
  settlement_amount: 0,
  company_fee: 0,
  other_fee: 0,
  owner_amount: 0,
  days: 0,
  count: 0
})
const owners = ref<OwnerOption[]>([])
const vehicles = ref<VehicleItem[]>([])
const accounts = ref<AccountOption[]>([])
// AppSelect 的选项
const ownerOptions = computed(() => owners.value.map((o) => ({ label: o.name, value: o.id })))
const vehicleOptions = computed(() => vehicles.value.map((v) => ({ label: v.plate_number, value: v.id })))

const loading = ref(false)
const error = ref<string | null>(null)
const submitting = ref(false)
const generating = ref(false)

const query = reactive({ page: 1, pageSize: 20, period: currentPeriod(), owner_id: '', vehicle_id: '', status: '', keyword: '' })

const lineVisible = ref(false)
const payoutVisible = ref(false)
const openingVisible = ref(false)
const editingLine = ref<SettlementLineItem | null>(null)

async function loadData(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const res = await settlementApi.getLines({
      page: query.page,
      pageSize: query.pageSize,
      period: query.period || undefined,
      owner_id: query.owner_id || undefined,
      vehicle_id: query.vehicle_id || undefined,
      status: query.status || undefined,
      keyword: query.keyword || undefined
    })
    if (res.success && res.data) {
      rows.value = res.data.data
      total.value = res.data.total
      totals.value = res.data.totals
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

async function loadOptions(): Promise<void> {
  const [ownerRes, vehicleRes, dictRes] = await Promise.all([
    ownerApi.getOptions(),
    vehicleApi.getList({ page: 1, pageSize: 100 }),
    financeReportApi.getDicts()
  ])
  if (ownerRes.success && ownerRes.data) owners.value = ownerRes.data
  if (vehicleRes.success && vehicleRes.data) vehicles.value = vehicleRes.data.data
  if (dictRes.success && dictRes.data) accounts.value = dictRes.data.accounts
}

/**
 * 生成本期结算。
 * 后端按 50 单一批返回 hasMore，这里循环到最后一页 —— 幂等所以中断后重跑是安全的。
 */
async function openGenerate(): Promise<void> {
  if (!query.period) {
    ElMessage.warning('请先选择结算期')
    return
  }
  try {
    await ElMessageBox.confirm(
      `按「取车时间」把 ${query.period} 的订单生成结算行。已存在的行只会刷新系统口径，人工调整过的金额不会被覆盖。`,
      '生成本期结算',
      { type: 'info' }
    )
  } catch {
    return
  }

  generating.value = true
  try {
    let offset = 0
    let inserted = 0
    let updated = 0
    let skipped = 0
    // 上限只是防呆：正常情况下 hasMore 会很快变 false
    for (let round = 0; round < 50; round += 1) {
      const res = await settlementApi.generate({
        period: query.period,
        owner_id: query.owner_id || undefined,
        vehicle_id: query.vehicle_id || undefined,
        offset
      })
      if (!res.success || !res.data) break
      inserted += res.data.inserted
      updated += res.data.updated
      skipped += res.data.skipped
      if (!res.data.hasMore) break
      offset += res.data.scanned
    }
    ElMessage.success(`${query.period} 生成完成：新增 ${inserted} 条，刷新 ${updated} 条，跳过 ${skipped} 条`)
    await loadData()
  } finally {
    generating.value = false
  }
}

function openEdit(row: SettlementLineItem): void {
  editingLine.value = row
  lineVisible.value = true
}

async function handleLineSubmit(payload: Record<string, unknown>): Promise<void> {
  if (!editingLine.value) return
  submitting.value = true
  try {
    const res = await settlementApi.updateLine(editingLine.value.id, payload)
    if (res.success) {
      ElMessage.success(res.message || '已保存')
      lineVisible.value = false
      await loadData()
    }
  } finally {
    submitting.value = false
  }
}

async function handleRestoreAuto(): Promise<void> {
  if (!editingLine.value) return
  submitting.value = true
  try {
    const res = await settlementApi.updateLine(editingLine.value.id, { restore_auto: true })
    if (res.success) {
      ElMessage.success(res.message || '已恢复自动计算')
      lineVisible.value = false
      await loadData()
    }
  } finally {
    submitting.value = false
  }
}

async function handleVoid(row: SettlementLineItem): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt(
      `作废后本行不参与任何金额汇总（保留记录以便追溯）。${row.status === 'posted' ? '' : ''}`,
      '作废结算行',
      { confirmButtonText: '确认作废', cancelButtonText: '取消', inputPlaceholder: '作废原因' }
    )
    const res = await settlementApi.voidLine(row.id, value || '手工作废')
    if (res.success) {
      ElMessage.success(res.message || '已作废')
      await loadData()
    }
  } catch {
    // 用户取消
  }
}

async function handleRestore(row: SettlementLineItem): Promise<void> {
  const res = await settlementApi.restoreLine(row.id)
  if (res.success) {
    ElMessage.success(res.message || '已恢复')
    await loadData()
  }
}

function openPayout(): void {
  payoutVisible.value = true
}

async function handlePayoutSubmit(payload: Record<string, unknown>): Promise<void> {
  submitting.value = true
  try {
    const res = await settlementApi.createPayout(payload)
    if (res.success) {
      ElMessage.success(res.message || '已记录')
      payoutVisible.value = false
    }
  } finally {
    submitting.value = false
  }
}

function openOpening(): void {
  openingVisible.value = true
}

async function handleOpeningSubmit(payload: Record<string, unknown>): Promise<void> {
  submitting.value = true
  try {
    const res = await settlementApi.upsertOpening(payload)
    if (res.success) {
      ElMessage.success(res.message || '已保存')
      openingVisible.value = false
    }
  } finally {
    submitting.value = false
  }
}

/** 人工调整过的行左侧加提示条，避免和系统算出来的数混淆 */
function rowClassName({ row }: { row: SettlementLineItem }): string {
  return row.amount_overridden ? 'settlement-row-overridden' : ''
}

async function exportExcel(): Promise<void> {
  if (rows.value.length === 0) {
    ElMessage.warning('当前没有可导出的数据')
    return
  }
  const XLSX = await import('xlsx')
  const header = [
    '月份', '序号', '平台', '姓名', '用车时间', '还车时间', '数量', '单价',
    '合计', '平台管理费', '结算金额', '公司管理费', '其他费用', '车主结算金额', '备注'
  ]
  const body = rows.value.map((row, index) => [
    row.period,
    index + 1,
    row.source_name ?? '线下',
    row.customer_name ?? '',
    row.start_date ?? row.line_date,
    row.end_date ?? '',
    row.days,
    row.unit_price,
    row.total_amount,
    row.platform_fee,
    row.settlement_amount,
    row.company_fee,
    row.other_fee,
    row.owner_amount,
    [row.status === 'void' ? '【已作废】' : '', row.remarks ?? ''].filter(Boolean).join(' ')
  ])
  // 末行带合计，与台账的「总计」一致
  body.push(['', '', '', '', '', '', '', '', '', '', '', '', '', totals.value.owner_amount, '合计'])

  const sheet = XLSX.utils.aoa_to_sheet([header, ...body])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '车主结算')
  XLSX.writeFile(book, `车主结算_${query.period || '全部'}.xlsx`)
  ElMessage.success('已导出（末行为车主结算合计）')
}

onMounted(async () => {
  await loadOptions()
  await loadData()
})
</script>

<style scoped>
.settlement-tab {
  width: 100%;
}

.totals-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--sk-bg-light-gray);
  font-size: 13px;
  color: var(--sk-text-secondary);
}

.totals-bar b {
  color: var(--sk-text-near-black);
}

html.dark .totals-bar b {
  color: var(--sk-text-white);
}

.totals-strong b {
  color: var(--sk-focus-color);
}

.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
