import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// 前端源码在 frontend/，构建产物 frontend/dist 由 Worker 的 Static Assets 托管
export default defineConfig({
  root: './frontend',
  plugins: [
    vue(),
    // 按需引入 Element Plus 组件。
    // 之前是 main.ts 里 app.use(ElementPlus) 全量注册 + 注册全部图标，
    // tree-shaking 完全失效，主包 874KB；改后主包 46KB，Element 各组件独立分包按需加载。
    //
    // importStyle: false —— 样式由 main.ts 统一引入 element-plus/dist/index.css。
    // 默认值会让 resolver 再注入一遍每个组件的样式，与全量 CSS 重复打包
    // （CSS 体积直接翻倍）；而关掉全量 CSS 只靠按需注入，又会漏掉
    // ElMessage / ElMessageBox 这类命令式 API 的样式，那类问题在浏览器里才看得出。
    Components({
      dts: false,
      resolvers: [ElementPlusResolver({ importStyle: false })]
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
})
