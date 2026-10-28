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
        <NIcon :size="16"><ChartIcon /></NIcon>
      </template>
      {{ t('evaluation.button') }}
    </NButton>
  </NDropdown>
</template>

<script setup lang="ts">
import { ChartNoAxesColumnIncreasing as ChartIcon } from '@lucide/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NDropdown, NButton, NIcon, type DropdownOption } from 'naive-ui'
import type { EvaluationType } from '@prompt-optimizer/core'

// Props
const props = defineProps<{
  /** 是否至少存在一个可评估结果 */
  hasResult: boolean
  /** 是否存在可执行的对比评估 */
  hasCompareResult?: boolean
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
  return props.hasResult
})

// 下拉菜单选项
const evaluationOptions = computed<DropdownOption[]>(() => {
  const options: DropdownOption[] = []

  if (props.hasResult) {
    options.push({
      label: t('evaluation.type.result'),
      key: 'result',
      disabled: !props.hasResult,
    })
  }

  if (props.hasResult && props.hasCompareResult) {
    options.push({
      type: 'divider',
      key: 'd1',
    })
    options.push({
      label: t('evaluation.type.compare'),
      key: 'compare',
      disabled: !props.hasCompareResult,
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
