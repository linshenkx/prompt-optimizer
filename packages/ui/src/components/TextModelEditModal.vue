<template>
  <NModal
    :show="show"
    compact-class="text-model-editor--compact"
    :closable="!isCompact"
    preset="card"
    :style="{ width: '90vw', maxWidth: '1000px' }"
    :title="isCompact ? undefined : modalTitle"
    size="large"
    :bordered="false"
    :segmented="true"
    @update:show="handleUpdateShow"
  >
    <template v-if="isCompact" #header>
      <div class="mobile-text-model-heading">
        <NButton quaternary circle :aria-label="t('common.close')" :disabled="isSaving" @click="handleCancel">
          <template #icon>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m14 6-6 6 6 6" /></svg>
          </template>
        </NButton>
        <span :title="modalTitle">{{ isEditing && form.name ? form.name : modalTitle }}</span>
      </div>
    </template>
    <form v-if="formReady" :class="{ 'mobile-text-model-form': isCompact }" @submit.prevent="handleSubmit">
        <NForm :label-placement="isCompact ? 'top' : 'left'" label-width="auto" size="small" :show-feedback="!isCompact">
          <div :class="isCompact ? 'mobile-text-model-identity' : 'text-model-identity'">
          <NFormItem :label="t('modelManager.displayName')">
            <NInput
              v-model:value="form.name"
              data-testid="text-model-name"
              :placeholder="t('modelManager.displayNamePlaceholder')"
              required
            />
          </NFormItem>

          <NFormItem :label="t('modelManager.enabledStatus')">
            <NCheckbox v-model:checked="form.enabled"></NCheckbox>
          </NFormItem>

          </div>
          <NDivider v-if="!isCompact" style="margin: 12px 0 8px 0;" />
          <NH4 v-if="!isCompact" style="margin: 0 0 12px 0; font-size: 14px;">{{ t('modelManager.provider.section') }}</NH4>

          <NFormItem :label="t('modelManager.provider.label')">
            <NSelect
              v-if="isCompact"
              :ref="providerMenu.selectRef"
              v-bind="providerMenu.attrs.value"
              data-testid="text-model-provider-select"
              :value="form.providerId"
              :options="mobileProviderOptions"
              :loading="isLoadingProviders"
              :aria-label="t('modelManager.provider.label')"
              filterable
              @update:value="onMobileProviderChange"
              @update:show="providerMenu.onUpdateShow"
            />
            <ProviderPillSelect
              v-else
              v-model:value="form.providerId"
              :options="providerOptions"
              :loading="isLoadingProviders"
              :aria-label="t('modelManager.provider.label')"
              :more-label="t('modelManager.provider.more')"
              :label-overrides="providerLabelOverrides"
              @update:value="onProviderChange"
            />
          </NFormItem>

          <NText v-if="currentProviderHint" depth="3" style="display: block; margin: -8px 0 12px 0; line-height: 1.5;">
            {{ currentProviderHint }}
          </NText>

          <NAlert
            v-if="isChromeBuiltInProvider"
            class="chrome-built-in-status"
            :type="chromeBuiltInAlertType"
            :show-icon="true"
          >
            <div class="chrome-built-in-status__body">
              <NText strong>{{ chromeBuiltInStatusTitle }}</NText>
              <NText depth="3" class="chrome-built-in-status__description">
                {{ chromeBuiltInStatusDescription }}
              </NText>
              <NProgress
                v-if="chromeBuiltInDownloadPercent !== null"
                type="line"
                :percentage="chromeBuiltInDownloadPercent"
                :show-indicator="true"
              />
              <NSpace align="center" :size="8">
                <NButton
                  v-if="showChromeBuiltInPrepareButton"
                  size="small"
                  secondary
                  type="primary"
                  :loading="isPreparingChromeBuiltIn"
                  @click="prepareChromeBuiltInDownload"
                >
                  {{ t('modelManager.chromeBuiltIn.downloadAction') }}
                </NButton>
                <NButton
                  size="small"
                  quaternary
                  :loading="isCheckingChromeBuiltIn"
                  @click="refreshChromeBuiltInStatus"
                >
                  {{ t('modelManager.chromeBuiltIn.recheckAction') }}
                </NButton>
              </NSpace>
            </div>
          </NAlert>

          <NFormItem
            v-for="field in connectionFields"
            :key="field.name"
            :label="resolveConnectionFieldLabel(field.name)"
          >
            <template v-if="field.name === 'baseURL'" #label>
              <NSpace align="center" :size="4">
                <span>{{ t('modelManager.apiUrl') }}</span>
                <ThemedTooltip :show-arrow="false" placement="top">
                  <NButton
                    class="api-url-help-button"
                    quaternary
                    circle
                    size="tiny"
                    :aria-label="t('modelManager.apiUrlHintAriaLabel')"
                  >
                    ?
                  </NButton>
                  <template #content>
                  <span class="api-url-help-text">{{ t('modelManager.apiUrlHint') }}</span>
                  </template>
                </ThemedTooltip>
              </NSpace>
            </template>

            <template v-if="field.name === 'apiKey'" #label>
              <NSpace align="center" :size="4">
                <span>{{ t('modelManager.apiKey') }}</span>
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

            <template v-if="field.type === 'string' && field.options?.length">
              <NSelect
                v-model:value="form.connectionConfig[field.name] as string"
                :options="field.options"
                :placeholder="field.placeholder"
                :required="field.required"
              />
            </template>
            <template v-else-if="field.type === 'string'">
              <NInput
                v-model:value="form.connectionConfig[field.name] as string"
                :type="field.name.toLowerCase().includes('key') ? 'password' : 'text'"
                :placeholder="field.placeholder"
                :required="field.required"
                :autocomplete="field.name.toLowerCase().includes('key') ? 'new-password' : 'on'"
              />
            </template>
            <template v-else-if="field.type === 'number'">
              <NInputNumber
                v-model:value="form.connectionConfig[field.name] as number"
                :placeholder="field.placeholder"
                :required="field.required"
              />
            </template>
            <template v-else-if="field.type === 'boolean'">
              <NCheckbox v-model:checked="form.connectionConfig[field.name] as boolean">
                {{ field.name }}
              </NCheckbox>
            </template>
          </NFormItem>

          <NFormItem v-if="showCustomHeaders" :label="t('modelManager.customHeaders.label')" :class="{ 'mobile-text-model-headers': isCompact }">
            <template v-if="isCompact" #label>
              <button
                type="button"
                class="mobile-text-model-disclosure"
                :aria-expanded="headersExpanded"
                aria-controls="text-model-custom-headers"
                @click="headersExpanded = !headersExpanded"
              >
                <span>{{ t('modelManager.customHeaders.label') }}<span v-if="customHeaderRows.length"> ({{ customHeaderRows.length }})</span></span>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" :class="{ 'is-expanded': headersExpanded }"><path d="m9 5 7 7-7 7" /></svg>
              </button>
            </template>
            <div v-show="!isCompact || headersExpanded" id="text-model-custom-headers" class="custom-headers-editor">
              <div
                v-for="(row, index) in customHeaderRows"
                :key="index"
                class="custom-header-row"
              >
                <NInput
                  :value="row.key"
                  class="custom-header-name"
                  :placeholder="t('modelManager.customHeaders.namePlaceholder')"
                  @update:value="updateCustomHeaderRow(index, { key: $event })"
                />
                <NInput
                  :value="row.value"
                  type="password"
                  show-password-on="click"
                  :placeholder="t('modelManager.customHeaders.valuePlaceholder')"
                  @update:value="updateCustomHeaderRow(index, { value: $event })"
                />
                <NButton
                  quaternary
                  type="error"
                  size="small"
                  @click="removeCustomHeaderRow(index)"
                >
                  {{ t('common.remove') }}
                </NButton>
              </div>

              <NText v-if="customHeaderValidationMessage" type="error" class="custom-headers-error">
                {{ customHeaderValidationMessage }}
              </NText>

              <NButton secondary size="small" @click="addCustomHeaderRow">
                {{ t('modelManager.customHeaders.add') }}
              </NButton>
            </div>
          </NFormItem>

          <NDivider v-if="!isCompact" style="margin: 12px 0 8px 0;" />
          <NH4 v-if="!isCompact" style="margin: 0 0 12px 0; font-size: 14px;">{{ t('modelManager.model.section') }}</NH4>

          <NFormItem :label="t('modelManager.selectModel')">
            <component :is="isCompact ? 'div' : NSpace" align="center" style="width: 100%;" :class="{ 'mobile-text-model-picker': isCompact }">
              <NSelect
                :ref="modelMenu.selectRef"
                v-bind="modelMenu.attrs.value"
                data-testid="text-model-id-select"
                v-model:value="form.modelId"
                :options="modelOptions"
                :loading="isLoadingModelOptions"
                :placeholder="t('modelManager.defaultModelPlaceholder')"
                :style="isCompact ? { minWidth: 0, flex: 1 } : { flex: 1, minWidth: '300px', maxWidth: '500px' }"
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
                :label="t('modelManager.clickToFetchModels')"
                :disabled="!canRefreshModelOptions"
                :show-arrow="false"
              >
                <NButton
                  @click="refreshModelOptions()"
                  :aria-label="t('modelManager.clickToFetchModels')"
                  :loading="isLoadingModelOptions"
                  :disabled="!canRefreshModelOptions"
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
            </component>
          </NFormItem>
        </NForm>

        <NDivider v-if="!isCompact" style="margin: 12px 0 8px 0;" />
        <ModelAdvancedSection
          mode="text"
          :provider-type="currentProviderType"
          :parameter-definitions="currentParameterDefinitions"
          :param-overrides="form.paramOverrides"
          @update:paramOverrides="updateParamOverrides"
        />
    </form>

    <NFlex v-else justify="center" align="center" style="height: 200px;">
      <NSpin />
    </NFlex>

    <template #action>
      <ModelNetworkStatus style="margin-bottom: 8px" />
      <div v-if="isCompact" class="mobile-text-model-footer">
        <NText
          v-if="formConnectionStatus"
          :type="formConnectionStatus.type"
          class="mobile-text-model-status"
          role="status"
        >{{ formConnectionStatus.message }}</NText>
        <NText v-if="submitError" type="error" class="mobile-text-model-status" role="alert">{{ submitError }}</NText>
        <div class="mobile-text-model-primary-actions">
          <NButton
            secondary
            :loading="isTestingFormConnection"
            :disabled="!canTestFormConnection"
            data-testid="text-model-test"
            @click="handleTestFormConnection"
          >{{ t('modelManager.testConnection') }}</NButton>
          <NButton
            type="primary"
            :loading="isSaving"
            :disabled="!canSaveForm"
            data-testid="text-model-save"
            @click="handleSubmit"
          >{{ isEditing ? t('common.save') : t('common.create') }}</NButton>
        </div>
      </div>
      <NSpace v-else justify="space-between" align="center" style="width: 100%;">
        <NSpace align="center">
          <NButton
            @click="handleTestFormConnection"
            :loading="isTestingFormConnection"
            :disabled="!canTestFormConnection"
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
            {{ t('modelManager.testConnection') }}
          </NButton>
          <NTag v-if="formConnectionStatus" :type="formConnectionStatus.type" size="small" :bordered="false">
            {{ formConnectionStatus.message }}
          </NTag>
        </NSpace>

        <NSpace>
          <NButton @click="handleCancel">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" :loading="isSaving" :disabled="!canSaveForm" @click="handleSubmit">
            {{ isEditing ? t('common.save') : t('common.create') }}
          </NButton>
        </NSpace>
      </NSpace>
    </template>
  </NModal>
