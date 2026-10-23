<template>
  <AdaptiveModal
    v-model:show="visible"
    preset="card"
    :title="$t('contextMode.preview.title')"
    :style="{ width: '80%', maxWidth: '1200px' }"
    :segmented="{ content: 'soft', footer: 'soft' }"
  >
    <NFlex vertical :size="16">
      <!-- 变量统计信息 -->
      <NCard size="small" :title="$t('contextMode.preview.stats')">
        <NFlex :size="12" :wrap="true">
          <NTag :bordered="false" type="info">
            {{ $t('contextMode.preview.totalVars') }}: {{ variableStats.total }}
          </NTag>
          <NTag :bordered="false" type="success">
            {{ $t('contextMode.preview.providedVars') }}: {{ variableStats.provided }}
          </NTag>
          <NTag v-if="variableStats.missing > 0" :bordered="false" type="warning">
            {{ $t('contextMode.preview.missingVars') }}: {{ variableStats.missing }}
          </NTag>
        </NFlex>
      </NCard>

      <!-- 缺失变量警告 -->
      <NCard
        v-if="hasMissingVariables"
        size="small"
        :title="$t('contextMode.preview.missingVarsWarning')"
        :segmented="{ content: true }"
      >
        <NFlex :size="8" :wrap="true">
          <NTag
            v-for="varName in missingVariables"
            :key="varName"
            type="warning"
            :bordered="false"
          >
            <span v-text="`{{${varName}}}`"></span>
          </NTag>
        </NFlex>
        <template #footer>
          <NText depth="3" :style="{ fontSize: '13px' }">
            {{ $t('contextMode.preview.missingVarsHint') }}
          </NText>
        </template>
      </NCard>

      <!-- 预览内容 -->
      <NCard size="small" :title="$t('contextMode.preview.renderedContent')">
        <NScrollbar :style="{ maxHeight: '400px' }">
          <div class="preview-content">
            {{ previewContent || $t('contextMode.preview.emptyContent') }}
          </div>
        </NScrollbar>
      </NCard>

      <!-- 模式说明 -->
      <NCard size="small" :title="$t('contextMode.preview.modeExplanation')">
        <NText depth="2" :style="{ fontSize: '14px' }">
          <template v-if="contextMode === 'user' && renderPhase === 'optimize'">
            {{ $t('contextMode.preview.userOptimizeHint') }}
          </template>
          <template v-else-if="contextMode === 'system' && renderPhase === 'optimize'">
            {{ $t('contextMode.preview.systemOptimizeHint') }}
          </template>
          <template v-else>
            {{ $t('contextMode.preview.testPhaseHint') }}
          </template>
        </NText>
      </NCard>
    </NFlex>

    <template #footer>
      <NFlex justify="end">
        <NButton @click="visible = false">
          {{ $t('common.close') }}
        </NButton>
      </NFlex>
    </template>
  </AdaptiveModal>
</template>

<script setup lang="ts">
import AdaptiveModal from './common/AdaptiveModal.vue'
import { ref, watch } from 'vue'

import {

  NCard,
  NFlex,
  NTag,
  NText,
  NButton,
  NScrollbar
} from 'naive-ui'
import type { ContextMode } from '@prompt-optimizer/core'

const props = defineProps<{
  /** 预览内容 */
  previewContent: string
  /** 缺失的变量 */
  missingVariables: string[]
  /** 是否有缺失变量 */
  hasMissingVariables: boolean
  /** 变量统计 */
  variableStats: {
    total: number
    builtin: number
    custom: number
    missing: number
    provided: number
  }
  /** 上下文模式 */
  contextMode: ContextMode
  /** 渲染阶段 */
  renderPhase: 'optimize' | 'test'
  /** 是否显示 */
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const visible = ref(props.show)

watch(
  () => props.show,
  (newValue) => {
    visible.value = newValue
  }
)

watch(visible, (newValue) => {
  emit('update:show', newValue)
})
</script>

<style scoped>
.preview-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: var(--n-font-family-mono);
  font-size: 14px;
  line-height: 1.6;
  padding: 12px;
  background-color: var(--n-color-embedded);
  border-radius: 4px;
}
</style>
