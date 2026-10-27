<template>
  <NDrawer
    :show="show"
    :width="420"
    placement="right"
    :on-update:show="handleUpdateShow"
    data-testid="evaluation-panel-drawer"
  >
    <NDrawerContent :title="panelTitle" closable>
      <!-- 加载状态 -->
      <template v-if="isEvaluating">
        <div class="evaluation-loading">
          <NSpin size="large" />
          <NText depth="3" class="loading-text">{{ t('evaluation.loading') }}</NText>
          <!-- 流式内容预览 -->
          <NButton v-if="outputRecord" size="small" @click="getOutputDocument(outputRecord)?.interrupt()">{{ t('common.outputStop') }}</NButton>
          <div v-if="streamContent || outputRecord" class="stream-preview">
            <NText depth="3" class="stream-label">{{ t('evaluation.analyzing') }}</NText>
            <OutputSourceView :document="getOutputDocument(outputRecord)" :content="streamContent" style="height:200px; flex:none" />
          </div>
        </div>
      </template>

      <!-- 错误状态 -->
      <template v-else-if="error">
        <NResult status="error" :title="t('evaluation.error.title')">
          <template #default>
            <NText depth="3">{{ error }}</NText>
          </template>
          <template #footer>
            <NButton :disabled="isActionDisabled" @click="handleRetry">{{ t('common.retry') }}</NButton>
          </template>
        </NResult>
      </template>

      <!-- 评估结果 -->
      <template v-else-if="result">
        <NScrollbar style="max-height: calc(100vh - 120px);">
          <NSpace vertical :size="20">
            <NAlert
              v-if="stale"
              type="info"
              :show-icon="false"
              :bordered="false"
              class="stale-alert"
            >
              {{ staleMessage || t('evaluation.stale.default') }}
            </NAlert>
            <NAlert
              v-if="evaluationDisableMessage"
              type="warning"
              :show-icon="false"
              :bordered="false"
              class="stale-alert"
            >
              {{ evaluationDisableMessage }}
            </NAlert>

            <!-- 总分展示 -->
            <div class="score-section">
              <div class="overall-score" :class="scoreLevelClass">
                <div class="score-value">{{ result.score.overall }}</div>
                <div class="score-label">{{ t('evaluation.overallScore') }}</div>
              </div>
              <NText depth="3" class="score-level-text">
                {{ scoreLevelText }}
              </NText>
            </div>

            <!-- 一句话总结 -->
            <NCard v-if="displaySummaryText" size="small" data-testid="evaluation-panel-summary-card">
              <NText>{{ displaySummaryText }}</NText>
            </NCard>

            <NCard
              v-if="compareDecisionSummary"
              size="small"
              data-testid="evaluation-panel-compare-decision"
            >
              <NSpace vertical :size="12">
                <div class="compare-section-header">
                  <div class="compare-section-header__main">
                    <NText strong>{{ tOr('evaluation.compareSummary.decision.title', 'Iteration Advice') }}</NText>
                    <NTooltip
                      trigger="hover"
                      :theme-overrides="tooltipThemeOverrides"
                      :overlay-style="tooltipOverlayStyle"
                      :content-style="tooltipContentStyle"
                    >
                      <template #trigger>
                        <NTag
                          size="small"
                          :type="compareDecisionSummary.recommendationType"
                          round
                        >
                          {{ compareDecisionSummary.recommendationLabel }}
                        </NTag>
                      </template>
                      <span>{{ compareDecisionSummary.headline }}</span>
                    </NTooltip>
                  </div>
                  <CompareHelpButton />
                </div>

                <NSpace
                  v-if="hasCompareMetadata"
                  class="compare-context-strip"
                  data-testid="evaluation-panel-compare-context"
                >
                  <NTag
                    v-if="shouldShowCompareModeChip"
                    size="small"
                    type="default"
                    round
                    data-testid="evaluation-panel-compare-mode-value"
                  >
                    {{ formatCompareMode(compareMode) }}
                  </NTag>
                  <div
                    v-if="compareSnapshotDisplayEntries.length"
                    class="compare-role-inline-list"
                    data-testid="evaluation-panel-compare-context-roles"
                  >
                    <div
                      v-for="entry in compareSnapshotDisplayEntries"
                      :key="entry.snapshotId"
                      class="compare-role-inline-item"
                      :class="{
                        'compare-role-inline-item--target': entry.role === 'target',
                      }"
                    >
                      <NText depth="3" class="compare-role-inline-label">{{ entry.label }}</NText>
                      <NTag
                        size="small"
                        :type="entry.role === 'target' ? 'success' : 'default'"
                        round
                      >
                        {{ entry.snapshotId.toUpperCase() }}
                      </NTag>
                    </div>
                  </div>
                </NSpace>

                <NText
                  v-if="compareSecondaryHeadline"
                  depth="3"
                  class="compare-decision-subheadline"
                  data-testid="evaluation-panel-compare-secondary-headline"
                >
                  {{ compareSecondaryHeadline }}
                </NText>

                <NSpace
                  v-if="compareDecisionSummary.signalChips.length"
                  :size="6"
                  class="compare-decision-signals"
                >
                  <NTag
                    v-for="chip in compareDecisionSummary.signalChips"
                    :key="chip.key"
                    size="small"
                    :type="chip.type"
                    round
                  >
                    {{ chip.label }}: {{ chip.value }}
                  </NTag>
                </NSpace>

                <div
                  v-if="compareReasonCards.length && activeCompareReasonCard"
                  class="compare-focus-block"
                >
                  <div class="compare-focus-tabs">
                    <NButton
                      v-for="card in compareReasonCards"
                      :key="card.key"
                      size="small"
                      :type="card.key === activeCompareReasonCard.key ? 'primary' : 'default'"
                      :quaternary="card.key !== activeCompareReasonCard.key"
                      class="compare-focus-tab"
                      @click="activeCompareReasonKey = card.key"
                    >
                      <span class="compare-focus-tab__title">{{ card.title }}</span>
                    </NButton>
                  </div>

                  <div class="compare-focus-panel">
                    <NText class="compare-focus-panel__body">
                      {{ activeCompareReasonCard.body }}
                    </NText>
                  </div>
                </div>

              </NSpace>
            </NCard>

            <NCard
              v-if="!compareDecisionSummary && hasCompareMetadata"
              :title="tOr('evaluation.compareSummary.advanced.title', 'Comparison Details')"
              size="small"
              data-testid="evaluation-panel-compare-metadata"
            >
              <NSpace vertical :size="12">
                <div class="compare-context-strip" data-testid="evaluation-panel-compare-metadata-context">
                  <NTag
                    v-if="shouldShowCompareModeChip"
                    size="small"
                    type="default"
                    round
                    data-testid="evaluation-panel-compare-metadata-mode"
                  >
                    {{ formatCompareMode(compareMode) }}
                  </NTag>
                  <div
                    v-if="compareSnapshotDisplayEntries.length"
                    class="compare-role-inline-list"
                    data-testid="evaluation-panel-compare-metadata-roles"
                  >
                    <div
                      v-for="entry in compareSnapshotDisplayEntries"
                      :key="entry.snapshotId"
                      class="compare-role-inline-item"
                      :class="{
                        'compare-role-inline-item--target': entry.role === 'target',
                      }"
                    >
                      <NText depth="3" class="compare-role-inline-label">{{ entry.label }}</NText>
                      <NTag
                        size="small"
                        :type="entry.role === 'target' ? 'success' : 'default'"
                        round
                      >
                        {{ entry.snapshotId.toUpperCase() }}
                      </NTag>
                    </div>
                  </div>
                </div>
              </NSpace>
            </NCard>

            <!-- 四维度分数 -->
            <NCard :title="t('evaluation.dimensions')" size="small">
              <NSpace vertical :size="12">
                <div v-for="dim in result.score.dimensions" :key="dim.key" class="dimension-item">
                  <div class="dimension-header">
                    <NText>{{ dim.label }}</NText>
                    <NText :class="getDimensionScoreClass(dim.score)">{{ dim.score }}</NText>
                  </div>
                  <NProgress
                    :percentage="dim.score"
                    :status="getDimensionStatus(dim.score)"
                    :show-indicator="false"
                    :height="8"
                  />
                </div>
              </NSpace>
            </NCard>

            <!-- 精准修复（patchPlan） -->
            <NCard
              v-if="result.patchPlan && result.patchPlan.length > 0"
              :title="t('evaluation.diagnose.title')"
              size="small"
            >
              <NList>
                <NListItem v-for="(op, opIndex) in result.patchPlan" :key="opIndex">
                  <div class="patch-item">
                    <div class="patch-header">
                      <NTag :type="getOperationType(op.op)" size="tiny">
                        {{ getOperationLabel(op.op) }}
                      </NTag>
                      <NText class="patch-instruction">{{ op.instruction }}</NText>
                    </div>
                    <div class="patch-diff-inline">
                      <InlineDiff :old-text="op.oldText" :new-text="op.newText" />
                    </div>
                    <NButton size="tiny" type="primary" class="patch-apply-btn" @click="handleApplyPatchLocal(op)">
                      {{ t('evaluation.diagnose.replaceNow') }}
                    </NButton>
                  </div>
                </NListItem>
              </NList>
            </NCard>

            <!-- 改进建议 -->
            <NCard
              v-if="result.improvements && result.improvements.length > 0"
              :title="t('evaluation.improvements')"
              size="small"
            >
              <NList>
                <NListItem v-for="(item, index) in result.improvements" :key="index">
                  <div class="improvement-item">
                    <NText type="info" class="improvement-text">{{ item }}</NText>
                    <NButton size="tiny" type="primary" @click="handleApplyImprovement(item)">
                      {{ t('evaluation.applyToIterate') }}
                    </NButton>
                  </div>
                </NListItem>
              </NList>
            </NCard>

            <!-- 反馈输入（可选） -->
            <NCard
              v-if="currentType"
              size="small"
              class="feedback-section"
            >
              <template #header>
                <NSpace align="center" :size="8">
                  <span class="feedback-card-title">{{ t('evaluation.feedbackTitle') }}</span>
                  <NTag size="small" round :bordered="false" type="default" class="optional-tag">
                    {{ t('evaluation.optional') }}
                  </NTag>
                </NSpace>
              </template>
              <FeedbackEditor
                v-model="feedbackDraft"
                :show-actions="false"
                :disabled="isActionDisabled"
              />
            </NCard>
          </NSpace>
        </NScrollbar>
      </template>

      <!-- 空状态 -->
      <template v-else>
        <NSpace vertical :size="12" style="width: 100%;">
          <NAlert
            v-if="evaluationDisableMessage"
            type="warning"
            :show-icon="false"
            :bordered="false"
            class="stale-alert"
          >
            {{ evaluationDisableMessage }}
          </NAlert>
          <NEmpty :description="t('evaluation.noResult')">
            <template #icon>
              <NIcon :size="48" :depth="3" aria-hidden="true">
                <ChartBar />
              </NIcon>
            </template>
          </NEmpty>

          <NCard
            v-if="currentType"
            size="small"
            class="feedback-section"
          >
            <template #header>
              <NSpace align="center" :size="8">
                <span class="feedback-card-title">{{ t('evaluation.feedbackTitle') }}</span>
                <NTag size="small" round :bordered="false" type="default" class="optional-tag">
                  {{ t('evaluation.optional') }}
                </NTag>
              </NSpace>
            </template>
            <FeedbackEditor
              v-model="feedbackDraft"
              :show-actions="false"
              :disabled="isActionDisabled"
            />
          </NCard>
        </NSpace>
      </template>

      <!-- 底部操作栏 -->
      <template #footer>
        <NSpace justify="space-between" style="width: 100%;">
          <NButton v-if="result" @click="handleClear" quaternary>
            {{ t('common.clear') }}
          </NButton>
          <NSpace>
            <NTooltip
              v-if="canShowRewriteAction"
              trigger="hover"
              :disabled="!rewriteHintMessage"
              :theme-overrides="tooltipThemeOverrides"
              :overlay-style="tooltipOverlayStyle"
              :content-style="tooltipContentStyle"
            >
              <template #trigger>
                <NButton
                  :type="rewriteButtonIsSoft ? 'default' : 'primary'"
                  :quaternary="rewriteButtonIsSoft"
                  :disabled="isRewriteDisabled"
                  data-testid="evaluation-panel-rewrite-from-evaluation"
                  @click="handleRewriteFromEvaluation"
                >
                  {{ rewriteButtonLabel }}
                </NButton>
              </template>
              <span>{{ rewriteHintMessage }}</span>
            </NTooltip>
            <NTooltip
              v-if="currentType"
              trigger="hover"
              :disabled="!evaluationDisableMessage"
              :theme-overrides="tooltipThemeOverrides"
              :overlay-style="tooltipOverlayStyle"
              :content-style="tooltipContentStyle"
            >
              <template #trigger>
                <span class="evaluation-panel-action-trigger">
                  <NButton
                    type="primary"
                    :disabled="isActionDisabled"
                    :loading="isEvaluating"
                    data-testid="evaluation-panel-re-evaluate"
                    @click="handleReEvaluateClick"
                  >
                    {{ t('evaluation.reEvaluate') }}
                  </NButton>
                </span>
              </template>
              <span>{{ evaluationDisableMessage }}</span>
            </NTooltip>
            <NButton @click="handleClose">
              {{ t('common.close') }}
            </NButton>
          </NSpace>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import OutputSourceView from '../OutputSourceView.vue'
