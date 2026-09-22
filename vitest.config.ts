import { defineConfig } from 'vitest/config';

// 只测纯逻辑函数（后端 src/lib、前端 frontend/src/utils 里不依赖 Vue 与 D1 的那部分），
// 不涉及 Vue 组件与 D1，所以用 node 环境即可，不需要 jsdom 与 @vue/test-utils。
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node'
  }
});
