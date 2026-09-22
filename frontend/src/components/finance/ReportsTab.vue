<template>
  <div class="reports-tab">
    <el-tabs v-model="activeReport">
      <!-- 单车月报 -->
      <el-tab-pane label="单车月报" name="vehicle-monthly">
        <div class="report-toolbar">
          <el-date-picker v-model="monthlyPeriod" type="month" value-format="YYYY-MM" placeholder="月份" @change="loadMonthly" />
          <el-select v-model="monthlyOwnerId" placeholder="全部车主" clearable style="width: 150px" @change="loadMonthly">
            <el-option v-for="o in owners" :key="o.id" :label="o.name" :value="o.id" />
          </el-select>
          <el-button :loading="loading.monthly" @click="loadMonthly">刷新</el-button>
          <el-button @click="exportMonthly">导出</el-button>
        </div>
        <p class="report-hint">
          结余 = 车主结算 − 月供 − 保养 − 维修 − 其它车辆费用。保险等年费按「分摊月数」摊到各月，
          所以续保月不会突然出现一条巨大的负数。
        </p>
        <DataState :loading="loading.monthly" :error="error.monthly" :empty="!loading.monthly && !error.monthly && monthlyRows.length === 0" empty-text="暂无数据" skeleton @retry="loadMonthly">
          <div class="mobile-cards">
            <div v-for="row in monthlyRows" :key="row.vehicle_id" class="mobile-card">
              <div class="mobile-card-header">
                <span>{{ row.plate_number }} <el-tag v-if="row.vehicle_no" size="small" type="info">{{ row.vehicle_no }}</el-tag></span>
                <span :class="moneyClass(row.balance)">{{ formatMoney(row.balance) }}</span>
              </div>
              <div class="mobile-card-row"><span class="label">车主</span><span class="value">{{ row.owner_name || '-' }}</span></div>
              <div class="mobile-card-grid">
                <div class="mobile-card-row"><span class="label">天数</span><span class="value num">{{ row.days }}</span></div>
                <div class="mobile-card-row"><span class="label">车主结算</span><span class="value num">{{ formatMoney(row.owner_amount) }}</span></div>
                <div class="mobile-card-row"><span class="label">月供</span><span class="value num">{{ formatMoney(row.monthly_payment, { dashOnZero: true }) }}</span></div>
                <div class="mobile-card-row"><span class="label">保养</span><span class="value num">{{ formatMoney(row.maintenance, { dashOnZero: true }) }}</span></div>
                <div class="mobile-card-row"><span class="label">维修</span><span class="value num">{{ formatMoney(row.repair, { dashOnZero: true }) }}</span></div>
                <div class="mobile-card-row"><span class="label">其它费用</span><span class="value num">{{ formatMoney(row.other_expense, { dashOnZero: true }) }}</span></div>
              </div>
            </div>
          </div>
          <el-card shadow="never" class="table-card">
            <el-table :data="monthlyRows" stripe show-summary :summary-method="monthlySummary" :default-sort="{ prop: 'balance', order: 'descending' }">
              <el-table-column prop="plate_number" label="车牌" min-width="115" />
              <el-table-column prop="vehicle_no" label="编号" min-width="65" align="center" />
              <el-table-column prop="owner_name" label="车主" min-width="110" />
              <el-table-column prop="days" label="天数" min-width="70" align="center" sortable />
              <el-table-column label="车主结算" min-width="120" class-name="amount-cell" prop="owner_amount" sortable>
                <template #default="{ row }">{{ formatMoney(row.owner_amount) }}</template>
              </el-table-column>
              <el-table-column label="月供" min-width="110" class-name="amount-cell" prop="monthly_payment" sortable>
                <template #default="{ row }">{{ formatMoney(row.monthly_payment, { dashOnZero: true }) }}</template>
              </el-table-column>
              <el-table-column label="保养" min-width="105" class-name="amount-cell" prop="maintenance" sortable>
                <template #default="{ row }">{{ formatMoney(row.maintenance, { dashOnZero: true }) }}</template>
              </el-table-column>
              <el-table-column label="维修" min-width="105" class-name="amount-cell" prop="repair" sortable>
                <template #default="{ row }">{{ formatMoney(row.repair, { dashOnZero: true }) }}</template>
              </el-table-column>
              <el-table-column label="其它费用" min-width="110" class-name="amount-cell" prop="other_expense" sortable>
                <template #default="{ row }">{{ formatMoney(row.other_expense, { dashOnZero: true }) }}</template>
              </el-table-column>
              <el-table-column label="结余" min-width="120" class-name="amount-cell" prop="balance" sortable>
                <template #default="{ row }"><b :class="moneyClass(row.balance)">{{ formatMoney(row.balance) }}</b></template>
              </el-table-column>
              <el-table-column label="单数" min-width="70" align="center">
                <template #default="{ row }">{{ row.line_count }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </DataState>
      </el-tab-pane>

      <!-- 车辆收益排行 -->
      <el-tab-pane label="车辆收益" name="ranking">
        <div class="report-toolbar">
          <el-date-picker
            v-if="!isMobile"
            v-model="rankRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始"
            end-placeholder="结束"
            @change="loadRanking"
          />
          <!-- 窄屏用原生 date：el-date-picker 的面板有 600 多像素宽，手机上会顶出屏幕 -->
          <div v-else class="mobile-date-range">
            <input v-model="rankFrom" type="date" class="native-date-input" @change="loadRanking" />
            <span class="date-separator">-</span>
            <input v-model="rankTo" type="date" class="native-date-input" @change="loadRanking" />
          </div>
          <el-button :loading="loading.ranking" @click="loadRanking">刷新</el-button>
        </div>
        <p class="report-hint">收益 = 车主结算 − 车辆费用 − 该车月供。没出车的车排最后。</p>
        <DataState
          :loading="loading.ranking"
          :empty="!loading.ranking && rankRows.length === 0"
          empty-text="该区间没有出车记录"
          skeleton
          @retry="loadRanking"
        >
          <div class="mobile-cards">
            <div v-for="row in rankRows" :key="row.vehicle_id" class="mobile-card">
              <div class="mobile-card-header">
                <span>{{ row.plate_number || '-' }}</span>
                <span :class="moneyClass(row.profit)">{{ formatMoney(row.profit) }}</span>
              </div>
              <div class="mobile-card-row"><span class="label">车主</span><span class="value">{{ row.owner_name || '-' }}</span></div>
              <div class="mobile-card-grid">
                <div class="mobile-card-row"><span class="label">天数</span><span class="value num">{{ row.days }}</span></div>
                <div class="mobile-card-row"><span class="label">单数</span><span class="value num">{{ row.line_count }}</span></div>
                <div class="mobile-card-row"><span class="label">车主结算</span><span class="value num">{{ formatMoney(row.owner_amount) }}</span></div>
                <div class="mobile-card-row"><span class="label">公司管理费</span><span class="value num">{{ formatMoney(row.company_fee, { dashOnZero: true }) }}</span></div>
                <div class="mobile-card-row"><span class="label">车辆费用</span><span class="value num">{{ formatMoney(row.expense, { dashOnZero: true }) }}</span></div>
                <div class="mobile-card-row"><span class="label">收益</span><span class="value num" :class="moneyClass(row.profit)">{{ formatMoney(row.profit) }}</span></div>
              </div>
            </div>
          </div>

          <el-card shadow="never" class="table-card">
            <el-table :data="rankRows" stripe>
              <el-table-column type="index" label="#" min-width="55" align="center" />
              <el-table-column prop="plate_number" label="车牌" min-width="120" />
              <el-table-column prop="owner_name" label="车主" min-width="120" />
              <el-table-column prop="days" label="天数" min-width="70" align="center" />
              <el-table-column label="车主结算" min-width="120" class-name="amount-cell">
                <template #default="{ row }">{{ formatMoney(row.owner_amount) }}</template>
              </el-table-column>
              <el-table-column label="公司管理费" min-width="115" class-name="amount-cell">
                <template #default="{ row }">{{ formatMoney(row.company_fee, { dashOnZero: true }) }}</template>
              </el-table-column>
              <el-table-column label="车辆费用" min-width="115" class-name="amount-cell">
                <template #default="{ row }">{{ formatMoney(row.expense, { dashOnZero: true }) }}</template>
              </el-table-column>
              <el-table-column label="收益" min-width="120" class-name="amount-cell">
                <template #default="{ row }"><b :class="moneyClass(row.profit)">{{ formatMoney(row.profit) }}</b></template>
              </el-table-column>
              <el-table-column label="单数" min-width="70" align="center">
                <template #default="{ row }">{{ row.line_count }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </DataState>
      </el-tab-pane>

      <!-- 公司月报 -->
      <el-tab-pane label="公司月报" name="company">
        <div class="report-toolbar">
          <el-date-picker v-model="companyPeriod" type="month" value-format="YYYY-MM" placeholder="月份" @change="loadCompany" />
          <el-button :loading="loading.company" @click="loadCompany">刷新</el-button>
        </div>
        <p class="report-hint">
          公司收入 = 挂靠车的公司管理费 + 自营车的全额结算额。挂靠车的车辆费用与月供由车主承担，
          不计入公司成本（在对账单里扣回）。
        </p>
        <el-row v-if="company" :gutter="12">
          <el-col :xs="24" :md="12">
            <el-card shadow="never" class="report-card">
              <div class="finance-section-title">收入</div>
              <div class="kv"><span>租金合计</span><b>{{ formatMoney(company.revenue.total_amount) }}</b></div>
              <div class="kv"><span>平台管理费</span><b>{{ formatMoney(company.revenue.platform_fee) }}</b></div>
              <div class="kv"><span>结算金额</span><b>{{ formatMoney(company.revenue.settlement_amount) }}</b></div>
              <div class="kv"><span>车主结算（付出去）</span><b>{{ formatMoney(company.revenue.owner_amount) }}</b></div>
              <div class="kv is-strong"><span>公司收入</span><b>{{ formatMoney(company.revenue.company_income) }}</b></div>
              <div class="kv"><span>出租天数 / 单数</span><b>{{ company.revenue.days }} / {{ company.revenue.line_count }}</b></div>
            </el-card>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-card shadow="never" class="report-card">
              <div class="finance-section-title">成本</div>
              <div class="kv"><span>自营车保养</span><b>{{ formatMoney(company.cost.vehicle_maintenance, { dashOnZero: true }) }}</b></div>
              <div class="kv"><span>自营车维修</span><b>{{ formatMoney(company.cost.vehicle_repair, { dashOnZero: true }) }}</b></div>
              <div class="kv"><span>自营车其它费用</span><b>{{ formatMoney(company.cost.vehicle_other, { dashOnZero: true }) }}</b></div>
              <div class="kv"><span>自营车费用小计</span><b>{{ formatMoney(company.cost.vehicle_total, { dashOnZero: true }) }}</b></div>
              <div class="kv"><span>运营开支</span><b>{{ formatMoney(company.cost.operating, { dashOnZero: true }) }}</b></div>
              <div class="kv"><span>自营车月供</span><b>{{ formatMoney(company.cost.monthly_loan, { dashOnZero: true }) }}</b></div>
              <div class="kv"><span>挂靠车月供（车主承担）</span><b>{{ formatMoney(company.cost.monthly_loan_attached, { dashOnZero: true }) }}</b></div>
              <div class="kv"><span>本期结算付款</span><b>{{ formatMoney(company.cost.settlement_payout, { dashOnZero: true }) }}</b></div>
              <div class="kv is-strong"><span>成本合计</span><b>{{ formatMoney(company.cost.total) }}</b></div>
            </el-card>
          </el-col>
        </el-row>
        <el-card v-if="company" shadow="never" class="report-card profit-card">
          <span>本期净利</span>
          <b :class="moneyClass(company.profit)">{{ formatMoneyUnit(company.profit) }}</b>
        </el-card>
      </el-tab-pane>

      <!-- 资金流水报表 -->
      <el-tab-pane label="资金流水" name="fund-flow">
        <div class="report-toolbar">
          <el-date-picker
            v-if="!isMobile"
            v-model="flowRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始"
            end-placeholder="结束"
            @change="loadFlow"
          />
          <!-- 窄屏用原生 date：el-date-picker 的面板有 600 多像素宽，手机上会顶出屏幕 -->
          <div v-else class="mobile-date-range">
            <input v-model="flowFrom" type="date" class="native-date-input" @change="loadFlow" />
            <span class="date-separator">-</span>
            <input v-model="flowTo" type="date" class="native-date-input" @change="loadFlow" />
          </div>
          <el-radio-group v-model="flowBy" @change="loadFlow">
            <el-radio-button value="month">按月</el-radio-button>
            <el-radio-button value="day">按日</el-radio-button>
          </el-radio-group>
          <el-button :loading="loading.flow" @click="loadFlow">刷新</el-button>
        </div>
        <DataState
          v-if="flow"
          :loading="loading.flow"
          :empty="!loading.flow && flow.rows.length === 0"
          empty-text="该区间没有流水"
          skeleton
          @retry="loadFlow"
        >
          <!-- 摘要挪出卡片：卡片在窄屏整体隐藏，留在卡片里窄屏就看不到了 -->
          <div class="flow-summary">
            <span>期初 <b>{{ formatMoney(flow.opening) }}</b></span>
            <span>收入 <b class="money-positive">{{ formatMoney(flow.summary.income) }}</b></span>
            <span>支出 <b class="money-negative">{{ formatMoney(flow.summary.expense) }}</b></span>
            <span>期末 <b>{{ formatMoney(flow.summary.closing) }}</b></span>
          </div>

          <div class="mobile-cards">
            <div v-for="row in flow.rows" :key="row.bucket" class="mobile-card">
              <div class="mobile-card-header">
                <span>{{ row.bucket }}</span>
                <span><span class="label">期末 </span><b>{{ formatMoney(row.balance) }}</b></span>
              </div>
              <div class="mobile-card-grid">
                <div class="mobile-card-row"><span class="label">收入</span><span class="value num money-positive">{{ formatMoney(row.income, { dashOnZero: true }) }}</span></div>
                <div class="mobile-card-row"><span class="label">支出</span><span class="value num money-negative">{{ formatMoney(row.expense, { dashOnZero: true }) }}</span></div>
                <div class="mobile-card-row"><span class="label">笔数</span><span class="value num">{{ row.count }}</span></div>
              </div>
            </div>
          </div>

          <el-card shadow="never" class="table-card">
            <el-table :data="flow.rows" size="small" stripe>
              <el-table-column prop="bucket" label="期间" width="120" />
              <el-table-column label="收入" class-name="amount-cell" prop="income">
                <template #default="{ row }">{{ formatMoney(row.income, { dashOnZero: true }) }}</template>
              </el-table-column>
              <el-table-column label="支出" class-name="amount-cell" prop="expense">
                <template #default="{ row }">{{ formatMoney(row.expense, { dashOnZero: true }) }}</template>
              </el-table-column>
              <el-table-column label="笔数" width="80" align="center">
                <template #default="{ row }">{{ row.count }}</template>
              </el-table-column>
              <el-table-column label="期末余额" class-name="amount-cell" width="140">
                <template #default="{ row }"><b>{{ formatMoney(row.balance) }}</b></template>
              </el-table-column>
            </el-table>
          </el-card>
        </DataState>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
