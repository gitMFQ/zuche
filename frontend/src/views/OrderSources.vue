<template>
  <div class="page-container">
    <!-- 操作栏 -->
    <div class="action-bar">
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon> 添加来源
      </el-button>
    </div>

    <!-- 移动端卡片列表 -->
    <div class="mobile-cards">
      <div v-for="item in tableData" :key="item.id" class="mobile-card">
        <div class="mobile-card-header">
          <span class="name">
            <span class="color-dot" :style="{ background: item.color || '#409EFF' }"></span>
            {{ item.name }}
          </span>
        </div>
        <div class="mobile-card-row">
          <span class="label">服务费</span>
          <span class="value text-warning">{{ item.commission_rate }}%</span>
        </div>
        <div class="mobile-card-row" v-if="item.remarks">
          <span class="label">备注</span>
          <span class="value">{{ item.remarks }}</span>
        </div>
        <div class="mobile-card-actions">
          <el-button type="primary" size="small" @click="openDialog(item)">编辑</el-button>
          <el-popconfirm title="确定删除?" @confirm="handleDelete(item.id)">
            <template #reference>
              <el-button type="danger" size="small">删除</el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>
    </div>

    <!-- PC端表格 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" v-loading="loading" stripe class="hide-mobile">
        <el-table-column prop="name" label="来源名称" min-width="150">
          <template #default="{ row }">
            <span class="color-dot" :style="{ background: row.color || '#409EFF' }"></span>
            {{ row.name }}
          </template>
        </el-table-column>
        <el-table-column prop="commission_rate" label="服务费" width="120">
          <template #default="{ row }">
            <span class="text-warning">{{ row.commission_rate }}%</span>
          </template>
        </el-table-column>
        <el-table-column prop="remarks" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column prop="created_at" label="创建时间" width="100">
          <template #default="{ row }">{{ row.created_at?.slice(0, 10) }}</template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="150">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDialog(row)">编辑</el-button>
            <el-popconfirm title="确定删除?" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button type="danger" link size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑来源' : '添加来源'" width="90%" :style="{ maxWidth: '400px' }">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" size="default">
        <el-form-item label="来源名称" prop="name">
          <el-input v-model="form.name" placeholder="如：携程、神州租车、门店直客等" />
        </el-form-item>
        <el-form-item label="颜色">
          <div class="color-picker-row">
            <el-color-picker v-model="form.color" :predefine="predefineColors" />
            <span class="color-value">{{ form.color }}</span>
          </div>
        </el-form-item>
        <el-form-item label="服务费" prop="commission_rate">
          <el-input-number v-model="form.commission_rate" :min="0" :max="100" :precision="1" style="width: 100%">
            <template #suffix>%</template>
          </el-input-number>
          <div class="form-tip">平台服务费百分比，如 10 表示收取10%</div>
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
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { orderSourceApi } from '../api'

const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  id: '',
  name: '',
  commission_rate: 0,
  color: '#409EFF',
  remarks: ''
})

// 预定义颜色
const predefineColors = [
  '#409EFF',
  '#67C23A',
  '#E6A23C',
  '#F56C6C',
  '#909399',
  '#00D7FF',
  '#9C27B0',
  '#FF9800',
  '#795548',
  '#607D8B'
]

const rules: FormRules = {
  name: [{ required: true, message: '请输入来源名称', trigger: 'blur' }],
  commission_rate: [{ required: true, message: '请输入服务费', trigger: 'blur' }]
}

async function loadData() {
  loading.value = true
  try {
    const res: any = await orderSourceApi.getList()
    if (res.success) {
      tableData.value = res.data
    }
  } catch (error) {
    console.error('加载数据失败', error)
  } finally {
    loading.value = false
  }
}

function openDialog(data?: any) {
  isEdit.value = !!data
  Object.assign(form, {
    id: data?.id || '',
    name: data?.name || '',
    commission_rate: data?.commission_rate || 0,
    color: data?.color || '#409EFF',
    remarks: data?.remarks || ''
  })
  dialogVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    const res: any = isEdit.value 
      ? await orderSourceApi.update(form.id || '', form)
      : await orderSourceApi.create(form)
    
    if (res.success) {
      ElMessage.success(isEdit.value ? '修改成功' : '添加成功')
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
    const res: any = await orderSourceApi.delete(id)
    if (res.success) {
      ElMessage.success('删除成功')
      loadData()
    }
  } catch (error) {
    console.error('删除失败', error)
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
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
}

.name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.color-picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-value {
  font-size: 13px;
  color: #606266;
  font-family: monospace;
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

.mobile-card-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.text-warning {
  color: #E6A23C;
  font-weight: 500;
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

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
