<template>
  <div class="login-container">
    <div class="login-section">
      <div class="login-content">
        <div class="login-header">
          <el-icon :size="48" color="#0071e3"><Car /></el-icon>
          <h1 class="sk-display-hero">租车管理系统</h1>
          <p class="sk-display-subheading">安全、高效的车辆管理平台</p>
        </div>
        
        <el-form ref="formRef" :model="form" :rules="rules" class="login-form" size="large">
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              placeholder="用户名"
              :prefix-icon="User"
            />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="密码"
              :prefix-icon="Lock"
              show-password
              @keyup.enter="handleLogin"
            />
          </el-form-item>
          <el-form-item>
            <button
              class="sk-button-primary login-btn"
              :disabled="loading"
              @click="handleLogin"
            >
              <span v-if="loading">登录中...</span>
              <span v-else>登录</span>
            </button>
          </el-form-item>
        </el-form>
        
        <div class="login-tip">
          <p class="sk-micro">默认账号: admin / admin123</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useUserStore } from '../stores/user'
import { authApi } from '../api'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  username: '',
  password: ''
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  loading.value = true
  try {
    const res: any = await authApi.login(form)
    if (res.success) {
      userStore.setToken(res.data.token)
      userStore.setUser(res.data.user)
      ElMessage.success('登录成功')
      router.push('/dashboard')
    }
  } catch (error) {
    console.error('登录失败', error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--sk-bg-light-gray);
  padding: 20px;
}

html.dark .login-container {
  background-color: var(--sk-bg-pure-black);
}

.login-section {
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
}

.login-content {
  text-align: center;
}

.login-header {
  margin-bottom: 48px;
}

.login-header .el-icon {
  margin-bottom: 16px;
}

.login-header h1 {
  margin: 16px 0 8px;
  color: var(--sk-text-near-black);
}

html.dark .login-header h1 {
  color: var(--sk-text-white);
}

.login-header .sk-display-subheading {
  color: var(--sk-text-secondary);
  margin: 0;
}

.login-form {
  max-width: 400px;
  margin: 0 auto;
}

.login-form .el-form-item {
  margin-bottom: 20px;
}

.login-form .el-input__wrapper {
  border-radius: 11px;
  padding: 12px 16px;
  box-shadow: none;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

html.dark .login-form .el-input__wrapper {
  border-color: rgba(255, 255, 255, 0.08);
  background-color: var(--sk-surface-dark-1);
}

.login-form .el-input__wrapper.is-focus {
  box-shadow: 0 0 0 2px rgba(0, 113, 227, 0.2) !important;
  border-color: var(--sk-focus-color);
}

.login-btn {
  width: 100%;
  height: 44px;
  margin-top: 8px;
}

.login-tip {
  margin-top: 32px;
  color: var(--sk-text-tertiary);
}

@media (max-width: 767px) {
  .login-header {
    margin-bottom: 32px;
  }

  .login-header h1 {
    font-size: 2.5rem;
  }
}
</style>