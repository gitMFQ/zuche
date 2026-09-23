<template>
  <nav class="m-tabbar" aria-label="主导航">
    <router-link
      v-for="tab in TABS"
      :key="tab.path"
      :to="tab.path"
      class="m-tabbar__item"
      :class="{ 'is-active': activeTab === tab.path }"
      :aria-current="activeTab === tab.path ? 'page' : undefined"
    >
      <el-icon class="m-tabbar__icon" :size="24">
        <component :is="tab.icon" v-if="tab.icon" />
        <i v-else :class="tab.weuiIcon" />
      </el-icon>
      <span class="m-tabbar__text">{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useRoute } from 'vue-router'
import { DataAnalysis, Money, Van } from '@element-plus/icons-vue'
import { matchTabPath, type TabPath } from '../utils/nav'

/**
 * 移动端底部标签栏（WeUI tabbar：高 60px、图标 24px、文字 10px、选中着色）。
 *
 * 只在 <768px 渲染，由 MainLayout 用 v-if="isMobile" 控制；桌面端仍然是左侧栏。
 * 「设置」不在这里 —— tabbar 放 5 项已经是上限，设置收进了顶部用户下拉菜单。
 */
/**
 * 图标有两种来源：WeUI 图标集里有对应的用 class（见 AGENTS.md「移动端图标」），
 * 没有对应的（总览/车辆/财务）继续用 Element Plus 图标组件 —— 混搭是 WeUI 图标集
 * 覆盖不到这些语义导致的，不是遗漏。
 */
const TABS: { path: TabPath; label: string; icon?: Component; weuiIcon?: string }[] = [
  { path: '/dashboard', label: '总览', icon: DataAnalysis },
  { path: '/orders', label: '订单', weuiIcon: 'weui-icon-outlined-note' },
  { path: '/vehicles', label: '车辆', icon: Van },
  { path: '/finance', label: '财务', icon: Money },
  { path: '/customers', label: '客户', weuiIcon: 'weui-icon-outlined-contacts' }
]

const route = useRoute()

// 前缀匹配，见 utils/nav.ts：/orders/import 与 /orders/:id 都要让「订单」亮起来
const activeTab = computed(() => matchTabPath(route.path))
</script>

<style scoped>
.m-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 900;
  display: flex;
  background-color: var(--m-bg-sub);
  /* iPhone 底部横条：不加的话最后一项会被横条压住 */
  padding-bottom: env(safe-area-inset-bottom);
}

/* 顶部 0.5px 边线（1px 再 scaleY(.5)，WeUI 的 hairline 做法） */
.m-tabbar::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 1px;
  background-color: var(--m-line);
  transform: scaleY(0.5);
  transform-origin: 0 0;
  pointer-events: none;
}

.m-tabbar__item {
  flex: 1 1 0;
  min-width: 0;
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--m-fg-0);
  text-decoration: none;
  /* 触屏点按整项变色。不用 :hover：手指点一下 hover 会一直挂着 */
  transition: background-color 0.15s ease;
}

.m-tabbar__item:active {
  background-color: var(--m-active);
}

.m-tabbar__item.is-active {
  color: var(--m-brand);
}

.m-tabbar__text {
  font-size: 10px;
  line-height: 1.4;
}
</style>
