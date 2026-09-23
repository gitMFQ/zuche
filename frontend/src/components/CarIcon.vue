<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="1em" height="1em">
    <path
      fill="currentColor"
      d="M240 104h-10.8l-27.78-62.5A16 16 0 0 0 186.8 32H69.2a16 16 0 0 0-14.62 9.5L26.8 104H16a8 8 0 0 0 0 16h8v80a16 16 0 0 0 16 16h24a16 16 0 0 0 16-16v-16h96v16a16 16 0 0 0 16 16h24a16 16 0 0 0 16-16v-80h8a8 8 0 0 0 0-16M69.2 48h117.6l24.89 56H44.31ZM64 200H40v-16h24Zm128 0v-16h24v16Zm24-32H40v-48h176ZM56 144a8 8 0 0 1 8-8h16a8 8 0 0 1 0 16H64a8 8 0 0 1-8-8m112 0a8 8 0 0 1 8-8h16a8 8 0 0 1 0 16h-16a8 8 0 0 1-8-8"
    />
  </svg>
</template>

<script setup lang="ts">
/**
 * 车辆图标（轿车正面）。
 *
 * 项目里两套图标库都没有轿车：WeUI 没有车语义，Element Plus 只有 `Van`（面包车）。
 * 这枚是 Phosphor 的 `car`（MIT，https://phosphoricons.com），以 SVG 内联引入，
 * 不额外加图标库依赖。用法与 EP 图标一致：`<el-icon :size="20"><CarIcon /></el-icon>`。
 */
</script>
