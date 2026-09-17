<template>
  <el-container class="layout-container">
    <!-- 移动端遮罩 -->
    <div 
      v-if="isMobile && !isCollapse" 
      class="mobile-mask"
      @click="isCollapse = true"
    />

    <!-- 侧边栏 -->
    <el-aside 
      :width="isMobile ? '240px' : (isCollapse ? '72px' : '240px')" 
      :class="['aside', `sidebar-${sidebarStyle}`, { 'aside-mobile-hidden': isMobile && isCollapse }]"
      :style="sidebarBgStyle"
    >
      <div class="logo">
        <div class="logo-icon" :style="logoIconStyle">
          <img v-if="systemLogo" :src="systemLogo" alt="Logo" class="logo-img" />
          <el-icon v-else :size="26"><Car /></el-icon>
        </div>
        <span v-show="!isCollapse || isMobile" class="logo-text">{{ systemTitle }}</span>
      </div>
      <nav class="nav-menu">
        <router-link to="/dashboard" class="nav-item" :class="{ active: activeMenu === '/dashboard' }" @click="handleMenuSelect">
          <div class="nav-icon"><el-icon :size="20"><DataAnalysis /></el-icon></div>
          <span v-show="!isCollapse || isMobile" class="nav-text">首页</span>
        </router-link>
        <router-link to="/vehicles" class="nav-item" :class="{ active: activeMenu === '/vehicles' }" @click="handleMenuSelect">
          <div class="nav-icon"><el-icon :size="20"><Van /></el-icon></div>
          <span v-show="!isCollapse || isMobile" class="nav-text">车辆管理</span>
        </router-link>
        <router-link to="/orders" class="nav-item" :class="{ active: activeMenu === '/orders' }" @click="handleMenuSelect">
          <div class="nav-icon"><el-icon :size="20"><Document /></el-icon></div>
          <span v-show="!isCollapse || isMobile" class="nav-text">订单管理</span>
        </router-link>
        <router-link to="/customers" class="nav-item" :class="{ active: activeMenu === '/customers' }" @click="handleMenuSelect">
          <div class="nav-icon"><el-icon :size="20"><User /></el-icon></div>
          <span v-show="!isCollapse || isMobile" class="nav-text">客户管理</span>
        </router-link>
        <router-link to="/blacklist" class="nav-item" :class="{ active: activeMenu === '/blacklist' }" @click="handleMenuSelect">
          <div class="nav-icon"><el-icon :size="20"><CircleClose /></el-icon></div>
          <span v-show="!isCollapse || isMobile" class="nav-text">黑名单</span>
        </router-link>
        <router-link v-if="isAdmin" to="/logs" class="nav-item" :class="{ active: activeMenu === '/logs' }" @click="handleMenuSelect">
          <div class="nav-icon"><el-icon :size="20"><List /></el-icon></div>
          <span v-show="!isCollapse || isMobile" class="nav-text">操作日志</span>
        </router-link>
        <router-link v-if="isAdmin" to="/settings" class="nav-item" :class="{ active: activeMenu === '/settings' }" @click="handleMenuSelect">
          <div class="nav-icon"><el-icon :size="20"><Setting /></el-icon></div>
          <span v-show="!isCollapse || isMobile" class="nav-text">设置</span>
        </router-link>
      </nav>
      <div class="sidebar-footer" v-show="!isCollapse || isMobile">
        <div class="user-card">
          <el-avatar :size="36" icon="UserFilled" />
          <div class="user-info">
            <span class="user-name">{{ userStore.user?.name }}</span>
            <span class="user-role">{{ userStore.isAdmin() ? '管理员' : '员工' }}</span>
          </div>
        </div>
      </div>
    </el-aside>

    <!-- 主内容区 -->
    <el-container class="main-container">
      <!-- 顶部栏 -->
      <el-header class="header">
        <div class="header-left">
          <el-button 
            class="collapse-btn" 
            @click="isCollapse = !isCollapse"
            :icon="isCollapse ? 'Expand' : 'Fold'"
            circle
            size="large"
          />
          <el-breadcrumb separator="/" class="breadcrumb">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-button
            class="theme-toggle-btn"
            :icon="isDarkMode ? 'Moon' : 'Sunny'"
            circle
            size="large"
            @click="toggleDarkMode"
            :title="isDarkMode ? '切换到浅色模式' : '切换到深色模式'"
          />
          <el-dropdown @command="handleCommand" trigger="click">
            <span class="user-dropdown">
              <el-avatar :size="32" icon="UserFilled" />
              <span class="user-name hide-mobile">{{ userStore.user?.name }}</span>
              <el-icon class="hide-mobile"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="password">修改密码</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :is-mobile="isMobile" />
          </transition>
        </router-view>
      </el-main>
    </el-container>

    <!-- 修改密码对话框 -->
    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="90%" :style="{ maxWidth: '400px' }">
      <el-form :model="passwordForm" :rules="passwordRules" ref="passwordFormRef" label-width="80px">
        <el-form-item label="旧密码" prop="oldPassword">
          <el-input v-model="passwordForm.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="passwordForm.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleChangePassword">确定</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useUserStore } from '../stores/user'
