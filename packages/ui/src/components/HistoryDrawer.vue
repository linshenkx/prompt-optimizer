<template>
  <NModal
    :show="show"
    preset="card"
    :style="{ width: '90vw', maxWidth: '1200px', maxHeight: '85vh' }"
    :title="t('history.title')"
    size="large"
    :bordered="false"
    :segmented="true"
    @update:show="(value: boolean) => !value && close()"
  >
    <template #header-extra>
      <NSpace align="center" :size="12">
        <NInput
          v-model:value="searchQuery"
          :placeholder="t('history.searchPlaceholder')"
          size="small"
          style="width: 200px"
          clearable
        >
          <template #prefix>
            <span style="font-size: 14px;">🔍</span>
          </template>
        </NInput>
        <NButton
          v-if="sortedHistory && sortedHistory.length > 0"
          @click="handleClear"
          size="small"
          quaternary
        >
          {{ t('common.clear') }}
        </NButton>
      </NSpace>
    </template>

    <NScrollbar style="max-height: 65vh;">
      <NSpace vertical :size="16" v-if="sortedHistory && sortedHistory.length > 0">
        <NCard
          v-for="chain in filteredHistory"
          :key="chain.chainId"
          hoverable
        >
          <template #header>
            <NSpace justify="space-between" align="center">
              <NSpace align="center" :size="8">
                <NText depth="3" style="font-size: 14px;">
                  {{ t('common.createdAt') }} {{ formatDate(chain.rootRecord.timestamp) }}
                </NText>
                <!-- 功能模式标签 -->
                <NTag
                  :type="getFunctionModeTagType(chain.rootRecord.type)"
                  size="small"
                >
                  {{ getFunctionModeLabel(chain.rootRecord.type) }}
                </NTag>
                <!-- 优化模式标签 -->
                <NTag
                  v-if="chain.rootRecord.type === 'optimize'"
                  type="info"
                  size="small"
                >
                  {{ t('common.system') }}
                </NTag>
                <NTag
                  v-if="chain.rootRecord.type === 'userOptimize'"
                  type="success"
                  size="small"
                >
                  {{ t('common.user') }}
                </NTag>
                <!-- 上下文模式优化标签 -->
                <NTag
                  v-if="isMessageOptimizationType(chain.rootRecord.type)"
                  type="warning"
                  size="small"
                >
                  {{ t('contextMode.optimizationMode.message') }}
                </NTag>
                <NTag
                  v-if="chain.rootRecord.type === 'contextUserOptimize'"
                  type="success"
                  size="small"
                >
                  {{ t('contextMode.optimizationMode.variable') }}
                </NTag>
                <!-- 图像模式优化类型标签 -->
                <NTag
                  v-if="chain.rootRecord.type === 'text2imageOptimize'"
                  type="success"
                  size="small"
                >
                  {{ t('image.capability.text2image') }}
                </NTag>
                <NTag
                  v-if="chain.rootRecord.type === 'image2imageOptimize'"
                  type="warning"
                  size="small"
                >
                  {{ t('image.capability.image2image') }}
                </NTag>
              </NSpace>
              <NButton
                @click="deleteChain(chain.chainId)"
                size="small"
                type="error"
                quaternary
                :title="$t('common.delete')"
              >
                {{ $t('common.delete') }}
              </NButton>
            </NSpace>
          </template>
          
          <NText style="font-size: 14px; word-break: break-all;">
            {{ chain.rootRecord.originalPrompt }}
          </NText>

          
          <!-- 版本列表 -->
          <NDivider style="margin: 16px 0;" />
          <NSpace vertical :size="12">
            <NCollapse
              v-for="record in chain.versions.slice().reverse()"
              :key="record.id"
              :default-expanded-names="expandedVersions[record.id] ? [record.id] : []"
              @update:expanded-names="(names: Array<string | number> | null) => expandedVersions[record.id] = Array.isArray(names) && names.includes(record.id)"
            >
              <NCollapseItem
                :name="record.id"
              >
                <template #header>
                  <NSpace align="center" :size="12" style="width: 100%;">
                    <NText strong style="font-size: 14px;">
                      {{ t('common.version', { version: record.version }) }}
                    </NText>
                    <NText depth="3" style="font-size: 12px;">
                      {{ formatDate(record.timestamp) }}
                    </NText>
                    <NText depth="3" style="font-size: 12px;">
                      {{ record.modelName || record.modelKey }}
                    </NText>
                    <NText 
                      v-if="record.type === 'iterate' && record.iterationNote" 
                      depth="3" 
                      style="font-size: 12px;"
                    >
                      - {{ truncateText(record.iterationNote, 30) }}
                    </NText>
                  </NSpace>
                </template>
                
                <template #header-extra>
                  <NSpace @click.stop>
                    <NTag
                      v-if="record.type === 'iterate'"
                      size="small"
                      type="warning"
                    >
                      {{ t('common.iterate') }}
                    </NTag>
                    <NButton
                      @click="reuse(record, chain)"
                      size="small"
                      quaternary
                    >
                      {{ t('common.use') }}
                    </NButton>
                  </NSpace>
                </template>

                <NSpace vertical :size="12">
                  <div v-if="record.iterationNote">
                    <NText strong style="font-size: 12px;">{{ $t('history.iterationNote') }}:</NText>
                    <NText depth="3" style="font-size: 12px; margin-left: 8px;">{{ record.iterationNote }}</NText>
                  </div>
                  
                  <div>
                    <NText depth="3" style="font-size: 12px;">{{ $t('history.optimizedPrompt') }}:</NText>
                    <NText style="font-size: 14px; white-space: pre-wrap; margin-top: 8px; display: block;">
                      {{ record.optimizedPrompt }}
                    </NText>
                  </div>
                  
                  <div style="display: flex; justify-content: flex-end;">
                    <NButton
                      @click="reuse(record, chain)"
                      size="small"
                      type="primary"
                      quaternary
                    >
                      {{ $t('history.useThisVersion') }}
                    </NButton>
                  </div>
                </NSpace>
              </NCollapseItem>
            </NCollapse>
          </NSpace>
        </NCard>
      </NSpace>
      
      <NEmpty v-else :description="$t('history.noHistory')">
        <template #icon>
          <span style="font-size: 48px;">📜</span>
        </template>
      </NEmpty>
    </NScrollbar>
  </NModal>
