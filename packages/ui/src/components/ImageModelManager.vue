<template>
  <div class="image-model-list">
    <!-- 空状态 -->
    <NEmpty v-if="configs.length === 0" :description="t('image.model.empty')">
      <template #extra>
        <NButton type="primary" @click="openAddModal">{{ t('image.model.addFirst') }}</NButton>
      </template>
    </NEmpty>

    <!-- Presentation changes do not recreate the manager or its test results. -->
    <div v-else-if="isCompact" class="image-model-mobile-list">
      <NInput v-model:value="searchQuery" :placeholder="t('common.search')" :aria-label="t('common.search')" clearable />
      <NEmpty v-if="filteredConfigs.length === 0" :description="t('common.noContent')" />
      <MobileModelRow
        v-for="config in filteredConfigs"
        :key="config.id"
        :title="config.name || config.id"
        :subtitle="`${providerDisplayName(config)} · ${config.model?.name || config.modelId}`"
        :enabled="config.enabled"
        :testing="isTestingConnectionFor(config.id)"
        :test-disabled="isTestingConnectionFor(config.id)"
        :test-label="t('common.test')"
        :menu-options="mobileActions(config)"
        @edit="editConfig(config.id)"
        @test="testConnection(config.id)"
        @action="handleMobileAction($event, config)"
      >
        <div class="image-model-mobile-capabilities">
          <NText v-if="config.model?.capabilities?.text2image" depth="3">{{ t('image.capability.text2image') }}</NText>
          <NText v-if="config.model?.capabilities?.image2image" depth="3">{{ t('image.capability.image2image') }}</NText>
          <NText v-if="config.provider?.corsRestricted && !isElectronEnv" type="warning">{{ t('modelManager.corsRestrictedTag') }}</NText>
        </div>
        <template v-if="testResults[config.id]" #test-result>
          <div class="image-model-mobile-result" role="status">
            <AppPreviewImage
              v-if="testResults[config.id]?.success && testResults[config.id]?.image"
              :src="getPreviewImageSrc(config.id) || ''"
              width="48"
              height="48"
              object-fit="cover"
              :preview-disabled="false"
              :alt="t('image.connection.testImagePreview')"
            />
            <NText :type="testResults[config.id].success ? 'success' : 'error'">
              {{ t(testResults[config.id].success ? 'image.connection.testSuccess' : 'image.connection.testError') }}
            </NText>
          </div>
        </template>
      </MobileModelRow>
    </div>

    <!-- Desktop model list retains its existing presentation. -->
    <NSpace v-else vertical :size="12" class="image-model-stack">
      <NCard
        v-for="config in configs"
        :key="config.id"
        size="small"
        hoverable
        class="image-model-card"
        :style="{
          opacity: config.enabled ? 1 : 0.6
        }"
      >
        <template #header>
          <NSpace justify="space-between" align="center">
            <NSpace vertical :size="4" class="image-model-heading">
              <!-- 配置名称行 -->
              <NSpace align="center" :size="8">
                <NText strong>{{ config.name || config.id }}</NText>
                <NTag
                  v-if="!config.enabled"
                  type="warning"
                  size="small"
                  round
                  :bordered="false"
                >
                  {{ t('modelManager.disabled') }}
                </NTag>
              </NSpace>
              <!-- 标签行：Provider、Model、能力标签合并 -->
              <NSpace :size="6" class="image-model-tags">
                <NTag size="small" type="default" round :bordered="false">
                  {{ providerDisplayName(config) }}
                </NTag>
                <NTag size="small" type="info" round :bordered="false">
                  {{ config.model?.name || config.modelId }}
                </NTag>
                <NTag
                  v-if="config.provider?.corsRestricted && !isElectronEnv"
                  size="small"
                  type="error"
                  round
                  :bordered="false"
                >
                  {{ t('modelManager.corsRestrictedTag') }}
                </NTag>
                <!-- 能力标签移到这里 -->
                <NTag v-if="config.model?.capabilities?.text2image" size="small" type="success" round :bordered="false">
                  {{ t('image.capability.text2image') }}
                </NTag>
                <NTag v-if="config.model?.capabilities?.image2image" size="small" type="info" round :bordered="false">
                  {{ t('image.capability.image2image') }}
                </NTag>
              </NSpace>
            </NSpace>
          </NSpace>
        </template>
        
        <template #header-extra>
          <NSpace @click.stop :size="4" class="image-model-actions">
            <NButton
              @click="testConnection(config.id)"
              size="small"
              quaternary
              :disabled="isTestingConnectionFor(config.id)"
              :loading="isTestingConnectionFor(config.id)"
            >
              <template #icon>
                <UiLink />
              </template>
              <span class="hidden md:inline">{{ t('modelManager.testConnection') }}</span>
            </NButton>

            <!-- 测试结果缩略图 -->
            <AppPreviewImage
              v-if="testResults[config.id]?.success && testResults[config.id]?.image"
              :src="getPreviewImageSrc(config.id) || ''"
              width="24"
              height="24"
              object-fit="cover"
              :style="{ borderRadius: '4px', border: '1px solid var(--n-border-color)' }"
              :preview-disabled="false"
              :alt="t('image.connection.testImagePreview')"
            />

            <NButton
              @click="editConfig(config.id)"
              size="small"
              quaternary
            >
              <template #icon>
                <UiSquarePen />
              </template>
              <span class="hidden md:inline">{{ t('modelManager.editModel') }}</span>
            </NButton>

            <NButton
              @click="cloneConfig(config.id)"
              size="small"
              quaternary
            >
              <template #icon>
                <UiCopy />
              </template>
              <span class="hidden md:inline">{{ t('modelManager.cloneModel') }}</span>
            </NButton>

            <NButton
              @click="toggleConfig(config)"
              size="small"
              :type="config.enabled ? 'warning' : 'success'"
              quaternary
            >
              <template #icon>
                <UiPowerOff v-if="config.enabled" />
                <UiPower v-else />
              </template>
              <span class="hidden md:inline">{{ config.enabled ? t('common.disable') : t('common.enable') }}</span>
            </NButton>

            <NButton
              @click="deleteConfig(config.id)"
              size="small"
              type="error"
              quaternary
            >
              <template #icon>
                <UiTrash2 />
              </template>
              <span class="hidden md:inline">{{ t('common.delete') }}</span>
            </NButton>
          </NSpace>
        </template>
      </NCard>
    </NSpace>
  </div>
