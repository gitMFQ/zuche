<template>
  <div class="page-container">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm" size="default">
        <el-form-item>
          <el-input v-model="searchForm.keyword" placeholder="姓名/手机/身份证" clearable @keyup.enter="loadData" style="width: 150px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">搜索</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 操作栏 -->
    <div class="action-bar">
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon> 添加黑名单
      </el-button>
    </div>

    <!-- 移动端卡片列表 -->
    <div class="mobile-cards">
      <div v-for="item in tableData" :key="item.id" class="mobile-card">
        <div class="mobile-card-header">
          <span class="name">{{ item.name }}</span>
          <el-tag type="danger" size="small">黑名单</el-tag>
        </div>
        <div class="mobile-card-row">
          <span class="label">手机</span>
          <span class="value"><a :href="'tel:' + item.phone">{{ item.phone }}</a></span>
        </div>
        <div class="mobile-card-row" v-if="item.id_card">
          <span class="label">身份证</span>
          <span class="value">{{ item.id_card }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">原因</span>
          <span class="value reason">{{ item.reason }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">添加时间</span>
          <span class="value">{{ item.created_at?.slice(0, 10) }}</span>
        </div>
        <div class="mobile-card-row" v-if="item.operator_name">
          <span class="label">操作人</span>
          <span class="value">{{ item.operator_name }}</span>
        </div>
        <div class="mobile-card-footer">
          <span></span>
          <el-button type="danger" size="small" @click="handleRemove(item)">移除</el-button>
        </div>
      </div>
    </div>

    <!-- PC端表格 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" v-loading="loading" stripe class="hide-mobile">
        <el-table-column prop="name" label="姓名" width="80" />
        <el-table-column prop="phone" label="手机" width="110">
          <template #default="{ row }">
            <a :href="'tel:' + row.phone">{{ row.phone }}</a>
          </template>
        </el-table-column>
        <el-table-column prop="id_card" label="身份证" width="160" />
        <el-table-column prop="reason" label="拉黑原因" min-width="150" show-overflow-tooltip />
        <el-table-column prop="operator_name" label="操作人" width="80" />
        <el-table-column prop="created_at" label="添加时间" width="100">
          <template #default="{ row }">{{ row.created_at?.slice(0, 10) }}</template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="80">
          <template #default="{ row }">
            <el-button type="danger" link size="small" @click="handleRemove(row)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, prev, pager, next"
        background
        class="pagination"
        @size-change="loadData"
        @current-change="loadData"
      />
    </el-card>

    <!-- 添加黑名单对话框 -->
    <el-dialog v-model="dialogVisible" title="添加到黑名单" width="90%" :style="{ maxWidth: '400px' }">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="70px" size="default">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="客户姓名" />
        </el-form-item>
        <el-form-item label="手机" prop="phone">
          <el-input v-model="form.phone" placeholder="手机号" type="tel" />
        </el-form-item>
        <el-form-item label="身份证">
          <el-input v-model="form.id_card" placeholder="身份证号（可选）" />
        </el-form-item>
        <el-form-item label="原因" prop="reason">
          <el-input v-model="form.reason" type="textarea" :rows="2" placeholder="请输入拉黑原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleSubmit" :loading="submitting">确定添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { blacklistApi } from '../api'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()

const searchForm = reactive({ keyword: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  name: '',
  phone: '',
  id_card: '',
  reason: ''
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  reason: [{ required: true, message: '请输入拉黑原因', trigger: 'blur' }]
}

async function loadData() {
  loading.value = true
  try {
    const res: any = await blacklistApi.getList({ ...searchForm, ...pagination })
    if (res.success) {
      tableData.value = res.data.data
      pagination.total = res.data.total
    }
  } catch (error) {
    console.error('加载数据失败', error)
  } finally {
    loading.value = false
  }
}

function openDialog(data?: { name?: string; phone?: string; id_card?: string }) {
  Object.assign(form, {
    name: data?.name || '',
    phone: data?.phone || '',
    id_card: data?.id_card || '',
    reason: ''
  })
  dialogVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    const res: any = await blacklistApi.add(form)
    if (res.success) {
      ElMessage.success('已添加到黑名单')
      dialogVisible.value = false
      loadData()
    }
  } catch (error) {
    console.error('添加失败', error)
  } finally {
    submitting.value = false
  }
}

async function handleRemove(row: any) {
  try {
    await ElMessageBox.confirm(`确定将 ${row.name} 从黑名单移除吗？`, '提示', { type: 'warning' })
    const res: any = await blacklistApi.remove(row.id)
    if (res.success) {
      ElMessage.success('已从黑名单移除')
      loadData()
    }
  } catch (error) {
    // 取消
  }
}

// 暴露方法供外部调用
defineExpose({ openDialog })

onMounted(() => loadData())
</script>

<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
}

.search-card {
  margin-bottom: 12px;
}

.search-card :deep(.el-form-item) {
  margin-bottom: 8px;
}

@media (min-width: 768px) {
  .search-card {
    margin-bottom: 16px;
  }
  
  .search-card :deep(.el-form-item) {
    margin-bottom: 0;
  }
}

.action-bar {
  margin-bottom: 12px;
}

.mobile-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.mobile-card {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-left: 3px solid #F56C6C;
}

.mobile-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.mobile-card-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 13px;
}

.mobile-card-row .label {
  color: #909399;
}

.mobile-card-row .value {
  color: #303133;
}

.mobile-card-row .value.reason {
  color: #F56C6C;
}

.mobile-card-row a {
  color: #409EFF;
  text-decoration: none;
}

.mobile-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.hide-mobile {
  display: none;
}

.table-card {
  display: none;
}

@media (min-width: 768px) {
  .mobile-cards {
    display: none;
  }
  
  .table-card {
    display: block;
  }
  
  .hide-mobile {
    display: table;
  }
}

:deep(a) {
  color: #409EFF;
  text-decoration: none;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

/* 暗色模式 */
html.dark .mobile-card {
  background: var(--bg-color-secondary);
  box-shadow: 0 1px 3px var(--shadow-color);
}

html.dark .name {
  color: var(--text-color);
}

html.dark .mobile-card-row .label {
  color: var(--text-color-secondary);
}

html.dark .mobile-card-row .value {
  color: var(--text-color);
}

html.dark .mobile-card-footer {
  border-top-color: var(--border-color);
}
</style>
