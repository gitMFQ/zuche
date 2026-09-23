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

/* ---------------- 底部 sheet ---------------- */

.m-wheel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  /* Element Plus 的弹层 z-index 从 2000 起每次打开 +1，取一个远高于它的值 */
  z-index: 9999;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.m-wheel__mask {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: rgba(0, 0, 0, 0.4);
}

.m-wheel__sheet {
  position: relative;
  background-color: var(--m-bg-cell);
  border-radius: 12px 12px 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}

/* 顶部下拉手柄，与全局 sheet 弹窗一致 */
.m-wheel__sheet::before {
  content: '';
  display: block;
  width: 40px;
  height: 4px;
  margin: 8px auto 0;
  border-radius: 2px;
  background-color: var(--m-bg-page);
}

.m-wheel__hd {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 8px;
}

.m-wheel__hd::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background-color: var(--m-line);
  transform: scaleY(0.5);
  transform-origin: 0 0;
}

.m-wheel__btn {
  min-width: 64px;
  height: 44px;
  padding: 0 12px;
  border: none;
  background: transparent;
  font-size: 17px;
  color: var(--m-fg-1);
}

.m-wheel__btn--primary {
  color: var(--m-brand);
}

.m-wheel__btn:active {
  background-color: var(--m-active);
}

.m-wheel__title {
  font-size: 17px;
  font-weight: 500;
  color: var(--m-fg-0);
}

.m-wheel__bd {
  position: relative;
  display: flex;
}

.m-wheel__col {
  flex: 1 1 0;
  min-width: 0;
}

/* 可视区固定 7 项高，首尾各留 3 项空白（伪元素撑开，不占容器高度），
   这样第一项和最后一项也能滚到正中间 */
.m-wheel__scroll {
  height: calc(var(--m-wheel-item-h) * 7);
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.m-wheel__scroll::-webkit-scrollbar {
  display: none;
}

.m-wheel__scroll::before,
.m-wheel__scroll::after {
  content: '';
  display: block;
  height: calc(var(--m-wheel-item-h) * 3);
}

.m-wheel__item {
  height: var(--m-wheel-item-h);
  line-height: var(--m-wheel-item-h);
  padding: 0 4px;
  box-sizing: border-box;
  text-align: center;
  font-size: 17px;
  color: var(--m-fg-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  scroll-snap-align: center;
}

/* 滚到中间的那一项加重，与上下两条 hairline 一起表示当前选中 */
.m-wheel__item.is-active {
  color: var(--m-fg-0);
  font-weight: 500;
}

/* 中间选中行的上下 hairline */
.m-wheel__indicator {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: var(--m-wheel-item-h);
  transform: translateY(-50%);
  pointer-events: none;
}

.m-wheel__indicator::before,
.m-wheel__indicator::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background-color: var(--m-line);
}

.m-wheel__indicator::before {
  top: 0;
  transform: scaleY(0.5);
  transform-origin: 0 0;
}

.m-wheel__indicator::after {
  bottom: 0;
  transform: scaleY(0.5);
  transform-origin: 0 100%;
}

/* ---------------- 进出场：遮罩淡入 + sheet 从底部升起 ---------------- */

.m-wheel-enter-active,
.m-wheel-leave-active {
  transition: opacity 0.3s ease;
}

.m-wheel-enter-active .m-wheel__sheet,
.m-wheel-leave-active .m-wheel__sheet {
  transition: transform 0.3s ease;
}

.m-wheel-enter-from,
.m-wheel-leave-to {
  opacity: 0;
}

.m-wheel-enter-from .m-wheel__sheet,
.m-wheel-leave-to .m-wheel__sheet {
  transform: translateY(100%);
}
</style>
