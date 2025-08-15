<template>
  <ContentCardUI>
    <div class="flex flex-col h-full">
      <!-- Test Input Area -->
      <div class="flex-none">
        <!-- Show test input only for system prompt optimization -->
        <InputPanelUI
          v-if="optimizationMode === 'system'"
          v-model="testContent"
          v-model:selectedModel="selectedTestModel"
          :label="t('test.content')"
          :placeholder="t('test.placeholder')"
          :model-label="t('test.model')"
          :button-text="isCompareMode ? t('test.startCompare') : t('test.startTest')"
          :loading-text="t('test.testing')"
          :loading="isTesting"
          :disabled="isTesting"
          @submit="handleTest"
          @configModel="$emit('showConfig')"
        >
          <template #model-select>
            <ModelSelectUI
              ref="testModelSelect"
              :modelValue="selectedTestModel"
              @update:modelValue="updateSelectedModel"
              :disabled="isTesting"
              @config="$emit('showConfig')"
            />
          </template>
          <template #control-buttons>
            <div class="flex-1">
              <div class="h-[20px] mb-1.5"><!-- 占位，与其他元素对齐 --></div>
              <div class="flex items-center gap-2">
                <button
                  @click="isCompareMode = !isCompareMode"
                  class="h-10 text-sm whitespace-nowrap"
                  :class="isCompareMode ? 'theme-button-primary' : 'theme-button-secondary'"
                >
                  {{ isCompareMode ? t('test.toggleCompare.disable') : t('test.toggleCompare.enable') }}
                </button>
              </div>
            </div>
          </template>
        </InputPanelUI>

        <!-- For user prompt optimization, show simplified test controls -->
        <div v-else class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium theme-text">{{ t('test.userPromptTest') }}</h3>
            <div class="flex items-center gap-2">
              <ModelSelectUI
                ref="testModelSelect"
                :modelValue="selectedTestModel"
                @update:modelValue="updateSelectedModel"
                :disabled="isTesting"
                @config="$emit('showConfig')"
                class="w-48"
              />
              <button
                @click="isCompareMode = !isCompareMode"
                class="h-10 text-sm whitespace-nowrap"
                :class="isCompareMode ? 'theme-button-primary' : 'theme-button-secondary'"
              >
                {{ isCompareMode ? t('test.toggleCompare.disable') : t('test.toggleCompare.enable') }}
              </button>
              <button
                @click="handleTest"
                :disabled="isTesting || !selectedTestModel"
                class="h-10 px-4 text-sm font-medium theme-button-primary"
              >
                {{ isTesting ? t('test.testing') : (isCompareMode ? t('test.startCompare') : t('test.startTest')) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Test Results Area -->
      <div class="flex-1 min-h-0 md:overflow-hidden overflow-visible mt-5">
        <div class="relative h-full flex flex-col md:block">
          <!-- Original Prompt Test Result -->
          <div
            v-show="isCompareMode"
            class="flex flex-col min-h-0 transition-all duration-300 min-h-[80px] mb-4 md:mb-0 md:absolute md:inset-0 md:h-full md:w-[calc(50%-6px)] md:mr-3"
            :style="{
              height: isCompareMode ? 'auto' : '0',
              opacity: isCompareMode ? 1 : 0,
              pointerEvents: isCompareMode ? 'auto' : 'none'
            }"
          >
            <h3 class="text-lg font-semibold theme-text truncate mb-3 flex-none">{{ t('test.originalResult') }}</h3>
            <OutputDisplay
              :content="originalTestResult"
              :reasoning="originalTestReasoning"
              :streaming="isTestingOriginal"
              :enableDiff="false"
              mode="readonly"
              class="flex-1 min-h-0"
              :aiRedirectService="aiRedirectService"
              :aiRedirectConfig="aiRedirectConfig"
              @ai-redirect="handleAiRedirect"
            />
          </div>

          <!-- Optimized Prompt Test Result -->
          <div
            class="flex flex-col min-h-0 transition-all duration-300 min-h-[80px]"
            :style="{
              height: isCompareMode ? 'auto' : '100%'
            }"
            :class="{
              'md:absolute md:inset-0 md:h-full md:w-[calc(50%-6px)] md:left-[calc(50%+6px)]': isCompareMode,
              'md:absolute md:inset-0 md:h-full md:w-full md:left-0': !isCompareMode
            }"
          >
            <h3 class="text-lg font-semibold theme-text truncate mb-3 flex-none">
              {{ isCompareMode ? t('test.optimizedResult') : t('test.testResult') }}
            </h3>
            <OutputDisplay
              :content="optimizedTestResult"
              :reasoning="optimizedTestReasoning"
              :streaming="isTestingOptimized"
              :enableDiff="false"
              mode="readonly"
              class="flex-1 min-h-0"
              :aiRedirectService="aiRedirectService"
              :aiRedirectConfig="aiRedirectConfig"
              @ai-redirect="handleAiRedirect"
            />
          </div>
        </div>
      </div>
    </div>
  </ContentCardUI>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '../composables/useToast'
