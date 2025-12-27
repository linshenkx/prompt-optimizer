<template>
  <div class="evaluation-hover-card">
    <!-- 加载状态 -->
    <div v-if="loading" class="hover-card-loading">
      <NSpin size="small" />
      <NText depth="3" style="font-size: 12px;">{{ t('evaluation.loading') }}</NText>
    </div>

    <!-- 有评估结果 -->
    <template v-else-if="result">
      <!-- 总分 + 等级 -->
      <div class="score-header">
        <div class="score-circle" :class="getScoreLevelClass(result.score.overall)">
          <span class="score-number">{{ result.score.overall }}</span>
        </div>
        <div class="score-info">
          <NTag :type="getScoreLevelType(result.score.overall)" size="small" round>
            {{ getScoreLevelText(result.score.overall) }}
          </NTag>
        </div>
      </div>

      <!-- 维度分数 -->
      <div class="dimensions-list">
        <div v-for="dim in result.score.dimensions" :key="dim.key" class="dimension-row">
          <NText depth="2" style="font-size: 11px; min-width: 56px;">{{ dim.label }}</NText>
          <NProgress
            :percentage="dim.score"
            :status="getDimensionStatus(dim.score)"
            :show-indicator="false"
            :height="5"
            style="flex: 1;"
          />
          <NText style="font-size: 11px; min-width: 24px; text-align: right;">{{ dim.score }}</NText>
        </div>
      </div>

      <!-- 精准修复（诊断分析） -->
      <div v-if="result.patchPlan && result.patchPlan.length > 0" class="section patches-section">
        <div class="section-header">
          <span class="section-icon">🛠️</span>
          <NText depth="2" style="font-size: 11px; font-weight: 600;">{{ t('evaluation.diagnose.title') }}</NText>
        </div>
        <div class="patch-list">
          <div v-for="(op, idx) in result.patchPlan" :key="idx" class="patch-item">
            <div class="patch-instruction">{{ op.instruction }}</div>
            <div class="patch-diff-inline">
              <InlineDiff :old-text="op.oldText" :new-text="op.newText" />
            </div>
            <NButton text size="tiny" type="primary" class="patch-apply-btn" @click.stop="handleApplyPatch(op)">
              {{ t('evaluation.diagnose.replaceNow') }}
            </NButton>
          </div>
        </div>
      </div>

      <!-- 改进建议 -->
      <div v-if="result.improvements && result.improvements.length > 0" class="section improvements-section">
        <div class="section-header">
          <span class="section-icon">💡</span>
          <NText depth="2" style="font-size: 11px; font-weight: 600;">{{ t('evaluation.improvements') }}</NText>
        </div>
        <ul class="section-list">
          <li v-for="(item, idx) in result.improvements" :key="idx" class="improvement-item">
            <span class="improvement-text">{{ item }}</span>
            <NButton text size="tiny" type="primary" class="apply-btn" @click.stop="handleApplyImprovement(item)">
              {{ t('evaluation.applyToIterate') }}
            </NButton>
          </li>
        </ul>
      </div>

      <!-- 一句话总结 -->
      <div v-if="result.summary" class="summary-box">
        <NText style="font-size: 12px;">{{ result.summary }}</NText>
      </div>

      <!-- 查看详情按钮 -->
      <div class="hover-card-footer">
        <NSpace justify="space-between" style="width: 100%;">
          <NButton text size="tiny" @click="handleShowDetail">
            {{ t('evaluation.viewDetails') }}
          </NButton>
          <NButton type="primary" size="tiny" @click="handleEvaluate">
            {{ t('evaluation.reEvaluate') }}
          </NButton>
        </NSpace>
      </div>
    </template>

    <!-- 无结果 -->
    <div v-else class="hover-card-empty">
      <NText depth="3" style="font-size: 12px; margin-bottom: 12px; display: block;">
        {{ t('evaluation.noResult') }}
      </NText>
          <NButton type="primary" size="small" @click="handleEvaluate">
            {{ t('evaluation.evaluate') }}
          </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NText, NTag, NProgress, NButton, NSpin, NSpace } from 'naive-ui'
import type { EvaluationResponse, EvaluationType, PatchOperation } from '@prompt-optimizer/core'
import InlineDiff from './InlineDiff.vue'

const props = defineProps<{
  result: EvaluationResponse | null
  type: EvaluationType
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'show-detail'): void
  (e: 'evaluate'): void
  (e: 'apply-improvement', payload: { improvement: string; type: EvaluationType }): void
  (e: 'apply-patch', payload: { operation: PatchOperation }): void
}>()

const { t } = useI18n()

// 获取分数等级样式类
const getScoreLevelClass = (score: number): string => {
  if (score >= 90) return 'level-excellent'
  if (score >= 80) return 'level-good'
  if (score >= 60) return 'level-acceptable'
  if (score >= 40) return 'level-poor'
  return 'level-very-poor'
}

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

// 处理评估
const handleEvaluate = () => {
  emit('evaluate')
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
  width: 360px;
  padding: 14px;
  max-height: 480px;
  overflow-y: auto;
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

/* 分数头部 */
.score-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.score-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid currentColor;
  flex-shrink: 0;
}

.score-number {
  font-size: 16px;
  font-weight: bold;
}

.score-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 维度列表 */
.dimensions-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--n-border-color);
}

.dimension-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 分区样式 */
.section {
  margin-bottom: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.section-icon {
  font-size: 12px;
}

.section-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--n-text-color-2);
  line-height: 1.6;
}

.section-list li {
  margin-bottom: 2px;
}

.section-list li:last-child {
  margin-bottom: 0;
}

/* 问题分区 */
.issues-section .section-list {
  color: #d03050;
}

/* 改进建议分区 */
.improvements-section .section-list {
  color: #2080f0;
}

/* 精准修复分区 */
.patch-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.patch-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: var(--n-color-embedded);
  border-radius: 6px;
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

/* 改进建议项 */
.improvement-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.improvement-text {
  flex: 1;
  word-break: break-word;
}

.apply-btn {
  flex-shrink: 0;
  font-size: 10px !important;
  padding: 0 4px !important;
  height: 18px !important;
}

/* 总结框 */
.summary-box {
  padding: 8px;
  background: var(--n-color-embedded);
  border-radius: 4px;
  margin-bottom: 8px;
}

/* 底部操作 */
.hover-card-footer {
  text-align: center;
  padding-top: 8px;
  border-top: 1px solid var(--n-border-color);
}

/* 分数等级颜色 */
.level-excellent {
  color: #18a058;
}

.level-good {
  color: #2080f0;
}

.level-acceptable {
  color: #f0a020;
}

.level-poor {
  color: #d03050;
}

.level-very-poor {
  color: #d03050;
}
</style>
