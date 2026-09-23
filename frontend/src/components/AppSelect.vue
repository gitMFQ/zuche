<template>
  <!--
    桌面端：完全交给 Element Plus，属性原样透传，视觉与行为与替换前一致。
    移动端：WeUI 单列滚轮（见下方 teleport 的 sheet），与 AppDatePicker 共用 .m-wheel 样式。
  -->
  <el-select
    v-if="!isMobile"
    v-bind="$attrs"
    :model-value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :clearable="clearable"
    :filterable="filterable"
    @update:model-value="onDesktopInput"
    @change="onDesktopChange"
  >
    <el-option v-for="option in options" :key="option.value" :label="option.label" :value="option.value" />
  </el-select>

  <el-input
    v-else
    :model-value="displayLabel"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="['app-select-trigger', $attrs.class]"
    :style="$attrs.style"
    readonly
    @click="openSheet"
  >
    <template #suffix>
      <el-icon v-if="showClear" class="app-select-trigger__clear" @click.stop="onClear">
        <i class="weui-icon-outlined-close2" />
      </el-icon>
      <i class="app-select-trigger__chevron" aria-hidden="true" />
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
            <button
              type="button"
              class="m-wheel__btn m-wheel__btn--primary"
              :disabled="confirmDisabled"
              @click="confirm"
            >
              确定
            </button>
          </div>
          <div v-if="searchVisible" class="m-wheel__search">
            <el-icon><i class="weui-icon-outlined-search" /></el-icon>
            <input
              ref="searchInputRef"
              v-model="keyword"
              class="m-wheel__search-input"
              type="search"
              enterkeyhint="search"
              placeholder="搜索"
            />
          </div>
          <div v-if="wheelItems.length" class="m-wheel__bd" @touchstart.passive="blurSearch">
            <div class="m-wheel__col">
              <div ref="scrollEl" class="m-wheel__scroll" @scroll.passive="onScroll">
                <div
                  v-for="item in wheelItems"
                  :key="item.value"
                  class="m-wheel__item"
                  :class="{ 'is-active': item.value === draftValue }"
                >
                  {{ item.label }}
                </div>
              </div>
            </div>
            <div class="m-wheel__indicator" />
          </div>
          <div v-else class="m-wheel__empty">{{ emptyText }}</div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
/**
 * 下拉选择器：桌面端用 el-select，移动端用 WeUI 单列滚轮。
 *
 * 为什么包一层：移动端 el-select 点开的是 Element Plus 的 popper 浮层，不是 WeUI
 * 的底部选择器；而项目里移动端要的是 WeUI 形态（与 AppDatePicker 同一套 sheet）。
 * 移动端还顺带解决了两个原生形态的问题：滚轮里能显式给一条「不限」清空，
 * 长列表（车辆 / 操作人）可以带搜索框。
 *
 * 与 el-select 的用法差异：选项从 <el-option> children 改成 `options` 数组。
 * 滚轮需要 label + value + 当前值定位，数据化比在组件里解析插槽可靠。
 * 桌面端仍由内部 el-select 渲染，所以桌面端行为与替换前一致。
 *
 * 滚轮用 CSS scroll-snap 做吸附（不写惯性模拟），JS 只读滚动位置、不改写；
 * 选项拼接、当前值定位与搜索过滤在 utils/selectPicker.ts，有单测覆盖 ——
 * 本机没有浏览器，滚动手感无法本地验证，规则部分必须靠测试兜住。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useFormItem } from 'element-plus'
import { useMobile } from '../composables/useMobile'
import {
  CLEAR_VALUE,
  type SelectOption,
  buildSelectItems,
  filterOptions,
  findOptionIndex,
  shouldShowSearch
} from '../utils/selectPicker'
import { WHEEL_ITEM_HEIGHT, indexToScrollTop, scrollTopToIndex } from '../utils/wheelPicker'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string
    /** 选项列表（替代 el-option children），空值用 '' */
    options?: SelectOption[]
    /** 与 el-select 的 placeholder 对齐 */
    placeholder?: string
    /** 滚轮 sheet 的标题，留空依次回退到表单 label / placeholder */
    title?: string
    disabled?: boolean
    /** 与 el-select 的 clearable 对齐（EP 默认就是 false）：为 false 时移动端既不给 × 也不给「不限」行 */
    clearable?: boolean
    /** 为 true 时移动端滚轮上方给搜索框（选项数超过阈值也自动给） */
    filterable?: boolean
  }>(),
  {
    modelValue: '',
    options: () => [],
    placeholder: '',
    title: '',
    disabled: false,
    clearable: false,
    filterable: false
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

const { isMobile } = useMobile()
const { formItem } = useFormItem()

/* ---------------- 桌面端 ---------------- */

// 项目里所有 option value 都是字符串；这里只做一次类型收窄，
// 其余属性（style / size / class）由 $attrs 透传
function onDesktopInput(value: unknown) {
  emit('update:modelValue', typeof value === 'string' ? value : '')
}

function onDesktopChange(value: unknown) {
  emit('change', typeof value === 'string' ? value : '')
}

/* ---------------- 移动端触发器 ---------------- */

const selectedLabel = computed(() => props.options.find((item) => item.value === props.modelValue)?.label ?? '')

// 值不在选项里（选项未加载 / 旧 id）时退回显示原始值，与桌面端 el-select 一致
const displayLabel = computed(() => selectedLabel.value || props.modelValue)

const showClear = computed(() => props.clearable && !props.disabled && props.modelValue !== '')

/** 表单 label：点击时从触发器往上找最近的 el-form-item，读它的标签当标题 */
const formItemLabel = ref('')

function readFormItemLabel(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLElement)) return ''
  return target.closest('.el-form-item')?.querySelector('.el-form-item__label')?.textContent?.trim() ?? ''
}

