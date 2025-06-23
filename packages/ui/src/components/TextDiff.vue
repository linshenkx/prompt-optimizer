<template>
    <div class="text-diff theme-input">
      <!-- 对比模式切换 -->
      <div class="diff-header" v-if="showHeader">
        <div class="diff-controls">
          <button 
            class="diff-toggle-btn"
            @click="$emit('toggleDiff')"
            :aria-label="isEnabled ? '关闭对比模式' : '开启对比模式'"
          >
            {{ isEnabled ? '关闭对比' : '开启对比' }}
          </button>
          
          <div v-if="isEnabled && compareResult" class="diff-stats">
            <span class="stat added" v-if="compareResult.summary.additions > 0">
              +{{ compareResult.summary.additions }}
            </span>
            <span class="stat removed" v-if="compareResult.summary.deletions > 0">
              -{{ compareResult.summary.deletions }}
            </span>
          </div>
        </div>
      </div>
  
      <!-- 文本内容 -->
      <div>
        <template v-if="isEnabled && compareResult">
          <!-- 对比模式：显示高亮的差异 -->
          <div class="diff-text">
            <span
              v-for="fragment in compareResult.fragments"
              :key="fragment.index"
              :class="getFragmentClass(fragment.type)"
              class="text-fragment"
            >{{ fragment.text }}</span>
          </div>
        </template>
        
        <template v-else>
          <!-- 普通模式：显示原始文本 -->
          <div class="normal-text">
            {{ displayText }}
          </div>
        </template>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { computed } from 'vue'
  import type { CompareResult, ChangeType } from '@prompt-optimizer/core'
  
  interface Props {
    /** 原始文本 */
    originalText: string
    /** 优化后的文本 */
    optimizedText: string
    /** 对比结果 */
    compareResult?: CompareResult
    /** 是否启用对比模式 */
    isEnabled: boolean
    /** 是否显示头部控制栏 */
    showHeader?: boolean
    /** 显示的文本类型：original | optimized */
    displayMode?: 'original' | 'optimized'
  }
  
  interface Emits {
    (e: 'toggleDiff'): void
  }
  
  const props = withDefaults(defineProps<Props>(), {
    showHeader: true,
    displayMode: 'optimized'
  })
  
  defineEmits<Emits>()
  
  const displayText = computed(() => {
    return props.displayMode === 'original' ? props.originalText : props.optimizedText
  })
  
  const getFragmentClass = (type: ChangeType): string => {
    switch (type) {
      case 'added':
        return 'fragment-added'
      case 'removed':
        return 'fragment-removed'
      case 'modified':
        return 'fragment-modified'
      case 'unchanged':
      default:
        return 'fragment-unchanged'
    }
  }
  </script>
  
  <style scoped>
  .text-diff {
    border-radius: 8px;
    border: 1px solid var(--el-border-color);
  }
  
  .diff-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--el-border-color-light);
    background: var(--el-bg-color-page);
  }
  
  .diff-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  
  .diff-toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .diff-toggle-btn:hover {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
  }
  
  .diff-stats {
    display: flex;
    gap: 8px;
    font-size: 12px;
    font-weight: 500;
  }
  
  .stat {
    padding: 2px 6px;
    border-radius: 4px;
    color: white;
  }
  
  .stat.added {
    background: var(--el-color-success);
  }
  
  .stat.removed {
    background: var(--el-color-danger);
  }
  
  .diff-text,
  .normal-text {
    line-height: 1.6;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 1rem;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .text-fragment {
    position: relative;
  }
  
  .fragment-unchanged {
    color: var(--el-text-color-primary);
  }
  
  .fragment-added {
    background: rgba(34, 197, 94, 0.15);
    color: var(--el-color-success-dark-2);
    border-radius: 2px;
    padding: 1px 2px;
  }
  
  .fragment-removed {
    background: rgba(239, 68, 68, 0.15);
    color: var(--el-color-danger-dark-2);
    border-radius: 2px;
    padding: 1px 2px;
    text-decoration: line-through;
  }
  
  .fragment-modified {
    background: rgba(245, 158, 11, 0.15);
    color: var(--el-color-warning-dark-2);
    border-radius: 2px;
    padding: 1px 2px;
  }
  
  /* 暗黑模式适配 */
  .dark .fragment-added {
    background: rgba(34, 197, 94, 0.25);
    color: var(--el-color-success-light-3);
  }
  
  .dark .fragment-removed {
    background: rgba(239, 68, 68, 0.25);
    color: var(--el-color-danger-light-3);
  }
  
  .dark .fragment-modified {
    background: rgba(245, 158, 11, 0.25);
    color: var(--el-color-warning-light-3);
  }
  
  /* 响应式设计 */
  @media (max-width: 768px) {
    .diff-controls {
      flex-direction: column;
      align-items: stretch;
    }
    
    .diff-stats {
      justify-content: center;
    }
  }
  </style> 