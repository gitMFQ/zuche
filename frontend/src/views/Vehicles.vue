<template>
  <div class="page-container">
    <el-tabs v-model="activeTab" type="border-card" class="vehicle-tabs">
      <el-tab-pane label="车辆列表" name="vehicles">
        <VehiclesTab />
      </el-tab-pane>
      <el-tab-pane label="保养记录" name="maintenance">
        <MaintenanceTab />
      </el-tab-pane>
      <el-tab-pane label="保险记录" name="insurance">
        <InsuranceTab />
      </el-tab-pane>
      <el-tab-pane label="年检证" name="inspection">
        <InspectionTab />
      </el-tab-pane>
      <el-tab-pane label="违章记录" name="violations">
        <ViolationsTab />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import VehiclesTab from '../components/VehiclesTab.vue'
import MaintenanceTab from '../components/MaintenanceTab.vue'
import InsuranceTab from '../components/InsuranceTab.vue'
import InspectionTab from '../components/InspectionTab.vue'
import ViolationsTab from '../components/ViolationsTab.vue'

const route = useRoute()
const activeTab = ref('vehicles')

const validTabs = ['vehicles', 'maintenance', 'insurance', 'inspection', 'violations']

// 支持通过 query 参数指定标签
onMounted(() => {
  const tab = route.query.tab as string
  if (tab && validTabs.includes(tab)) {
    activeTab.value = tab
  }
})

// 监听路由变化
watch(() => route.query.tab, (tab) => {
  if (tab && typeof tab === 'string' && validTabs.includes(tab)) {
    activeTab.value = tab
  }
})
</script>

<style scoped>
/* 容器不设 max-width：与财务页一致，铺满主内容区（约定见 style.css 的 .page-container） */
.vehicle-tabs {
  background: transparent;
  /* 内容已经铺满容器，border-card 那圈 1px 边框就是在页面中间又画了一个框 */
  border: none;
}

.vehicle-tabs :deep(.el-tabs__header) {
  background: var(--bg-color-secondary);
  margin-bottom: 16px;
}

.vehicle-tabs :deep(.el-tabs__content) {
  padding: 0;
}

@media (max-width: 767px) {
  /* 移动端页签统一成客户管理那套：Element 默认的透明底 + 下划线，不再做 56px 白底条
     和「选中整项背景高亮」。只保留横向滚动 —— 5 个页签不能压缩成看不清的小字 */
  .vehicle-tabs :deep(.el-tabs__header) {
    margin: 0 0 12px;
    background: transparent;
  }

  /* 文件末尾那条 html.dark 规则特异性更高，暗色下也要压回透明 */
  html.dark .vehicle-tabs :deep(.el-tabs__header) {
    background: transparent;
  }

  .vehicle-tabs :deep(.el-tabs__nav-wrap) {
    overflow-x: auto;
  }

  .vehicle-tabs :deep(.el-tabs__nav) {
    min-width: max-content;
  }
}

/* 暗色模式 */
html.dark .vehicle-tabs :deep(.el-tabs__header) {
  background: var(--bg-color-secondary);
}
</style>