/**
 * 财务报表面板。
 *
 * 四张表各自独立加载（切页签才拉数据），避免进财务页就打 4 个聚合查询。
 * 口径说明见后端 src/controllers/reports.ts 的文件头 —— 三条口径
 * （经营收入 / 结算收入 / 现金余额）不能混着比较。
 */
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import DataState from '../DataState.vue'
import { financeReportApi, ownerApi } from '../../api'
import type {
  CompanyMonthlyReport,
  FundFlowReport,
  OwnerOption,
  VehicleMonthlyReport,
  VehicleMonthlyRow,
  VehicleRankingRow
} from '../../api/types'
import { formatMoney, formatMoneyUnit, moneyClass } from '../../utils/money'
import { useMobile } from '../../composables/useMobile'

const { isMobile } = useMobile()

function today(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().substring(0, 10)
}

function monthStart(): string {
  return `${today().substring(0, 7)}-01`
}

const activeReport = ref('vehicle-monthly')
const owners = ref<OwnerOption[]>([])

const monthlyPeriod = ref(today().substring(0, 7))
const monthlyOwnerId = ref('')
const monthlyRows = ref<VehicleMonthlyRow[]>([])
const monthlyTotals = ref<VehicleMonthlyReport['totals'] | null>(null)

const rankRange = ref<[string, string]>([`${today().substring(0, 4)}-01-01`, today()])
// 移动端日期范围用两个原生 input（isMobile 时 rankRange 不再绑定），取值时二选一
const rankFrom = ref(rankRange.value[0])
const rankTo = ref(rankRange.value[1])
const rankRows = ref<VehicleRankingRow[]>([])

