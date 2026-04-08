<script setup lang="ts">
/**
 * Apple-style Card Component
 * Supports light, dark, and elevated variants
 */

const props = defineProps<{
  variant?: 'light' | 'dark' | 'elevated' | 'default'
  padding?: string
}>()

const cardClass = computed(() => {
  const classes = ['sk-card']
  if (props.variant === 'light') classes.push('sk-card-light')
  if (props.variant === 'dark') classes.push('sk-card-dark')
  if (props.variant === 'elevated') classes.push('sk-card-elevated')
  return classes
})

const cardStyle = computed(() => {
  if (props.padding) {
    return { padding: props.padding }
  }
  return {}
})
</script>

<template>
  <div :class="cardClass" :style="cardStyle">
    <slot />
  </div>
</template>
