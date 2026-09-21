import { defineStore } from 'pinia'
import { ref } from 'vue'
import { logApi, orderSourceApi, userApi } from '../api'
import type { OrderSourceItem, UserOption } from '../api'

/**
 * 字典数据缓存。
 *
 * 这些是「变更极少、被多个页面反复读取」的选项数据：
 *   - orderSources：订单来源，原来 Orders / OrderDetail / Customers / OrderImport / OrderSourcesTab
 *     各自请求一次，同一个下拉框在切换页面时重复拉取
 *   - userOptions：仅 id/name，供司机指派选人
 *   - logUsers：只出现在操作日志筛选里的用户（曾产生过日志的人）
 *
 * 只放字典，不放业务数据（订单、车辆这些会频繁变化，缓存只会带来不一致）。
 *
 * 关键是「TTL + 手动失效」：字典本身变化少，但订单来源在设置页会被增删改，
 * 改完必须显式调 invalidateOrderSources()，否则下拉框一直显示旧数据。
 */

/** 缓存有效期（毫秒）：5 分钟 */
const TTL_MS = 5 * 60 * 1000

export const useDictStore = defineStore('dict', () => {
  const orderSources = ref<OrderSourceItem[]>([])
  const userOptions = ref<UserOption[]>([])
  const logUsers = ref<UserOption[]>([])

  const orderSourcesLoadedAt = ref(0)
  const userOptionsLoadedAt = ref(0)
  const logUsersLoadedAt = ref(0)

  /** 同一次会话内的并发调用合并成一次请求，避免多个组件同时挂载时重复拉取 */
  let orderSourcesPending: Promise<OrderSourceItem[]> | null = null
  let userOptionsPending: Promise<UserOption[]> | null = null

  function isFresh(loadedAt: number): boolean {
    return loadedAt > 0 && Date.now() - loadedAt < TTL_MS
  }

  async function ensureOrderSources(force = false): Promise<OrderSourceItem[]> {
    if (!force && isFresh(orderSourcesLoadedAt.value)) {
      return orderSources.value
    }
    if (orderSourcesPending) return orderSourcesPending

    orderSourcesPending = (async () => {
      try {
        // 不带分页参数时后端直接返回数组（见 orderSourceApi.getList 的类型）
        const res = await orderSourceApi.getList()
        orderSources.value = res.data ?? []
        orderSourcesLoadedAt.value = Date.now()
        return orderSources.value
      } catch (error) {
        console.error('加载订单来源失败', error)
        return orderSources.value
      } finally {
        orderSourcesPending = null
      }
    })()

    return orderSourcesPending
  }

  async function ensureUserOptions(force = false): Promise<UserOption[]> {
    if (!force && isFresh(userOptionsLoadedAt.value)) {
      return userOptions.value
    }
    if (userOptionsPending) return userOptionsPending

    userOptionsPending = (async () => {
      try {
        const res = await userApi.getOptions()
        userOptions.value = res.data ?? []
        userOptionsLoadedAt.value = Date.now()
        return userOptions.value
      } catch (error) {
        console.error('加载用户选项失败', error)
        return userOptions.value
      } finally {
        userOptionsPending = null
      }
    })()

    return userOptionsPending
  }

  async function ensureLogUsers(force = false): Promise<UserOption[]> {
    if (!force && isFresh(logUsersLoadedAt.value)) {
      return logUsers.value
    }
    try {
      const res = await logApi.getUsers()
      logUsers.value = res.data ?? []
      logUsersLoadedAt.value = Date.now()
    } catch (error) {
      console.error('加载日志用户失败', error)
    }
    return logUsers.value
  }

  /** 订单来源被增删改后必须调用，否则其它页面的下拉框还是旧数据 */
  function invalidateOrderSources(): void {
    orderSourcesLoadedAt.value = 0
  }

  /** 用户被增删改或启用状态变化后调用 */
  function invalidateUserOptions(): void {
    userOptionsLoadedAt.value = 0
  }

  /** 退出登录时清空，避免下一个登录的人看到上一个人的缓存 */
  function reset(): void {
    orderSources.value = []
    userOptions.value = []
    logUsers.value = []
    orderSourcesLoadedAt.value = 0
    userOptionsLoadedAt.value = 0
    logUsersLoadedAt.value = 0
  }

  return {
    orderSources,
    userOptions,
    logUsers,
    ensureOrderSources,
    ensureUserOptions,
    ensureLogUsers,
    invalidateOrderSources,
    invalidateUserOptions,
    reset
  }
})