import { getOutputDocument, type OutputRecord } from '../../utils/output-document'
import { useI18n } from 'vue-i18n'
import {
  NDrawer,
  NDrawerContent,
  NSpace,
  NCard,
  NText,
  NButton,
  NIcon,
  NProgress,
  NResult,
  NSpin,
  NScrollbar,
  NEmpty,
  NAlert,
  NList,
  NListItem,
  NTag,
  NTooltip,
} from 'naive-ui'
import { ChartBar } from '@vicons/tabler'
import type { EvaluationResponse, EvaluationType, PatchOperation } from '@prompt-optimizer/core'
import {
  getCompareEvaluationMetadata,
  getCompareInsights,
} from '../../composables/prompt/compareResultMetadata'
import InlineDiff from './InlineDiff.vue'
import FeedbackEditor from './FeedbackEditor.vue'
import CompareHelpButton from './CompareHelpButton.vue'
import { useTooltipTheme } from '../../composables/ui/useTooltipTheme'

type CompareDecisionSummary = {
  recommendation: 'continue' | 'stop' | 'review'
  recommendationLabel: string
  recommendationType: 'success' | 'warning' | 'error' | 'info' | 'default'
  headline: string
  signalChips: Array<{
    key: string
    label: string
    value: string
    type: 'success' | 'warning' | 'error' | 'info' | 'default'
  }>
}

