<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>

<template>
  <!--
    语言包通过 ConfigProvider 提供。
    Element Plus 改成按需引入后不再 app.use(ElementPlus, { locale })，容器方式同样生效，
    且只影响用到的组件（分页文案、日期选择器等需要它）。
  -->
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>
