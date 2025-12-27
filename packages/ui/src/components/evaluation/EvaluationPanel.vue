<template>
  <NDrawer
    :show="show"
    :width="420"
    placement="right"
    :on-update:show="handleUpdateShow"
  >
    <NDrawerContent :title="panelTitle" closable>
      <!-- 加载状态 -->
      <template v-if="isEvaluating">
        <div class="evaluation-loading">
          <NSpin size="large" />
          <NText depth="3" class="loading-text">{{ t('evaluation.loading') }}</NText>
          <!-- 流式内容预览 -->
          <div v-if="streamContent" class="stream-preview">
            <NText depth="3" class="stream-label">{{ t('evaluation.analyzing') }}</NText>
            <NScrollbar ref="streamScrollbarRef" style="max-height: 200px;">
              <NText class="stream-content">{{ streamContent }}</NText>
            </NScrollbar>
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
            <NButton @click="handleRetry">{{ t('common.retry') }}</NButton>
          </template>
        </NResult>
      </template>

      <!-- 评估结果 -->
      <template v-else-if="result">
        <NScrollbar style="max-height: calc(100vh - 120px);">
          <NSpace vertical :size="20">
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
            <NCard v-if="result.summary" size="small">
              <NText>{{ result.summary }}</NText>
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
            <NCard v-if="result.improvements && result.improvements.length > 0" :title="t('evaluation.improvements')" size="small">
              <NList>
                <NListItem v-for="(item, index) in result.improvements" :key="index">
                  <div class="improvement-item">
                    <NText type="info" class="improvement-text">{{ item }}</NText>
                    <NButton size="tiny" type="primary" ghost @click="handleApplyImprovement(item)">
                      {{ t('evaluation.applyToIterate') }}
                    </NButton>
                  </div>
                </NListItem>
              </NList>
            </NCard>
          </NSpace>
        </NScrollbar>
      </template>

      <!-- 空状态 -->
      <template v-else>
        <NEmpty :description="t('evaluation.noResult')">
          <template #icon>
            <span style="font-size: 48px;">📊</span>
          </template>
        </NEmpty>
      </template>

      <!-- 底部操作栏 -->
      <template #footer>
        <NSpace justify="space-between" style="width: 100%;">
          <NButton v-if="result" @click="handleClear" quaternary>
            {{ t('common.clear') }}
          </NButton>
          <NSpace>
            <NButton
              v-if="result && !isEvaluating"
              type="primary"
              secondary
              @click="handleReEvaluate"
            >
              {{ t('evaluation.reEvaluate') }}
            </NButton>
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
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NDrawer,
  NDrawerContent,
  NSpace,
  NCard,
  NText,
  NButton,
  NProgress,
  NResult,
  NSpin,
  NScrollbar,
  NEmpty,
  NList,
  NListItem,
  NTag,
  type ScrollbarInst,
} from 'naive-ui'
import type { EvaluationResponse, EvaluationType, PatchOperation } from '@prompt-optimizer/core'
import InlineDiff from './InlineDiff.vue'

// Props
const props = defineProps<{
  show: boolean
  isEvaluating: boolean
  currentType: EvaluationType | null
  result: EvaluationResponse | null
  streamContent: string
  error: string | null
  scoreLevel: 'excellent' | 'good' | 'acceptable' | 'poor' | 'very-poor' | null
}>()

// Emits
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'clear'): void
  (e: 'retry'): void
  (e: 're-evaluate'): void
  (e: 'apply-local-patch', payload: { operation: PatchOperation }): void
  (e: 'apply-improvement', payload: {
    improvement: string;
    type: EvaluationType;
  }): void
}>()

const { t } = useI18n()

// 流式内容滚动条引用
const streamScrollbarRef = ref<ScrollbarInst | null>(null)

// 监听流式内容变化，自动滚动到底部
watch(() => props.streamContent, () => {
  nextTick(() => {
    streamScrollbarRef.value?.scrollTo({ top: 999999, behavior: 'smooth' })
  })
})

const tOr = (key: string, fallback: string): string => {
  const translated = t(key)
  return translated === key ? fallback : translated
}

// 面板标题
const panelTitle = computed(() => {
  switch (props.currentType) {
    case 'original':
      return t('evaluation.title.original')
    case 'optimized':
      return t('evaluation.title.optimized')
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
  emit('retry')
}

// 重新评估
const handleReEvaluate = () => {
  emit('re-evaluate')
}

// 应用改进建议到迭代
const handleApplyImprovement = (improvement: string) => {
  emit('apply-improvement', {
    improvement,
    type: props.currentType || 'optimized'
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
  color: #18a058;
}

.score-good {
  color: #2080f0;
}

.score-acceptable {
  color: #f0a020;
}

.score-poor {
  color: #d03050;
}

.score-very-poor {
  color: #d03050;
}

.dimension-item {
  width: 100%;
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
</style>
