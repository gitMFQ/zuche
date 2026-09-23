<template>
  <el-tooltip
    :content="content"
    placement="top"
    :trigger="isMobile ? 'click' : 'hover'"
    :show-after="isMobile ? 0 : 150"
    :popper-style="{ maxWidth: '280px', lineHeight: '1.5' }"
  >
    <el-icon class="field-tip" @click.stop><i class="weui-icon-outlined-error" /></el-icon>
  </el-tooltip>
</template>

<script setup lang="ts">
/**
 * 表单字段的长说明。桌面 hover、移动端点按展开，避免在表单里占一整段文字。
 * 用法：放进 el-form-item 的 #label 插槽，如 `<template #label>往来期初<FieldTip content="..." /></template>`。
 * 移动端 label 的 5em 上限由 style.css 的 `:has(.field-tip)` 规则放开。
 */
import { useMobile } from '../composables/useMobile'

defineProps<{ content: string }>()

const { isMobile } = useMobile()
</script>

<style scoped>
.field-tip {
  align-self: center; /* EP 的 label 是 inline-flex + align-items:flex-start，默认会顶对齐 */
  margin-left: 4px;
  font-size: 0.9em;
  color: var(--sk-text-tertiary);
  cursor: help;
}
</style>
