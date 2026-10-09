<template>
  <NModal
    :show="show"
    preset="card"
    :style="{ width: '90vw', maxWidth: '1000px' }"
    :title="modalTitle"
    size="large"
    :bordered="false"
    :segmented="true"
    @update:show="handleUpdateShow"
  >
    <form v-if="formReady" @submit.prevent="handleSubmit">
        <NForm label-placement="left" label-width="auto" size="small">
          <NFormItem :label="t('modelManager.displayName')">
            <NInput
              v-model:value="form.name"
              :placeholder="t('modelManager.displayNamePlaceholder')"
              required
            />
          </NFormItem>

          <NFormItem :label="t('modelManager.enabledStatus')">
            <NCheckbox v-model:checked="form.enabled"></NCheckbox>
          </NFormItem>

          <NDivider style="margin: 12px 0 8px 0;" />
          <NH4 style="margin: 0 0 12px 0; font-size: 14px;">{{ t('modelManager.provider.section') }}</NH4>

          <NFormItem :label="t('modelManager.provider.label')">
            <ProviderPillSelect
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

          <div v-if="isOrcaRouterProvider" class="orca-router-status">
            <OrcaRouterAuthPanel
              :api-key-value="String(form.connectionConfig.apiKey ?? '')"
              :initial-method="isOrcaRouterOAuthProvider ? 'pkce' : 'api-key'"
              @update:api-key="form.connectionConfig.apiKey = $event"
              @connected="onOrcaRouterConnected"
            />
          </div>

          <NFormItem
            v-for="field in connectionFieldsWithoutOrcaCredential"
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

          <NFormItem v-if="showCustomHeaders" :label="t('modelManager.customHeaders.label')">
            <div class="custom-headers-editor">
              <div
                v-for="(row, index) in customHeaderRows"
                :key="index"
                class="custom-header-row"
              >
                <NInput
                  :value="row.key"
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

          <NDivider style="margin: 12px 0 8px 0;" />
          <NH4 style="margin: 0 0 12px 0; font-size: 14px;">{{ t('modelManager.model.section') }}</NH4>

          <NFormItem :label="t('modelManager.selectModel')">
            <NSpace align="center" style="width: 100%;">
              <NSelect
                v-model:value="form.modelId"
                :options="modelOptions"
                :loading="isLoadingModelOptions"
                :placeholder="t('modelManager.defaultModelPlaceholder')"
                style="flex: 1; min-width: 300px; max-width: 500px;"
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
              />

              <ThemedTooltip
                :label="t('modelManager.clickToFetchModels')"
                :disabled="!canRefreshModelOptions"
                :show-arrow="false"
              >
                <NButton
                  @click="refreshModelOptions()"
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
            </NSpace>
          </NFormItem>
        </NForm>

        <NDivider style="margin: 12px 0 8px 0;" />
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
      <NSpace justify="space-between" align="center" style="width: 100%;">
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
import { computed, inject, nextTick, h } from 'vue'

import { useI18n } from 'vue-i18n'
import { useToast } from '../composables/ui/useToast'
import {
  ORCAROUTER_API_KEY_PROVIDER_ID,
  ORCAROUTER_PKCE_PROVIDER_ID,
  isRunningInElectron,
  validateCustomRequestHeaders,
  type CustomRequestHeaderInput
} from '@prompt-optimizer/core'
import {
  NModal,
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
import OrcaRouterAuthPanel from './OrcaRouterAuthPanel.vue'
import ExternalLinkIcon from './icons/ExternalLinkIcon.vue'
import ThemedTooltip from './common/ThemedTooltip.vue'
import type { TextModelManager } from '../composables/model/useTextModelManager'
import { resolveTextConnectionFieldLabel } from '../utils/model-connection-label'
import { getProviderDisplayName } from '../utils/provider-display'

const { show } = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:show', 'saved'])

const { t } = useI18n()
const toast = useToast()
const dialog = useDialog()
const manager = inject<TextModelManager>('textModelManager')
if (!manager) {
  throw new Error('Text model manager not provided')
}

const modalTitle = manager.modalTitle
const form = manager.form
const formReady = manager.formReady
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

interface CustomHeaderRow {
  key: string
  value: string
}

const showCustomHeaders = computed(() => currentProviderType.value === 'openai-compatible')

/**
 * OrcaRouter carries its own credential UI because it offers two explicit
 * authentication choices. Everything else about the provider is ordinary, so
 * the generic apiKey/baseURL rows stay for every other provider.
 */
const isOrcaRouterProvider = computed(() =>
  currentProviderType.value === ORCAROUTER_API_KEY_PROVIDER_ID ||
  currentProviderType.value === ORCAROUTER_PKCE_PROVIDER_ID
)

const isOrcaRouterOAuthProvider = computed(
  () => currentProviderType.value === ORCAROUTER_PKCE_PROVIDER_ID
)

// Only the credential row is replaced for OrcaRouter — the api URL row stays,
// so a self-hosted relay can still be pointed at explicitly.
const connectionFieldsWithoutOrcaCredential = computed(() =>
  isOrcaRouterProvider.value
    ? connectionFields.value.filter((field) => field.name !== 'apiKey')
    : connectionFields.value
)

const onOrcaRouterConnected = () => {
  // The panel already pushed the key into the form; nothing else to sync.
}

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

const handleUpdateShow = async (value: boolean) => {
  emit('update:show', value)

  // 只有在明确关闭时才重置表单状态
  if (!value) {
    // 等待父组件处理状态变化后再重置表单
    await nextTick()
    manager.resetFormState()
  }
}

const handleSubmit = async () => {
  try {
    const id = await manager.saveForm()
    emit('saved', id || undefined)
    handleUpdateShow(false)
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
          toast.error(translated)
          return
        }
      } catch {
        // fall back
      }
    }

    toast.error(rawError || fallback)
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
</script>

<style scoped>
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