type CompareReasonCard = {
  key: string
  title: string
  body: string
}

// Props
const props = defineProps<{
  show: boolean
  isEvaluating: boolean
  currentType: EvaluationType | null
  result: EvaluationResponse | null
  streamContent: string
  outputRecord?: OutputRecord
  error: string | null
  scoreLevel: 'excellent' | 'good' | 'acceptable' | 'poor' | 'very-poor' | null
  stale?: boolean
  staleMessage?: string
  disableEvaluate?: boolean
  disableEvaluateReason?: string
  canRewriteFromEvaluation?: boolean
  rewriteRecommendation?: 'skip' | 'minor-rewrite' | 'rewrite' | null
  rewriteReasons?: string[]
}>()

// Emits
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'clear'): void
  (e: 'retry'): void
  (e: 're-evaluate'): void
  (e: 'evaluate-with-feedback', payload: { feedback: string }): void
  (e: 'apply-local-patch', payload: { operation: PatchOperation }): void
  (e: 'apply-improvement', payload: {
    improvement: string;
    type: EvaluationType;
  }): void
  (e: 'rewrite-from-evaluation', payload: {
    result: EvaluationResponse;
    type: EvaluationType;
  }): void
}>()

const { t } = useI18n()
const {
  tooltipThemeOverrides,
  tooltipOverlayStyle,
  tooltipContentStyle,
} = useTooltipTheme({
  maxWidth: '320px',
  whiteSpace: 'normal',
  overflowWrap: 'break-word',
})

