<template>
  <MainLayoutUI>
    <!-- 标题插槽 -->
    <template #title>
      {{ $t('promptOptimizer.title') }}
    </template>

    <!-- 操作按钮插槽 -->
    <template #actions>
      <ThemeToggleUI />
      <ActionButtonUI
        icon="📝"
        :text="$t('nav.templates')"
        @click="openTemplateManager('optimize')"
      />
      <ActionButtonUI
        icon="📜"
        :text="$t('nav.history')"
        @click="showHistory = true"
      />
      <ActionButtonUI
        icon="⚙️"
        :text="$t('nav.modelManager')"
        @click="showConfig = true"
      />
      <ActionButtonUI
        icon="💾"
        :text="$t('nav.dataManager')"
        @click="showDataManager = true"
      />
      <!-- GitHub 按钮 -->
      <button
        @click="openGithubRepo"
        class="theme-icon-button"
        title="GitHub"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
        </svg>
      </button>
      <LanguageSwitchUI />
    </template>

    <!-- 主要内容插槽 -->
    <!-- 提示词区 -->
    <ContentCardUI class="flex-1 min-w-0 flex flex-col">
      <!-- 输入区域 -->
      <div class="flex-none">
        <InputPanelUI
          v-model="prompt"
          v-model:selectedModel="selectedOptimizeModel"
          :label="promptInputLabel"
          :placeholder="promptInputPlaceholder"
          :model-label="$t('promptOptimizer.optimizeModel')"
          :template-label="$t('promptOptimizer.templateLabel')"
          :button-text="$t('promptOptimizer.optimize')"
          :loading-text="$t('common.loading')"
          :loading="isOptimizing"
          :disabled="isOptimizing"
          @submit="handleOptimizePrompt"
          @configModel="showConfig = true"
        >
          <template #optimization-mode-selector>
            <OptimizationModeSelectorUI
              v-model="selectedOptimizationMode"
              @change="handleOptimizationModeChange"
            />
          </template>
          <template #model-select>
            <ModelSelectUI
              ref="optimizeModelSelect"
              :modelValue="selectedOptimizeModel"
              @update:modelValue="selectedOptimizeModel = $event"
              :disabled="isOptimizing"
              @config="showConfig = true"
            />
          </template>
          <template #template-select>
            <TemplateSelectUI
              ref="templateSelectRef"
              v-model="currentSelectedTemplate"
              :type="selectedOptimizationMode === 'system' ? 'optimize' : 'userOptimize'"
              :optimization-mode="selectedOptimizationMode"
              @manage="openTemplateManager(selectedOptimizationMode === 'system' ? 'optimize' : 'userOptimize')"
            />
          </template>
        </InputPanelUI>
      </div>

      <!-- 优化结果区域 -->
      <div class="flex-1 min-h-0">
        <PromptPanelUI
          v-model:optimized-prompt="optimizedPrompt"
          :original-prompt="prompt"
          :is-optimizing="isOptimizing"
          :is-iterating="isIterating"
          v-model:selected-iterate-template="selectedIterateTemplate"
          :versions="currentVersions"
          :current-version-id="currentVersionId"
          @iterate="handleIteratePrompt"
          @openTemplateManager="openTemplateManager"
          @switchVersion="handleSwitchVersion"
        />
      </div>
    </ContentCardUI>

    <!-- 测试区域 -->
    <TestPanelUI
      class="flex-1 min-w-0 flex flex-col"
      :prompt-service="promptServiceRef"
      :original-prompt="prompt"
      :optimized-prompt="optimizedPrompt"
      :optimization-mode="selectedOptimizationMode"
      v-model="selectedTestModel"
      @showConfig="showConfig = true"
    />

    <!-- 弹窗插槽 -->
    <template #modals>
      <!-- 配置弹窗 -->
      <Teleport to="body">
        <ModelManagerUI
          v-if="showConfig"
          @close="handleModelManagerClose"
          @modelsUpdated="handleModelsUpdated"
          @select="handleModelSelect"
        />
      </Teleport>

      <!-- 提示词管理弹窗 -->
      <Teleport to="body">
        <TemplateManagerUI
          v-if="showTemplates"
          :template-type="currentType"
          :optimization-mode="selectedOptimizationMode"
          :selected-optimize-template="selectedOptimizeTemplate"
          :selected-user-optimize-template="selectedUserOptimizeTemplate"
          :selected-iterate-template="selectedIterateTemplate"
          @close="handleTemplateManagerClose"
        />
      </Teleport>

      <!-- 历史记录弹窗 -->
      <HistoryDrawerUI
        v-model:show="showHistory"
        :history="history"
        @reuse="handleSelectHistory"
        @clear="handleClearHistory"
        @deleteChain="handleDeleteChain"
      />

      <!-- 数据管理弹窗 -->
      <DataManagerUI
        :show="showDataManager"
        @close="handleDataManagerClose"
        @imported="handleDataImported"
      />
    </template>
  </MainLayoutUI>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  // UI组件
  ModelManagerUI,
  ThemeToggleUI,
  TemplateManagerUI,
  HistoryDrawerUI,
  MainLayoutUI,
  ActionButtonUI,
  TestPanelUI,
  LanguageSwitchUI,
  DataManagerUI,
  InputPanelUI,
  PromptPanelUI,
  OptimizationModeSelectorUI,
  ModelSelectUI,
  TemplateSelectUI,
  ContentCardUI,
  // composables
  usePromptOptimizer,
  useToast,
  usePromptHistory,
  useServiceInitializer,
  useModelManager,
  useHistoryManager,
  useModelSelectors,
  // 服务
  modelManager,
  templateManager,
  historyManager,
  // 类型
  type OptimizationMode
} from '@prompt-optimizer/ui'

