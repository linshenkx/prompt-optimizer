<template>
  <DefineCustomForm>
    <NSpace vertical :size="12">
      <NFormItem :label="t('modelManager.advancedParameters.customKeyPlaceholder')" :label-placement="isCompact ? 'top' : undefined" :label-width="isCompact ? 0 : undefined">
        <NInput v-model:value="customForm.key" size="small" :placeholder="t('modelManager.advancedParameters.customKeyPlaceholder')" />
      </NFormItem>
      <NFormItem :label="t('modelManager.advancedParameters.customValuePlaceholder')" :label-placement="isCompact ? 'top' : undefined" :label-width="isCompact ? 0 : undefined">
        <NInput
          v-model:value="customForm.value"
          type="textarea"
          size="small"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="t('modelManager.advancedParameters.customValuePlaceholder')"
        />
      </NFormItem>
    </NSpace>
  </DefineCustomForm>
  <DefineEditor>
    <ModelParameterEditor
      ref="editorRef"
      :mode="mode"
      :schema="parameterDefinitions"
      :param-overrides="paramOverrides"
      :allow-custom="allowCustom"
      :embedded="embedded"
      :show-descriptions="!embedded"
      @update:paramOverrides="emitParamOverrides"
    />
  </DefineEditor>
  <DefineActions>
    <div class="advanced-actions" @click.stop>
      <NDropdown
        v-if="dropdownOptions.length > 0"
        trigger="click"
        placement="bottom-end"
        :options="dropdownOptions"
        :to="embedded ? false : undefined"
        @select="handleAddOption"
      >
        <NButton size="small" :type="embedded ? 'default' : 'primary'" quaternary>
          <template #icon><UiPlus :size="14" /></template>
          {{ t('modelManager.advancedParameters.add') }}
        </NButton>
      </NDropdown>
      <NButton v-else size="small" quaternary disabled>
        {{ t('modelManager.advancedParameters.noAvailableParams') }}
      </NButton>
    </div>
  </DefineActions>
  <div v-if="embedded" class="model-advanced-section model-advanced-section--embedded">
    <ReuseEditor v-if="Object.keys(paramOverrides).length" />
    <div v-for="entry in inheritedEntries" :key="entry.name" class="advanced-inherited" :data-testid="'inherited-param-' + entry.name">
      <div class="advanced-inherited__content">
        <NText class="advanced-inherited__name" :title="entry.label">{{ entry.label }}</NText>
        <NText depth="3" class="advanced-inherited__value" :title="entry.display">{{ t('localParameters.inherit', { value: entry.display }) }}</NText>
      </div>
      <NButton size="small" quaternary :aria-label="t('common.edit') + ' ' + entry.label" @click="overrideInherited(entry.name)">{{ t('common.edit') }}</NButton>
    </div>
    <div v-if="showCustomModal" class="advanced-custom" data-testid="embedded-custom-parameter">
      <ReuseCustomForm />
      <div class="advanced-custom__actions">
        <NButton size="small" quaternary @click="showCustomModal = false">{{ t('common.cancel') }}</NButton>
        <NButton size="small" type="primary" data-testid="custom-parameter-add" @click="handleConfirmCustom">{{ t('common.add') }}</NButton>
      </div>
    </div>
    <div class="advanced-footer">
      <ReuseActions />
      <slot name="actions" />
    </div>
  </div>
  <NCollapse v-else v-model:expanded-names="expandedNames" class="model-advanced-section" :class="{ 'model-advanced-section--compact': isCompact }">
    <NCollapseItem name="advanced">
      <template #header>
        <NSpace vertical :size="4" class="advanced-header">
          <NSpace align="center" :size="8">
            <NH4 style="margin: 0; font-size: 14px;">
              {{ t('modelManager.advancedParameters.title') }}
            </NH4>
            <NTag v-if="!isCompact" type="default" size="small" :bordered="false">
              {{ providerDisplay }}
            </NTag>
          </NSpace>
          <NText v-if="!isCompact" depth="3" style="font-size: 12px;">
            <span>{{ t('modelManager.advancedParameters.currentProvider') }}:</span>
            <NText strong>
              {{ providerDisplay }}
            </NText>
            <span v-if="availableCount > 0">
              ({{ availableCount }}{{ t('modelManager.advancedParameters.availableParams') }})
            </span>
            <NText v-else type="warning">
              ({{ t('modelManager.advancedParameters.noAvailableParams') }})
            </NText>
          </NText>
        </NSpace>
      </template>
      <template #header-extra>
        <ReuseActions />
      </template>

      <div class="advanced-body">
        <ReuseEditor />
      </div>
    </NCollapseItem>
  </NCollapse>

  <!-- 自定义参数输入对话框 -->
  <NModal
    v-if="!embedded"
    v-model:show="showCustomModal"
    preset="dialog"
    :title="t('modelManager.advancedParameters.custom')"
    :positive-text="t('common.add')"
    :negative-text="t('common.cancel')"
    @positive-click="handleConfirmCustom"
  >
    <ReuseCustomForm />
  </NModal>