import ContentCardUI from './ContentCard.vue'
import InputPanelUI from './InputPanel.vue'
import ModelSelectUI from './ModelSelect.vue'
import OutputDisplay from './OutputDisplay.vue'
import { AiRedirectService } from '@prompt-optimizer/core'

const { t } = useI18n()
const toast = useToast()

const props = defineProps({
  promptService: {
    type: [Object, null],
    required: true
  },
  originalPrompt: {
    type: String,
    default: ''
  },
  optimizedPrompt: {
    type: String,
    default: ''
  },
  modelValue: {
    type: String,
    default: ''
  },
  optimizationMode: {
    type: String,
    default: 'system'
  }
})

const emit = defineEmits(['showConfig', 'update:modelValue'])

const isCompareMode = ref(true)
const testModelSelect = ref(null)
const selectedTestModel = ref(props.modelValue || '')

watch(() => props.modelValue, (newVal) => {
  if (newVal && newVal !== selectedTestModel.value) {
    selectedTestModel.value = newVal
  }
})

const updateSelectedModel = (value) => {
  selectedTestModel.value = value
  emit('update:modelValue', value)
}

const originalTestResult = ref('')
const originalTestError = ref('')
const isTestingOriginal = ref(false)

// 添加推理内容状态
const originalTestReasoning = ref('')

const optimizedTestResult = ref('')
const optimizedTestError = ref('')
const isTestingOptimized = ref(false)

// 添加推理内容状态
const optimizedTestReasoning = ref('')

const isTesting = computed(() => isTestingOriginal.value || isTestingOptimized.value)
const testContent = ref('')

// AI跳转服务和配置
const aiRedirectService = new AiRedirectService()
const aiRedirectConfig = {
  provider: 'openai' // 默认使用OpenAI，可以根据需要配置
}

// 处理AI跳转事件
const handleAiRedirect = async (config, options) => {
  try {
    const result = await aiRedirectService.redirectToAi(config, options)
    if (result.success) {
      toast.success(t('actions.aiRedirectSuccess'))
    } else {
      toast.error(t('actions.aiRedirectFailed'))
    }
  } catch (error) {
    console.error('AI跳转失败:', error)
    toast.error(t('actions.aiRedirectFailed'))
  }
}

