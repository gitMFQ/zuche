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
.page-container {
  max-width: 1200px;
  margin: 0 auto;
}

.vehicle-tabs {
  background: transparent;
}

.vehicle-tabs :deep(.el-tabs__header) {
  background: var(--bg-color-secondary);
  margin-bottom: 16px;
}

.vehicle-tabs :deep(.el-tabs__content) {
  padding: 0;
}

@media (max-width: 767px) {
  .vehicle-tabs :deep(.el-tabs__header) {
    margin-bottom: 12px;
  }
  
  .vehicle-tabs :deep(.el-tabs__item) {
    padding: 0 10px;
    font-size: 12px;
  }
}

/* 暗色模式 */
html.dark .vehicle-tabs :deep(.el-tabs__header) {
  background: var(--bg-color-secondary);
}
</style>