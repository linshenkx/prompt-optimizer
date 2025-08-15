<!-- AI平台选择器组件 -->
<template>
  <div class="relative inline-block text-left">
    <button
      @click="toggleDropdown"
      class="theme-select-trigger flex items-center gap-2 px-3 py-1.5 text-sm"
      :disabled="disabled"
    >
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <component 
          :is="getProviderIcon(selectedProvider)"
          class="h-4 w-4 shrink-0"
        />
        <span class="truncate">{{ getProviderDisplayName(selectedProvider) }}</span>
      </div>
      <svg 
        class="h-4 w-4 shrink-0 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-if="isOpen" 
         class="theme-dropdown"
         :style="dropdownStyle"
         @click.stop
         v-click-outside="() => isOpen = false"
    >
      <div class="p-1 max-h-64 overflow-y-auto">
        <div 
          v-for="provider in supportedProviders" 
          :key="provider.id"
          @click="selectProvider(provider.id)"
          class="theme-dropdown-item"
          :class="[
            modelValue === provider.id
              ? 'theme-dropdown-item-active'
              : 'theme-dropdown-item-inactive'
          ]"
        >
          <div class="flex items-center gap-3">
            <component 
              :is="getProviderIcon(provider.id)"
              class="h-4 w-4 shrink-0"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium">{{ provider.name }}</div>
              <div class="text-xs opacity-75 truncate">{{ provider.description }}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 自定义配置选项 -->
      <div class="border-t theme-dropdown-section">
        <button
          @click="$emit('config')"
          class="theme-dropdown-config-button"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{{ t('aiProvider.configure') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { clickOutside } from '../directives/clickOutside'
import type { SupportedProvider } from '@prompt-optimizer/core'

const { t } = useI18n()

const props = defineProps({
  modelValue: {
    type: String as () => SupportedProvider,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'config'])

const isOpen = ref(false)
const vClickOutside = clickOutside

// 支持的AI平台配置
const supportedProviders = [
  {
    id: 'openai' as SupportedProvider,
    name: 'OpenAI',
    description: 'ChatGPT, GPT-4'
  },
  {
    id: 'gemini' as SupportedProvider,
    name: 'Google Gemini',
    description: 'Gemini Pro, Ultra'
  },
  {
    id: 'claude' as SupportedProvider,
    name: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet'
  },
  {
    id: 'deepseek' as SupportedProvider,
    name: 'DeepSeek',
    description: 'DeepSeek V2.5'
  },
  {
    id: 'zhipu' as SupportedProvider,
    name: '智谱清言',
    description: 'ChatGLM'
  }
]

const selectedProvider = computed(() => props.modelValue)

// 获取平台显示名称
const getProviderDisplayName = (providerId: SupportedProvider) => {
  const provider = supportedProviders.find(p => p.id === providerId)
  return provider?.name || providerId
}

// 获取平台图标
const getProviderIcon = (providerId: SupportedProvider) => {
  const iconMap = {
    openai: () => h('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zm-2.4569-11.0784a4.4708 4.4708 0 0 1 2.3445-1.9728V9.8311a.7817.7817 0 0 0 .3973.6762l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 1.0982 6.2584zm16.2973 3.8558L11.5781 6.8293l2.0201-1.1685a.0757.0757 0 0 1 .071 0L18.5093 8.428a4.4825 4.4825 0 0 1-.6081 8.0999v-4.6416a.7793.7793 0 0 0-.4051-.6725zm2.0202-3.0096L18.1963 8.8201a.7756.7756 0 0 0-.7806 0L11.5584 12.23V9.9009a.0758.0758 0 0 1 .0332-.0614l4.8303-2.7865a4.4991 4.4991 0 0 1 6.6781 4.6623zm-16.9965 6.1248l-2.02-1.1685a.0715.0715 0 0 1-.038-.0529V9.0335a4.4992 4.4992 0 0 1 7.3737-3.4962l-.1419.0804L4.7783 8.3154a.7948.7948 0 0 0-.3927.6813zm1.1007-2.3559l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997L2.6074 11.78z'
      })
    ]),
    gemini: () => h('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M11.04 12.969c.096-.19.154-.394.2-.607.023-.107.039-.215.053-.324.014-.108.025-.217.03-.326.01-.22.008-.441-.01-.661a6.833 6.833 0 00-.146-.65 6.976 6.976 0 00-.245-.63c-.093-.208-.196-.411-.31-.606-.228-.39-.503-.752-.82-1.073a6.987 6.987 0 00-1.073-.82c-.195-.114-.398-.217-.606-.31a6.976 6.976 0 00-.63-.245 6.833 6.833 0 00-.65-.146c-.22-.018-.441-.02-.661-.01-.109.005-.218.016-.326.03-.109.014-.217.03-.324.053-.213.046-.417.104-.607.2L4.5 7.5l6.54 5.469z'
      }),
      h('path', {
        d: 'M19.5 16.5l-6.54-5.469c-.096.19-.154.394-.2.607-.023.107-.039.215-.053.324-.014.108-.025.217-.03.326-.01.22-.008.441.01.661.03.22.073.436.146.65.073.214.157.423.245.63.093.208.196.411.31.606.228.39.503.752.82 1.073.317.321.683.592 1.073.82.195.114.398.217.606.31.208.088.417.172.63.245.214.073.43.116.65.146.22.018.441.02.661.01.109-.005.218-.016.326-.03.109-.014.217-.03.324-.053.213-.046.417-.104.607-.2z'
      })
    ]),
    claude: () => h('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'
      })
    ]),
    deepseek: () => h('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M3 9v6h4l2-6V3a1 1 0 011-1h4a1 1 0 011 1v6l2 6h4V9a1 1 0 011-1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z'
      })
    ]),
    zhipu: () => h('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      fill: 'currentColor'
    }, [
      h('path', {
        d: 'M12 2l3.09 6.26L22 9l-5.45 3.74L18.18 22 12 18.26 5.82 22l1.63-9.26L2 9l6.91-.74L12 2z'
      })
    ])
  }
  
  return iconMap[providerId] || iconMap.openai
}

// 切换下拉框
const toggleDropdown = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

// 选择平台
const selectProvider = (providerId: SupportedProvider) => {
  emit('update:modelValue', providerId)
  isOpen.value = false
}

// 下拉框样式
const dropdownStyle = computed(() => ({
  position: 'absolute',
  top: '100%',
  left: '0',
  zIndex: 1000,
  minWidth: '100%'
}))
</script>

<style scoped>
/* 样式已通过 theme-* 类处理 */
</style>

