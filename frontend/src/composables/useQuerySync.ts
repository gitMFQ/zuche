import { useRoute, useRouter } from 'vue-router'

type ScalarState = Record<string, unknown>

/**
 * 把列表页的筛选条件与分页同步到 URL query。
 *
 * 改造前筛选与分页只存在组件内存里，刷新页面就全部丢失，也没法把
 * 「某个渠道的待取车订单」这样的视图发给同事。这里把状态与 URL 双向对齐：
 *   - restore() 在挂载时从 URL 恢复（要在首次 loadData 之前调用）
 *   - sync()    在筛选/分页变化后写回 URL
 *
 * 用 router.replace 而不是 push：改筛选不该往浏览器历史里塞记录，
 * 否则用户点「后退」会被一层层筛选条件卡住。
 */
export function useQuerySync(
  state: ScalarState,
  pagination: { page: number; pageSize: number },
  options: { defaultPageSize?: number } = {}
) {
  const route = useRoute()
  const router = useRouter()
  const defaultPageSize = options.defaultPageSize ?? pagination.pageSize

  /** 从 URL query 恢复到 state 与分页，返回是否有可恢复的内容 */
  function restore(): boolean {
    const query = route.query
    let restored = false

    for (const key of Object.keys(state)) {
      const value = query[key]
      if (typeof value === 'string' && value !== '') {
        state[key] = value
        restored = true
      }
    }

    const page = Number(query.page)
    if (Number.isFinite(page) && page > 1) {
      pagination.page = Math.floor(page)
      restored = true
    }

    const pageSize = Number(query.pageSize)
    if (Number.isFinite(pageSize) && pageSize > 0) {
      pagination.pageSize = Math.floor(pageSize)
      restored = true
    }

    return restored
  }

  /** 把当前状态压成 query 对象（空值不写进 URL，保持地址干净） */
  function snapshot(): Record<string, string> {
    const query: Record<string, string> = {}

    for (const [key, value] of Object.entries(state)) {
      if (typeof value === 'string' && value !== '') {
        query[key] = value
      }
    }

    // 默认值不写：只有偏离默认才需要出现在地址里
    if (pagination.page > 1) {
      query.page = String(pagination.page)
    }
    if (pagination.pageSize !== defaultPageSize) {
      query.pageSize = String(pagination.pageSize)
    }

    return query
  }

  function sync(): void {
    const query = snapshot()
    // 内容没变就别 replace，避免无意义的导航
    if (JSON.stringify(query) === JSON.stringify(route.query)) return
    void router.replace({ query })
  }

  return { restore, sync, snapshot }
}