import { authApi, settingsApi } from '../api'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const isMobile = ref(false)
const isCollapse = ref(true)
const passwordDialogVisible = ref(false)
const passwordFormRef = ref<FormInstance>()
const systemTitle = ref('租车管理系统')
const systemLogo = ref('')

const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// 主题设置从 userStore 获取
const themeColor = computed(() => userStore.themeSettings.themeColor)
const sidebarStyle = computed(() => userStore.themeSettings.sidebarStyle)
const customSidebarColorStart = computed(() => userStore.themeSettings.customSidebarColorStart)
const customSidebarColorEnd = computed(() => userStore.themeSettings.customSidebarColorEnd)
const isDarkMode = computed(() => userStore.themeSettings.darkMode)

// Toggle deep/shallow theme
const toggleDarkMode = () => {
  userStore.setDarkMode(!isDarkMode.value);
};

// Global handler for darkModeChange events to sync HTML class
const onDarkModeChange = (ev: Event) => {
  const detail = (ev as CustomEvent<boolean>).detail;
  if (detail) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

onMounted(() => {
  // Initialize based on current setting
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark');
  }
  window.addEventListener('darkModeChange', onDarkModeChange as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('darkModeChange', onDarkModeChange as EventListener);
});

const passwordRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (_, value, callback) => {
        if (value !== passwordForm.value.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const activeMenu = computed(() => route.path)
const currentTitle = computed(() => route.meta.title as string || '')
const isAdmin = computed(() => userStore.isAdmin())

// 侧边栏背景样式
const sidebarBgStyle = computed(() => {
  // 如果有自定义颜色，使用自定义渐变
  if (customSidebarColorStart.value || customSidebarColorEnd.value) {
    const startColor = customSidebarColorStart.value || customSidebarColorEnd.value || '#1a1f36'
    const endColor = customSidebarColorEnd.value || customSidebarColorStart.value || '#1e2640'
    return {
      background: `linear-gradient(180deg, ${startColor} 0%, ${endColor} 100%)`
    }
  }
  // 否则使用预设风格
  const styles: Record<string, string> = {
    'default': 'linear-gradient(180deg, #1a1f36 0%, #252d4a 50%, #1e2640 100%)',
    'dark': 'linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)',
    'blue': 'linear-gradient(180deg, #0d1b2a 0%, #1b3a4b 50%, #0d1b2a 100%)',
    'green': 'linear-gradient(180deg, #0d1912 0%, #1a2f1f 50%, #0d1912 100%)',
    'purple': 'linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 50%, #1a0a2e 100%)',
    'brown': 'linear-gradient(180deg, #1a1209 0%, #2d2418 50%, #1a1209 100%)'
  }
  return { background: styles[sidebarStyle.value] || styles['default'] }
})

// 将颜色转换为带透明度的格式
function colorWithAlpha(color: string, alpha: number): string {
  // 处理 rgba 格式
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`
  }
  
  // 处理 hex 格式
  let hex = color.replace('#', '')
  if (hex.length === 8) {
    hex = hex.slice(0, 6) // 移除原有的透明度
  }
  
  const num = parseInt(hex, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// 菜单项悬停背景样式
const navItemHoverBg = computed(() => {
  const color1 = colorWithAlpha(themeColor.value, 0.25)
  const color2 = colorWithAlpha(adjustColor(themeColor.value, -20), 0.25)
  return `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`
})

// 菜单项激活背景样式
const navItemActiveBg = computed(() => {
  return `linear-gradient(135deg, ${themeColor.value} 0%, ${adjustColor(themeColor.value, -20)} 100%)`
})

// 菜单项激活阴影样式
const navItemActiveShadow = computed(() => {
  const shadowColor = colorWithAlpha(themeColor.value, 0.4)
  return `0 4px 15px ${shadowColor}`
})

// Logo 图标样式
const logoIconStyle = computed(() => {
  return {
    background: `linear-gradient(135deg, ${themeColor.value} 0%, ${adjustColor(themeColor.value, -20)} 100%)`
  }
})

async function loadSystemTitle() {
  try {
    const res: any = await settingsApi.getAll()
    if (res.success && res.data) {
      if (res.data.system_title) {
        systemTitle.value = res.data.system_title
      }
      if (res.data.system_logo) {
        systemLogo.value = res.data.system_logo
      }
    }
  } catch (error) {
    console.error('加载系统设置失败', error)
  }
  
  // 应用用户主题设置
  if (themeColor.value) {
    updateThemeVariables(themeColor.value)
  }
}

function handleTitleChange(e: CustomEvent) {
  systemTitle.value = e.detail
}

function handleLogoChange(e: CustomEvent) {
  systemLogo.value = e.detail
}

function handleThemeColorChange(e: CustomEvent) {
  const color = e.detail
  if (color && typeof color === 'string') {
    userStore.setThemeColor(color)
    updateThemeVariables(color)
  }
}

function handleSidebarStyleChange(e: CustomEvent) {
  userStore.setSidebarStyle(e.detail)
}

function handleCustomSidebarColorStartChange(e: CustomEvent) {
  const color = e.detail
  userStore.setCustomSidebarColors((color && typeof color === 'string') ? color : '', customSidebarColorEnd.value)
}

function handleCustomSidebarColorEndChange(e: CustomEvent) {
  const color = e.detail
  userStore.setCustomSidebarColors(customSidebarColorStart.value, (color && typeof color === 'string') ? color : '')
}

function handleAutoDarkModeChange(e: CustomEvent) {
  if (e.detail) {
    userStore.applySystemDarkMode()
  }
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) {
    isCollapse.value = true
  } else {
    isCollapse.value = false
  }
}

// 颜色调整函数
function adjustColor(color: string, amount: number): string {
  // 处理 rgba 格式
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgbaMatch) {
    let r = parseInt(rgbaMatch[1]) + amount
    let g = parseInt(rgbaMatch[2]) + amount
    let b = parseInt(rgbaMatch[3]) + amount
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
    r = Math.max(0, Math.min(255, r))
    g = Math.max(0, Math.min(255, g))
    b = Math.max(0, Math.min(255, b))
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }
  
  // 处理 hex 格式（包括带透明度的 8 位 hex）
  let hex = color.replace('#', '')
  let alpha = 1
  
  if (hex.length === 8) {
    alpha = parseInt(hex.slice(6, 8), 16) / 255
    hex = hex.slice(0, 6)
  }
  
  if (hex.length === 6) {
    const num = parseInt(hex, 16)
    let r = (num >> 16) + amount
    let g = ((num >> 8) & 0x00FF) + amount
    let b = (num & 0x0000FF) + amount
    r = Math.max(0, Math.min(255, r))
    g = Math.max(0, Math.min(255, g))
    b = Math.max(0, Math.min(255, b))
    
    if (alpha < 1) {
      return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`
    }
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  }
  
  return color
}

// 将颜色转换为RGB格式
function hexToRgb(color: string): { r: number; g: number; b: number } {
  // 处理 rgba 格式
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3])
    }
  }
  
  // 处理 hex 格式
  const hex = color.replace('#', '').slice(0, 6)
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 102, g: 126, b: 234 }
}

