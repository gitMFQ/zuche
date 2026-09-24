import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 请求闸门的单测。
 *
 * 真实场景里「请求属于哪个 tab」是靠 Vue 的 currentInstance 认出来的（见
 * utils/tabRequestGate.ts 的注释），node 里没有组件实例，所以这里把 vue 的
 * getCurrentInstance 换成一个可切换的假实例，模拟「请求是从某个槽的子树里发出的」。
 */
const vueState = vi.hoisted(() => ({
  current: null as unknown
}))

vi.mock('vue', () => ({
  getCurrentInstance: () => vueState.current
}))

const { gateTabRequest, registerTabSlot, setActiveTab, unregisterTabSlot } = await import(
  '../frontend/src/utils/tabRequestGate'
)

/** 造一个「槽实例 → 子组件实例」的两层链，模拟页面里的请求从子组件发出 */
function slotWithChild(): { slot: object; child: object } {
  const slot: { parent: null } = { parent: null }
  const child = { parent: slot }
  return { slot, child }
}

beforeEach(() => {
  vueState.current = null
  // 清掉上一个用例可能残留的激活 tab
  setActiveTab('')
})

describe('gateTabRequest', () => {
  it('激活 tab 里的请求直接放行', () => {
    const { slot, child } = slotWithChild()
    registerTabSlot(slot, '/orders')
    setActiveTab('/orders')
    vueState.current = child
    expect(gateTabRequest()).toBeNull()
  })

  it('不在任何槽里的请求直接放行（弹窗、布局自身等）', () => {
    setActiveTab('/orders')
    vueState.current = { parent: null }
    expect(gateTabRequest()).toBeNull()
  })

  it('相邻 tab 的请求被挂住，直到该 tab 被进入才放行', async () => {
    const { slot, child } = slotWithChild()
    registerTabSlot(slot, '/vehicles')
    setActiveTab('/orders')

    vueState.current = child
    const gate = gateTabRequest()
    expect(gate).not.toBeNull()

    let released = false
    void gate?.then(() => {
      released = true
    })

    // 还没进入 vehicles：不能放行
    await Promise.resolve()
    expect(released).toBe(false)

    setActiveTab('/vehicles')
    await Promise.resolve()
    expect(released).toBe(true)
  })

  it('同一个 tab 上挂起的多个请求一起放行', async () => {
    const first = slotWithChild()
    const second = slotWithChild()
    registerTabSlot(first.slot, '/finance')
    registerTabSlot(second.slot, '/finance')
    setActiveTab('/customers')

    vueState.current = first.child as never
    const a = gateTabRequest()
    vueState.current = second.child as never
    const b = gateTabRequest()

    let done = 0
    void a?.then(() => {
      done += 1
    })
    void b?.then(() => {
      done += 1
    })

    await Promise.resolve()
    expect(done).toBe(0)

    setActiveTab('/finance')
    await Promise.resolve()
    expect(done).toBe(2)
  })

  it('注销过的槽不再算作归属（组件已卸载）', () => {
    const { slot, child } = slotWithChild()
    registerTabSlot(slot, '/orders')
    unregisterTabSlot(slot)
    setActiveTab('/dashboard')

    vueState.current = child
    expect(gateTabRequest()).toBeNull()
  })

  it('激活 tab 为空（容器没在跑）时一律放行，避免容器卸载瞬间把请求挂死', () => {
    const { slot, child } = slotWithChild()
    registerTabSlot(slot, '/orders')
    setActiveTab('')

    vueState.current = child
    expect(gateTabRequest()).toBeNull()
  })
})
