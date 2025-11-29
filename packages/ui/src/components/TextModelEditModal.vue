<template>
  <NModal
    :show="show"
    preset="card"
    :style="{ width: '90vw', maxWidth: '1000px' }"
    :title="modalTitle.value"
    size="large"
    :bordered="false"
    :segmented="true"
    @update:show="handleUpdateShow"
  >
    <form v-if="formReady" @submit.prevent="handleSubmit">
        <NForm label-placement="left" label-width="auto" size="small">
          <NFormItem v-if="!isEditing" :label="t('modelManager.modelKey')">
            <NInput
              v-model:value="form.id"
              :placeholder="t('modelManager.modelKeyPlaceholder')"
              required
            />
          </NFormItem>

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

            <template v-if="field.type === 'string'">
              <NInput
                v-model:value="form.connectionConfig[field.name]"
                :type="field.name.toLowerCase().includes('key') ? 'password' : 'text'"
                :placeholder="field.placeholder"
                :required="field.required"
                :autocomplete="field.name.toLowerCase().includes('key') ? 'new-password' : 'on'"
              />
            </template>
            <template v-else-if="field.type === 'number'">
              <NInputNumber
                v-model:value="form.connectionConfig[field.name]"
                :placeholder="field.placeholder"
                :required="field.required"
              />
            </template>
            <template v-else-if="field.type === 'boolean'">
              <NCheckbox v-model:checked="form.connectionConfig[field.name]">
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
            @click="testFormConnection"
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
import { computed, inject, nextTick } from 'vue'

import { useI18n } from 'vue-i18n'
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
  NSpin
} from 'naive-ui'
import ModelAdvancedSection from './ModelAdvancedSection.vue'
import type { TextModelManager } from '../composables/model/useTextModelManager'

const { show } = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:show', 'saved'])

const { t } = useI18n()
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
  const id = await manager.saveForm()
  emit('saved', id || undefined)
  handleUpdateShow(false)
}

const handleCancel = () => {
  handleUpdateShow(false)
}

// 处理模型变更（只在非编辑模式或用户主动切换时自动填充参数）
const handleModelChange = (modelId: string) => {
  if (isEditing.value && form.value.originalId) {
    // 编辑模式：只更新 modelId，不自动填充参数
    form.value.modelId = modelId
    form.value.defaultModel = modelId || ''
  } else {
    // 新建模式：调用 onModelChange，会自动填充默认参数
    onModelChange(modelId)
  }
}

const onProviderChange = (providerId: string) => {
  manager.selectProvider(providerId, {
    autoSelectFirstModel: !isEditing.value,
    resetOverrides: true,
    resetConnectionConfig: true
  })
}
</script>