const resolvedTitle = computed(() => props.title || formItemLabel.value || props.placeholder || '请选择')

/* ---------------- 移动端滚轮 ---------------- */

const sheetVisible = ref(false)
const keyword = ref('')
const draftValue = ref('')
const scrollEl = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const searching = computed(() => keyword.value.trim() !== '')

const searchVisible = computed(() => shouldShowSearch(props.filterable, props.options.length))

// 搜索态下只列真实选项（「不限」与当前值占位项不是匹配结果）；
// 非搜索态由 buildSelectItems 拼上「不限」与当前值占位项
const wheelItems = computed<SelectOption[]>(() =>
  searching.value
    ? filterOptions(props.options, keyword.value)
    : buildSelectItems(props.options, props.modelValue, props.clearable)
)

const emptyText = computed(() => (searching.value ? '无匹配项' : '暂无可选项'))
const confirmDisabled = computed(() => wheelItems.value.length === 0)

/**
 * 把滚轮滚到某个值上，并把 draft 同步成该位置实际显示的那一项。
 *
 * 必须同步：定位后浏览器不一定派发 scroll 事件（scrollTop 本来就在目标位置时），
 * 那就只有 draft 与实际显示不一致了 —— 用户看着第一项被选中，点确定却什么都没发生。
 * 值不在列表里时 findOptionIndex 给 0，于是「确定 = 接受滚轮上显示的那一项」。
 */
function positionWheel(value: string) {
  const items = wheelItems.value
  const index = findOptionIndex(items, value)
  const el = scrollEl.value
  if (el) el.scrollTop = indexToScrollTop(index)
  const item = items[index]
  if (item) draftValue.value = item.value
}

function onScroll(event: Event) {
  const el = event.target
  if (!(el instanceof HTMLElement)) return
  const item = wheelItems.value[scrollTopToIndex(el.scrollTop, wheelItems.value.length)]
  if (item && item.value !== draftValue.value) draftValue.value = item.value
}

function blurSearch() {
  searchInputRef.value?.blur()
}

// 搜索把列表换掉之后要重新定位：原选中项可能已经不在列里，
// 不重新定位的话 draft 会停在一个不在列表里的值上，确定时会 emit 出去
watch(keyword, async () => {
  await nextTick()
  positionWheel(draftValue.value)
})

async function openSheet(event: Event) {
  if (props.disabled) return
  formItemLabel.value = readFormItemLabel(event)
  keyword.value = ''
  draftValue.value = props.modelValue
  sheetVisible.value = true
  // 等 sheet 挂载完再定位；scrollTop 的设置会触发一次 scroll 事件，
  // 但算出来的值和 draftValue 相同，onScroll 会直接跳过
  await nextTick()
  positionWheel(draftValue.value)
}

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
  const value = draftValue.value
  sheetVisible.value = false
  // 什么都没动就确定：不发 change，免得筛选白打一次接口
  if (value !== props.modelValue) emitChange(value)
}

function onClear() {
  if (props.modelValue !== '') emitChange(CLEAR_VALUE)
}

/**
 * 值变了才 emit。
 *
 * 顺带补一次表单校验：桌面端由 el-select 内部调 formItem.validate('change')，
 * 移动端这个分支里是 readonly 的 el-input，不补的话 trigger: 'change' 的规则
 * 要等到提交才显示红字（校验失败由 el-form-item 自己展示，这里吞掉即可）。
 */
function emitChange(value: string) {
  emit('update:modelValue', value)
  emit('change', value)
  void formItem?.validate?.('change').catch(() => undefined)
}
</script>

<style scoped>
.app-select-trigger__clear {
  cursor: pointer;
}
</style>
