<template>
  <div class="image-model-list">
    <!-- 空状态 -->
    <NEmpty v-if="configs.length === 0" :description="t('image.model.empty')">
      <template #extra>
        <NButton type="primary" @click="openAddModal">{{ t('image.model.addFirst') }}</NButton>
      </template>
    </NEmpty>

    <!-- 模型列表 -->
    <NSpace v-else vertical :size="12">
      <NCard
        v-for="config in configs"
        :key="config.id"
        hoverable
        :style="{
          opacity: config.enabled ? 1 : 0.6
        }"
      >
        <template #header>
          <NSpace justify="space-between" align="center">
            <NSpace vertical :size="2">
              <!-- 配置名称行 -->
              <NSpace align="center">
                <NText strong>{{ config.name || config.id }}</NText>
                <NTag
                  v-if="!config.enabled"
                  type="warning"
                  size="small"
                >
                  {{ t('modelManager.disabled') }}
                </NTag>
              </NSpace>
              <!-- 标签行：Provider、Model、能力标签合并 -->
              <NSpace :size="6">
                <NTag size="small" type="info" :bordered="false">
                  {{ config.provider?.name || config.providerId }}
                </NTag>
                <NTag size="small" type="primary" :bordered="false">
                  {{ config.model?.name || config.modelId }}
                </NTag>
                <!-- 能力标签移到这里 -->
                <NTag v-if="config.model?.capabilities?.text2image" size="small" type="success" :bordered="false">
                  {{ t('image.capability.text2image') }}
                </NTag>
                <NTag v-if="config.model?.capabilities?.image2image" size="small" type="info" :bordered="false">
                  {{ t('image.capability.image2image') }}
                </NTag>
              </NSpace>
            </NSpace>
          </NSpace>
        </template>
        
        <template #header-extra>
          <NSpace @click.stop>
            <NButton
              @click="testConnection(config.id)"
              size="small"
              quaternary
              :disabled="isTestingConnectionFor(config.id)"
              :loading="isTestingConnectionFor(config.id)"
            >
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              </template>
              <span class="hidden md:inline">{{ t('modelManager.testConnection') }}</span>
            </NButton>

            <!-- 测试结果缩略图 -->
            <NImage
              v-if="testResults[config.id]?.success && testResults[config.id]?.image"
              :src="getPreviewImageSrc(config.id) || ''"
              width="24"
              height="24"
              object-fit="cover"
              :style="{ borderRadius: '4px', border: '1px solid #d9d9d9' }"
              :preview-disabled="false"
              :alt="t('image.connection.testImagePreview')"
            />

            <NButton
              @click="editConfig(config.id)"
              size="small"
              quaternary
            >
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
              </template>
              <span class="hidden md:inline">{{ t('modelManager.editModel') }}</span>
            </NButton>

            <NButton
              @click="toggleConfig(config)"
              size="small"
              :type="config.enabled ? 'warning' : 'success'"
              quaternary
            >
              <template #icon>
                <svg v-if="config.enabled" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                  <path d="M12 6v.343"/>
                  <path d="M18.218 18.218A7 7 0 0 1 5 15V9a7 7 0 0 1 .782-3.218"/>
                  <path d="M19 13.343V9A7 7 0 0 0 8.56 2.902"/>
                  <path d="M22 22 2 2"/>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                  <rect x="5" y="2" width="14" height="20" rx="7"/>
                  <path d="M12 6v4"/>
                </svg>
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
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
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
import { ref, onMounted, inject } from 'vue'

import { useI18n } from 'vue-i18n'
import {
  NSpace, NCard, NText, NTag, NButton, NEmpty, NImage
} from 'naive-ui'
import { useImageModelManager } from '../composables/model/useImageModelManager'
import { useToast } from '../composables/ui/useToast'
import { getI18nErrorMessage } from '../utils/error'
import type { IImageService, ImageModel } from '@prompt-optimizer/core'

const { t } = useI18n()
const toast = useToast()

// 定义事件
const emit = defineEmits(['add', 'edit'])

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

  throw new Error('模型不支持任何图像生成功能')
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

const testConnection = async (configId: string) => {
  if (isTestingConnectionFor(configId)) return

  try {
    testingConnections.value[configId] = true

    // 清除之前的测试结果
    delete testResults.value[configId]

    const config = configs.value.find(c => c.id === configId)
    if (!config) throw new Error('Config not found')

    // 获取选中的模型信息
    if (!config.model) {
      throw new Error('选中的模型未找到')
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

const toggleConfig = async (config: { id: string; enabled: boolean }) => {
  try {
    await updateConfig(config.id, { enabled: !config.enabled })
    await loadConfigs()
    toast.success(config.enabled ? t('modelManager.disableSuccess') : t('modelManager.enableSuccess'))
  } catch (error) {
    console.error('切换模型状态失败:', error)
    toast.error(t('modelManager.toggleFailed', { error: getI18nErrorMessage(error, 'Unknown error') }))
  }
}

const deleteConfig = async (configId: string) => {
  if (confirm(t('modelManager.deleteConfirm'))) {
    try {
      await deleteConfigFromManager(configId)
      await loadConfigs()
      toast.success(t('modelManager.deleteSuccess'))
    } catch (error) {
      console.error('删除模型失败:', error)
      toast.error(t('modelManager.deleteFailed', { error: getI18nErrorMessage(error, 'Unknown error') }))
    }
  }
}

// 初始化
onMounted(async () => {
  try {
    await initialize()
  } catch (error) {
    console.error('初始化图像模型管理器失败:', error)
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

/* 文本截断样式 */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