// 更新全局CSS变量
function updateThemeVariables(color: string) {
  const root = document.documentElement
  const rgb = hexToRgb(color)
  root.style.setProperty('--primary-color', color)
  root.style.setProperty('--primary-color-light', adjustColor(color, 20))
  root.style.setProperty('--primary-color-dark', adjustColor(color, -20))
  root.style.setProperty('--primary-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`)
}

function handleMenuSelect() {
  if (isMobile.value) {
    isCollapse.value = true
  }
}

onMounted(async () => {
  checkMobile()
  loadSystemTitle()
  window.addEventListener('resize', checkMobile)
  window.addEventListener('systemTitleChange', handleTitleChange as EventListener)
  window.addEventListener('systemLogoChange', handleLogoChange as EventListener)
  window.addEventListener('themeColorChange', handleThemeColorChange as EventListener)
  window.addEventListener('sidebarStyleChange', handleSidebarStyleChange as EventListener)
  window.addEventListener('customSidebarColorStartChange', handleCustomSidebarColorStartChange as EventListener)
  window.addEventListener('customSidebarColorEndChange', handleCustomSidebarColorEndChange as EventListener)
  window.addEventListener('autoDarkModeChange', handleAutoDarkModeChange as EventListener)
  
  if (!userStore.user) {
    try {
      const res: any = await authApi.getCurrentUser()
      if (res.success) {
        userStore.setUser(res.data)
      }
    } catch (error) {
      console.error('获取用户信息失败', error)
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('systemTitleChange', handleTitleChange as EventListener)
  window.removeEventListener('systemLogoChange', handleLogoChange as EventListener)
  window.removeEventListener('themeColorChange', handleThemeColorChange as EventListener)
  window.removeEventListener('sidebarStyleChange', handleSidebarStyleChange as EventListener)
  window.removeEventListener('customSidebarColorStartChange', handleCustomSidebarColorStartChange as EventListener)
  window.removeEventListener('customSidebarColorEndChange', handleCustomSidebarColorEndChange as EventListener)
  window.removeEventListener('autoDarkModeChange', handleAutoDarkModeChange as EventListener)
})

function handleCommand(command: string) {
  if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      userStore.logout()
      router.push('/login')
    })
  } else if (command === 'password') {
    passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
    passwordDialogVisible.value = true
  }
}

