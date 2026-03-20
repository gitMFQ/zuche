<template>
  <div class="page-container">
    <el-tabs v-model="activeTab" class="settings-tabs">
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
import UsersTab from '../components/UsersTab.vue'
import OrderSourcesTab from '../components/OrderSourcesTab.vue'

const route = useRoute()
const router = useRouter()
const activeTab = ref('users')

// 从路由参数获取当前标签
onMounted(() => {
  const tab = route.query.tab as string
  if (tab && ['users', 'sources'].includes(tab)) {
    activeTab.value = tab
  }
})

// 监听标签变化，更新路由参数
watch(activeTab, (val) => {
  router.replace({ query: { tab: val } })
})
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
