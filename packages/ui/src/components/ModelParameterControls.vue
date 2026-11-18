<template>
  <span v-if="presentation === 'summary'" class="model-parameter-summary" :title="summary">{{ summary }}</span>
  <div v-else class="local-model-parameters" role="group" :aria-label="t('localParameters.title')" :style="{ '--parameter-label': theme.textColor2 }">
    <div v-if="hasReasoningControl" class="local-model-parameters__quick">
      <span>{{ t(effortDefinition ? 'localParameters.reasoning' : 'localParameters.thinking') }}</span>
      <NSelect :value="reasoningSelection" :options="reasoningChoices" :disabled="disabled" size="small" :to="false"
        :aria-label="t('localParameters.thinking')" data-testid="local-reasoning-select" @update:value="selectReasoning" />
    </div>
    <div v-for="definition in quickDefinitions" :key="definition.name" class="local-model-parameters__quick">
      <span>{{ label(definition) }}</span>
      <NSelect v-if="definition.allowedValues?.length || definition.type === 'boolean'"
        :value="displayValue(definition)" :options="choices(definition)" :disabled="disabled" size="small" :to="false"
        :aria-label="label(definition)" :data-testid="'local-param-' + definition.name" @update:value="value => updateChoice(definition, value)" />
      <NInputNumber v-else-if="definition.type === 'number' || definition.type === 'integer'" :value="numericValue(definition)" :disabled="disabled" size="small" clearable
        :placeholder="inheritLabel(definition)" :min="definition.minValue ?? definition.min" :max="definition.maxValue ?? definition.max"
        :step="definition.step ?? (definition.type === 'integer' ? 1 : 0.1)" :aria-label="label(definition)" :data-testid="'local-param-' + definition.name"
        @update:value="value => update(definition, value)" />
      <NInput v-else :value="textValue(definition)" :disabled="disabled" size="small" clearable
        :placeholder="inheritLabel(definition)" :aria-label="label(definition)" :data-testid="'local-param-' + definition.name"
        @update:value="value => update(definition, value)" />
    </div>
    <div class="local-model-parameters__actions">
      <NButton size="small" quaternary :disabled="disabled" :aria-expanded="advancedOpen" data-testid="local-parameters-more" @click="advancedOpen = !advancedOpen">{{ t('localParameters.moreOptions') }}</NButton>
      <NButton v-if="overrideCount" size="small" quaternary :disabled="disabled" data-testid="local-parameters-reset" @click="emit('update:modelValue', {})">{{ t('localParameters.reset') }}</NButton>
    </div>
    <ModelAdvancedSection v-if="advancedOpen" :key="modelKey" embedded :mode="mode" :provider-type="providerId"
      :parameter-definitions="advancedDefinitions" :inherited="advancedInherited" :param-overrides="visibleOverrides" @update:param-overrides="updateAdvanced" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NInput, NInputNumber, NSelect, useThemeVars } from 'naive-ui'
import type { UnifiedParameterDefinition } from '@prompt-optimizer/core'
import ModelAdvancedSection from './ModelAdvancedSection.vue'

