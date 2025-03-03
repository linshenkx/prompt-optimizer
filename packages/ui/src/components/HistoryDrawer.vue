<template>
  <div
    v-if="show"
    class="fixed inset-0 z-[60] flex items-center justify-center"
    @click="emit('update:show', false)"
  >
    <div class="theme-dialog-overlay"></div>
    <div
      class="theme-dialog-container w-full max-w-4xl h-[90vh] scale-100 opacity-100"
      @click.stop
    >
      <div class="h-full flex flex-col">
        <div class="theme-dialog-header">
          <div class="flex items-center gap-4">
            <h2 class="theme-dialog-title">历史记录</h2>
            <button
              v-if="sortedHistory && sortedHistory.length > 0"
              @click.stop="handleClear"
              class="theme-dialog-btn theme-dialog-btn-secondary text-sm"
            >
              清空
            </button>
          </div>
          <button
            @click.stop="emit('update:show', false)"
            class="text-gray-500 dark:text-white/60 hover:text-gray-700 dark:hover:text-white/90 transition-colors text-xl"
          >
            ×
          </button>
        </div>
        
        <div class="theme-dialog-body">
          <template v-if="sortedHistory && sortedHistory.length > 0">
            <div class="space-y-4">
              <div
                v-for="chain in sortedHistory"
                :key="chain.chainId"
                class="theme-dialog-card"
              >
                <!-- 历史记录头部信息 -->
                <div class="theme-dialog-card-header">
                  <div class="flex items-center justify-between mb-2">
                    <div class="text-sm theme-dialog-text-secondary">
                      创建于 {{ formatDate(chain.rootRecord.timestamp) }}
                    </div>
                  </div>
                  <div class="text-sm theme-dialog-text break-all">
                    {{ chain.rootRecord.originalPrompt }}
                  </div>
                </div>

                <!-- 版本列表 -->
                <div class="theme-dialog-card-body">
                  <div
                    v-for="record in chain.versions.slice().reverse()"
                    :key="record.id"
                    class="relative"
                  >
                    <!-- 版本标题栏 -->
                    <div
                      class="theme-history-version-row"
                      @click="toggleVersion(record.id)"
                    >
                      <div class="flex items-center gap-3 overflow-hidden">
                        <span class="text-sm font-medium text-purple-700 dark:text-purple-300 flex-none">V{{ record.version }}</span>
                        <span class="text-xs theme-dialog-text-secondary flex-none">{{ formatDate(record.timestamp) }}</span>
                        <span v-if="record.type === 'iterate' && record.iterationNote" class="text-xs theme-dialog-text-secondary truncate">
                          - {{ truncateText(record.iterationNote, 30) }}
                        </span>
                      </div>
                      <div class="flex items-center gap-2 flex-none">
                        <span v-if="record.type === 'iterate'" class="theme-dialog-tag theme-dialog-tag-purple">迭代</span>
                        <button
                          @click.stop="reuse(record, chain)"
                          class="theme-dialog-btn theme-dialog-btn-primary text-xs"
                        >
                          使用
                        </button>
                        <button class="theme-dialog-link text-sm">
                          {{ expandedVersions[record.id] ? '收起' : '展开' }}
                        </button>
                      </div>
                    </div>

                    <!-- 版本详细内容 -->
                    <div
                      v-show="expandedVersions[record.id]"
                      class="theme-history-version-detail"
                    >
                      <!-- 迭代说明 -->
                      <div v-if="record.iterationNote" class="text-xs text-purple-700 dark:text-purple-300">
                        迭代说明: <span class="theme-dialog-text">{{ record.iterationNote }}</span>
                      </div>
                      <!-- 优化后的提示词 -->
                      <div class="space-y-1">
                        <div class="text-xs theme-dialog-text-secondary">优化后:</div>
                        <div class="text-sm theme-dialog-text whitespace-pre-wrap">{{ record.optimizedPrompt }}</div>
                      </div>
                      <!-- 使用按钮 -->
                      <div class="flex justify-end">
                        <button
                          @click="reuse(record, chain)"
                          class="theme-dialog-btn theme-dialog-btn-primary text-xs"
                        >
                          使用此版本
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="flex flex-col items-center justify-center h-full py-12 theme-dialog-text-secondary">
              <div class="text-4xl mb-4">📜</div>
              <div class="text-sm">暂无历史记录</div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import type { PropType } from 'vue'
import type { PromptRecord, PromptRecordChain } from '@prompt-optimizer/core'
import { historyManager } from '@prompt-optimizer/core'
import { useToast } from '../composables/useToast'

const props = defineProps({
  show: Boolean
})

// 添加日志
console.log('HistoryDrawer props:', {
  show: props.show
})

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'reuse', context: { 
    record: PromptRecord, 
    chainId: string,
    rootPrompt: string 
  }): void
  (e: 'clear'): void
}>()

const toast = useToast()
const expandedVersions = ref<Record<string, boolean>>({})

// 添加排序后的历史记录计算属性
const sortedHistory = computed(() => {
  return historyManager.getAllChains().sort((a, b) => b.rootRecord.timestamp - a.rootRecord.timestamp)
})

// 切换版本展开/收起状态
const toggleVersion = (recordId: string) => {
  expandedVersions.value = {
    ...expandedVersions.value,
    [recordId]: !expandedVersions.value[recordId]
  }
}

// 清空历史记录
const handleClear = async () => {
  if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
    emit('clear')
    toast.success('历史记录已清空')
  }
}

// 监听显示状态变化
watch(() => props.show, (newShow) => {
  if (!newShow) {
    // 关闭时重置所有展开状态
    expandedVersions.value = {}
  }
})

onMounted(() => {
  console.log('HistoryDrawer mounted')
})

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}

const reuse = (record: PromptRecord, chain: PromptRecordChain) => {
  emit('reuse', {
    record,
    chainId: chain.chainId,
    rootPrompt: chain.rootRecord.originalPrompt
  })
  emit('update:show', false)
}

// 添加文本截断函数
const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...'
}
</script>

<style scoped>
</style> 