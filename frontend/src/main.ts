import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Element Plus 组件由 unplugin-vue-components 按需自动引入（见 vite.config.ts）。
// 这里保留全量样式：组件样式按需注入需要额外的 resolver 配置，
// 而 CSS 是独立产物、不影响主 JS 体积，全量引入更稳（不会漏样式）。
import 'element-plus/dist/index.css'
// WeUI 图标库（mask-image 实现，非字体图标）。必须放在 style.css 之前，
// 好让 style.css 里的尺寸覆盖规则（1em 跟随字号）能压过官方基础规则（固定 24px）。
import 'weui-icon/dist/weui-icon.css'

import App from './App.vue'
import router from './router'
import { useUserStore } from './stores/user'
import './style.css'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)

const userStore = useUserStore()
function applyDarkMode() {
  userStore.applySystemDarkMode()
  if (userStore.themeSettings.darkMode) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

applyDarkMode()

if (typeof window !== 'undefined' && window.matchMedia) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    if (userStore.themeSettings.autoDarkMode) {
      applyDarkMode()
    }
  })
}

window.addEventListener('darkModeChange', ((e: CustomEvent) => {
  if (e.detail) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}) as EventListener)

app.mount('#app')