</template>

<script setup lang="ts">
import NModal from "./common/AdaptiveModal.vue"
import ModelNetworkStatus from './ModelNetworkStatus.vue'
import { computed, inject, nextTick, h, ref, watch } from 'vue'
import { useConfirmDialog } from '../composables/ui/useConfirmDialog'

import { useI18n } from 'vue-i18n'
import { useToast } from '../composables/ui/useToast'
import { isRunningInElectron, validateCustomRequestHeaders, type CustomRequestHeaderInput } from '@prompt-optimizer/core'
import {

  NForm,
  NFormItem,
  NH4,
  NInput,
  NInputNumber,
  NCheckbox,
  NSelect,
  NSpace,
  NFlex,
  NButton,
  NDivider,
  NText,
  NTag,
  NSpin,
  NAlert,
  NProgress,
  useDialog
} from 'naive-ui'
import ModelAdvancedSection from './ModelAdvancedSection.vue'
import ProviderPillSelect from './ProviderPillSelect.vue'
import ExternalLinkIcon from './icons/ExternalLinkIcon.vue'
import ThemedTooltip from './common/ThemedTooltip.vue'
import type { TextModelManager } from '../composables/model/useTextModelManager'
import { resolveTextConnectionFieldLabel } from '../utils/model-connection-label'
import { getProviderDisplayName } from '../utils/provider-display'
import { useWorkspaceLayout } from '../composables/ui/useWorkspaceLayout'
import { useCompactSelectMenu } from '../composables/ui/useSelectMenuViewport'

