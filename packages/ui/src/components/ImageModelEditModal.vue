<template>
  <AdaptiveModal class="image-model-edit-modal"
    compact-class="image-model-edit-modal--compact"
    :closable="!isCompact"
    :show="show"
    preset="card"
    :title="isCompact ? undefined : (isEditing ? t('modelManager.editModel') : t('modelManager.addImageModel'))"
    :style="{ width: '80vw', maxWidth: '820px' }"
    size="large"
    :bordered="false"
    :segmented="true"
    @update:show="(value) => !value && close()"
  >
    <template v-if="isCompact" #header>
      <div class="image-model-editor-heading">
        <NButton quaternary circle :aria-label="t('common.close')" :disabled="isSaving" @click="close()">
          <template #icon>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </template>
        </NButton>
        <span>{{ isEditing ? t('modelManager.editModel') : t('modelManager.addImageModel') }}</span>
      </div>
    </template>
    <form class="image-model-editor-form" :class="{ 'image-model-editor-form--compact': isCompact }" @submit.prevent="save">
        <NForm :label-placement="isCompact ? 'top' : 'left'" :label-width="isCompact ? undefined : 'auto'" :show-feedback="!isCompact" size="small">
          <!-- Basic editable fields share one compact row without creating another draft. -->
          <div :class="{ 'image-model-editor-identity': isCompact }">
          <NFormItem :label="t('image.config.displayName.label')">
            <NInput v-model:value="configForm.name" :placeholder="t('image.config.displayName.placeholder')" required />
          </NFormItem>

          <NFormItem :label="t('image.config.enabledStatus.label')">
            <NCheckbox v-model:checked="configForm.enabled"></NCheckbox>
          </NFormItem>
          </div>

          <!-- 提供商配置区域 -->
          <NDivider :style="{ margin: isCompact ? '8px 0' : '12px 0 8px 0' }" />
          <NH4 v-if="!isCompact" style="margin: 0 0 12px 0; font-size: 14px;">{{ t('image.provider.section') }}</NH4>

          <NFormItem :label="t('image.provider.label')">
            <NSelect
              v-if="isCompact"
              :ref="providerMenu.selectRef"
              v-bind="providerMenu.attrs.value"
              data-testid="image-model-provider-select"
              :value="configForm.providerId"
              :options="mobileProviderOptions"
              :loading="isLoadingProviders"
              :aria-label="t('image.provider.label')"
              filterable
              @update:value="onMobileProviderChange"
              @update:show="providerMenu.onUpdateShow"
            />
            <ProviderPillSelect
              v-else
              v-model:value="configForm.providerId"
              :options="providerOptions"
              :loading="isLoadingProviders"
              :aria-label="t('image.provider.label')"
              :more-label="t('modelManager.provider.more')"
              :label-overrides="providerLabelOverrides"
              @update:value="onProviderChange"
            />
          </NFormItem>


          <!-- 动态连接配置字段 -->
          <NFormItem v-for="field in connectionFields" :key="field.name" :label="t(field.labelKey)">
            <template v-if="field.name === 'apiKey'" #label>
              <NSpace align="center" :size="4">
                <span>{{ t(field.labelKey) }}</span>
                <NButton
                  v-if="currentProviderApiKeyUrl"
                  text
                  size="tiny"
                  type="primary"
                  tag="a"
                  :href="currentProviderApiKeyUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="padding: 0 4px;"
                  :title="t('modelManager.getApiKey')"
                >
                  <template #icon>
                    <ExternalLinkIcon />
                  </template>
                </NButton>
              </NSpace>
            </template>

            <template v-if="field.type === 'string'">
              <NInput
                v-model:value="configForm.connectionConfig![field.name]"
                :type="field.name.toLowerCase().includes('key') ? 'password' : 'text'"
                :placeholder="field.placeholder"
                :required="field.required"
                :autocomplete="field.name.toLowerCase().includes('key') ? 'new-password' : 'on'"
                @update:value="onConnectionConfigChange"
              />
            </template>
            <template v-else-if="field.type === 'number'">
              <NInputNumber
                v-model:value="configForm.connectionConfig![field.name]"
                :placeholder="field.placeholder"
                :required="field.required"
                @update:value="onConnectionConfigChange"
              />
            </template>
            <template v-else-if="field.type === 'boolean'">
              <NCheckbox
                v-model:checked="configForm.connectionConfig![field.name]"
                @update:checked="onConnectionConfigChange"
              >
                {{ t(field.descriptionKey) }}
              </NCheckbox>
            </template>
          </NFormItem>

          <!-- 代理配置通过 connectionFields 动态渲染，并基于可用性过滤，不再单独渲染 -->

          <!-- 模型配置区域 -->
          <NDivider :style="{ margin: isCompact ? '8px 0' : '12px 0 8px 0' }" />
          <NH4 v-if="!isCompact" style="margin: 0 0 12px 0; font-size: 14px;">{{ t('image.model.section') }}</NH4>

          <NFormItem :label="t('image.model.label')">
            <NSpace class="image-model-picker-row" item-class="image-model-picker-item" align="center" style="width: 100%;">
              <NSelect
                :ref="modelMenu.selectRef"
                v-bind="modelMenu.attrs.value"
                data-testid="image-model-id-select"
                class="image-model-select"
                v-model:value="configForm.modelId"
                :options="modelOptions"
                :placeholder="t('image.model.placeholder')"
                :loading="isLoadingModels"
                :style="isCompact ? { minWidth: 0, width: '100%' } : { flex: 1, minWidth: '300px', maxWidth: '500px' }"
                clearable
                filterable
                :filter="(pattern, option) => {
                  const label = typeof option.label === 'string' ? option.label : String(option.value)
                  const value = String(option.value)
                  return label.toLowerCase().includes(pattern.toLowerCase()) || value.toLowerCase().includes(pattern.toLowerCase())
                }"
                tag
                required
                @update:value="handleModelChange"
                @update:show="modelMenu.onUpdateShow"
              />

              <ThemedTooltip
                :label="refreshButtonTooltip"
                :disabled="canRefreshModels"
                :show-arrow="false"
              >
                <NButton
                  @click="refreshModels"
                  :loading="isLoadingModels"
                  :aria-label="t('image.model.refreshTooltip')"
                  :disabled="!canRefreshModels"
                  circle
                  secondary
                  type="primary"
                  size="small"
                  style="flex-shrink: 0;"
                >
                  <template #icon>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                      <polyline points="23 4 23 10 17 10"/>
                      <polyline points="1 20 1 14 7 14"/>
                      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                    </svg>
                  </template>
                </NButton>
              </ThemedTooltip>
            </NSpace>
          </NFormItem>


          <!-- 选中模型的能力标签显示 - 简化为单行 -->
          <NFormItem v-if="selectedModel" :label="t('image.model.capabilities')">
            <NSpace wrap>
              <NTag v-if="selectedModel.capabilities?.text2image" type="success" size="small" :bordered="false">
                {{ t('image.capability.text2image') }}
              </NTag>
              <NTag v-if="selectedModel.capabilities?.image2image" type="info" size="small" :bordered="false">
                {{ t('image.capability.image2image') }}
              </NTag>
              <NTag v-if="(selectedModel.capabilities as any)?.highResolution" type="primary" size="small" :bordered="false">
                {{ t('image.capability.highResolution') }}
              </NTag>
            </NSpace>
          </NFormItem>

          <!-- 高级参数配置区域 -->
          <NDivider :style="{ margin: isCompact ? '8px 0' : '12px 0 8px 0' }" />
          <ModelAdvancedSection
            mode="image"
            :provider-type="selectedProviderId"
            :parameter-definitions="currentParameterDefinitions"
            :param-overrides="configForm.paramOverrides"
            @update:paramOverrides="updateParamOverrides"
          />
        </NForm>
    </form>

    <template #action>
      <div v-if="isCompact" class="image-model-editor-footer">
        <div v-if="connectionStatus || saveError" class="image-model-editor-feedback" role="status">
          <AppPreviewImage
            v-if="testResult?.image && connectionStatus?.type === 'success'"
            :src="testResult.image.url || (testResult.image.b64?.startsWith('data:') ? testResult.image.b64 : `data:image/png;base64,${testResult.image.b64}`)"
            width="40" height="40" object-fit="cover" :preview-disabled="false"
            :alt="t('image.connection.testImagePreview')"
          />
          <NText :type="saveError ? 'error' : connectionStatus?.type" class="image-model-editor-status">
            {{ saveError || (connectionStatus && t(connectionStatus.messageKey)) }}
            <span v-if="!saveError && connectionStatus?.detail" class="image-model-editor-error">{{ connectionStatus.detail }}</span>
          </NText>
        </div>
        <div class="image-model-editor-primary-actions">
          <NButton secondary :loading="isTestingConnection" :disabled="!canTestConnection || isSaving" @click="handleTestConnection">
            {{ t('image.connection.test') }}
          </NButton>
          <NButton data-testid="image-model-save" type="primary" :loading="isSaving" :disabled="!canSave || isTestingConnection" @click="save">
            {{ isEditing ? t('common.update') : t('common.save') }}
          </NButton>
        </div>
      </div>
      <template v-else>
      <ModelNetworkStatus style="margin-bottom: 8px" />
      <NSpace justify="space-between" align="center" style="width: 100%;">
        <!-- 左侧：连接测试 -->
        <NSpace align="center">
          <NButton
            @click="handleTestConnection"
            :loading="isTestingConnection"
            :disabled="!canTestConnection"
            secondary
            type="info"
            size="small"
          >
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </template>
            {{ t('image.connection.test') }}
          </NButton>

          <NTag
            v-if="connectionStatus"
            :type="connectionStatus.type as 'success' | 'error' | 'info' | 'warning' | 'default'"
            :bordered="false"
            size="small"
          >
            {{ t(connectionStatus.messageKey) }}
            <span v-if="testResult?.testType" style="margin-left: 4px;">
              ({{ t(testResult.testType === 'image2image' ? 'image.connection.functionTestImageToImage' : 'image.connection.functionTestTextToImage') }})
            </span>
          </NTag>

          <!-- 测试结果图片缩略图 -->
          <AppPreviewImage
            v-if="testResult?.image && connectionStatus?.type === 'success'"
            :src="testResult.image.url || (testResult.image.b64?.startsWith('data:') ? testResult.image.b64 : `data:image/png;base64,${testResult.image.b64}`)"
            width="32"
            height="32"
            object-fit="cover"
            :style="{ borderRadius: '4px', border: '1px solid var(--n-border-color)' }"
            :preview-disabled="false"
            :alt="t('image.connection.testImagePreview')"
          />
        </NSpace>

        <!-- 右侧：取消/保存按钮 -->
        <NSpace>
          <NButton @click="close()">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" @click="save" :loading="isSaving" :disabled="!canSave">
            {{ isEditing ? t('common.update') : t('common.save') }}
          </NButton>
        </NSpace>
      </NSpace>

      <!-- 连接状态详细信息显示在按钮区域下方 -->
      <NText v-if="connectionStatus?.detail" depth="3" style="font-size: 12px; margin-top: 8px; display: block;">
        {{ connectionStatus.detail }}
      </NText>
      </template>
    </template>
  </AdaptiveModal>
