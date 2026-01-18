<template>
  <NCollapse v-model:expanded-names="expandedNames" class="model-advanced-section">
    <NCollapseItem name="advanced">
      <template #header>
        <NSpace vertical :size="4" class="advanced-header">
          <NSpace align="center" :size="8">
            <NH4 style="margin: 0; font-size: 14px;">
              {{ t('modelManager.advancedParameters.title') }}
            </NH4>
            <NTag type="default" size="small" :bordered="false">
              {{ providerDisplay }}
            </NTag>
          </NSpace>
          <NText depth="3" style="font-size: 12px;">
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
        <div class="advanced-actions" @click.stop>
          <NDropdown
            v-if="dropdownOptions.length > 0"
            trigger="click"
            placement="bottom-end"
            :options="dropdownOptions"
            @select="handleAddOption"
          >
            <NButton size="small" type="primary" quaternary>
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="8" y1="3" x2="8" y2="13" />
                  <line x1="3" y1="8" x2="13" y2="8" />
                </svg>
              </template>
              {{ t('modelManager.advancedParameters.add') }}
            </NButton>
          </NDropdown>
          <NButton
            v-else
            size="small"
            quaternary
            disabled
          >
            {{ t('modelManager.advancedParameters.noAvailableParams') }}
          </NButton>
        </div>
      </template>

      <div class="advanced-body">
        <ModelParameterEditor
          ref="editorRef"
          :mode="mode"
          :schema="parameterDefinitions"
          :param-overrides="paramOverrides"
          :allow-custom="allowCustom"
          @update:paramOverrides="emitParamOverrides"
        />
      </div>
    </NCollapseItem>
  </NCollapse>

  <!-- 自定义参数输入对话框 -->
  <NModal
    v-model:show="showCustomModal"
    preset="dialog"
    :title="t('modelManager.advancedParameters.custom')"
    :positive-text="t('common.add')"
    :negative-text="t('common.cancel')"
    @positive-click="handleConfirmCustom"
  >
    <NSpace vertical :size="12">
      <NFormItem :label="t('modelManager.advancedParameters.customKeyPlaceholder')">
        <NInput v-model:value="customForm.key" size="small" :placeholder="t('modelManager.advancedParameters.customKeyPlaceholder')" />
      </NFormItem>
      <NFormItem :label="t('modelManager.advancedParameters.customValuePlaceholder')">
        <NInput
          v-model:value="customForm.value"
          type="textarea"
          size="small"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="t('modelManager.advancedParameters.customValuePlaceholder')"
        />
      </NFormItem>
    </NSpace>
  </NModal>
</template>

<script setup lang="ts">
import { computed, ref, reactive } from 'vue'

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

const props = defineProps({
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

const expandedNames = ref<string[]>([])
const showCustomModal = ref(false)
const customForm = reactive({
  key: '',
  value: ''
})
const editorRef = ref<InstanceType<typeof ModelParameterEditor>>()

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
    message.error(withFallback('modelManager.advancedParameters.validation.unknownParam', '参数定义不存在'))
    return
  }

  const next = {
    ...props.paramOverrides,
    [definition.name]: cloneDefaultValue(definition)
  }
  emitParamOverrides(next)
  ensureExpanded()
}

const handleConfirmCustom = () => {
  const trimmedKey = customForm.key.trim()
  if (!trimmedKey) {
    message.error(withFallback('modelManager.advancedParameters.validation.customKeyRequired', '参数名称不能为空'))
    return false
  }
  if (!isSafeCustomKey(trimmedKey)) {
    message.error(withFallback('modelManager.advancedParameters.validation.dangerousParam', '存在危险的参数名称'))
    return false
  }
  if (Object.prototype.hasOwnProperty.call(props.paramOverrides, trimmedKey)) {
    message.error(withFallback('modelManager.advancedParameters.validation.duplicateParam', '参数已存在'))
    return false
  }
  const trimmedValue = customForm.value.trim()
  if (!trimmedValue) {
    message.error(withFallback('modelManager.advancedParameters.validation.customValueRequired', '参数值不能为空'))
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
</style>