const { show } = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:show', 'saved'])

const { t } = useI18n()
const { isCompact } = useWorkspaceLayout()
const providerMenu = useCompactSelectMenu(isCompact, computed(() => show))
const modelMenu = useCompactSelectMenu(isCompact, computed(() => show))
const headersExpanded = ref(false)
const submitError = ref('')
const toast = useToast()
const dialog = useDialog()
const manager = inject<TextModelManager>('textModelManager')
if (!manager) {
  throw new Error('Text model manager not provided')
}

const modalTitle = manager.modalTitle
const form = manager.form
const formReady = manager.formReady
const confirmDialog = useConfirmDialog()
const initialForm = ref('')
let confirmingClose = false
watch([() => show, formReady], async ([visible, ready]) => {
  if (!visible || !ready) return
  headersExpanded.value = false
  submitError.value = ''
  await nextTick()
  initialForm.value = JSON.stringify(form.value)
}, { immediate: true })
const providerOptions = manager.providerOptions
const isLoadingProviders = manager.isLoadingProviders
const connectionFields = manager.connectionFields
const modelOptions = manager.modelOptions
const isLoadingModelOptions = manager.isLoadingModelOptions
const canRefreshModelOptions = manager.canRefreshModelOptions
const refreshModelOptions = manager.refreshModelOptions
const currentParameterDefinitions = manager.currentParameterDefinitions
const updateParamOverrides = manager.updateParamOverrides
const onModelChange = manager.onModelChange
const currentProviderType = manager.currentProviderType
const formConnectionStatus = manager.formConnectionStatus
const testFormConnection = manager.testFormConnection
const isTestingFormConnection = manager.isTestingFormConnection
const canTestFormConnection = manager.canTestFormConnection
const canSaveForm = manager.canSaveForm
const isSaving = manager.isSaving
const isChromeBuiltInProvider = manager.isChromeBuiltInProvider
const chromeBuiltInStatus = manager.chromeBuiltInStatus
const isCheckingChromeBuiltIn = manager.isCheckingChromeBuiltIn
const isPreparingChromeBuiltIn = manager.isPreparingChromeBuiltIn
const chromeBuiltInDownloadProgress = manager.chromeBuiltInDownloadProgress
const refreshChromeBuiltInStatus = manager.refreshChromeBuiltInStatus
const prepareChromeBuiltInDownload = manager.prepareChromeBuiltInDownload

