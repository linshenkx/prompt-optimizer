<template>
  <ModelSelector v-bind="$attrs" :model-value="modelValue ? normalizedValue : ''" :groups="groups"
    :selected-config="selected?.primary" :selected-label="selected ? compactName(selected.primary, selectedModelName).split('/').at(-1) : ''"
    :size="size" :disabled="disabled" :placeholder="placeholder" :aria-label="ariaLabel"
    :scope-text="t('model.selector.' + (scope === 'function' ? 'functionScope' : scope === 'column' ? 'columnScope' : 'workspaceScope'))"
    :clearable="clearable" :clear-label="clearLabel" show-config-action
    @update:model-value="choose" @update:show="onShow" @focus="emit('focus')" @config="configure" @retry="retry" />
</template>
<script setup lang="ts">
import { computed, inject, ref, unref, watch, type MaybeRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ModelSelector from './ModelSelector.vue'
import { decodeTextModelSelection, encodeTextModelSelection } from '@prompt-optimizer/core'
import type { AppServices } from '../types/services'
import type { ModelSelectOption } from '../types/select-options'
import { findTextModelSelection, getTextModelSelectionConfigId } from '../utils/text-model-selection'
import { getTextModelCatalog, loadTextModelCatalog, mergeModelOptions, rankModelOptions, rememberTextModel } from '../composables/model/textModelCatalog'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  modelValue?: string
  options: MaybeRef<ModelSelectOption[]>
  disabled?: boolean
  size?: 'small' | 'medium' | 'large'
  placeholder?: string
  ariaLabel?: string
  scope?: 'workspace' | 'column' | 'function'
  clearable?: boolean
  clearLabel?: string
}>(), { modelValue: '', disabled: false, size: 'medium', scope: 'workspace' })
const emit = defineEmits<{ 'update:modelValue': [value: string]; 'update:show': [value: boolean]; focus: []; config: [] }>()
const { t } = useI18n()
const services = inject<Ref<AppServices | null>>('services', ref(null))
const openModelManager = inject<((tab: 'text', configId: string) => void | Promise<void>) | null>('openModelManager', null)
const open = ref(false)
const options = computed(() => unref(props.options) || [])
const catalog = computed(() => services.value ? getTextModelCatalog(services.value) : undefined)
const selected = computed(() => findTextModelSelection(options.value, props.modelValue))
const configId = computed(() => getTextModelSelectionConfigId(props.modelValue))
const modelId = computed(() => decodeTextModelSelection(props.modelValue)?.modelId || selected.value?.raw.modelMeta.id || '')
const selectedModelName = computed(() => {
  const known = catalog.value?.entries[configId.value]?.models.find(model => model.value === modelId.value)?.label
  if (known) return known
  const config = selected.value?.raw
  if (!config) return ''
  try {
    const name = services.value?.textAdapterRegistry?.getStaticModels(config.providerMeta.id).find(model => model.id === modelId.value)?.name
    if (name) return name
  } catch { /* Custom/removed providers retain their saved display name. */ }
  return config.modelMeta.name || modelId.value
})
const compactName = (name: string, model: string) => model.toLocaleLowerCase().startsWith(name.toLocaleLowerCase() + ' ')
  ? model.slice(name.length).trim() : model
const orderedOptions = computed(() => [
  ...options.value.filter(option => option.value === configId.value),
  ...options.value.filter(option => option.value !== configId.value),
])
const selectionKey = (id: string, model: string) => options.value.find(option => option.value === id)?.raw.modelMeta.id === model ? id : encodeTextModelSelection(id, model)
const normalizedValue = computed(() => selected.value ? selectionKey(configId.value, modelId.value) : props.modelValue)
const groups = computed(() => orderedOptions.value.map(option => {
  const entry = catalog.value?.entries[option.value]
  const current = option.value === configId.value ? modelId.value : option.raw.modelMeta.id
  const all = mergeModelOptions(entry?.models || [], [{ value: option.raw.modelMeta.id, label: option.raw.modelMeta.name }], current ? [{ value: current, label: current }] : [])
  return {
    value: option.value, label: option.primary, searchText: option.secondary, configurable: true,
    loading: entry?.loading, failed: entry?.failed,
    choices: rankModelOptions(all, current, catalog.value?.recent[option.value] || []).map(model => ({
      value: selectionKey(option.value, model.value), label: compactName(option.primary, model.label), searchText: model.value,
    })),
  }
}))

async function refresh(force = false) {
  const currentServices = services.value
  if (!currentServices) return
  // Bound concurrent discovery, and share in-flight work between selectors.
  const queue = [...orderedOptions.value]
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length) {
      const option = queue.shift()
      if (option) await loadTextModelCatalog(currentServices, option.raw, force)
    }
  }))
}
function onShow(show: boolean) {
  open.value = show
  emit('update:show', show)
  if (show) void refresh()
}
function choose(value: string) {
  emit('update:modelValue', value)
  if (!value || !services.value) return
  const decoded = decodeTextModelSelection(value)
  const id = decoded?.configId || value
  const model = decoded?.modelId || options.value.find(option => option.value === id)?.raw.modelMeta.id
  if (model) void rememberTextModel(services.value, id, model)
}
async function configure(id?: string) {
  if (id && openModelManager) await openModelManager('text', id)
  else emit('config')
}
function retry(id: string) {
  const config = options.value.find(option => option.value === id)?.raw
  if (services.value && config) void loadTextModelCatalog(services.value, config, true)
}
watch(options, () => { if (open.value) void refresh() })
defineExpose({ refresh })
</script>
