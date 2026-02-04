<template>
  <NModal
    :show="show"
    preset="card"
    :title="isEditing ? t('modelManager.editModel') : t('modelManager.addImageModel')"
    :style="{ width: '80vw', maxWidth: '820px' }"
    size="large"
    :bordered="false"
    :segmented="true"
    @update:show="(value) => !value && close()"
  >
    <form @submit.prevent="save">
        <NForm label-placement="left" label-width="auto" size="small">
          <!-- 基本信息区域 -->
          <NFormItem :label="t('image.config.displayName.label')">
            <NInput v-model:value="configForm.name" :placeholder="t('image.config.displayName.placeholder')" required />
          </NFormItem>

          <NFormItem :label="t('image.config.enabledStatus.label')">
            <NCheckbox v-model:checked="configForm.enabled"></NCheckbox>
          </NFormItem>

          <!-- 提供商配置区域 -->
          <NDivider style="margin: 12px 0 8px 0;" />
          <NH4 style="margin: 0 0 12px 0; font-size: 14px;">{{ t('image.provider.section') }}</NH4>

          <NFormItem :label="t('image.provider.label')">
            <NSelect
              v-model:value="configForm.providerId"
              :options="providerOptions"
              :placeholder="t('image.provider.placeholder')"
              :loading="isLoadingProviders"
              @update:value="onProviderChange"
              required
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
          <NDivider style="margin: 12px 0 8px 0;" />
          <NH4 style="margin: 0 0 12px 0; font-size: 14px;">{{ t('image.model.section') }}</NH4>

          <NFormItem :label="t('image.model.label')">
            <NSpace align="center" style="width: 100%;">
              <NSelect
                v-model:value="configForm.modelId"
                :options="modelOptions"
                :placeholder="t('image.model.placeholder')"
                :loading="isLoadingModels"
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

              <NTooltip :disabled="canRefreshModels" :show-arrow="false">
                <template #trigger>
                  <NButton
                    @click="refreshModels"
                    :loading="isLoadingModels"
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
                </template>
                {{ refreshButtonTooltip }}
              </NTooltip>
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
          <NDivider style="margin: 12px 0 8px 0;" />
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
          <NImage
            v-if="testResult?.image && connectionStatus?.type === 'success'"
            :src="testResult.image.url || (testResult.image.b64?.startsWith('data:') ? testResult.image.b64 : `data:image/png;base64,${testResult.image.b64}`)"
            width="32"
            height="32"
            object-fit="cover"
            :style="{ borderRadius: '4px', border: '1px solid #d9d9d9' }"
            :preview-disabled="false"
            :alt="t('image.connection.testImagePreview')"
          />
        </NSpace>

        <!-- 右侧：取消/保存按钮 -->
        <NSpace>
          <NButton @click="close">{{ t('common.cancel') }}</NButton>
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
  </NModal>
</template>

<script setup lang="ts">
import { computed, watch, nextTick, h } from 'vue'

import { useI18n } from 'vue-i18n'
import {
  NModal, NSpace, NInput, NInputNumber,
  NCheckbox, NSelect, NButton, NTag, NTooltip, NText,
  NDivider, NH4, NForm, NFormItem, NImage, useDialog
} from 'naive-ui'
import { useImageModelManager } from '../composables/model/useImageModelManager'
import { useToast } from '../composables/ui/useToast'
import { isRunningInElectron, type ImageModelConfig } from '@prompt-optimizer/core'
import ModelAdvancedSection from './ModelAdvancedSection.vue'
import ExternalLinkIcon from './icons/ExternalLinkIcon.vue'


const { t } = useI18n()
const toast = useToast()
const dialog = useDialog()

// Props
const props = defineProps<{
  show: boolean
  configId?: string
}>()

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

// 方法
const close = () => {
  emit('update:show', false)
  resetFormData()
}

const resetFormData = () => {
  configForm.value = {
    id: '',
    name: '',
    providerId: '',
    modelId: '',
    enabled: true,
    connectionConfig: {},
    paramOverrides: {}
  }
  connectionStatus.value = null
  testResult.value = null
  modelLoadingStatus.value = null
}

const onProviderChange = async (providerId: string, autoSelectFirstModel?: boolean) => {
  await handleProviderChange(providerId, autoSelectFirstModel)
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
  if (!canSave.value) return

  try {
    await saveConfig()
    toast.success(isEditing.value ? t('image.config.updateSuccess') : t('image.config.createSuccess'))
    emit('saved')
    close()
  } catch (_error) {
    console.error('保存配置失败:', _error)
    toast.error(t('image.config.saveFailed'))
  }
}

// 监听 props 变化
watch(() => props.show, async (newShow) => {
  if (newShow) {
    // 打开时准备数据
    try {
      // 确保提供商数据最新（每次打开都刷新）
      await loadProviders()
      await loadConfigs()
      if (props.configId) {
        const existing = configs.value.find(c => c.id === props.configId)
        if (existing) {
          // 先填充表单数据，确保 connectionConfig 可用
          configForm.value = JSON.parse(JSON.stringify(existing)) as ImageModelConfig
          configForm.value.paramOverrides = configForm.value.paramOverrides || {}
          selectedProviderId.value = existing.providerId
          selectedModelId.value = existing.modelId
          // 然后再调用 handleProviderChange，此时 connectionConfig 已经可用
          // 编辑模式：不自动选择第一个模型，不重置连接配置，保持已保存的数据
          await handleProviderChange(existing.providerId, {
            autoSelectFirstModel: false,
            resetOverrides: false,
            resetConnectionConfig: false
          })
          // 等待一帧以确保下拉可见
          await nextTick()
        }
      } else {
        // 新增模式：重置表单数据并自动选择第一个提供商和模型
        resetFormData()

        // 自动选择第一个提供商
        if (providers.value.length > 0) {
          const firstProvider = providers.value[0]
          await handleProviderChange(firstProvider.id)

          // 等待模型加载完成后自动选择第一个模型
          await nextTick()
          if (models.value.length > 0) {
            const firstModel = models.value[0]
            onModelChange(firstModel.id)
          }
        }
      }
    } catch (e) {
      console.error('加载配置失败:', e)
    }
  } else {
    resetFormData()
  }
})

// 单独监听 configId 变化，处理动态更新的情况
watch(() => props.configId, async (newConfigId) => {
  // 只有在弹窗已经打开的情况下才处理
  if (props.show && newConfigId) {
    try {
      await loadConfigs()
      const existing = configs.value.find(c => c.id === newConfigId)
      if (existing) {
        // 先填充表单数据，确保 connectionConfig 可用
        configForm.value = JSON.parse(JSON.stringify(existing)) as ImageModelConfig
        configForm.value.paramOverrides = configForm.value.paramOverrides || {}
        selectedProviderId.value = existing.providerId
        selectedModelId.value = existing.modelId
        // 然后再调用 handleProviderChange，此时 connectionConfig 已经可用
        // 编辑模式：不自动选择第一个模型，不重置连接配置，保持已保存的数据
        await handleProviderChange(existing.providerId, {
          autoSelectFirstModel: false,
          resetOverrides: false,
          resetConnectionConfig: false
        })
        await nextTick()
      }
    } catch (e) {
      console.error('处理 configId 变化失败:', e)
    }
  }
}, { immediate: true })
</script>

<style scoped>
/* 移除了不再使用的 CSS 类：
   - .connection-test (现在使用 NFormItem)
   - .number-input-wrapper (改为 NSpace inline)
   - .parameter-unit (简化为 inline NText)
   - .parameter-description (改为 template #feedback)
   - .provider-info (简化为 NText)
*/
</style>
