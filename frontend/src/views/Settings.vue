<template>
  <div class="page-container">
    <el-tabs v-model="activeTab" class="settings-tabs">
      <el-tab-pane label="系统设置" name="system">
        <el-card shadow="never" class="setting-card">
          <template #header>
            <span class="card-title">基本设置</span>
          </template>
          <el-form label-width="80px" size="default">
            <el-form-item label="系统标题">
              <el-input v-model="systemTitle" placeholder="请输入系统标题" style="max-width: 300px" />
            </el-form-item>
            <el-form-item label="系统Logo">
              <div class="logo-upload">
                <div class="logo-preview" @click="triggerLogoUpload">
                  <img v-if="systemLogo" :src="getLogoUrl(systemLogo)" alt="Logo" />
                  <div v-else class="logo-placeholder">
                    <el-icon :size="32"><Plus /></el-icon>
                    <span>上传Logo</span>
                  </div>
                </div>
                <div class="logo-actions">
                  <el-button size="small" @click="triggerLogoUpload">更换Logo</el-button>
                  <el-button v-if="systemLogo" size="small" type="danger" text @click="removeLogo">删除</el-button>
                </div>
                <input ref="logoInputRef" type="file" accept="image/*" style="display: none" @change="handleLogoChange" />
              </div>
              <div class="logo-tip">建议尺寸：正方形图片，支持 PNG、JPG 格式</div>
            </el-form-item>
          </el-form>
        </el-card>
        
        <el-card shadow="never" class="setting-card" style="margin-top: 16px;">
          <template #header>
            <span class="card-title">外观设置</span>
          </template>
          <el-form label-width="100px" size="default">
            <el-form-item label="深色模式">
              <div class="dark-mode-settings">
                <el-switch
                  v-model="isDarkMode"
                  :active-icon="Moon"
                  :inactive-icon="Sunny"
                  inline-prompt
                  @change="handleDarkModeChange"
                />
                <span class="dark-mode-label">{{ isDarkMode ? '深色模式已开启' : '浅色模式已开启' }}</span>
              </div>
            </el-form-item>
            <el-form-item label="自动切换">
              <div class="dark-mode-settings">
                <el-switch
                  v-model="autoDarkMode"
                  inline-prompt
                  active-text="自动"
                  inactive-text="手动"
                  @change="handleAutoDarkModeChange"
                />
                <span class="dark-mode-label">{{ autoDarkMode ? '跟随系统' : '手动控制' }}</span>
              </div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveSettings">保存设置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>
      <el-tab-pane label="用户管理" name="users">
        <UsersTab />
      </el-tab-pane>
      <el-tab-pane label="订单来源" name="sources">
        <OrderSourcesTab />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Moon, Plus, Sunny } from '@element-plus/icons-vue'
import UsersTab from '../components/UsersTab.vue'
import OrderSourcesTab from '../components/OrderSourcesTab.vue'
import { settingsApi, uploadApi } from '../api'
import { useUserStore } from '../stores/user'
import { getLogoUrl } from '../utils/helpers'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const activeTab = ref('system')
const systemTitle = ref('租车管理系统')
const systemLogo = ref('')
const saving = ref(false)
const logoInputRef = ref<HTMLInputElement>()

// 深色模式设置直接使用 userStore
const isDarkMode = computed({
  get: () => userStore.themeSettings.darkMode,
  set: (val) => userStore.setDarkMode(val)
})

const autoDarkMode = computed({
  get: () => userStore.themeSettings.autoDarkMode,
  set: (val) => userStore.setAutoDarkMode(val)
})

function handleDarkModeChange(enabled: boolean) {
  if (enabled) {
    document.documentElement.classList.add('dark')
    ElMessage.success('已切换到深色模式')
  } else {
    document.documentElement.classList.remove('dark')
    ElMessage.success('已切换到浅色模式')
  }
}

