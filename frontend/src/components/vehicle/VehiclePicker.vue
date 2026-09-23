<template>
  <div class="vehicle-picker">
    <!-- 搜索栏：只提供关键字输入，回车与按钮都抛 search 事件 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="formModel" size="default">
        <el-form-item>
          <el-input
            :model-value="keyword"
            :placeholder="searchPlaceholder"
            :style="{ width: searchWidth }"
            clearable
            @update:model-value="emit('update:keyword', String($event))"
            @keyup.enter="emit('search')"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="emit('search')">搜索</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 统计卡片：内容由使用方提供，这里只给栅格容器 -->
    <div
      class="stats-cards"
      :class="{ 'keep-columns': !stackStatsOnMobile }"
      :style="{ '--vp-stats-columns': statsColumns }"
    >
      <slot name="stats" />
    </div>

    <!-- 移动端车辆卡片：头部（车牌 + 箭头）统一，中间的业务行由使用方提供 -->
    <div class="mobile-cards">
      <div v-for="vehicle in vehicles" :key="vehicle.id" class="mobile-card" @click="emit('select', vehicle)">
        <div class="mobile-card-header">
          <span class="plate-number" :class="vehicle.is_new_energy ? 'new-energy' : 'fuel'">{{ vehicle.plate_number }}</span>
          <el-icon><i class="weui-icon-outlined-arrow" /></el-icon>
        </div>
        <slot name="card" :vehicle="vehicle" />
      </div>
    </div>

    <!-- PC 端车辆表格：车牌/品牌/记录数/操作四列固定，业务列由使用方插入 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="vehicles" v-loading="loading" stripe class="hide-mobile" style="cursor: pointer" @row-click="onRowClick">
        <el-table-column prop="plate_number" label="车牌" width="120">
          <template #default="{ row }">
            <span class="plate-number" :class="row.is_new_energy ? 'new-energy' : 'fuel'">{{ row.plate_number }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="brand" label="品牌型号" min-width="120">
          <template #default="{ row }">{{ row.brand }} {{ row.model }}</template>
        </el-table-column>
        <slot name="table-columns" />
        <el-table-column label="记录数" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row[countField] || 0 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click.stop="emit('select', row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-pagination
      :current-page="page"
      :page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, prev, pager, next"
      background
      class="pagination"
      @update:current-page="emit('update:page', $event)"
      @update:page-size="emit('update:pageSize', $event)"
      @size-change="emit('reload')"
      @current-change="emit('reload')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 车辆列表（带搜索 / 统计卡 / 分页）的公共骨架。
 *
 * 三个业务 Tab（违章、保养、保险）的车辆视图长得几乎一样：同一套搜索和分页，
 * 差别只在「统计口径」和「每辆车挂的业务字段」，所以这里只收公共的壳，
 * 统计卡内容用 #stats，卡片行用 #card，表格业务列用 #table-columns 各自塞进来，
 * 业务语义不进这个组件。
 *
 * 注意 <el-table-column> 放在使用方的 slot 里是安全的：组件实例树的 parent 由
 * patch 链决定（始终是 el-table），列仍能正常注册并由 el-table 排序。
 */
interface VehicleRow {
  id: string
  plate_number: string
  brand: string
  model: string
  is_new_energy?: number
  /**
   * 各 Tab 自己挂的业务字段（violationCount / latestInsurance …）。
   * 放宽到 any 是因为这些字段由后端 JOIN 出来、形状随 Tab 变化，
   * 各 Tab 在自己的 slot 里直接按业务字段使用。
   */
  [key: string]: any
}

const props = withDefaults(
  defineProps<{
    /** 当前页的车辆数据（已由调用方挂好各自的统计字段） */
    vehicles: VehicleRow[]
    /** 列表加载态 */
    loading: boolean
    /** 搜索关键字 */
    keyword: string
    /** 当前页码 */
    page: number
    /** 每页条数 */
    pageSize: number
    /** 总条数 */
    total: number
    /** 「记录数」列读取的字段名，如 violationCount / maintenanceCount / insuranceCount */
    countField: string
    /** 搜索框宽度，保险页历史上比其它两页宽 20px */
    searchWidth?: string
    /** 搜索框占位文案 */
    searchPlaceholder?: string
    /** 统计卡列数（PC 端） */
    statsColumns?: number
    /** 移动端是否降为两列；保养页历史上不降，默认 true 会改它的布局 */
    stackStatsOnMobile?: boolean
  }>(),
  {
    searchWidth: '130px',
    searchPlaceholder: '车牌/品牌/型号',
    statsColumns: 4,
    stackStatsOnMobile: true
  }
)

const emit = defineEmits<{
  /** 搜索关键字变化 */
  (e: 'update:keyword', value: string): void
  /** 翻页（页码变化） */
  (e: 'update:page', value: number): void
  /** 每页条数变化 */
  (e: 'update:pageSize', value: number): void
  /** 点了搜索按钮或回车 */
  (e: 'search'): void
  /** 需要重新拉列表（翻页 / 改每页条数） */
  (e: 'reload'): void
  /** 选中某辆车 */
  (e: 'select', vehicle: VehicleRow): void
}>()

const formModel = computed(() => ({ keyword: props.keyword }))

function onRowClick(row: VehicleRow) {
  emit('select', row)
}
</script>

<style scoped>
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

.stats-cards {
  display: grid;
  grid-template-columns: repeat(var(--vp-stats-columns, 4), 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

/*
 * 统计卡的 DOM 由 #stats slot 的使用方提供，父组件的 scoped 选择器打不到
 * （slot 内容带的是使用方的 data-v），所以这里统一用 :deep() 兜住。
 */
.stats-cards :deep(.stat-card) {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stats-cards :deep(.stat-card.warning) {
  border-left: 3px solid var(--sk-color-warning);
}

.stats-cards :deep(.stat-card.primary) {
  border-left: 3px solid var(--primary-color);
}

.stats-cards :deep(.stat-card.success) {
  border-left: 3px solid var(--sk-color-success);
}

.stats-cards :deep(.stat-card.danger) {
  border-left: 3px solid var(--sk-color-danger);
}

.stats-cards :deep(.stat-value) {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.stats-cards :deep(.stat-label) {
  font-size: 12px;
  color: var(--sk-color-info);
  margin-top: 4px;
}

@media (max-width: 767px) {
  .stats-cards:not(.keep-columns) {
    grid-template-columns: repeat(2, 1fr);
  }

  .stats-cards:not(.keep-columns) :deep(.stat-value) {
    font-size: 16px;
  }
}

/* 卡片的外壳 / 行 / 操作区由 style.css 的「Mobile WeUI Cell 列表」统一提供 */

/* 整张卡片可点（进车辆详情）。触屏用不到，窄窗口的桌面浏览器会用到 */
.mobile-card {
  cursor: pointer;
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

  .pagination {
    justify-content: flex-end;
  }
}

.pagination {
  margin-top: 16px;
  justify-content: center;
  flex-wrap: wrap;
  row-gap: 8px;
}

/* 暗色模式 */
html.dark .stats-cards :deep(.stat-card) {
  background: var(--bg-color-secondary);
  box-shadow: 0 1px 3px var(--shadow-color);
}

html.dark .stats-cards :deep(.stat-value) {
  color: var(--text-color);
}

html.dark .stats-cards :deep(.stat-label) {
  color: var(--text-color-secondary);
}
</style>
