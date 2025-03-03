<template>
  <MainLayoutUI>
    <!-- 标题插槽 -->
    <template #title>
      Prompt Optimizer
    </template>

    <!-- 操作按钮插槽 -->
    <template #actions>
      <ActionButtonUI
        icon="📝"
        text="功能提示词"
        @click="openTemplateManager('optimize')"
      />
      <ActionButtonUI
        icon="📜"
        text="历史记录"
        @click="showHistory = true"
      />
      <ActionButtonUI
        icon="⚙️"
        text="模型管理"
        @click="showConfig = true"
      />
    </template>

    <!-- 主要内容插槽 -->
    <!-- 提示词区 -->
    <ContentCardUI>
      <!-- 输入区域 -->
      <div class="flex-none">
        <InputPanelUI
          v-model="prompt"
          v-model:selectedModel="selectedOptimizeModel"
          label="原始提示词"
          placeholder="请输入需要优化的prompt..."
          model-label="优化模型"
          template-label="优化提示词"
          button-text="开始优化 →"
          loading-text="优化中..."
          :loading="isOptimizing"
          :disabled="isOptimizing"
          @submit="handleOptimizePrompt"
          @configModel="showConfig = true"
        >
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
              v-model="selectedOptimizeTemplate"
              type="optimize"
              @manage="openTemplateManager('optimize')"
              @select="handleTemplateSelect"
            />
          </template>
        </InputPanelUI>
      </div>

      <!-- 优化结果区域 -->
      <div class="flex-1 min-h-0 overflow-y-auto">
        <PromptPanelUI 
          v-model:optimized-prompt="optimizedPrompt"
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
    <ContentCardUI>
      <!-- 测试输入区域 -->
      <div class="flex-none">
        <InputPanelUI
          v-model="testContent"
          v-model:selectedModel="selectedTestModel"
          label="测试内容"
          placeholder="请输入要测试的内容..."
          model-label="模型"
          button-text="开始测试 →"
          loading-text="测试中..."
          :loading="isTesting"
          :disabled="isTesting"
          @submit="() => handleTest(optimizedPrompt)"
          @configModel="showConfig = true"
        >
          <template #model-select>
            <ModelSelectUI
              ref="testModelSelect"
              :modelValue="selectedTestModel"
              @update:modelValue="selectedTestModel = $event"
              :disabled="isTesting"
              @config="showConfig = true"
            />
          </template>
        </InputPanelUI>
      </div>

      <!-- 测试结果区域 -->
      <div class="flex-1 min-h-0 overflow-y-auto">
        <OutputPanelUI
          ref="outputPanelRef"
          :loading="isTesting"
          :error="testError"
          :result="testResult"
        />
      </div>
    </ContentCardUI>

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
          :selected-optimize-template="selectedOptimizeTemplate"
          :selected-iterate-template="selectedIterateTemplate"
          @close="handleTemplateManagerClose"
          @select="handleTemplateSelect"
        />
      </Teleport>

      <!-- 历史记录弹窗 -->
      <HistoryDrawerUI
        v-model:show="showHistory"
        :history="history"
        @reuse="handleSelectHistory"
        @clear="handleClearHistory"
      />
    </template>
  </MainLayoutUI>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import {
  // UI组件
  ToastUI,
  ModelManagerUI,
  OutputPanelUI,
  PromptPanelUI,
  TemplateManagerUI,
  TemplateSelectUI,
  ModelSelectUI,
  HistoryDrawerUI,
  InputPanelUI,
  MainLayoutUI,
  ContentCardUI,
  ActionButtonUI,
  // composables
  usePromptOptimizer,
  usePromptTester,
  useToast,
  usePromptHistory,
  useServiceInitializer,
  useTemplateManager,
  useModelManager,
  useHistoryManager,
  useModelSelectors,
  // 服务
  modelManager,
  templateManager,
  historyManager
} from '@prompt-optimizer/ui'

// 初始化主题
onMounted(() => {
  // 检查本地存储的主题偏好
  const savedTheme = localStorage.getItem('theme')
  
  // 如果用户之前选择了深色模式，或者系统偏好是深色模式且用户没有明确选择
  if (
    savedTheme === 'dark' || 
    (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
})

// 初始化 toast
const toast = useToast()

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
  selectedIterateTemplate,
  currentVersions,
  currentVersionId,
  currentChainId,
  handleOptimizePrompt,
  handleIteratePrompt,
  handleSwitchVersion,
  saveTemplateSelection
} = usePromptOptimizer(
  modelManager,
  templateManager,
  historyManager,
  promptServiceRef,
  selectedOptimizeModel,
  selectedTestModel
)

const {
  testContent,
  testResult,
  testError,
  isTesting,
  handleTest
} = usePromptTester(promptServiceRef, selectedTestModel)

// 初始化历史记录管理器
const {
  history,
  handleSelectHistory: handleSelectHistoryBase,
  handleClearHistory: handleClearHistoryBase
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
  handleClearHistory
} = useHistoryManager(
  historyManager,
  prompt,
  optimizedPrompt,
  currentChainId,
  currentVersions,
  currentVersionId,
  handleSelectHistoryBase
)

// 初始化模板管理器
const {
  showTemplates,
  currentType,
  handleTemplateSelect,
  openTemplateManager,
  handleTemplateManagerClose
} = useTemplateManager({
  selectedOptimizeTemplate,
  selectedIterateTemplate,
  saveTemplateSelection,
  templateManager
})
</script>