</template>

<script setup lang="ts">
import AdaptiveModal from './common/AdaptiveModal.vue'
import ModelNetworkStatus from './ModelNetworkStatus.vue'
import { computed, watch, nextTick, h, ref, onBeforeUnmount } from 'vue'

import { useI18n } from 'vue-i18n'
import {
  NSpace, NInput, NInputNumber,
  NCheckbox, NSelect, NButton, NTag, NText,
  NDivider, NH4, NForm, NFormItem, useDialog
} from 'naive-ui'
import { useImageModelManager } from '../composables/model/useImageModelManager'
import { useToast } from '../composables/ui/useToast'
import { useConfirmDialog } from '../composables/ui/useConfirmDialog'
import { useWorkspaceLayout } from '../composables/ui/useWorkspaceLayout'
import { useCompactSelectMenu } from '../composables/ui/useSelectMenuViewport'
import { isRunningInElectron, type ImageModelConfig } from '@prompt-optimizer/core'
import ModelAdvancedSection from './ModelAdvancedSection.vue'
import ProviderPillSelect from './ProviderPillSelect.vue'
import ExternalLinkIcon from './icons/ExternalLinkIcon.vue'
import AppPreviewImage from './media/AppPreviewImage.vue'
import ThemedTooltip from './common/ThemedTooltip.vue'


