<template>
  <div class="function-model-manager" :class="{ 'function-model-manager--compact': isCompact }">
    <NSpace vertical :size="12">
      <NCard embedded size="small" :bordered="false" class="function-config-card">
        <template #header>
          <NSpace justify="space-between" align="center" :size="8" class="section-header">
            <NText strong>{{ t('functionModel.evaluationModel') }}</NText>
            <NTag v-if="!isCompact" size="small" type="default" round :bordered="false">
              {{ t('modelManager.textModels') }}
            </NTag>
          </NSpace>
        </template>

        <NSpace vertical :size="12" class="config-section">
          <NText depth="3" class="section-hint">
            {{ t('functionModel.evaluationModelHint') }}
          </NText>
          <NText v-if="!isEvaluationModelAvailable" type="warning" class="section-hint">
            {{ t('functionModel.evaluationModelUnavailable') }}
          </NText>

          <NSpace align="center" :size="8" class="model-select-row" item-class="function-model-select-item">
            <TextModelSelector scope="function"
              :model-value="evaluationModel || ''"
              :options="evaluationModelOptions"
              :placeholder="t('functionModel.evaluationModelPlaceholder')"
              size="medium"
              clearable
              :clear-label="t('model.selector.followDefault')"
              class="model-select"
              @focus="refreshModels"
              @config="handleOpenModelManager"
              @update:model-value="handleEvaluationModelChange"
            />
          </NSpace>
        </NSpace>
      </NCard>

      <NCard embedded size="small" :bordered="false" class="function-config-card">
        <template #header>
          <NSpace justify="space-between" align="center" :size="8" class="section-header">
            <NText strong>{{ t('functionModel.imageRecognitionModel') }}</NText>
            <NTag v-if="!isCompact" size="small" type="default" round :bordered="false">
              {{ t('modelManager.textModels') }}
            </NTag>
          </NSpace>
        </template>

        <NSpace vertical :size="12" class="config-section">
          <NText depth="3" class="section-hint">
            {{ t('functionModel.imageRecognitionModelHint') }}
          </NText>
          <NText v-if="!isImageRecognitionModelAvailable" type="warning" class="section-hint">
            {{ t('functionModel.imageRecognitionModelUnavailable') }}
          </NText>

          <NSpace align="center" :size="8" class="model-select-row" item-class="function-model-select-item">
            <TextModelSelector scope="function"
              :model-value="imageRecognitionModel || ''"
              :options="imageRecognitionModelOptions"
              :placeholder="t('model.select.placeholder')"
              size="medium"
              class="model-select"
              @focus="refreshModels"
              @config="handleOpenModelManager"
              @update:model-value="handleImageRecognitionModelChange"
            />
          </NSpace>
        </NSpace>
      </NCard>
    </NSpace>
  </div>
</template>

<script setup lang="ts">
import { inject, onMounted, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NCard, NSpace, NTag, NText } from 'naive-ui'
import TextModelSelector from './TextModelSelector.vue'
import { useFunctionModelManager } from '../composables/model/useFunctionModelManager'
import { DataTransformer } from '../utils/data-transformer'
import { getProviderDisplayName, getTextModelConfigDisplayName } from '../utils/provider-display'
import type { AppServices } from '../types/services'
import type { ModelSelectOption } from '../types/select-options'
import { useWorkspaceLayout } from '../composables/ui/useWorkspaceLayout'
import { useToast } from '../composables/ui/useToast'
import { formatErrorSummary } from '../utils/error'

const { t } = useI18n()
const { isCompact } = useWorkspaceLayout()
const toast = useToast()

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
const {
  evaluationModel,
  isEvaluationModelAvailable,
  imageRecognitionModel,
  isImageRecognitionModelAvailable,
  setEvaluationModel,
  setImageRecognitionModel,
} = functionModelManager

// 模型选项列表
const evaluationModelOptions = ref<ModelSelectOption[]>([])
const imageRecognitionModelOptions = ref<ModelSelectOption[]>([])

