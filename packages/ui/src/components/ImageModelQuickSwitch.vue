<template>
  <div v-if="selectedConfig" class="image-model-quick-switch" data-testid="image-model-quick-switch">
    <NTag
      v-if="disabled"
      size="small"
      :bordered="false"
      class="image-model-quick-switch__model"
      :title="fullModelTitle"
    >
      {{ modelLabel }}
    </NTag>

    <NPopover
      v-else
      v-model:show="popoverVisible"
      trigger="click"
      placement="bottom-start"
      :show-arrow="false"
      @update:show="handlePopoverVisibility"
    >
      <template #trigger>
        <NTag
          size="small"
          :bordered="false"
          class="image-model-quick-switch__model image-model-quick-switch__model--clickable"
          :title="interactiveModelTitle"
          :aria-label="interactiveModelTitle"
          role="button"
          tabindex="0"
        >
          {{ modelLabel }}
        </NTag>
      </template>

      <div class="image-model-quick-switch__popover">
        <NSpace vertical :size="8">
          <NText depth="2" class="image-model-quick-switch__title">
            {{ t('image.model.quickSwitch.title') }}
          </NText>
          <ModelIdSelector
            :value="selectedModelId"
            :options="modelOptions"
            :loading="loading"
            :allow-custom="false"
            :clearable="false"
            :scope-text="t('model.selector.sharedScope')"
            size="small"
            :placeholder="t('image.model.quickSwitch.placeholder')"
            @update:value="handleModelSelect"
          />
          <NText v-if="fetchError" type="warning" depth="3" class="image-model-quick-switch__hint">
            {{ t('image.model.quickSwitch.fetchFailed', { error: fetchError }) }}
          </NText>
        </NSpace>
      </div>
    </NPopover>
  </div>
</template>

<script setup lang="ts">
import ModelIdSelector from './ModelIdSelector.vue'
import { computed, inject, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NPopover, NSpace, NTag, NText, type SelectOption as NaiveSelectOption } from 'naive-ui'
import type { IImageAdapterRegistry, ImageModel, ImageModelConfig } from '@prompt-optimizer/core'

import { useToast } from '../composables/ui/useToast'
import type { SelectOption } from '../types/select-options'
import type { AppServices } from '../types/services'

interface Props {
  modelKey: string
  options: SelectOption<ImageModelConfig>[]
  disabled?: boolean
  refreshModels?: () => Promise<void> | void
}

const props = withDefaults(defineProps<Props>(), {
  options: () => [],
  disabled: false,
  refreshModels: undefined,
})

const { t } = useI18n()
const toast = useToast()
const injectedServices = inject<Ref<AppServices | null>>('services', ref<AppServices | null>(null))

const popoverVisible = ref(false)
const loading = ref(false)
const modelOptions = ref<NaiveSelectOption[]>([])
const fetchError = ref('')

const selectedConfig = computed(() =>
  props.options.find((option) => option.value === props.modelKey)?.raw ?? null
)

const providerId = computed(() => selectedConfig.value?.providerId || selectedConfig.value?.provider?.id || '')
const selectedModelId = computed(() => selectedConfig.value?.modelId || selectedConfig.value?.model?.id || '')
const providerLabel = computed(() =>
  selectedConfig.value?.provider?.name || selectedConfig.value?.providerId || ''
)
const modelLabel = computed(() =>
  selectedConfig.value?.model?.name || selectedConfig.value?.modelId || ''
)
const fullModelTitle = computed(() =>
  providerLabel.value ? `${providerLabel.value} / ${modelLabel.value}` : modelLabel.value
)
const interactiveModelTitle = computed(() =>
  `${t('image.model.quickSwitch.modelTagTitle')} - ${fullModelTitle.value}`
)

const normalizeOptions = (models: ImageModel[]): NaiveSelectOption[] => {
  const seen = new Set<string>()
  const normalized: NaiveSelectOption[] = []

  for (const model of models) {
    if (!model.id || seen.has(model.id)) continue

    seen.add(model.id)
    normalized.push({
      value: model.id,
      label: model.name || model.id,
    })
  }

  return normalized
}

const getStaticOptions = (registry?: IImageAdapterRegistry): NaiveSelectOption[] => {
  if (!registry || !providerId.value) return []

  try {
    return normalizeOptions(registry.getStaticModels(providerId.value))
  } catch {
    return []
  }
}

