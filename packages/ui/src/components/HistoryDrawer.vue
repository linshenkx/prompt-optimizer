<template>
  <NModal
    :show="show"
    compact-class="history-manager--compact"
    :auto-focus="!isCompact"
    preset="card"
    :style="{ width: '90vw', maxWidth: '1200px', maxHeight: '85vh' }"
    :title="t('history.title')"
    size="large"
    :bordered="false"
    :segmented="true"
    @update:show="(value: boolean) => !value && close()"
  >
    <template v-if="!isCompact" #header-extra>
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

    <div v-if="isCompact" class="mobile-history" data-testid="mobile-history-list">
      <div class="mobile-history-filters">
        <NInput v-model:value="searchQuery" :placeholder="t('history.searchPlaceholder')" clearable :aria-label="t('common.search')" />
        <NSelect v-model:value="mobileModeFilter" :options="mobileModeOptions" :placeholder="t('workspace.switchMode')" clearable :aria-label="t('workspace.switchMode')" />
      </div>
      <div class="mobile-history-list-actions">
        <NText depth="3">{{ t('history.title') }} · {{ mobileHistory.length }}</NText>
        <NButton v-if="sortedHistory.length" quaternary size="small" @click="handleClear">{{ t('common.clear') }}</NButton>
      </div>
      <article v-for="chain in mobileHistory" :key="chain.chainId" class="mobile-history-row">
        <button class="mobile-history-open" type="button" @click="openMobileChain(chain)">
          <span class="mobile-history-row-meta">
            <strong>{{ getMobileModeLabel(chain) }}</strong>
            <span>{{ t('common.version', { version: chain.currentRecord.version }) }}</span>
          </span>
          <span class="mobile-history-summary">{{ chain.rootRecord.originalPrompt }}</span>
          <time>{{ formatDate(chain.currentRecord.timestamp) }}</time>
        </button>
        <NDropdown trigger="click" :options="[{ key: 'delete', label: t('common.delete') }]" @select="deleteChain(chain.chainId)">
          <NButton quaternary size="small" :aria-label="t('common.actions')">···</NButton>
        </NDropdown>
      </article>
      <NEmpty v-if="!mobileHistory.length" :description="t('history.noHistory')" />
    </div>
    <NScrollbar v-else style="max-height: 65vh;">
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
                <NTag
                  v-if="chain.rootRecord.type === 'multiimageOptimize'"
                  type="error"
                  size="small"
                >
                  {{ t('imageMode.multiimage') }}
                </NTag>
                <SourceAssetBadge
                  v-if="getChainSource(chain)"
                  :source="getChainSource(chain)!"
                />
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

    <!-- A separate presentation layer keeps the list mounted, including its scroll position. -->
    <NModal
      :show="show && isCompact && !!mobileChain"
      preset="card"
      compact-class="mobile-history-detail"
      :auto-focus="false"
      @update:show="(value: boolean) => !value && (mobileChainId = null)"
    >
      <template #header>
        <NButton text @click="mobileChainId = null">‹ {{ t('history.title') }}</NButton>
      </template>
      <template #header-extra>
        <NSelect v-model:value="mobileVersionId" :options="mobileVersionOptions" :aria-label="t('workspace.promptVersion')" />
      </template>
      <div v-if="mobileChain && mobileRecord" class="mobile-history-content" data-testid="mobile-history-detail">
        <div class="mobile-history-record-meta">
          <span>{{ mobileRecord.modelName || mobileRecord.modelKey }}</span>
          <time>{{ formatDate(mobileRecord.timestamp) }}</time>
        </div>
        <SourceAssetBadge v-if="getChainSource(mobileChain)" :source="getChainSource(mobileChain)!" />
        <details class="mobile-history-original">
          <summary>{{ t('promptOptimizer.originalPrompt') }}</summary>
          <pre>{{ mobileChain.rootRecord.originalPrompt }}</pre>
        </details>
        <details v-if="mobileRecord.iterationNote" class="mobile-history-original">
          <summary>{{ t('history.iterationNote') }}</summary>
          <pre>{{ mobileRecord.iterationNote }}</pre>
        </details>
        <pre class="mobile-history-body">{{ mobileRecord.optimizedPrompt }}</pre>
      </div>
      <template #footer>
        <div v-if="mobileChain && mobileRecord" class="mobile-history-restore">
          <span>{{ t('workspace.title') }} · {{ getMobileModeLabel(mobileChain, mobileRecord) }}</span>
          <NButton type="primary" @click="reuse(mobileRecord, mobileChain)">{{ t('history.useThisVersion') }}</NButton>
        </div>
      </template>
    </NModal>
  </NModal>
