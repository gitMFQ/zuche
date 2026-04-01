<template>
  <div class="page-container">
    <!-- 筛选区域 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="操作类型">
          <el-select v-model="filterForm.action" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="(label, value) in actionTypes" :key="value" :label="label" :value="value" />
          </el-select>
        </el-form-item>
        <el-form-item label="实体类型">
          <el-select v-model="filterForm.entityType" placeholder="全部" clearable style="width: 120px">
            <el-option v-for="(label, value) in entityTypes" :key="value" :label="label" :value="value" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人">
          <el-select v-model="filterForm.userId" placeholder="全部" clearable filterable style="width: 140px">
            <el-option v-for="user in users" :key="user.id" :label="user.name" :value="user.id" />
          </el-select>
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
            <input 
              type="date" 
              v-model="filterForm.date_from" 
              class="native-date-input"
            />
            <span class="date-separator">-</span>
            <input 
              type="date" 
              v-model="filterForm.date_to" 
              class="native-date-input"
            />
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

    <!-- 日志列表 -->
    <el-card shadow="never" class="list-card">
      <el-table :data="logs" v-loading="loading" stripe>
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

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchLogs"
          @current-change="fetchLogs"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { logApi } from '../api'
import dayjs from 'dayjs'

const loading = ref(false)
const isMobile = ref(window.innerWidth < 768)
const logs = ref<any[]>([])
const actionTypes = ref<Record<string, string>>({})
const entityTypes = ref<Record<string, string>>({})
const users = ref<any[]>([])
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

// 获取用户列表
async function fetchUsers() {
  try {
    const res: any = await logApi.getUsers()
    if (res.success) {
      users.value = res.data
    }
  } catch (error) {
    console.error('获取用户列表失败', error)
  }
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
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth < 768
  })
})
</script>

<style scoped>
.page-container {
  max-width: 1400px;
  margin: 0 auto;
}

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

.pagination-container {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .filter-form :deep(.el-form-item) {
    width: 100%;
    margin-right: 0;
  }
  
  .filter-form :deep(.el-select),
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
