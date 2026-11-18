<template>
  <div class="model-selection">
  <ModelSelector class="model-selection__picker" v-bind="$attrs" :model-value="selectedValue" :groups="groups"
    :selected-config="selected?.primary" :selected-label="parameterConfig?.model.name || selectedModelId"
    :placeholder="placeholder" :disabled="disabled" :size="size" :aria-label="ariaLabel"
    :show-config-action="showConfigAction"
    @update:model-value="choose" @focus="emit('focus')"
    @update:show="emit('update:show', $event)" @config="configure">
    <template v-if="parameters && parameterConfig" #selection-detail>
      <ModelParameterControls presentation="summary" mode="image" :model-key="selectedValue" :provider-id="parameterConfig.providerId"
        :definitions="parameterConfig.model.parameterDefinitions" :inherited="inheritedParameters" :model-value="localParameters" />
    </template>
    <template v-if="parameters && parameterConfig" #parameters>
      <ModelParameterControls mode="image" :model-key="selectedValue" :provider-id="parameterConfig.providerId"
        :definitions="parameterConfig.model.parameterDefinitions" :inherited="inheritedParameters" :model-value="localParameters"
        :disabled="disabled" @update:model-value="updateParameters" />
    </template>
  </ModelSelector>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, unref, type MaybeRef, type Ref } from 'vue'
import { decodeImageModelSelection, encodeImageModelSelection, getImageModelSelectionConfigId, resolveRuntimeImageModel, type ImageModelConfig } from '@prompt-optimizer/core'
import type { SelectOption } from '../types/select-options'
import type { AppServices } from '../types/services'
import ModelSelector from './ModelSelector.vue'
import ModelParameterControls from './ModelParameterControls.vue'
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  modelValue?: string
  options: MaybeRef<SelectOption<ImageModelConfig>[]>
  disabled?: boolean
  size?: 'small' | 'medium' | 'large'
  placeholder?: string
  ariaLabel?: string
  showConfigAction?: boolean
  parameters?: boolean
}>(), { modelValue: '', showConfigAction: true })
const emit = defineEmits<{ 'update:modelValue': [value: string]; 'update:show': [value: boolean]; focus: []; config: [] }>()
const openModelManager = inject<((tab: 'image', configId?: string) => void | Promise<void>) | null>('openModelManager', null)
const options = computed(() => unref(props.options))
const services = inject<Ref<AppServices | null>>('services', ref(null))
const selected = computed(() => options.value.find(option => option.value === getImageModelSelectionConfigId(props.modelValue)))
const selectedModelId = computed(() => decodeImageModelSelection(props.modelValue)?.modelId || selected.value?.raw.modelId || '')
const selectionKey = (config: ImageModelConfig, modelId: string) => modelId === config.modelId ? config.id : encodeImageModelSelection(config.id, modelId)
const selectedValue = computed(() => selected.value ? selectionKey(selected.value.raw, selectedModelId.value) : props.modelValue)
const parameterConfig = computed(() => {
  const base = selected.value?.raw
  if (!base) return undefined
  const registry = services.value?.imageAdapterRegistry
  if (registry) {
    try { return resolveRuntimeImageModel(base, { modelId: selectedModelId.value }, registry) }
    catch { /* Keep the pinned model ID visible when its provider is unavailable. */ }
  }
  return selectedModelId.value === base.modelId ? base : undefined
})
const localParameters = computed(() => decodeImageModelSelection(props.modelValue)?.paramOverrides || {})
const inheritedParameters = computed(() => ({ ...parameterConfig.value?.model.defaultParameterValues,
  ...parameterConfig.value?.customParamOverrides, ...parameterConfig.value?.paramOverrides }))
const parameterCache = new Map<string, Record<string, unknown>>()
function updateParameters(value: Record<string, unknown>) {
  const option = selected.value
  if (!option) return
  parameterCache.set(encodeImageModelSelection(option.value, selectedModelId.value), value)
  emit('update:modelValue', Object.keys(value).length ? encodeImageModelSelection(option.value, selectedModelId.value, value) : selectedValue.value)
}
function choose(value: string) {
  if (selected.value) parameterCache.set(encodeImageModelSelection(selected.value.value, selectedModelId.value), localParameters.value)
  const selection = decodeImageModelSelection(value)
  const option = options.value.find(item => item.value === (selection?.configId ?? value))
  const modelId = selection?.modelId || option?.raw.modelId || ''
  const cached = option && parameterCache.get(encodeImageModelSelection(option.value, modelId))
  emit('update:modelValue', option && cached && Object.keys(cached).length ? encodeImageModelSelection(option.value, modelId, cached) : value)
}
// Image generation still selects saved configurations. Capability filtering
// stays with the workspace; selecting a row never edits a shared config.
const groups = computed(() => [
  ...options.value.filter(option => option.value === selected.value?.value),
  ...options.value.filter(option => option.value !== selected.value?.value),
].map(option => ({
  value: option.value, label: option.primary, searchText: option.secondary,
  configurable: props.showConfigAction,
  choices: [
    ...(option.value === selected.value?.value && selectedModelId.value !== option.raw.modelId
      ? [{ value: selectedValue.value, label: parameterConfig.value?.model.name || selectedModelId.value, searchText: selectedModelId.value }] : []),
    { value: option.value, label: option.raw.model?.name || option.raw.modelId, searchText: option.raw.modelId },
  ],
})))
async function configure(id?: string) {
  if (id && openModelManager) await openModelManager('image', id)
  else emit('config')
}
</script>
<style scoped>
.model-selection { display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0; }
.model-selection :deep(.model-selection__picker) { flex: 1; min-width: 0; width: 0; }
</style>
