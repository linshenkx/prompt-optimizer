<template>
  <NPopover
    v-model:show="popoverVisible"
    trigger="manual"
    placement="bottom"
    :disabled="loading"
    :delay="200"
    :duration="150"
  >
    <template #trigger>
      <div
        class="evaluation-score-badge"
        :class="[sizeClass, levelClass, { clickable: !loading, loading }]"
        @click="handleClick"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <template v-if="loading">
          <NSpin :size="spinSize" />
        </template>
        <template v-else-if="score !== null && score !== undefined">
          <span class="score-value">{{ score }}</span>
        </template>
        <template v-else>
          <span class="score-placeholder">--</span>
        </template>
      </div>
    </template>
    <EvaluationHoverCard
      :result="result"
      :type="type"
      :loading="loading"
      @show-detail="handleShowDetail"
      @evaluate="handleEvaluate"
      @apply-improvement="handleApplyImprovement"
      @mouseenter="handlePopoverMouseEnter"
      @mouseleave="handlePopoverMouseLeave"
    />
  </NPopover>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NSpin, NPopover } from 'naive-ui'
import EvaluationHoverCard from './EvaluationHoverCard.vue'
import type { EvaluationResponse, EvaluationType } from '@prompt-optimizer/core'

export type ScoreLevel = 'excellent' | 'good' | 'acceptable' | 'poor' | 'very-poor'

const props = withDefaults(
  defineProps<{
    /** 分数值 (0-100) */
    score?: number | null
    /** 评分等级 */
    level?: ScoreLevel | null
    /** 是否正在加载 */
    loading?: boolean
    /** 尺寸 */
    size?: 'small' | 'medium'
    /** 评估结果（用于悬浮预览） */
    result?: EvaluationResponse | null
    /** 评估类型 */
    type?: EvaluationType
  }>(),
  {
    score: null,
    level: null,
    loading: false,
    size: 'small',
    result: null,
    type: 'original',
  }
)

const emit = defineEmits<{
  (e: 'show-detail'): void
  (e: 'evaluate'): void
  (e: 'apply-improvement', payload: { improvement: string; type: EvaluationType }): void
}>()

// Popover 显示状态
const popoverVisible = ref(false)
const isHoveringBadge = ref(false)
const isHoveringPopover = ref(false)

// 计算等级（如果未提供则根据分数计算）
const computedLevel = computed<ScoreLevel | null>(() => {
  if (props.level) return props.level
  if (props.score === null || props.score === undefined) return null
  if (props.score >= 90) return 'excellent'
  if (props.score >= 80) return 'good'
  if (props.score >= 60) return 'acceptable'
  if (props.score >= 40) return 'poor'
  return 'very-poor'
})

// 尺寸类
const sizeClass = computed(() => `size-${props.size}`)

// 等级颜色类
const levelClass = computed(() => {
  if (!computedLevel.value) return ''
  return `level-${computedLevel.value}`
})

// 加载图标尺寸
const spinSize = computed(() => (props.size === 'small' ? 12 : 16))

// 点击处理 - 显示/隐藏悬浮预览
const handleClick = () => {
  if (!props.loading) {
    popoverVisible.value = !popoverVisible.value
  }
}

// 鼠标进入徽章
const handleMouseEnter = () => {
  if (!props.loading) {
    isHoveringBadge.value = true
    popoverVisible.value = true
  }
}

// 鼠标离开徽章
const handleMouseLeave = () => {
  isHoveringBadge.value = false
  // 延迟检查，给用户时间移动到 popover
  setTimeout(() => {
    if (!isHoveringBadge.value && !isHoveringPopover.value) {
      popoverVisible.value = false
    }
  }, 100)
}

// 鼠标进入 popover
const handlePopoverMouseEnter = () => {
  isHoveringPopover.value = true
}

// 鼠标离开 popover
const handlePopoverMouseLeave = () => {
  isHoveringPopover.value = false
  // 延迟检查
  setTimeout(() => {
    if (!isHoveringBadge.value && !isHoveringPopover.value) {
      popoverVisible.value = false
    }
  }, 100)
}

// 查看详情处理 - 关闭悬浮预览并打开详情面板
const handleShowDetail = () => {
  popoverVisible.value = false
  emit('show-detail')
}

// 评估处理 - 关闭悬浮预览并触发评估
const handleEvaluate = () => {
  popoverVisible.value = false
  emit('evaluate')
}

// 应用改进建议处理 - 关闭悬浮预览并转发事件
const handleApplyImprovement = (payload: { improvement: string; type: EvaluationType }) => {
  popoverVisible.value = false
  emit('apply-improvement', payload)
}
</script>

<style scoped>
.evaluation-score-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-weight: 600;
  transition: all 0.2s ease;
  user-select: none;
}

/* 尺寸 */
.size-small {
  min-width: 32px;
  height: 22px;
  padding: 0 6px;
  font-size: 12px;
}

.size-medium {
  min-width: 40px;
  height: 28px;
  padding: 0 8px;
  font-size: 14px;
}

/* 可点击状态 */
.clickable:not(.loading) {
  cursor: pointer;
}

.clickable:not(.loading):hover {
  opacity: 0.85;
  transform: scale(1.05);
}

/* 加载状态 */
.loading {
  background: var(--n-color-embedded, #f5f5f5);
  color: var(--n-text-color-3, #999);
}

/* 等级颜色 */
.level-excellent {
  background: rgba(24, 160, 88, 0.15);
  color: #18a058;
}

.level-good {
  background: rgba(32, 128, 240, 0.15);
  color: #2080f0;
}

.level-acceptable {
  background: rgba(240, 160, 32, 0.15);
  color: #f0a020;
}

.level-poor {
  background: rgba(208, 48, 80, 0.15);
  color: #d03050;
}

.level-very-poor {
  background: rgba(208, 48, 80, 0.2);
  color: #d03050;
}

/* 占位符样式 */
.score-placeholder {
  color: var(--n-text-color-3, #999);
}

/* 无等级时的默认样式 */
.evaluation-score-badge:not([class*='level-']):not(.loading) {
  background: var(--n-color-embedded, #f5f5f5);
}
</style>