// 流式内容滚动条引用
const feedbackDraft = ref('')
const activeCompareReasonKey = ref<string | null>(null)
const isActionDisabled = computed(() => props.isEvaluating || !!props.disableEvaluate)
const evaluationDisableMessage = computed(() =>
  isActionDisabled.value ? (props.disableEvaluateReason || '').trim() : ''
)
const currentEvaluationType = computed<EvaluationType>(() =>
  props.currentType || props.result?.type || 'prompt-only'
)
const canShowRewriteAction = computed(() =>
  !!props.canRewriteFromEvaluation && !!props.result
)
const isRewriteDisabled = computed(() =>
  !props.result || props.isEvaluating || !!props.stale
)
const rewriteButtonLabel = computed(() =>
  tOr('evaluation.compareSummary.rewriteButton', 'Rewrite from This Evaluation')
)
const rewriteButtonIsSoft = computed(() =>
  props.rewriteRecommendation === 'skip'
)
const rewriteHintMessage = computed(() => {
  const reasons = collectUniqueCompareNotes(props.rewriteReasons || [], 2)
  if (reasons.length) {
    return reasons.join(' ')
  }

  if (props.rewriteRecommendation === 'skip') {
    return tOr(
      'evaluation.compareSummary.rewriteSkipHint',
      'The current guidance is to keep the prompt as-is unless you have already confirmed there is still clear, reusable improvement headroom.'
    )
  }

  if (props.rewriteRecommendation === 'minor-rewrite') {
    return tOr(
      'evaluation.compareSummary.rewriteMinorHint',
      'A smaller correction is recommended here instead of another large rewrite.'
    )
  }

  return ''
})

const tOr = (key: string, fallback: string): string => {
  const translated = t(key)
  return translated === key ? fallback : translated
}

const normalizeInlineText = (value: string | undefined): string =>
  (value || '').replace(/\s+/gu, ' ').trim()

const collectUniqueCompareNotes = (
  values: Array<string | undefined>,
  limit = 4,
): string[] => {
  const seen = new Set<string>()
  const results: string[] = []

  for (const value of values) {
    const normalized = normalizeInlineText(value)
    if (!normalized) continue

    const dedupeKey = normalized.toLocaleLowerCase()
    if (seen.has(dedupeKey)) continue

    seen.add(dedupeKey)
    results.push(normalized)

    if (results.length >= limit) {
      break
    }
  }

  return results
}

const compareMetadata = computed(() =>
  props.currentType === 'compare' ? getCompareEvaluationMetadata(props.result) : null
)

const compareMode = computed(() =>
  compareMetadata.value?.compareMode ?? null
)

const compareStopSignals = computed(() =>
  compareMetadata.value?.compareStopSignals
)

const formatCompareMode = (mode: string | null): string => {
  if (!mode) return ''

  switch (mode) {
    case 'structured':
      return tOr('evaluation.compareShared.modeValues.structured', 'Smart Compare')
    case 'generic':
      return tOr('evaluation.compareShared.modeValues.generic', 'Standard Compare')
    default:
      return mode
  }
}

