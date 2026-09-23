<template>
  <div class="data-state">
    <!-- 加载中 -->
    <div v-if="loading" class="data-state-loading">
      <el-skeleton v-if="skeleton" :rows="skeletonRows" animated />
      <div v-else class="data-state-spinner">
        <el-icon class="is-loading" :size="24"><i class="weui-icon-outlined-refresh" /></el-icon>
        <span>{{ loadingText }}</span>
      </div>
    </div>

    <!-- 加载失败：给出原因与重试入口，而不是只留一个空表格 -->
    <el-empty v-else-if="error" :image-size="72" class="data-state-empty">
      <template #description>
        <span class="data-state-text">{{ error }}</span>
      </template>
      <el-button type="primary" @click="emit('retry')">重试</el-button>
    </el-empty>

    <!-- 空数据：说明为什么空 + 给一个可执行的下一步 -->
    <el-empty v-else-if="empty" :image-size="72" :description="emptyText" class="data-state-empty">
      <slot name="empty-action" />
    </el-empty>

    <slot v-else />
  </div>
</template>

<script setup lang="ts">

/**
 * 列表页的统一三态：加载中 / 加载失败（带重试）/ 空数据（带主操作）。
 *
 * 改造前列表页只有 `v-loading`，空数据是一张空表格，加载失败只在 console 里
 * 打一行错误、页面上什么反馈都没有。这里把三种状态收敛成一个壳，
 * 各列表页只需要维护 loading / error / empty 三个值。
 */
withDefaults(
  defineProps<{
    /** 是否加载中 */
    loading?: boolean
    /** 加载失败的提示文案，非空即进入错误态 */
    error?: string | null
    /** 是否为空数据（一般传 list.length === 0） */
    empty?: boolean
    /** 空数据文案 */
    emptyText?: string
    /** 加载中是否用骨架屏（表格页更合适） */
    skeleton?: boolean
    skeletonRows?: number
    loadingText?: string
  }>(),
  {
    loading: false,
    error: null,
    empty: false,
    emptyText: '暂无数据',
    skeleton: false,
    skeletonRows: 5,
    loadingText: '加载中…'
  }
)

const emit = defineEmits<{ retry: [] }>()
</script>

<style scoped>
.data-state-loading {
  padding: 8px 0;
}

.data-state-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 0;
  color: var(--text-color-secondary);
  font-size: 14px;
}

.data-state-empty {
  padding: 24px 0;
}

.data-state-text {
  color: var(--text-color-secondary);
  font-size: 14px;
}
</style>