async function handleChangePassword() {
  const valid = await passwordFormRef.value?.validate()
  if (!valid) return

  try {
    const res: any = await authApi.changePassword({
      oldPassword: passwordForm.value.oldPassword,
      newPassword: passwordForm.value.newPassword
    })
    if (res.success) {
      ElMessage.success('密码修改成功')
      passwordDialogVisible.value = false
    }
  } catch (error) {
    console.error('修改密码失败', error)
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
  background-color: var(--sk-bg-light-gray);
}

html.dark .layout-container {
  background-color: var(--sk-bg-pure-black);
}

.aside {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  box-shadow: none;
  background-color: var(--sk-bg-pure-black);
}

.aside::before {
  content: none;
}

.aside-mobile-hidden {
  transform: translateX(-100%);
}

.mobile-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 1000;
}

.logo {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  position: relative;
  z-index: 1;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(0, 0, 0, 0.8);
}

.logo-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: none;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--sk-focus-color);
}

.logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.logo-text {
  white-space: nowrap;
  color: #fff;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.224px;
}

.nav-menu {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  position: relative;
  z-index: 1;
  background-color: var(--sk-bg-pure-black);
}

.nav-menu::-webkit-scrollbar {
  width: 4px;
}

.nav-menu::-webkit-scrollbar-track {
  background: transparent;
}