const { t } = useI18n()
const { isCompact } = useWorkspaceLayout()
const toast = useToast()
const dialog = useDialog()
const confirmDialog = useConfirmDialog()
const initialDraft = ref<string>()
const saveError = ref('')
let confirmingClose = false
let draftLoadVersion = 0
onBeforeUnmount(() => { draftLoadVersion += 1 })

// Props
const props = defineProps<{
  show: boolean
  configId?: string
  initialConfig?: ImageModelConfig
}>()
const providerMenu = useCompactSelectMenu(isCompact, computed(() => props.show))
const modelMenu = useCompactSelectMenu(isCompact, computed(() => props.show))

// Emits
const emit = defineEmits<{
  'update:show': [value: boolean]
  'saved': []
}>()

// 使用 composable
const {
  // data
  providers,
  models,
  configs,
  selectedProviderId,
  selectedModelId,
  configForm,

  // UI state
  isLoadingModels,
  isLoadingProviders,
  isTestingConnection,
  isSaving,
  connectionStatus,
  testResult,
  modelLoadingStatus,

  // computed helpers
  selectedProvider,
  selectedModel,
  currentParameterDefinitions,
  isConnectionConfigured,
  canTestConnection,
  canRefreshModels,

  // methods
  onProviderChange: handleProviderChange,
  onConnectionConfigChange,
  onModelChange,
  testConnection: performTestConnection,
  refreshModels: handleRefreshModels,
  updateParamOverrides,
  saveConfig,
  loadConfigs,
  loadProviders,
} = useImageModelManager()