const ensureCurrentOption = (options: NaiveSelectOption[]): NaiveSelectOption[] => {
  const currentId = selectedModelId.value
  if (!currentId || options.some((option) => option.value === currentId)) return options

  return [
    {
      value: currentId,
      label: modelLabel.value || currentId,
    },
    ...options,
  ]
}

const loadModelOptions = async () => {
  const config = selectedConfig.value
  const services = injectedServices.value
  if (!config || !services) {
    modelOptions.value = ensureCurrentOption([])
    return
  }

  const registry = services.imageAdapterRegistry
  const canFetchDynamic = !!(
    registry &&
    services.imageService &&
    providerId.value &&
    registry.supportsDynamicModels(providerId.value)
  )

  loading.value = true
  fetchError.value = ''

  try {
    const fetched = canFetchDynamic
      ? await services.imageService!.getDynamicModels(providerId.value, config.connectionConfig || {})
      : []
    const dynamicOptions = normalizeOptions(fetched)
    const staticOptions = getStaticOptions(registry)
    modelOptions.value = ensureCurrentOption(dynamicOptions.length ? dynamicOptions : staticOptions)
  } catch (error) {
    fetchError.value = error instanceof Error ? error.message : String(error)
    modelOptions.value = ensureCurrentOption(getStaticOptions(registry))
  } finally {
    loading.value = false
  }
}

const handlePopoverVisibility = (show: boolean) => {
  if (show) {
    void loadModelOptions()
  }
}

const buildFallbackModel = (modelId: string, label: string, current: ImageModelConfig): ImageModel => ({
  id: modelId,
  name: label || modelId,
  providerId: providerId.value || current.providerId,
  capabilities: {
    text2image: true,
    image2image: true,
  },
  parameterDefinitions: [],
})

const resolveModel = (modelId: string, current: ImageModelConfig): ImageModel => {
  const label = String(modelOptions.value.find((option) => option.value === modelId)?.label || modelId)
  const registry = injectedServices.value?.imageAdapterRegistry
  const currentProviderId = providerId.value || current.providerId

  if (!registry || !currentProviderId) {
    return buildFallbackModel(modelId, label, current)
  }

  try {
    const adapter = registry.getAdapter(currentProviderId)
    const staticModel = adapter.getModels().find((model) => model.id === modelId)
    const model = staticModel || adapter.buildDefaultModel(modelId)
    return {
      ...model,
      name: label || model.name,
    }
  } catch {
    return buildFallbackModel(modelId, label, current)
  }
}

const handleModelSelect = async (value: string | number | Array<string | number> | null) => {
  const modelId = Array.isArray(value) ? String(value[0] || '') : String(value || '')
  const current = selectedConfig.value
  const services = injectedServices.value
  if (!modelId || !current || !services?.imageModelManager || modelId === selectedModelId.value) return

  try {
    const model = resolveModel(modelId, current)
    await services.imageModelManager.updateConfig(current.id, {
      modelId: model.id,
      model,
    })
    await props.refreshModels?.()
    popoverVisible.value = false
    toast.success(t('image.model.quickSwitch.updateSuccess', { model: model.name || model.id }))
  } catch (error) {
    toast.error(t('image.model.quickSwitch.updateFailed', {
      error: error instanceof Error ? error.message : String(error),
    }))
  }
}

watch(
  () => [props.modelKey, selectedModelId.value, providerId.value],
  () => {
    modelOptions.value = []
    fetchError.value = ''
  }
)
</script>

<style scoped>
.image-model-quick-switch {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
}

.image-model-quick-switch__model {
  max-width: min(180px, 100%);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--n-tag-color, var(--n-color-embedded));
  color: var(--n-text-color-2);
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease,
    color 0.15s ease;
}

.image-model-quick-switch__model :deep(.n-tag__content) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-model-quick-switch__model--clickable {
  cursor: pointer;
}

.image-model-quick-switch__model--clickable:hover,
.image-model-quick-switch__model--clickable:focus-visible {
  background: var(--n-hover-color);
  color: var(--n-text-color);
  box-shadow: inset 0 0 0 1px var(--n-border-color);
}

.image-model-quick-switch__popover {
  width: 260px;
}

.image-model-quick-switch__title {
  font-size: 12px;
  font-weight: 500;
}

.image-model-quick-switch__hint {
  font-size: 12px;
  line-height: 1.35;
}
</style>
