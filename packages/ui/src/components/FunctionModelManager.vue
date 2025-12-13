<template>
  <div class="function-model-manager">
    <NSpace vertical :size="16">
      <!-- 评估模型配置 -->
      <div class="config-section">
        <NSpace align="center" :size="8" class="section-header">
          <NText strong>{{ t('functionModel.evaluationModel') }}</NText>
        </NSpace>
        <NText depth="3" class="section-hint">
          {{ t('functionModel.evaluationModelHint') }}
        </NText>

        <NSpace align="center" :size="8" class="model-select-row">
          <SelectWithConfig
            v-model="evaluationModel"
            :options="modelOptions"
            :getPrimary="OptionAccessors.getPrimary"
            :getSecondary="OptionAccessors.getSecondary"
            :getValue="OptionAccessors.getValue"
            :placeholder="t('model.select.placeholder')"
            size="medium"
            filterable
            :show-config-action="true"
            :show-empty-config-c-t-a="true"
            class="model-select"
            @focus="refreshModels"
            @config="handleOpenModelManager"
            @update:model-value="handleModelChange"
          />
          <!-- 显示模型源和模型名称标签 -->
          <template v-if="selectedModelInfo">
            <NTag v-if="selectedModelInfo.provider" size="small" type="info">
              {{ selectedModelInfo.provider }}
            </NTag>
            <NTag v-if="selectedModelInfo.model" size="small">
              {{ selectedModelInfo.model }}
            </NTag>
          </template>
        </NSpace>
      </div>
    </NSpace>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSpace, NText, NTag } from 'naive-ui'
import SelectWithConfig from './SelectWithConfig.vue'
import { useFunctionModelManager } from '../composables/model/useFunctionModelManager'
import { DataTransformer, OptionAccessors } from '../utils/data-transformer'
import type { AppServices } from '../types/services'
import type { ModelSelectOption } from '../types/select-options'

const { t } = useI18n()

// 获取服务
const services = inject<AppServices | Ref<AppServices | null>>('services')
if (!services) {
  throw new Error('[FunctionModelManager] services not provided')
}

// 注入 App 层统一的 openModelManager 接口（如果存在）
const appOpenModelManager = inject<
  ((tab?: 'text' | 'image' | 'function') => void) | null
>('openModelManager', null)

// 统一转为 Ref 格式
const servicesRef: Ref<AppServices | null> = 'value' in services
  ? (services as Ref<AppServices | null>)
  : ref(services as AppServices)

// 使用功能模型管理器（单例）
const functionModelManager = useFunctionModelManager(servicesRef)
const { evaluationModel, setEvaluationModel } = functionModelManager

// 模型选项列表
const modelOptions = ref<ModelSelectOption[]>([])

// 获取选中模型的详细信息（用于显示标签）
const selectedModelInfo = computed(() => {
  if (!evaluationModel.value) return null
  const option = modelOptions.value.find(opt => opt.value === evaluationModel.value)
  if (!option?.raw) return null
  return {
    provider: option.raw.providerMeta?.name || null,
    model: option.raw.modelMeta?.id || null,
  }
})

// 刷新模型列表
const refreshModels = async () => {
  if (!servicesRef.value?.modelManager) {
    modelOptions.value = []
    return
  }

  try {
    const manager = servicesRef.value.modelManager
    if (typeof (manager as any).ensureInitialized === 'function') {
      await (manager as any).ensureInitialized()
    }
    const enabledModels = await manager.getEnabledModels()
    modelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels)
  } catch (error) {
    console.error('[FunctionModelManager] Failed to refresh models:', error)
    modelOptions.value = []
  }
}

// 处理模型变化
const handleModelChange = async (newValue: string) => {
  await setEvaluationModel(newValue)
}

// 初始化
const initialize = async () => {
  await refreshModels()
  // 确保功能模型管理器已初始化
  await functionModelManager.initialize()
}

// 打开模型管理器
const handleOpenModelManager = () => {
  // 评估模型依赖文本模型配置：优先切到 text 页签
  if (appOpenModelManager) {
    appOpenModelManager('text')
    return
  }

  // 兜底：如果没有注入 openModelManager，只能尝试切换页签并提示宿主补齐注入
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('model-manager:set-tab', { detail: 'text' }))
  }
  console.warn('[FunctionModelManager] openModelManager not provided by host app')
}

// 刷新
const refresh = async () => {
  await refreshModels()
  await functionModelManager.refresh()
}

onMounted(initialize)

defineExpose({ refresh })
</script>

<style scoped>
.function-model-manager {
  padding: 12px 0;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  margin-bottom: 4px;
}

.section-hint {
  font-size: 12px;
  margin-bottom: 8px;
}

.model-select-row {
  flex-wrap: wrap;
}

.model-select {
  min-width: 200px;
  flex: 1;
  max-width: 300px;
}
</style>
