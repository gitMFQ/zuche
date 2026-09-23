<template>
  <section class="mobile-filter-panel">
    <button
      type="button"
      class="mobile-filter-panel__header"
      :aria-expanded="expanded"
      :aria-controls="contentId"
      @click="toggle"
    >
      <span class="mobile-filter-panel__title">
        <el-icon><i class="weui-icon-outlined-search" /></el-icon>
        {{ props.title }}
      </span>
      <el-icon class="mobile-filter-panel__arrow" :class="{ 'is-expanded': expanded }">
        <i class="weui-icon-outlined-arrow weui-icon-arrow--up" />
      </el-icon>
    </button>
    <div
      :id="contentId"
      class="mobile-filter-panel__content"
      :class="{ 'is-expanded': expanded }"
      :aria-hidden="isMobile && !expanded"
    >
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMobile } from '../composables/useMobile'

let nextPanelId = 0

const props = defineProps<{ title: string }>()
const { isMobile } = useMobile()
const expanded = ref(!isMobile.value)
const contentId = `mobile-filter-panel-${++nextPanelId}`

watch(isMobile, (mobile, previousMobile) => {
  if (mobile !== previousMobile) {
    expanded.value = !mobile
  }
})

function toggle(): void {
  expanded.value = !expanded.value
}
</script>