const companyPeriod = ref(today().substring(0, 7))
const company = ref<CompanyMonthlyReport | null>(null)

const flowRange = ref<[string, string]>([monthStart(), today()])
const flowFrom = ref(flowRange.value[0])
const flowTo = ref(flowRange.value[1])
const flowBy = ref<'month' | 'day'>('month')
const flow = ref<FundFlowReport | null>(null)

const loading = reactive({ monthly: false, ranking: false, company: false, flow: false })
const error = reactive<Record<string, string | null>>({ monthly: null, ranking: null, company: null, flow: null })

async function loadMonthly(): Promise<void> {
  loading.monthly = true
  error.monthly = null
  try {
    const res = await financeReportApi.getVehicleMonthly({
      period: monthlyPeriod.value,
      owner_id: monthlyOwnerId.value || undefined
    })
    if (res.success && res.data) {
      monthlyRows.value = res.data.rows
      monthlyTotals.value = res.data.totals
    }
  } catch {
    error.monthly = '加载失败，请重试'
  } finally {
    loading.monthly = false
  }
}

async function loadRanking(): Promise<void> {
  loading.ranking = true
  try {
    const [start, end] = isMobile.value ? [rankFrom.value, rankTo.value] : rankRange.value
    const res = await financeReportApi.getVehicleRanking({
      start_date: start,
      end_date: end
    })
    if (res.success && res.data) rankRows.value = res.data.rows
  } finally {
    loading.ranking = false
  }
}

