<script setup lang="ts">
/**
 * Apple-style Section Component
 * Supports dark and light background variants
 */

const props = defineProps<{
  variant?: 'dark' | 'light' | 'default'
}>()

const sectionClass = computed(() => {
  const classes = ['sk-section']
  if (props.variant === 'dark') classes.push('sk-section-dark')
  if (props.variant === 'light') classes.push('sk-section-light')
  return classes
})
</script>

<template>
  <section :class="sectionClass">
    <div class="sk-section-content">
      <slot />
    </div>
  </section>
</template>
