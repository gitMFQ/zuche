<template>
  <div
    ref="rootRef"
    class="tab-swipe"
    :class="{ 'is-floating-tabbar': floatingTabbar }"
    @touchstart.passive="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchCancel"
  >
    <div ref="trackRef" class="tab-swipe__track" :style="trackStyle">
      <div
        v-for="(tab, index) in TABS"
        :key="tab"
        class="tab-swipe__page"
        :inert="index !== activeIndex"
        :aria-hidden="index !== activeIndex ? 'true' : undefined"
      >
        <!-- 只在需要时挂载（当前页与左右相邻页，以及动画路过的页）。
             挂载 ≠ 拉数据：相邻页的请求被 utils/tabRequestGate 拦住，进入后才放行 -->
        <TabSwipeSlot v-if="mountedSlots[index]" :tab="tab" :page="TAB_PAGES[tab]" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 移动端主 tab 的横向滑动容器（<768px，替换主内容区里的 router-view）。
 *
 * 轨道上固定摆 5 个槽（宽度都是容器的 100%），滑动只是整体 translateX ——
 * 位置稳定，不需要「滑过去再把轨道挪回来」那套重排，点 tabbar 时也能直接滑过去。
 *
 * 三条约定：
 *   1. 相邻页在静止时就挂载好（结构已渲染），所以手指一动就能跟手，没有空白帧；
 *      但它们的数据请求被请求闸门拦住，只有真正进入才发（见 utils/tabRequestGate）。
 *   2. 每个槽自己滚（overflow-y: auto），所以各 tab 的滚动位置互不干扰。
 *   3. 点击 tabbar 不做特殊处理：MobileTabbar 照旧 router-link 跳转，
 *      这里监听路由下标变化再补一段滑动动画。
 */
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TAB_PATHS, type TabPath } from '../utils/nav'
import { applyEdgeResistance, neighborIndexes, resolveSwipeTarget } from '../utils/tabSwipe'
import { setActiveTab } from '../utils/tabRequestGate'
import { useTabbarMotion } from '../utils/tabbarMotion'
import TabSwipeSlot from './TabSwipeSlot.vue'

defineProps<{ floatingTabbar?: boolean }>()

const TABS = TAB_PATHS
const COUNT = TABS.length
const { begin: beginTabbarMotion, settle: settleTabbarMotion } = useTabbarMotion()
/** 轨道滑动时长（内联在 trackStyle 上，waitTransition 的超时兜底也用它） */
const DURATION = 280

/**
 * tab 路径 → 页面组件。
 *
 * 与路由表里的懒加载指向同一批文件，Vite 会复用同一个 chunk。
 * 这里没有从 router 的记录里取组件：RouteRecordNormalized.components 的类型是
 * Component | Lazy<Component>，直接交给 <component :is> 过不了类型检查，
 * 而 Record<TabPath, …> 能保证增删 tab 时两边一起报错。
 */
const TAB_PAGES: Record<TabPath, Component> = {
  '/dashboard': defineAsyncComponent(() => import('../views/Dashboard.vue')),
  '/orders': defineAsyncComponent(() => import('../views/Orders.vue')),
  '/vehicles': defineAsyncComponent(() => import('../views/Vehicles.vue')),
  '/finance': defineAsyncComponent(() => import('../views/Finance.vue')),
  '/customers': defineAsyncComponent(() => import('../views/Customers.vue'))
}

const route = useRoute()
const router = useRouter()

const rootRef = ref<HTMLElement>()
const trackRef = ref<HTMLElement>()

/** 容器宽度（px），只用于算位移阈值；位移本身用百分比，首帧不依赖测量结果 */
const width = ref(0)
/** 轨道的基准位置（tab 下标），拖动时不动、松手后动画到目标 */
const visualIndex = ref(0)
/** 拖动时叠加在基准位置上的像素位移 */
const dragPx = ref(0)
const dragging = ref(false)
const animating = ref(false)
const transitionOn = ref(false)

const routeIndex = computed(() => (TABS as readonly string[]).indexOf(route.path))
/** 当前路由对应的 tab 下标；离开 tab 路由的瞬间回落到视觉位置，避免闪一下 */
const activeIndex = computed(() => (routeIndex.value >= 0 ? routeIndex.value : visualIndex.value))

/** 已挂载的槽位（挂载 ≠ 拉数据） */
const mountedSlots = ref<boolean[]>(new Array(COUNT).fill(false))

function ensureMounted(index: number): void {
  if (index < 0 || index >= COUNT || mountedSlots.value[index]) return
  mountedSlots.value[index] = true
}