async function loadCompany(): Promise<void> {
  loading.company = true
  try {
    const res = await financeReportApi.getCompanyMonthly({ period: companyPeriod.value })
    if (res.success && res.data) company.value = res.data
  } finally {
    loading.company = false
  }
}

async function loadFlow(): Promise<void> {
  loading.flow = true
  try {
    const [start, end] = isMobile.value ? [flowFrom.value, flowTo.value] : flowRange.value
    const res = await financeReportApi.getFundFlow({
      start_date: start,
      end_date: end,
      by: flowBy.value
    })
    if (res.success && res.data) flow.value = res.data
  } finally {
    loading.flow = false
  }
}

/**
 * 单车月报的表格合计行，与台账的「累计」行一致。
 * 用显式映射而不是按列名动态取值 —— 合计对象的键是固定字段，
 * 动态索引既过不了类型检查，也容易在改列名时悄悄失效。
 */
const SUMMARY_KEYS: Record<string, keyof VehicleMonthlyReport['totals']> = {
  days: 'days',
  owner_amount: 'owner_amount',
  monthly_payment: 'monthly_payment',
  maintenance: 'maintenance',
  repair: 'repair',
  other_expense: 'other_expense',
  balance: 'balance'
}

function monthlySummary({ columns }: { columns: Array<{ property?: string }> }): string[] {
  const t = monthlyTotals.value
  return columns.map((column, index) => {
    if (index === 0) return '合计'
    if (!t) return ''
    const key = column.property ? SUMMARY_KEYS[column.property] : undefined
    return key ? formatMoney(t[key]) : ''
  })
}

