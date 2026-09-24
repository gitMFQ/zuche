import { describe, expect, it } from 'vitest'
import {
  EDGE_RESISTANCE,
  SWIPE_MAX_DISTANCE_PX,
  applyEdgeResistance,
  neighborIndexes,
  resolveSwipeTarget,
  swipeThreshold
} from '../frontend/src/utils/tabSwipe'

/** 375px 宽的典型手机屏 */
const WIDTH = 375
const COUNT = 5

function target(index: number, deltaX: number, velocityX = 0, width = WIDTH): number {
  return resolveSwipeTarget({ index, deltaX, velocityX, width, count: COUNT })
}

describe('swipeThreshold', () => {
  it('按容器宽度取比例', () => {
    expect(swipeThreshold(200)).toBe(44)
  })

  it('大屏上有上限，否则要滑很长一段才翻页', () => {
    expect(swipeThreshold(2000)).toBe(SWIPE_MAX_DISTANCE_PX)
  })
})

describe('applyEdgeResistance', () => {
  it('中间页不衰减', () => {
    expect(applyEdgeResistance(120, 2, COUNT)).toBe(120)
    expect(applyEdgeResistance(-120, 2, COUNT)).toBe(-120)
  })

  it('首页向右、末页向左衰减', () => {
    expect(applyEdgeResistance(100, 0, COUNT)).toBe(100 * EDGE_RESISTANCE)
    expect(applyEdgeResistance(-100, COUNT - 1, COUNT)).toBe(-100 * EDGE_RESISTANCE)
  })

  it('首页向左、末页向右是正常翻页方向，不衰减', () => {
    expect(applyEdgeResistance(-100, 0, COUNT)).toBe(-100)
    expect(applyEdgeResistance(100, COUNT - 1, COUNT)).toBe(100)
  })
})

describe('resolveSwipeTarget', () => {
  it('位移不够就回弹', () => {
    expect(target(2, -30)).toBe(2)
    expect(target(2, 30)).toBe(2)
    expect(target(2, 0)).toBe(2)
  })

  it('左滑超过阈值去下一页，右滑去上一页', () => {
    expect(target(2, -120)).toBe(3)
    expect(target(2, 120)).toBe(1)
  })

  it('阈值随宽度变化（窄屏更容易触发）', () => {
    // 窄屏（200px）阈值 44px，120px 的位移够；宽屏（2000px）阈值 96px 也够
    expect(target(2, -50, 0, 200)).toBe(3)
    // 60px 位移在窄屏够、在 2000px 宽屏不够
    expect(target(2, -60, 0, 200)).toBe(3)
    expect(target(2, -60, 0, 2000)).toBe(2)
  })

  it('快速轻扫：位移小但速度够也翻页', () => {
    expect(target(2, -30, -0.8)).toBe(3)
    expect(target(2, 30, 0.8)).toBe(1)
  })

  it('速度够但位移太小（手指抖一下）不翻页', () => {
    expect(target(2, -10, -0.8)).toBe(2)
  })

  it('速度不够时按位移判定', () => {
    expect(target(2, -120, -0.1)).toBe(3)
  })

  it('首页右滑、末页左滑都被挡住', () => {
    expect(target(0, 200, 2)).toBe(0)
    expect(target(COUNT - 1, -200, -2)).toBe(COUNT - 1)
  })

  it('首页左滑、末页右滑照常翻页', () => {
    expect(target(0, -200, -2)).toBe(1)
    expect(target(COUNT - 1, 200, 2)).toBe(COUNT - 2)
  })

  it('目标下标始终落在合法范围内', () => {
    for (let index = 0; index < COUNT; index++) {
      for (const deltaX of [-1000, -120, 0, 120, 1000]) {
        const result = target(index, deltaX, deltaX < 0 ? -1 : 1)
        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThanOrEqual(COUNT - 1)
      }
    }
  })
})

describe('neighborIndexes', () => {
  it('中间页给出左右两页', () => {
    expect(neighborIndexes(2, COUNT)).toEqual([1, 2, 3])
  })

  it('两端各少一个', () => {
    expect(neighborIndexes(0, COUNT)).toEqual([0, 1])
    expect(neighborIndexes(COUNT - 1, COUNT)).toEqual([COUNT - 2, COUNT - 1])
  })
})
