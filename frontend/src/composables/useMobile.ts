import { onMounted, onUnmounted, ref } from 'vue'

/**
 * 响应式判断当前是否移动端（断点与项目其它地方保持一致：768px）。
 *
 * 之前有 9 处手写 `const isMobile = ref(window.innerWidth < 768)` 加 resize 监听，
 * 其中几处（Customers / Logs / OrderDetail / Violations）忘了 removeEventListener，
 * 组件销毁后监听仍然存在，属于内存泄漏。这里在 onMounted/onUnmounted 里成对注册，
 * 调用方不需要再关心注销。
 */
export function useMobile(breakpoint = 768) {
  const isMobile = ref(typeof window !== 'undefined' && window.innerWidth < breakpoint)

  function update() {
    isMobile.value = window.innerWidth < breakpoint
  }

  onMounted(() => {
    // 组件挂载时重新取一次：ref 初始化早于挂载，期间窗口可能已经变过
    update()
    window.addEventListener('resize', update)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', update)
  })

  return { isMobile, update }
}
