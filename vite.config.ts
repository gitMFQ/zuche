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
  optimizeDeps: {
    // 按需引入后，组件的 import 语句是插件在 transform 时才注入的，依赖扫描阶段看不到，
    // 于是 dev 启动后才陆续发现新依赖 → "optimized dependencies changed. reloading"，
    // 正在飞的请求被断开，浏览器报 ERR_CONNECTION_CLOSED。
    // 这里把稳定依赖一次性预热，避免运行期再触发重新预构建。
    // 实测未被预热的只有 element-plus/es、html2canvas、xlsx 三个：
    // element-plus/es 是 resolver 注入的组件桶，扫描阶段看不到；
    // 后两个是动态 import（调度图导出 / Excel 导入），要等用户点到那个功能才首次出现，
    // 正好会在用户操作时触发一次刷新。其余 8 个扫描阶段就能发现，
    // 一并写死是为了让依赖集合确定，页面增减不会再引起刷新。
    //
    // 只列这一层，不列 element-plus/es/components/*：ElementPlusResolver 实际生成的是
    // `import { ElButton } from 'element-plus/es'`（桶导出），不是逐组件子路径，
    // 列子路径既匹配不上也不减少体积，反而拖慢冷启动。
    include: [
      'vue',
      'vue-router',
      'pinia',
      'axios',
      'dayjs',
      'html2canvas',
      'xlsx',
      '@element-plus/icons-vue',
      'element-plus',
      'element-plus/es',
      'element-plus/es/locale/lang/zh-cn'
    ]
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // 轮询监听文件变化（容器/挂载目录里 inotify 事件有丢失风险）。2026-09-23 出过一次
    // 「服务端产物陈旧」：dev 服务器一直供着 InsuranceFormDialog.vue 的一次中间保存产物
    // （到期日期已换成 AppDatePicker、生效日期还是原生 input），磁盘和 git 里两处早已都是
    // AppDatePicker；/tmp/vite.log 显示那次改动其实收到过 hmr update，所以成因没定论
    // （疑似同一 mtime tick 内两次写入的边界情况）。刷新页面救不了（旧的是服务端），
    // 恢复手段是 touch 文件或重启 dev。轮询消除的是「事件丢失」这一类成因，代价是
    // 少量 CPU（监听树只有 frontend/，node_modules 默认被忽略）。
    watch: {
      usePolling: true
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:8787',
        changeOrigin: true
      },
      // 本地没有 Cloudflare 的图像处理层，getImageUrl() 拼出的
      // /cdn-cgi/image/width=600,format=auto/uploads/xxx 在本地会落到 SPA 回退，
      // 图片全变成 index.html。这里剥掉转换前缀再转给后端，让本地也能看到图。
      '/cdn-cgi': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/cdn-cgi\/image\/[^/]+(?=\/uploads\/)/, '')
      }
    }
  }
})
