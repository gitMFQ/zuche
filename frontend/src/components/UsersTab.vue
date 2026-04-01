<template>
  <div class="users-tab">
    <!-- 搜索栏 -->
    <el-form :inline="true" :model="searchForm" size="default" class="search-form">
      <el-form-item>
        <el-input v-model="searchForm.keyword" placeholder="用户名/姓名/手机" clearable @keyup.enter="loadData" style="width: 150px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="loadData">搜索</el-button>
      </el-form-item>
    </el-form>

    <!-- 操作栏 -->
    <div class="action-bar">
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon> 添加
      </el-button>
    </div>

    <!-- 移动端卡片列表 -->
    <div class="mobile-cards">
      <div v-for="item in tableData" :key="item.id" class="mobile-card">
        <div class="mobile-card-header">
          <div class="user-info">
            <span class="user-name">{{ item.name }}</span>
            <el-tag :type="item.role === 'admin' ? 'danger' : 'primary'" size="small">
              {{ item.role === 'admin' ? '管理员' : '员工' }}
            </el-tag>
          </div>
          <el-tag :type="item.status === 1 ? 'success' : 'danger'" size="small">
            {{ item.status === 1 ? '正常' : '禁用' }}
          </el-tag>
        </div>
        <div class="mobile-card-row">
          <span class="label">用户名</span>
          <span class="value">{{ item.username }}</span>
        </div>
        <div class="mobile-card-row" v-if="item.phone">
          <span class="label">手机</span>
          <span class="value"><a :href="'tel:' + item.phone">{{ item.phone }}</a></span>
        </div>
        <div class="mobile-card-row" v-if="item.email">
          <span class="label">邮箱</span>
          <span class="value">{{ item.email }}</span>
        </div>
        <div class="mobile-card-actions">
          <el-button type="primary" size="small" @click="openDialog(item)">编辑</el-button>
          <el-button type="warning" size="small" @click="handleResetPassword(item)">重置密码</el-button>
          <el-popconfirm title="确定删除?" @confirm="handleDelete(item.id)">
            <template #reference>
              <el-button type="danger" size="small">删除</el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>
    </div>

    <!-- PC端表格 -->
    <el-table :data="tableData" v-loading="loading" stripe class="hide-mobile">
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="name" label="姓名" width="100" />
      <el-table-column prop="role" label="角色" width="80">
        <template #default="{ row }">
          <el-tag :type="row.role === 'admin' ? 'danger' : 'primary'" size="small">
            {{ row.role === 'admin' ? '管理员' : '员工' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="手机号" width="120" />
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column prop="status" label="状态" width="70">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '正常' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" fixed="right" width="200">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="openDialog(row)">编辑</el-button>
          <el-button type="warning" link size="small" @click="handleResetPassword(row)">重置密码</el-button>
          <el-popconfirm title="确定删除?" @confirm="handleDelete(row.id)">
            <template #reference>
              <el-button type="danger" link size="small">删除</el-button>
            </template>
          </el-popconfirm>
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

    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑用户' : '添加用户'" width="90%" :style="{ maxWidth: '450px' }">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="70px" size="default">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item label="密码" prop="password" v-if="!editingId">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="管理员" value="admin" />
            <el-option label="员工" value="staff" />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="请输入手机号" type="tel" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="请输入邮箱" type="email" />
        </el-form-item>
        <el-form-item label="状态" v-if="editingId">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">正常</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { userApi } from '../api'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()

const searchForm = reactive({ keyword: '', role: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  username: '',
  password: '',
  name: '',
  role: 'staff',
  phone: '',
  email: '',
  status: 1
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

async function loadData() {
  loading.value = true
  try {
    const res: any = await userApi.getList({ ...searchForm, ...pagination })
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

function openDialog(row?: any) {
  editingId.value = row?.id || ''
  if (row) {
    Object.assign(form, {
      username: row.username,
      password: '',
      name: row.name,
      role: row.role,
      phone: row.phone,
      email: row.email,
      status: row.status
    })
  } else {
    Object.assign(form, {
      username: '',
      password: '',
      name: '',
      role: 'staff',
      phone: '',
      email: '',
      status: 1
    })
  }
  dialogVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    let res: any
    if (editingId.value) {
      res = await userApi.update(editingId.value, form)
    } else {
      res = await userApi.create(form)
    }
    if (res.success) {
      ElMessage.success(editingId.value ? '更新成功' : '创建成功')
      dialogVisible.value = false
      loadData()
    }
  } catch (error) {
    console.error('提交失败', error)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id: string) {
  try {
    const res: any = await userApi.delete(id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadData()
    }
  } catch (error) {
    console.error('删除失败', error)
  }
}

async function handleResetPassword(row: any) {
  try {
    const { value } = await ElMessageBox.prompt('请输入新密码', '重置密码', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /^.{6,}$/,
      inputErrorMessage: '密码长度至少6位'
    })
    const res: any = await userApi.resetPassword(row.id, value)
    if (res.success) {
      ElMessage.success('密码重置成功')
    }
  } catch (error) {
    // 用户取消操作
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.users-tab {
  min-height: 300px;
}

.search-form {
  margin-bottom: 12px;
}

.search-form :deep(.el-form-item) {
  margin-bottom: 0;
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
  background: #f9f9f9;
  border-radius: 8px;
  padding: 12px;
}

.mobile-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.mobile-card-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}

.mobile-card-row .label {
  color: #909399;
}

.mobile-card-row .value {
  color: #303133;
}

.mobile-card-row a {
  color: #409EFF;
  text-decoration: none;
}

.mobile-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #eee;
  flex-wrap: wrap;
}

.hide-mobile {
  display: none;
}

@media (min-width: 768px) {
  .mobile-cards {
    display: none;
  }
  
  .hide-mobile {
    display: table;
  }
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

html.dark .mobile-card-header {
  border-bottom-color: var(--border-color);
}

html.dark .mobile-card-row .label {
  color: var(--text-color-secondary);
}

html.dark .mobile-card-row .value {
  color: var(--text-color);
}

html.dark .mobile-card-actions {
  border-top-color: var(--border-color);
}
</style>
