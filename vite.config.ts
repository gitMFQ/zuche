import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 前端源码在 frontend/，构建产物 frontend/dist 由 Worker 的 Static Assets 托管
export default defineConfig({
  root: './frontend',
  plugins: [vue()],
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
