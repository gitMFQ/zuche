import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useDictStore } from './dict'

export interface User {
  id: string
  username: string
  name: string
  role: string
  phone?: string
  email?: string
}

export interface UserThemeSettings {
  darkMode: boolean
  autoDarkMode: boolean
}

const THEME_STORAGE_KEY = 'user_theme_settings'

const defaultThemeSettings: UserThemeSettings = {
  darkMode: false,
  autoDarkMode: true
}

function loadThemeSettings(): UserThemeSettings {
  const fallback = { ...defaultThemeSettings }
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<UserThemeSettings>
      // 只取仍在使用的字段，旧的 themeColor 等废弃字段直接丢弃
      const cleaned: UserThemeSettings = {
        darkMode: typeof parsed.darkMode === 'boolean' ? parsed.darkMode : fallback.darkMode,
        autoDarkMode: typeof parsed.autoDarkMode === 'boolean' ? parsed.autoDarkMode : fallback.autoDarkMode
      }
      // 立即覆盖写回，抹掉老用户 localStorage 里的废弃字段
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(cleaned))
      return cleaned
    }
  } catch {
    // localStorage 不可用或数据损坏时回退到默认值
  }
  return fallback
}

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem('token') || '')
  const user = ref<User | null>(null)
  /** 是否必须先改密码（默认口令 admin123 未改）。由登录/获取用户信息接口设置 */
  const mustChangePassword = ref(false)

  // 用户主题设置
  const themeSettings = ref<UserThemeSettings>(loadThemeSettings())

  // 监听主题设置变化，自动保存到 localStorage
  watch(themeSettings, (newSettings) => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newSettings))
    // 触发事件通知布局更新
    window.dispatchEvent(new CustomEvent('darkModeChange', { detail: newSettings.darkMode }))
    window.dispatchEvent(new CustomEvent('autoDarkModeChange', { detail: newSettings.autoDarkMode }))
  }, { deep: true })

  function setToken(newToken: string) {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  function setUser(newUser: User) {
    user.value = newUser
  }

  function logout() {
    token.value = ''
    user.value = null
    mustChangePassword.value = false
    localStorage.removeItem('token')
    // 清掉字典缓存，避免下一个登录的人看到上一个人的缓存数据
    useDictStore().reset()
    // 注意：不清除主题设置，保留用户的深色模式偏好
  }

  function isLoggedIn() {
    return !!token.value
  }

  function isAdmin() {
    return user.value?.role === 'admin'
  }

  // 主题设置方法
  function updateThemeSettings(settings: Partial<UserThemeSettings>) {
    if (settings.darkMode !== undefined) {
      themeSettings.value.darkMode = settings.darkMode
    }
    if (settings.autoDarkMode !== undefined) {
      themeSettings.value.autoDarkMode = settings.autoDarkMode
    }
  }

  function setDarkMode(enabled: boolean) {
    themeSettings.value.autoDarkMode = false
    themeSettings.value.darkMode = enabled
  }

  function setAutoDarkMode(enabled: boolean) {
    themeSettings.value.autoDarkMode = enabled
    if (enabled) {
      themeSettings.value.darkMode = getSystemPrefersDark()
    }
  }

  function applySystemDarkMode() {
    if (themeSettings.value.autoDarkMode) {
      themeSettings.value.darkMode = getSystemPrefersDark()
    }
  }

  return {
    token,
    user,
    mustChangePassword,
    themeSettings,
    setToken,
    setUser,
    logout,
    isLoggedIn,
    isAdmin,
    updateThemeSettings,
    setDarkMode,
    setAutoDarkMode,
    applySystemDarkMode,
    getSystemPrefersDark
  }
})
