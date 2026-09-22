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
  /* WeUI navbar：56px 高、17px 字、选中整项背景高亮，不用 Element 下划线 */
  .vehicle-tabs :deep(.el-tabs__header) {
    height: 56px;
    margin: 0 0 8px;
    overflow-x: auto;
  }

  .vehicle-tabs :deep(.el-tabs__nav-wrap) {
    overflow-x: auto;
  }

  .vehicle-tabs :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
    background: var(--m-line);
    transform: scaleY(0.5);
    transform-origin: 0 0;
  }

  .vehicle-tabs :deep(.el-tabs__nav) {
    min-width: max-content;
  }

  .vehicle-tabs :deep(.el-tabs__item) {
    height: 56px;
    padding: 0 16px;
    font-size: 17px;
    color: var(--m-fg-1);
  }

  .vehicle-tabs :deep(.el-tabs__item.is-active) {
    color: var(--m-fg-0);
    font-weight: 500;
    background: var(--m-active);
  }

  .vehicle-tabs :deep(.el-tabs__active-bar) {
    display: none;
  }
}

/* 暗色模式 */
html.dark .vehicle-tabs :deep(.el-tabs__header) {
  background: var(--bg-color-secondary);
}
</style>