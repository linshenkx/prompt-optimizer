<!-- AI平台选择器使用示例 -->
<template>
  <div class="p-6 space-y-6">
    <h2 class="text-2xl font-bold">AI平台选择器示例</h2>
    
    <!-- 基础使用 -->
    <div class="space-y-4">
      <h3 class="text-lg font-semibold">基础用法</h3>
      <div class="flex items-center gap-4">
        <span class="text-sm text-gray-600">选择AI平台：</span>
        <AiProviderSelect
          v-model="selectedProvider"
          @config="handleProviderConfig"
        />
      </div>
      <p class="text-sm text-gray-500">当前选择: {{ selectedProvider }}</p>
    </div>

    <!-- 配合AI跳转功能使用 -->
    <div class="space-y-4">
      <h3 class="text-lg font-semibold">配合AI跳转功能</h3>
      <div class="space-y-3">
        <textarea
          v-model="testPrompt"
          class="w-full h-24 p-3 border border-gray-300 rounded-md resize-none"
          placeholder="输入要发送到AI平台的内容..."
        ></textarea>
        
        <div class="flex items-center gap-4">
          <AiProviderSelect
            v-model="redirectProvider"
            @config="handleProviderConfig"
          />
          <button
            @click="handleAiRedirect"
            :disabled="!testPrompt.trim() || redirectLoading"
            class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ redirectLoading ? '跳转中...' : '跳转到AI平台' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 所有支持的平台展示 -->
    <div class="space-y-4">
      <h3 class="text-lg font-semibold">支持的AI平台</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div 
          v-for="provider in supportedProviders" 
          :key="provider.id"
          class="p-4 border border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer transition-colors"
          :class="{ 'border-blue-500 bg-blue-50': demoProvider === provider.id }"
          @click="demoProvider = provider.id"
        >
          <div class="flex items-center gap-3 mb-2">
            <div class="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
              <span class="text-sm">🤖</span>
            </div>
            <div>
              <div class="font-medium">{{ provider.name }}</div>
              <div class="text-xs text-gray-500">{{ provider.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AiProviderSelect from '../components/AiProviderSelect.vue'
import { AiRedirectService, type SupportedProvider } from '@prompt-optimizer/core'

// 基础选择器状态
const selectedProvider = ref<SupportedProvider>('openai')

// AI跳转相关状态
const redirectProvider = ref<SupportedProvider>('openai')
const testPrompt = ref('你好，请帮我分析一下这个问题。')
const redirectLoading = ref(false)

// 演示用的provider选择
const demoProvider = ref<SupportedProvider>('openai')

// 支持的平台配置
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

// AI跳转服务
const aiRedirectService = new AiRedirectService()

// 处理平台配置
const handleProviderConfig = () => {
  console.log('打开平台配置')
  alert('这里将打开AI平台配置界面')
}

// 处理AI跳转
const handleAiRedirect = async () => {
  if (!testPrompt.value.trim()) return
  
  try {
    redirectLoading.value = true
    
    const result = await aiRedirectService.redirectToAi(
      {
        provider: redirectProvider.value
      },
      {
        prompt: testPrompt.value,
        isNewConversation: true,
        openInNewTab: true
      }
    )
    
    if (result.success) {
      console.log('跳转成功:', result.url)
    } else {
      console.error('跳转失败:', result.error)
      alert('跳转失败: ' + result.error)
    }
  } catch (error) {
    console.error('跳转异常:', error)
    alert('跳转异常: ' + (error as Error).message)
  } finally {
    redirectLoading.value = false
  }
}
</script>

<style scoped>
/* 示例页面样式 */
</style>
