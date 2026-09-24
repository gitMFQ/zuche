import { ref } from 'vue'

/** 主 tab 切换期间的 tabbar 动画状态；tabbar 与滑动容器是兄弟组件，用模块状态同步。 */
const isSliding = ref(false)
const isSettled = ref(false)
let settledTimer: number | undefined

export function useTabbarMotion() {
  function begin(): void {
    if (settledTimer !== undefined) {
      window.clearTimeout(settledTimer)
      settledTimer = undefined
    }
    isSettled.value = false
    isSliding.value = true
  }

  function settle(): void {
    isSliding.value = false
    isSettled.value = true
    if (settledTimer !== undefined) window.clearTimeout(settledTimer)
    settledTimer = window.setTimeout(() => {
      isSettled.value = false
      settledTimer = undefined
    }, 420)
  }

  return { isSliding, isSettled, begin, settle }
}