const formatCompareRole = (role: string): string => {
  switch (role) {
    case 'target':
      return tOr('evaluation.compareShared.roleValues.target', 'Optimization Target')
    case 'baseline':
      return tOr('evaluation.compareShared.roleValues.baseline', 'Previous Version')
    case 'reference':
      return tOr('evaluation.compareShared.roleValues.reference', 'Teacher')
    case 'referenceBaseline':
      return tOr('evaluation.compareShared.roleValues.referenceBaseline', 'Teacher Previous Version')
    case 'replica':
      return tOr('evaluation.compareShared.roleValues.replica', 'Retest')
    case 'auxiliary':
      return tOr('evaluation.compareShared.roleValues.auxiliary', 'Other Test')
    default:
      return role
  }
}

const compareSnapshotRoleEntries = computed(() => {
  const rolePriority: Record<string, number> = {
    target: 0,
    baseline: 1,
    reference: 2,
    referenceBaseline: 3,
    replica: 4,
    auxiliary: 5,
  }

  return Object.entries(compareMetadata.value?.snapshotRoles || {})
    .sort(([leftSnapshotId, leftRole], [rightSnapshotId, rightRole]) => {
      const leftPriority = rolePriority[leftRole] ?? 999
      const rightPriority = rolePriority[rightRole] ?? 999

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }

      return leftSnapshotId.localeCompare(rightSnapshotId)
    })
    .map(([snapshotId, role]) => ({
      snapshotId,
      role,
      label: formatCompareRole(role),
    }))
})

const compareSnapshotDisplayEntries = computed(() =>
  [...compareSnapshotRoleEntries.value].sort((left, right) =>
    left.snapshotId.localeCompare(right.snapshotId)
  )
)

const hasCompareReferenceContext = computed(() =>
  compareSnapshotRoleEntries.value.some((entry) =>
    entry.role === 'reference' || entry.role === 'referenceBaseline'
  )
)

const shouldShowCompareModeChip = computed(() => compareMode.value === 'generic')

const formatStopSignalValue = (key: string, value: string): string => {
  const translationKey = `evaluation.compareMetadata.signalValues.${key}.${value}`

  switch (key) {
    case 'targetVsBaseline':
      return tOr(translationKey, {
        improved: 'Improved',
        flat: 'Flat',
        regressed: 'Regressed',
      }[value] || value)
    case 'targetVsReferenceGap':
      return tOr(translationKey, {
        none: 'None',
        minor: 'Minor',
        major: 'Major',
      }[value] || value)
    case 'improvementHeadroom':
      return tOr(translationKey, {
        none: 'None',
        low: 'Low',
        medium: 'Medium',
        high: 'High',
      }[value] || value)
    case 'overfitRisk':
      return tOr(translationKey, {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
      }[value] || value)
    case 'stopRecommendation':
      return tOr(`evaluation.compareShared.recommendationValues.${value}`, {
        continue: 'Keep Iterating',
        stop: 'Stop for Now',
        review: 'Needs Review',
      }[value] || value)
    default:
      return value
  }
}

const getStopSignalLabel = (key: string): string => {
  switch (key) {
    case 'targetVsBaseline':
      return tOr('evaluation.compareMetadata.targetVsBaseline', 'Optimization Target vs Previous Version')
    case 'targetVsReferenceGap':
      return tOr('evaluation.compareMetadata.targetVsReferenceGap', 'Optimization Target vs Teacher Gap')
    case 'improvementHeadroom':
      return tOr('evaluation.compareMetadata.improvementHeadroom', 'Improvement Headroom')
    case 'overfitRisk':
      return tOr('evaluation.compareMetadata.overfitRisk', 'Overfit Risk')
    case 'stopRecommendation':
      return tOr('evaluation.compareMetadata.stopRecommendation', 'Stop Recommendation')
    default:
      return key
  }
}

const getCompactStopSignalLabel = (key: string): string => {
  switch (key) {
    case 'targetVsBaseline':
      return tOr('evaluation.compareSummary.compactSignals.targetVsBaseline', 'Previous')
    case 'targetVsReferenceGap':
      return tOr('evaluation.compareSummary.compactSignals.targetVsReferenceGap', 'Teacher Gap')
    case 'improvementHeadroom':
      return tOr('evaluation.compareSummary.compactSignals.improvementHeadroom', 'Headroom')
    case 'overfitRisk':
      return tOr('evaluation.compareSummary.compactSignals.overfitRisk', 'Overfit')
    default:
      return getStopSignalLabel(key)
  }
}

const getStopSignalType = (key: string, value: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
  if (key === 'targetVsBaseline') {
    if (value === 'improved') return 'success'
    if (value === 'regressed') return 'error'
    return 'warning'
  }
  if (key === 'targetVsReferenceGap') {
    if (value === 'none') return 'success'
    if (value === 'major') return 'warning'
    return 'info'
  }
  if (key === 'improvementHeadroom') {
    if (value === 'none' || value === 'low') return 'success'
    if (value === 'high') return 'warning'
    return 'info'
  }
  if (key === 'overfitRisk') {
    if (value === 'high') return 'error'
    if (value === 'medium') return 'warning'
    return 'success'
  }
  if (key === 'stopRecommendation') {
    if (value === 'stop') return 'warning'
    if (value === 'review') return 'error'
    return 'success'
  }
  return 'default'
}

