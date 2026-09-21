<template>
  <el-dialog v-model="dialogVisible" title="图片预览" width="90%" :style="{ maxWidth: '500px' }">
    <el-carousel :key="carouselKey" :initial-index="currentIndex" indicator-position="outside">
      <el-carousel-item v-for="(img, idx) in previewImages" :key="idx">
        <img :src="getImageUrl(img)" class="preview-image" alt="图片预览" />
      </el-carousel-item>
    </el-carousel>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { getImageUrl } from '../utils/helpers'

/**
 * 通用图片预览弹窗（轮播）。
 *
 * 订单、车辆、违章、保险等页面都有「点小图看大图」的需求，过去每个页面各自复制一份
 * el-dialog + el-carousel，这里统一成一个。
 *
 * el-carousel 只在挂载时读 initial-index，而 el-dialog 关闭后内容仍然缓存，
 * 所以每次打开都递增 key 强制重建轮播，否则重开时会停在上一次的位置。
 */
const props = defineProps<{
  visible: boolean
  images?: string[]
  index?: number
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const dialogVisible = ref(false)
const previewImages = ref<string[]>([])
const currentIndex = ref(0)
const carouselKey = ref(0)

watch(
  () => props.visible,
  (val) => {
    dialogVisible.value = val
    if (val) {
      previewImages.value = props.images ?? []
      currentIndex.value = props.index ?? 0
      carouselKey.value += 1
    }
  }
)

watch(dialogVisible, (val) => {
  emit('update:visible', val)
})
</script>

<style scoped>
.preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
