<template>
  <el-container class="layout-container">
    <!-- 侧边栏：仅桌面端。移动端改用底部 tabbar（见 MobileTabbar.vue），
         抽屉与遮罩一并去掉 —— 两套导航同时存在会让人不知道该用哪个 -->
    <el-aside v-if="!isMobile" :width="isCollapse ? '72px' : '240px'" class="aside">
      <div class="logo">
        <div class="logo-icon">
          <img v-if="systemLogo" :src="getLogoUrl(systemLogo)" alt="Logo" class="logo-img" />
          <el-icon v-else :size="26"><CarIcon /></el-icon>
        </div>
        <span v-show="!isCollapse" class="logo-text">{{ systemTitle }}</span>
      </div>
      <nav class="nav-menu">
        <router-link to="/dashboard" class="nav-item" :class="{ active: activeMenu === '/dashboard' }">
          <div class="nav-icon"><el-icon :size="20"><DataAnalysis /></el-icon></div>
          <span v-show="!isCollapse" class="nav-text">总览</span>
        </router-link>
        <router-link to="/vehicles" class="nav-item" :class="{ active: activeMenu === '/vehicles' }">
          <div class="nav-icon"><el-icon :size="20"><CarIcon /></el-icon></div>
          <span v-show="!isCollapse" class="nav-text">车辆管理</span>
        </router-link>
        <router-link to="/orders" class="nav-item" :class="{ active: activeMenu === '/orders' }">
          <div class="nav-icon"><el-icon :size="20"><i class="weui-icon-outlined-note" /></el-icon></div>
          <span v-show="!isCollapse" class="nav-text">订单管理</span>
        </router-link>
        <router-link to="/finance" class="nav-item" :class="{ active: activeMenu === '/finance' }">
          <div class="nav-icon"><el-icon :size="20"><Money /></el-icon></div>
          <span v-show="!isCollapse" class="nav-text">财务</span>
        </router-link>
        <router-link to="/customers" class="nav-item" :class="{ active: activeMenu === '/customers' }">
          <div class="nav-icon"><el-icon :size="20"><i class="weui-icon-outlined-contacts" /></el-icon></div>
          <span v-show="!isCollapse" class="nav-text">客户管理</span>
        </router-link>
        <router-link v-if="isAdmin" to="/settings" class="nav-item" :class="{ active: activeMenu === '/settings' }">
          <div class="nav-icon"><el-icon :size="20"><i class="weui-icon-outlined-setting" /></el-icon></div>
          <span v-show="!isCollapse" class="nav-text">设置</span>
        </router-link>
      </nav>
      <div class="sidebar-footer" v-show="!isCollapse">
        <div class="user-card">
          <el-avatar :size="36"><i class="weui-icon-filled-me" /></el-avatar>
          <div class="user-info">
            <span class="user-name">{{ userStore.user?.name }}</span>
            <span class="user-role">{{ userStore.isAdmin() ? '管理员' : '员工' }}</span>
          </div>
        </div>
      </div>
    </el-aside>

    <!-- 主内容区 -->
    <el-container class="main-container" :class="{ 'has-floating-tabbar': isMobile && !immersive && userStore.themeSettings.bottomFloating }">
      <!-- 顶部栏。沉浸式页面（订单详情，仅移动端）把它和 tabbar 一起收起来 -->
      <el-header
        v-if="!immersive"
        class="header"
        :class="{
          'is-header-gaussian': userStore.themeSettings.headerGaussianBlur,
          'is-header-liquid': userStore.themeSettings.headerLiquidGlass
        }"
      >
        <div class="header-left">
          <!-- 移动端没有侧栏可收起，汉堡按钮一并隐藏 -->
          <el-button
            v-if="!isMobile"
            class="collapse-btn" 
            @click="isCollapse = !isCollapse"
            :icon="isCollapse ? Expand : Fold"
            :aria-label="isCollapse ? '展开侧边栏' : '收起侧边栏'"
            circle
            size="large"
          />
          <!-- 移动端没有侧栏，Logo 与系统标题放顶栏（面包屑在移动端是 display: none） -->
          <div v-if="isMobile" class="header-brand">
            <div class="logo-icon">
              <img v-if="systemLogo" :src="getLogoUrl(systemLogo)" alt="Logo" class="logo-img" />
              <el-icon v-else :size="22"><CarIcon /></el-icon>
            </div>
            <span class="header-brand__title">{{ systemTitle }}</span>
          </div>
          <el-breadcrumb separator="/" class="breadcrumb">
            <el-breadcrumb-item :to="{ path: '/' }">总览</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-button
            class="theme-toggle-btn"
            :icon="isDarkMode ? Moon : Sunny"
            circle
            size="large"
            @click="toggleDarkMode"
            :title="isDarkMode ? '切换到浅色模式' : '切换到深色模式'"
            :aria-label="isDarkMode ? '切换到浅色模式' : '切换到深色模式'"
          />
          <el-dropdown @command="handleCommand" trigger="click">
            <span class="user-dropdown">
              <el-avatar :size="32"><i class="weui-icon-filled-me" /></el-avatar>
              <span class="user-name hide-mobile">{{ userStore.user?.name }}</span>
              <el-icon class="hide-mobile"><i class="weui-icon-outlined-arrow weui-icon-arrow--down" /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <!-- 主题：移动端顶栏没有切换按钮，这里是唯一入口；桌面端与顶栏按钮并存。
                     单项轮换：自动 → 深色 → 浅色，文案与图标跟着当前模式走 -->
                <el-dropdown-item @click="cycleTheme">
                  <el-icon><component :is="themeIcon" /></el-icon>{{ themeLabel }}
                </el-dropdown-item>
                <!-- 移动端 tabbar 只有 5 项（已满），设置收进这里 -->
                <el-dropdown-item v-if="isAdmin" command="settings" divided><el-icon><i class="weui-icon-outlined-setting" /></el-icon>系统设置</el-dropdown-item>
                <el-dropdown-item command="password" :divided="!isAdmin"><el-icon><i class="weui-icon-outlined-lock" /></el-icon>修改密码</el-dropdown-item>
                <el-dropdown-item command="logout" divided><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main class="main" :class="{ 'is-immersive': immersive }">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :is-mobile="isMobile" />
          </transition>
        </router-view>
      </el-main>
    </el-container>

    <!-- 修改密码对话框。默认口令未改时必须改完才能继续用，此时不可关闭 -->
    <el-dialog
      v-model="passwordDialogVisible"
      title="修改密码"
      width="90%"
      :style="{ maxWidth: '400px' }"
      :close-on-click-modal="!mustChangePassword"
      :close-on-press-escape="!mustChangePassword"
      :show-close="!mustChangePassword"
    >
      <el-alert
        v-if="mustChangePassword"
        type="warning"
        :closable="false"
        show-icon
        title="首次登录必须修改密码"
        description="系统默认口令是公开的，请设置一个只有你知道的新密码（至少 8 位，需包含字母和数字）。"
        style="margin-bottom: 16px"
      />
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
        <el-button v-if="!mustChangePassword" @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleChangePassword">确定</el-button>
      </template>
    </el-dialog>

    <!-- 底部标签栏：移动端唯一的导航入口（沉浸式页面收起来） -->
    <MobileTabbar v-if="isMobile && !immersive" />
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { DataAnalysis, Expand, Fold, Money, Moon, Sunny, SwitchButton } from '@element-plus/icons-vue'
import { useUserStore } from '../stores/user'
import { authApi, settingsApi } from '../api'
import { getLogoUrl } from '../utils/helpers'
import { useMobile } from '../composables/useMobile'
import MobileTabbar from '../components/MobileTabbar.vue'
import CarIcon from '../components/CarIcon.vue'
import SunMoonIcon from '../components/SunMoonIcon.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
/** 默认口令未改时必须先改密，弹窗此时不可关闭 */
const mustChangePassword = computed(() => userStore.mustChangePassword)

