<template>
  <div class="gantt">
    <div ref="containerRef" class="gantt-container" :class="{ 'full-view': fullView }">
      <div class="gantt-grid" v-if="vehicles.length">
        <!-- 表头行 -->
        <div class="gantt-header-row">
          <div class="gantt-header-cell gantt-header-plate">车牌</div>
          <div v-for="dateInfo in columns" :key="dateInfo.dateKey"
               class="gantt-header-cell gantt-header-date"
               :class="{ 'is-today': dateInfo.isToday, 'is-weekend': dateInfo.isWeekend }">
            <div class="date-text">{{ dateInfo.dateStr }}</div>
            <div class="week-text">{{ dateInfo.weekStr }}</div>
          </div>
        </div>

        <!-- 数据行：一辆车一行，窗口内没订单也要占位 -->
        <div v-for="vehicle in vehicles" :key="vehicle.plate_number" class="gantt-row">
          <div class="gantt-cell-plate"
               @click="emit('vehicle-click', vehicle.plate_number)"
               @mouseenter="showTooltip"
               @mousemove="moveTooltip"
               @mouseleave="hideTooltip"
               :data-tooltip="getVehicleTooltip(vehicle)"
               style="cursor: pointer;">
            <div class="plate-number" :class="vehicle.is_new_energy ? 'new-energy' : 'fuel'">{{ vehicle.plate_number }}</div>
          </div>

          <!-- 日期单元格（背景） -->
          <div v-for="dateInfo in columns" :key="dateInfo.dateKey"
               class="gantt-cell"
               :class="{ 'is-today': dateInfo.isToday, 'is-weekend': dateInfo.isWeekend }">
          </div>

          <!-- 订单占用块 -->
          <div v-for="order in orders[vehicle.plate_number] || []" :key="order.id"
               class="gantt-occupation"
               :style="getOccupationStyle(order)"
               @click="emit('order-click', order)"
               @mouseenter="showTooltip"
               @mousemove="moveTooltip"
               @mouseleave="hideTooltip"
               :data-tooltip="getOccupationTooltip(order)">
            <span class="occupation-text">{{ getOccupationText(order) }}</span>
          </div>
        </div>
      </div>
      <div v-else class="empty-text">暂无车辆数据</div>
    </div>

    <!-- 自定义跟随鼠标的 tooltip -->
    <div v-if="tooltipVisible" class="custom-tooltip" :style="{ left: tooltipPosition.left + 'px', top: tooltipPosition.top + 'px' }">
      <div class="custom-tooltip-content">{{ tooltipContent }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'

interface Vehicle {
  plate_number: string
  brand?: string | null
  model?: string | null
  mileage?: number | null
  is_new_energy?: number | null
  seats?: number | null
  daily_rate?: number | null
  status?: string | null
}

const props = withDefaults(defineProps<{
  /** 全部车辆，一辆一行（窗口内无订单的车也要列出） */
  vehicles: Vehicle[]
  /** 按车牌分组的订单占用 */
  orders: Record<string, any[]>
  /** 窗口首日 YYYY-MM-DD */
  startDate: string
  /** 窗口天数，默认 91 天 */
  days?: number
  /** 完整视图（对话框内）用更高的 max-height，主页面为紧凑视图 */
  fullView?: boolean
}>(), {
  days: 91,
  fullView: false
})

const emit = defineEmits<{
  (e: 'order-click', order: any): void
  (e: 'vehicle-click', plateNumber: string): void
}>()

const containerRef = ref<HTMLElement | null>(null)

// 自定义 Tooltip 状态
const tooltipVisible = ref(false)
const tooltipContent = ref('')
const tooltipPosition = ref({ left: 0, top: 0 })
const isTouchDevice = ref(false)

// 单元格宽度与车牌列宽度，需与样式里的 .gantt-cell / .gantt-cell-plate 保持一致
const CELL_WIDTH = 40
const PLATE_WIDTH = 90
const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

// 日期列完全由窗口首日 + 天数决定：切到其他时间段时，父组件换 startDate 即可
const columns = computed(() => {
  const start = dayjs(props.startDate).startOf('day')
  const todayKey = dayjs().format('YYYY-MM-DD')

  return Array.from({ length: props.days }, (_, index) => {
    const date = start.add(index, 'day')
    const dayOfWeek = date.day()
    return {
      dateKey: date.format('YYYY-MM-DD'),
      dateStr: `${date.month() + 1}/${date.date()}`,
      weekStr: WEEK_LABELS[dayOfWeek],
      isToday: date.format('YYYY-MM-DD') === todayKey,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6
    }
  })
})

// 自定义 tooltip（触摸设备不显示）
function showTooltip(event: MouseEvent) {
  if (isTouchDevice.value) return

  const target = event.currentTarget as HTMLElement
  const content = target.getAttribute('data-tooltip')
  if (content) {
    tooltipContent.value = content
    tooltipPosition.value = {
      left: event.clientX + 10,
      top: event.clientY + 10
    }
    tooltipVisible.value = true
  }
}

function moveTooltip(event: MouseEvent) {
  if (isTouchDevice.value) return
  tooltipPosition.value = {
    left: event.clientX + 10,
    top: event.clientY + 10
  }
}

function hideTooltip() {
  if (isTouchDevice.value) return
  tooltipVisible.value = false
}

// 把某一列滚到「车牌列右边第一个位置」。
// 车牌列是 sticky 的，永远盖住视口左侧 PLATE_WIDTH 像素，
// 目标列必须落在 scrollLeft + PLATE_WIDTH 之后，否则会被车牌列压在下面看不见
function scrollToColumn(index: number) {
  const container = containerRef.value
  if (!container) return
  container.scrollLeft = Math.max(0, index * CELL_WIDTH - 10)
}

// 定位到今天；今天不在当前窗口内时定位到窗口首日
function scrollToToday() {
  const index = columns.value.findIndex((column) => column.isToday)
  scrollToColumn(index < 0 ? 0 : index)
}

// 获取车辆信息 tooltip
function getVehicleTooltip(vehicle: Vehicle): string {
  const lines = [
    `车牌：${vehicle.plate_number}`,
    `车型：${vehicle.brand || ''} ${vehicle.model || ''}`.trim(),
    `能源类型：${vehicle.is_new_energy ? '新能源' : '燃油车'}`,
    `当前订单数：${props.orders[vehicle.plate_number]?.length || 0}`
  ]
  return lines.filter(line => line).join('\n')
}

// 计算占用块样式（列索引相对窗口首日，窗口可以停在任何时间段）
function getOccupationStyle(order: any): Record<string, string> {
  const base = dayjs(props.startDate).startOf('day').valueOf()

  const startDate = new Date(order.startDateTime)
  const endDate = new Date(order.endDateTime)

  // 转换为列索引（相对窗口首日）
  let startIdx = Math.floor((startDate.getTime() - base) / (1000 * 60 * 60 * 24))
  let endIdx = Math.floor((endDate.getTime() - base) / (1000 * 60 * 60 * 24))

  // 整段都在窗口外，直接不画（窗口可以停在任何时间段，不能像以前那样夹到边界上）
  if (endIdx < 0 || startIdx >= props.days) {
    return { display: 'none' }
  }

  // 限制在可见范围内
  if (startIdx < 0) startIdx = 0
  if (endIdx >= props.days) endIdx = props.days - 1

  if (startIdx > endIdx) {
    return { display: 'none' }
  }

  // 计算时间偏移（小时）
  const startHour = startDate.getHours() + startDate.getMinutes() / 60
  const endHour = endDate.getHours() + endDate.getMinutes() / 60

  // 计算 left 位置（相对于行的左侧）
  const left = PLATE_WIDTH + startIdx * CELL_WIDTH + (startHour / 24) * CELL_WIDTH

  // 计算宽度
  const right = PLATE_WIDTH + (endIdx + 1) * CELL_WIDTH - ((24 - endHour) / 24) * CELL_WIDTH
  const width = right - left

  // 使用订单来源的颜色作为背景色
  const backgroundColor = order.platform_color || '#0071e3'

  return {
    left: `${left}px`,
    width: `${Math.max(width, 40)}px`,
    backgroundColor: backgroundColor
  }
}

// 获取占用文字
function getOccupationText(order: any): string {
  const start = dayjs(order.startDateTime).format('MM/DD HH:mm')
  const end = dayjs(order.endDateTime).format('MM/DD HH:mm')
  return `${start}-${end}`
}

// 获取悬停提示内容
function getOccupationTooltip(order: any): string {
  const lines = [
    `订单号：${order.order_no || '-'}`,
    `客户：${order.name || '-'}`,
    `电话：${order.phone || '-'}`,
    `取车：${dayjs(order.startDateTime).format('MM-DD HH:mm')}`,
    `还车：${dayjs(order.endDateTime).format('MM-DD HH:mm')}`,
    `平台：${order.source_name || '线下'}`,
    `金额：¥${order.rmb || 0}`
  ]
  return lines.join('\n')
}

onMounted(() => {
  isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
})

defineExpose({ scrollToToday })
</script>

<style scoped>
.empty-text {
  text-align: center;
  color: var(--sk-color-info);
  padding: 20px;
  font-size: 14px;
}

.gantt-container {
  overflow: auto;
  max-height: 600px;
}

.gantt-container.full-view {
  max-height: 800px;
}

.gantt-grid {
  width: max-content;
  font-size: 12px;
}

/* 表头行 */
.gantt-header-row {
  display: flex;
  /* 车辆全列出行数会很多，表头吸顶，纵向滚动时日期始终可见 */
  position: sticky;
  top: 0;
  z-index: 4;
}

.gantt-header-cell {
  background-color: #FFE4B5;
  padding: 4px 2px;
  text-align: center;
  font-weight: 700;
  border: 1px solid #dcdfe6;
  height: 50px;  /* 稍微增加表头高度 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}

.gantt-header-plate {
  position: sticky;
  left: 0;
  z-index: 3;
  width: 90px;
  background-color: #FFE4B5;
  height: 50px;  /* 与表头高度保持一致 */
}

.gantt-header-date {
  width: 40px;
}

.gantt-header-date.is-today {
  background-color: var(--primary-color);
  color: #fff;
}

.gantt-header-date.is-weekend {
  background-color: #FFF0E5;
}

/* 今天且是周末时，今天的样式优先 */
.gantt-header-date.is-today.is-weekend {
  background-color: var(--primary-color);
  color: #fff;
}

.gantt-header-date .date-text {
  font-weight: 600;
  font-size: 11px;
}

.gantt-header-date .week-text {
  font-size: 10px;
  color: #666;
}

.gantt-header-date.is-today .week-text {
  color: rgba(255,255,255,0.8);
}

/* 今天且是周末时，week-text 也要白色 */
.gantt-header-date.is-today.is-weekend .week-text {
  color: rgba(255,255,255,0.8);
}

/* 数据行 */
.gantt-row {
  display: flex;
  position: relative;
  height: 40px;
}

.gantt-cell-plate {
  position: sticky;
  left: 0;
  z-index: 2;
  background-color: #fff;
  width: 90px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #dcdfe6;
  flex-shrink: 0;
}

.gantt-cell-plate .plate-number {
  font-weight: 600;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 3px;
  display: inline-block;
}

.gantt-cell {
  width: 40px;
  height: 40px;
  border: 1px solid #dcdfe6;
  background-color: #fff;
  flex-shrink: 0;
}

.gantt-cell.is-today {
  background-color: #ecf5ff;
}

.gantt-cell.is-weekend {
  background-color: #faf5f0;
}

/* 今天且是周末时，今天的样式优先 */
.gantt-cell.is-today.is-weekend {
  background-color: #ecf5ff;
}

/* 占用块样式 */
.gantt-occupation {
  position: absolute;
  height: 32px;
  top: 4px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  z-index: 1;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.gantt-occupation:hover {
  transform: scaleY(1.1);
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.occupation-text {
  font-size: 11px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 6px 0 8px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 自定义 tooltip 样式 */
.custom-tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 6px;
  padding: 10px 14px;
  color: #fff;
  font-size: 12px;
  line-height: 1.8;
  max-width: 280px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
}

.custom-tooltip-content {
  white-space: pre-wrap;
  word-break: break-all;
}

/* 甘特图暗色模式 */
html.dark .gantt-header-cell {
  background-color: var(--hover-bg-color);
  border-color: var(--border-color);
}

html.dark .gantt-header-plate {
  background-color: var(--hover-bg-color);
  border-color: var(--border-color);
}

html.dark .gantt-header-date.is-weekend {
  background-color: #3a3a3a;
}

html.dark .gantt-header-date.is-today .week-text {
  color: rgba(255,255,255,0.8);
}

html.dark .gantt-cell-plate {
  background-color: var(--bg-color-secondary);
  border-color: var(--border-color);
}

html.dark .gantt-cell {
  background-color: var(--bg-color-secondary);
  border-color: var(--border-color);
}

html.dark .gantt-cell.is-today {
  background-color: #2a3a4a;
}

html.dark .gantt-cell.is-weekend {
  background-color: #3a3a3a;
}

html.dark .plate-number {
  color: var(--text-color);
}

html.dark .gantt-occupation {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

html.dark .gantt-occupation:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.8);
}
</style>
