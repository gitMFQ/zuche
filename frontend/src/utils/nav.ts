/**
 * 移动端底部 tabbar 的路径匹配。
 *
 * 为什么不用 route.meta：本项目路由是扁平的（/orders、/orders/import、/orders/:id 并列），
 * 没有可用来归组的 meta 字段，加一个要改 5 条路由定义；前缀匹配是一行纯函数，还能单测。
 *
 * 顺序即 tabbar 的显示顺序。
 */
export const TAB_PATHS = ['/dashboard', '/orders', '/vehicles', '/finance', '/customers'] as const

export type TabPath = (typeof TAB_PATHS)[number]

/**
 * 返回 path 归属的 tab，没有归属时返回空串（如 /settings 不在 tabbar 里）。
 *
 * 必须按前缀匹配而不是全等：/orders/import（批量导入）与 /orders/:id（订单详情）
 * 都是订单的子路径，用全等的话进详情页后底部「订单」标签就不亮了。
 * 前缀后面要求是 `/`，否则 /orders-xxx 这种无关路径会被误判成订单。
 */
export function matchTabPath(path: string): TabPath | '' {
  return TAB_PATHS.find((p) => path === p || path.startsWith(`${p}/`)) ?? ''
}
