<template>
  <el-dialog v-model="dialogVisible" title="指派司机" width="90%" :style="{ maxWidth: '400px' }">
    <el-form :model="form" label-width="80px">
      <el-form-item label="取车司机">
        <AppSelect v-model="form.pickup_driver_id" :options="userOptions" clearable placeholder="未指派" style="width: 100%" />
      </el-form-item>
      <el-form-item label="还车司机">
        <AppSelect v-model="form.return_driver_id" :options="userOptions" clearable placeholder="未指派" style="width: 100%" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useDictStore } from '../../stores/dict'
import AppSelect from '../AppSelect.vue'

/**
 * 指派司机弹窗。司机名单走字典缓存的 /users/options（只含 id/name），
 * 因为 /users 是管理员专属，员工指派司机会拿到 403。
 */
const props = defineProps<{
  visible: boolean
  order?: any
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', payload: { pickup_driver_id: string | null; return_driver_id: string | null }): void
}>()

const dictStore = useDictStore()
const dialogVisible = ref(false)
const users = ref<any[]>([])

// AppSelect 的选项（司机名单来自字典缓存，只有 id/name）
const userOptions = computed(() => users.value.map((u) => ({ label: u.name, value: u.id })))

// 值用字符串（AppSelect / el-select 清空都回空串），提交时再落成 null
const form = reactive<{ pickup_driver_id: string; return_driver_id: string }>({
  pickup_driver_id: '',
  return_driver_id: ''
})

watch(
  () => props.visible,
  async (val) => {
    dialogVisible.value = val
    if (!val) return
    users.value = await dictStore.ensureUserOptions()
    form.pickup_driver_id = props.order?.pickup_driver_id ?? ''
    form.return_driver_id = props.order?.return_driver_id ?? ''
  }
)

watch(dialogVisible, (val) => {
  emit('update:visible', val)
})

function handleSubmit() {
  emit('submit', {
    pickup_driver_id: form.pickup_driver_id || null,
    return_driver_id: form.return_driver_id || null
  })
}
</script>