const { isMobile } = useMobile()
const isCollapse = ref(true)

/**
 * 沉浸式页面：移动端隐藏全局顶栏与 tabbar，内容区不再自带内边距 ——
 * 由页面自己把顶部一行 sticky 到顶、底部操作行 fixed 到底（目前只有订单详情，
 * 路由 meta.immersive）。桌面端不受影响，顶栏照旧。
 */
const immersive = computed(() => isMobile.value && route.meta.immersive === true)

// 移动端自动收起侧栏，桌面端展开（immediate 保证首屏就是正确状态）
watch(isMobile, (mobile) => {
  isCollapse.value = mobile
}, { immediate: true })
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
const isDarkMode = computed(() => userStore.themeSettings.darkMode)

// Toggle deep/shallow theme（顶栏按钮用）
const toggleDarkMode = () => {
  userStore.setDarkMode(!isDarkMode.value);
};

/** 主题三态。auto 即「跟随系统」，与 store 的 autoDarkMode 一一对应 */
type ThemeMode = 'auto' | 'dark' | 'light'

const themeMode = computed<ThemeMode>(() => {
  const t = userStore.themeSettings
  if (t.autoDarkMode) return 'auto'
  return t.darkMode ? 'dark' : 'light'
})

const THEME_META: Record<ThemeMode, { label: string; icon: Component; next: ThemeMode }> = {
  auto: { label: '自动切换', icon: SunMoonIcon, next: 'dark' },
  dark: { label: '深色模式', icon: Moon, next: 'light' },
  light: { label: '浅色模式', icon: Sunny, next: 'auto' }
}

