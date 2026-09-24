<template>
  <nav
    class="m-tabbar"
    :class="{
      'is-floating': userStore.themeSettings.bottomFloating,
      'is-gaussian': userStore.themeSettings.bottomGaussianBlur,
      'is-liquid': userStore.themeSettings.bottomLiquidGlass
    }"
    aria-label="主导航"
  >
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
import { useUserStore } from '../stores/user'
import { DataAnalysis, Money } from '@element-plus/icons-vue'
import CarIcon from './CarIcon.vue'
import { matchTabPath, type TabPath } from '../utils/nav'

/**
 * 移动端底部标签栏（WeUI tabbar：高 60px、图标 24px、文字 10px、选中着色）。
 *
 * 只在 <768px 渲染，由 MainLayout 用 v-if="isMobile" 控制；桌面端仍然是左侧栏。
 * 「设置」不在这里 —— tabbar 放 5 项已经是上限，设置收进了顶部用户下拉菜单。
 */
/**
 * 图标有两种来源：WeUI 图标集里有对应的用 class（见 AGENTS.md「移动端图标」），
 * 没有对应的（总览/财务）继续用 Element Plus 图标组件，车辆用 CarIcon（两套图标库
 * 都没有轿车）—— 混搭是 WeUI 图标集覆盖不到这些语义导致的，不是遗漏。
 */
const TABS: { path: TabPath; label: string; icon?: Component; weuiIcon?: string }[] = [
  { path: '/dashboard', label: '总览', icon: DataAnalysis },
  { path: '/orders', label: '订单', weuiIcon: 'weui-icon-outlined-note' },
  { path: '/vehicles', label: '车辆', icon: CarIcon },
  { path: '/finance', label: '财务', icon: Money },
  { path: '/customers', label: '客户', weuiIcon: 'weui-icon-outlined-contacts' }
]

const route = useRoute()
const userStore = useUserStore()

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
  height: 64px;
  box-sizing: border-box;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: var(--m-bg-sub);
  box-shadow: none;
}

.m-tabbar.is-floating {
  left: 12px;
  right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom));
  border-radius: 20px;
  box-shadow: var(--m-glass-shadow);
}

.m-tabbar.is-gaussian {
  background: var(--m-gaussian-bg);
  border: 1px solid var(--m-line);
}

.m-tabbar.is-liquid {
  background: var(--m-glass-bg);
  border: 1px solid var(--m-glass-border);
}

.m-tabbar.is-gaussian {
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.m-tabbar.is-liquid {
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
}

.m-tabbar__item {
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
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

.m-tabbar__item:focus-visible {
  outline: 2px solid var(--m-brand);
  outline-offset: -4px;
  border-radius: 12px;
}

.m-tabbar__item.is-active {
  color: var(--m-brand);
}

.m-tabbar__text {
  font-size: 10px;
  line-height: 1.4;
}

@supports not ((backdrop-filter: blur(1px))) {
  .m-tabbar.is-gaussian,
  .m-tabbar.is-liquid {
    background: var(--m-glass-fallback-bg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .m-tabbar__item {
    transition: none;
  }
}
</style>