</template>

<script setup lang="ts">
import { Link as UiLink, SquarePen as UiSquarePen, Copy as UiCopy, PowerOff as UiPowerOff, Power as UiPower, Trash2 as UiTrash2 } from '@lucide/vue'
import { ref, onMounted, inject, h, computed } from 'vue'

import { useI18n } from 'vue-i18n'
import {
  NSpace, NCard, NText, NTag, NButton, NEmpty, NInput, useDialog
} from 'naive-ui'
import { useImageModelManager } from '../composables/model/useImageModelManager'
import { useConfirmDialog } from '../composables/ui/useConfirmDialog'
import { useToast } from '../composables/ui/useToast'
import { getI18nErrorMessage } from '../utils/error'
import { isRunningInElectron, type IImageService, type ImageModel } from '@prompt-optimizer/core'
import { getProviderDisplayName } from '../utils/provider-display'
import AppPreviewImage from './media/AppPreviewImage.vue'
import MobileModelRow from './common/MobileModelRow.vue'
import { useWorkspaceLayout } from '../composables/ui/useWorkspaceLayout'

const { t } = useI18n()
const { isCompact } = useWorkspaceLayout()
const toast = useToast()
const dialog = useDialog()
const confirmDialog = useConfirmDialog()
const isElectronEnv = isRunningInElectron()

// 定义事件
const emit = defineEmits(['add', 'edit', 'clone'])

// 使用 composable
const {
  configs,
  initialize,
  loadConfigs,
  updateConfig,
  deleteConfig: deleteConfigFromManager
} = useImageModelManager()

// 注入依赖
const imageService = inject<IImageService>('imageService')
if (!imageService) {
  throw new Error('[ImageModelManager] Missing required dependency: imageService')
}

// 状态管理
const testingConnections = ref<Record<string, boolean>>({})
const testResults = ref<Record<string, {
  success: boolean
  image?: {
    url?: string
    b64?: string
    mimeType?: string
  }
  testType: 'text2image' | 'image2image'
}>>({})

const isTestingConnectionFor = (configId: string) => !!testingConnections.value[configId]
const providerDisplayName = (config: { provider?: { id?: string; name?: string }; providerId?: string }) =>
  getProviderDisplayName(config.provider || { id: config.providerId }, t)

const searchQuery = ref('')
const filteredConfigs = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  if (!query) return configs.value
  return configs.value.filter(config => [config.name, config.id, config.modelId, config.model?.name, providerDisplayName(config)]
    .some(value => value?.toLocaleLowerCase().includes(query)))
})

const mobileActions = (config: { enabled: boolean }) => [
  { key: 'clone', label: t('modelManager.cloneModel') },
  { key: 'toggle', label: t(config.enabled ? 'common.disable' : 'common.enable') },
  { key: 'delete', label: t('common.delete') },
]

const handleMobileAction = (action: string, config: { id: string; enabled: boolean }) => {
  if (action === 'clone') cloneConfig(config.id)
  else if (action === 'toggle') void toggleConfig(config)
  else if (action === 'delete') void deleteConfig(config.id)
}

// 辅助函数：根据模型能力选择测试类型
const selectTestType = (model: ImageModel): 'text2image' | 'image2image' => {
  const { text2image, image2image } = model.capabilities

  if (text2image && !image2image) {
    return 'text2image'  // 只支持文生图
  }

  if (!text2image && image2image) {
    return 'image2image' // 只支持图生图
  }

  if (text2image && image2image) {
    return 'text2image'  // 两种都支持，优先文生图
  }

  throw new Error('The model does not support image generation')
}

