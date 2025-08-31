<template>
  <div class="flex flex-col h-full">
    <!-- 标题和按钮区域 -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3 flex-none">
      <div class="flex items-center gap-3 flex-wrap">
        <h3 class="text-lg font-semibold theme-text">{{ t('prompt.optimized') }}</h3>
        <div v-if="versions && versions.length > 0" 
             class="flex items-center gap-1 version-container"
             style="position: relative;">
          <button
            v-for="version in versions.slice().reverse()"
            :key="version.id"
            @click="switchVersion(version)"
            class="px-2 py-1 text-xs rounded transition-colors flex-shrink-0"
            :class="[
              currentVersionId === version.id
                ? 'font-medium theme-prompt-version-selected'
                : 'theme-prompt-version-unselected'
            ]"
          >
            V{{ version.version }}
          </button>
        </div>
      </div>
      <div class="flex items-center space-x-4 flex-shrink-0">
        <button
          v-if="optimizedPrompt"
          @click="handleIterate"
          class="px-3 py-1.5 theme-button-secondary flex items-center space-x-2"
          :disabled="isIterating"
        >
          <span>{{ isIterating ? t('prompt.optimizing') : t('prompt.continueOptimize') }}</span>
        </button>
      </div>
    </div>
    
    <!-- 内容区域：使用 OutputDisplay 组件 -->
    <div class="flex-1 min-h-0">
      <OutputDisplay
        ref="outputDisplayRef"
        :content="optimizedPrompt"
        :original-content="previousVersionText"
        :reasoning="reasoning"
        mode="editable"
        :streaming="isOptimizing || isIterating"
        :enable-diff="true"
        :enable-copy="true"
        :enable-fullscreen="true"
        :enable-edit="true"
        :enable-ai-redirect="true"
        :ai-redirect-service="aiRedirectService"
        :ai-redirect-config="aiRedirectConfig"
        :placeholder="t('prompt.optimizedPlaceholder')"
        @update:content="$emit('update:optimizedPrompt', $event)"
        @ai-redirect="(config, options) => $emit('ai-redirect', config, options)"
      />
    </div>

    <!-- 迭代优化弹窗 -->
    <Modal
      v-model="showIterateInput"
      @confirm="submitIterate"
    >
      <template #title>
        {{ templateTitleText }}
      </template>
      
      <div class="space-y-4">
        <div>
          <h4 class="theme-label mb-2">{{ templateSelectText }}</h4>
          <TemplateSelect
            ref="iterateTemplateSelectRef"
            :modelValue="selectedIterateTemplate"
            @update:modelValue="$emit('update:selectedIterateTemplate', $event)"
            :type="templateType"
            :optimization-mode="optimizationMode"
            :services="services"
            @manage="$emit('openTemplateManager', templateType)"
          />
        </div>
        
        <div>
          <h4 class="theme-label mb-2">{{ t('prompt.iterateDirection') }}</h4>
          <textarea
            v-model="iterateInput"
            class="w-full theme-input resize-none"
            :placeholder="t('prompt.iteratePlaceholder')"
            rows="3"
          ></textarea>
        </div>
      </div>
      
      <template #footer>
        <button
          @click="cancelIterate"
          class="theme-button-secondary"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          @click="submitIterate"
          class="theme-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!iterateInput.trim() || isIterating"
        >
          {{ isIterating ? t('prompt.optimizing') : t('prompt.confirmOptimize') }}
        </button>
      </template>
    </Modal>

    <!-- 全屏弹窗(已废弃，由OutputDisplay处理) -->
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { useI18n } from 'vue-i18n'
import { ref, computed, nextTick, watch, type Ref } from 'vue'
import { useToast } from '../composables/useToast'
import TemplateSelect from './TemplateSelect.vue'
import Modal from './Modal.vue'
import OutputDisplay from './OutputDisplay.vue'
import type {
  Template,
  PromptRecord,
  AiRedirectService,
  AiRedirectConfig,
  RedirectOptions
} from '@prompt-optimizer/core'
import type { AppServices } from '../types/services'

const { t } = useI18n()
const toast = useToast()

interface IteratePayload {
  originalPrompt: string;
  optimizedPrompt: string;
  iterateInput: string;
}