</template>

<script setup lang="ts">
import NModal from "./common/AdaptiveModal.vue"
import { ref, watch, computed, type PropType } from 'vue'

import { useI18n } from 'vue-i18n'
import {
   NScrollbar, NSpace, NCard, NText, NTag, NButton,
  NDivider, NCollapse, NCollapseItem, NEmpty, NInput, NSelect, NDropdown
} from 'naive-ui'
import type { PromptRecord, PromptRecordChain } from '@prompt-optimizer/core'
import { useConfirmDialog } from '../composables/ui/useConfirmDialog'
import { useToast } from '../composables/ui/useToast'
import { useWorkspaceLayout } from '../composables/ui/useWorkspaceLayout'
import SourceAssetBadge from './source/SourceAssetBadge.vue'
import { extractHistorySourceBinding } from '../utils/history-source-binding'
import { resolveSourceAssetRef } from '../utils/source-asset'

const props = defineProps({
  show: Boolean,
  history: {
    type: Array as PropType<PromptRecordChain[]>,
    default: () => []
  }
})

const { t } = useI18n()
const { isCompact } = useWorkspaceLayout()

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _toast = useToast()
const confirmDialog = useConfirmDialog()
const expandedVersions = ref<Record<string, boolean>>({})
const searchQuery = ref('')
const mobileModeFilter = ref<string | null>(null)
const mobileChainId = ref<string | null>(null)
const mobileVersionId = ref<string | null>(null)
const mobileChain = computed(() => props.history.find(chain => chain.chainId === mobileChainId.value))
const mobileRecord = computed(() => mobileChain.value?.versions.find(record => record.id === mobileVersionId.value)
  ?? mobileChain.value?.currentRecord)
const mobileVersionOptions = computed(() => (mobileChain.value?.versions ?? []).slice().reverse().map(record => ({
  label: t('common.version', { version: record.version }), value: record.id,
})))
const mobileModeOptions = computed(() => [
  { value: 'system', label: t('workspace.systemMode') },
  { value: 'user', label: t('workspace.userMode') },
  { value: 'multi', label: t('contextMode.optimizationMode.message') },
  { value: 'variable', label: t('contextMode.optimizationMode.variable') },
  { value: 'text2image', label: t('image.capability.text2image') },
  { value: 'image2image', label: t('image.capability.image2image') },
  { value: 'multiimage', label: t('imageMode.multiimage') },
])

// Match the existing restore destination, including old image records' metadata.
const getMobileMode = (chain: PromptRecordChain, record = chain.currentRecord): string => {
  const type = chain.rootRecord.type as string
  if (type === 'userOptimize') return 'user'
  if (type === 'conversationMessageOptimize') return 'multi'
  if (type === 'contextUserOptimize') return 'variable'
  if (type === 'contextSystemOptimize' || type === 'contextIterate') {
    return chain.rootRecord.metadata?.optimizationMode === 'user' ? 'variable' : 'multi'
  }
  if (type === 'multiimageOptimize') return 'multiimage'
  if (type === 'image2imageOptimize') return 'image2image'
  if (type === 'text2imageOptimize') return 'text2image'
  if (['imageOptimize', 'contextImageOptimize', 'imageIterate'].includes(type)) {
    const metadata = record.metadata ?? chain.rootRecord.metadata
    return metadata?.hasInputImage === true ? 'image2image' : 'text2image'
  }
  return type !== 'optimize' && chain.rootRecord.metadata?.optimizationMode === 'user' ? 'user' : 'system'
}
const getMobileModeLabel = (chain: PromptRecordChain, record = chain.currentRecord) =>
  mobileModeOptions.value.find(option => option.value === getMobileMode(chain, record))?.label ?? ''
