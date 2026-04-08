<script setup lang="ts">
/**
 * Apple-style Typography Component
 * Uses SF Pro Display/Text with optical sizing
 */

const props = defineProps<{
  variant?: 'display-hero' | 'display-section' | 'display-tile' | 'display-card' | 'display-subheading' | 'body' | 'body-emphasis' | 'caption' | 'caption-bold' | 'micro'
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div'
}>()

const componentMap = {
  'display-hero': 'h1',
  'display-section': 'h2',
  'display-tile': 'h3',
  'display-card': 'h4',
  'display-subheading': 'h4',
  'body': 'p',
  'body-emphasis': 'p',
  'caption': 'span',
  'caption-bold': 'span',
  'micro': 'span'
} as const

const component = computed(() => (props.as || componentMap[props.variant || 'body']) as string)
</script>

<template>
  <component :is="component" :class="`sk-${variant || 'body'}`">
    <slot />
  </component>
</template>
