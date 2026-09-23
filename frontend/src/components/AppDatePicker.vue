<template>
  <!--
    桌面端：完全交给 Element Plus，属性原样透传，视觉与行为与替换前一致。
    移动端：WeUI 底部滚轮（见下方 teleport 的 sheet）。
  -->
  <el-date-picker
    v-if="!isMobile"
    v-bind="$attrs"
    :model-value="modelValue"
    :type="type"
    :value-format="resolvedValueFormat"
    :placeholder="placeholder"
    :disabled="disabled"
    :clearable="clearable"
    @update:model-value="onDesktopInput"
    @change="onDesktopChange"
  />
  <el-input
    v-else
    :model-value="displayValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="['app-date-trigger', $attrs.class]"
    :style="$attrs.style"
    readonly
    @click="openSheet"
  >
    <template #prefix>
      <el-icon><Calendar /></el-icon>
    </template>
    <template #suffix>
      <el-icon v-if="showClear" class="app-date-trigger__clear" @click.stop="onClear">
        <i class="weui-icon-outlined-close2" />
      </el-icon>
    </template>
  </el-input>

  <teleport to="body">
    <transition name="m-wheel">
      <div
        v-if="sheetVisible"
        class="m-wheel"
        :style="{ '--m-wheel-item-h': `${WHEEL_ITEM_HEIGHT}px` }"
      >
        <div class="m-wheel__mask" @click="cancel" />
        <div class="m-wheel__sheet">
          <div class="m-wheel__hd">
            <button type="button" class="m-wheel__btn" @click="cancel">取消</button>
            <div class="m-wheel__title">{{ resolvedTitle }}</div>
            <button type="button" class="m-wheel__btn m-wheel__btn--primary" @click="confirm">确定</button>
          </div>
          <div class="m-wheel__bd">
            <div v-for="column in columns" :key="column.key" class="m-wheel__col">
              <div
                :ref="(el) => setScrollRef(column.key, el)"
                class="m-wheel__scroll"
                @scroll.passive="onScroll(column.key, $event)"
              >
                <div
                  v-for="item in column.items"
                  :key="item.value"
                  class="m-wheel__item"
                  :class="{ 'is-active': item.value === draft[column.key] }"
                >
                  {{ item.label }}
                </div>
              </div>
            </div>
            <div class="m-wheel__indicator" />
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
/**
 * 日期 / 时间选择器：桌面端用 el-date-picker，移动端用 WeUI 滚轮。
 *
 * 为什么包一层：项目里移动端原本只有「原生 input[type=date]」这一条路，
 * 但月份选择在 iOS Safari 上不支持（type="month" 会退化成手打文本框），
 * 而带日期区间（daterange）的双月面板有 646px 宽，在手机上放不下。
 * 滚轮是唯一能同时覆盖「单日期 + 月份 + 日期时间」的移动端形态。
 *
 * 滚轮用 CSS scroll-snap 做吸附（不写惯性模拟），JS 只读滚动位置、不改写，
 * 所以手感和系统原生滚轮一致；列数据与闰年/大小月联动在 utils/wheelPicker.ts，
 * 有单测覆盖 —— 本机没有浏览器，滚动手感无法本地验证，规则部分必须靠测试兜住。
 *
 * 用法与 el-date-picker 对齐：`v-model` + `type` + `value-format`，
 * 其余属性（style/class/size/format 等）在桌面端原样透传。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { Calendar } from '@element-plus/icons-vue'
import { useMobile } from '../composables/useMobile'
import {
  type DateParts,
  type PickerType,
  type WheelColumnKey,
  WHEEL_ITEM_HEIGHT,
  buildColumns,
  daysInMonth,
  formatValue,
  indexToScrollTop,
  parseValue,
  scrollTopToIndex
} from '../utils/wheelPicker'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string
    /** 与 el-date-picker 的 type 对齐，只支持 date / month / datetime */
    type?: PickerType
    /** 与 el-date-picker 的 value-format 对齐，留空按 type 取默认值 */
    valueFormat?: string
    placeholder?: string
    /** 滚轮 sheet 的标题，留空按 type 给「选择日期 / 选择月份」 */
    title?: string
    disabled?: boolean
    /** 与 el-date-picker 的 clearable 对齐：为 false 时移动端也不给清除按钮 */
    clearable?: boolean
  }>(),
  {
    modelValue: '',
    type: 'date',
    valueFormat: '',
    placeholder: '',
    title: '',
    disabled: false,
    clearable: true
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

const { isMobile } = useMobile()

const resolvedValueFormat = computed(() => {
  if (props.valueFormat) return props.valueFormat
  if (props.type === 'month') return 'YYYY-MM'
  return props.type === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'
})

const resolvedTitle = computed(() => {
  if (props.title) return props.title
  return props.type === 'datetime' ? '选择时间' : props.type === 'month' ? '选择月份' : '选择日期'
})

/* ---------------- 桌面端 ---------------- */

// 项目里所有调用点都带 value-format，值必为字符串；这里只做一次类型收窄，
// 避免把 Date 对象透出去污染调用方的 string 字段
function onDesktopInput(value: unknown) {
  emit('update:modelValue', typeof value === 'string' ? value : '')
}

function onDesktopChange(value: unknown) {
  emit('change', typeof value === 'string' ? value : '')
}

/* ---------------- 移动端触发器 ---------------- */

const showClear = computed(() => props.clearable && !props.disabled && Boolean(props.modelValue))

/**
 * 触发器上显示的值。
 *
 * datetime 与桌面端 `format="YYYY-MM-DD HH:mm"` 对齐：把带 T 的值换成空格，
 * 秒为 00 时省掉（历史数据里秒不是 00 的保留原样，不擅自截断）。
 * 值本身不动，只是显示。
 */
const displayValue = computed(() => {
  const value = props.modelValue
  if (!value || props.type !== 'datetime') return value
  return value.replace('T', ' ').replace(/(\d{2}:\d{2}):00$/, '$1')
})

function onClear() {
  emit('update:modelValue', '')
  emit('change', '')
}

/* ---------------- 移动端滚轮 ---------------- */

const sheetVisible = ref(false)
const draft = ref<DateParts>(parseValue('', props.type))
const scrollRefs = new Map<WheelColumnKey, HTMLElement>()

const columns = computed(() => buildColumns(draft.value, props.type))

function setScrollRef(key: WheelColumnKey, el: unknown) {
  if (el instanceof HTMLElement) scrollRefs.set(key, el)
  else scrollRefs.delete(key)
}

function scrollToIndex(key: WheelColumnKey, index: number) {
  const el = scrollRefs.get(key)
  if (el) el.scrollTop = indexToScrollTop(index)
}

async function openSheet() {
  if (props.disabled) return
  draft.value = parseValue(props.modelValue, props.type)
  sheetVisible.value = true
  // 等 sheet 挂载完再定位；scrollTop 的设置会触发一次 scroll 事件，
  // 但算出来的值和 draft 相同，onScroll 会直接返回，不会回写
  await nextTick()
  for (const column of columns.value) scrollToIndex(column.key, column.index)
}

function onScroll(key: WheelColumnKey, event: Event) {
  const el = event.target as HTMLElement | null
  if (!el) return
  const column = columns.value.find((item) => item.key === key)
  if (!column) return
  const value = column.items[scrollTopToIndex(el.scrollTop, column.items.length)]?.value
  if (value === undefined || draft.value[key] === value) return
  draft.value = { ...draft.value, [key]: value }
}

// 滚到 2 月时把 31 日压回 28/29 日；日列因此变短，需要重新定位，
// 否则浏览器自动夹住 scrollTop 会让选中项跳到末尾
watch(
  () => [draft.value.year, draft.value.month] as const,
  () => {
    const maxDay = daysInMonth(draft.value.year, draft.value.month)
    if (draft.value.day > maxDay) {
      draft.value = { ...draft.value, day: maxDay }
      void nextTick(() => scrollToIndex('day', maxDay - 1))
    }
  }
)

// 打开期间锁住页面滚动，避免滚轮滑到底后继续带动背景
let previousBodyOverflow = ''
watch(sheetVisible, (visible) => {
  if (typeof document === 'undefined') return
  if (visible) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = previousBodyOverflow
  }
})

function cancel() {
  sheetVisible.value = false
}

function confirm() {
  const value = formatValue(draft.value, props.type, resolvedValueFormat.value)
  sheetVisible.value = false
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<style scoped>
.app-date-trigger__clear {
  cursor: pointer;
}

/* 底部 sheet 与滚轮的样式已挪到 style.css 的「Mobile WeUI Wheel Sheet」区块，
   与 AppSelect 共用一份（两个组件的 sheet 都 teleport 到 body，放 scoped 里会各写一份 */
</style>