/** 当前页 ± 1 */
function ensureAround(index: number): void {
  for (const i of neighborIndexes(index, COUNT)) ensureMounted(i)
}

/** 动画要路过的所有页（点 tabbar 跳 2 格以上时，中间那页也得在） */
function ensureRange(from: number, to: number): void {
  const lo = Math.max(0, Math.min(from, to))
  const hi = Math.min(COUNT - 1, Math.max(from, to))
  for (let i = lo; i <= hi; i++) ensureMounted(i)
}

const trackStyle = computed(() => ({
  // left 的百分比相对 tab-swipe 容器宽度（= 单页宽度）计算，不建立 transform 层叠上下文，
  // 让页面内 dialog/drawer 的 fixed overlay 仍相对视口定位。
  left: `calc(${-visualIndex.value * 100}% + ${dragPx.value}px)`,
  transition: transitionOn.value ? `left ${DURATION}ms cubic-bezier(0.22, 0.61, 0.36, 1)` : 'none'
}))

// ---------------- 手势 ----------------

let startX = 0
let startY = 0
let lastX = 0
let lastTime = 0
let velocityX = 0
let decided: 'none' | 'horizontal' | 'vertical' = 'none'

function onTouchStart(event: TouchEvent): void {
  if (animating.value || event.touches.length !== 1) return
  const touch = event.touches[0]
  startX = lastX = touch.clientX
  startY = touch.clientY
  lastTime = Date.now()
  velocityX = 0
  // 弹窗/抽屉/滚轮 sheet 都在主滑动容器的 DOM 子树里，触摸事件会冒泡到这里；
  // 从弹层内部开始的手势必须完全交给弹层，不能再被主 tab 接管。
  decided = isInsideOverlay(event.target) ? 'vertical' : 'none'
  dragging.value = false
  dragPx.value = 0
}

function onTouchMove(event: TouchEvent): void {
  // 多指（第二根手指落下）会让位移算错，直接放弃这次手势
  if (animating.value || decided === 'vertical' || event.touches.length !== 1) return
  const touch = event.touches[0]
  const dx = touch.clientX - startX
  const dy = touch.clientY - startY

  if (decided === 'none') {
    // 先判方向：竖向（页面滚动）以及「手指落在能横向滚动的元素里」（表格、页签条）
    // 都不接管，交给浏览器原生滚动
    if (Math.abs(dx) < 6) return
    if (Math.abs(dx) <= Math.abs(dy) || startedInHorizontalScroller(event.target)) {
      decided = 'vertical'
      return
    }
    decided = 'horizontal'
    dragging.value = true
    beginTabbarMotion()
    ensureAround(visualIndex.value)
  }

  // 到这里才拦默认行为：不拦的话浏览器会把它当成横向滚动/回退手势
  if (event.cancelable) event.preventDefault()

  const now = Date.now()
  const elapsed = now - lastTime
  if (elapsed > 0) velocityX = (touch.clientX - lastX) / elapsed
  lastX = touch.clientX
  lastTime = now

  dragPx.value = applyEdgeResistance(dx, visualIndex.value, COUNT)
}

function onTouchEnd(): void {
  if (!dragging.value) {
    decided = 'none'
    return
  }
  dragging.value = false
  decided = 'none'
  // 手指停住再抬起不算轻扫
  if (Date.now() - lastTime > 100) velocityX = 0

  const target = resolveSwipeTarget({
    index: visualIndex.value,
    deltaX: dragPx.value,
    velocityX,
    width: width.value || rootRef.value?.clientWidth || window.innerWidth,
    count: COUNT
  })
  void settle(target, target !== visualIndex.value)
}

/** 手势被系统取消（来电、系统返回手势等）：只回弹，不切页 */
function onTouchCancel(): void {
  if (!dragging.value) {
    decided = 'none'
    return
  }
  dragging.value = false
  decided = 'none'
  void settle(visualIndex.value, false)
}

/**
 * 触摸是否从弹层内部开始。
 * Element Plus 业务 dialog/drawer 默认就地渲染，滚轮选择器和部分预览组件也可能在
 * 当前页面树中；统一在主滑动容器这一层拦截，避免给几十个弹窗逐个补 stopPropagation。
 */
function isInsideOverlay(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null
  return Boolean(el?.closest('.el-overlay, .el-dialog, .el-drawer, .m-wheel, .el-image-viewer__wrapper, [role="dialog"]'))
}

