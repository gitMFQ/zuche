<script setup lang="ts">
/**
 * Apple-style Navigation Glass Component
 * Sticky navigation with backdrop blur effect
 */

defineProps<{
  logo?: string
  logoText?: string
}>()
</script>

<template>
  <nav class="sk-nav-glass">
    <div class="sk-nav-logo">
      <img v-if="logo" :src="logo" alt="Logo" class="sk-nav-logo-img" />
      <span v-else class="sk-nav-logo-text">{{ logoText || 'Logo' }}</span>
    </div>
    <div class="sk-nav-content">
      <slot />
    </div>
  </nav>
</template>

<style scoped>
.sk-nav-logo {
  display: flex;
  align-items: center;
}

.sk-nav-logo-img {
  height: 17px;
  width: auto;
}

.sk-nav-logo-text {
  color: #ffffff;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
  font-weight: 600;
}

.sk-nav-content {
  display: flex;
  align-items: center;
  gap: 16px;
}
</style>
