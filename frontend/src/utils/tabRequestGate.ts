import { getCurrentInstance } from 'vue'
import type { TabPath } from './nav'

/**
 * 移动端左右滑动切换主 tab 时，相邻页会先把结构渲染出来（跟手），
 * 但在真正被进入之前**不能**发数据请求（不预加载）。这里就是那道闸门。
 *
 * 难点是「这次请求属于哪个 tab」。页面里的请求几乎都发生在 onMounted 里，而 Vue
 * 调用生命周期钩子前会把当前组件实例设成 currentInstance（见 runtime-core 的
 * injectHook：setCurrentInstance → 调用 hook → reset），所以请求拦截器里
 * getCurrentInstance() 是拿得到的；再顺着 instance.parent 往上找，就能找到
 * TabSwipeSlot 登记的槽。axios 拦截器不是组件、用不了 provide/inject，
 * 这是唯一能把请求归属到具体槽上的办法。
 *
 * 看起来会漏的一种情况：await 之后的请求，getCurrentInstance() 已经是 null。
 * 但实际漏不掉 —— 组件挂载时的第一个请求一定在 onMounted 的同步段里发起，
 * 它被挂住之后，后面 await 它的请求根本走不到。等这个 tab 真正被进入、闸门放行时，
 * 该 tab 已经是激活状态，后续请求本就该直接放行。
 */

/** 槽组件实例 → 它属于哪个 tab。只把实例当身份键用，所以键类型放宽到 object */
const slotOwner = new WeakMap<object, TabPath>()

/** 槽组件在 setup 里登记自己（见 components/TabSwipeSlot.vue） */
export function registerTabSlot(instance: object, tab: TabPath): void {
  slotOwner.set(instance, tab)
}

export function unregisterTabSlot(instance: object): void {
  slotOwner.delete(instance)
}

/** 当前真正可见（已进入）的 tab，由 TabSwipeView 维护 */
let activeTab: TabPath | '' = ''

/** 被挂住的请求：tab → 放行回调。放行时机只有一个 —— 这个 tab 被真正进入 */
const waiting = new Map<TabPath, Array<() => void>>()

export function setActiveTab(tab: TabPath | ''): void {
  activeTab = tab
  if (!tab) return
  const queue = waiting.get(tab)
  if (!queue) return
  waiting.delete(tab)
  for (const release of queue) release()
}

/**
 * 请求闸门：返回 null 表示直接放行；返回 promise 表示这个请求来自
 * 「已渲染但还没被进入」的相邻 tab，要等它被进入后再放行。
 *
 * 刻意不在槽卸载时放行或丢弃队列：队列属于 tab 而不是某次挂载，
 * 该 tab 一直没被进入就一直不发请求，这才是「不预加载」。
 */
export function gateTabRequest(): Promise<void> | null {
  // 没有滑动容器在跑（桌面端、非 tab 路由、容器正在卸载）时不存在「预渲染页」，
  // 一律放行 —— 否则容器卸载瞬间发出的请求会被永久挂住
  if (!activeTab) return null

  const owner = ownerTabOfCurrentInstance()
  if (!owner || owner === activeTab) return null

  return new Promise<void>((resolve) => {
    const queue = waiting.get(owner)
    if (queue) queue.push(resolve)
    else waiting.set(owner, [resolve])
  })
}

function ownerTabOfCurrentInstance(): TabPath | '' {
  let instance = getCurrentInstance()
  while (instance) {
    const tab = slotOwner.get(instance)
    if (tab) return tab
    instance = instance.parent
  }
  return ''
}