const compareInsights = computed(() =>
  props.currentType === 'compare'
    ? getCompareInsights(props.result)
    : undefined
)

const getCompareDecisionHeadline = (
  recommendation: 'continue' | 'stop' | 'review',
  targetVsBaseline: 'improved' | 'flat' | 'regressed' | undefined,
): string => {
  if (targetVsBaseline === 'regressed') {
    return tOr(
      'evaluation.compareMetadata.decision.headlines.regressed',
      'The optimization target appears to have regressed relative to the previous version; do not accept this rewrite directly.'
    )
  }

  if (recommendation === 'stop') {
    return tOr(
      'evaluation.compareMetadata.decision.headlines.stop',
      'The current result looks close to convergence; further automatic rewrites are unlikely to help much.'
    )
  }

  if (recommendation === 'review') {
    return tOr(
      'evaluation.compareMetadata.decision.headlines.review',
      'The current compare result needs manual review before accepting another rewrite.'
    )
  }

  return tOr(
    'evaluation.compareMetadata.decision.headlines.continue',
    'The optimization target is moving in the right direction, but there is still actionable improvement headroom.'
  )
}

const compareDecisionSummary = computed<CompareDecisionSummary | null>(() => {
  if (props.currentType !== 'compare') return null

  const stopSignals = compareStopSignals.value
  const insights = compareInsights.value
  if (!stopSignals && !insights) return null

  const targetVsBaseline = stopSignals?.targetVsBaseline
  const improvementHeadroom = stopSignals?.improvementHeadroom
  const overfitRisk = stopSignals?.overfitRisk

  const recommendation: 'continue' | 'stop' | 'review' =
    targetVsBaseline === 'regressed' || overfitRisk === 'high'
      ? 'review'
      : stopSignals?.stopRecommendation || 'continue'

  const recommendationType = recommendation === 'continue'
    ? 'success'
    : recommendation === 'stop'
      ? 'warning'
      : 'error'

  type CompareSignalChipKey =
    | 'targetVsBaseline'
    | 'targetVsReferenceGap'
    | 'overfitRisk'
    | 'improvementHeadroom'

  const preferredSignalKeys: CompareSignalChipKey[] = [
    'targetVsBaseline',
    'targetVsReferenceGap',
    'overfitRisk',
  ]

  const visibleSignalKeys: CompareSignalChipKey[] = preferredSignalKeys.filter((key) => {
    if (key === 'targetVsReferenceGap' && !hasCompareReferenceContext.value) {
      return false
    }

    return !!stopSignals?.[key]
  })
  if (!visibleSignalKeys.length && improvementHeadroom) {
    visibleSignalKeys.push('improvementHeadroom')
  }

  const signalChips = visibleSignalKeys.flatMap((key) => {
    const value = stopSignals?.[key]
    if (!value) return []

    return [{
      key,
      label: getCompactStopSignalLabel(key),
      value: formatStopSignalValue(key, value),
      type: getStopSignalType(key, value),
    }]
  })

  return {
    recommendation,
    recommendationLabel: formatStopSignalValue('stopRecommendation', recommendation),
    recommendationType,
    headline: getCompareDecisionHeadline(recommendation, targetVsBaseline),
    signalChips,
  }
})

const displaySummaryText = computed(() => {
  const summary = props.result?.summary?.trim() || ''
  if (summary) {
    return summary
  }

  if (props.currentType === 'compare') {
    return compareDecisionSummary.value?.headline || ''
  }

  return ''
})

const compareSecondaryHeadline = computed(() => {
  if (props.currentType !== 'compare') return ''

  const headline = compareDecisionSummary.value?.headline?.trim() || ''
  if (!headline) return ''

  const summary = displaySummaryText.value
  if (!summary || summary === headline) {
    return ''
  }

  return headline
})

