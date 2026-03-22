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
                  <img v-if="systemLogo" :src="systemLogo" alt="Logo" />
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
            <span class="card-title">主题设置</span>
          </template>
          <el-form label-width="80px" size="default">
            <el-form-item label="主题色">
              <div class="color-picker-group">
                <div 
                  v-for="color in themeColors" 
                  :key="color.value"
                  class="color-item"
                  :class="{ active: themeColor === color.value }"
                  :style="{ background: color.gradient || color.value }"
                  @click="themeColor = color.value"
                >
                  <el-icon v-if="themeColor === color.value" class="check-icon"><Check /></el-icon>
                </div>
                <el-color-picker
                  v-model="themeColor"
                  :predefine="predefineColors"
                  show-alpha
                  size="default"
                  @change="handleCustomColorChange"
                />
              </div>
              <div class="color-label">{{ currentThemeColorLabel }}</div>
            </el-form-item>
            <el-form-item label="侧边栏风格">
              <div class="color-picker-group">
                <div 
                  v-for="style in sidebarStyles" 
                  :key="style.value"
                  class="color-item sidebar-item"
                  :class="{ active: sidebarStyle === style.value && !customSidebarColorStart }"
                  :style="{ background: style.gradient }"
                  @click="handleSidebarStyleClick(style.value)"
                >
                  <el-icon v-if="sidebarStyle === style.value && !customSidebarColorStart" class="check-icon"><Check /></el-icon>
                </div>
              </div>
              <div class="color-label">{{ currentSidebarStyleLabel }}</div>
            </el-form-item>
            <el-form-item label="自定义渐变">
              <div class="gradient-picker">
                <div class="gradient-colors">
                  <div class="gradient-color-item">
                    <span class="gradient-label">起始色</span>
                    <el-color-picker
                      v-model="customSidebarColorStart"
                      :predefine="predefineSidebarColors"
                      show-alpha
                      size="default"
                    />
                  </div>
                  <div class="gradient-arrow">→</div>
                  <div class="gradient-color-item">
                    <span class="gradient-label">结束色</span>
                    <el-color-picker
                      v-model="customSidebarColorEnd"
                      :predefine="predefineSidebarColors"
                      show-alpha
                      size="default"
                    />
                  </div>
                </div>
                <div class="gradient-preview" :style="customGradientStyle">
                  <span>预览</span>
                </div>
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
import { Plus, Check } from '@element-plus/icons-vue'
import UsersTab from '../components/UsersTab.vue'
import OrderSourcesTab from '../components/OrderSourcesTab.vue'
import { settingsApi, uploadApi } from '../api'

const route = useRoute()
const router = useRouter()
const activeTab = ref('system')
const systemTitle = ref('租车管理系统')
const systemLogo = ref('')
const themeColor = ref('#667eea')
const sidebarStyle = ref('default')
const customSidebarColorStart = ref('')
const customSidebarColorEnd = ref('')
const saving = ref(false)
const logoInputRef = ref<HTMLInputElement>()

