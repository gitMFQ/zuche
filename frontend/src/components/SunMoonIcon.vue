<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="1em" height="1em">
    <path
      fill="currentColor"
      d="M15 2h2v3h-2zm12 13h3v2h-3zM15 27h2v3h-2zM2 15h3v2H2zm3.45-8.117L6.864 5.47l2.122 2.12L7.57 9.004zM23 7.581l2.12-2.121l1.414 1.414l-2.121 2.122zm.002 16.835l1.414-1.414l2.122 2.122l-1.414 1.414zM5.47 25.13L7.59 23L9 24.42l-2.12 2.12zM16 8a8 8 0 1 0 8 8a8 8 0 0 0-8-8m0 14a6 6 0 0 1 0-12Z"
    />
  </svg>
</template>

<script setup lang="ts">
/**
 * 「半明半暗」图标（太阳光芒 + 右半实心月牙），用在主题的「自动切换」项上。
 *
 * 两套图标库都没有这个语义：WeUI 没有明暗，Element Plus 只有 Sunny / Moon /
 * MoonNight 这类单一状态的图标。取自 Carbon Icons 的 `brightness-contrast`
 * （Apache-2.0），SVG 内联，零依赖。用法同 EP 图标：`<el-icon><SunMoonIcon /></el-icon>`。
 */
</script>
