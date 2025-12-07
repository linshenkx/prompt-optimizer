<template>
  <NDropdown
    trigger="click"
    :options="evaluationOptions"
    @select="handleSelect"
  >
    <NButton
      :disabled="!hasAnyResult || isEvaluating"
      :loading="isEvaluating"
      quaternary
      size="small"
    >
      <template #icon>
        <NIcon><ChartIcon /></NIcon>
      </template>
      {{ t('evaluation.button') }}
    </NButton>
  </NDropdown>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { NDropdown, NButton, NIcon, type DropdownOption } from 'naive-ui'
import type { EvaluationType } from '@prompt-optimizer/core'

// 使用一个简单的 SVG 图标作为图表图标
const ChartIcon = {
  render() {
    return h('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      width: '1em',
      height: '1em',
      fill: 'currentColor',
    }, [
      h('path', {
        d: 'M3 3v18h18v-2H5V3H3zm4 14h2v-5H7v5zm4 0h2V8h-2v9zm4 0h2v-7h-2v7zm4 0h2V5h-2v12z',
      }),
    ])
  },
}

// Props
const props = defineProps<{
  /** 是否有原始测试结果 */
  hasOriginalResult: boolean
  /** 是否有优化后测试结果 */
  hasOptimizedResult: boolean
  /** 是否为对比模式 */
  isCompareMode: boolean
  /** 是否正在评估 */
  isEvaluating: boolean
}>()

// Emits
const emit = defineEmits<{
  (e: 'evaluate', type: EvaluationType): void
}>()

const { t } = useI18n()

// 是否有任何测试结果
const hasAnyResult = computed(() => {
  return props.hasOriginalResult || props.hasOptimizedResult
})

// 下拉菜单选项
const evaluationOptions = computed<DropdownOption[]>(() => {
  const options: DropdownOption[] = []

  // 原始提示词评估（需要有原始测试结果）
  if (props.hasOriginalResult) {
    options.push({
      label: t('evaluation.type.original'),
      key: 'original',
      disabled: !props.hasOriginalResult,
    })
  }

  // 优化后评估（需要有优化测试结果）
  if (props.hasOptimizedResult) {
    options.push({
      label: t('evaluation.type.optimized'),
      key: 'optimized',
      disabled: !props.hasOptimizedResult,
    })
  }

  // 对比评估（需要同时有两个结果，且在对比模式下）
  if (props.isCompareMode && props.hasOriginalResult && props.hasOptimizedResult) {
    options.push({
      type: 'divider',
      key: 'd1',
    })
    options.push({
      label: t('evaluation.type.compare'),
      key: 'compare',
      disabled: !(props.hasOriginalResult && props.hasOptimizedResult),
    })
  }

  return options
})

// 处理选择
const handleSelect = (key: string) => {
  emit('evaluate', key as EvaluationType)
}
</script>

<style scoped>
</style>
