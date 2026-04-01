import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface User {
  id: string
  username: string
  name: string
  role: string
  phone?: string
  email?: string
}

export interface UserThemeSettings {
  themeColor: string
  sidebarStyle: string
  customSidebarColorStart: string
  customSidebarColorEnd: string
  darkMode: boolean
  autoDarkMode: boolean
}

const THEME_STORAGE_KEY = 'user_theme_settings'

const defaultThemeSettings: UserThemeSettings = {
  themeColor: '#667eea',
  sidebarStyle: 'default',
  customSidebarColorStart: '',
  customSidebarColorEnd: '',
  darkMode: false,
  autoDarkMode: true
}

function loadThemeSettings(): UserThemeSettings {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved) {
      return { ...defaultThemeSettings, ...JSON.parse(saved) }
    }
  } catch {
    // ignore
  }
  return { ...defaultThemeSettings }
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

  // 用户主题设置
  const themeSettings = ref<UserThemeSettings>(loadThemeSettings())

  // 监听主题设置变化，自动保存到 localStorage
  watch(themeSettings, (newSettings) => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newSettings))
    // 触发事件通知布局更新
    window.dispatchEvent(new CustomEvent('themeColorChange', { detail: newSettings.themeColor }))
    window.dispatchEvent(new CustomEvent('sidebarStyleChange', { detail: newSettings.sidebarStyle }))
    window.dispatchEvent(new CustomEvent('customSidebarColorStartChange', { detail: newSettings.customSidebarColorStart }))
    window.dispatchEvent(new CustomEvent('customSidebarColorEndChange', { detail: newSettings.customSidebarColorEnd }))
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
    localStorage.removeItem('token')
    // 注意：不清除主题设置，保留用户的主题偏好
  }

  function isLoggedIn() {
    return !!token.value
  }

  function isAdmin() {
    return user.value?.role === 'admin'
  }

  // 主题设置方法
  function setThemeColor(color: string) {
    themeSettings.value.themeColor = color
  }

  function setSidebarStyle(style: string) {
    themeSettings.value.sidebarStyle = style
  }

  function setCustomSidebarColors(start: string, end: string) {
    themeSettings.value.customSidebarColorStart = start
    themeSettings.value.customSidebarColorEnd = end
  }

  function updateThemeSettings(settings: Partial<UserThemeSettings>) {
    if (settings.themeColor !== undefined) {
      themeSettings.value.themeColor = settings.themeColor
    }
    if (settings.sidebarStyle !== undefined) {
      themeSettings.value.sidebarStyle = settings.sidebarStyle
    }
    if (settings.customSidebarColorStart !== undefined) {
      themeSettings.value.customSidebarColorStart = settings.customSidebarColorStart
    }
    if (settings.customSidebarColorEnd !== undefined) {
      themeSettings.value.customSidebarColorEnd = settings.customSidebarColorEnd
    }
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
    themeSettings,
    setToken,
    setUser,
    logout,
    isLoggedIn,
    isAdmin,
    setThemeColor,
    setSidebarStyle,
    setCustomSidebarColors,
    updateThemeSettings,
    setDarkMode,
    setAutoDarkMode,
    applySystemDarkMode,
    getSystemPrefersDark
  }
})