const props = defineProps({
  optimizedPrompt: {
    type: String,
    default: ''
  },
  reasoning: {
    type: String,
    default: ''
  },
  isOptimizing: {
    type: Boolean,
    default: false
  },
  isIterating: {
    type: Boolean,
    default: false
  },
  selectedIterateTemplate: {
    type: Object as () => Template | null,
    default: null
  },
  versions: {
    type: Array as () => PromptRecord[],
    default: () => []
  },
  currentVersionId: {
    type: String,
    default: ''
  },
  originalPrompt: {
    type: String,
    default: ''
  },
  optimizationMode: {
    type: String as () => import('@prompt-optimizer/core').OptimizationMode,
    required: true
  },
  services: {
    type: Object as () => Ref<AppServices | null>,
    required: true
  },
  aiRedirectService: {
    type: Object as () => AiRedirectService,
    default: undefined
  },
  aiRedirectConfig: {
    type: Object as () => AiRedirectConfig,
    default: undefined
  }
})

const emit = defineEmits<{
  'update:optimizedPrompt': [value: string];
  'iterate': [payload: IteratePayload];
  'openTemplateManager': [type: 'optimize' | 'userOptimize' | 'iterate'];
  'update:selectedIterateTemplate': [template: Template | null];
  'switchVersion': [version: PromptRecord];
  'templateSelect': [template: Template];
  'ai-redirect': [config: AiRedirectConfig, options: RedirectOptions];
}>()

const showIterateInput = ref(false)
const iterateInput = ref('')
const templateType = ref<'optimize' | 'iterate'>('iterate')

const outputDisplayRef = ref<InstanceType<typeof OutputDisplay> | null>(null);
const iterateTemplateSelectRef = ref<{ refresh?: () => void } | null>(null);

// 计算标题文本
const templateTitleText = computed(() => {
  return t('prompt.iterateTitle')
})

// 计算模板选择标题
const templateSelectText = computed(() => {
  return t('prompt.selectIterateTemplate')
})

// 计算上一版本的文本用于显示
const previousVersionText = computed(() => {
  if (!props.versions || props.versions.length === 0) {
    return props.originalPrompt || ''
  }
  
  const currentIndex = props.versions.findIndex(v => v.id === props.currentVersionId)
  
  if (currentIndex > 0) {
    // 当前版本有上一版本
    return props.versions[currentIndex - 1].optimizedPrompt
  } else if (currentIndex === 0) {
    // 当前是V1，使用原始提示词
    return props.originalPrompt || ''
  } else {
    // 找不到当前版本，使用原始提示词
    return props.originalPrompt || ''
  }
})

const handleIterate = () => {
  if (!props.selectedIterateTemplate) {
    toast.error(t('prompt.error.noTemplate'))
    return
  }
  showIterateInput.value = true
}

const cancelIterate = () => {
  showIterateInput.value = false
  iterateInput.value = ''
}

const submitIterate = () => {
  if (!iterateInput.value.trim()) return
  if (!props.selectedIterateTemplate) {
    toast.error(t('prompt.error.noTemplate'))
    return
  }
  
  emit('iterate', {
    originalPrompt: props.originalPrompt,
    optimizedPrompt: props.optimizedPrompt,
    iterateInput: iterateInput.value.trim()
  })
  
  // 重置输入
  iterateInput.value = ''
  showIterateInput.value = false
}

// 添加版本切换函数
const switchVersion = async (version: PromptRecord) => {
  if (version.id === props.currentVersionId) return
  
  // 发出版本切换事件
  emit('switchVersion', version)
  
  // 等待父组件更新内容
  await nextTick()
  
  // 强制刷新OutputDisplay的内容
  if (outputDisplayRef.value) {
    outputDisplayRef.value.forceRefreshContent()
  }
  
  console.log('[PromptPanel] 版本切换完成，强制刷新内容:', {
    versionId: version.id,
    version: version.version
  })
}

// 监听流式状态变化，强制退出编辑状态
watch([() => props.isOptimizing, () => props.isIterating], ([newOptimizing, newIterating], [oldOptimizing, oldIterating]) => {
  // 当开始优化或迭代时（从false变为true），强制退出编辑状态
  if ((!oldOptimizing && newOptimizing) || (!oldIterating && newIterating)) {
    if (outputDisplayRef.value) {
      outputDisplayRef.value.forceExitEditing()
      console.log('[PromptPanel] 检测到开始优化/迭代，强制退出编辑状态')
    }
  }
}, { immediate: false })

// 暴露刷新迭代模板选择的方法
const refreshIterateTemplateSelect = () => {
  if (iterateTemplateSelectRef.value?.refresh) {
    iterateTemplateSelectRef.value.refresh()
  }
}

defineExpose({
  refreshIterateTemplateSelect
})

</script>

<style scoped>
/* 版本容器样式 */
.version-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

@media (max-width: 640px) {
  .version-container {
    margin-top: 4px;
  }
}
</style>