// 初始化主题
onMounted(() => {
  // 检查本地存储的主题偏好
  const savedTheme = localStorage.getItem('theme')

  // 移除所有主题类
  document.documentElement.classList.remove('dark', 'theme-blue', 'theme-green', 'theme-purple')

  // 应用保存的主题或系统偏好
  if (savedTheme) {
    document.documentElement.classList.add(savedTheme)
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark')
  }
})

// 初始化 toast
const toast = useToast()

// 初始化国际化
const { t } = useI18n()

// 新增状态
const selectedOptimizationMode = ref<OptimizationMode>('system')

// 事件处理
const handleOptimizationModeChange = (mode: OptimizationMode) => {
  selectedOptimizationMode.value = mode
}

// 初始化服务
const {
  promptServiceRef
} = useServiceInitializer(modelManager, templateManager, historyManager)

// 初始化模型选择器
const {
  optimizeModelSelect,
  testModelSelect
} = useModelSelectors()

// 初始化模型管理器
const {
  showConfig,
  selectedOptimizeModel,
  selectedTestModel,
  handleModelManagerClose,
  handleModelsUpdated,
  handleModelSelect
} = useModelManager({
  modelManager,
  optimizeModelSelect,
  testModelSelect
})

// 初始化组合式函数
const {
  prompt,
  optimizedPrompt,
  isOptimizing,
  isIterating,
  selectedOptimizeTemplate,
  selectedUserOptimizeTemplate,
  selectedIterateTemplate,
  currentVersions,
  currentVersionId,
  currentChainId,
  handleOptimizePrompt,
  handleIteratePrompt,
  handleSwitchVersion
} = usePromptOptimizer(
  modelManager,
  templateManager,
  historyManager,
  promptServiceRef,
  selectedOptimizationMode,
  selectedOptimizeModel,
  selectedTestModel
)

// 计算属性：根据优化模式选择对应的模板
const currentSelectedTemplate = computed({
  get() {
    return selectedOptimizationMode.value === 'system'
      ? selectedOptimizeTemplate.value
      : selectedUserOptimizeTemplate.value
  },
  set(newValue) {
    if (!newValue) return;
    if (selectedOptimizationMode.value === 'system') {
      selectedOptimizeTemplate.value = newValue
    } else {
      selectedUserOptimizeTemplate.value = newValue
    }
  }
})

// 计算属性：动态标签
const promptInputLabel = computed(() => {
  return selectedOptimizationMode.value === 'system'
    ? t('promptOptimizer.systemPromptInput')
    : t('promptOptimizer.userPromptInput')
})

const promptInputPlaceholder = computed(() => {
  return selectedOptimizationMode.value === 'system'
    ? t('promptOptimizer.systemPromptPlaceholder')
    : t('promptOptimizer.userPromptPlaceholder')
})

// 初始化历史记录管理器
const {
  history,
  handleSelectHistory: handleSelectHistoryBase,
  handleClearHistory: handleClearHistoryBase,
  handleDeleteChain: handleDeleteChainBase
} = usePromptHistory(
  historyManager,
  prompt,
  optimizedPrompt,
  currentChainId,
  currentVersions,
  currentVersionId
)

// 初始化历史记录管理器UI
const {
  showHistory,
  handleSelectHistory,
  handleClearHistory,
  handleDeleteChain
} = useHistoryManager(
  historyManager,
  prompt,
  optimizedPrompt,
  currentChainId,
  currentVersions,
  currentVersionId,
  handleSelectHistoryBase,
  handleClearHistoryBase,
  handleDeleteChainBase
)

// Template Manager state
const showTemplates = ref(false)
const currentType = ref('')

const openTemplateManager = (type: string) => {
  currentType.value = type
  showTemplates.value = true
}

// 模板选择器引用
const templateSelectRef = ref()

const handleTemplateManagerClose = () => {
  showTemplates.value = false

  // 刷新模板选择器以反映语言变更后的模板
  // 子组件会通过 v-model 自动更新父组件的状态
  if (templateSelectRef.value?.refresh) {
    templateSelectRef.value.refresh()
  }
}

// 数据管理器
const showDataManager = ref(false)

const handleDataManagerClose = () => {
  showDataManager.value = false
}

const handleDataImported = () => {
  // 数据导入后重新加载所有数据
  toast.success(t('dataManager.import.successWithRefresh'))
  setTimeout(() => {
    window.location.reload()
  }, 1000)
}

// GitHub 链接处理
const openGithubRepo = () => {
  window.open('https://github.com/linshenkx/prompt-optimizer', '_blank')
}
</script>