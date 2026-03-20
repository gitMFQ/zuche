<template>
  <div class="page-container">
    <el-tabs v-model="activeTab" class="settings-tabs">
      <el-tab-pane label="系统设置" name="system">
        <el-card shadow="never" class="setting-card">
          <template #header>
            <span class="card-title">基本设置</span>
          </template>
          <el-form label-width="80px" size="default">
            <el-form-item label="系统标题">
              <el-input v-model="systemTitle" placeholder="请输入系统标题" style="max-width: 300px" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveSettings">保存设置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>
      <el-tab-pane label="用户管理" name="users">
        <UsersTab />
      </el-tab-pane>
      <el-tab-pane label="订单来源" name="sources">
        <OrderSourcesTab />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import UsersTab from '../components/UsersTab.vue'
import OrderSourcesTab from '../components/OrderSourcesTab.vue'

const route = useRoute()
const router = useRouter()
const activeTab = ref('system')
const systemTitle = ref('租车管理系统')

// 从路由参数获取当前标签
onMounted(() => {
  const tab = route.query.tab as string
  if (tab && ['system', 'users', 'sources'].includes(tab)) {
    activeTab.value = tab
  }
  
  // 加载系统设置
  const savedTitle = localStorage.getItem('systemTitle')
  if (savedTitle) {
    systemTitle.value = savedTitle
  }
})

// 监听标签变化，更新路由参数
watch(activeTab, (val) => {
  router.replace({ query: { tab: val } })
})

function saveSettings() {
  localStorage.setItem('systemTitle', systemTitle.value)
  // 触发自定义事件通知布局更新
  window.dispatchEvent(new CustomEvent('systemTitleChange', { detail: systemTitle.value }))
  ElMessage.success('设置保存成功')
}
</script>

<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
}

.settings-tabs {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

:deep(.el-tabs__header) {
  margin-bottom: 16px;
}

:deep(.el-tabs__item) {
  font-size: 15px;
}
</style>
