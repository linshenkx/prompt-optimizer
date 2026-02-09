<template>
  <NPopover
    v-model:show="popoverVisible"
    trigger="manual"
    placement="bottom"
    flip
    ref="popoverInstRef"
    :style="{ padding: '0' }"
    :content-style="{ padding: '0' }"
    :disabled="loading"
    :delay="200"
    :duration="150"
    @clickoutside="handleClickOutside"
  >
    <template #trigger>
      <NButton
        secondary
        :type="badgeType"
        :size="buttonSize"
        :loading="loading"
        :disabled="loading"
        class="evaluation-score-badge-btn"
        :data-testid="`score-badge-${type}`"
        :data-eval-type="type"
        @click="handleClick"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <span v-if="!loading" data-testid="score-value">{{ displayText }}</span>
      </NButton>
    </template>
    <div
      class="hover-card-wrapper"
      ref="hoverCardWrapperRef"
      @mouseenter="handlePopoverMouseEnter"
      @mouseleave="handlePopoverMouseLeave"
      @focusin.capture="handlePopoverFocusIn"
      @focusout.capture="handlePopoverFocusOut"
    >
      <EvaluationHoverCard
        :result="result"
        :type="type"
        :loading="loading"
        :visible="popoverVisible"
        @show-detail="handleShowDetail"
        @evaluate="handleEvaluate"
        @evaluate-with-feedback="handleEvaluateWithFeedback"
        @apply-improvement="handleApplyImprovement"
        @apply-patch="handleApplyPatch"
      />
    </div>
  </NPopover>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount, watch, nextTick } from 'vue'
import { NButton, NPopover } from 'naive-ui'
import EvaluationHoverCard from './EvaluationHoverCard.vue'
import type { EvaluationResponse, EvaluationType, PatchOperation } from '@prompt-optimizer/core'
import type { ScoreLevel } from './types'

type PopoverInst = {
  syncPosition?: () => void
}

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
  (e: 'evaluate-with-feedback', payload: { type: EvaluationType; feedback: string }): void
  (e: 'apply-improvement', payload: { improvement: string; type: EvaluationType }): void
  (e: 'apply-patch', payload: { operation: PatchOperation }): void
}>()

// Popover 显示状态
const popoverVisible = ref(false)
const isHoveringBadge = ref(false)
const isHoveringPopover = ref(false)
const isPinnedByClick = ref(false)
const hasFocusWithinPopover = ref(false)
const popoverInstRef = ref<PopoverInst | null>(null)
const hoverCardWrapperRef = ref<HTMLElement | null>(null)
const POPOVER_CLOSE_DELAY = 250
let closeTimer: ReturnType<typeof setTimeout> | null = null

const clearCloseTimer = () => {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

onBeforeUnmount(() => {
  clearCloseTimer()
})

// 由于内部内容（尤其是 textarea autosize）可能在挂载后产生布局变化，
// 这里在打开后主动同步位置，降低靠近视口边缘时的遮挡概率。
watch(popoverVisible, (visible) => {
  if (!visible) return

  nextTick(() => {
    popoverInstRef.value?.syncPosition?.()

    // 再同步一次，覆盖异步布局（如字体加载、组件内部测量）带来的高度变更
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => popoverInstRef.value?.syncPosition?.())
    }
  })
})

const closePopover = () => {
  clearCloseTimer()
  popoverVisible.value = false
  isPinnedByClick.value = false
  hasFocusWithinPopover.value = false
}

const scheduleClose = () => {
  // 若用户正在 popover 内输入/操作（focus 在内部），不要因为 hover 状态变化而自动关闭。
  if (isPinnedByClick.value || hasFocusWithinPopover.value) {
    clearCloseTimer()
    return
  }

  clearCloseTimer()
  closeTimer = setTimeout(() => {
    if (!isHoveringBadge.value && !isHoveringPopover.value) {
      closePopover()
    }
  }, POPOVER_CLOSE_DELAY)
}

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

const displayText = computed(() => {
  if (props.score === null || props.score === undefined) return '--'
  return String(props.score)
})

const buttonSize = computed(() => (props.size === 'small' ? 'tiny' : 'small'))

const badgeType = computed(() => {
  switch (computedLevel.value) {
    case 'excellent':
    case 'good':
      return 'success'
    case 'acceptable':
      return 'info'
    case 'poor':
      return 'warning'
    case 'very-poor':
      return 'error'
    default:
      return 'default'
  }
})

// 点击处理 - 显示/隐藏悬浮预览
const handleClick = () => {
  if (props.loading) return

  if (popoverVisible.value && isPinnedByClick.value) {
    closePopover()
    return
  }

  clearCloseTimer()
  isPinnedByClick.value = true
  popoverVisible.value = true
}

// 鼠标进入徽章
const handleMouseEnter = () => {
  if (!props.loading) {
    isHoveringBadge.value = true
    clearCloseTimer()

    if (!isPinnedByClick.value) {
      popoverVisible.value = true
    }
  }
}

// 鼠标离开徽章
const handleMouseLeave = () => {
  isHoveringBadge.value = false
  scheduleClose()
}

// 鼠标进入 popover
const handlePopoverMouseEnter = () => {
  isHoveringPopover.value = true
  clearCloseTimer()
}

// 鼠标离开 popover
const handlePopoverMouseLeave = () => {
  isHoveringPopover.value = false
  scheduleClose()
}

const handleClickOutside = () => {
  if (isPinnedByClick.value || hasFocusWithinPopover.value) {
    closePopover()
  }
}

const handlePopoverFocusIn = () => {
  hasFocusWithinPopover.value = true
  clearCloseTimer()
}

const handlePopoverFocusOut = () => {
  if (typeof document === 'undefined') return

  const wrapper = hoverCardWrapperRef.value
  const updateFocusState = () => {
    const active = document.activeElement
    if (wrapper && active && wrapper.contains(active)) return

    hasFocusWithinPopover.value = false
    scheduleClose()
  }

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(updateFocusState)
    return
  }

  updateFocusState()
}

// 查看详情处理 - 关闭悬浮预览并打开详情面板
const handleShowDetail = () => {
  closePopover()
  emit('show-detail')
}

// 评估处理 - 关闭悬浮预览并触发评估
const handleEvaluate = () => {
  closePopover()
  emit('evaluate')
}

// 带反馈评估处理
const handleEvaluateWithFeedback = (payload: { feedback: string }) => {
  closePopover()
  emit('evaluate-with-feedback', {
    type: props.type,
    feedback: payload.feedback,
  })
}

// 应用改进建议处理 - 关闭悬浮预览并转发事件
const handleApplyImprovement = (payload: { improvement: string; type: EvaluationType }) => {
  closePopover()
  emit('apply-improvement', payload)
}

// 应用补丁处理 - 关闭悬浮预览并转发事件
const handleApplyPatch = (payload: { operation: PatchOperation }) => {
  closePopover()
  emit('apply-patch', payload)
}
</script>

<style scoped>
.evaluation-score-badge-btn {
  min-width: 40px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.hover-card-wrapper {
  display: block;
}
</style>
