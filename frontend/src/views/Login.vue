<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <el-icon :size="40" color="#409EFF"><Car /></el-icon>
        <h1>租车管理系统</h1>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" size="large">
        <el-form-item prop="username">
          <el-input 
            v-model="form.username" 
            placeholder="用户名/姓名/手机/邮箱"
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
          <el-button 
            type="primary" 
            class="login-btn" 
            :loading="loading"
            @click="handleLogin"
          >
            登 录
          </el-button>
        </el-form-item>
      </el-form>
      <div class="login-tip">
        默认账号: admin / admin123
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-box {
  width: 100%;
  max-width: 360px;
  padding: 32px 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

@media (min-width: 480px) {
  .login-box {
    padding: 40px;
  }
}

.login-header {
  text-align: center;
  margin-bottom: 28px;
}

.login-header h1 {
  margin: 12px 0 0;
  font-size: 22px;
  color: #303133;
}

@media (min-width: 480px) {
  .login-header h1 {
    font-size: 24px;
    margin: 16px 0 0;
  }
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
}

.login-tip {
  text-align: center;
  color: #909399;
  font-size: 12px;
  margin-top: 16px;
}
</style>