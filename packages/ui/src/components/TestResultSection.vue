<template>
  <div
    class="test-result-section"
    :style="{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column'
    }"
  >
    <!-- 对比模式：双列布局 -->
    <NFlex
      v-if="isCompareMode && showOriginal"
      :vertical="verticalLayout"
      justify="space-between"
      :style="{
        flex: 1,
        overflow: 'hidden',
        height: '100%',
        gap: '12px'
      }"
    >
      <!-- 原始结果 -->
      <NCard
        size="small"
        :style="{
          flex: 1,
          height: '100%',
          overflow: 'hidden'
        }"
        content-style="height: 100%; max-height: 100%; overflow: hidden; display: flex; flex-direction: column;"
      >
        <template #header>
          <div class="card-header-content">
            <NText style="font-size: 16px; font-weight: 600;">
              {{ originalTitle }}
            </NText>
            <!-- 原始结果评估入口 -->
            <div v-if="showEvaluation && hasOriginalResult" class="evaluation-entry">
              <EvaluationScoreBadge
                v-if="hasOriginalEvaluation || isEvaluatingOriginal"
                :score="originalScore"
                :level="originalScoreLevel"
                :loading="isEvaluatingOriginal"
                :result="originalEvaluationResult"
                type="original"
                size="small"
                @show-detail="handleShowOriginalDetail"
                @evaluate="handleEvaluateOriginal"
                @apply-improvement="handleApplyImprovement"
              />
              <NButton
                v-else
                size="tiny"
                secondary
                :disabled="isEvaluatingOriginal"
                @click="handleEvaluateOriginal"
              >
                {{ t('evaluation.evaluate') }}
              </NButton>
            </div>
          </div>
        </template>
        <div class="result-body">
          <slot name="original-result"></slot>
        </div>
        <!-- 原始结果的工具调用 -->
        <ToolCallDisplay
          v-if="originalResult?.toolCalls"
          :tool-calls="originalResult.toolCalls"
          :size="size"
          class="tool-calls-section"
        />
      </NCard>

      <!-- 优化结果 -->
      <NCard
        size="small"
        :style="{
          flex: 1,
          height: '100%',
          overflow: 'hidden'
        }"
        content-style="height: 100%; max-height: 100%; overflow: hidden; display: flex; flex-direction: column;"
      >
        <template #header>
          <div class="card-header-content">
            <NText style="font-size: 16px; font-weight: 600;">
              {{ optimizedTitle }}
            </NText>
            <!-- 优化结果评估入口 -->
            <div v-if="showEvaluation && hasOptimizedResult" class="evaluation-entry">
              <EvaluationScoreBadge
                v-if="hasOptimizedEvaluation || isEvaluatingOptimized"
                :score="optimizedScore"
                :level="optimizedScoreLevel"
                :loading="isEvaluatingOptimized"
                :result="optimizedEvaluationResult"
                type="optimized"
                size="small"
                @show-detail="handleShowOptimizedDetail"
                @evaluate="handleEvaluateOptimized"
                @apply-improvement="handleApplyImprovement"
              />
              <NButton
                v-else
                size="tiny"
                secondary
                :disabled="isEvaluatingOptimized"
                @click="handleEvaluateOptimized"
              >
                {{ t('evaluation.evaluate') }}
              </NButton>
            </div>
          </div>
        </template>
        <div class="result-body">
          <slot name="optimized-result"></slot>
        </div>
        <!-- 优化结果的工具调用 -->
        <ToolCallDisplay
          v-if="optimizedResult?.toolCalls"
          :tool-calls="optimizedResult.toolCalls"
          :size="size"
          class="tool-calls-section"
        />
      </NCard>
    </NFlex>

    <!-- 单一模式：单列布局 -->
    <NCard
      v-else
      size="small"
      :style="{
        flex: 1,
        height: '100%',
        overflow: 'hidden'
      }"
      content-style="height: 100%; max-height: 100%; overflow: hidden; display: flex; flex-direction: column;"
    >
      <template #header>
        <div class="card-header-content">
          <NText style="font-size: 16px; font-weight: 600;">
            {{ singleResultTitle }}
          </NText>
          <!-- 单一结果评估入口（使用优化结果的评估状态） -->
          <div v-if="showEvaluation && hasOptimizedResult" class="evaluation-entry">
            <EvaluationScoreBadge
              v-if="hasOptimizedEvaluation || isEvaluatingOptimized"
              :score="optimizedScore"
              :level="optimizedScoreLevel"
              :loading="isEvaluatingOptimized"
              :result="optimizedEvaluationResult"
              type="optimized"
              size="small"
              @show-detail="handleShowOptimizedDetail"
              @evaluate="handleEvaluateOptimized"
              @apply-improvement="handleApplyImprovement"
            />
            <NButton
              v-else
              size="tiny"
              secondary
              :disabled="isEvaluatingOptimized"
              @click="handleEvaluateOptimized"
            >
              {{ t('evaluation.evaluate', '评估') }}
            </NButton>
          </div>
        </div>
      </template>
      <div class="result-body">
        <slot name="single-result"></slot>
      </div>
      <!-- 单一结果的工具调用 -->
      <ToolCallDisplay
        v-if="singleResult?.toolCalls"
        :tool-calls="singleResult.toolCalls"
        :size="size"
        class="tool-calls-section"
      />
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NFlex, NCard, NText, NButton } from 'naive-ui'
import ToolCallDisplay from './ToolCallDisplay.vue'
import { EvaluationScoreBadge } from './evaluation'
import type { AdvancedTestResult, EvaluationResponse, EvaluationType } from '@prompt-optimizer/core'
import type { ScoreLevel } from './evaluation/EvaluationScoreBadge.vue'

