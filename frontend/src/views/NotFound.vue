<template>
  <div class="not-found">
    <div class="not-found-content">
      <p class="code">404</p>
      <h1>找不到这个页面</h1>
      <p class="hint">链接可能已经失效，或者你输入的地址有误。</p>
      <button class="sk-button-primary not-found-btn" @click="goHome">返回首页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goHome() {
  router.replace('/dashboard')
}
</script>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--sk-bg-light-gray);
  padding: 24px;
}

html.dark .not-found {
  background-color: var(--sk-bg-pure-black);
}

.not-found-content {
  text-align: center;
  max-width: 420px;
}

.code {
  margin: 0;
  font-size: 4rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--sk-text-tertiary);
}

.not-found-content h1 {
  margin: 8px 0 12px;
  color: var(--sk-text-near-black);
}

.not-found-content .hint {
  margin: 0 0 24px;
  color: var(--sk-text-secondary);
}

.not-found-btn {
  min-width: 160px;
}
</style>