const ensureInitializedIfSupported = async (manager: unknown) => {
  if (!manager || typeof manager !== 'object') return
  const m = manager as { ensureInitialized?: () => Promise<void> }
  if (typeof m.ensureInitialized === 'function') {
    await m.ensureInitialized()
  }
}

// 刷新模型列表
let modelListRefreshToken = 0
const refreshModels = async () => {
  const token = ++modelListRefreshToken
  if (!servicesRef.value?.modelManager) {
    evaluationModelOptions.value = []
    imageRecognitionModelOptions.value = []
    return
  }

  try {
    const manager = servicesRef.value.modelManager
    await ensureInitializedIfSupported(manager)
    const enabledModels = await manager.getEnabledModels()
    if (token !== modelListRefreshToken) return

    const getProviderName = (model: ModelSelectOption['raw']) => getProviderDisplayName(model.providerMeta, t)
    const getModelName = (model: ModelSelectOption['raw']) => getTextModelConfigDisplayName(model, t)
    evaluationModelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels, { getProviderName, getModelName })
    imageRecognitionModelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels, { getProviderName, getModelName })
  } catch (error) {
    if (token !== modelListRefreshToken) return
    console.error('[FunctionModelManager] Failed to refresh models:', error)
    toast.error(formatErrorSummary(t('functionModel.loadFailed'), error))
  }
}

const normalizeModelValue = (
  newValue: string | number | (string | number)[] | null
) => {
  return typeof newValue === 'string'
    ? newValue
    : Array.isArray(newValue)
      ? String(newValue[0] ?? '')
      : newValue === null
        ? ''
        : String(newValue)
}

const handleEvaluationModelChange = async (
  newValue: string | number | (string | number)[] | null
) => {
  try {
    await setEvaluationModel(normalizeModelValue(newValue))
  } catch (error) {
    toast.error(formatErrorSummary(t('functionModel.saveFailed'), error))
  }
}

const handleImageRecognitionModelChange = async (
  newValue: string | number | (string | number)[] | null
) => {
  try {
    await setImageRecognitionModel(normalizeModelValue(newValue))
  } catch (error) {
    toast.error(formatErrorSummary(t('functionModel.saveFailed'), error))
  }
}

// 初始化
const initialize = async () => {
  try {
    await refreshModels()
    await functionModelManager.initialize()
  } catch (error) {
    toast.error(formatErrorSummary(t('functionModel.loadFailed'), error))
  }
}

// 打开模型管理器
const handleOpenModelManager = () => {
  // Configuration actions open connection settings; function selection remains global.
  if (appOpenModelManager) {
    appOpenModelManager('text')
    return
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('model-manager:set-tab', { detail: 'text' }))
  }
  console.warn('[FunctionModelManager] openModelManager not provided by host app')
}

// 刷新
const refresh = async () => {
  try {
    await refreshModels()
    await functionModelManager.refresh()
  } catch (error) {
    toast.error(formatErrorSummary(t('functionModel.loadFailed'), error))
  }
}

onMounted(initialize)

defineExpose({ refresh })
</script>

<style scoped>
.function-model-manager {
  width: 100%;
}

.function-config-card {
  border-radius: 16px;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header {
  width: 100%;
}

.section-hint {
  font-size: 12px;
}

.model-select-row {
  flex-wrap: wrap;
}

.model-select {
  min-width: 200px;
  flex: 1;
  max-width: 300px;
}
.function-model-manager--compact .function-config-card { border-radius: 12px; }
.function-model-manager--compact .function-config-card :deep(> .n-card-header) { padding: 12px 12px 0; }
.function-model-manager--compact .function-config-card :deep(> .n-card-content) { padding: 8px 12px 12px; }
.function-model-manager--compact .section-hint { line-height: 1.6; }
.function-model-manager--compact .model-select { min-width: 0; max-width: none; width: 100%; }
.function-model-manager--compact :deep(.function-model-select-item) { width: 100%; min-width: 0; }
</style>