const mobileHistory = computed(() => filteredHistory.value.filter(chain =>
  !mobileModeFilter.value || getMobileMode(chain) === mobileModeFilter.value))
const openMobileChain = (chain: PromptRecordChain) => {
  mobileVersionId.value = chain.currentRecord.id
  mobileChainId.value = chain.chainId
}

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _toggleVersion = (recordId: string) => {
  expandedVersions.value = {
    ...expandedVersions.value,
    [recordId]: !expandedVersions.value[recordId]
  }
}

// 清空历史记录
const handleClear = async () => {
  const confirmed = await confirmDialog.warning({
    title: t('common.warning'),
    content: t('history.confirmClear'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
  })
  if (!confirmed) return

  emit('clear')
  // 不需要强制刷新，因为现在使用props.history
}

// 监听显示状态变化
watch(() => props.show, (newShow) => {
  if (!newShow) {
    // 关闭时重置所有展开状态和搜索词
    expandedVersions.value = {}
    searchQuery.value = ''
    mobileModeFilter.value = null
    mobileChainId.value = null
    mobileVersionId.value = null
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

const getChainSource = (chain: PromptRecordChain) => {
  const source = extractHistorySourceBinding(chain.rootRecord, chain)
  return resolveSourceAssetRef(source.origin, source.assetBinding)
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
  const imageTypes = ['imageOptimize', 'contextImageOptimize', 'imageIterate', 'text2imageOptimize', 'image2imageOptimize', 'multiimageOptimize']
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
const deleteChain = async (chainId: string) => {
  const confirmed = await confirmDialog.warning({
    title: t('common.warning'),
    content: t('history.confirmDeleteChain'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
  })
  if (!confirmed) return

  emit('deleteChain', chainId)
  // 不需要强制刷新，因为现在使用props.history
}
</script>

<style scoped>
:global(.workspace-compact .history-manager--compact.adaptive-modal-page > .n-card-header),
:global(.workspace-compact .mobile-history-detail.adaptive-modal-page > .n-card-header) {
  padding: 10px 12px;
  gap: 8px;
}
:global(.workspace-compact .history-manager--compact.adaptive-modal-page > .n-card-content),
:global(.workspace-compact .mobile-history-detail.adaptive-modal-page > .n-card-content) {
  padding: 12px !important;
}
:global(.workspace-compact .mobile-history-detail.adaptive-modal-page > .n-card__footer) {
  padding: 10px 12px max(10px, env(safe-area-inset-bottom));
}
.mobile-history-filters {
  display: grid;
  gap: 8px;
}
.mobile-history-list-actions, .mobile-history-row-meta, .mobile-history-record-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.mobile-history-list-actions {
  margin: 4px 0;
}
.mobile-history-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  border-bottom: 1px solid var(--compact-border);
}
.mobile-history-open {
  appearance: none;
  border: 0;
  padding: 12px 0;
  background: transparent;
  color: inherit;
  text-align: left;
  min-width: 0;
  flex: 1;
  cursor: pointer;
  font: inherit;
}
.mobile-history-row-meta {
  font-size: 12px;
  color: var(--compact-muted);
}
.mobile-history-row-meta strong {
  color: var(--compact-ink);
  font-weight: 600;
}
.mobile-history-summary {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
  line-height: 1.6;
  margin: 6px 0;
  font-size: 14px;
}
.mobile-history-open time, .mobile-history-record-meta {
  color: var(--compact-muted);
  font-size: 11px;
}
.mobile-history-row > :deep(.n-button) {
  margin-top: 4px;
}
.mobile-history-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.mobile-history-original {
  border-bottom: 1px solid var(--compact-border);
  padding-bottom: 8px;
}
.mobile-history-original summary {
  cursor: pointer;
  color: var(--compact-muted);
  font-size: 12px;
}
.mobile-history-content pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
  font-size: 14px;
  line-height: 1.65;
  margin: 0;
}
.mobile-history-original pre {
  margin-top: 8px;
  font-size: 13px;
}
.mobile-history-restore {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
}
.mobile-history-restore > span {
  min-width: 0;
  font-size: 12px;
  color: var(--compact-muted);
}
.mobile-history-restore > :deep(.n-button) {
  flex-shrink: 0;
}
</style> 
