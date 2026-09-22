<template>
  <div class="operating-expenses-tab">
    <!-- 统计 -->
    <div class="stats-cards">
      <el-card shadow="hover" class="stat-item">
        <div class="stat-label">{{ stats.period }} 开支</div>
        <div class="stat-value">{{ formatMoneyUnit(stats.month_total) }}</div>
      </el-card>
      <el-card shadow="hover" class="stat-item">
        <div class="stat-label">应付未付（全部）</div>
        <div class="stat-value money-negative">{{ formatMoneyUnit(stats.unpaid.total) }}</div>
        <div class="stat-foot">{{ stats.unpaid.count }} 条待付</div>
      </el-card>
    </div>

    <!-- 按项目汇总 -->
    <el-card v-if="stats.by_category.length" shadow="never" class="summary-card">
      <div class="finance-section-title">本月按项目</div>
      <div class="category-tags">
        <el-tag
          v-for="c in stats.by_category"
          :key="c.category"
          :type="query.category === c.category ? 'primary' : 'info'"
          class="category-tag"
          @click="filterByCategory(c.category)"
        >
          {{ c.category_name }} {{ formatMoney(c.total) }}（{{ c.count }}）
        </el-tag>
      </div>
    </el-card>

    <!-- 筛选 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="query">
        <el-form-item>
          <el-select v-model="query.category" placeholder="全部项目" clearable filterable style="width: 150px" @change="reload">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
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
          <el-input v-model="query.keyword" placeholder="备注/收款方" clearable style="width: 150px" @keyup.enter="reload" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="reload">搜索</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="totals-bar">
      <span>合计 <b class="amount-cell">{{ formatMoney(totals.total) }}</b></span>
      <span>已付 <b class="amount-cell">{{ formatMoney(totals.paid_total) }}</b></span>
      <span>未付 <b class="amount-cell money-negative">{{ formatMoney(totals.unpaid_total) }}</b></span>
      <span>共 <b>{{ totals.count }}</b> 条</span>
    </div>

    <div class="action-bar">
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon> 新增开支
      </el-button>
      <el-button @click="exportExcel">导出</el-button>
    </div>

    <DataState :loading="loading" :error="error" :empty="!loading && !error && rows.length === 0" empty-text="暂无开支记录" skeleton @retry="loadData">
      <div class="mobile-cards">
        <div v-for="row in rows" :key="row.id" class="mobile-card">
          <div class="mobile-card-header">
            <span>{{ row.category_name }}</span>
            <span>{{ formatMoney(row.amount) }}</span>
          </div>
          <div class="mobile-card-grid">
            <div class="mobile-card-row"><span class="label">日期</span><span class="value num">{{ row.expense_date }}</span></div>
            <div class="mobile-card-row" v-if="row.payee"><span class="label">收款方</span><span class="value">{{ row.payee }}</span></div>
            <div class="mobile-card-row"><span class="label">发票</span><span class="value">{{ INVOICE_STATUS_TEXT_MAP[row.invoice_status] || row.invoice_status }}</span></div>
          </div>
          <div class="mobile-card-row is-block" v-if="row.remarks"><span class="label">备注</span><span class="value">{{ row.remarks }}</span></div>
          <div class="mobile-card-row">
            <span class="label">状态</span>
            <span class="value"><el-tag size="small" :type="row.is_paid ? 'success' : 'warning'">{{ row.is_paid ? '已付款' : '未付款' }}</el-tag></span>
          </div>
          <div class="mobile-card-actions">
            <el-button v-if="row.is_paid === 0" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.is_paid === 0" size="small" @click="openPay(row)">标记付款</el-button>
            <el-button v-if="canManage && row.is_paid === 1" size="small" @click="handleUnpay(row)">撤销付款</el-button>
            <el-button v-if="canManage && row.is_paid === 0" size="small" type="danger" plain @click="handleDelete(row)">删除</el-button>
          </div>
        </div>
      </div>

      <el-card shadow="never" class="table-card">
        <el-table :data="rows" stripe v-loading="loading">
          <el-table-column prop="expense_date" label="日期" width="105" />
          <el-table-column prop="category_name" label="项目" width="130" />
          <el-table-column label="金额" width="120" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="payee" label="收款方" width="130" show-overflow-tooltip />
          <el-table-column label="发票" width="80">
            <template #default="{ row }">{{ INVOICE_STATUS_TEXT_MAP[row.invoice_status] || row.invoice_status }}</template>
          </el-table-column>
          <el-table-column label="付款" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="row.is_paid ? 'success' : 'warning'">{{ row.is_paid ? '已付款' : '未付款' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remarks" label="备注" min-width="180" show-overflow-tooltip />
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.is_paid === 0" link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button v-if="row.is_paid === 0" link type="primary" size="small" @click="openPay(row)">付款</el-button>
              <el-button v-if="canManage && row.is_paid === 1" link type="primary" size="small" @click="handleUnpay(row)">撤销</el-button>
              <el-button v-if="canManage && row.is_paid === 0" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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

    <OperatingExpenseFormDialog
      v-model:visible="formVisible"
      :submitting="submitting"
      :accounts="accounts"
      :categories="categories"
      :category="query.category"
      :expense="editing"
      @submit="handleSubmit"
    />

    <el-dialog v-model="payVisible" title="标记付款" width="90%" :style="{ maxWidth: '400px' }">
      <p class="pay-tip">{{ payTarget?.expense_date }} {{ payTarget?.category_name }}：{{ formatMoney(payTarget?.amount ?? 0) }}</p>
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
      <template #footer>
        <el-button @click="payVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handlePay">确认付款</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 运营开支台账（台账 file-4 的「运营开支台账」sheet，27 个项目）。
 *
 * 台账里这一列只有「微信 / 公户」两种支付方式，系统里对应到资金账户，
 * 所以这里挑账户就是挑支付方式 —— 付款后会在资金流水里记一笔 out。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import DataState from '../DataState.vue'
import OperatingExpenseFormDialog from './OperatingExpenseFormDialog.vue'
import { financeReportApi, operatingExpenseApi } from '../../api'
import type { AccountOption, ExpenseCategoryItem, OperatingExpenseItem, OperatingExpenseTotals } from '../../api/types'
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

const rows = ref<OperatingExpenseItem[]>([])
const total = ref(0)
const totals = ref<OperatingExpenseTotals>({ total: 0, paid_total: 0, unpaid_total: 0, count: 0 })
const stats = ref({
  period: today().substring(0, 7),
  month_total: 0,
  by_category: [] as Array<{ category: string; category_name: string; total: number; count: number }>,
  by_month: [] as Array<{ month: string; total: number; count: number }>,
  unpaid: { total: 0, count: 0 }
})
const categories = ref<ExpenseCategoryItem[]>([])
const accounts = ref<AccountOption[]>([])

const loading = ref(false)
const error = ref<string | null>(null)
const submitting = ref(false)

const dateRange = ref<[string, string] | null>(null)
// 移动端日期范围用两个原生 input（isMobile 时 dateRange 不再绑定），取值时二选一
const dateFrom = ref('')
const dateTo = ref('')
const query = reactive({ page: 1, pageSize: 20, category: '', is_paid: '', keyword: '' })

const formVisible = ref(false)
const payVisible = ref(false)
const editing = ref<OperatingExpenseItem | null>(null)
const payTarget = ref<OperatingExpenseItem | null>(null)
const payAccountId = ref('')
const payDate = ref(today())

async function loadData(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const [listRes, statsRes] = await Promise.all([
      operatingExpenseApi.getList({
        page: query.page,
        pageSize: query.pageSize,
        category: query.category || undefined,
        is_paid: query.is_paid || undefined,
        start_date: (isMobile.value ? dateFrom.value : dateRange.value?.[0]) || undefined,
        end_date: (isMobile.value ? dateTo.value : dateRange.value?.[1]) || undefined,
        keyword: query.keyword || undefined
      }),
      operatingExpenseApi.getStats({ period: today().substring(0, 7) })
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

function filterByCategory(category: string): void {
  query.category = query.category === category ? '' : category
  reload()
}

async function loadOptions(): Promise<void> {
  const res = await financeReportApi.getDicts()
  if (res.success && res.data) {
    categories.value = res.data.expense_categories
    accounts.value = res.data.accounts
  }
}

function openCreate(): void {
  editing.value = null
  formVisible.value = true
}

function openEdit(row: OperatingExpenseItem): void {
  editing.value = row
  formVisible.value = true
}

async function handleSubmit(payload: Record<string, unknown>): Promise<void> {
  submitting.value = true
  try {
    const res = editing.value
      ? await operatingExpenseApi.update(editing.value.id, payload)
      : await operatingExpenseApi.create(payload)
    if (res.success) {
      ElMessage.success(res.message || '已保存')
      formVisible.value = false
      await loadData()
    }
  } finally {
    submitting.value = false
  }
}

function openPay(row: OperatingExpenseItem): void {
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
    const res = await operatingExpenseApi.pay(payTarget.value.id, {
      account_id: payAccountId.value,
      paid_at: payDate.value
    })
    if (res.success) {
      ElMessage.success(res.message || '已标记付款')
      payVisible.value = false
      await loadData()
    }
  } finally {
    submitting.value = false
  }
}

async function handleUnpay(row: OperatingExpenseItem): Promise<void> {
  try {
    await ElMessageBox.confirm('撤销后该笔开支的资金流水会被删除，账户余额随之回退。确认撤销？', '撤销付款', {
      type: 'warning'
    })
  } catch {
    return
  }
  const res = await operatingExpenseApi.unpay(row.id)
  if (res.success) {
    ElMessage.success(res.message || '已撤销')
    await loadData()
  }
}

async function handleDelete(row: OperatingExpenseItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`删除 ${row.expense_date} 的「${row.category_name}」${formatMoney(row.amount)}？`, '删除', {
      type: 'warning'
    })
  } catch {
    return
  }
  const res = await operatingExpenseApi.delete(row.id)
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
  const header = ['日期', '项目', '金额', '收款方', '发票', '是否已付款', '备注']
  const body = rows.value.map((row) => [
    row.expense_date,
    row.category_name,
    row.amount,
    row.payee ?? '',
    INVOICE_STATUS_TEXT_MAP[row.invoice_status] ?? row.invoice_status,
    row.is_paid ? '已付款' : '未付款',
    row.remarks ?? ''
  ])
  body.push(['', '合计', totals.value.total, '', '', '', ''])
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '运营开支')
  XLSX.writeFile(book, `运营开支台账_${today()}.xlsx`)
}

onMounted(async () => {
  await loadOptions()
  await loadData()
})
</script>

<style scoped>
.operating-expenses-tab {
  width: 100%;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
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

.summary-card {
  margin-bottom: 12px;
}

.category-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.category-tag {
  cursor: pointer;
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
