<template>
  <div class="function-model-manager">
    <NSpace vertical :size="12">
      <NCard embedded size="small" :bordered="false" class="function-config-card">
        <template #header>
          <NSpace justify="space-between" align="center" :size="8" class="section-header">
            <NText strong>{{ t('functionModel.evaluationModel') }}</NText>
            <NTag size="small" type="default" round :bordered="false">
              {{ t('modelManager.textModels') }}
            </NTag>
          </NSpace>
        </template>

        <NSpace vertical :size="12" class="config-section">
          <NText depth="3" class="section-hint">
            {{ t('functionModel.evaluationModelHint') }}
          </NText>

          <NSpace align="center" :size="8" class="model-select-row">
            <SelectWithConfig
              :model-value="evaluationModel || null"
              :options="evaluationModelOptions"
              :getPrimary="OptionAccessors.getPrimary"
              :getSecondary="OptionAccessors.getSecondary"
              :getValue="OptionAccessors.getValue"
              :placeholder="t('functionModel.evaluationModelPlaceholder')"
              size="medium"
              filterable
              clearable
              :show-config-action="true"
              :show-empty-config-c-t-a="true"
              class="model-select"
              @focus="refreshModels"
              @config="handleOpenModelManager"
              @update:model-value="handleEvaluationModelChange"
            />
            <template v-if="selectedEvaluationModelInfo">
              <NTag v-if="selectedEvaluationModelInfo.provider" size="small" type="default" round :bordered="false">
                {{ selectedEvaluationModelInfo.provider }}
              </NTag>
              <NTag v-if="selectedEvaluationModelInfo.model" size="small" type="info" round :bordered="false">
                {{ selectedEvaluationModelInfo.model }}
              </NTag>
            </template>
          </NSpace>
        </NSpace>
      </NCard>

      <NCard embedded size="small" :bordered="false" class="function-config-card">
        <template #header>
          <NSpace justify="space-between" align="center" :size="8" class="section-header">
            <NText strong>{{ t('functionModel.imageRecognitionModel') }}</NText>
            <NTag size="small" type="default" round :bordered="false">
              {{ t('modelManager.textModels') }}
            </NTag>
          </NSpace>
        </template>

        <NSpace vertical :size="12" class="config-section">
          <NText depth="3" class="section-hint">
            {{ t('functionModel.imageRecognitionModelHint') }}
          </NText>

          <NSpace align="center" :size="8" class="model-select-row">
            <SelectWithConfig
              v-model="imageRecognitionModel"
              :options="imageRecognitionModelOptions"
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
              @update:model-value="handleImageRecognitionModelChange"
            />
            <template v-if="selectedImageRecognitionModelInfo">
              <NTag v-if="selectedImageRecognitionModelInfo.provider" size="small" type="default" round :bordered="false">
                {{ selectedImageRecognitionModelInfo.provider }}
              </NTag>
              <NTag v-if="selectedImageRecognitionModelInfo.model" size="small" type="info" round :bordered="false">
                {{ selectedImageRecognitionModelInfo.model }}
              </NTag>
            </template>
          </NSpace>
        </NSpace>
      </NCard>
    </NSpace>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NCard, NSpace, NTag, NText } from 'naive-ui'
import SelectWithConfig from './SelectWithConfig.vue'
import { useFunctionModelManager } from '../composables/model/useFunctionModelManager'
import { DataTransformer, OptionAccessors } from '../utils/data-transformer'
import { getProviderDisplayName, getTextModelConfigDisplayName } from '../utils/provider-display'
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
const {
  evaluationModel,
  imageRecognitionModel,
  setEvaluationModel,
  setImageRecognitionModel,
} = functionModelManager

// 模型选项列表
const evaluationModelOptions = ref<ModelSelectOption[]>([])
const imageRecognitionModelOptions = ref<ModelSelectOption[]>([])

const findModelInfo = (modelKey: string) => {
  if (!modelKey) return null
  const option = evaluationModelOptions.value.find(opt => opt.value === modelKey)
  if (!option?.raw) return null
  return {
    provider: getProviderDisplayName(option.raw.providerMeta, t, ''),
    model: option.raw.modelMeta?.id || null,
  }
}

const selectedEvaluationModelInfo = computed(() => {
  return findModelInfo(evaluationModel.value)
})

const selectedImageRecognitionModelInfo = computed(() => {
  return findModelInfo(imageRecognitionModel.value)
})

const ensureInitializedIfSupported = async (manager: unknown) => {
  if (!manager || typeof manager !== 'object') return
  const m = manager as { ensureInitialized?: () => Promise<void> }
  if (typeof m.ensureInitialized === 'function') {
    await m.ensureInitialized()
  }
}

// 刷新模型列表
const refreshModels = async () => {
  if (!servicesRef.value?.modelManager) {
    evaluationModelOptions.value = []
    imageRecognitionModelOptions.value = []
    return
  }

  try {
    const manager = servicesRef.value.modelManager
    await ensureInitializedIfSupported(manager)
    const enabledModels = await manager.getEnabledModels()

    const getProviderName = (model: ModelSelectOption['raw']) => getProviderDisplayName(model.providerMeta, t)
    const getModelName = (model: ModelSelectOption['raw']) => getTextModelConfigDisplayName(model, t)
    evaluationModelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels, { getProviderName, getModelName })
    imageRecognitionModelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels, { getProviderName, getModelName })
  } catch (error) {
    console.error('[FunctionModelManager] Failed to refresh models:', error)
    evaluationModelOptions.value = []
    imageRecognitionModelOptions.value = []
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
  await setEvaluationModel(normalizeModelValue(newValue))
}

const handleImageRecognitionModelChange = async (
  newValue: string | number | (string | number)[] | null
) => {
  await setImageRecognitionModel(normalizeModelValue(newValue))
}

// 初始化
const initialize = async () => {
  await refreshModels()
  await functionModelManager.initialize()
}

// 打开模型管理器
const handleOpenModelManager = () => {
  // 功能模型相关操作优先留在 function 页签，方便直接完成设置
  if (appOpenModelManager) {
    appOpenModelManager('function')
    return
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('model-manager:set-tab', { detail: 'function' }))
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
</style>