const themeLabel = computed(() => THEME_META[themeMode.value].label)
const themeIcon = computed(() => THEME_META[themeMode.value].icon)

/**
 * 菜单里只留一项：点一下按 自动 → 深色 → 浅色 轮换。
 *
 * preventDefault 是 EP 的约定（dropdown-item 的 handleClick 是 composeEventHandlers，
 * 第一个 handler 返回 defaultPrevented 时会跳过关闭逻辑），这样点完菜单不关，
 * 方便连着切下一档。
 */
function cycleTheme(e: MouseEvent) {
  e.preventDefault()
  const next = THEME_META[themeMode.value].next
  if (next === 'auto') {
    userStore.setAutoDarkMode(true)
  } else {
    userStore.setDarkMode(next === 'dark')
  }
}

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
}

function handleTitleChange(e: CustomEvent) {
  systemTitle.value = e.detail
}

function handleLogoChange(e: CustomEvent) {
  systemLogo.value = e.detail
}

function handleAutoDarkModeChange(e: CustomEvent) {
  if (e.detail) {
    userStore.applySystemDarkMode()
  }
}

onMounted(async () => {
  loadSystemTitle()
  window.addEventListener('systemTitleChange', handleTitleChange as EventListener)
  window.addEventListener('systemLogoChange', handleLogoChange as EventListener)
  window.addEventListener('autoDarkModeChange', handleAutoDarkModeChange as EventListener)
  
  if (!userStore.user) {
    try {
      const res: any = await authApi.getCurrentUser()
      if (res.success) {
        userStore.setUser(res.data)
        // 刷新页面后 user 会丢，这里顺带把「必须改密」标记恢复回来
        userStore.mustChangePassword = Boolean(res.data.must_change_password)
      }
    } catch (error) {
      console.error('获取用户信息失败', error)
    }
  }

  openForcedPasswordDialog()
})

/** 默认口令未改时，登录/刷新后立即弹出不可关闭的改密弹窗 */
function openForcedPasswordDialog() {
  if (!userStore.mustChangePassword) return
  passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  passwordDialogVisible.value = true
}

onUnmounted(() => {
  window.removeEventListener('systemTitleChange', handleTitleChange as EventListener)
  window.removeEventListener('systemLogoChange', handleLogoChange as EventListener)
  window.removeEventListener('autoDarkModeChange', handleAutoDarkModeChange as EventListener)
})

function handleCommand(command: string) {
  if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      // 服务端只记审计日志，失败也不该挡住登出
      void authApi.logout().catch(() => undefined)
      userStore.logout()
      router.push('/login')
    })
  } else if (command === 'settings') {
    router.push('/settings')
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
      // 后端改密会自增 token_version 使旧 token 全部失效，并回传一个新 token，
      // 必须换掉本地 token，否则下一个请求就会 401 被踢回登录页
      if (res.data?.token) {
        userStore.setToken(res.data.token)
      }
      userStore.mustChangePassword = false
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
  background-color: var(--sk-text-white);
}

html.dark .aside {
  background-color: var(--sk-bg-pure-black);
}

.logo {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  position: relative;
  z-index: 1;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background-color: transparent;
}

html.dark .logo {
  border-bottom-color: rgba(255, 255, 255, 0.1);
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
  color: var(--sk-text-near-black);
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.224px;
}

html.dark .logo-text {
  color: #fff;
}

.nav-menu {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  position: relative;
  z-index: 1;
  background-color: transparent;
}

html.dark .nav-menu {
  background-color: var(--sk-bg-pure-black);
}

.nav-menu::-webkit-scrollbar {
  width: 4px;
}

.nav-menu::-webkit-scrollbar-track {
  background: transparent;
}

.nav-menu::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

html.dark .nav-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 2px;
  border-radius: 8px;
  color: var(--sk-text-secondary);
  text-decoration: none;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

html.dark .nav-item {
  color: rgba(255, 255, 255, 0.8);
}

.nav-item:hover {
  color: var(--sk-text-near-black);
  background-color: rgba(0, 0, 0, 0.05);
}

html.dark .nav-item:hover {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
}

.nav-item.active {
  color: #fff;
  background-color: var(--sk-focus-color);
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
  background: rgba(0, 0, 0, 0.05);
}

