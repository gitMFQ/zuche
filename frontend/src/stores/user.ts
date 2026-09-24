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
  headerGaussianBlur: boolean
  headerLiquidGlass: boolean
  bottomFloating: boolean
  bottomGaussianBlur: boolean
  bottomLiquidGlass: boolean
  glassOpacity: number
}

const THEME_STORAGE_KEY = 'user_theme_settings'
const GLASS_OPACITY_MIN = 20
const GLASS_OPACITY_MAX = 100

function clampGlassOpacity(value: number): number {
  return Math.min(GLASS_OPACITY_MAX, Math.max(GLASS_OPACITY_MIN, value))
}

const defaultThemeSettings: UserThemeSettings = {
  darkMode: false,
  autoDarkMode: true,
  headerGaussianBlur: false,
  headerLiquidGlass: false,
  bottomFloating: false,
  bottomGaussianBlur: false,
  bottomLiquidGlass: false,
  glassOpacity: 60
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
        autoDarkMode: typeof parsed.autoDarkMode === 'boolean' ? parsed.autoDarkMode : fallback.autoDarkMode,
        headerGaussianBlur: typeof parsed.headerGaussianBlur === 'boolean' ? parsed.headerGaussianBlur : fallback.headerGaussianBlur,
        headerLiquidGlass: typeof parsed.headerLiquidGlass === 'boolean' ? parsed.headerLiquidGlass : fallback.headerLiquidGlass,
        bottomFloating: typeof parsed.bottomFloating === 'boolean' ? parsed.bottomFloating : fallback.bottomFloating,
        bottomGaussianBlur: typeof parsed.bottomGaussianBlur === 'boolean' ? parsed.bottomGaussianBlur : fallback.bottomGaussianBlur,
        bottomLiquidGlass: typeof parsed.bottomLiquidGlass === 'boolean' ? parsed.bottomLiquidGlass : fallback.bottomLiquidGlass,
        glassOpacity: typeof parsed.glassOpacity === 'number' && Number.isFinite(parsed.glassOpacity)
          ? clampGlassOpacity(parsed.glassOpacity)
          : fallback.glassOpacity
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

  function applyGlassOpacity(opacity: number) {
    document.documentElement.style.setProperty('--glass-opacity', String(clampGlassOpacity(opacity) / 100))
  }

  applyGlassOpacity(themeSettings.value.glassOpacity)

  // 监听主题设置变化，自动保存到 localStorage
  watch(themeSettings, (newSettings) => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newSettings))
    applyGlassOpacity(newSettings.glassOpacity)
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
    if (settings.glassOpacity !== undefined && Number.isFinite(settings.glassOpacity)) {
      themeSettings.value.glassOpacity = clampGlassOpacity(settings.glassOpacity)
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

  function setHeaderGaussianBlur(enabled: boolean) {
    themeSettings.value.headerGaussianBlur = enabled
    if (enabled) themeSettings.value.headerLiquidGlass = false
  }

  function setHeaderLiquidGlass(enabled: boolean) {
    themeSettings.value.headerLiquidGlass = enabled
    if (enabled) themeSettings.value.headerGaussianBlur = false
  }

  function setBottomFloating(enabled: boolean) {
    themeSettings.value.bottomFloating = enabled
  }

  function setBottomGaussianBlur(enabled: boolean) {
    themeSettings.value.bottomGaussianBlur = enabled
    if (enabled) themeSettings.value.bottomLiquidGlass = false
  }

  function setBottomLiquidGlass(enabled: boolean) {
    themeSettings.value.bottomLiquidGlass = enabled
    if (enabled) themeSettings.value.bottomGaussianBlur = false
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
    setHeaderGaussianBlur,
    setHeaderLiquidGlass,
    setBottomFloating,
    setBottomGaussianBlur,
    setBottomLiquidGlass,
    applySystemDarkMode,
    getSystemPrefersDark
  }
})