async function exportMonthly(): Promise<void> {
  if (monthlyRows.value.length === 0) {
    ElMessage.warning('当前没有可导出的数据')
    return
  }
  const XLSX = await import('xlsx')
  const header = ['月份', '车牌', '编号', '车主', '天数', '车主结算', '月供', '保养', '维修', '其它费用', '结余', '单数']
  const body = monthlyRows.value.map((row) => [
    monthlyPeriod.value, row.plate_number, row.vehicle_no ?? '', row.owner_name ?? '',
    row.days, row.owner_amount, row.monthly_payment, row.maintenance, row.repair,
    row.other_expense, row.balance, row.line_count
  ])
  const t = monthlyTotals.value
  if (t) body.push(['合计', '', '', '', t.days, t.owner_amount, t.monthly_payment, t.maintenance, t.repair, t.other_expense, t.balance, ''])
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '单车月报')
  XLSX.writeFile(book, `单车月报_${monthlyPeriod.value}.xlsx`)
}

// 每个页签只加载一次（不是「只加载第一个被切到的页签」）：
// 之前用一个全局 hasShown 标记，它在第一次切换后就变 true，导致「车辆收益」
// 只有在它是第一个被点开的页签时才会加载，否则永远空表且不报错。
const loadedTabs = reactive<Record<string, boolean>>({})

