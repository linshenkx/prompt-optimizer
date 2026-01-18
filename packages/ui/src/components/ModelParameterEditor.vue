<template>
  <div class="model-parameter-editor">
    <template v-if="mode === 'text'">
      <NAlert
        v-if="definedEntries.length === 0 && customEntries.length === 0"
        type="info"
        size="small"
        :bordered="false"
      >
        {{ t('modelManager.advancedParameters.noParamsConfigured') }}
      </NAlert>

      <NForm
        v-else
        label-placement="left"
        label-width="auto"
        label-align="right"
        size="small"
        :show-label="true"
        :show-feedback="true"
        class="advanced-form"
      >
        <!-- 已定义的参数（schema中存在） -->
        <NFormItem
          v-for="entry in definedEntries"
          :key="`defined-${entry.key}`"
          class="advanced-form-item"
        >
          <template #label>
            <NSpace align="center" :size="8" style="width: 100%;">
              <span>{{ entry.label }}</span>
              <NButton size="tiny" type="error" quaternary circle @click="handleRemove(entry.key)">
                ×
              </NButton>
            </NSpace>
          </template>

          <template v-if="entry.definition.type === 'boolean'">
            <NCheckbox
              :checked="getDisplayValue(entry.definition, paramOverrides[entry.key]) as boolean"
              size="small"
              @update:checked="value => handleValueChange(entry.definition, value)"
            >
              {{ getDisplayValue(entry.definition, paramOverrides[entry.key]) ? t('common.enabled') : t('common.disabled') }}
            </NCheckbox>
          </template>
          <template v-else-if="entry.definition.allowedValues && entry.definition.allowedValues.length">
            <NSelect
              :value="getDisplayValue(entry.definition, paramOverrides[entry.key]) as string | null"
              :options="getSelectOptions(entry.definition)"
              size="small"
              clearable
              class="advanced-control"
              @update:value="value => handleValueChange(entry.definition, value)"
            />
          </template>
          <template v-else-if="entry.definition.tags?.includes('string-array')">
            <NInput
              type="textarea"
              size="small"
              :autosize="{ minRows: 2, maxRows: 4 }"
              :placeholder="t('modelManager.advancedParameters.stopSequencesPlaceholder')"
              :value="getDisplayValue(entry.definition, paramOverrides[entry.key]) as string"
              class="advanced-control"
              @update:value="value => handleValueChange(entry.definition, value)"
            />
          </template>
          <template v-else-if="entry.definition.type === 'number' || entry.definition.type === 'integer'">
            <NInputNumber
              size="small"
              :value="getDisplayValue(entry.definition, paramOverrides[entry.key]) as number | undefined"
              :min="entry.definition.minValue ?? entry.definition.min"
              :max="entry.definition.maxValue ?? entry.definition.max"
              :step="entry.definition.step ?? (entry.definition.type === 'integer' ? 1 : 0.1)"
              :precision="entry.definition.type === 'integer' ? 0 : undefined"
              class="advanced-control"
              @update:value="value => handleValueChange(entry.definition, value)"
            />
          </template>
          <template v-else>
            <NInput
              size="small"
              :value="getDisplayValue(entry.definition, paramOverrides[entry.key]) as string"
              :placeholder="entry.definition.defaultValue !== undefined ? String(entry.definition.defaultValue) : ''"
              class="advanced-control"
              @update:value="value => handleValueChange(entry.definition, value)"
            />
          </template>

          <template #feedback>
            <NSpace vertical :size="4">
              <NText v-if="entry.description" depth="3" style="font-size: 12px;">
                {{ entry.description }}
              </NText>
              <NText v-if="entry.unitLabel" depth="3" style="font-size: 12px;">
                {{ entry.unitLabel }}
              </NText>
              <NText v-if="entry.helpText" depth="3" style="font-size: 12px;">
                {{ entry.helpText }}
              </NText>
            </NSpace>
          </template>
        </NFormItem>

        <!-- 自定义参数（schema中不存在） -->
        <NFormItem
          v-for="entry in customEntries"
          :key="`custom-${entry.key}`"
          class="advanced-form-item"
        >
          <template #label>
            <NSpace align="center" :size="8" style="width: 100%;">
              <span>{{ entry.key }}</span>
              <NTag type="info" size="small">
                {{ t('modelManager.advancedParameters.customParam') }}
              </NTag>
              <NButton size="tiny" type="error" quaternary circle @click="handleRemove(entry.key)">
                ×
              </NButton>
            </NSpace>
          </template>
          <NInput
            type="textarea"
            size="small"
            :autosize="{ minRows: 1, maxRows: 3 }"
            :value="String(paramOverrides[entry.key] ?? '')"
            data-test="custom-param-input"
            class="advanced-control"
            @update:value="value => handleCustomValueChange(entry.key, value)"
          />
        </NFormItem>
      </NForm>
    </template>

    <template v-else>
      <NAlert v-if="definedEntries.length === 0 && customEntries.length === 0" type="info" size="small">
        {{ t('image.parameters.noParameters') }}
      </NAlert>
      <NForm
        v-else
        label-placement="left"
        label-width="auto"
        label-align="right"
        size="small"
        :show-label="true"
        :show-feedback="true"
        class="advanced-form"
      >
        <!-- 已定义的参数 -->
        <NFormItem
          v-for="entry in definedEntries"
          :key="`defined-${entry.key}`"
          class="advanced-form-item"
        >
          <template #label>
            <NSpace align="center" :size="8" style="width: 100%;">
              <span>{{ entry.label }}</span>
              <NButton size="tiny" type="error" quaternary circle @click="handleRemove(entry.key)">
                ×
              </NButton>
            </NSpace>
          </template>

          <template v-if="entry.definition.type === 'boolean'">
            <NCheckbox
              :checked="getDisplayValue(entry.definition, paramOverrides[entry.key]) as boolean"
              size="small"
              @update:checked="value => handleValueChange(entry.definition, value)"
            >
              {{ getDisplayValue(entry.definition, paramOverrides[entry.key]) ? t('common.enabled') : t('common.disabled') }}
            </NCheckbox>
          </template>
          <template v-else-if="entry.definition.allowedValues && entry.definition.allowedValues.length">
            <NSelect
              :value="getDisplayValue(entry.definition, paramOverrides[entry.key]) as string | null"
              :options="getSelectOptions(entry.definition)"
              size="small"
              clearable
              @update:value="value => handleValueChange(entry.definition, value)"
            />
          </template>
          <template v-else-if="entry.definition.tags?.includes('string-array')">
            <NInput
              type="textarea"
              size="small"
              :autosize="{ minRows: 2, maxRows: 6 }"
              :placeholder="t('modelManager.advancedParameters.stopSequencesPlaceholder')"
              :value="getDisplayValue(entry.definition, paramOverrides[entry.key]) as string"
              @update:value="value => handleValueChange(entry.definition, value)"
            />
          </template>
          <template v-else-if="entry.definition.type === 'number' || entry.definition.type === 'integer'">
            <NInputNumber
              size="small"
              :value="getDisplayValue(entry.definition, paramOverrides[entry.key]) as number | undefined"
              :min="entry.definition.minValue ?? entry.definition.min"
              :max="entry.definition.maxValue ?? entry.definition.max"
              :step="entry.definition.step ?? (entry.definition.type === 'integer' ? 1 : 0.1)"
              :precision="entry.definition.type === 'integer' ? 0 : undefined"
              @update:value="value => handleValueChange(entry.definition, value)"
            />
          </template>
          <template v-else>
            <NInput
              size="small"
              :value="getDisplayValue(entry.definition, paramOverrides[entry.key]) as string"
              :placeholder="entry.definition.defaultValue !== undefined ? String(entry.definition.defaultValue) : ''"
              @update:value="value => handleValueChange(entry.definition, value)"
            />
          </template>

          <template #feedback>
            <NSpace vertical :size="4">
              <NText v-if="entry.description" depth="3" style="font-size: 12px;">
                {{ entry.description }}
              </NText>
              <NText v-if="entry.unitLabel" depth="3" style="font-size: 12px;">
                {{ entry.unitLabel }}
              </NText>
              <NText v-if="entry.helpText" depth="3" style="font-size: 12px;">
                {{ entry.helpText }}
              </NText>
            </NSpace>
          </template>
        </NFormItem>

        <!-- 自定义参数（schema中不存在） -->
        <NFormItem
          v-for="entry in customEntries"
          :key="`custom-${entry.key}`"
          class="advanced-form-item"
        >
          <template #label>
            <NSpace align="center" :size="8" style="width: 100%;">
              <span>{{ entry.key }}</span>
              <NTag type="info" size="small">
                {{ t('modelManager.advancedParameters.customParam') }}
              </NTag>
              <NButton size="tiny" type="error" quaternary circle @click="handleRemove(entry.key)">
                ×
              </NButton>
            </NSpace>
          </template>
          <NInput
            size="small"
            :value="String(paramOverrides[entry.key] ?? '')"
            data-test="custom-param-input"
            class="advanced-control"
            @update:value="value => handleCustomValueChange(entry.key, value)"
          />
        </NFormItem>
      </NForm>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'

