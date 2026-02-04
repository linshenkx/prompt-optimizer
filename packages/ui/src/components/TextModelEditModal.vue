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
            <NSelect
              v-model:value="form.providerId"
              :options="providerOptions"
              :loading="isLoadingProviders"
              :placeholder="t('modelManager.provider.placeholder')"
              @update:value="onProviderChange"
              required
            />
          </NFormItem>

          <NFormItem
            v-for="field in connectionFields"
            :key="field.name"
            :label="field.name === 'apiKey' ? t('modelManager.apiKey') : (field.name === 'baseURL' ? t('modelManager.apiUrl') : field.name)"
          >
            <template v-if="field.name === 'baseURL'" #label>
              <NSpace align="center" :size="4">
                <span>{{ t('modelManager.apiUrl') }}</span>
                <NText depth="3" :title="t('modelManager.apiUrlHint')" style="cursor: help;">?</NText>
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

            <template v-if="field.type === 'string'">
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

              <NTooltip :disabled="!canRefreshModelOptions" :show-arrow="false">
                <template #trigger>
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
                </template>
                {{ t('modelManager.clickToFetchModels') }}
              </NTooltip>
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
          <NButton type="primary" :loading="isSaving" @click="handleSubmit">
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
import { isRunningInElectron } from '@prompt-optimizer/core'
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
  NTooltip,
  NSpin,
  useDialog
} from 'naive-ui'
import ModelAdvancedSection from './ModelAdvancedSection.vue'
import ExternalLinkIcon from './icons/ExternalLinkIcon.vue'
import type { TextModelManager } from '../composables/model/useTextModelManager'

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
const isSaving = manager.isSaving

const isEditing = computed(() => !!manager.editingModelId.value)

// 获取当前选择的 Provider 的 API Key URL
const currentProviderApiKeyUrl = computed(() => {
  return manager.selectedProvider.value?.apiKeyUrl || null
})

const handleTestFormConnection = async () => {
  const runTest = async () => {
    await testFormConnection()
  }

  if (!isRunningInElectron()) {
    const provider = manager.selectedProvider.value
    if (provider?.corsRestricted) {
      const providerName = provider.name || provider.id || 'Unknown Provider'
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
    console.error('保存模型失败:', error)

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
