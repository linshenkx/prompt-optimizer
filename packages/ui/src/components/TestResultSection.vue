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
      v-if="isCompareMode && showPrimary"
      :vertical="verticalLayout"
      justify="space-between"
      :style="{
        flex: 1,
        overflow: 'hidden',
        height: '100%',
        gap: '12px'
      }"
    >
      <!-- 第一列结果 -->
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
              {{ primaryTitle }}
            </NText>
            <div v-if="showEvaluation && hasPrimaryResult" class="evaluation-entry">
              <EvaluationScoreBadge
                v-if="hasPrimaryEvaluation || isEvaluatingPrimary"
                :score="primaryScore"
                :level="primaryScoreLevel"
                :loading="isEvaluatingPrimary"
                :result="primaryEvaluationResult"
                type="result"
                size="small"
                @show-detail="handleShowPrimaryDetail"
                @evaluate="handleEvaluatePrimary"
                @evaluate-with-feedback="handleEvaluateWithFeedback"
                @apply-improvement="handleApplyImprovement"
                @apply-patch="handleApplyPatch"
              />
              <FocusAnalyzeButton
                v-else
                type="result"
                :label="t('evaluation.evaluate')"
                :loading="isEvaluatingPrimary"
                :button-props="{ size: 'small', type: 'tertiary' }"
                @evaluate="handleEvaluatePrimary"
                @evaluate-with-feedback="handleEvaluateWithFeedback"
              >
                <template #icon>
                  <AnalyzeActionIcon />
                </template>
              </FocusAnalyzeButton>
            </div>
          </div>
        </template>
        <div class="result-body">
          <slot name="primary-result"></slot>
        </div>
        <ToolCallDisplay
          v-if="primaryResult?.toolCalls"
          :tool-calls="primaryResult.toolCalls"
          :size="size"
          class="tool-calls-section"
        />
      </NCard>

      <!-- 第二列结果 -->
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
              {{ secondaryTitle }}
            </NText>
            <div v-if="showEvaluation && hasSecondaryResult" class="evaluation-entry">
              <EvaluationScoreBadge
                v-if="hasSecondaryEvaluation || isEvaluatingSecondary"
                :score="secondaryScore"
                :level="secondaryScoreLevel"
                :loading="isEvaluatingSecondary"
                :result="secondaryEvaluationResult"
                type="result"
                size="small"
                @show-detail="handleShowSecondaryDetail"
                @evaluate="handleEvaluateSecondary"
                @evaluate-with-feedback="handleEvaluateWithFeedback"
                @apply-improvement="handleApplyImprovement"
                @apply-patch="handleApplyPatch"
              />
              <FocusAnalyzeButton
                v-else
                type="result"
                :label="t('evaluation.evaluate')"
                :loading="isEvaluatingSecondary"
                :button-props="{ size: 'small', type: 'tertiary' }"
                @evaluate="handleEvaluateSecondary"
                @evaluate-with-feedback="handleEvaluateWithFeedback"
              >
                <template #icon>
                  <AnalyzeActionIcon />
                </template>
              </FocusAnalyzeButton>
            </div>
          </div>
        </template>
        <div class="result-body">
          <slot name="secondary-result"></slot>
        </div>
        <ToolCallDisplay
          v-if="secondaryResult?.toolCalls"
          :tool-calls="secondaryResult.toolCalls"
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
          <slot name="single-header">
            <NText style="font-size: 16px; font-weight: 600;">{{ singleResultTitle }}</NText>
          </slot>
          <div v-if="showEvaluation && hasSecondaryResult" class="evaluation-entry">
            <EvaluationScoreBadge
              v-if="hasSecondaryEvaluation || isEvaluatingSecondary"
              :score="secondaryScore"
              :level="secondaryScoreLevel"
              :loading="isEvaluatingSecondary"
              :result="secondaryEvaluationResult"
              type="result"
              size="small"
              @show-detail="handleShowSecondaryDetail"
              @evaluate="handleEvaluateSecondary"
              @evaluate-with-feedback="handleEvaluateWithFeedback"
              @apply-improvement="handleApplyImprovement"
              @apply-patch="handleApplyPatch"
            />
            <FocusAnalyzeButton
              v-else
              type="result"
              :label="t('evaluation.evaluate')"
              :loading="isEvaluatingSecondary"
              :button-props="{ size: 'small', type: 'tertiary' }"
              @evaluate="handleEvaluateSecondary"
              @evaluate-with-feedback="handleEvaluateWithFeedback"
            >
              <template #icon>
                <AnalyzeActionIcon />
              </template>
            </FocusAnalyzeButton>
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
import { NFlex, NCard, NText } from 'naive-ui'
import ToolCallDisplay from './ToolCallDisplay.vue'
import { AnalyzeActionIcon, EvaluationScoreBadge, FocusAnalyzeButton } from './evaluation'
import type { AdvancedTestResult, EvaluationResponse, EvaluationType, PatchOperation } from '@prompt-optimizer/core'
import type { ScoreLevel } from './evaluation/types'