const isEditing = computed(() => !!manager.editingModelId.value)

const providerLabelOverrides = computed(() => ({
  'openai-compatible': t('modelManager.provider.openaiCompatibleCustomLabel')
}))

const mobileProviderOptions = computed(() => providerOptions.value.map(option => ({
  ...option,
  label: providerLabelOverrides.value[option.value as keyof typeof providerLabelOverrides.value] || option.label,
})))

interface CustomHeaderRow {
  key: string
  value: string
}

const showCustomHeaders = computed(() => currentProviderType.value === 'openai-compatible')

const customHeaderRows = computed<CustomHeaderRow[]>(() => {
  const raw = form.value.connectionConfig.customHeaders

  if (Array.isArray(raw)) {
    return raw.map((row: { key?: unknown; name?: unknown; value?: unknown }) => ({
      key: String(row?.key ?? row?.name ?? ''),
      value: String(row?.value ?? '')
    }))
  }

  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([key, value]) => ({
      key,
      value: String(value ?? '')
    }))
  }

  return []
})

const setCustomHeaderRows = (rows: CustomHeaderRow[]) => {
  form.value.connectionConfig.customHeaders = rows
}

const addCustomHeaderRow = () => {
  setCustomHeaderRows([...customHeaderRows.value, { key: '', value: '' }])
}

const updateCustomHeaderRow = (index: number, patch: Partial<CustomHeaderRow>) => {
  const rows = customHeaderRows.value.map(row => ({ ...row }))
  rows[index] = {
    ...rows[index],
    ...patch
  }
  setCustomHeaderRows(rows)
}