const { t } = useI18n()

interface Props {
  // 布局模式
  isCompareMode?: boolean
  verticalLayout?: boolean
  showOriginal?: boolean

  // 标题配置
  originalTitle?: string
  optimizedTitle?: string
  singleResultTitle?: string

  // 测试结果数据（用于工具调用显示）
  originalResult?: AdvancedTestResult
  optimizedResult?: AdvancedTestResult
  singleResult?: AdvancedTestResult

  // 尺寸配置
  cardSize?: 'small' | 'medium' | 'large'
  size?: 'small' | 'medium' | 'large'

  // 间距配置
  gap?: string | number

  // 评估功能配置
  showEvaluation?: boolean
  // 是否有测试结果（用于显示评估按钮）
  hasOriginalResult?: boolean
  hasOptimizedResult?: boolean
  // 评估状态
  isEvaluatingOriginal?: boolean
  isEvaluatingOptimized?: boolean
  // 评估分数
  originalScore?: number | null
  optimizedScore?: number | null
  // 是否有评估结果
  hasOriginalEvaluation?: boolean
  hasOptimizedEvaluation?: boolean
  // 评估结果和等级（用于悬浮预览）
  originalEvaluationResult?: EvaluationResponse | null
  optimizedEvaluationResult?: EvaluationResponse | null
  originalScoreLevel?: ScoreLevel | null
  optimizedScoreLevel?: ScoreLevel | null
}

const props = withDefaults(defineProps<Props>(), {
  isCompareMode: false,
  verticalLayout: false,
  showOriginal: true,
  originalTitle: '',
  optimizedTitle: '',
  singleResultTitle: '',
  cardSize: 'small',
  size: 'small',
  gap: 12,
  // 评估默认值
  showEvaluation: false,
  hasOriginalResult: false,
  hasOptimizedResult: false,
  isEvaluatingOriginal: false,
  isEvaluatingOptimized: false,
  originalScore: null,
  optimizedScore: null,
  hasOriginalEvaluation: false,
  hasOptimizedEvaluation: false,
  originalEvaluationResult: null,
  optimizedEvaluationResult: null,
  originalScoreLevel: null,
  optimizedScoreLevel: null
})

const emit = defineEmits<{
  'evaluate-original': []
  'evaluate-optimized': []
  'show-original-detail': []
  'show-optimized-detail': []
  'apply-improvement': [payload: { improvement: string; type: EvaluationType }]
}>()

// 计算属性
const originalTitle = computed(() =>
  props.originalTitle || t('test.originalResult', '原始结果')
)

const optimizedTitle = computed(() =>
  props.optimizedTitle || t('test.optimizedResult', '优化结果')
)

const singleResultTitle = computed(() =>
  props.singleResultTitle || t('test.testResult', '测试结果')
)

// 事件处理
const handleEvaluateOriginal = () => {
  emit('evaluate-original')
}

const handleEvaluateOptimized = () => {
  emit('evaluate-optimized')
}

const handleShowOriginalDetail = () => {
  emit('show-original-detail')
}

const handleShowOptimizedDetail = () => {
  emit('show-optimized-detail')
}

// 应用改进建议处理
const handleApplyImprovement = (payload: { improvement: string; type: EvaluationType }) => {
  emit('apply-improvement', payload)
}
</script>

<style scoped>
.test-result-section {
  /* 确保正确的flex行为和高度管理 */
  min-height: 0;
  max-height: 100%;
}

/* 卡片头部布局 */
.card-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.evaluation-entry {
  flex-shrink: 0;
  margin-left: 8px;
}

/* 三段式布局样式 */
.result-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  /* 为正文区域提供独立滚动 */
}

.tool-calls-section {
  flex: 0 0 auto;
  /* 工具调用区域根据内容自适应高度 */
}
</style>