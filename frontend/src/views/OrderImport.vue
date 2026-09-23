<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">批量导入订单</h1>
      <p class="page-subtitle">支持携程供应商后台导出与自有平台导出，上传后先预览校验，确认无误再落库</p>
    </div>

    <!-- 第一步：上传 -->
    <el-card v-if="step === 'upload'" shadow="never" class="sk-card">
      <div class="upload-area" @click="triggerFile" @dragover.prevent @drop.prevent="onDrop">
        <el-icon class="upload-icon"><Upload /></el-icon>
        <p class="upload-text">点击选择或拖拽 Excel 文件到此处</p>
        <p class="upload-hint">支持 .xlsx，自动识别携程 / 自有平台导出格式</p>
      </div>
      <input ref="fileInput" type="file" accept=".xlsx,.xls" class="hidden-input" @change="onFileChange" />
    </el-card>

    <!-- 第二步：预览 -->
    <template v-if="step === 'preview'">
      <el-card shadow="never" class="sk-card">
        <div class="summary-bar">
          <div class="summary-item">
            <span class="summary-value">{{ summary?.total ?? 0 }}</span>
            <span class="summary-label">总行数</span>
          </div>
          <div class="summary-item is-ok">
            <span class="summary-value">{{ summary?.importable ?? 0 }}</span>
            <span class="summary-label">可导入</span>
          </div>
          <div class="summary-item is-error">
            <span class="summary-value">{{ summary?.error ?? 0 }}</span>
            <span class="summary-label">有错误</span>
          </div>
          <div class="summary-item is-warn">
            <span class="summary-value">{{ summary?.warning ?? 0 }}</span>
            <span class="summary-label">有提醒</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ summary?.newCustomers ?? 0 }}</span>
            <span class="summary-label">新建客户</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ summary?.newVehicles ?? 0 }}</span>
            <span class="summary-label">新建车辆</span>
          </div>

          <div class="summary-actions">
            <AppSelect
              v-model="defaultSourceId"
              :options="sourceOptions"
              placeholder="选择订单来源"
              size="default"
              class="source-select"
            />
            <el-button type="primary" :loading="committing" :disabled="!canCommit" @click="runCommit">
              确认导入 {{ importableCount }} 条
            </el-button>
            <el-button @click="reset">重新选择文件</el-button>
          </div>
        </div>
        <p class="platform-tip">
          已识别为「{{ platformText }}」模板，共 {{ summary?.total ?? 0 }} 行
          <span v-if="!defaultSourceId" class="need-source">请先选择订单来源，整批订单将归入该来源</span>
        </p>
      </el-card>

      <el-card shadow="never" class="sk-card table-card">
        <el-table :data="prepared" :row-class-name="rowClassName" border stripe size="small" max-height="560">
          <el-table-column type="index" label="行" width="56" :index="(i: number) => i + 2" />
          <el-table-column prop="row.external_no" label="平台订单号" width="170" />
          <el-table-column prop="row.customer_name" label="客户" width="90" />
          <el-table-column label="手机号" width="150">
            <template #default="{ row }">
              <el-input
                v-model="row.row.customer_phone"
                size="small"
                placeholder="脱敏待补全"
                @input="onPhoneEdit(row)"
              />
            </template>
          </el-table-column>
          <el-table-column prop="row.plate_number" label="车牌" width="100" />
          <el-table-column prop="row.vehicle_model" label="车型" min-width="180" show-overflow-tooltip />
          <el-table-column label="取车时间" width="150">
            <template #default="{ row }">{{ row.row.start_date || '-' }}</template>
          </el-table-column>
          <el-table-column label="还车时间" width="150">
            <template #default="{ row }">{{ row.row.end_date || '-' }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">{{ statusText(row.row.status) }}</template>
          </el-table-column>
          <el-table-column label="金额" width="90" align="right">
            <template #default="{ row }">{{ row.row.total_amount }}</template>
          </el-table-column>
          <el-table-column label="校验结果" min-width="220">
            <template #default="{ row }">
              <div v-if="row.issues.length === 0" class="issue-ok">正常</div>
              <div v-else class="issue-list">
                <el-tag
                  v-for="issue in row.issues"
                  :key="issue.field + issue.message"
                  :type="issue.level === 'error' ? 'danger' : 'warning'"
                  size="small"
                  effect="plain"
                >
                  {{ issue.message }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="跳过" width="70" align="center">
            <template #default="{ row }">
              <el-checkbox v-model="skipMap[row.rowIndex]" />
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 移动端：同一批预览数据改成 WeUI cell 分组，保留手机号补全与跳过操作 -->
      <div class="mobile-cards import-mobile-cards">
        <div
          v-for="item in prepared"
          :key="item.rowIndex"
          class="mobile-card import-mobile-card"
          :class="{
            'is-error': !item.importable,
            'is-warning': item.importable && item.issues.some((issue) => issue.level === 'warning'),
            'is-skipped': skipMap[item.rowIndex]
          }"
        >
          <div class="mobile-card-header">
            <span class="import-row-title">第 {{ item.rowIndex + 1 }} 行 · {{ item.row.external_no || '无平台订单号' }}</span>
            <el-tag v-if="!item.importable" type="danger" size="small">有错误</el-tag>
            <el-tag v-else-if="item.issues.length" type="warning" size="small">有提醒</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </div>
          <div class="mobile-card-row">
            <span class="label">客户</span>
            <span class="value">{{ item.row.customer_name || '-' }}</span>
          </div>
          <div class="mobile-card-row">
            <span class="label">手机号</span>
            <span class="value import-phone-value">
              <el-input
                v-model="item.row.customer_phone"
                size="small"
                placeholder="脱敏待补全"
                @input="onPhoneEdit(item)"
              />
            </span>
          </div>
          <div class="mobile-card-row">
            <span class="label">车辆</span>
            <span class="value">{{ item.row.plate_number || '-' }} · {{ item.row.vehicle_model || '-' }}</span>
          </div>
          <div class="mobile-card-row">
            <span class="label">租期</span>
            <span class="value">{{ item.row.start_date || '-' }} 至 {{ item.row.end_date || '-' }}</span>
          </div>
          <div class="mobile-card-row">
            <span class="label">状态 / 金额</span>
            <span class="value">{{ statusText(item.row.status) }} · ¥{{ item.row.total_amount }}</span>
          </div>
          <div v-if="item.issues.length" class="mobile-card-row is-block import-issues-row">
            <span class="label">校验提示</span>
            <span class="value import-issues">
              <span v-for="issue in item.issues" :key="issue.field + issue.message" :class="issue.level">
                {{ issue.message }}
              </span>
            </span>
          </div>
          <div class="mobile-card-actions">
            <el-checkbox v-model="skipMap[item.rowIndex]">跳过该行</el-checkbox>
          </div>
        </div>
      </div>
    </template>

    <!-- 第三步：结果 -->
    <el-card v-if="step === 'done'" shadow="never" class="sk-card">
      <div class="result-box">
        <el-icon class="result-icon"><i class="weui-icon-filled-done2" /></el-icon>
        <p class="result-text">成功导入 {{ result?.imported ?? 0 }} 条订单</p>
        <p class="result-detail">
          新建客户 {{ result?.new_customers ?? 0 }} · 新建车辆 {{ result?.new_vehicles ?? 0 }} · 跳过
          {{ result?.skipped ?? 0 }}
        </p>
        <div class="result-actions">
          <el-button type="primary" @click="goOrders">查看订单列表</el-button>
          <el-button @click="reset">继续导入</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import { importApi } from '../api'