const { t } = useI18n()

interface Props {
  // 布局模式
  isCompareMode?: boolean
  verticalLayout?: boolean
  showPrimary?: boolean

  // 标题配置
  primaryTitle?: string
  secondaryTitle?: string
  singleResultTitle?: string

  // 测试结果数据（用于工具调用显示）
  primaryResult?: AdvancedTestResult
  secondaryResult?: AdvancedTestResult
  singleResult?: AdvancedTestResult

  // 尺寸配置
  cardSize?: 'small' | 'medium' | 'large'
  size?: 'small' | 'medium' | 'large'

  // 间距配置
  gap?: string | number

  // 评估功能配置
  showEvaluation?: boolean
  // 是否有测试结果（用于显示评估按钮）
  hasPrimaryResult?: boolean
  hasSecondaryResult?: boolean
  // 评估状态
  isEvaluatingPrimary?: boolean
  isEvaluatingSecondary?: boolean
  // 评估分数
  primaryScore?: number | null
  secondaryScore?: number | null
  // 是否有评估结果
  hasPrimaryEvaluation?: boolean
  hasSecondaryEvaluation?: boolean
  // 评估结果和等级（用于悬浮预览）
  primaryEvaluationResult?: EvaluationResponse | null
  secondaryEvaluationResult?: EvaluationResponse | null
  primaryScoreLevel?: ScoreLevel | null
  secondaryScoreLevel?: ScoreLevel | null
}

const props = withDefaults(defineProps<Props>(), {
  isCompareMode: false,
  verticalLayout: false,
  showPrimary: true,
  primaryTitle: '',
  secondaryTitle: '',
  singleResultTitle: '',
  cardSize: 'small',
  size: 'small',
  gap: 12,
  // 评估默认值
  showEvaluation: false,
  hasPrimaryResult: false,
  hasSecondaryResult: false,
  isEvaluatingPrimary: false,
  isEvaluatingSecondary: false,
  primaryScore: null,
  secondaryScore: null,
  hasPrimaryEvaluation: false,
  hasSecondaryEvaluation: false,
  primaryEvaluationResult: null,
  secondaryEvaluationResult: null,
  primaryScoreLevel: null,
  secondaryScoreLevel: null
})

const emit = defineEmits<{
  'evaluate-primary': []
  'evaluate-secondary': []
  'evaluate-with-feedback': [payload: { type: EvaluationType; feedback: string }]
  'show-primary-detail': []
  'show-secondary-detail': []
  'apply-improvement': [payload: { improvement: string; type: EvaluationType }]
  'apply-patch': [payload: { operation: PatchOperation }]
}>()

const primaryTitle = computed(() =>
  props.primaryTitle || t('test.compareResultA')
)

const secondaryTitle = computed(() =>
  props.secondaryTitle || t('test.compareResultB')
)

const singleResultTitle = computed(() =>
  props.singleResultTitle || t('test.testResult')
)

// 事件处理
const handleEvaluatePrimary = () => {
  emit('evaluate-primary')
}

const handleEvaluateSecondary = () => {
  emit('evaluate-secondary')
}

const handleEvaluateWithFeedback = (payload: { type: EvaluationType; feedback: string }) => {
  emit('evaluate-with-feedback', payload)
}

const handleShowPrimaryDetail = () => {
  emit('show-primary-detail')
}

const handleShowSecondaryDetail = () => {
  emit('show-secondary-detail')
}

// 应用改进建议处理
const handleApplyImprovement = (payload: { improvement: string; type: EvaluationType }) => {
  emit('apply-improvement', payload)
}

// 应用补丁处理
const handleApplyPatch = (payload: { operation: PatchOperation }) => {
  emit('apply-patch', payload)
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
