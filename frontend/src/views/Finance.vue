<template>
  <div class="page-container finance-page">
    <el-tabs v-model="activeTab" type="border-card" class="finance-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="资金流水" name="funds" lazy>
        <FundsTab v-if="loaded.funds" />
      </el-tab-pane>
      <el-tab-pane label="车主结算" name="settlement" lazy>
        <SettlementTab v-if="loaded.settlement" />
      </el-tab-pane>
      <el-tab-pane label="车辆费用" name="vehicle-expenses" lazy>
        <VehicleExpensesTab v-if="loaded['vehicle-expenses']" />
      </el-tab-pane>
      <el-tab-pane label="运营开支" name="operating-expenses" lazy>
        <OperatingExpensesTab v-if="loaded['operating-expenses']" />
      </el-tab-pane>
      <el-tab-pane label="车主 / 合伙人" name="owners" lazy>
        <OwnersTab v-if="loaded.owners" />
      </el-tab-pane>
      <el-tab-pane label="报表" name="reports" lazy>
        <ReportsTab v-if="loaded.reports" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
/**
 * 财务模块的外壳。
 *
 * 照 Vehicles.vue 的范式：薄壳 + 多个 Tab 组件 + ?tab= 深链，这样
 * 财务的 6 块内容可以各自独立加载、独立刷新，不会在进首页时一次性打 6 个接口。
 *
 * `loaded` 是「这个页签是否已经挂载过」的开关，配合 el-tab-pane 的 lazy 使用：
 * lazy 只保证首次切换时才渲染，切回去时靠 v-if 保持已加载状态（不重新拉数据）。
 */
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FundsTab from '../components/finance/FundsTab.vue'
import SettlementTab from '../components/finance/SettlementTab.vue'
import VehicleExpensesTab from '../components/finance/VehicleExpensesTab.vue'
import OperatingExpensesTab from '../components/finance/OperatingExpensesTab.vue'
import OwnersTab from '../components/finance/OwnersTab.vue'
import ReportsTab from '../components/finance/ReportsTab.vue'

type TabName = 'funds' | 'settlement' | 'vehicle-expenses' | 'operating-expenses' | 'owners' | 'reports'

const VALID_TABS: TabName[] = ['funds', 'settlement', 'vehicle-expenses', 'operating-expenses', 'owners', 'reports']

const route = useRoute()
const router = useRouter()

const activeTab = ref<TabName>('funds')
const loaded = reactive<Record<TabName, boolean>>({
  funds: false,
  settlement: false,
  'vehicle-expenses': false,
  'operating-expenses': false,
  owners: false,
  reports: false
})

function activate(tab: TabName): void {
  activeTab.value = tab
  loaded[tab] = true
}

/** 深链里的 tab 非法时回落默认值，避免刷新后停在空白页签 */
function readTabFromQuery(): TabName {
  const raw = String(route.query.tab ?? '')
  return (VALID_TABS as string[]).includes(raw) ? (raw as TabName) : 'funds'
}

function handleTabChange(name: string | number): void {
  const tab = name as TabName
  loaded[tab] = true
  // 把页签写进 URL，刷新/分享后能回到同一个位置
  router.replace({ query: { ...route.query, tab } })
}

onMounted(() => {
  activate(readTabFromQuery())
})

// 浏览器前进/后退时同步页签
watch(
  () => route.query.tab,
  () => {
    const tab = readTabFromQuery()
    if (tab !== activeTab.value) activate(tab)
  }
)
</script>

<style scoped>
@media (max-width: 767px) {
  /* WeUI navbar：财务 tab 多，允许横向滚动，不把标签压缩成看不清的 12px */
  .finance-tabs :deep(.el-tabs__header) {
    height: 56px;
    margin: 0 0 8px;
    overflow-x: auto;
    background: var(--m-bg-cell);
  }

  .finance-tabs :deep(.el-tabs__nav-wrap) {
    overflow-x: auto;
  }

  .finance-tabs :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
    background: var(--m-line);
    transform: scaleY(0.5);
    transform-origin: 0 0;
  }

  .finance-tabs :deep(.el-tabs__nav) {
    min-width: max-content;
  }

  .finance-tabs :deep(.el-tabs__item) {
    height: 56px;
    padding: 0 16px;
    font-size: 17px;
    color: var(--m-fg-1);
  }

  .finance-tabs :deep(.el-tabs__item.is-active) {
    color: var(--m-fg-0);
    font-weight: 500;
    background: var(--m-active);
  }

  .finance-tabs :deep(.el-tabs__active-bar) {
    display: none;
  }

  .finance-tabs :deep(.el-tabs__content) {
    padding: 0;
  }
}
</style>
