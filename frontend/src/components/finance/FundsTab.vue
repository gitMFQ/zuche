<template>
  <div class="funds-tab">
    <!-- 账户余额卡片 -->
    <div class="stats-cards">
      <el-card v-for="a in accounts" :key="a.id" shadow="hover" class="account-card" @click="filterByAccount(a.id)">
        <div class="account-name">
          {{ a.name }}
          <el-tag size="small" type="info">{{ ACCOUNT_TYPE_TEXT_MAP[a.account_type] || a.account_type }}</el-tag>
        </div>
        <div class="account-balance" :class="moneyClass(a.balance)">{{ formatMoneyUnit(a.balance) }}</div>
        <div class="account-foot">期初 {{ formatMoney(a.opening_balance) }}（{{ a.opening_date }}）</div>
      </el-card>
    </div>

    <el-alert
      v-if="holdingBalance !== 0"
      type="warning"
      :closable="false"
      show-icon
      title="有流水落在「待归属」账户"
      :description="`共 ${formatMoneyUnit(holdingBalance)} 的收支没有匹配到具体账户（多半是支付方式没配映射）。到列表里改归属即可。`"
      style="margin-bottom: 12px"
    />

    <!-- 筛选 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="query">
        <el-form-item>
          <el-select v-model="query.account_id" placeholder="全部账户" clearable style="width: 140px" @change="reload">
            <el-option v-for="a in accounts" :key="a.id" :label="a.name" :value="a.id" />
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
            style="width: 240px"
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
          <el-select v-model="query.direction" placeholder="收支" clearable style="width: 90px" @change="reload">
            <el-option v-for="o in FUND_DIRECTION_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-select v-model="query.source_type" placeholder="来源" clearable style="width: 130px" @change="reload">
            <el-option v-for="(label, value) in FUND_SOURCE_TYPE_TEXT_MAP" :key="value" :label="label" :value="value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-input v-model="query.keyword" placeholder="摘要/对方/备注" clearable style="width: 160px" @keyup.enter="reload" />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="hideReversed" @change="reload">隐藏已冲销</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="reload">搜索</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 操作栏 -->
    <div class="action-bar">
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon> 记账
      </el-button>
      <el-button v-if="canManage" @click="transferVisible = true">账户划转</el-button>
      <el-button v-if="canManage" @click="openLockDialog">账期锁定</el-button>
      <el-button @click="exportExcel">导出</el-button>
    </div>

    <DataState :loading="loading" :error="error" :empty="!loading && !error && rows.length === 0" skeleton empty-text="暂无流水" @retry="loadData">
      <!-- 移动端 -->
      <div class="mobile-cards">
        <div v-for="row in rows" :key="row.id" class="mobile-card">
          <div class="mobile-card-header">
            <span>{{ row.txn_date }}</span>
            <span :class="row.direction === 'in' ? 'money-positive' : 'money-negative'">
              {{ row.direction === 'in' ? '+' : '-' }}{{ formatMoney(row.amount) }}
            </span>
          </div>
          <div class="mobile-card-row is-block"><span class="label">摘要</span><span class="value">{{ row.summary }}</span></div>
          <div class="mobile-card-grid">
            <div class="mobile-card-row"><span class="label">账户</span><span class="value">{{ row.account_name }}</span></div>
            <div class="mobile-card-row" v-if="row.balance !== undefined">
              <span class="label">余额</span><span class="value num">{{ formatMoney(row.balance) }}</span>
            </div>
            <div class="mobile-card-row" v-if="row.counterparty"><span class="label">对方</span><span class="value">{{ row.counterparty }}</span></div>
            <div class="mobile-card-row">
              <span class="label">来源</span>
              <span class="value">
                {{ FUND_SOURCE_TYPE_TEXT_MAP[row.source_type] || row.source_type }}
                <el-tag v-if="row.status === 'reversed'" size="small" type="info">已冲销</el-tag>
              </span>
            </div>
          </div>
          <div class="mobile-card-actions">
            <el-button v-if="canManage" size="small" @click="openReassign(row)">改归属</el-button>
            <el-button
              v-if="canManage && row.source_type === 'manual' && row.status === 'posted'"
              size="small"
              type="danger"
              plain
              @click="openReverse(row)"
            >
              冲销
            </el-button>
            <el-button
              v-if="canManage && row.source_type === 'manual' && row.status === 'posted'"
              size="small"
              @click="openEdit(row)"
            >
              编辑
            </el-button>
          </div>
        </div>
      </div>

      <!-- PC -->
      <el-card shadow="never" class="table-card">
        <el-table :data="rows" stripe v-loading="loading">
          <el-table-column prop="txn_date" label="日期" width="105" />
          <el-table-column prop="account_name" label="账户" width="100" />
          <el-table-column label="收支" width="90">
            <template #default="{ row }">
              <el-tag :type="row.direction === 'in' ? 'success' : 'danger'" size="small">
                {{ FUND_DIRECTION_TEXT_MAP[row.direction] || row.direction }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="120" class-name="amount-cell">
            <template #default="{ row }">
              <span :class="row.direction === 'in' ? 'money-positive' : 'money-negative'">{{ formatMoney(row.amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="withBalance" label="余额" width="120" class-name="amount-cell">
            <template #default="{ row }">{{ formatMoney(row.balance) }}</template>
          </el-table-column>
          <el-table-column prop="summary" label="摘要" min-width="180" show-overflow-tooltip />
          <el-table-column prop="counterparty" label="对方" width="110" show-overflow-tooltip />
          <el-table-column label="来源" width="110">
            <template #default="{ row }">
              {{ FUND_SOURCE_TYPE_TEXT_MAP[row.source_type] || row.source_type }}
              <el-tag v-if="row.status === 'reversed'" size="small" type="info">已冲销</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button v-if="canManage" link type="primary" size="small" @click="openReassign(row)">改归属</el-button>
              <el-button
                v-if="canManage && row.source_type === 'manual' && row.status === 'posted'"
                link
                type="primary"
                size="small"
                @click="openEdit(row)"
              >
                编辑
              </el-button>
              <el-button
                v-if="canManage && row.source_type === 'manual' && row.status === 'posted'"
                link
                type="danger"
                size="small"
                @click="openReverse(row)"
              >
                冲销
              </el-button>
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

    <!-- 弹窗 -->
    <FundTxnDialog
      v-model:visible="txnVisible"
      :submitting="submitting"
      :accounts="accounts"
      :transaction="editingTxn"
      @submit="handleTxnSubmit"
    />
    <TransferDialog
      v-model:visible="transferVisible"
      :submitting="submitting"
      :accounts="accounts"
      :default-account-id="query.account_id"
      @submit="handleTransferSubmit"
    />

    <!-- 改归属 -->
    <el-dialog v-model="reassignVisible" title="调整归属账户" width="90%" :style="{ maxWidth: '400px' }">
      <p class="reassign-tip">把「{{ reassignTarget?.summary }}」从 {{ reassignTarget?.account_name }} 挪到：</p>
      <el-select v-model="reassignAccountId" placeholder="选择账户" style="width: 100%">
        <el-option v-for="a in accounts" :key="a.id" :label="a.name" :value="a.id" />
      </el-select>
      <template #footer>
        <el-button @click="reassignVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleReassign">确定</el-button>
      </template>
    </el-dialog>

    <!-- 账期锁定 -->
    <el-dialog v-model="lockVisible" title="账期锁定" width="90%" :style="{ maxWidth: '460px' }">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="锁定后该月的流水与结算都不能再改"
        description="出完对账单就锁月，是财务最基本的护栏。需要补记时先解锁。"
        style="margin-bottom: 12px"
      />
      <div class="lock-row">
        <el-date-picker v-model="lockPeriod" type="month" value-format="YYYY-MM" placeholder="选择月份" />
        <el-button type="primary" :loading="submitting" @click="handleLock">锁定</el-button>
      </div>
      <el-divider />
      <el-empty v-if="locks.length === 0" description="还没有锁定的账期" :image-size="60" />
      <div v-for="l in locks" :key="l.period" class="lock-item">
        <span>{{ l.period }}</span>
        <span class="lock-time">{{ l.locked_at }}</span>
        <el-button link type="danger" size="small" @click="handleUnlock(l.period)">解锁</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 资金流水总账（台账 file-4 的「资金流水总账」sheet）。
 *
 * 余额是派生值：账户余额 = 期初 + 全部流水的收支，库里不存 balance_after。
 * 逐行余额只在「筛选到单一账户」且「未隐藏冲销行」时返回 —— 藏掉被冲销的原行后
 * 逐行余额必然算错（红字还在，被它抵消的那一行不见了）。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import DataState from '../DataState.vue'
import FundTxnDialog from './FundTxnDialog.vue'
import TransferDialog from './TransferDialog.vue'
import { fundApi } from '../../api'
import type { FinancePeriodLockItem, FundAccountItem, FundTransactionItem } from '../../api/types'
import { useUserStore } from '../../stores/user'
import {
  ACCOUNT_TYPE_TEXT_MAP,
  FUND_DIRECTION_OPTIONS,
  FUND_DIRECTION_TEXT_MAP,
  FUND_SOURCE_TYPE_TEXT_MAP
} from '../../utils/constants'
import { formatMoney, formatMoneyUnit, moneyClass } from '../../utils/money'
import { useMobile } from '../../composables/useMobile'

const userStore = useUserStore()
const { isMobile } = useMobile()
// store 里的 isAdmin 是个函数（不是 computed），模板里直接用会被当成函数引用恒为真
const canManage = computed(() => userStore.isAdmin())

const accounts = ref<FundAccountItem[]>([])
const rows = ref<FundTransactionItem[]>([])
const total = ref(0)
const withBalance = ref(false)
const loading = ref(false)
// DataState 的 error 是「错误文案」，非空即进入错误态
const error = ref<string | null>(null)
const submitting = ref(false)
const hideReversed = ref(false)
const locks = ref<FinancePeriodLockItem[]>([])

const dateRange = ref<[string, string] | null>(null)
// 移动端日期范围用两个原生 input（isMobile 时 dateRange 不再绑定），取值时二选一
const dateFrom = ref('')
const dateTo = ref('')
const query = reactive({
  page: 1,
  pageSize: 20,
  account_id: '',
  direction: '',
  source_type: '',
  keyword: ''
})

const txnVisible = ref(false)
const transferVisible = ref(false)
const reassignVisible = ref(false)
const lockVisible = ref(false)
const editingTxn = ref<FundTransactionItem | null>(null)
const reassignTarget = ref<FundTransactionItem | null>(null)
const reassignAccountId = ref('')
const lockPeriod = ref(new Date(Date.now() + 8 * 3600 * 1000).toISOString().substring(0, 7))

const holdingBalance = computed(() => {
  const holding = accounts.value.find((a) => a.account_type === 'virtual' && !a.method_key)
  return holding?.balance ?? 0
})

async function loadAccounts(): Promise<void> {
  const res = await fundApi.getAccounts()
  if (res.success && res.data) accounts.value = res.data
}

async function loadData(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const [start, end] = isMobile.value ? [dateFrom.value, dateTo.value] : (dateRange.value ?? [])
    const res = await fundApi.getTransactions({
      page: query.page,
      pageSize: query.pageSize,
      account_id: query.account_id || undefined,
      direction: query.direction || undefined,
      source_type: query.source_type || undefined,
      keyword: query.keyword || undefined,
      start_date: start || undefined,
      end_date: end || undefined,
      hide_reversed: hideReversed.value ? '1' : undefined
    })
    if (res.success && res.data) {
      rows.value = res.data.data
      total.value = res.data.total
      withBalance.value = res.data.with_balance
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

function filterByAccount(id: string): void {
  query.account_id = query.account_id === id ? '' : id
  reload()
}

function openCreate(): void {
  editingTxn.value = null
  txnVisible.value = true
}

function openEdit(row: FundTransactionItem): void {
  editingTxn.value = row
  txnVisible.value = true
}

async function refreshAll(): Promise<void> {
  await Promise.all([loadAccounts(), loadData()])
}

async function handleTxnSubmit(payload: Record<string, unknown>): Promise<void> {
  submitting.value = true
  try {
    const editing = editingTxn.value
    const res = editing ? await fundApi.updateTransaction(editing.id, payload) : await fundApi.createTransaction(payload)
    if (res.success) {
      ElMessage.success(res.message || '已保存')
      txnVisible.value = false
      editingTxn.value = null
      await refreshAll()
    }
  } finally {
    submitting.value = false
  }
}

async function handleTransferSubmit(payload: Record<string, unknown>): Promise<void> {
  submitting.value = true
  try {
    const res = await fundApi.createTransfer(payload)
    if (res.success) {
      ElMessage.success(res.message || '划转成功')
      transferVisible.value = false
      await refreshAll()
    }
  } finally {
    submitting.value = false
  }
}

function openReassign(row: FundTransactionItem): void {
  reassignTarget.value = row
  reassignAccountId.value = row.account_id
  reassignVisible.value = true
}

async function handleReassign(): Promise<void> {
  if (!reassignTarget.value || !reassignAccountId.value) return
  submitting.value = true
  try {
    const res = await fundApi.reassign(reassignTarget.value.id, reassignAccountId.value)
    if (res.success) {
      ElMessage.success(res.message || '已调整')
      reassignVisible.value = false
      await refreshAll()
    }
  } finally {
    submitting.value = false
  }
}

async function openReverse(row: FundTransactionItem): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt(
      `将写一条反向红字冲销「${row.summary}」（不删除原记录，保留审计痕迹）`,
      '冲销流水',
      { confirmButtonText: '确认冲销', cancelButtonText: '取消', inputPlaceholder: '冲销原因' }
    )
    const res = await fundApi.reverse(row.id, value || '手工冲销')
    if (res.success) {
      ElMessage.success(res.message || '已冲销')
      await refreshAll()
    }
  } catch {
    // 用户取消，不提示
  }
}

async function openLockDialog(): Promise<void> {
  lockVisible.value = true
  const res = await fundApi.getPeriodLocks()
  if (res.success && res.data) locks.value = res.data
}

async function handleLock(): Promise<void> {
  if (!lockPeriod.value) return
  submitting.value = true
  try {
    const res = await fundApi.lockPeriod(lockPeriod.value)
    if (res.success) {
      ElMessage.success(res.message || '已锁定')
      await openLockDialog()
    }
  } finally {
    submitting.value = false
  }
}

async function handleUnlock(period: string): Promise<void> {
  try {
    await ElMessageBox.confirm(`解锁 ${period} 后该月的流水与结算都可以被修改，确认解锁？`, '解锁账期', {
      type: 'warning'
    })
  } catch {
    return
  }
  const res = await fundApi.unlockPeriod(period)
  if (res.success) {
    ElMessage.success(res.message || '已解锁')
    await openLockDialog()
  }
}

/**
 * 导出当前筛选条件的流水。
 * 用 xlsx 动态导入（与批量导入页同一套），不额外引入服务端导出依赖。
 */
async function exportExcel(): Promise<void> {
  if (rows.value.length === 0) {
    ElMessage.warning('当前没有可导出的数据')
    return
  }
  const XLSX = await import('xlsx')
  const header = ['日期', '账户', '收支', '金额', '余额', '摘要', '对方', '来源', '状态', '备注']
  const body = rows.value.map((row) => [
    row.txn_date,
    row.account_name ?? '',
    FUND_DIRECTION_TEXT_MAP[row.direction] ?? row.direction,
    row.amount,
    row.balance ?? '',
    row.summary,
    row.counterparty ?? '',
    FUND_SOURCE_TYPE_TEXT_MAP[row.source_type] ?? row.source_type,
    row.status === 'reversed' ? '已冲销' : '正常',
    row.remarks ?? ''
  ])
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '资金流水')
  const suffix = query.account_id ? accounts.value.find((a) => a.id === query.account_id)?.name ?? '账户' : '全部账户'
  XLSX.writeFile(book, `资金流水_${suffix}_${new Date().toISOString().substring(0, 10)}.xlsx`)
}

onMounted(async () => {
  await loadAccounts()
  await loadData()
})

defineExpose({ refreshAll })
</script>

<style scoped>
.funds-tab {
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
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}

.account-card {
  cursor: pointer;
}

.account-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--sk-text-tertiary);
}

.account-balance {
  margin: 6px 0 4px;
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
  color: var(--sk-text-near-black);
}

html.dark .account-balance {
  color: var(--sk-text-white);
}

.account-foot {
  font-size: 12px;
  color: var(--sk-text-tertiary);
}

.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.reassign-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--sk-text-secondary);
}

.lock-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.lock-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
}

.lock-time {
  flex: 1;
  color: var(--sk-text-tertiary);
  font-size: 12px;
}
</style>