const getPreviewImageSrc = (configId: string): string | null => {
  const img = testResults.value[configId]?.image
  if (!img) return null
  if (img.url) return img.url
  const b64 = img.b64
  if (!b64) return null
  if (b64.startsWith('data:')) return b64
  return `data:image/png;base64,${b64}`
}

// 操作方法
const openAddModal = () => {
  emit('add')
}

const editConfig = (configId: string) => {
  emit('edit', configId)
}

const cloneConfig = (configId: string) => {
  const source = configs.value.find(c => c.id === configId)
  if (!source) return

  try {
    const cloned = {
      ...JSON.parse(JSON.stringify(source)),
      id: '',
      name: `${source.name || source.id} (Copy)`
    }
    emit('clone', cloned)
  } catch (error) {
    console.error('Failed to clone model config:', error)
    toast.error(t('modelManager.cloneFailed'))
  }
}

const testConnection = async (configId: string) => {
  if (isTestingConnectionFor(configId)) return

  const config = configs.value.find(c => c.id === configId)
  if (!config) return

  const runTest = async () => {
    try {
      testingConnections.value[configId] = true

      // 清除之前的测试结果
      delete testResults.value[configId]

      if (!config) throw new Error('Config not found')

      // 获取选中的模型信息
      if (!config.model) {
        throw new Error('The selected model could not be found')
      }

      // 根据模型能力确定测试类型
      const testType = selectTestType(config.model)

      // 通过统一服务执行测试（Electron 下经 IPC 走主进程；Web 下本地执行）
      const result = await imageService.testConnection(config)

      // 测试成功
      testResults.value[configId] = {
        success: true,
        image: result.images[0],
        testType
      }

      toast.success(t('image.connection.testSuccess'))

    } catch (error) {
      console.error('Connection test failed:', error)

      // 记录失败结果
      testResults.value[configId] = {
        success: false,
        testType: 'text2image' // 默认值
      }

      const detail = getI18nErrorMessage(error, t('image.connection.testError'))
      if (detail === t('image.connection.testError')) {
        toast.error(detail)
      } else {
        toast.error(`${t('image.connection.testError')}: ${detail}`)
      }
    } finally {
      delete testingConnections.value[configId]
    }
  }

  if (!isRunningInElectron()) {
    if (config?.provider?.corsRestricted) {
      dialog.warning({
        title: t('modelManager.corsRestrictedTag'),
        content: () => h('div', { style: 'white-space: pre-line;' }, t('modelManager.corsRestrictedConfirm', { provider: providerDisplayName(config) })),
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

const toggleConfig = async (config: { id: string; enabled: boolean }) => {
  try {
    await updateConfig(config.id, { enabled: !config.enabled })
    await loadConfigs()
    toast.success(config.enabled ? t('modelManager.disableSuccess') : t('modelManager.enableSuccess'))
  } catch (error) {
    console.error('[ImageModelManager] Failed to toggle model status:', error)
    toast.error(t('modelManager.toggleFailed', { error: getI18nErrorMessage(error, t('common.error')) }))
  }
}

const deleteConfig = async (configId: string) => {
  const confirmed = await confirmDialog.warning({
    title: t('common.warning'),
    content: t('modelManager.deleteConfirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
  })
  if (!confirmed) return

  try {
    await deleteConfigFromManager(configId)
    await loadConfigs()
    toast.success(t('modelManager.deleteSuccess'))
  } catch (error) {
    console.error('[ImageModelManager] Failed to delete model:', error)
    toast.error(t('modelManager.deleteFailed', { error: getI18nErrorMessage(error, t('common.error')) }))
  }
}

// 初始化
onMounted(async () => {
  try {
    await initialize()
  } catch (error) {
    console.error('[ImageModelManager] Failed to initialize:', error)
  }
})

// 暴露给父组件的刷新方法
defineExpose({
  refresh: async () => {
    try {
      await loadConfigs()
    } catch {
      // 静默处理错误
    }
  }
})
</script>

<style scoped>
.image-model-list {
  width: 100%;
}

.image-model-mobile-list {
  display: grid;
  gap: 10px;
}

.image-model-mobile-capabilities,
.image-model-mobile-result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  font-size: 12px;
}

.image-model-mobile-result {
  overflow-wrap: anywhere;
}

.image-model-stack {
  width: 100%;
}

.image-model-card {
   border-radius: 16px;
}

.image-model-card :deep(.n-card-header) {
  padding-bottom: 10px;
}

.image-model-card :deep(.n-card__content) {
  padding-top: 0;
}

.image-model-heading,
.image-model-tags {
  max-width: 100%;
}

.image-model-tags {
  flex-wrap: wrap;
}

.image-model-actions {
  align-items: center;
  flex-wrap: nowrap;
}

/* 文本截断样式 */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