import { useDictStore } from '../stores/dict'
import AppSelect from '../components/AppSelect.vue'
import { ORDER_STATUS_TEXT_MAP, PLATFORM_TEXT_MAP } from '../utils/constants'

interface RowIssue {
  field: string
  message: string
  level: 'error' | 'warning'
}

interface PreviewRow {
  rowIndex: number
  row: {
    external_no: string
    customer_name: string
    customer_phone: string
    plate_number: string
    vehicle_model: string
    start_date: string
    end_date: string
    status: string | null
    total_amount: number
    phone_masked: boolean
  }
  issues: RowIssue[]
  importable: boolean
}

type Step = 'upload' | 'preview' | 'done'

const router = useRouter()
const dictStore = useDictStore()
const step = ref<Step>('upload')
const fileInput = ref<HTMLInputElement | null>(null)
const platform = ref('')
const filename = ref('')
const headers = ref<string[]>([])
const rawRows = ref<(string | null)[][]>([])
const prepared = ref<PreviewRow[]>([])
const summary = ref<Record<string, number> | null>(null)
const skipMap = ref<Record<number, boolean>>({})
const sources = ref<{ id: string; name: string }[]>([])
// AppSelect 的选项（桌面端 el-select 与移动端滚轮共用同一份数据）
const sourceOptions = computed(() => sources.value.map((s) => ({ label: s.name, value: s.id })))
const defaultSourceId = ref('')
const loading = ref(false)
const committing = ref(false)
const result = ref<Record<string, number> | null>(null)

