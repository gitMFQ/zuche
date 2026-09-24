/**
 * 移动端主 tab 左右滑动的纯逻辑（不依赖 Vue，方便单测）。
 *
 * 手势本身没法在 node 里跑，但「手指位移/速度 → 落到哪个 tab」这段判定最容易写错，
 * 也最值得测：边界页的阻尼、快速轻扫、位移与速度方向相反这些情况都在这。
 */

/** 位移超过容器宽度的这个比例就翻页 */
export const SWIPE_DISTANCE_RATIO = 0.22
/** 位移阈值上限：大屏上按比例算出来的阈值会大到不好滑 */
export const SWIPE_MAX_DISTANCE_PX = 96
/** 轻扫速度阈值（px/ms），超过就按速度方向翻页 */
export const SWIPE_VELOCITY = 0.35
/** 轻扫翻页要求的最小位移，避免手指刚落下的抖动就翻页 */
export const SWIPE_FLICK_MIN_DISTANCE_PX = 24
/** 首/末页继续往外拖时的阻尼系数：跟手但拖不远，松手回弹 */
export const EDGE_RESISTANCE = 0.35

/** 判定翻页所需的位移阈值（随容器宽度走，但有上限） */
export function swipeThreshold(width: number): number {
  return Math.min(width * SWIPE_DISTANCE_RATIO, SWIPE_MAX_DISTANCE_PX)
}

/** 首/末页向外拖时的阻尼；其它情况原样返回 */
export function applyEdgeResistance(deltaX: number, index: number, count: number): number {
  const atStart = index <= 0 && deltaX > 0
  const atEnd = index >= count - 1 && deltaX < 0
  return atStart || atEnd ? deltaX * EDGE_RESISTANCE : deltaX
}

export interface SwipeRelease {
  /** 松手时所在的 tab 下标 */
  index: number
  /** 松手时的水平位移（左负右正，已含边界阻尼） */
  deltaX: number
  /** 松手时的水平速度（px/ms，左负右正） */
  velocityX: number
  /** 容器宽度，用来算位移阈值 */
  width: number
  /** tab 总数 */
  count: number
}

/**
 * 松手时决定落到哪个 tab：先看轻扫速度（快扫不要求位移够），再看位移。
 * 两者都没有触发时回到原页（回弹）。
 */
export function resolveSwipeTarget({ index, deltaX, velocityX, width, count }: SwipeRelease): number {
  const canPrev = index > 0
  const canNext = index < count - 1

  if (velocityX <= -SWIPE_VELOCITY && deltaX <= -SWIPE_FLICK_MIN_DISTANCE_PX && canNext) return index + 1
  if (velocityX >= SWIPE_VELOCITY && deltaX >= SWIPE_FLICK_MIN_DISTANCE_PX && canPrev) return index - 1

  const threshold = swipeThreshold(width)
  if (deltaX <= -threshold && canNext) return index + 1
  if (deltaX >= threshold && canPrev) return index - 1

  return index
}

/** 需要渲染（挂载）的槽位：当前页 ± 1，两端各少一个 */
export function neighborIndexes(index: number, count: number): number[] {
  const result: number[] = []
  for (let i = index - 1; i <= index + 1; i++) {
    if (i >= 0 && i < count) result.push(i)
  }
  return result
}