const ensureString = (value) => {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

const testOriginalPrompt = async () => {
  if (!props.originalPrompt) return

  isTestingOriginal.value = true
  originalTestResult.value = ''
  originalTestError.value = ''
  originalTestReasoning.value = ''
  
  await nextTick(); // 确保状态更新和DOM清空完成

  try {
    const streamHandler = {
      onToken: (token) => {
        originalTestResult.value += token
      },
      onReasoningToken: (reasoningToken) => {
        originalTestReasoning.value += reasoningToken
      },
      onComplete: () => { /* 流结束后不再需要设置 isTesting, 由 finally 处理 */ },
      onError: (err) => {
        const errorMessage = err.message || t('test.error.failed')
        originalTestError.value = errorMessage
        toast.error(errorMessage)
      }
    }

    let systemPrompt = ''
    let userPrompt = ''

    if (props.optimizationMode === 'user') {
      systemPrompt = ''
      userPrompt = ensureString(props.originalPrompt)
    } else {
      systemPrompt = ensureString(props.originalPrompt)
      userPrompt = testContent.value
    }

    await props.promptService.testPromptStream(
      systemPrompt,
      userPrompt,
      selectedTestModel.value,
      streamHandler
    )
  } catch (error) {
    console.error('[TestPanel] Original prompt test failed:', error); // 增加详细错误日志
    const errorMessage = error.message || t('test.error.failed')
    originalTestError.value = errorMessage
    toast.error(errorMessage)
    originalTestResult.value = ''
  } finally {
    // 确保无论成功或失败，加载状态最终都会被关闭
    isTestingOriginal.value = false
  }
}

const testOptimizedPrompt = async () => {
  if (!props.optimizedPrompt) return

  isTestingOptimized.value = true
  optimizedTestResult.value = ''
  optimizedTestError.value = ''
  optimizedTestReasoning.value = ''
  
  await nextTick(); // 确保状态更新和DOM清空完成

  try {
    const streamHandler = {
      onToken: (token) => {
        optimizedTestResult.value += token
      },
      onReasoningToken: (reasoningToken) => {
        optimizedTestReasoning.value += reasoningToken
      },
      onComplete: () => { /* 流结束后不再需要设置 isTesting, 由 finally 处理 */ },
      onError: (err) => {
        const errorMessage = err.message || t('test.error.failed')
        optimizedTestError.value = errorMessage
        toast.error(errorMessage)
      }
    }

    let systemPrompt = ''
    let userPrompt = ''

    if (props.optimizationMode === 'user') {
      systemPrompt = ''
      userPrompt = ensureString(props.optimizedPrompt)
    } else {
      systemPrompt = ensureString(props.optimizedPrompt)
      userPrompt = testContent.value
    }

    await props.promptService.testPromptStream(
      systemPrompt,
      userPrompt,
      selectedTestModel.value,
      streamHandler
    )
  } catch (error) {
    console.error('[TestPanel] Optimized prompt test failed:', error); // 增加详细错误日志
    const errorMessage = error.message || t('test.error.failed')
    optimizedTestError.value = errorMessage
    toast.error(errorMessage)
    optimizedTestResult.value = ''
  } finally {
    // 确保无论成功或失败，加载状态最终都会被关闭
    isTestingOptimized.value = false
  }
}

const handleTest = async () => {
  if (!selectedTestModel.value) {
    toast.error(t('test.error.noModel'))
    return
  }

  // For user prompt optimization, we don't need test content input
  // For system prompt optimization, we need test content input
  if (props.optimizationMode === 'system' && !testContent.value) {
    toast.error(t('test.error.noTestContent'))
    return
  }

  if (isCompareMode.value) {
    // Compare test mode: test both original and optimized prompts
    try {
      await Promise.all([
        testOriginalPrompt().catch(error => {
          console.error('[TestPanel] Original prompt test failed:', error)
          const errorMessage = error.message || t('test.error.failed')
          originalTestError.value = errorMessage
          toast.error(errorMessage)
        }),
        testOptimizedPrompt().catch(error => {
          console.error('[TestPanel] Optimized prompt test failed:', error)
          const errorMessage = error.message || t('test.error.failed')
          optimizedTestError.value = errorMessage
          toast.error(errorMessage)
        })
      ])
    } catch (error) {
      console.error('[TestPanel] Test process error:', error)
    }
  } else {
    // Normal test mode: only test optimized prompt
    await testOptimizedPrompt()
  }
}

onMounted(() => {
  if (props.modelValue) {
    selectedTestModel.value = props.modelValue
  }
})
</script>

<style scoped>
.theme-checkbox {
  width: 1rem;
  height: 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
}
/* 小屏幕下允许容器自由扩展 */
@media (max-width: 767px) {
  .min-h-\[80px\] {
    min-height: 120px !important; /* 增加小屏幕下的最小高度 */
  }
  
  /* 确保OutputPanel可以正确扩展 */
  .flex-1 {
    flex: 1 0 auto;
  }
}
</style>