.nav-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 2px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

.nav-item::before {
  content: none;
}

.nav-item:hover {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
}

.nav-item.active {
  color: #fff;
  background-color: var(--sk-focus-color);
}

.nav-item.active::before {
  opacity: 0;
}

.nav-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-radius: 6px;
  margin-right: 12px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  transition: all 0.2s ease;
}

.nav-item:hover .nav-icon {
  background: rgba(255, 255, 255, 0.1);
}

.nav-item.active .nav-icon {
  background: rgba(255, 255, 255, 0.2);
}

.nav-text {
  font-size: 14px;
  font-weight: 400;
  position: relative;
  z-index: 1;
  white-space: nowrap;
  letter-spacing: -0.224px;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  z-index: 1;
  background-color: rgba(0, 0, 0, 0.8);
}

.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.user-card:hover {
  background: rgba(255, 255, 255, 0.12);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-info .user-name {
  color: #fff;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: -0.224px;
}

.user-role {
  color: rgba(255, 255, 255, 0.6);
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 12px;
  letter-spacing: -0.12px;
}

.main-container {
  flex-direction: column;
  background-color: var(--sk-bg-light-gray);
  margin-left: 0;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

html.dark .main-container {
  background-color: var(--sk-bg-pure-black);
}

@media (min-width: 768px) {
  .main-container {
    margin-left: v-bind('isCollapse ? "72px" : "240px"');
  }

  .aside {
    position: fixed;
    transform: none !important;
  }
}

.header {
  background-color: rgba(255, 255, 255, 0.8);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  box-shadow: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 999;
  height: 48px;
}

html.dark .header {
  background-color: rgba(0, 0, 0, 0.8);
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

@media (min-width: 768px) {
  .header {
    padding: 0 24px;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-btn {
  font-size: 16px;
  border: none;
  background: transparent;
  transition: all 0.2s ease;
  color: var(--sk-text-near-black);
}

html.dark .collapse-btn {
  color: var(--sk-text-white);
}

.collapse-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  transform: none;
}

html.dark .collapse-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.collapse-btn :deep(.el-icon) {
  font-size: 18px;
}

@media (max-width: 767px) {
  .collapse-btn {
    font-size: 16px;
  }

  .collapse-btn :deep(.el-icon) {
    font-size: 18px;
  }
}

.breadcrumb {
  display: none;
}

@media (min-width: 768px) {
  .breadcrumb {
    display: block;
  }

  .breadcrumb :deep(.el-breadcrumb__item) {
    font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 14px;
  }

  .header-left {
    gap: 16px;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-toggle-btn {
  font-size: 16px;
  border: none;
  background: transparent;
  transition: all 0.2s ease;
  color: var(--sk-text-near-black);
}

html.dark .theme-toggle-btn {
  color: var(--sk-text-white);
}

.theme-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  transform: none;
}

html.dark .theme-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.theme-toggle-btn:active {
  transform: scale(0.95);
}

@media (max-width: 767px) {
  .theme-toggle-btn {
    font-size: 16px;
  }
}

.user-dropdown {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--sk-text-near-black);
  padding: 6px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
}

html.dark .user-dropdown {
  color: var(--sk-text-white);
}

.user-dropdown:hover {
  background: rgba(0, 0, 0, 0.05);
}

html.dark .user-dropdown:hover {
  background: rgba(255, 255, 255, 0.05);
}

.user-name {
  font-size: 14px;
  letter-spacing: -0.224px;
}

.hide-mobile {
  display: none;
}

@media (min-width: 768px) {
  .hide-mobile {
    display: inline;
  }
}

.main {
  padding: 16px;
  overflow-y: auto;
  min-height: calc(100vh - 48px);
  background-color: var(--sk-bg-light-gray);
}

html.dark .main {
  background-color: var(--sk-bg-pure-black);
}

@media (min-width: 768px) {
  .main {
    padding: 24px;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