const compareReasonCards = computed<CompareReasonCard[]>(() => {
  if (props.currentType !== 'compare') return []

  const stopSignals = compareStopSignals.value
  const insights = compareInsights.value
  const cards: CompareReasonCard[] = []

  const targetVsBaseline = stopSignals?.targetVsBaseline
  if (insights?.progressSummary || targetVsBaseline) {
    const body = insights?.progressSummary?.analysis || (() => {
      switch (targetVsBaseline) {
        case 'improved':
          return tOr(
            'evaluation.compareSummary.reasonBodies.progress.improved',
            'The optimization target is ahead of the previous version, but you should still confirm which gains are truly reusable.'
          )
        case 'flat':
          return tOr(
            'evaluation.compareSummary.reasonBodies.progress.flat',
            'The optimization target is close to the previous version, so you should combine teacher and stability evidence before deciding the next step.'
          )
        case 'regressed':
          return tOr(
            'evaluation.compareSummary.reasonBodies.progress.regressed',
            'The optimization target regressed relative to the previous version, so you should inspect what went backward first.'
          )
        default:
          return ''
      }
    })()

    if (body) {
      cards.push({
        key: 'progress',
        title: tOr('evaluation.compareSummary.reasonTitles.progress', 'Previous'),
        body,
      })
    }
  }

  const targetVsReferenceGap = hasCompareReferenceContext.value
    ? stopSignals?.targetVsReferenceGap
    : undefined
  if (hasCompareReferenceContext.value && (insights?.referenceGapSummary || targetVsReferenceGap)) {
    const body = insights?.referenceGapSummary?.analysis || (() => {
      switch (targetVsReferenceGap) {
        case 'none':
          return tOr(
            'evaluation.compareSummary.reasonBodies.reference.none',
            'The optimization target is already close to the teacher, so another rewrite may have limited payoff.'
          )
        case 'minor':
          return tOr(
            'evaluation.compareSummary.reasonBodies.reference.minor',
            'There are still a few structural moves the optimization target can learn from the teacher.'
          )
        case 'major':
          return tOr(
            'evaluation.compareSummary.reasonBodies.reference.major',
            'There is still a clear gap to the teacher, so the next round should focus on learning the stronger teacher-side strategy.'
          )
        default:
          return ''
      }
    })()

    if (body) {
      cards.push({
        key: 'reference',
        title: tOr('evaluation.compareSummary.reasonTitles.reference', 'Teacher'),
        body,
      })
    }
  }

  const overfitRisk = stopSignals?.overfitRisk
  const improvementHeadroom = stopSignals?.improvementHeadroom
  if (insights?.stabilitySummary) {
    const body = insights?.stabilitySummary?.analysis || (() => {
      if (overfitRisk === 'high') {
        return tOr(
          'evaluation.compareSummary.reasonBodies.stability.high',
          'The current gain may contain strong sample-fitting risk, so overfit rules should be filtered before another rewrite.'
        )
      }
      if (overfitRisk === 'medium') {
        return tOr(
          'evaluation.compareSummary.reasonBodies.stability.medium',
          'There is still some overfit risk, so the next round should preserve only reusable rules more conservatively.'
        )
      }
      if (improvementHeadroom === 'none' || improvementHeadroom === 'low') {
        return tOr(
          'evaluation.compareSummary.reasonBodies.stability.low',
          'The result is already close to convergence, so confirm there is still real improvement headroom before adding more rules.'
        )
      }

      return tOr(
        'evaluation.compareSummary.reasonBodies.stability.default',
        'You still need more shared-input evidence to confirm whether this conclusion is stable.'
      )
    })()

    cards.push({
      key: 'stability',
      title: tOr('evaluation.compareSummary.reasonTitles.stability', 'Stability'),
      body,
    })
  }

  return cards
})

const activeCompareReasonCard = computed<CompareReasonCard | null>(() => {
  const cards = compareReasonCards.value
  if (!cards.length) return null

  return cards.find((card) => card.key === activeCompareReasonKey.value) || cards[0]
})

watch(
  () => [props.show, props.currentType, compareReasonCards.value.map((card) => card.key).join('|')] as const,
  ([visible, currentType]) => {
    if (!visible || currentType !== 'compare') {
      activeCompareReasonKey.value = null
      return
    }

    const cards = compareReasonCards.value
    if (!cards.length) {
      activeCompareReasonKey.value = null
      return
    }

    if (!activeCompareReasonKey.value || !cards.some((card) => card.key === activeCompareReasonKey.value)) {
      activeCompareReasonKey.value = cards[0].key
    }
  },
  { immediate: true },
)

const hasCompareMetadata = computed(() =>
  !!compareMode.value ||
  compareSnapshotRoleEntries.value.length > 0
)

// 面板标题
const panelTitle = computed(() => {
  switch (props.currentType) {
    case 'result':
      return t('evaluation.title.result')
    case 'compare':
      return t('evaluation.title.compare')
    case 'prompt-only':
      return t('evaluation.title.promptOnly')
    case 'prompt-iterate':
      return t('evaluation.title.promptIterate')
    default:
      return t('evaluation.title.default')
  }
})

// 评分等级样式类
const scoreLevelClass = computed(() => {
  if (!props.scoreLevel) return ''
  return `score-${props.scoreLevel}`
})

// 评分等级文本
const scoreLevelText = computed(() => {
  switch (props.scoreLevel) {
    case 'excellent':
      return t('evaluation.level.excellent')
    case 'good':
      return t('evaluation.level.good')
    case 'acceptable':
      return t('evaluation.level.acceptable')
    case 'poor':
      return t('evaluation.level.poor')
    case 'very-poor':
      return t('evaluation.level.veryPoor')
    default:
      return ''
  }
})

// 获取维度分数样式类
const getDimensionScoreClass = (score: number): string => {
  if (score >= 90) return 'score-excellent'
  if (score >= 80) return 'score-good'
  if (score >= 60) return 'score-acceptable'
  if (score >= 40) return 'score-poor'
  return 'score-very-poor'
}

// 获取进度条状态
const getDimensionStatus = (score: number): 'success' | 'warning' | 'error' | 'default' => {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'error'
}

