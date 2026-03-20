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
        <el-icon><Plus /></el-icon> 添加
      </el-button>
    </div>

    <!-- 移动端卡片列表 -->
    <div class="mobile-cards">
      <div v-for="item in tableData" :key="item.id" class="mobile-card">
        <div class="mobile-card-header">
          <span class="customer-name">{{ item.name }}</span>
          <el-tag :type="item.status === 1 ? 'success' : 'danger'" size="small">
            {{ item.status === 1 ? '正常' : '禁用' }}
          </el-tag>
        </div>
        <div class="mobile-card-row">
          <span class="label">手机号</span>
          <span class="value"><a :href="'tel:' + item.phone">{{ item.phone }}</a></span>
        </div>
        <div class="mobile-card-row" v-if="item.id_card">
          <span class="label">身份证</span>
          <span class="value">{{ item.id_card }}</span>
        </div>
        <div class="mobile-card-row" v-if="item.license_expiry">
          <span class="label">驾照到期</span>
          <span class="value">{{ item.license_expiry }}</span>
        </div>
        <div class="mobile-card-actions">
          <el-button type="danger" size="small" @click="addToBlacklist(item)">拉黑</el-button>
          <el-button type="primary" size="small" @click="openDialog(item)">编辑</el-button>
          <el-button size="small" :href="'tel:' + item.phone">拨打</el-button>
        </div>
      </div>
    </div>

    <!-- PC端表格 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" v-loading="loading" stripe class="hide-mobile">
        <el-table-column prop="name" label="姓名" width="80" />
        <el-table-column prop="phone" label="手机号" width="120" />
        <el-table-column prop="id_card" label="身份证号" width="180" />
        <el-table-column prop="license_number" label="驾驶证号" width="180" />
        <el-table-column prop="license_expiry" label="驾照到期" width="100" />
        <el-table-column prop="status" label="状态" width="70">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="180">
          <template #default="{ row }">
            <el-button type="danger" link size="small" @click="addToBlacklist(row)">拉黑</el-button>
            <el-button type="primary" link size="small" @click="openDialog(row)">编辑</el-button>
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
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑客户' : '添加客户'" width="90%" :style="{ maxWidth: '500px' }">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="70px" size="default">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" type="tel" />
        </el-form-item>
        <el-form-item label="身份证">
          <el-input v-model="form.id_card" placeholder="请输入身份证号" />
        </el-form-item>
        <el-form-item label="驾驶证">
          <el-input v-model="form.license_number" placeholder="请输入驾驶证号" />
        </el-form-item>
        <el-form-item label="驾照到期">
          <el-date-picker v-model="form.license_expiry" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="form.address" placeholder="请输入地址" />
        </el-form-item>
        <el-form-item label="状态" v-if="editingId">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">正常</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remarks" type="textarea" :rows="2" placeholder="备注信息" />
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
import { customerApi, blacklistApi } from '../api'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()

const searchForm = reactive({ keyword: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  name: '',
  phone: '',
  id_card: '',
  license_number: '',
  license_expiry: '',
  address: '',
  status: 1,
  remarks: ''
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ]
}

async function loadData() {
  loading.value = true
  try {
    const res: any = await customerApi.getList({ ...searchForm, ...pagination })
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
    Object.assign(form, row)
  } else {
    Object.assign(form, {
      name: '',
      phone: '',
      id_card: '',
      license_number: '',
      license_expiry: '',
      address: '',
      status: 1,
      remarks: ''
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
      res = await customerApi.update(editingId.value, form)
    } else {
      res = await customerApi.create(form)
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
    const res: any = await customerApi.delete(id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadData()
    }
  } catch (error) {
    console.error('删除失败', error)
  }
}

// 添加到黑名单
async function addToBlacklist(customer: any) {
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入拉黑原因', '添加到黑名单', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '如：逾期不还车、损坏车辆等',
      inputValidator: (val) => !!val || '请输入拉黑原因'
    })
    
    const res: any = await blacklistApi.add({
      customer_id: customer.id,
      name: customer.name,
      phone: customer.phone,
      id_card: customer.id_card,
      reason
    })
    
    if (res.success) {
      ElMessage.success('已添加到黑名单')
    }
  } catch (error) {
    // 取消操作
  }
}

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
}

.mobile-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.customer-name {
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

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>