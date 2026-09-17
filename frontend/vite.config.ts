import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  define: {
    // 确保 VITE_ 开头的环境变量在构建时被正确替换
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || process.env.CF_PAGES_VITE_API_URL || ''),
  },
  server: {
    host: '0.0.0.0',  // 监听所有地址（可从局域网访问）
    port: 5173,       // 端口
    strictPort: true, // 端口被占用时报错而不是自动换端口
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