// 计算属性
const isEditing = computed(() => !!props.configId)

// 获取当前选择的 Provider 的 API Key URL
const currentProviderApiKeyUrl = computed(() => {
  return selectedProvider.value?.apiKeyUrl || null
})

const handleTestConnection = async () => {
  if (isTestingConnection.value) return
  saveError.value = ''
  const runTest = async () => {
    await performTestConnection()
  }

  if (!isRunningInElectron()) {
    if (selectedProvider.value?.corsRestricted) {
      const providerName = selectedProvider.value.name || selectedProvider.value.id || 'Unknown'
      dialog.warning({
        title: t('modelManager.corsRestrictedTag'),
        content: () => h('div', { style: 'white-space: pre-line;' }, t('modelManager.corsRestrictedConfirm', { provider: providerName })),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
        // Don't block dialog close while the async test runs.
        onPositiveClick: () => {
          void runTest()
        }
      })
      return
    }
  }
  await runTest()
}

const providerOptions = computed(() =>
  providers.value.map(p => ({
    label: p.name,
    value: p.id,
    disabled: false
  }))
)

const providerLabelOverrides = computed(() => ({
  'openai-compatible': t('modelManager.provider.openaiCompatibleCustomLabel')
}))

const mobileProviderOptions = computed(() => providerOptions.value.map(option => ({
  ...option,
  label: providerLabelOverrides.value[option.value as keyof typeof providerLabelOverrides.value] || option.label,
})))

const modelOptions = computed(() =>
  models.value.map(m => ({
    label: m.id,
    value: m.id,
    disabled: false
  }))
)

const connectionFields = computed(() => {
  if (!selectedProvider.value?.connectionSchema) return []

  const schema = selectedProvider.value.connectionSchema

  interface ConnectionField {
    name: string
    required: boolean
    type: string
    labelKey: string
    descriptionKey: string
    placeholder: string
  }

  const fields: ConnectionField[] = []

  // 处理必需字段
  for (const fieldName of schema.required) {
    fields.push({
      name: fieldName,
      required: true,
      type: schema.fieldTypes[fieldName] || 'string',
      labelKey: `image.connection.${fieldName}.label`,
      descriptionKey: `image.connection.${fieldName}.description`,
      placeholder: t(`image.connection.${fieldName}.placeholder`)
    })
  }

  // 处理可选字段
  for (const fieldName of schema.optional) {
    fields.push({
      name: fieldName,
      required: false,
      type: schema.fieldTypes[fieldName] || 'string',
      labelKey: `image.connection.${fieldName}.label`,
      descriptionKey: `image.connection.${fieldName}.description`,
      placeholder: fieldName === 'baseURL'
        ? selectedProvider.value.defaultBaseURL
        : t(`image.connection.${fieldName}.placeholder`)
    })
  }

  return fields
})

