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
      :width="isMobile ? '220px' : (isCollapse ? '64px' : '220px')" 
      :class="['aside', { 'aside-mobile-hidden': isMobile && isCollapse }]"
    >
      <div class="logo">
        <el-icon :size="28"><Car /></el-icon>
        <span v-show="!isCollapse || isMobile" class="logo-text">{{ systemTitle }}</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="!isMobile && isCollapse"
        :collapse-transition="false"
        router
        class="menu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
        @select="handleMenuSelect"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <template #title>首页</template>
        </el-menu-item>
        <el-menu-item index="/vehicles">
          <el-icon><Van /></el-icon>
          <template #title>车辆管理</template>
        </el-menu-item>
        <el-menu-item index="/customers">
          <el-icon><User /></el-icon>
          <template #title>客户管理</template>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><Document /></el-icon>
          <template #title>订单管理</template>
        </el-menu-item>
        <el-menu-item index="/blacklist">
          <el-icon><CircleClose /></el-icon>
          <template #title>黑名单</template>
        </el-menu-item>
        <el-menu-item v-if="isAdmin" index="/settings">
          <el-icon><Setting /></el-icon>
          <template #title>设置</template>
        </el-menu-item>
      </el-menu>
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

const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
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
    if (res.success && res.data?.system_title) {
      systemTitle.value = res.data.system_title
    }
  } catch (error) {
    console.error('加载系统标题失败', error)
  }
}

function handleTitleChange(e: CustomEvent) {
  systemTitle.value = e.detail
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) {
    isCollapse.value = true
  } else {
    isCollapse.value = false
  }
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
}

.aside {
  background-color: #304156;
  transition: transform 0.3s;
  overflow: hidden;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 1001;
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
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid #3a4a5e;
}

.logo-text {
  white-space: nowrap;
}

.menu {
  border-right: none;
}

.main-container {
  flex-direction: column;
  background-color: #f0f2f5;
  margin-left: 0;
  transition: margin-left 0.3s;
}

@media (min-width: 768px) {
  .main-container {
    margin-left: v-bind('isCollapse ? "64px" : "220px"');
  }
  
  .aside {
    position: fixed;
    transform: none !important;
  }
}

.header {
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  position: sticky;
  top: 0;
  z-index: 999;
}

@media (min-width: 768px) {
  .header {
    padding: 0 20px;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-btn {
  font-size: 20px;
}

.collapse-btn :deep(.el-icon) {
  font-size: 22px;
}

@media (max-width: 767px) {
  .collapse-btn {
    font-size: 18px;
  }
  
  .collapse-btn :deep(.el-icon) {
    font-size: 20px;
  }
}

.breadcrumb {
  display: none;
}

@media (min-width: 768px) {
  .breadcrumb {
    display: block;
  }
  
  .header-left {
    gap: 16px;
  }
}

.header-right {
  display: flex;
  align-items: center;
}

.user-dropdown {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #606266;
}

.user-name {
  font-size: 14px;
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
  padding: 12px;
  overflow-y: auto;
}

@media (min-width: 768px) {
  .main {
    padding: 20px;
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