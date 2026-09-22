<template>
  <div class="schedule-table-wrap">
    <template v-if="schedules.length">
      <table class="schedule-table" :class="{ 'full-view-table': fullView }">
        <thead>
          <tr>
            <th class="time-col">时间</th>
            <th class="type-col">待</th>
            <th class="plate-col">车牌</th>
            <th class="platform-col">平台</th>
            <th :class="{ 'location-col': fullView }">位置</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in schedules" :key="item.id" @click="emit('row-click', item.id)" class="schedule-row">
            <td class="time-cell">{{ formatScheduleTime(item.schedule_time) }}</td>
            <td class="type-cell"><span class="schedule-type" :class="item.type === '送' ? 'send' : 'receive'">{{ item.type }}</span></td>
            <td class="plate-cell schedule-plate">{{ item.plate_number }}</td>
            <td class="schedule-platform-cell"><span class="schedule-platform" :style="{ color: item.platform_color || '#909399' }">{{ item.platform || '-' }}</span></td>
            <td class="location-cell">{{ item.location || '-' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- 移动端改成 WeUI cell 分组：时间/类型放首行，其余字段每行 44px -->
      <div class="schedule-mobile-list">
        <div
          v-for="item in schedules"
          :key="`mobile-${item.id}`"
          class="schedule-mobile-card"
          @click="emit('row-click', item.id)"
        >
          <div class="schedule-mobile-header">
            <span class="schedule-type" :class="item.type === '送' ? 'send' : 'receive'">{{ item.type }}</span>
            <span class="schedule-mobile-time">{{ formatScheduleTime(item.schedule_time) }}</span>
          </div>
          <div class="schedule-mobile-row">
            <span class="label">车牌</span>
            <span class="value schedule-plate">{{ item.plate_number || '-' }}</span>
          </div>
          <div class="schedule-mobile-row">
            <span class="label">平台</span>
            <span class="value" :style="{ color: item.platform_color || '#909399' }">{{ item.platform || '-' }}</span>
          </div>
          <div class="schedule-mobile-row">
            <span class="label">位置</span>
            <span class="value">{{ item.location || '-' }}</span>
          </div>
        </div>
      </div>
    </template>
    <div v-else class="empty-text">暂无调度安排</div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'

defineProps<{
  schedules: any[]
  /** 完整视图（对话框内）走 table-layout: fixed，主页面为紧凑视图 */
  fullView?: boolean
}>()

const emit = defineEmits<{
  (e: 'row-click', orderId: string): void
}>()

function formatScheduleTime(date: string) {
  return dayjs(date).format('MM-DD HH:mm')
}
</script>

<style scoped>
.empty-text {
  text-align: center;
  color: var(--sk-color-info);
  padding: 20px;
  font-size: 14px;
}

.schedule-table {
  border-collapse: collapse;
  font-size: 13px;
  width: 100%;
  margin: 0;
  border: 1px solid #dcdfe6;
}

@media (min-width: 768px) {
  .schedule-table {
    font-size: 14px;
  }
}

.schedule-table th {
  background-color: #FFE4B5;
  color: #333;
  font-weight: 700;
  padding: 8px 6px;
  text-align: center;
  white-space: nowrap;
  border: 1px solid #dcdfe6;
}

.schedule-table th.platform-col {
  max-width: 50px;
  overflow: hidden;
}

.schedule-table th.time-col,
.schedule-table td.time-cell {
  width: 65px;
  min-width: 65px;
}

.schedule-table th.type-col,
.schedule-table td.type-cell {
  width: 30px;
  min-width: 30px;
}

.schedule-table th.plate-col,
.schedule-table td.plate-cell {
  width: 90px;
  min-width: 90px;
}

.schedule-table td.location-cell {
  max-width: 80px;
  white-space: nowrap;
  overflow-x: auto;
}

.schedule-table td.location-cell::-webkit-scrollbar {
  display: none;
}

.schedule-table td.location-cell {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

@media (min-width: 768px) {
  .schedule-table td.location-cell {
    max-width: none;
    overflow: visible;
  }
}

@media (min-width: 768px) {
  .schedule-table th.platform-col {
    max-width: 70px;
  }
}

@media (min-width: 768px) {
  .schedule-table th {
    padding: 10px 12px;
  }
}

.schedule-table td {
  padding: 8px 6px;
  text-align: center;
  vertical-align: middle;
  border-bottom: 1px solid #dcdfe6;
  border-left: 1px solid #dcdfe6;
  border-right: 1px solid #dcdfe6;
  white-space: nowrap;
}

@media (min-width: 768px) {
  .schedule-table td {
    padding: 10px 12px;
  }
}

.schedule-table tr:nth-child(even) {
  background-color: #F5F5F5;
}

.schedule-table tr:hover {
  background-color: #e6f0ff;
  cursor: pointer;
}

.schedule-row {
  transition: background-color 0.2s;
}

.schedule-type {
  font-weight: 600;
}

.schedule-type.send {
  color: #dc3545;
}

.schedule-type.receive {
  color: #28a745;
}

.schedule-plate {
  color: #007bff;
  font-weight: 500;
}

.schedule-platform-cell {
  max-width: 50px;
  white-space: nowrap;
  overflow-x: auto;
}

.schedule-platform-cell::-webkit-scrollbar {
  display: none;
}

.schedule-platform-cell {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

@media (min-width: 768px) {
  .schedule-platform-cell {
    max-width: 70px;
  }
}

.schedule-platform {
  font-weight: 500;
}

/* 完整视图表格样式 */
.full-view-table {
  font-size: 14px;
  table-layout: fixed;
  width: 100%;
}

.full-view-table th,
.full-view-table td {
  padding: 12px;
  white-space: nowrap;
}

.full-view-table th.time-col,
.full-view-table td.time-cell {
  width: 65px;
}

.full-view-table th.type-col,
.full-view-table td.type-cell {
  width: 30px;
}

.full-view-table th.plate-col,
.full-view-table td.plate-cell {
  width: 90px;
}

.full-view-table th.platform-col {
  width: 70px;
}

.full-view-table td.schedule-platform-cell {
  width: 70px;
  overflow-x: auto;
}

.full-view-table td.schedule-platform-cell::-webkit-scrollbar {
  display: none;
}

.full-view-table th.location-col {
  width: 80px;
}

.full-view-table td.location-cell {
  width: 80px;
  overflow-x: auto;
}

.full-view-table td.location-cell::-webkit-scrollbar {
  display: none;
}

@media (min-width: 768px) {
  .full-view-table th.platform-col,
  .full-view-table td.schedule-platform-cell {
    max-width: 100px;
  }

  .full-view-table td.schedule-platform-cell {
    overflow-x: auto;
  }

  .full-view-table th.location-col,
  .full-view-table td.location-cell {
    max-width: 150px;
    overflow-x: auto;
  }
}

/* 调度表格暗色模式 */
html.dark .schedule-table {
  border-color: var(--border-color);
}

html.dark .schedule-table th {
  background-color: var(--hover-bg-color);
  color: var(--text-color);
  border-color: var(--border-color);
}

html.dark .schedule-table td {
  border-color: var(--border-color);
}

html.dark .schedule-table tr:nth-child(even) {
  background-color: var(--bg-color-secondary);
}

html.dark .schedule-table tr:hover {
  background-color: var(--hover-bg-color);
}

html.dark .schedule-plate {
  color: var(--primary-color);
}

.schedule-mobile-list {
  display: none;
}

@media (max-width: 767px) {
  /* 横向表格不再挤压页面，移动端用 cell 列表浏览；完整视图同样适用 */
  .schedule-table {
    display: none;
  }

  .schedule-mobile-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .schedule-mobile-card {
    position: relative;
    background: var(--m-bg-cell);
    color: var(--m-fg-0);
  }

  .schedule-mobile-card::before,
  .schedule-mobile-card::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--m-line);
    transform: scaleY(0.5);
    transform-origin: 0 0;
    pointer-events: none;
  }

  .schedule-mobile-card::before {
    top: 0;
  }

  .schedule-mobile-card::after {
    bottom: 0;
    transform-origin: 0 100%;
  }

  .schedule-mobile-card:active {
    background: var(--m-active);
  }

  .schedule-mobile-header,
  .schedule-mobile-row {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
    padding: 4px 16px;
    font-size: 15px;
    line-height: 1.4;
  }

  .schedule-mobile-row + .schedule-mobile-row::before,
  .schedule-mobile-header + .schedule-mobile-row::before {
    content: '';
    position: absolute;
    left: 16px;
    right: 0;
    top: 0;
    height: 1px;
    background: var(--m-line);
    transform: scaleY(0.5);
    transform-origin: 0 0;
    pointer-events: none;
  }

  .schedule-mobile-header {
    font-weight: 600;
  }

  .schedule-mobile-time {
    color: var(--m-fg-1);
    font-variant-numeric: tabular-nums;
  }

  .schedule-mobile-row .label {
    flex: 0 0 auto;
    color: var(--m-fg-1);
  }

  .schedule-mobile-row .value {
    min-width: 0;
    color: var(--m-fg-0);
    text-align: right;
    word-break: break-word;
  }
}
</style>
