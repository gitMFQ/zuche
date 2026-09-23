<template>
  <div class="logs-tab">
    <!-- 筛选区域 -->
    <MobileFilterPanel title="筛选条件">
      <el-card shadow="never" class="filter-card">
        <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="操作类型">
          <AppSelect v-model="filterForm.action" :options="actionOptions" placeholder="全部" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item label="实体类型">
          <AppSelect v-model="filterForm.entityType" :options="entityOptions" placeholder="全部" clearable style="width: 120px" />
        </el-form-item>
        <el-form-item label="操作人">
          <AppSelect v-model="filterForm.userId" :options="userOptions" placeholder="全部" clearable filterable style="width: 140px" />
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-if="!isMobile"
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 240px"
          />
          <div v-else class="mobile-date-range">
            <AppDatePicker v-model="filterForm.date_from" type="date" value-format="YYYY-MM-DD" />
            <span class="date-separator">-</span>
            <AppDatePicker v-model="filterForm.date_to" type="date" value-format="YYYY-MM-DD" />
          </div>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filterForm.keyword" placeholder="搜索详情" clearable style="width: 160px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
        </el-form>
      </el-card>
    </MobileFilterPanel>

    <!-- 移动端卡片列表（桌面端隐藏） -->
    <div class="mobile-cards">
      <div v-for="item in logs" :key="item.id" class="mobile-card">
        <div class="mobile-card-header">
          <span class="log-action">
            <el-tag size="small" :type="getActionTagType(item.action)">{{ item.action_text }}</el-tag>
          </span>
          <span class="log-time">{{ formatTime(item.created_at) }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">操作人</span>
          <span class="value">{{ item.user_name || item.username || '-' }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">对象</span>
          <span class="value">{{ item.entity_type_text || '-' }}</span>
        </div>
        <div class="mobile-card-row is-block">
          <span class="label">详情</span>
          <span class="value">{{ item.details || '-' }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">IP</span>
          <span class="value">{{ item.ip_address || '-' }}</span>
        </div>
      </div>
      <el-empty v-if="!loading && logs.length === 0" description="暂无操作日志" />
    </div>

    <!-- 日志列表 -->
    <el-card shadow="never" class="list-card table-card">
      <el-table :data="logs" v-loading="loading" stripe class="hide-mobile">
        <el-table-column prop="created_at" label="时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="user_name" label="操作人" width="100">
          <template #default="{ row }">
            {{ row.user_name || row.username || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="action_text" label="操作类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="getActionTagType(row.action)">{{ row.action_text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="entity_type_text" label="对象类型" width="80">
          <template #default="{ row }">
            {{ row.entity_type_text || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="details" label="详情" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.details || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="ip_address" label="IP地址" width="130">
          <template #default="{ row }">
            {{ row.ip_address || '-' }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 分页放在卡片外：卡片在移动端整体隐藏，分页需要一直可见。
         样式（右对齐 + 12px 上间距）由 style.css 的 `.page-container .el-pagination` 统一给 -->
    <el-pagination
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :page-sizes="[10, 20, 50, 100]"
      :total="pagination.total"
      layout="total, sizes, prev, pager, next"
      background
      @size-change="fetchLogs"
      @current-change="fetchLogs"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { logApi } from '../api'
import AppDatePicker from './AppDatePicker.vue'
import AppSelect from './AppSelect.vue'
import MobileFilterPanel from './MobileFilterPanel.vue'
import { useDictStore } from '../stores/dict'
import { useMobile } from '../composables/useMobile'
import dayjs from 'dayjs'

const dictStore = useDictStore()

const loading = ref(false)
const { isMobile } = useMobile()
const logs = ref<any[]>([])
const actionTypes = ref<Record<string, string>>({})
const entityTypes = ref<Record<string, string>>({})
const users = ref<any[]>([])

// AppSelect 的选项。接口返回的是「值 → 中文」的 Record，转数组时别把 key/value 写反
const actionOptions = computed(() => Object.entries(actionTypes.value).map(([value, label]) => ({ label, value })))
const entityOptions = computed(() => Object.entries(entityTypes.value).map(([value, label]) => ({ label, value })))
const userOptions = computed(() => users.value.map((u) => ({ label: u.name, value: u.id })))
const dateRange = ref<string[]>([])

const filterForm = reactive({
  action: '',
  entityType: '',
  userId: '',
  keyword: '',
  date_from: '',
  date_to: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 格式化时间
function formatTime(time: string) {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

// 根据操作类型返回标签类型
function getActionTagType(action: string): string {
  if (action.includes('create')) return 'success'
  if (action.includes('update')) return 'warning'
  if (action.includes('delete')) return 'danger'
  if (action.includes('login') || action.includes('logout')) return 'info'
  return ''
}

// 获取日志列表
async function fetchLogs() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...filterForm
    }
    
    if (isMobile.value) {
      if (filterForm.date_from) params.startDate = filterForm.date_from
      if (filterForm.date_to) params.endDate = filterForm.date_to
    } else if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    
    const res: any = await logApi.getList(params)
    if (res.success) {
      logs.value = res.data.data
      pagination.total = res.data.total
    }
  } catch (error) {
    console.error('获取日志列表失败', error)
  } finally {
    loading.value = false
  }
}

// 获取操作类型列表
async function fetchActionTypes() {
  try {
    const res: any = await logApi.getActionTypes()
    if (res.success) {
      actionTypes.value = res.data
    }
  } catch (error) {
    console.error('获取操作类型失败', error)
  }
}

// 获取实体类型列表
async function fetchEntityTypes() {
  try {
    const res: any = await logApi.getEntityTypes()
    if (res.success) {
      entityTypes.value = res.data
    }
  } catch (error) {
    console.error('获取实体类型失败', error)
  }
}

// 获取用户列表（字典缓存：只包含产生过日志的用户）
async function fetchUsers() {
  users.value = await dictStore.ensureLogUsers()
}

// 搜索
function handleSearch() {
  pagination.page = 1
  fetchLogs()
}

// 重置
function handleReset() {
  filterForm.action = ''
  filterForm.entityType = ''
  filterForm.userId = ''
  filterForm.keyword = ''
  filterForm.date_from = ''
  filterForm.date_to = ''
  dateRange.value = []
  pagination.page = 1
  fetchLogs()
}

onMounted(() => {
  fetchLogs()
  fetchActionTypes()
  fetchEntityTypes()
  fetchUsers()
})
</script>

<style scoped>
.filter-card {
  margin-bottom: 16px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 8px;
  margin-right: 8px;
}

.list-card {
  background: #fff;
}

/* 移动端卡片列表的外观与列表间距由 style.css 的「Mobile WeUI Cell 列表」统一提供，
   桌面端隐藏也在那里（.page-container .logs-tab .mobile-cards），
   这里只留日志自己的时间样式。 */

.log-time {
  font-size: 13px;
  color: var(--text-color-secondary);
}

/* 桌面端隐藏卡片、显示表格；移动端反过来 */
.hide-mobile,
.table-card {
  display: none;
}

@media (min-width: 768px) {
  /* 卡片在桌面端隐藏由 style.css 的 .logs-tab 那条统一管（同权重才压得住 flex） */

  .table-card {
    display: block;
  }

  .hide-mobile {
    display: table;
  }
}

@media (max-width: 768px) {
  .filter-form :deep(.el-form-item) {
    width: 100%;
    margin-right: 0;
  }
  
  .filter-form :deep(.el-input),
  .filter-form :deep(.el-date-editor) {
    width: 100% !important;
  }
}

/* 暗色模式 */
html.dark .list-card {
  background: var(--bg-color-secondary);
}
</style>
