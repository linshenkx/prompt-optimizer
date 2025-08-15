<template>
  <div class="ai-redirect-settings">
    <div class="settings-header">
      <h3 class="text-lg font-medium">{{ t('aiRedirect.settings.title') }}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {{ t('aiRedirect.settings.description') }}
      </p>
    </div>

    <div class="settings-content space-y-6 mt-6">
      <!-- 启用自动跳转 -->
      <div class="setting-item">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <label class="block text-sm font-medium">
              {{ t('aiRedirect.settings.autoRedirect') }}
            </label>
            <p class="text-xs text-gray-500 mt-1">
              {{ t('aiRedirect.settings.autoRedirectDesc') }}
            </p>
          </div>
          <div class="ml-4">
            <label class="relative inline-flex items-center cursor-pointer">
              <input 
                v-model="localConfig.enabled" 
                type="checkbox" 
                class="sr-only peer"
                @change="saveConfig"
              />
              <div class="toggle-switch peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      <!-- 默认AI平台 -->
      <div class="setting-item">
        <label class="block text-sm font-medium mb-2">
          {{ t('aiRedirect.settings.defaultPlatform') }}
        </label>
        <select 
          v-model="localConfig.defaultProvider" 
          class="settings-select"
          @change="saveConfig"
        >
          <option 
            v-for="platform in supportedPlatforms" 
            :key="platform.id" 
            :value="platform.id"
          >
            {{ platform.name }} - {{ platform.description }}
          </option>
        </select>
      </div>

      <!-- 自动复制内容 -->
      <div class="setting-item">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <label class="block text-sm font-medium">
              {{ t('aiRedirect.settings.autoCopy') }}
            </label>
            <p class="text-xs text-gray-500 mt-1">
              {{ t('aiRedirect.settings.autoCopyDesc') }}
            </p>
          </div>
          <div class="ml-4">
            <label class="relative inline-flex items-center cursor-pointer">
              <input 
                v-model="localConfig.copyContent" 
                type="checkbox" 
                class="sr-only peer"
                @change="saveConfig"
              />
              <div class="toggle-switch peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      <!-- 显示平台选择器 -->
      <div class="setting-item">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <label class="block text-sm font-medium">
              {{ t('aiRedirect.settings.showSelector') }}
            </label>
            <p class="text-xs text-gray-500 mt-1">
              {{ t('aiRedirect.settings.showSelectorDesc') }}
            </p>
          </div>
          <div class="ml-4">
            <label class="relative inline-flex items-center cursor-pointer">
              <input 
                v-model="localConfig.showPlatformSelector" 
                type="checkbox" 
                class="sr-only peer"
                @change="saveConfig"
              />
              <div class="toggle-switch peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      <!-- 自动跳转延迟 -->
      <div v-if="localConfig.enabled" class="setting-item">
        <label class="block text-sm font-medium mb-2">
          {{ t('aiRedirect.settings.autoRedirectDelay') }}
        </label>
        <div class="flex items-center space-x-3">
          <input
            v-model.number="localConfig.autoRedirectDelay"
            type="range"
            min="0"
            max="10000"
            step="500"
            class="settings-range flex-1"
            @input="saveConfig"
          />
          <span class="text-sm text-gray-600 dark:text-gray-400 w-16">
            {{ localConfig.autoRedirectDelay || 0 }}ms
          </span>
        </div>
        <div class="text-xs text-gray-500 mt-1">
          {{ localConfig.autoRedirectDelay === 0 ? 
            t('aiRedirect.settings.immediately') : 
            t('aiRedirect.settings.delayDesc', { delay: localConfig.autoRedirectDelay }) 
          }}
        </div>
      </div>

      <!-- 预览区域 -->
      <div class="setting-item">
        <label class="block text-sm font-medium mb-2">
          {{ t('aiRedirect.settings.preview') }}
        </label>
        <div class="preview-container">
          <div class="preview-content">
            <div class="flex items-center space-x-2 text-sm">
              <span class="text-gray-600 dark:text-gray-400">
                {{ t('aiRedirect.settings.previewText') }}:
              </span>
              <span class="font-medium">
                {{ getPreviewText() }}
              </span>
            </div>
            <button 
              class="test-button mt-3"
              @click="testConfiguration"
              :disabled="testing"
            >
              <span v-if="testing" class="flex items-center space-x-1">
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <span>{{ t('aiRedirect.settings.testing') }}</span>
              </span>
              <span v-else>{{ t('aiRedirect.settings.testConfig') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 重置设置 -->
      <div class="setting-item">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <label class="block text-sm font-medium text-red-600 dark:text-red-400">
              {{ t('aiRedirect.settings.resetSettings') }}
            </label>
            <p class="text-xs text-gray-500 mt-1">
              {{ t('aiRedirect.settings.resetDesc') }}
            </p>
          </div>
          <button 
            class="reset-button"
            @click="resetToDefaults"
            :disabled="resetting"
          >
            {{ t('common.reset') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '../composables/useToast'
import type { AutoRedirectConfig, PlatformOption, SupportedProvider } from '@prompt-optimizer/core'

// Props
interface Props {
  config: AutoRedirectConfig
  supportedPlatforms: PlatformOption[]
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  configChange: [config: AutoRedirectConfig]
  test: [config: AutoRedirectConfig]
}>()

const { t } = useI18n()
const toast = useToast()

// 响应式数据
const localConfig = reactive<AutoRedirectConfig>({ ...props.config })
const testing = ref(false)
const resetting = ref(false)

// 计算属性
const selectedPlatform = computed(() => {
  return props.supportedPlatforms.find(p => p.id === localConfig.defaultProvider)
})

// 获取预览文本
const getPreviewText = () => {
  if (!localConfig.enabled) {
    return t('aiRedirect.settings.previewManual')
  }
  
  const platform = selectedPlatform.value?.name || localConfig.defaultProvider
  const delay = localConfig.autoRedirectDelay || 0
  
  if (delay === 0) {
    return t('aiRedirect.settings.previewAutoImmediate', { platform })
  } else {
    return t('aiRedirect.settings.previewAutoDelay', { platform, delay })
  }
}

// 保存配置
const saveConfig = async () => {
  try {
    emit('configChange', { ...localConfig })
    // 这里可以添加成功提示，但为了避免频繁提示，暂时省略
  } catch (error) {
    console.error('保存AI跳转配置失败:', error)
    toast.error(t('aiRedirect.settings.saveFailed'))
  }
}

// 测试配置
const testConfiguration = async () => {
  testing.value = true
  try {
    emit('test', { ...localConfig })
    toast.success(t('aiRedirect.settings.testSuccess'))
  } catch (error) {
    console.error('测试AI跳转配置失败:', error)
    toast.error(t('aiRedirect.settings.testFailed'))
  } finally {
    testing.value = false
  }
}

// 重置为默认值
const resetToDefaults = async () => {
  resetting.value = true
  try {
    localConfig.enabled = false
    localConfig.defaultProvider = 'openai'
    localConfig.copyContent = true
    localConfig.showPlatformSelector = true
    localConfig.autoRedirectDelay = 2000
    
    await saveConfig()
    toast.success(t('aiRedirect.settings.resetSuccess'))
  } catch (error) {
    console.error('重置AI跳转配置失败:', error)
    toast.error(t('aiRedirect.settings.resetFailed'))
  } finally {
    resetting.value = false
  }
}

// 组件挂载时同步配置
onMounted(() => {
  Object.assign(localConfig, props.config)
})
</script>

<style scoped>
.ai-redirect-settings {
  max-width: 42rem;
  margin: 0 auto;
}

.settings-header {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
}

.setting-item {
  border-bottom: 1px solid #f3f4f6;
  padding-bottom: 1rem;
}

.setting-item:last-child {
  border-bottom: none;
}

.settings-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #111827;
  font-size: 0.875rem;
}

.settings-select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px #3b82f6;
}

.settings-range {
  height: 0.5rem;
  background: #e5e7eb;
  border-radius: 0.5rem;
  appearance: none;
  cursor: pointer;
}

.settings-range:focus {
  outline: none;
  box-shadow: 0 0 0 2px #3b82f6;
}

.settings-range::-webkit-slider-thumb {
  appearance: none;
  width: 1rem;
  height: 1rem;
  background: #2563eb;
  border-radius: 50%;
  cursor: pointer;
}

.settings-range::-moz-range-thumb {
  width: 1rem;
  height: 1rem;
  background: #2563eb;
  border-radius: 50%;
  cursor: pointer;
  border: 0;
}

.toggle-switch {
  width: 2.75rem;
  height: 1.5rem;
  background: #e5e7eb;
  border-radius: 9999px;
  position: relative;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  background: white;
  border-radius: 50%;
  height: 1.25rem;
  width: 1.25rem;
  transition: all 0.2s;
}

.peer:checked + .toggle-switch {
  background: #2563eb;
}

.peer:checked + .toggle-switch::after {
  transform: translateX(100%);
}

.preview-container {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
}

.test-button {
  padding: 0.5rem 1rem;
  background: #2563eb;
  color: white;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.test-button:hover:not(:disabled) {
  background: #1d4ed8;
}

.test-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px #3b82f6;
}

.test-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reset-button {
  padding: 0.25rem 0.75rem;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fca5a5;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.reset-button:hover:not(:disabled) {
  background: #fecaca;
}

.reset-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px #ef4444;
}

.reset-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