/** 手指落点是否在「能横向滚动的元素」里（表格横向滚动条、财务的页签条等） */
function startedInHorizontalScroller(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null
  while (el && !el.classList.contains('tab-swipe__page')) {
    // Element Plus 的 nav-wrap/nav-scroll 会在不同版本间互相负责裁剪和滚动，
    // 不能只看当前节点的 scrollWidth；命中页签条就交给它自己的横向滚动。
    if (el.classList.contains('el-tabs__nav-wrap') || el.classList.contains('el-tabs__nav-scroll')) {
      return true
    }
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflowX = getComputedStyle(el).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll') return true
    }
    el = el.parentElement
  }
  return false
}

// ---------------- 动画 ----------------

/**
 * 滑到目标下标；navigate 为真时同时把路由也切过去。
 * 视觉位置先到位、路由随后跟上，所以中间不会出现回弹或跳帧。
 */
async function settle(target: number, navigate: boolean): Promise<void> {
  const from = visualIndex.value
  if (target === from && dragPx.value === 0) return

  animating.value = true
  beginTabbarMotion()
  ensureRange(from, target)
  transitionOn.value = true
  visualIndex.value = target
  dragPx.value = 0
  await waitTransition()
  transitionOn.value = false

  if (navigate) {
    try {
      await router.push(TABS[target])
    } catch {
      // 路由守卫拦截（权限不足等）不往上抛，下面统一把视觉位置拉回真实路由
    }
  }

  visualIndex.value = activeIndex.value
  dragPx.value = 0
  animating.value = false
  settleTabbarMotion()
}

/** 等轨道滑完；transitionend 不来的情况（元素被卸载、属性没变）用超时兜底 */
function waitTransition(): Promise<void> {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return Promise.resolve()
  const el = trackRef.value
  if (!el) return Promise.resolve()

  return new Promise<void>((resolve) => {
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      el.removeEventListener('transitionend', onEnd)
      window.clearTimeout(timer)
      resolve()
    }
    const onEnd = (event: TransitionEvent): void => {
      if (event.target === el && event.propertyName === 'left') finish()
    }
    el.addEventListener('transitionend', onEnd)
    const timer = window.setTimeout(finish, DURATION + 150)
  })
}

// ---------------- 路由联动 ----------------

// 点 tabbar / 浏览器前进后退 / 滑动落页：路由先变，这里补一段滑动
watch(routeIndex, (to, from) => {
  if (to < 0 || to === from) return
  // 路由变了就等于「已经进入这个 tab」：放行它被挂住的请求
  setActiveTab(TABS[to])
  ensureAround(to)
  if (animating.value) {
    // 滑动或动画进行中路由又变了（快速连点）：直接对齐，不叠加第二段动画
    visualIndex.value = to
    dragPx.value = 0
    return
  }
  void settle(to, false)
})

// ---------------- 生命周期 ----------------

function measure(): void {
  width.value = rootRef.value?.clientWidth ?? 0
}

const initialIndex = routeIndex.value >= 0 ? routeIndex.value : 0
visualIndex.value = initialIndex
// 必须在子组件挂载前告诉闸门「谁才是激活页」，否则激活页自己的首个请求会被误挂起
setActiveTab(TABS[initialIndex])
ensureAround(initialIndex)

onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
  setActiveTab('')
})
</script>

<style scoped>
.tab-swipe {
  position: relative;
  height: 100%;
  overflow: hidden;
  /* 纵向交给页面槽原生滚动，横向由本组件的 JS 手势接管，避免浏览器历史手势抢走 */
  touch-action: pan-y;
}

.tab-swipe__track {
  position: relative;
  display: flex;
  height: 100%;
}

/* EP 页签的实际溢出节点在 nav-scroll；让它能横向滚动，并优先保留原生滚动。 */
.tab-swipe :deep(.el-tabs__nav-wrap),
.tab-swipe :deep(.el-tabs__nav-scroll) {
  touch-action: pan-x;
}

.tab-swipe :deep(.el-tabs__nav-scroll) {
  overflow-x: auto;
}

/* 每个槽自己滚：各 tab 的滚动位置互不干扰，内容也能滚到顶栏/底栏下面 */
.tab-swipe__page {
  flex: 0 0 100%;
  height: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  /* 顶栏 56px + 16px 间距；底部 64px tabbar + 安全区（与 MainLayout 的 .main 对齐） */
  padding: 72px 16px calc(76px + env(safe-area-inset-bottom));
}

/* 悬浮 tabbar 比贴底多留 16px（与 MainLayout 的 .has-floating-tabbar 一致） */
.tab-swipe.is-floating-tabbar .tab-swipe__page {
  padding-bottom: calc(92px + env(safe-area-inset-bottom));
}

@media (prefers-reduced-motion: reduce) {
  .tab-swipe__track {
    transition: none !important;
  }
}
</style>