// 主题色选项
const themeColors = [
  { value: '#667eea', label: '靛蓝', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { value: '#409eff', label: '蓝色', gradient: 'linear-gradient(135deg, #409eff 0%, #3375b9 100%)' },
  { value: '#18a058', label: '绿色', gradient: 'linear-gradient(135deg, #18a058 0%, #0e7a3c 100%)' },
  { value: '#f56c6c', label: '红色', gradient: 'linear-gradient(135deg, #f56c6c 0%, #c45656 100%)' },
  { value: '#e6a23c', label: '橙色', gradient: 'linear-gradient(135deg, #e6a23c 0%, #cf9236 100%)' },
  { value: '#909399', label: '灰色', gradient: 'linear-gradient(135deg, #909399 0%, #6d6d6d 100%)' },
]

// 预定义颜色（用于调色盘快捷选择）
const predefineColors = [
  '#667eea',
  '#409eff',
  '#18a058',
  '#f56c6c',
  '#e6a23c',
  '#909399',
  '#9b59b6',
  '#3498db',
  '#1abc9c',
  '#e74c3c',
  '#f39c12',
  '#2c3e50',
  '#16a085',
  '#27ae60',
  '#2980b9',
  '#8e44ad',
  '#c0392b',
  '#d35400',
]

// 预定义侧边栏颜色（用于调色盘快捷选择）
const predefineSidebarColors = [
  '#1a1f36',
  '#1a1a1a',
  '#0d1b2a',
  '#0d1912',
  '#1a0a2e',
  '#1a1209',
  '#2c3e50',
  '#1e3a5f',
  '#1a2a3a',
  '#2d2d2d',
  '#1a2f1f',
  '#2d1b4e',
  '#3d2645',
  '#1f1f3d',
  '#2a1a1a',
  '#1a2a2a',
  '#2d2418',
  '#1e272e',
]

// 侧边栏风格选项
const sidebarStyles = [
  { value: 'default', label: '深邃蓝紫', gradient: 'linear-gradient(180deg, #1a1f36 0%, #252d4a 50%, #1e2640 100%)' },
  { value: 'dark', label: '暗黑', gradient: 'linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)' },
  { value: 'blue', label: '深蓝', gradient: 'linear-gradient(180deg, #0d1b2a 0%, #1b3a4b 50%, #0d1b2a 100%)' },
  { value: 'green', label: '墨绿', gradient: 'linear-gradient(180deg, #0d1912 0%, #1a2f1f 50%, #0d1912 100%)' },
  { value: 'purple', label: '暗紫', gradient: 'linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 50%, #1a0a2e 100%)' },
  { value: 'brown', label: '棕色', gradient: 'linear-gradient(180deg, #1a1209 0%, #2d2418 50%, #1a1209 100%)' },
]

const currentThemeColorLabel = computed(() => {
  const color = themeColors.find(c => c.value === themeColor.value)
  return color ? color.label : `自定义颜色：${themeColor.value}`
})

const currentSidebarStyleLabel = computed(() => {
  if (customSidebarColorStart.value) {
    return '自定义渐变'
  }
  const style = sidebarStyles.find(s => s.value === sidebarStyle.value)
  return style ? style.label : ''
})

// 自定义渐变样式
const customGradientStyle = computed(() => {
  if (customSidebarColorStart.value && customSidebarColorEnd.value) {
    return { background: `linear-gradient(180deg, ${customSidebarColorStart.value} 0%, ${customSidebarColorEnd.value} 100%)` }
  } else if (customSidebarColorStart.value) {
    return { background: customSidebarColorStart.value }
  } else if (customSidebarColorEnd.value) {
    return { background: customSidebarColorEnd.value }
  }
  return { background: '#f5f7fa' }
})

// 点击预设侧边栏风格
function handleSidebarStyleClick(value: string) {
  sidebarStyle.value = value
  customSidebarColorStart.value = ''
  customSidebarColorEnd.value = ''
}

// 自定义颜色变化处理
function handleCustomColorChange(color: string | null) {
  if (color) {
    themeColor.value = color
  } else {
    // 如果清除了颜色，恢复默认
    themeColor.value = '#667eea'
  }
}

// 从路由参数获取当前标签
onMounted(async () => {
  const tab = route.query.tab as string
  if (tab && ['system', 'users', 'sources'].includes(tab)) {
    activeTab.value = tab
  }
  
  // 从API加载系统设置
  try {
    const res: any = await settingsApi.getAll()
    if (res.success && res.data) {
      if (res.data.system_title) {
        systemTitle.value = res.data.system_title
      }
      if (res.data.system_logo) {
        systemLogo.value = res.data.system_logo
      }
      if (res.data.theme_color) {
        themeColor.value = res.data.theme_color
      }
      if (res.data.sidebar_style) {
        sidebarStyle.value = res.data.sidebar_style
      }
      if (res.data.custom_sidebar_color_start) {
        customSidebarColorStart.value = res.data.custom_sidebar_color_start
      }
      if (res.data.custom_sidebar_color_end) {
        customSidebarColorEnd.value = res.data.custom_sidebar_color_end
      }
    }
  } catch (error) {
    console.error('加载系统设置失败', error)
  }
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
    const res: any = await uploadApi.uploadOther(file)
    if (res.success && res.data?.url) {
      systemLogo.value = res.data.url
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
    // 保存标题
    await settingsApi.update('system_title', systemTitle.value)
    // 保存logo
    await settingsApi.update('system_logo', systemLogo.value)
    // 保存主题色
    await settingsApi.update('theme_color', themeColor.value)
    // 保存侧边栏风格
    await settingsApi.update('sidebar_style', sidebarStyle.value)
    // 保存自定义侧边栏颜色
    await settingsApi.update('custom_sidebar_color_start', customSidebarColorStart.value)
    await settingsApi.update('custom_sidebar_color_end', customSidebarColorEnd.value)
    
    // 触发自定义事件通知布局更新
    window.dispatchEvent(new CustomEvent('systemTitleChange', { detail: systemTitle.value }))
    window.dispatchEvent(new CustomEvent('systemLogoChange', { detail: systemLogo.value }))
    window.dispatchEvent(new CustomEvent('themeColorChange', { detail: themeColor.value }))
    window.dispatchEvent(new CustomEvent('sidebarStyleChange', { detail: sidebarStyle.value }))
    window.dispatchEvent(new CustomEvent('customSidebarColorStartChange', { detail: customSidebarColorStart.value }))
    window.dispatchEvent(new CustomEvent('customSidebarColorEndChange', { detail: customSidebarColorEnd.value }))
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
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

:deep(.el-tabs__header) {
  margin-bottom: 16px;
}

:deep(.el-tabs__item) {
  font-size: 15px;
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
  border: 2px dashed #dcdfe6;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s ease;
  background: #fafafa;
}

.logo-preview:hover {
  border-color: #409eff;
  background: #f0f7ff;
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
  color: #909399;
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
  color: #909399;
  margin-top: 8px;
}

.color-picker-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.color-item {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.color-item:hover {
  transform: scale(1.1);
}

.color-item.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px #409eff, 0 4px 12px rgba(0, 0, 0, 0.2);
}

.check-icon {
  color: #fff;
  font-size: 18px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.color-label {
  margin-top: 8px;
  font-size: 13px;
  color: #606266;
}

.card-title {
  font-size: 15px;
  font-weight: 500;
}

/* 调色盘样式 */
.color-picker-group :deep(.el-color-picker) {
  height: 40px;
  width: 40px;
}

.color-picker-group :deep(.el-color-picker__trigger) {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: all 0.2s ease;
  padding: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.color-picker-group :deep(.el-color-picker__trigger:hover) {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.color-picker-group :deep(.el-color-picker__color) {
  border-radius: 6px;
  width: 100%;
  height: 100%;
}

.color-picker-group :deep(.el-color-picker__color-inner) {
  border-radius: 6px;
  width: 100%;
  height: 100%;
}

.color-picker-group :deep(.el-color-picker__empty) {
  background: linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3);
  border-radius: 6px;
}

.color-picker-group :deep(.el-color-picker__icon) {
  display: none;
}

/* 渐变选择器样式 */
.gradient-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gradient-colors {
  display: flex;
  align-items: center;
  gap: 16px;
}

.gradient-color-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.gradient-label {
  font-size: 12px;
  color: #909399;
}

.gradient-arrow {
  color: #909399;
  font-size: 16px;
  padding-top: 20px;
}

.gradient-preview {
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  min-width: 200px;
}

.gradient-color-item :deep(.el-color-picker) {
  height: 40px;
  width: 40px;
}

.gradient-color-item :deep(.el-color-picker__trigger) {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: all 0.2s ease;
  padding: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.gradient-color-item :deep(.el-color-picker__trigger:hover) {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.gradient-color-item :deep(.el-color-picker__color) {
  border-radius: 6px;
  width: 100%;
  height: 100%;
}

.gradient-color-item :deep(.el-color-picker__color-inner) {
  border-radius: 6px;
  width: 100%;
  height: 100%;
}
</style>