const removeCustomHeaderRow = (index: number) => {
  setCustomHeaderRows(customHeaderRows.value.filter((_, rowIndex) => rowIndex !== index))
}

const customHeaderValidationMessage = computed(() => {
  const validation = validateCustomRequestHeaders(
    form.value.connectionConfig.customHeaders as CustomRequestHeaderInput
  )
  if (validation.valid) return ''

  const details = validation.errors
    .map((error) => {
      const reasonKey = `modelManager.customHeaders.validation.${error.reason}`
      const reason = t(reasonKey)
      return `${error.key}: ${reason === reasonKey ? error.reason : reason}`
    })
    .join('; ')

  return t('modelManager.customHeaders.validationError', { details })
})

watch(customHeaderValidationMessage, message => {
  if (message) headersExpanded.value = true
})

// 获取当前选择的 Provider 的 API Key URL
const currentProviderApiKeyUrl = computed(() => {
  return manager.selectedProvider.value?.apiKeyUrl || null
})

const currentProviderHint = computed(() => {
  const provider = manager.selectedProvider.value
  if (!provider) return ''

  if (provider.id === 'openai-compatible') {
    return t('modelManager.provider.customApiHint')
  }

  if (provider.id === 'openai') {
    return t('modelManager.provider.openaiHint')
  }

  if (provider.id === 'dashscope') {
    return t('modelManager.provider.dashscopeHint')
  }

  if (provider.id === 'xiaomi-mimo-token-plan') {
    return t('modelManager.provider.xiaomiMimoHint')
  }

  if (provider.id === 'minimax') {
    return t('modelManager.provider.minimaxHint')
  }

  if (provider.id === 'chrome-built-in') {
    return t('modelManager.provider.chromeBuiltInHint')
  }

  return provider.description || ''
})

const chromeBuiltInAvailability = computed(() => chromeBuiltInStatus.value?.availability || 'checking')

const chromeBuiltInAlertType = computed(() => {
  const availability = chromeBuiltInAvailability.value
  if (availability === 'available') return 'success'
  if (availability === 'downloadable' || availability === 'downloading' || availability === 'checking') return 'info'
  return 'warning'
})

const chromeBuiltInStatusTitle = computed(() => {
  const key = `modelManager.chromeBuiltIn.title.${chromeBuiltInAvailability.value}`
  return t(key)
})

const chromeBuiltInStatusDescription = computed(() => {
  const status = chromeBuiltInStatus.value
  if (status?.error) {
    return t('modelManager.chromeBuiltIn.statusWithError', {
      status: t(`modelManager.chromeBuiltIn.status.${status.availability}`),
      error: status.error
    })
  }

  const key = `modelManager.chromeBuiltIn.status.${chromeBuiltInAvailability.value}`
  return t(key)
})

const chromeBuiltInDownloadPercent = computed(() => {
  const progress = chromeBuiltInDownloadProgress.value
  if (!progress) return null

  const loaded = Number(progress.loaded)
  if (!Number.isFinite(loaded)) return null

  const percent = loaded <= 1 ? loaded * 100 : loaded
  return Math.max(0, Math.min(100, Math.round(percent)))
})

const showChromeBuiltInPrepareButton = computed(() => {
  const availability = chromeBuiltInAvailability.value
  return availability === 'downloadable' || availability === 'downloading'
})

const resolveConnectionFieldLabel = (fieldName: string) => {
  return resolveTextConnectionFieldLabel(fieldName, t)
}