function handleAutoDarkModeChange(enabled: boolean) {
  if (enabled) {
    const systemPrefersDark = userStore.getSystemPrefersDark()
    if (systemPrefersDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    ElMessage.success('已开启自动切换深色模式')
  } else {
    ElMessage.info('已关闭自动切换，可手动控制深色模式')
  }
}

// 从路由参数获取当前标签
onMounted(async () => {
  const tab = route.query.tab as string
  if (tab && ['system', 'users', 'sources'].includes(tab)) {
    activeTab.value = tab
  }
  
  // 从API加载系统设置（标题和Logo）
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
  
  // 外观设置从 userStore 获取（已自动从 localStorage 加载）
})

// 监听标签变化，更新路由参数
watch(activeTab, (val) => {
  router.replace({ query: { tab: val } })
})

function triggerLogoUpload() {
  logoInputRef.value?.click()
}

async function handleLogoChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  
  try {
    const res: any = await uploadApi.uploadOther(file, '系统Logo')
    if (res.success && res.data?.url) {
      systemLogo.value = res.data.url
    } else {
      // 校验失败（格式/体积）也走这里，必须提示，否则用户以为换成功了
      ElMessage.error(res.message || '上传Logo失败')
    }
  } catch (error) {
    console.error('上传Logo失败', error)
    ElMessage.error('上传Logo失败')
  }
  
  // 清空input以便重复选择同一文件
  input.value = ''
}

function removeLogo() {
  systemLogo.value = ''
}

async function saveSettings() {
  saving.value = true
  try {
    // 保存系统标题
    await settingsApi.update('system_title', systemTitle.value)
    // 保存logo
    await settingsApi.update('system_logo', systemLogo.value)
    
    // 触发自定义事件通知布局更新
    window.dispatchEvent(new CustomEvent('systemTitleChange', { detail: systemTitle.value }))
    window.dispatchEvent(new CustomEvent('systemLogoChange', { detail: systemLogo.value }))
    
    ElMessage.success('设置保存成功')
  } catch (error) {
    console.error('保存设置失败', error)
    ElMessage.error('保存设置失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
}

.settings-tabs {
  background: var(--bg-color-secondary);
  border-radius: 12px;
  padding: 16px;
  border: none;
}

html.dark .settings-tabs {
  background: var(--bg-color-secondary);
}

:deep(.el-tabs__header) {
  margin-bottom: 16px;
}

:deep(.el-tabs__item) {
  font-size: 15px;
  color: var(--sk-text-secondary);
}

html.dark :deep(.el-tabs__item) {
  color: var(--sk-text-secondary);
}

:deep(.el-tabs__item.is-active) {
  color: var(--sk-focus-color);
  font-weight: 600;
}

:deep(.el-tabs__active-bar) {
  background-color: var(--sk-focus-color);
}

.logo-upload {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.logo-preview {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  border: 2px dashed rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s ease;
  background: var(--sk-bg-light-gray);
}

html.dark .logo-preview {
  border-color: rgba(255, 255, 255, 0.08);
  background: var(--sk-surface-dark-1);
}

.logo-preview:hover {
  border-color: var(--sk-focus-color);
  background: rgba(0, 113, 227, 0.05);
}

html.dark .logo-preview:hover {
  background: rgba(0, 113, 227, 0.1);
}

.logo-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.logo-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--sk-text-tertiary);
}

.logo-placeholder span {
  font-size: 12px;
}

.logo-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.logo-tip {
  font-size: 12px;
  color: var(--sk-text-tertiary);
  margin-top: 8px;
}

.dark-mode-settings {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dark-mode-label {
  font-size: 13px;
  color: var(--sk-text-secondary);
  min-width: 120px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--sk-text-near-black);
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

html.dark .card-title {
  color: var(--sk-text-white);
}

/* 暗色模式 */
html.dark .settings-tabs {
  background: var(--bg-color-secondary);
}

html.dark :deep(.el-tabs__item) {
  color: var(--sk-text-secondary);
}

html.dark :deep(.el-tabs__item.is-active) {
  color: var(--sk-focus-color);
}

html.dark .logo-placeholder {
  color: var(--sk-text-tertiary);
}

html.dark .logo-tip {
  color: var(--sk-text-tertiary);
}

html.dark .dark-mode-label {
  color: var(--sk-text-secondary);
}

html.dark .card-title {
  color: var(--sk-text-white);
}
</style>