// 切到某个页签时才加载，避免一次性打四个聚合查询
watch(activeReport, (name) => {
  if (name === 'ranking' && !loadedTabs.ranking) {
    loadedTabs.ranking = true
    loadRanking()
  }
  if (name === 'company' && !loadedTabs.company) {
    loadedTabs.company = true
    loadCompany()
  }
  if (name === 'fund-flow' && !loadedTabs['fund-flow']) {
    loadedTabs['fund-flow'] = true
    loadFlow()
  }
})

onMounted(async () => {
  const ownerRes = await ownerApi.getOptions()
  if (ownerRes.success && ownerRes.data) owners.value = ownerRes.data
  await loadMonthly()
})
</script>

<style scoped>
.reports-tab {
  width: 100%;
}

.report-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.report-hint {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--sk-text-tertiary);
}

.report-card {
  margin-bottom: 12px;
}

.kv {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 0;
  font-size: 13px;
  color: var(--sk-text-tertiary);
}

.kv b {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  color: var(--sk-text-near-black);
}

html.dark .kv b {
  color: var(--sk-text-white);
}

.kv.is-strong b {
  font-size: 18px;
  color: var(--sk-focus-color);
}

.profit-card {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 14px;
  color: var(--sk-text-tertiary);
}

.profit-card b {
  font-size: 24px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
}

.flow-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--sk-bg-light-gray);
  font-size: 13px;
  color: var(--sk-text-secondary);
}

.flow-summary b {
  color: var(--sk-text-near-black);
}

html.dark .flow-summary b {
  color: var(--sk-text-white);
}
</style>