const refreshButtonTooltip = computed(() => {
  if (canRefreshModels.value) {
    return t('image.model.refreshTooltip')
  }

  if (!selectedProvider.value?.supportsDynamicModels) {
    return t('image.model.refreshDisabledTooltip.dynamicNotSupported')
  }

  if (!isConnectionConfigured.value) {
    return t('image.model.refreshDisabledTooltip.connectionRequired')
  }

  return ''
})

const canSave = computed(() => {
  return configForm.value.name &&
         configForm.value.providerId &&
         configForm.value.modelId &&
         isConnectionConfigured.value
})

const applyDraftConfig = async (draft: ImageModelConfig) => {
  configForm.value = JSON.parse(JSON.stringify({
    ...draft,
    id: '',
    paramOverrides: draft.paramOverrides || {}
  })) as ImageModelConfig
  selectedProviderId.value = draft.providerId
  selectedModelId.value = draft.modelId
  await handleProviderChange(draft.providerId, {
    autoSelectFirstModel: false,
    resetOverrides: false,
    resetConnectionConfig: false
  })
  await nextTick()
}

const loadExistingConfig = async (configId: string, isCurrent: () => boolean) => {
  await loadConfigs()
  if (!isCurrent()) return
  const existing = configs.value.find(c => c.id === configId)
  if (!existing) return

  configForm.value = JSON.parse(JSON.stringify(existing)) as ImageModelConfig
  configForm.value.paramOverrides = configForm.value.paramOverrides || {}
  selectedProviderId.value = existing.providerId
  selectedModelId.value = existing.modelId
  await handleProviderChange(existing.providerId, {
    autoSelectFirstModel: false,
    resetOverrides: false,
    resetConnectionConfig: false
  })
  await nextTick()
}

// Only editable values participate in dirty detection; catalog refreshes may update metadata.
const draftSnapshot = () => JSON.stringify({
  name: configForm.value.name,
  enabled: configForm.value.enabled,
  providerId: configForm.value.providerId,
  modelId: configForm.value.modelId,
  connectionConfig: configForm.value.connectionConfig,
  paramOverrides: configForm.value.paramOverrides,
})

const close = async (saved = false) => {
  const closingVersion = draftLoadVersion
  if (isCompact.value && !saved) {
    if (isSaving.value || confirmingClose) return
    if (initialDraft.value !== undefined && draftSnapshot() !== initialDraft.value) {
      confirmingClose = true
      try {
        const discard = await confirmDialog.warning({
          title: t('common.warning'),
          content: t('workspace.unsavedForm'),
          positiveText: t('common.confirm'),
          negativeText: t('common.cancel'),
        })
        if (!discard || closingVersion !== draftLoadVersion) return
      } finally {
        confirmingClose = false
      }
    }
  }
  draftLoadVersion += 1
  emit('update:show', false)
  resetFormData()
}

const resetFormData = () => {
  initialDraft.value = undefined
  saveError.value = ''
  configForm.value = {
    id: '',
    name: '',
    providerId: '',
    modelId: '',
    enabled: true,
    connectionConfig: {},
    paramOverrides: {}
  }
  selectedProviderId.value = ''
  selectedModelId.value = ''
  models.value = []
  connectionStatus.value = null
  testResult.value = null
  modelLoadingStatus.value = null
}

const onProviderChange = async (providerId: string, autoSelectFirstModel?: boolean) => {
  await handleProviderChange(providerId, autoSelectFirstModel)
}

const onMobileProviderChange = async (providerId: string) => {
  // NSelect emits when the selected option is tapped again. Keep the current
  // draft intact; only a different provider should reset its model and credentials.
  if (providerId === configForm.value.providerId) return
  await onProviderChange(providerId)
}

