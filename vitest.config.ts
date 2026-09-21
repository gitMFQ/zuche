import { defineConfig } from 'vitest/config';

// 只测后端纯逻辑（src/lib 下的函数），不涉及 Vue 组件与 D1，
// 所以用 node 环境即可，不需要 jsdom 与 @vue/test-utils。
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node'
  }
});