const props = withDefaults(defineProps<{
  mode: 'text' | 'image'
  modelKey: string
  providerId: string
  definitions: readonly UnifiedParameterDefinition[]
  inherited?: Record<string, unknown>
  modelValue?: Record<string, unknown>
  presentation?: 'editor' | 'summary'
  disabled?: boolean
}>(), { inherited: () => ({}), modelValue: () => ({}), presentation: 'editor', disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>()
const { t } = useI18n()
const theme = useThemeVars()
const advancedOpen = ref(false)
const INHERIT = '__inherit__'
const VALUE = '__value__:'
const OFF = '__off__'
const ON = '__on__'
const overrideCount = computed(() => Object.keys(props.modelValue).length)
const effective = computed(() => ({ ...props.inherited, ...props.modelValue }))
const effortDefinition = computed(() => ['reasoning_effort', 'thinkingLevel', 'effort'].flatMap(name =>
  props.definitions.filter(definition => definition.name === name && definition.allowedValues?.length))[0])
const toggleDefinition = computed(() => props.definitions.find(definition => definition.name === 'enable_thinking' && definition.type === 'boolean'
  || definition.name === 'thinking_type' && definition.allowedValues?.includes('enabled') && definition.allowedValues.includes('disabled')))
const budgetDefinition = computed(() => ['thinking_budget_tokens', 'thinkingBudget', 'thinking_budget'].flatMap(name =>
  props.definitions.filter(definition => definition.name === name && ['number', 'integer'].includes(definition.type)))[0])
const hasReasoningControl = computed(() => props.mode === 'text' && !!(effortDefinition.value || toggleDefinition.value))
const reasoningNames = computed(() => new Set(hasReasoningControl.value
  ? [effortDefinition.value?.name, toggleDefinition.value?.name].filter((name): name is string => !!name) : []))
const thinkingDisabled = computed(() => {
  const definition = toggleDefinition.value
  return definition && (effective.value[definition.name] === false || effective.value[definition.name] === 'disabled')
})
const visible = (definition: UnifiedParameterDefinition) => {
  if (['frame_count', 'frame_duration_ms'].includes(definition.name)) return effective.value.output_format === 'gif'
  if (definition.name === 'reasoning_effort' && ('thinking_type' in effective.value || 'enable_thinking' in effective.value)) {
    return effective.value.thinking_type !== 'disabled' && effective.value.enable_thinking !== false
  }
  return true
}
// The schema remains the source of parameter names, choices, and value types.
// Reasoning is a shortcut; other configured parameters use the same entry point.
const primaryDefinition = computed(() => {
  if (props.mode !== 'text' || hasReasoningControl.value) return undefined
  const definitions = props.definitions.filter(definition => visible(definition) && !definition.tags?.includes('string-array'))
  return budgetDefinition.value || definitions.find(definition => effective.value[definition.name] !== undefined) || definitions[0]
})
const quickDefinitions = computed(() => {
  if (hasReasoningControl.value) return []
  if (props.mode === 'text') return primaryDefinition.value ? [primaryDefinition.value] : []
  const preferred = ['output_format', 'size', 'aspectRatio', 'imageSize'].flatMap(name => props.definitions.filter(definition => definition.name === name))
  const configured = props.definitions.filter(definition => effective.value[definition.name] !== undefined)
  return [...new Set([...preferred, ...configured, ...props.definitions])]
    .filter(definition => visible(definition) && !definition.tags?.includes('string-array')).slice(0, 2)
})
const quickNames = computed(() => new Set(quickDefinitions.value.map(definition => definition.name)))
const visibleAdvanced = (definition: UnifiedParameterDefinition) => !['frame_count', 'frame_duration_ms'].includes(definition.name) || effective.value.output_format === 'gif'
const advancedDefinitions = computed(() => props.definitions.filter(definition => visibleAdvanced(definition) && !quickNames.value.has(definition.name)).map(definition => ({ ...definition,
  ...(props.inherited[definition.name] !== undefined ? { defaultValue: props.inherited[definition.name] } : {}) })))
const advancedInherited = computed(() => Object.fromEntries(Object.entries(props.inherited).filter(([name]) => {
  const definition = props.definitions.find(item => item.name === name)
  return !quickNames.value.has(name) && (!definition || visibleAdvanced(definition))
})))
const visibleOverrides = computed(() => Object.fromEntries(Object.entries(props.modelValue).filter(([name]) => {
  const definition = props.definitions.find(item => item.name === name)
  return !quickNames.value.has(name) && (!definition || visibleAdvanced(definition))
})))
const label = (definition: UnifiedParameterDefinition) => definition.labelKey ? t(definition.labelKey) : definition.name
function valueLabel(definition: UnifiedParameterDefinition, value: unknown) {
  if (value === undefined) return t('localParameters.automatic')
  const index = definition.allowedValues?.indexOf(String(value)) ?? -1
  const key = definition.allowedValueLabelKeys?.[index]
  if (key) return t(key)
  if (typeof value === 'boolean') return t(value ? 'common.enabled' : 'common.disabled')
  if (value === 'auto') return t('localParameters.automatic')
  if (['reasoning_effort', 'thinkingLevel', 'effort'].includes(definition.name) && ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(String(value))) return t('localParameters.effort.' + value)
  return String(value)
}
const summary = computed(() => {
  if (hasReasoningControl.value) return t('localParameters.thinking') + ' · ' + reasoningSummary.value
  if (props.mode === 'text') {
    const definition = primaryDefinition.value
    if (!definition) return t('localParameters.more')
    const value = valueLabel(definition, effective.value[definition.name])
    return `${label(definition)} · ${value}`
  }
  return quickDefinitions.value.flatMap(definition => {
    const value = effective.value[definition.name]
    if (value === undefined || value === 'auto') return []
    return [definition.name === 'output_format' ? String(value).toUpperCase() : valueLabel(definition, value)]
  }).join(' · ') || t('localParameters.more')
})
function reasoningLabel(values: Record<string, unknown>) {
  const toggle = toggleDefinition.value
  if (toggle && [false, 'disabled'].includes(values[toggle.name] as boolean | string)) return t('localParameters.effort.none')
  const effort = effortDefinition.value
  if (effort && values[effort.name] !== undefined) return valueLabel(effort, values[effort.name])
  if (!effort && toggle && [true, 'enabled'].includes(values[toggle.name] as boolean | string)) return t('common.enabled')
  return t('localParameters.default')
}
const reasoningSummary = computed(() => reasoningLabel(effective.value))
const defaultReasoningLabel = computed(() => {
  const value = reasoningLabel(props.inherited)
  return value === t('localParameters.default') ? value : t('localParameters.defaultWithValue', { value })
})
const reasoningSelection = computed(() => {
  if (![...reasoningNames.value].some(name => props.modelValue[name] !== undefined)) return INHERIT
  if (thinkingDisabled.value) return OFF
  const effort = effortDefinition.value
  return effort ? String(effective.value[effort.name] ?? INHERIT) : ON
})
const reasoningChoices = computed(() => {
  const options = [{ value: INHERIT, label: defaultReasoningLabel.value }]
  if (toggleDefinition.value) options.push({ value: OFF, label: t('localParameters.effort.none') })
  const effort = effortDefinition.value
  if (effort) options.push(...effort.allowedValues!.filter(value => !toggleDefinition.value || value !== 'none').map(value => ({ value, label: valueLabel(effort, value) })))
  else if (toggleDefinition.value) options.push({ value: ON, label: t('common.enabled') })
  return options
})
function selectReasoning(value: string) {
  if (props.disabled || !reasoningChoices.value.some(option => option.value === value)) return
  const next = { ...props.modelValue }
  if (value === INHERIT) {
    for (const name of reasoningNames.value) delete next[name]
  } else {
    const toggle = toggleDefinition.value
    if (toggle) next[toggle.name] = toggle.type === 'boolean' ? value !== OFF : value === OFF ? 'disabled' : 'enabled'
    if (value !== OFF && value !== ON && effortDefinition.value) next[effortDefinition.value.name] = value
  }
  emit('update:modelValue', next)
}
const inheritLabel = (definition: UnifiedParameterDefinition) => t('localParameters.inherit', { value: valueLabel(definition, props.inherited[definition.name]) })
const choices = (definition: UnifiedParameterDefinition) => [{ value: INHERIT, label: inheritLabel(definition) },
  ...(definition.type === 'boolean' ? [{ value: VALUE + 'true', label: valueLabel(definition, true) }, { value: VALUE + 'false', label: valueLabel(definition, false) }]
    : (definition.allowedValues || []).map(value => ({ value: VALUE + value, label: valueLabel(definition, value) })))]
const displayValue = (definition: UnifiedParameterDefinition) => props.modelValue[definition.name] === undefined ? INHERIT : VALUE + String(props.modelValue[definition.name])
const numericValue = (definition: UnifiedParameterDefinition) => typeof effective.value[definition.name] === 'number' ? effective.value[definition.name] as number : null
const textValue = (definition: UnifiedParameterDefinition) => typeof effective.value[definition.name] === 'string' ? effective.value[definition.name] as string : ''
function updateChoice(definition: UnifiedParameterDefinition, value: string) {
  if (!choices(definition).some(option => option.value === value)) return
  update(definition, value === INHERIT ? null : value.slice(VALUE.length))
}
function update(definition: UnifiedParameterDefinition, value: string | number | null) {
  if (props.disabled) return
  const next = { ...props.modelValue }
  if (value === null || (value === '' && !definition.sendEmptyString)) delete next[definition.name]
  else if (definition.type === 'boolean') next[definition.name] = value === 'true'
  else if (definition.type === 'number' || definition.type === 'integer') {
    const number = Number(value)
    if (!Number.isFinite(number)) return
    next[definition.name] = number
  } else next[definition.name] = value
  emit('update:modelValue', next)
}
function updateAdvanced(value: Record<string, unknown>) {
  if (props.disabled) return
  const hidden = Object.fromEntries(Object.entries(props.modelValue).filter(([name]) => !(name in visibleOverrides.value)))
  emit('update:modelValue', { ...hidden, ...value })
}
watch(() => props.modelKey, () => { advancedOpen.value = false })
</script>

<style scoped>
.model-parameter-summary { white-space: nowrap; }
.local-model-parameters { min-width: 0; }
.local-model-parameters__quick { display: grid; grid-template-columns: 88px minmax(0, 1fr); align-items: center; gap: 12px; margin-bottom: 8px; font-size: 13px; }
.local-model-parameters__quick > span { color: var(--parameter-label); }
.local-model-parameters__quick :deep(.n-select), .local-model-parameters__quick :deep(.n-input-number) { min-width: 0; width: 100%; }
.local-model-parameters__actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.local-model-parameters :deep(.model-advanced-section) { max-height: 200px; overflow-y: auto; margin-top: 8px; }
</style>
