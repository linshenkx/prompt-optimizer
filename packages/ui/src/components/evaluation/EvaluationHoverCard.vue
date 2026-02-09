<template>
  <div class="evaluation-hover-card">
    <!-- 加载状态 -->
    <div v-if="loading" class="hover-card-loading">
      <NSpin size="small" />
      <NText depth="3" class="meta-text">{{ t('evaluation.loading') }}</NText>
    </div>

    <!-- 有评估结果 -->
    <template v-else-if="result">
      <div class="hover-card-scroll">
        <!-- 总分 + 等级 -->
        <NSpace align="center" :size="12" class="score-header">
          <NProgress
            type="circle"
            :percentage="result.score.overall"
            :status="getDimensionStatus(result.score.overall)"
            :stroke-width="8"
            :circle-gap="0"
            :show-indicator="true"
            :indicator-text-color="undefined"
            :processing="false"
            class="overall-progress"
          />
          <div class="score-info">
            <NTag :type="getScoreLevelType(result.score.overall)" size="small" round>
              {{ getScoreLevelText(result.score.overall) }}
            </NTag>
          </div>
        </NSpace>

        <!-- 维度分数 -->
        <NCard embedded size="small" :bordered="false" class="section-card">
          <template #header>
            <NText depth="2" class="section-title">{{ t('evaluation.dimensions') }}</NText>
          </template>
          <NList :show-divider="false" class="compact-list">
            <NListItem v-for="dim in result.score.dimensions" :key="dim.key" class="compact-list-item">
              <div class="dimension-row">
                <NText depth="2" class="dimension-label">{{ dim.label }}</NText>
                <NProgress
                  :percentage="dim.score"
                  :status="getDimensionStatus(dim.score)"
                  :show-indicator="false"
                  :height="6"
                  class="dimension-progress"
                />
                <NText class="dimension-score">{{ dim.score }}</NText>
              </div>
            </NListItem>
          </NList>
        </NCard>

        <!-- 精准修复（诊断分析） -->
        <NCard
          v-if="result.patchPlan && result.patchPlan.length > 0"
          embedded
          size="small"
          :bordered="false"
          class="section-card"
        >
          <template #header>
            <NSpace align="center" :size="6">
              <NIcon size="14" depth="3" aria-hidden="true">
                <Tool />
              </NIcon>
              <NText depth="2" class="section-title">{{ t('evaluation.diagnose.title') }}</NText>
            </NSpace>
          </template>
          <NList :show-divider="false" class="compact-list">
            <NListItem v-for="(op, idx) in result.patchPlan" :key="idx" class="compact-list-item">
              <NSpace vertical :size="8" class="full-width">
                <NText class="patch-instruction">{{ op.instruction }}</NText>
                <div class="patch-diff-inline">
                  <InlineDiff :old-text="op.oldText" :new-text="op.newText" />
                </div>
                <NButton
                  size="tiny"
                  type="primary"
                  ghost
                  class="patch-apply-btn"
                  @click.stop="handleApplyPatch(op)"
                >
                  {{ t('evaluation.diagnose.replaceNow') }}
                </NButton>
              </NSpace>
            </NListItem>
          </NList>
        </NCard>

        <!-- 改进建议 -->
        <NCard
          v-if="result.improvements && result.improvements.length > 0"
          embedded
          size="small"
          :bordered="false"
          class="section-card"
        >
          <template #header>
            <NSpace align="center" :size="6">
              <NIcon size="14" depth="3" aria-hidden="true">
                <Bulb />
              </NIcon>
              <NText depth="2" class="section-title">{{ t('evaluation.improvements') }}</NText>
            </NSpace>
          </template>
          <NList :show-divider="false" class="compact-list">
            <NListItem v-for="(item, idx) in result.improvements" :key="idx" class="compact-list-item">
              <NSpace justify="space-between" align="start" :size="10" class="full-width">
                <NText depth="2" class="improvement-text">{{ item }}</NText>
                <NButton text size="tiny" type="primary" @click.stop="handleApplyImprovement(item)">
                  {{ t('evaluation.applyToIterate') }}
                </NButton>
              </NSpace>
            </NListItem>
          </NList>
        </NCard>

        <!-- 一句话总结 -->
        <NCard v-if="result.summary" embedded size="small" :bordered="false" class="section-card">
          <NText class="meta-text">{{ result.summary }}</NText>
        </NCard>

        <NDivider class="section-divider" />
        <NCard embedded size="small" :bordered="false" class="feedback-editor-card">
          <template #header>
            <NSpace align="center" :size="8">
              <NText depth="2" class="section-title">{{ t('evaluation.feedbackTitle') }}</NText>
              <NTag size="small" round :bordered="false" type="default" class="optional-tag">
                {{ t('evaluation.optional') }}
              </NTag>
            </NSpace>
          </template>
          <FeedbackEditor v-model="feedbackDraft" :show-actions="false" />
        </NCard>

        <NDivider class="section-divider" />
        <NSpace justify="space-between" class="full-width">
          <NButton text size="tiny" @click="handleShowDetail">
            {{ t('evaluation.viewDetails') }}
          </NButton>
          <NButton type="primary" size="tiny" @click="handleEvaluateClick">
            {{ t('evaluation.reEvaluate') }}
          </NButton>
        </NSpace>
      </div>
    </template>

    <!-- 无结果 -->
    <div v-else class="hover-card-empty">
      <NEmpty :description="t('evaluation.noResult')">
        <template #extra>
          <NSpace justify="center" :size="8">
            <NButton type="primary" size="small" @click="handleEvaluateClick">
              {{ t('evaluation.evaluate') }}
            </NButton>
          </NSpace>
        </template>
      </NEmpty>

      <NDivider class="section-divider" />
      <NCard embedded size="small" :bordered="false" class="feedback-editor-card">
        <template #header>
          <NSpace align="center" :size="8">
            <NText depth="2" class="section-title">{{ t('evaluation.feedbackTitle') }}</NText>
            <NTag size="small" round :bordered="false" type="default" class="optional-tag">
              {{ t('evaluation.optional') }}
            </NTag>
          </NSpace>
        </template>
        <FeedbackEditor v-model="feedbackDraft" :show-actions="false" />
      </NCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NCard, NDivider, NEmpty, NIcon, NList, NListItem, NProgress, NSpace, NSpin, NTag, NText } from 'naive-ui'