const platformText = computed(() => PLATFORM_TEXT_MAP[platform.value] ?? platform.value)
const importableCount = computed(
  () => prepared.value.filter((item) => item.importable && !skipMap.value[item.rowIndex]).length
)
// 订单来源必选：整批订单统一挂到所选来源下
const canCommit = computed(() => Boolean(defaultSourceId.value) && importableCount.value > 0)

function statusText(status: string | null): string {
  return status ? ORDER_STATUS_TEXT_MAP[status] ?? status : '未知'
}

function rowClassName({ row }: { row: PreviewRow }): string {
  if (skipMap.value[row.rowIndex]) return 'row-skipped'
  if (!row.importable) return 'row-error'
  if (row.issues.some((issue) => issue.level === 'warning')) return 'row-warning'
  return ''
}

/** 补全手机号后，把对应的脱敏提醒去掉，避免预览里一直报警 */
function onPhoneEdit(item: PreviewRow): void {
  const phone = item.row.customer_phone.trim()
  if (!phone) return
  item.issues = item.issues.filter(
    (issue) => !(issue.field === 'customer_phone' && issue.level === 'warning')
  )
}

async function parseFile(file: File): Promise<void> {
  if (!/\.xlsx?$/.test(file.name)) {
    ElMessage.error('请上传 Excel 文件（.xlsx）')
    return
  }

  loading.value = true
  try {
    // 只在导入页按需加载，避免把 SheetJS 打进首屏
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      blankrows: false,
      defval: null,
      raw: false
    })

    if (matrix.length < 2) {
      ElMessage.error('文件内容为空')
      return
    }

    const toText = (value: unknown): string | null =>
      value === null || value === undefined || value === '' ? null : String(value)

    headers.value = (matrix[0] ?? []).map(toText).map((item) => item ?? '')
    rawRows.value = matrix.slice(1).map((line) => (line ?? []).map(toText))
    filename.value = file.name

    await runPreview()
  } catch (error) {
    ElMessage.error('解析文件失败，请确认文件未损坏')
    console.error('解析 Excel 失败:', error)
  } finally {
    loading.value = false
  }
}

async function runPreview(): Promise<void> {
  try {
    const res: any = await importApi.preview({ headers: headers.value, rows: rawRows.value })
    platform.value = res.data.platform
    prepared.value = res.data.rows
    summary.value = res.data.summary
    skipMap.value = {}
    step.value = 'preview'
  } catch {
    // 错误提示已由响应拦截器统一处理
  }
}

