<template>
  <div class="schedule-table-wrap">
    <!-- 移动端与 PC 端都用表格：窄屏由卡片体横向滚动，不要再改成 cell 列表 -->
    <table v-if="schedules.length" class="schedule-table" :class="{ 'full-view-table': fullView }">
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
          <td class="plate-cell schedule-plate" :class="item.is_new_energy ? 'is-new-energy' : 'is-fuel'">{{ item.plate_number }}</td>
          <td class="schedule-platform-cell"><span class="schedule-platform" :style="{ color: item.platform_color || '#909399' }">{{ item.platform || '-' }}</span></td>
          <td class="location-cell">{{ item.location || '-' }}</td>
        </tr>
      </tbody>
    </table>
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
  font-weight: 500;
}

/* 车牌配色与全站一致：新能源绿 / 燃油蓝（同 style.css 的 .plate-number） */
.schedule-plate.is-new-energy {
  color: #00a870;
}

.schedule-plate.is-fuel {
  color: #0066cc;
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
  /* 表格自带底色：导出图片时卡片底不会被一起截取，否则奇数行会漏出白底 */
  background-color: var(--bg-color-secondary);
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
</style>