// 处理显示更新
const handleUpdateShow = (value: boolean) => {
  emit('update:show', value)
}

// 关闭面板
const handleClose = () => {
  emit('update:show', false)
}

// 清除结果
const handleClear = () => {
  emit('clear')
}

// 重试评估
const handleRetry = () => {
  if (isActionDisabled.value) return
  emit('retry')
}

// 重新评估
const handleReEvaluateClick = () => {
  if (isActionDisabled.value) return

  const trimmed = feedbackDraft.value.trim()

  if (trimmed) {
    emit('evaluate-with-feedback', { feedback: trimmed })
    feedbackDraft.value = ''
    return
  }

  emit('re-evaluate')
}

// 应用改进建议到迭代
const handleApplyImprovement = (improvement: string) => {
  emit('apply-improvement', {
    improvement,
    type: currentEvaluationType.value
  })
}

const handleRewriteFromEvaluation = () => {
  if (isRewriteDisabled.value || !props.result) return

  emit('rewrite-from-evaluation', {
    result: props.result,
    type: currentEvaluationType.value,
  })
}

// ===== patchPlan 相关逻辑 =====

// 获取操作类型样式
const getOperationType = (op: string): 'success' | 'warning' | 'error' | 'info' => {
  switch (op) {
    case 'insert': return 'success'
    case 'replace': return 'warning'
    case 'delete': return 'error'
    default: return 'info'
  }
}

const getOperationLabel = (op: string): string => {
  return tOr(`evaluation.diagnose.operation.${op}`, op)
}

const handleApplyPatchLocal = (operation: PatchOperation) => {
  emit('apply-local-patch', { operation })
}

watch(() => props.show, (visible) => {
  if (!visible) {
    feedbackDraft.value = ''
  }
})
</script>

<style scoped>
.evaluation-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 16px;
}

.loading-text {
  font-size: 14px;
}

.stream-preview {
  width: 100%;
  margin-top: 16px;
  padding: 12px;
  background: var(--n-color-embedded);
  border-radius: 8px;
}

.stream-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
}

.stream-content {
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}

.score-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  background: var(--n-color-embedded);
  border-radius: 12px;
}

.overall-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 4px solid currentColor;
  margin-bottom: 12px;
}

.evaluation-panel-action-trigger {
  display: inline-flex;
}

.score-value {
  font-size: 36px;
  font-weight: bold;
}

.score-label {
  font-size: 12px;
  opacity: 0.8;
}

.score-level-text {
  font-size: 14px;
}

/* 评分等级颜色 */
.score-excellent {
  color: var(--n-success-color);
}

.score-good {
  color: var(--n-info-color);
}

.score-acceptable {
  color: var(--n-warning-color);
}

.score-poor {
  color: var(--n-error-color);
}

.score-very-poor {
  color: var(--n-error-color);
}

.dimension-item {
  width: 100%;
}

.compare-meta-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compare-judgement-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--n-border-color);
}

.compare-judgement-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.compare-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.compare-section-header__main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.compare-decision-subheadline {
  line-height: 1.5;
  font-size: 13px;
}

.compare-decision-signals {
  flex-wrap: wrap;
}

.compare-context-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--n-color-embedded);
  border: 1px solid var(--n-border-color);
}

.compare-role-inline-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
}

.compare-role-inline-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--n-hover-color);
}

.compare-role-inline-item--target {
  background: var(--n-success-color-suppl);
}

.compare-role-inline-label {
  font-size: 12px;
  line-height: 1.2;
}

.compare-focus-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compare-focus-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.compare-focus-tab {
  max-width: 100%;
}

.compare-focus-tab__title {
  display: inline-flex;
  align-items: center;
}

.compare-focus-panel {
  padding: 10px 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color-embedded);
}

.compare-focus-panel__body {
  line-height: 1.6;
}

.compare-judgement-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.compare-judgement-side {
  font-size: 12px;
}

.compare-judgement-analysis {
  line-height: 1.5;
}

.compare-judgement-extra {
  font-size: 12px;
  line-height: 1.5;
}

.dimension-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.analysis-text {
  white-space: pre-wrap;
  line-height: 1.6;
}

/* 改进建议项 */
.improvement-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
}

.improvement-text {
  flex: 1;
  word-break: break-word;
}

/* patchPlan 相关样式 */
.patch-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.patch-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.patch-instruction {
  flex: 1;
  word-break: break-word;
  font-size: 13px;
}

.patch-diff-inline {
  background: var(--n-color-embedded);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
}

.patch-apply-btn {
  align-self: flex-end;
}

.feedback-section {
  margin: 0;
}

.feedback-section :deep(.n-card__header) {
  padding: 10px 12px 6px;
}

.feedback-section :deep(.n-card__content) {
  padding: 0 12px 12px;
}

.feedback-card-title {
  font-weight: 600;
}

.optional-tag {
  opacity: 0.85;
}

.stale-alert {
  margin-bottom: -4px;
}

</style>