</template>

<script setup lang="ts">
import { Plus as UiPlus } from '@lucide/vue'
import { computed, ref, reactive } from 'vue'
import { createReusableTemplate } from '@vueuse/core'

import { useI18n } from 'vue-i18n'
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NDropdown,
  NSpace,
  NTag,
  NText,
  NH4,
  NModal,
  NFormItem,
  NInput,
  useMessage,
  createDiscreteApi
} from 'naive-ui'
import { isSafeCustomKey, parseCustomValue, type UnifiedParameterDefinition } from '@prompt-optimizer/core'
import ModelParameterEditor from './ModelParameterEditor.vue'
import { useWorkspaceLayout } from '../composables/ui/useWorkspaceLayout'

const props = defineProps({
  embedded: { type: Boolean, default: false },
  defaultExpanded: { type: Boolean, default: false },
  mode: {
    type: String as () => 'text' | 'image',
    default: 'text'
  },
  providerType: {
    type: String,
    default: 'custom'
  },
  parameterDefinitions: {
    type: Array as () => readonly UnifiedParameterDefinition[],
    default: () => []
  },
  paramOverrides: {
    type: Object as () => Record<string, unknown>,
    default: () => ({})
  },
  inherited: {
    type: Object as () => Record<string, unknown>,
    default: () => ({})
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
const { isCompact } = useWorkspaceLayout()
const message = resolveMessageApi()

const expandedNames = ref<string[]>(props.defaultExpanded ? ['advanced'] : [])
const showCustomModal = ref(false)
const customForm = reactive({
  key: '',
  value: ''
})
const editorRef = ref<InstanceType<typeof ModelParameterEditor>>()
const [DefineEditor, ReuseEditor] = createReusableTemplate()
const [DefineActions, ReuseActions] = createReusableTemplate()
const [DefineCustomForm, ReuseCustomForm] = createReusableTemplate()

const inheritedEntries = computed(() => Object.entries(props.inherited)
  .filter(([name, value]) => value !== undefined && !Object.prototype.hasOwnProperty.call(props.paramOverrides, name))
  .map(([name, value]) => {
    const definition = props.parameterDefinitions.find(item => item.name === name)
    const index = definition?.allowedValues?.indexOf(String(value)) ?? -1
    const labelKey = definition?.allowedValueLabelKeys?.[index]
    return { name, label: definition?.labelKey ? t(definition.labelKey) : name,
      display: labelKey ? t(labelKey) : typeof value === 'boolean' ? t(value ? 'common.enabled' : 'common.disabled')
        : typeof value === 'string' && value ? value : JSON.stringify(value) }
  }))

function overrideInherited(name: string) {
  emitParamOverrides({ ...props.paramOverrides, [name]: JSON.parse(JSON.stringify(props.inherited[name])) })
  ensureExpanded()
}

const availableDefinitions = computed(() =>
  props.parameterDefinitions.filter(
    (def) => !Object.prototype.hasOwnProperty.call(props.paramOverrides, def.name)
  )
)

const availableCount = computed(() => availableDefinitions.value.length)

const dropdownOptions = computed(() => {
  const base = availableDefinitions.value.map((def) => ({
    label: def.labelKey ? t(def.labelKey) : def.name,
    key: def.name
  }))

  if (props.allowCustom) {
    base.push({
      label: t('modelManager.advancedParameters.custom'),
      key: '__custom__'
    })
  }

  return base
})

const providerDisplay = computed(() => {
  if (!props.providerType) return t('modelManager.advancedParameters.customProvider')
  if (props.providerType === 'custom') {
    return t('modelManager.advancedParameters.customProvider')
  }
  return props.providerType.toUpperCase()
})

const emitParamOverrides = (value: Record<string, unknown>) => {
  emit('update:paramOverrides', value)
}

const handleAddOption = (value: string | number) => {
  if (!value) return

  if (value === '__custom__') {
    // 打开自定义参数输入对话框
    showCustomModal.value = true
    return
  }

  const definition = props.parameterDefinitions.find((def) => def.name === value)
  if (!definition) {
    message.error(withFallback('modelManager.advancedParameters.validation.unknownParam', 'Parameter definition not found'))
    return
  }

  const next = {
    ...props.paramOverrides,
    [definition.name]: Object.prototype.hasOwnProperty.call(props.inherited, definition.name)
      ? JSON.parse(JSON.stringify(props.inherited[definition.name])) : cloneDefaultValue(definition)
  }
  emitParamOverrides(next)
  ensureExpanded()
}

const handleConfirmCustom = () => {
  const trimmedKey = customForm.key.trim()
  if (!trimmedKey) {
    message.error(withFallback('modelManager.advancedParameters.validation.customKeyRequired', 'Parameter name is required'))
    return false
  }
  if (!isSafeCustomKey(trimmedKey)) {
    message.error(withFallback('modelManager.advancedParameters.validation.dangerousParam', 'This parameter name is not allowed'))
    return false
  }
  if (Object.prototype.hasOwnProperty.call(props.paramOverrides, trimmedKey)) {
    message.error(withFallback('modelManager.advancedParameters.validation.duplicateParam', 'Parameter already exists'))
    return false
  }
  const trimmedValue = customForm.value.trim()
  if (!trimmedValue) {
    message.error(withFallback('modelManager.advancedParameters.validation.customValueRequired', 'Parameter value is required'))
    return false
  }

  const next = {
    ...props.paramOverrides,
    [trimmedKey]: parseCustomValue(trimmedValue)
  }
  emitParamOverrides(next)

  // 重置表单并关闭对话框
  customForm.key = ''
  customForm.value = ''
  showCustomModal.value = false
  ensureExpanded()

  return true
}

const ensureExpanded = () => {
  if (!expandedNames.value.includes('advanced')) {
    expandedNames.value = ['advanced']
  }
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

type MessageApi = ReturnType<typeof useMessage>

function resolveMessageApi(): MessageApi {
  try {
    return useMessage()
  } catch (error) {
    console.warn('[ModelAdvancedSection] useMessage fallback: message provider missing.', error)
    const { message } = createDiscreteApi(['message'])
    return message
  }
}
</script>

<style scoped>
.model-advanced-section {
  width: 100%;
}

.advanced-header {
  width: 100%;
}

.advanced-actions {
  display: inline-flex;
  align-items: center;
}

.advanced-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.advanced-control {
  max-width: 360px;
}
.advanced-custom { padding-block: 8px; }
.advanced-inherited { display: flex; align-items: center; gap: 8px; padding-block: 5px; }
.advanced-inherited__content { flex: 1; min-width: 0; }
.advanced-inherited__name, .advanced-inherited__value { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.advanced-inherited__name { font-size: 13px; }
.advanced-inherited__value { font-size: 12px; }
.advanced-custom__actions { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 8px; }
.advanced-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.model-advanced-section--embedded :deep(.advanced-control) { min-width: 0; max-width: 100%; }
.model-advanced-section--embedded :deep(.n-form-item-blank) { min-width: 0; }
.model-advanced-section--compact :deep(.n-collapse-item__header-main) { min-height: 44px; }
.model-advanced-section--compact .advanced-header { min-width: 0; }
</style>