html.dark .nav-item:hover .nav-icon {
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
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
  background-color: transparent;
}

html.dark .sidebar-footer {
  border-top-color: rgba(255, 255, 255, 0.1);
  background-color: rgba(0, 0, 0, 0.8);
}

.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  transition: all 0.2s ease;
}

html.dark .user-card {
  background: rgba(255, 255, 255, 0.08);
}

.user-card:hover {
  background: rgba(0, 0, 0, 0.06);
}

html.dark .user-card:hover {
  background: rgba(255, 255, 255, 0.12);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-info .user-name {
  color: var(--sk-text-near-black);
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: -0.224px;
}

html.dark .user-info .user-name {
  color: #fff;
}

.user-role {
  color: var(--sk-text-tertiary);
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 12px;
  letter-spacing: -0.12px;
}

html.dark .user-role {
  color: rgba(255, 255, 255, 0.6);
}

.main-container {
  position: relative;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
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
  background-color: #ffffff;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  box-shadow: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  /* 顶栏叠在主内容之上，透明/模糊状态才能采样到滚动内容 */
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  height: 48px;
}

html.dark .header {
  background-color: #000000;
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.header.is-header-gaussian {
  background-color: rgba(255, 255, 255, var(--glass-opacity));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.header.is-header-liquid {
  background-color: rgba(255, 255, 255, var(--glass-opacity));
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
}

html.dark .header.is-header-gaussian {
  background-color: rgba(0, 0, 0, var(--glass-opacity));
}

html.dark .header.is-header-liquid {
  background-color: rgba(0, 0, 0, var(--glass-opacity));
}

@media (min-width: 768px) {
  .header {
    padding: 0 24px;
  }
}

@media (max-width: 767px) {
  /* Miuix navbar：固定 56px，与悬浮 tabbar 共用液态玻璃材质 */
  .header {
    height: 56px;
    background: var(--m-bg-cell);
    border-bottom-color: var(--m-line);
    box-shadow: none;
  }

  .header.is-header-gaussian {
    background: var(--m-gaussian-bg);
    border-bottom-color: var(--m-line);
  }

  .header.is-header-liquid {
    background: var(--m-glass-bg);
    border-bottom-color: var(--m-glass-border);
  }

  .header.is-header-gaussian {
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .header.is-header-liquid {
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    box-shadow: var(--m-glass-shadow);
  }

  @supports not ((backdrop-filter: blur(1px))) {
    .header.is-header-gaussian,
    .header.is-header-liquid {
      background: var(--m-glass-fallback-bg);
    }
  }

  /* 顶栏左侧的品牌区：Logo 方块复用侧栏的 .logo-icon / .logo-img（移动端 --sk-focus-color
     已切成微信绿），标题按 WeUI navbar 的字号 */
  .header-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .header-brand__title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 17px;
    font-weight: 600;
    color: var(--m-fg-0);
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
  /* 移动端顶栏空间紧张：主题切换收进头像菜单（「深色模式 / 自动切换」） */
  .theme-toggle-btn {
    display: none;
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
  flex: 1 1 auto;
  min-height: 0;
  padding: 16px;
  /* 贴底 tabbar 的让位：64px 标签栏 + 安全区；悬浮模式在下面额外增加 16px 间距。
     不给的话滚到最底时最后一张卡片会被 tabbar 压住。
     桌面端由下面 min-width:768px 的 padding:24px 整体覆盖掉 */
  padding-bottom: calc(76px + env(safe-area-inset-bottom));
  overflow-y: auto;
  min-height: calc(100vh - 48px);
  background-color: var(--sk-bg-light-gray);
}

/* 沉浸式页面（订单详情）：顶栏与 tabbar 都没了，内边距全部交给页面自己
   （页面的卡片靠 .main 的 16px 内边距做负边距出血，这里归零后页面自己也不出血了） */
.main.is-immersive {
  padding: 0;
  min-height: 100vh;
}

html.dark .main {
  background-color: var(--sk-bg-pure-black);
}

@media (max-width: 767px) {
  .main-container.has-floating-tabbar .main:not(.is-immersive) {
    padding-bottom: calc(92px + env(safe-area-inset-bottom));
  }
}

@media (min-width: 768px) {
  .main {
    /* 顶栏绝对定位叠在内容上方：48px 顶栏 + 24px 页面间距 */
    padding: 72px 24px 24px;
    scroll-padding-top: 72px;
  }
}

@media (max-width: 767px) {
  .main {
    /* 顶栏绝对定位叠在内容上方：56px 顶栏 + 16px 页面间距 */
    padding-top: 72px;
    scroll-padding-top: 72px;
    min-height: calc(100vh - 56px);
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