import { useI18n } from 'vue-i18n'
import { useMessage, createDiscreteApi, NAlert, NButton, NCheckbox, NForm, NFormItem, NInput, NInputNumber, NSelect, NSpace, NTag, NText } from 'naive-ui'
import { parseCustomValue, type UnifiedParameterDefinition } from '@prompt-optimizer/core'

const props = defineProps({
  schema: {
    type: Array as PropType<readonly UnifiedParameterDefinition[]>,
    default: () => []
  },
  paramOverrides: {
    type: Object as PropType<Record<string, unknown>>,
    default: () => ({})
  },
  mode: {
    type: String as PropType<'text' | 'image'>,
    default: 'text'
  },
  allowCustom: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits<{
  (e: 'update:paramOverrides', value: Record<string, unknown>): void
}>()

const { t } = useI18n()
const message = resolveMessageApi()

const schemaMap = computed(() => {
  const map = new Map<string, UnifiedParameterDefinition>()
  for (const def of props.schema) {
    map.set(def.name, def)
  }
  return map
})

// 区分已定义参数和自定义参数
const definedEntries = computed(() => {
  const entries: Array<{
    key: string
    definition: UnifiedParameterDefinition
    label: string
    description?: string
    unitLabel?: string
    helpText?: string
  }> = []

  for (const def of props.schema) {
    if (Object.prototype.hasOwnProperty.call(props.paramOverrides, def.name)) {
      entries.push({
        key: def.name,
        definition: def,
        label: translateLabel(def),
        description: translateDescription(def),
        unitLabel: getUnitLabel(def),
        helpText: def.tags?.includes('string-array') ? t('modelManager.advancedParameters.stopSequencesPlaceholder') : undefined
      })
    }
  }

  return entries
})

const customEntries = computed(() => {
  const entries: Array<{ key: string }> = []

  for (const key of Object.keys(props.paramOverrides)) {
    // 不在 schema 中的就是自定义参数
    if (!schemaMap.value.has(key)) {
      entries.push({ key })
    }
  }

  return entries
})

const handleAddDefinition = (name: string) => {
  const definition = schemaMap.value.get(name)
  if (!definition) {
    message.error(withFallback('modelManager.advancedParameters.validation.unknownParam', '参数定义不存在'))
    return
  }

  if (Object.prototype.hasOwnProperty.call(props.paramOverrides, name)) {
    message.warning(withFallback('modelManager.advancedParameters.validation.duplicateParam', '参数已存在'))
    return
  }

  const next = {
    ...props.paramOverrides,
    [definition.name]: cloneDefaultValue(definition)
  }
  emit('update:paramOverrides', next)
}

const handleValueChange = (definition: UnifiedParameterDefinition, rawValue: unknown) => {
  const value = normalizeValue(definition, rawValue)
  const next = { ...props.paramOverrides }
  const shouldRemove =
    value === undefined ||
    (definition.type === 'string' && typeof value === 'string' && value.trim() === '') ||
    (definition.tags?.includes('string-array') && Array.isArray(value) && value.length === 0)

  if (shouldRemove) {
    delete next[definition.name]
  } else {
    next[definition.name] = value
  }
  emit('update:paramOverrides', next)
}

const handleRemove = (key: string) => {
  const next = { ...props.paramOverrides }
  delete next[key]
  emit('update:paramOverrides', next)
}

const handleCustomValueChange = (key: string, value: string) => {
  const trimmed = value.trim()
  const next = { ...props.paramOverrides }
  if (trimmed === '') {
    delete next[key]
  } else {
    next[key] = parseCustomValue(trimmed)
  }
  emit('update:paramOverrides', next)
}

defineExpose({
  handleAddDefinition,
  handleValueChange,
  handleCustomValueChange
})

function normalizeValue(definition: UnifiedParameterDefinition, rawValue: unknown): unknown {
  if (definition.tags?.includes('string-array')) {
    if (Array.isArray(rawValue)) {
      return rawValue
        .map((item) => (typeof item === 'string' ? item.trim() : item))
        .filter((item) => typeof item === 'string' && item.length > 0)
    }
    if (typeof rawValue === 'string') {
      return rawValue
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    }
    return []
  }

  if (definition.type === 'boolean') {
    return Boolean(rawValue)
  }

  if (definition.type === 'number' || definition.type === 'integer') {
    if (rawValue === '' || rawValue === null || rawValue === undefined) return undefined
    const num = typeof rawValue === 'number' ? rawValue : Number(rawValue)
    return Number.isFinite(num) ? num : undefined
  }

  if (rawValue === null || rawValue === undefined) return ''
  return String(rawValue).trim()
}

function getDisplayValue(definition: UnifiedParameterDefinition, rawValue: unknown): unknown {
  if (definition.tags?.includes('string-array')) {
    if (Array.isArray(rawValue)) return rawValue.join('\n')
    if (typeof rawValue === 'string') return rawValue
    return ''
  }

  if (definition.type === 'boolean') {
    return Boolean(rawValue)
  }

  if (definition.type === 'number' || definition.type === 'integer') {
    if (typeof rawValue === 'number') return rawValue
    if (rawValue === undefined || rawValue === null || rawValue === '') return undefined
    const num = Number(rawValue)
    return Number.isFinite(num) ? num : undefined
  }

  if (rawValue === undefined || rawValue === null) return ''
  return String(rawValue)
}

function translateLabel(definition: UnifiedParameterDefinition): string {
  if (definition.labelKey) {
    const result = t(definition.labelKey)
    return result === definition.labelKey ? definition.name : result
  }
  return definition.name
}

function translateDescription(definition: UnifiedParameterDefinition): string {
  if (definition.descriptionKey) {
    const result = t(definition.descriptionKey)
    if (result !== definition.descriptionKey) return result
  }
  return definition.description ?? ''
}

function getUnitLabel(definition: UnifiedParameterDefinition): string | undefined {
  if (definition.unitKey) {
    const result = t(definition.unitKey)
    return result === definition.unitKey ? definition.unit : result
  }
  return definition.unit
}

function getSelectOptions(definition: UnifiedParameterDefinition) {
  if (!definition.allowedValues) return []
  return definition.allowedValues.map((value, index) => ({
    label: definition.allowedValueLabelKeys?.[index]
      ? t(definition.allowedValueLabelKeys[index])
      : value,
    value
  }))
}

function withFallback(key: string, fallback: string): string {
  const translated = t(key)
  return translated === key ? fallback : translated
}

function cloneDefaultValue(definition: UnifiedParameterDefinition): unknown {
  const base = definition.defaultValue ?? definition.default
  if (Array.isArray(base)) return [...base]
  if (base && typeof base === 'object') return { ...(base as Record<string, unknown>) }
  if (base !== undefined) return base

  if (definition.tags?.includes('string-array')) return []

  switch (definition.type) {
    case 'boolean':
      return false
    case 'number':
    case 'integer':
      return definition.minValue ?? definition.min ?? 0
    default:
      return ''
  }
}

function resolveMessageApi(): ReturnType<typeof useMessage> {
  try {
    return useMessage()
  } catch (error) {
    console.warn('[ModelParameterEditor] useMessage fallback: message provider missing.', error)
    if (typeof window !== 'undefined') {
      const { message } = createDiscreteApi(['message'])
      return message as ReturnType<typeof useMessage>
    }
    const stub = () => ({
      destroy: () => {}
    })
    return {
      create: (...args: unknown[]) => {
        console.info('[Message]', ...args)
        return stub()
      },
      info: (...args: unknown[]) => {
        console.info(...args)
        return stub()
      },
      success: (...args: unknown[]) => {
        console.log(...args)
        return stub()
      },
      warning: (...args: unknown[]) => {
        console.warn(...args)
        return stub()
      },
      error: (...args: unknown[]) => {
        console.error(...args)
        return stub()
      },
      loading: (...args: unknown[]) => {
        console.log(...args)
        return stub()
      },
      destroyAll: () => {}
    } as ReturnType<typeof useMessage>
  }
}

</script>

<style scoped>
.model-parameter-editor {
  width: 100%;
}

.advanced-form :deep(.n-form-item) {
  margin-bottom: 8px;
  align-items: center;
  --n-label-text-align: right;
  --n-label-font-weight: 500;
}

.advanced-control {
  min-width: 180px;
  max-width: 320px;
  width: 100%;
}
</style>
