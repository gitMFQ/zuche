<template>
  <div class="vehicle-expenses-tab">
    <!-- 统计卡 -->
    <div class="stats-cards">
      <el-card shadow="hover" class="stat-item">
        <div class="stat-label">{{ stats.period }} 支出</div>
        <div class="stat-value money-negative">{{ formatMoneyUnit(stats.month.expense) }}</div>
      </el-card>
      <el-card shadow="hover" class="stat-item">
        <div class="stat-label">{{ stats.period }} 收入</div>
        <div class="stat-value money-positive">{{ formatMoneyUnit(stats.month.income) }}</div>
      </el-card>
      <el-card shadow="hover" class="stat-item">
        <div class="stat-label">未付款支出</div>
        <div class="stat-value money-negative">{{ formatMoneyUnit(stats.unpaid.expense) }}</div>
        <div class="stat-foot">{{ stats.unpaid.count }} 条待付</div>
      </el-card>
      <el-card shadow="hover" class="stat-item">
        <div class="stat-label">未收款收入</div>
        <div class="stat-value money-positive">{{ formatMoneyUnit(stats.unpaid.income) }}</div>
      </el-card>
    </div>

    <!-- 筛选 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="query">
        <el-form-item>
          <el-select v-model="query.vehicle_id" placeholder="全部车辆" clearable filterable style="width: 150px" @change="reload">
            <el-option v-for="v in vehicles" :key="v.id" :label="v.plate_number" :value="v.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-select v-model="query.expense_type" placeholder="费用类型" clearable style="width: 120px" @change="reload">
            <el-option v-for="t in types" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-select v-model="query.is_paid" placeholder="付款状态" clearable style="width: 110px" @change="reload">
            <el-option label="已付款" value="1" />
            <el-option label="未付款" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-date-picker
            v-if="!isMobile"
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始"
            end-placeholder="结束"
            style="width: 230px"
            @change="reload"
          />
          <!-- 窄屏用原生 date：el-date-picker 的面板有 600 多像素宽，手机上会顶出屏幕 -->
          <div v-else class="mobile-date-range">
            <input v-model="dateFrom" type="date" class="native-date-input" @change="reload" />
            <span class="date-separator">-</span>
            <input v-model="dateTo" type="date" class="native-date-input" @change="reload" />
          </div>
        </el-form-item>
        <el-form-item>
          <el-input v-model="query.keyword" placeholder="车牌/备注" clearable style="width: 140px" @keyup.enter="reload" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="reload">搜索</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="totals-bar">
      <span>支出 <b class="amount-cell money-negative">{{ formatMoney(totals.expense_total) }}</b></span>
      <span>收入 <b class="amount-cell money-positive">{{ formatMoney(totals.income_total) }}</b></span>
      <span>共 <b>{{ totals.count }}</b> 条</span>
    </div>

    <div class="action-bar">
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon> 新增费用
      </el-button>
      <el-button @click="exportExcel">导出</el-button>
    </div>

    <DataState :loading="loading" :error="error" :empty="!loading && !error && rows.length === 0" empty-text="暂无车辆费用" skeleton @retry="loadData">
      <div class="mobile-cards">
        <div v-for="row in rows" :key="row.id" class="mobile-card">
          <div class="mobile-card-header">
            <span>{{ row.plate_number || '-' }}</span>
            <el-tag size="small" :type="row.is_paid ? 'success' : 'warning'">{{ row.is_paid ? '已付款' : '未付款' }}</el-tag>
          </div>
          <div class="mobile-card-grid">
            <div class="mobile-card-row"><span class="label">日期</span><span class="value num">{{ row.expense_date }}</span></div>
            <div class="mobile-card-row"><span class="label">类型</span><span class="value">{{ row.expense_type_name }}</span></div>
            <div class="mobile-card-row" v-if="row.expense_amount"><span class="label">支出</span><span class="value num money-negative">{{ formatMoney(row.expense_amount) }}</span></div>
            <div class="mobile-card-row" v-if="row.income_amount"><span class="label">收入</span><span class="value num money-positive">{{ formatMoney(row.income_amount) }}</span></div>
            <div class="mobile-card-row"><span class="label">发票</span><span class="value">{{ INVOICE_STATUS_TEXT_MAP[row.invoice_status] || row.invoice_status }}</span></div>
            <div class="mobile-card-row" v-if="row.amortize_months > 1"><span class="label">分摊</span><span class="value num">{{ row.amortize_months }} 个月</span></div>
          </div>
          <div class="mobile-card-row is-block" v-if="row.remarks"><span class="label">备注</span><span class="value">{{ row.remarks }}</span></div>
          <div class="mobile-card-actions">
            <template v-if="isAuto(row)">
              <el-tag size="small" type="info">由{{ sourceLabel(row) }}自动生成</el-tag>
              <el-button v-if="row.is_paid === 0" size="small" @click="openPay(row)">标记付款</el-button>
              <el-button v-if="canManage && row.is_paid === 1" size="small" @click="handleUnpay(row)">撤销付款</el-button>
            </template>
            <template v-else>
              <el-button v-if="row.is_paid === 0" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button v-if="row.is_paid === 0" size="small" @click="openPay(row)">标记付款</el-button>
              <el-button v-if="canManage && row.is_paid === 1" size="small" @click="handleUnpay(row)">撤销付款</el-button>
              <el-button v-if="canManage && row.is_paid === 0" size="small" type="danger" plain @click="handleDelete(row)">删除</el-button>
            </template>
          </div>
        </div>
      </div>

      <el-card shadow="never" class="table-card">
        <el-table :data="rows" stripe v-loading="loading">
          <el-table-column prop="expense_date" label="日期" width="105" />
          <el-table-column prop="plate_number" label="车牌" width="110" />
          <el-table-column prop="expense_type_name" label="类型" width="90" />
          <el-table-column label="支出" width="110" class-name="amount-cell">
            <template #default="{ row }">
              <span class="money-negative">{{ formatMoney(row.expense_amount, { dashOnZero: true }) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="收入" width="110" class-name="amount-cell">
            <template #default="{ row }">
              <span class="money-positive">{{ formatMoney(row.income_amount, { dashOnZero: true }) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="发票" width="80">
            <template #default="{ row }">{{ INVOICE_STATUS_TEXT_MAP[row.invoice_status] || row.invoice_status }}</template>
          </el-table-column>
          <el-table-column label="付款" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="row.is_paid ? 'success' : 'warning'">{{ row.is_paid ? '已付款' : '未付款' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="来源" width="100">
            <template #default="{ row }">
              <el-tag v-if="isAuto(row)" size="small" type="info">{{ sourceLabel(row) }}</el-tag>
              <span v-else>手工</span>
            </template>
          </el-table-column>
          <el-table-column prop="remarks" label="备注" min-width="140" show-overflow-tooltip />
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <template v-if="isAuto(row)">
                <el-button v-if="row.is_paid === 0" link type="primary" size="small" @click="openPay(row)">标记付款</el-button>
                <el-button v-if="canManage && row.is_paid === 1" link type="primary" size="small" @click="handleUnpay(row)">撤销付款</el-button>
              </template>
              <template v-else>
                <el-button v-if="row.is_paid === 0" link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
                <el-button v-if="row.is_paid === 0" link type="primary" size="small" @click="openPay(row)">付款</el-button>
                <el-button v-if="canManage && row.is_paid === 1" link type="primary" size="small" @click="handleUnpay(row)">撤销</el-button>
                <el-button v-if="canManage && row.is_paid === 0" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
              </template>
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

    <VehicleExpenseFormDialog
      v-model:visible="formVisible"
      :submitting="submitting"
      :accounts="accounts"
      :types="types"
      :vehicles="vehicles"
      :expense="editing"
      :default-vehicle-id="query.vehicle_id"
      @submit="handleSubmit"
    />

    <el-dialog v-model="payVisible" title="标记付款" width="90%" :style="{ maxWidth: '400px' }">
      <p class="pay-tip">
        {{ payTarget?.plate_number }} {{ payTarget?.expense_type_name }}：支出
        {{ formatMoney(payTarget?.expense_amount ?? 0) }} / 收入 {{ formatMoney(payTarget?.income_amount ?? 0) }}
      </p>
      <el-form label-width="80px">
        <el-form-item label="付款账户">
          <el-select v-model="payAccountId" placeholder="选择账户" style="width: 100%">
            <el-option v-for="a in accounts" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="付款日期">
          <el-date-picker v-model="payDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
      </el-form>
      <el-alert type="info" :closable="false" show-icon title="确认后会在资金流水里记一笔（收入支出各一条）" />
      <template #footer>
        <el-button @click="payVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handlePay">确认付款</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 车辆费用台账（台账 file-4 的「车辆费用台账」sheet）。
 *
 * 收支双列而不是单金额：台账 2026.4.13 有一行「违章 | 收入300 | 支出300」，
 * 也有纯收入行「维修 | 收入2500 | 支出/ | 王宗强」（车损赔偿）。
 *
 * 保养/保险/违章会自动镜像到这里（只读，改要到源单据），付款状态则在**这里**标记 ——
 * 源单据不关心钱从哪个账户出，这部分信息只存在于费用行上。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import DataState from '../DataState.vue'
import VehicleExpenseFormDialog from './VehicleExpenseFormDialog.vue'
import { financeReportApi, vehicleApi, vehicleExpenseApi } from '../../api'
import type {
  AccountOption,
  VehicleExpenseItem,
  VehicleExpenseTotals,
  VehicleExpenseTypeItem,
  VehicleItem
} from '../../api/types'
import { useUserStore } from '../../stores/user'
import { INVOICE_STATUS_TEXT_MAP } from '../../utils/constants'
import { formatMoney, formatMoneyUnit } from '../../utils/money'
import { useMobile } from '../../composables/useMobile'

const userStore = useUserStore()
const canManage = computed(() => userStore.isAdmin())
const { isMobile } = useMobile()

function today(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().substring(0, 10)
}

const rows = ref<VehicleExpenseItem[]>([])
const total = ref(0)
const totals = ref<VehicleExpenseTotals>({ income_total: 0, expense_total: 0, unpaid_income: 0, unpaid_expense: 0, count: 0 })
const stats = ref({
  period: today().substring(0, 7),
  month: { income: 0, expense: 0, count: 0 },
  by_type: [] as Array<{ expense_type: string; expense_type_name: string; income: number; expense: number; count: number }>,
  by_vehicle: [] as Array<{ vehicle_id: string; plate_number: string | null; income: number; expense: number; count: number }>,
  unpaid: { income: 0, expense: 0, count: 0 }
})
const vehicles = ref<VehicleItem[]>([])
const types = ref<VehicleExpenseTypeItem[]>([])
const accounts = ref<AccountOption[]>([])

const loading = ref(false)
const error = ref<string | null>(null)
const submitting = ref(false)

const dateRange = ref<[string, string] | null>(null)
// 移动端日期范围用两个原生 input（isMobile 时 dateRange 不再绑定），取值时二选一
const dateFrom = ref('')
const dateTo = ref('')
const query = reactive({
  page: 1,
  pageSize: 20,
  vehicle_id: '',
  expense_type: '',
  is_paid: '',
  keyword: ''
})

const formVisible = ref(false)
const payVisible = ref(false)
const editing = ref<VehicleExpenseItem | null>(null)
const payTarget = ref<VehicleExpenseItem | null>(null)
const payAccountId = ref('')
const payDate = ref(today())

/** 保养/保险/违章镜像过来的行：金额只读，改动要去源单据 */
function isAuto(row: VehicleExpenseItem): boolean {
  return Boolean(row.source_type && row.source_type !== 'manual')
}

function sourceLabel(row: VehicleExpenseItem): string {
  const map: Record<string, string> = { maintenance: '保养', insurance: '保险', violation: '违章' }
  return map[row.source_type ?? ''] ?? '业务单据'
}

async function loadData(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const [listRes, statsRes] = await Promise.all([
      vehicleExpenseApi.getList({
        page: query.page,
        pageSize: query.pageSize,
        vehicle_id: query.vehicle_id || undefined,
        expense_type: query.expense_type || undefined,
        is_paid: query.is_paid || undefined,
        start_date: (isMobile.value ? dateFrom.value : dateRange.value?.[0]) || undefined,
        end_date: (isMobile.value ? dateTo.value : dateRange.value?.[1]) || undefined,
        keyword: query.keyword || undefined
      }),
      vehicleExpenseApi.getStats({ period: today().substring(0, 7) })
    ])
    if (listRes.success && listRes.data) {
      rows.value = listRes.data.data
      total.value = listRes.data.total
      totals.value = listRes.data.totals
    }
    if (statsRes.success && statsRes.data) stats.value = statsRes.data
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
  const [vehicleRes, dictRes] = await Promise.all([vehicleApi.getList({ page: 1, pageSize: 100 }), financeReportApi.getDicts()])
  if (vehicleRes.success && vehicleRes.data) vehicles.value = vehicleRes.data.data
  if (dictRes.success && dictRes.data) {
    types.value = dictRes.data.vehicle_expense_types
    accounts.value = dictRes.data.accounts
  }
}

function openCreate(): void {
  editing.value = null
  formVisible.value = true
}

function openEdit(row: VehicleExpenseItem): void {
  editing.value = row
  formVisible.value = true
}

async function handleSubmit(payload: Record<string, unknown>): Promise<void> {
  submitting.value = true
  try {
    const res = editing.value
      ? await vehicleExpenseApi.update(editing.value.id, payload)
      : await vehicleExpenseApi.create(payload)
    if (res.success) {
      ElMessage.success(res.message || '已保存')
      formVisible.value = false
      await loadData()
    }
  } finally {
    submitting.value = false
  }
}

function openPay(row: VehicleExpenseItem): void {
  payTarget.value = row
  payAccountId.value = accounts.value[0]?.id ?? ''
  payDate.value = row.expense_date || today()
  payVisible.value = true
}

async function handlePay(): Promise<void> {
  if (!payTarget.value || !payAccountId.value) {
    ElMessage.warning('请选择付款账户')
    return
  }
  submitting.value = true
  try {
    const res = await vehicleExpenseApi.pay(payTarget.value.id, { account_id: payAccountId.value, paid_at: payDate.value })
    if (res.success) {
      ElMessage.success(res.message || '已标记付款')
      payVisible.value = false
      await loadData()
    }
  } finally {
    submitting.value = false
  }
}

async function handleUnpay(row: VehicleExpenseItem): Promise<void> {
  try {
    await ElMessageBox.confirm('撤销后该笔费用的资金流水会被删除，账户余额随之回退。确认撤销？', '撤销付款', {
      type: 'warning'
    })
  } catch {
    return
  }
  const res = await vehicleExpenseApi.unpay(row.id)
  if (res.success) {
    ElMessage.success(res.message || '已撤销')
    await loadData()
  }
}

async function handleDelete(row: VehicleExpenseItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`删除 ${row.plate_number} ${row.expense_date} 的${row.expense_type_name}记录？`, '删除', {
      type: 'warning'
    })
  } catch {
    return
  }
  const res = await vehicleExpenseApi.delete(row.id)
  if (res.success) {
    ElMessage.success(res.message || '已删除')
    await loadData()
  }
}

async function exportExcel(): Promise<void> {
  if (rows.value.length === 0) {
    ElMessage.warning('当前没有可导出的数据')
    return
  }
  const XLSX = await import('xlsx')
  const header = ['日期', '车牌', '费用类型', '收入', '支出', '有无发票', '是否已付款', '来源', '备注']
  const body = rows.value.map((row) => [
    row.expense_date,
    row.plate_number ?? '',
    row.expense_type_name,
    row.income_amount || '',
    row.expense_amount || '',
    INVOICE_STATUS_TEXT_MAP[row.invoice_status] ?? row.invoice_status,
    row.is_paid ? '已付款' : '未付款',
    isAuto(row) ? sourceLabel(row) : '手工',
    row.remarks ?? ''
  ])
  body.push(['', '', '合计', totals.value.income_total, totals.value.expense_total, '', '', '', ''])
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '车辆费用')
  XLSX.writeFile(book, `车辆费用台账_${today()}.xlsx`)
}

onMounted(async () => {
  await loadOptions()
  await loadData()
})
</script>

<style scoped>
.vehicle-expenses-tab {
  width: 100%;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

@media (min-width: 768px) {
  .stats-cards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.stat-label {
  font-size: 13px;
  color: var(--sk-text-tertiary);
}

.stat-value {
  margin-top: 6px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
  color: var(--sk-text-near-black);
}

html.dark .stat-value {
  color: var(--sk-text-white);
}

.stat-foot {
  margin-top: 2px;
  font-size: 12px;
  color: var(--sk-text-tertiary);
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

.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.pay-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--sk-text-secondary);
}
</style>