import type { EvaluationResponse, EvaluationType, PatchOperation } from '@prompt-optimizer/core'
import { Bulb, Tool } from '@vicons/tabler'
import InlineDiff from './InlineDiff.vue'
import FeedbackEditor from './FeedbackEditor.vue'

const props = defineProps<{
  result: EvaluationResponse | null
  type: EvaluationType
  loading?: boolean
  /** 由父组件传入，用于在 popover 关闭时重置内部编辑器状态 */
  visible?: boolean
}>()

const emit = defineEmits<{
  (e: 'show-detail'): void
  (e: 'evaluate'): void
  (e: 'evaluate-with-feedback', payload: { feedback: string }): void
  (e: 'apply-improvement', payload: { improvement: string; type: EvaluationType }): void
  (e: 'apply-patch', payload: { operation: PatchOperation }): void
}>()

const { t } = useI18n()
const feedbackDraft = ref('')

watch(
  () => props.visible,
  (visible) => {
    if (visible === false) {
      feedbackDraft.value = ''
    }
  }
)

// 获取分数等级标签类型
const getScoreLevelType = (score: number): 'success' | 'info' | 'warning' | 'error' => {
  if (score >= 80) return 'success'
  if (score >= 60) return 'info'
  if (score >= 40) return 'warning'
  return 'error'
}

// 获取分数等级文本
const getScoreLevelText = (score: number): string => {
  if (score >= 90) return t('evaluation.level.excellent')
  if (score >= 80) return t('evaluation.level.good')
  if (score >= 60) return t('evaluation.level.acceptable')
  if (score >= 40) return t('evaluation.level.poor')
  return t('evaluation.level.veryPoor')
}

// 获取维度进度条状态
const getDimensionStatus = (score: number): 'success' | 'warning' | 'error' | 'default' => {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'error'
}

// 处理查看详情
const handleShowDetail = () => {
  emit('show-detail')
}

const handleEvaluateClick = () => {
  const trimmed = feedbackDraft.value.trim()

  if (trimmed) {
    emit('evaluate-with-feedback', { feedback: trimmed })
    feedbackDraft.value = ''
    return
  }

  emit('evaluate')
  feedbackDraft.value = ''
}

// 处理应用改进建议到迭代
const handleApplyImprovement = (improvement: string) => {
  emit('apply-improvement', { improvement, type: props.type })
}

// 处理应用单个补丁
const handleApplyPatch = (operation: PatchOperation) => {
  emit('apply-patch', { operation })
}
</script>

<style scoped>
.evaluation-hover-card {
  width: min(360px, calc(100vw - 32px));
  /* 避免在视口底部被截断：高度随视口缩放，内容内部滚动 */
  max-height: min(480px, calc(100vh - 32px));
  box-sizing: border-box;
  padding: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hover-card-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.meta-text {
  font-size: 12px;
}

.hover-card-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
}

.hover-card-empty {
  text-align: center;
  padding: 16px 0;
}

.full-width {
  width: 100%;
}

/* 分数头部 */
.score-header {
  margin-bottom: 10px;
}

.overall-progress {
  width: 56px;
}

.score-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-card {
  margin-bottom: 10px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
}

.compact-list :deep(.n-list-item) {
  padding: 0;
}

.compact-list-item {
  padding: 6px 0;
}

.dimension-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dimension-label {
  min-width: 56px;
  font-size: 11px;
}

.dimension-progress {
  flex: 1;
}

.dimension-score {
  min-width: 24px;
  text-align: right;
  font-size: 11px;
}

.patch-instruction {
  font-size: 12px;
  font-weight: 500;
  word-break: break-word;
  color: var(--n-text-color);
}

.patch-diff-inline {
  font-size: 11px;
}

.patch-apply-btn {
  align-self: flex-end;
}

.improvement-text {
  word-break: break-word;
}

.section-divider {
  margin: 8px 0;
}

.icon-action-btn {
  padding: 0;
}

.feedback-editor-card {
  margin: 0;
  text-align: left;
}

.feedback-editor-card :deep(.n-card__header) {
  padding: 8px 10px 6px;
}

.feedback-editor-card :deep(.n-card__content) {
  padding: 0 10px 10px;
}

.optional-tag {
  opacity: 0.85;
}
</style>
