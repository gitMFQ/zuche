<template>
  <component :is="page" />
</template>

<script setup lang="ts">
import { getCurrentInstance, onUnmounted, type Component } from 'vue'
import { registerTabSlot, unregisterTabSlot } from '../utils/tabRequestGate'
import type { TabPath } from '../utils/nav'

/**
 * 滑动轨道上的一个页面槽。
 *
 * 唯一职责：把「这棵子树属于哪个 tab」登记到请求闸门（utils/tabRequestGate），
 * 让拦截器能认出「已渲染但还没被进入」的相邻页并发请求（原理见该文件的注释）。
 * 页面本身按原样渲染，不做任何包装。
 */
const props = defineProps<{ tab: TabPath; page: Component }>()

const instance = getCurrentInstance()
if (instance) registerTabSlot(instance, props.tab)

onUnmounted(() => {
  if (instance) unregisterTabSlot(instance)
})
</script>
