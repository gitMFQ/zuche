<script setup lang="ts">
/**
 * Apple-style Button Component
 * Supports primary, dark, pill, and filter variants
 */

const props = defineProps<{
  variant?: 'primary' | 'dark' | 'pill' | 'filter'
  disabled?: boolean
  href?: string
}>()

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const className = computed(() => {
  return `sk-button-${props.variant || 'primary'}`
})

function handleClick(event: MouseEvent) {
  if (!props.disabled) {
    emit('click', event)
  }
}
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href"
    :class="className"
    :disabled="disabled"
    @click="handleClick"
  >
    <slot />
  </component>
</template>