const refreshModels = async () => {
  if (!canRefreshModels.value) return

  modelLoadingStatus.value = { type: 'info', messageKey: 'image.model.loading' }

  try {
    await handleRefreshModels()
    modelLoadingStatus.value = {
      type: 'success',
      messageKey: 'image.model.refreshSuccess',
      count: models.value.length
    }
    toast.success(t('image.model.refreshSuccess'))
  } catch (_error) {
    modelLoadingStatus.value = { type: 'error', messageKey: 'image.model.refreshError' }
    toast.error(t('image.model.refreshError'))
  } finally {
    // composable 管理 isLoadingModels
  }
}

// 处理模型变更：无论新建还是编辑模式，切换模型都应用新模型的默认参数
// （编辑模式会合并参数，保留用户已有配置；创建模式会替换参数）
const handleModelChange = (modelId: string) => {
  onModelChange(modelId)
}

const save = async () => {
  if (!canSave.value || isSaving.value) return
  saveError.value = ''

  try {
    const saved = await saveConfig()
    if (!saved) {
      // The shared controller already reports the error. Keep the same draft
      // available for retry instead of treating its caught exception as success.
      saveError.value = t('image.config.saveFailed')
      return
    }
    toast.success(isEditing.value ? t('image.config.updateSuccess') : t('image.config.createSuccess'))
    emit('saved')
    await close(true)
  } catch (_error) {
    console.error('[ImageModelEditModal] Failed to save config:', _error)
    saveError.value = t('image.config.saveFailed')
    toast.error(saveError.value)
  }
}

// A single owner loads the draft once per opened configuration. Responsive changes
// only swap presentation; they must never reinitialize a draft or repeat a request.
watch([() => props.show, () => props.configId, () => props.initialConfig], async ([show, configId, initialConfig]) => {
  const version = ++draftLoadVersion
  const isCurrent = () => version === draftLoadVersion
  if (!show) {
    resetFormData()
    return
  }
  try {
    await loadProviders()
    if (!isCurrent()) return
    if (configId) {
      await loadExistingConfig(configId, isCurrent)
    } else if (initialConfig) {
      await applyDraftConfig(initialConfig)
    } else {
      resetFormData()
      const firstProvider = providers.value[0]
      if (firstProvider) {
        await handleProviderChange(firstProvider.id)
        await nextTick()
        if (!isCurrent()) return
        const firstModel = models.value[0]
        if (firstModel) onModelChange(firstModel.id)
      }
    }
    if (isCurrent()) initialDraft.value = draftSnapshot()
  } catch (error) {
    console.error('[ImageModelEditModal] Failed to load config:', error)
  }
}, { immediate: true })
</script>

<style scoped>
/* The modal card is teleported; use the explicit compact owner for its public slots. */
:global(.workspace-compact .image-model-edit-modal--compact.adaptive-modal-page > .n-card-header) {
  padding: 8px 12px;
  min-height: 56px;
}

:global(.workspace-compact .image-model-edit-modal--compact.adaptive-modal-page > .n-card-content) {
  padding: 12px !important;
}

:global(.workspace-compact .image-model-edit-modal--compact.adaptive-modal-page > .n-card__footer),
:global(.workspace-compact .image-model-edit-modal--compact.adaptive-modal-page > .n-card__action) {
  padding: 10px 12px max(10px, env(safe-area-inset-bottom));
}

.image-model-editor-heading {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 16px;
}

.image-model-editor-form--compact :deep(.n-form-item) {
  --n-label-height: auto;
  --n-label-padding: 0 0 5px;
  --n-blank-height: 36px;
  min-width: 0;
  margin-bottom: 10px;
}

.image-model-editor-form--compact :deep(.image-model-picker-row .image-model-picker-item:has(> .image-model-select)) {
  flex: 1 1 0%;
}

.image-model-editor-identity {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
}

.image-model-editor-footer {
  display: grid;
  gap: 8px;
}

.image-model-editor-primary-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.image-model-editor-feedback {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.image-model-editor-status {
  min-width: 0;
  overflow-wrap: anywhere;
}

.image-model-editor-error {
  display: block;
  max-height: 64px;
  overflow-y: auto;
}
</style>