const handleTestFormConnection = async () => {
  const runTest = async () => {
    await testFormConnection()
  }

  if (!isRunningInElectron()) {
    const provider = manager.selectedProvider.value
    if (provider?.corsRestricted) {
      const providerName = getProviderDisplayName(provider, t, 'Unknown Provider')
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

const handleUpdateShow = async (value: boolean, saved = false) => {
  if (!value && !saved && isCompact.value && isSaving.value) return
  if (!value && !saved && initialForm.value && JSON.stringify(form.value) !== initialForm.value) {
    if (confirmingClose) return
    confirmingClose = true
    const discard = await confirmDialog.warning({
      title: t('common.warning'),
      content: t('workspace.unsavedForm'),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
    })
    confirmingClose = false
    if (!discard) return
  }
  emit('update:show', value)

  // 只有在明确关闭时才重置表单状态
  if (!value) {
    // 等待父组件处理状态变化后再重置表单
    await nextTick()
    manager.resetFormState()
  }
}

const handleSubmit = async () => {
  // A responsive rerender or a second click must not turn an in-flight save into a close.
  if (isSaving.value) return
  submitError.value = ''
  try {
    const id = await manager.saveForm()
    emit('saved', id || undefined)
    await handleUpdateShow(false, true)
  } catch (error) {
    console.error('Failed to save model:', error)

    const rawError = error instanceof Error ? error.message : String(error)
    const fallback = isEditing.value
      ? t('modelManager.updateFailed', { error: rawError })
      : t('modelManager.createFailed', { error: rawError })

    const errorCode = (error as { code?: unknown } | null)?.code
    const errorParams = (error as { params?: unknown } | null)?.params

    if (typeof errorCode === 'string') {
      try {
        const translated = t(
          errorCode,
          (typeof errorParams === 'object' && errorParams) ? (errorParams as Record<string, unknown>) : {}
        )
        if (translated && translated !== errorCode) {
          submitError.value = translated
          toast.error(translated)
          return
        }
      } catch {
        // fall back
      }
    }

    submitError.value = rawError || fallback
    toast.error(submitError.value)
  }
}

const handleCancel = () => {
  handleUpdateShow(false)
}

// 处理模型变更：无论新建还是编辑模式，切换模型都应用新模型的默认参数
const handleModelChange = (modelId: string) => {
  onModelChange(modelId)
}

const onProviderChange = (providerId: string) => {
  // 切换提供商时总是自动选择第一个模型
  // 因为原来的模型ID在新提供商下可能不存在
  manager.selectProvider(providerId, {
    autoSelectFirstModel: true,
    resetOverrides: true,
    resetConnectionConfig: true
  })
}

const onMobileProviderChange = (providerId: string) => {
  // Re-selecting the current searchable option must not discard this draft.
  if (providerId === form.value.providerId) return
  onProviderChange(providerId)
}
</script>

<style scoped>
.text-model-identity {
  display: contents;
}

:global(.workspace-compact .text-model-editor--compact.adaptive-modal-page > .n-card-header) {
  padding-top: 6px;
  padding-bottom: 6px;
}

.mobile-text-model-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 16px;
}

.mobile-text-model-heading span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-text-model-form {
  min-width: 0;
}

.mobile-text-model-form :deep(.n-form-item) {
  margin-bottom: 12px;
}

.mobile-text-model-form :deep(.n-form-item-label) {
  padding: 0 0 5px;
  font-size: 13px;
}

.mobile-text-model-identity {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
}

.mobile-text-model-identity :deep(.n-checkbox) {
  min-height: 34px;
  align-items: center;
}

.mobile-text-model-picker {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.mobile-text-model-disclosure {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.mobile-text-model-disclosure svg {
  flex-shrink: 0;
}

.mobile-text-model-disclosure .is-expanded {
  transform: rotate(90deg);
}

.mobile-text-model-headers :deep(.n-form-item-label) {
  display: block;
}

.mobile-text-model-headers :deep(.n-form-item-blank) {
  min-height: 0;
}

.mobile-text-model-form .custom-header-row {
  grid-template-columns: minmax(0, 1fr) auto;
}

.mobile-text-model-form .custom-header-name {
  grid-column: 1 / -1;
}

.mobile-text-model-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-text-model-status {
  line-height: 1.4;
  font-size: 12px;
  overflow-wrap: anywhere;
  max-height: 72px;
  overflow: auto;
}

.mobile-text-model-primary-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.api-url-help-button {
  width: 18px;
  height: 18px;
  min-width: 18px;
  font-size: 12px;
  line-height: 1;
}

.api-url-help-text {
  display: block;
  max-width: 360px;
  line-height: 1.5;
  white-space: normal;
}

.custom-headers-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.custom-headers-error {
  line-height: 1.5;
}

.custom-header-row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(200px, 1.4fr) auto;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.chrome-built-in-status {
  margin: -4px 0 12px;
}

.chrome-built-in-status__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chrome-built-in-status__description {
  display: block;
  line-height: 1.5;
}

@media (max-width: 640px) {
  .custom-header-row {
    grid-template-columns: 1fr;
  }
}
</style>