async function runCommit(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确认导入 ${importableCount.value} 条订单？导入后可按批次撤销。`,
      '确认导入',
      { type: 'warning', confirmButtonText: '确认导入', cancelButtonText: '再看看' }
    )
  } catch {
    return
  }

  committing.value = true
  try {
    const overrides = prepared.value
      .map((item) => ({
        rowIndex: item.rowIndex,
        customer_phone: item.row.customer_phone,
        skip: Boolean(skipMap.value[item.rowIndex])
      }))
      .filter((item) => item.skip || item.customer_phone)

    const res: any = await importApi.commit({
      platform: platform.value,
      headers: headers.value,
      rows: rawRows.value,
      filename: filename.value,
      overrides,
      default_source_id: defaultSourceId.value
    })
    result.value = res.data
    step.value = 'done'
  } catch {
    // 错误提示已由响应拦截器统一处理
  } finally {
    committing.value = false
  }
}

function onFileChange(event: Event): void {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) void parseFile(file)
  target.value = ''
}

function onDrop(event: DragEvent): void {
  const file = event.dataTransfer?.files?.[0]
  if (file) void parseFile(file)
}

function triggerFile(): void {
  fileInput.value?.click()
}

function reset(): void {
  step.value = 'upload'
  platform.value = ''
  filename.value = ''
  headers.value = []
  rawRows.value = []
  prepared.value = []
  summary.value = null
  result.value = null
  skipMap.value = {}
  defaultSourceId.value = ''
}

function goOrders(): void {
  void router.push('/orders')
}

onMounted(async () => {
  sources.value = await dictStore.ensureOrderSources()
})
</script>

<style scoped>
.page-header {
  margin-bottom: 20px;
}

.page-title {
  margin: 0 0 4px;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--sk-text-near-black);
}

.page-subtitle {
  margin: 0;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.48);
}

.sk-card {
  border-radius: 8px;
  margin-bottom: 16px;
}

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 20px;
  border: 1px dashed rgba(0, 0, 0, 0.16);
  border-radius: 11px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.upload-area:hover {
  border-color: var(--sk-focus-color);
  background: rgba(var(--sk-focus-color-rgb), 0.04);
}

.upload-icon {
  font-size: 40px;
  color: var(--sk-focus-color);
  margin-bottom: 12px;
}

.upload-text {
  margin: 0 0 6px;
  font-size: 15px;
  color: rgba(0, 0, 0, 0.8);
}

.upload-hint {
  margin: 0;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.48);
}

.hidden-input {
  display: none;
}

.summary-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 24px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary-value {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.summary-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.48);
}

.is-ok .summary-value {
  color: #34c759;
}

.is-error .summary-value {
  color: #ff3b30;
}

.is-warn .summary-value {
  color: #ff9500;
}

.summary-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

/* AppSelect / AppDatePicker 这类多根组件不会把父组件的 scoped id 贴到内部元素上，
   所以点名的类必须走 :deep()，否则宽度规则会静默失效（桌面端会被 EP 默认 100% 撑开） */
.summary-actions :deep(.source-select) {
  width: 220px;
}

.platform-tip {
  margin: 12px 0 0;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.48);
}

.need-source {
  margin-left: 8px;
  color: #ff3b30;
}

.issue-ok {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.48);
}

.issue-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.result-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
}

.result-icon {
  font-size: 48px;
  color: #34c759;
  margin-bottom: 12px;
}

.result-text {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
}

.result-detail {
  margin: 0 0 20px;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.48);
}

.result-actions {
  display: flex;
  gap: 8px;
}

:deep(.row-error) {
  background: rgba(255, 59, 48, 0.06);
}

:deep(.row-warning) {
  background: rgba(255, 149, 0, 0.06);
}

:deep(.row-skipped) {
  opacity: 0.45;
}

/* 移动端列表默认藏掉宽表格，预览卡片接管 */
.import-mobile-cards {
  display: none;
}

.import-mobile-card.is-error {
  border-left: 3px solid var(--sk-color-danger);
}

.import-mobile-card.is-warning {
  border-left: 3px solid var(--sk-color-warning);
}

.import-mobile-card.is-skipped {
  opacity: 0.5;
}

.import-row-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-phone-value {
  flex: 1 1 160px !important;
}

.import-phone-value :deep(.el-input) {
  width: 100%;
}

.import-issues {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}

.import-issues .error {
  color: var(--sk-color-danger);
}

.import-issues .warning {
  color: var(--sk-color-warning);
}

@media (max-width: 767px) {
  /* WeUI 语义色覆盖：桌面端继续保留原 Apple 色值，移动端跟随 --sk-* token */
  .is-ok .summary-value,
  .result-icon {
    color: var(--sk-color-success);
  }

  .is-error .summary-value,
  .need-source {
    color: var(--sk-color-danger);
  }

  .is-warn .summary-value {
    color: var(--sk-color-warning);
  }

  .page-header {
    margin-bottom: 12px;
  }

  .page-title {
    font-size: 22px;
  }

  .page-subtitle {
    font-size: 14px;
    line-height: 1.4;
  }

  .summary-bar {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px 8px;
  }

  .summary-item {
    min-width: 0;
    align-items: center;
  }

  .summary-value {
    font-size: 22px;
  }

  .summary-actions {
    grid-column: 1 / -1;
    margin-left: 0;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .summary-actions :deep(.source-select) {
    width: 100%;
  }

  .summary-actions .el-button {
    width: 100%;
    margin-left: 0;
  }

  .platform-tip {
    line-height: 1.5;
  }

  .need-source {
    display: block;
    margin: 4px 0 0;
  }

  .table-card {
    display: none;
  }

  .import-mobile-cards {
    display: flex;
  }

  .import-mobile-card .mobile-card-header {
    align-items: flex-start;
  }

  .import-mobile-card .mobile-card-actions {
    justify-content: flex-start;
  }

  .upload-area {
    min-height: 220px;
    padding: 32px 16px;
  }

  .result-box {
    padding: 32px 16px;
  }

  .result-actions {
    width: 100%;
    flex-direction: column;
  }

  .result-actions .el-button {
    width: 100%;
    margin-left: 0;
  }
}
</style>
