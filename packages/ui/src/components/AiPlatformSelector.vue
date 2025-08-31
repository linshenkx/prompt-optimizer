<template>
  <div class="ai-platform-selector">
    <!-- 快速选择区域 -->
    <div class="platform-quick-select mb-4">
      <h3 class="text-lg font-medium mb-3">{{ t('aiRedirect.selectPlatform') }}</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          v-for="platform in supportedPlatforms"
          :key="platform.id"
          :class="[
            'platform-option',
            {
              'platform-option--selected': selectedPlatform === platform.id,
              'platform-option--disabled': !platform.enabled
            }
          ]"
          :disabled="!platform.enabled"
          @click="selectPlatform(platform.id)"
        >
          <div class="platform-icon">
            <component 
              :is="getPlatformIcon(platform.id)" 
              class="w-6 h-6"
            />
          </div>
          <div class="platform-info">
            <div class="platform-name">{{ platform.name }}</div>
            <div class="platform-description">{{ platform.description }}</div>
          </div>
        </button>
      </div>
    </div>

    <!-- 配置选项 -->
    <div class="redirect-options mb-4">
      <div class="space-y-3">
        <label class="flex items-center space-x-2">
          <input
            v-model="copyContent"
            type="checkbox"
            class="form-checkbox"
          />
          <span>{{ t('aiRedirect.copyContent') }}</span>
        </label>
        
        <label class="flex items-center space-x-2">
          <input
            v-model="autoRedirectEnabled"
            type="checkbox"
            class="form-checkbox"
          />
          <span>{{ t('aiRedirect.enableAutoRedirect') }}</span>
        </label>

        <div v-if="autoRedirectEnabled" class="ml-6">
          <label class="flex items-center space-x-2">
            <span class="text-sm">{{ t('aiRedirect.delayBeforeRedirect') }}</span>
            <select v-model="autoRedirectDelay" class="form-select text-sm">
              <option value="0">{{ t('aiRedirect.immediately') }}</option>
              <option value="1000">1{{ t('common.seconds') }}</option>
              <option value="2000">2{{ t('common.seconds') }}</option>
              <option value="3000">3{{ t('common.seconds') }}</option>
              <option value="5000">5{{ t('common.seconds') }}</option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="platform-actions flex justify-between items-center">
      <div class="text-sm text-gray-500">
        {{ t('aiRedirect.contentWillBeCopied') }}
      </div>
      
      <div class="flex space-x-2">
        <button
          class="btn-secondary"
          @click="$emit('cancel')"
        >
          {{ t('common.cancel') }}
        </button>
        
        <button
          :disabled="!selectedPlatform || redirecting"
          :class="[
            'btn-primary',
            { 'opacity-50 cursor-not-allowed': !selectedPlatform || redirecting }
          ]"
          @click="handleRedirect"
        >
          <span v-if="redirecting" class="flex items-center space-x-1">
            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <span>{{ t('aiRedirect.redirecting') }}</span>
          </span>
          <span v-else>{{ t('aiRedirect.redirectNow') }}</span>
        </button>
      </div>
    </div>

    <!-- 自动跳转倒计时提示 -->
    <div v-if="autoRedirectEnabled && selectedPlatform && countdown > 0" class="auto-redirect-countdown">
      <div class="text-center py-2 text-sm text-blue-600">
        {{ t('aiRedirect.autoRedirectIn', { seconds: Math.ceil(countdown / 1000) }) }}
      </div>
      <div class="w-full bg-gray-200 rounded-full h-1">
        <div 
          class="bg-blue-600 h-1 rounded-full transition-all duration-1000 ease-linear"
          :style="{ width: `${100 - (countdown / (autoRedirectDelay || 1000)) * 100}%` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SupportedProvider, PlatformOption } from '@prompt-optimizer/core'

// Props
interface Props {
  platforms: PlatformOption[]
  defaultPlatform?: SupportedProvider
  prompt: string
  autoRedirect?: boolean
  initialCopyContent?: boolean
  initialAutoRedirectDelay?: number
}

const props = withDefaults(defineProps<Props>(), {
  autoRedirect: false,
  initialCopyContent: true,
  initialAutoRedirectDelay: 2000
})

// Emits
const emit = defineEmits<{
  redirect: [platform: SupportedProvider, options: {
    copyContent: boolean
    autoRedirectEnabled: boolean
    autoRedirectDelay: number
  }]
  cancel: []
  configChange: [config: {
    defaultPlatform: SupportedProvider
    copyContent: boolean
    autoRedirectEnabled: boolean
    autoRedirectDelay: number
  }]
}>()

const { t } = useI18n()

// 响应式数据
const selectedPlatform = ref<SupportedProvider | null>(props.defaultPlatform || null)
const copyContent = ref(props.initialCopyContent)
const autoRedirectEnabled = ref(props.autoRedirect)
const autoRedirectDelay = ref(props.initialAutoRedirectDelay)
const redirecting = ref(false)
const countdown = ref(0)

