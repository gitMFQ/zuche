import { describe, expect, it } from 'vitest'
import { matchTabPath } from '../frontend/src/utils/nav'

describe('matchTabPath', () => {
  it('顶级路径命中自身', () => {
    expect(matchTabPath('/dashboard')).toBe('/dashboard')
    expect(matchTabPath('/vehicles')).toBe('/vehicles')
    expect(matchTabPath('/finance')).toBe('/finance')
    expect(matchTabPath('/customers')).toBe('/customers')
    expect(matchTabPath('/orders')).toBe('/orders')
  })

  // 订单有两个子路由：/orders/import 与 /orders/:id。用全等匹配的话进详情页后
  // 底部「订单」标签不亮，这是最容易漏的一处
  it('订单子路径归属订单标签', () => {
    expect(matchTabPath('/orders/import')).toBe('/orders')
    expect(matchTabPath('/orders/abc123')).toBe('/orders')
  })

  it('不归属任何标签的路径返回空串', () => {
    expect(matchTabPath('/settings')).toBe('')
    expect(matchTabPath('/login')).toBe('')
    expect(matchTabPath('/')).toBe('')
    expect(matchTabPath('/unknown/path')).toBe('')
  })

  // 前缀后面必须是 `/`，否则 /orders-xxx 这种无关路径会被误判
  it('前缀后面不是斜杠时不算命中', () => {
    expect(matchTabPath('/orders-archive')).toBe('')
    expect(matchTabPath('/vehicles2')).toBe('')
  })
})