</template>

<script setup lang="ts">
import { ref, watch, computed, type PropType } from 'vue'

import { useI18n } from 'vue-i18n'
import {
  NModal, NScrollbar, NSpace, NCard, NText, NTag, NButton, 
  NDivider, NCollapse, NCollapseItem, NEmpty, NInput
} from 'naive-ui'
import type { PromptRecord, PromptRecordChain } from '@prompt-optimizer/core'
import { useToast } from '../composables/ui/useToast'

const props = defineProps({
  show: Boolean,
  history: {
    type: Array as PropType<PromptRecordChain[]>,
    default: () => []
  }
})

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'reuse', context: {
    record: PromptRecord,
    chainId: string,
    rootPrompt: string,
    chain: PromptRecordChain
  }): void
  (e: 'clear'): void
  (e: 'deleteChain', chainId: string): void
}>()

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
const _toast = useToast()
const expandedVersions = ref<Record<string, boolean>>({})
const searchQuery = ref('')

// --- Close Logic ---
const close = () => {
  emit('update:show', false)
}

// 修改排序后的历史记录计算属性，使用props.history而不是直接调用historyManager.getAllChains()
// 按照最后修改时间排序，与getAllChains()保持一致
const sortedHistory = computed(() => {
  return props.history.sort((a, b) => b.currentRecord.timestamp - a.currentRecord.timestamp)
})

const filteredHistory = computed(() => {
  if (!searchQuery.value) return sortedHistory.value
  
  const query = searchQuery.value.toLowerCase()
  return sortedHistory.value.filter(chain => {
    // 匹配原始提示词
    if (chain.rootRecord.originalPrompt.toLowerCase().includes(query)) return true
    
    // 匹配版本中的内容
    return chain.versions.some(record => {
      if (record.optimizedPrompt.toLowerCase().includes(query)) return true
      if (record.iterationNote && record.iterationNote.toLowerCase().includes(query)) return true
      return false
    })
  })
})

// 切换版本展开/收起状态
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
const _toggleVersion = (recordId: string) => {
  expandedVersions.value = {
    ...expandedVersions.value,
    [recordId]: !expandedVersions.value[recordId]
  }
}

// 清空历史记录
const handleClear = async () => {
  if (confirm(t('history.confirmClear'))) {
    emit('clear')
    // 不需要强制刷新，因为现在使用props.history
  }
}

// 监听显示状态变化
watch(() => props.show, (newShow) => {
  if (!newShow) {
    // 关闭时重置所有展开状态和搜索词
    expandedVersions.value = {}
    searchQuery.value = ''
  }
})

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}

const reuse = (record: PromptRecord, chain: PromptRecordChain) => {
  emit('reuse', {
    record,
    chainId: chain.chainId,
    rootPrompt: chain.rootRecord.originalPrompt,
    chain
  })
  emit('update:show', false)
}

// 添加文本截断函数
const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...'
}

const isMessageOptimizationType = (recordType: string) => {
  return recordType === 'conversationMessageOptimize' || recordType === 'contextSystemOptimize'
}

// 获取功能模式标签类型
const getFunctionModeTagType = (recordType: string) => {
  if (recordType.includes('image')) {
    return 'warning'
  } else if (recordType.includes('context')) {
    return 'primary'
  } else {
    return 'default'
  }
}

// 获取功能模式标签文本
const getFunctionModeLabel = (recordType: string) => {
  // 图像模式类型
  const imageTypes = ['imageOptimize', 'contextImageOptimize', 'imageIterate', 'text2imageOptimize', 'image2imageOptimize']
  // 上下文模式类型（包含新旧类型名以支持向后兼容）
  const contextTypes = ['conversationMessageOptimize', 'contextSystemOptimize', 'contextUserOptimize', 'contextIterate']

  if (imageTypes.includes(recordType)) {
    return t('nav.imageMode')
  } else if (contextTypes.includes(recordType)) {
    return t('nav.contextMode')
  } else {
    return t('nav.basicMode')
  }
}

// 添加删除单条记录的方法
const deleteChain = (chainId: string) => {
  if (confirm(t('history.confirmDeleteChain'))) {
    emit('deleteChain', chainId)
    // 不需要强制刷新，因为现在使用props.history
  }
}
</script>

<style scoped>
</style> 