let countdownTimer: number | null = null

// 计算属性
const supportedPlatforms = computed(() => 
  props.platforms.filter(p => p.enabled)
)

// 获取平台图标
const getPlatformIcon = (platformId: SupportedProvider) => {
  const iconMap = {
    openai: 'ChatGptIcon',
    claude: 'ClaudeIcon', 
    gemini: 'GeminiIcon',
    deepseek: 'DeepSeekIcon',
    zhipu: 'ZhipuIcon',
    custom: 'CustomIcon'
  }
  
  // 返回通用图标组件名，具体图标可以根据需要实现
  return iconMap[platformId] || 'DefaultIcon'
}

// 选择平台
const selectPlatform = (platformId: SupportedProvider) => {
  selectedPlatform.value = platformId
  startAutoRedirectCountdown()
}

// 开始自动跳转倒计时
const startAutoRedirectCountdown = () => {
  if (!autoRedirectEnabled.value || !selectedPlatform.value) return
  
  stopCountdown()
  countdown.value = autoRedirectDelay.value
  
  countdownTimer = window.setInterval(() => {
    countdown.value -= 100
    if (countdown.value <= 0) {
      handleRedirect()
    }
  }, 100)
}

// 停止倒计时
const stopCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdown.value = 0
}

// 处理跳转
const handleRedirect = async () => {
  if (!selectedPlatform.value || redirecting.value) return
  
  stopCountdown()
  redirecting.value = true
  
  try {
    emit('redirect', selectedPlatform.value, {
      copyContent: copyContent.value,
      autoRedirectEnabled: autoRedirectEnabled.value,
      autoRedirectDelay: autoRedirectDelay.value
    })
  } finally {
    redirecting.value = false
  }
}

// 监听配置变化
watch([selectedPlatform, copyContent, autoRedirectEnabled, autoRedirectDelay], () => {
  if (selectedPlatform.value) {
    emit('configChange', {
      defaultPlatform: selectedPlatform.value,
      copyContent: copyContent.value,
      autoRedirectEnabled: autoRedirectEnabled.value,
      autoRedirectDelay: autoRedirectDelay.value
    })
  }
})

// 监听自动跳转配置变化
watch([autoRedirectEnabled, autoRedirectDelay], () => {
  if (selectedPlatform.value) {
    startAutoRedirectCountdown()
  }
})

// 组件挂载时初始化
onMounted(() => {
  // 如果有默认平台且启用自动跳转，开始倒计时
  if (selectedPlatform.value && autoRedirectEnabled.value) {
    startAutoRedirectCountdown()
  }
})

// 组件卸载时清理定时器
onUnmounted(() => {
  stopCountdown()
})
</script>

<style scoped>
.ai-platform-selector {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  min-width: 400px;
  max-width: 600px;
}

.dark .ai-platform-selector {
  background: #1f2937;
}

.platform-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 2px solid #d1d5db;
  border-radius: 0.5rem;
  transition: all 0.2s;
}

.platform-option:hover {
  border-color: #93c5fd;
  background-color: #eff6ff;
}

.platform-option:focus {
  outline: none;
  box-shadow: 0 0 0 2px #3b82f6;
}

.platform-option--selected {
  border-color: #3b82f6;
  background-color: #eff6ff;
  color: #1d4ed8;
}

.platform-option--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.platform-option--disabled:hover {
  border-color: #d1d5db;
  background-color: transparent;
}

.platform-icon {
  flex-shrink: 0;
}

.platform-info {
  flex: 1;
  text-align: left;
}

.platform-name {
  font-weight: 500;
  font-size: 0.875rem;
}

.platform-description {
  font-size: 0.75rem;
  color: #6b7280;
}

.redirect-options {
  border-top: 1px solid #d1d5db;
  padding-top: 1rem;
}

.form-checkbox {
  width: 1rem;
  height: 1rem;
  color: #2563eb;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
}

.form-checkbox:focus {
  box-shadow: 0 0 0 2px #3b82f6;
}

.form-select {
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  background: white;
  color: #111827;
}

.form-select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px #3b82f6;
}

.btn-primary {
  padding: 0.5rem 1rem;
  background: #2563eb;
  color: white;
  border-radius: 0.375rem;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-primary:focus {
  outline: none;
  box-shadow: 0 0 0 2px #3b82f6;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: #d1d5db;
  color: #374151;
  border-radius: 0.375rem;
  transition: background-color 0.2s;
}

.btn-secondary:hover {
  background: #9ca3af;
}

.btn-secondary:focus {
  outline: none;
  box-shadow: 0 0 0 2px #6b7280;
}

.auto-redirect-countdown {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
