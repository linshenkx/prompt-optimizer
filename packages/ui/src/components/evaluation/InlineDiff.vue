<template>
  <!-- 降级模式：文本过长或计算失败时直接显示新文本 -->
  <div v-if="fallback" class="inline-diff fallback">
    <span class="diff-added">{{ newText }}</span>
  </div>
  <!-- 正常 diff 模式 -->
  <div v-else class="inline-diff">
    <span
      v-for="fragment in fragments"
      :key="fragment.index"
      :class="getFragmentClass(fragment.type)"
    >{{ fragment.text }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import { createCompareService, type ChangeType, type TextFragment, type ICompareService } from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'
import { useNaiveTheme } from '../../composables/ui/useNaiveTheme'

const props = defineProps<{
  oldText: string
  newText: string
}>()

// 获取主题配置并计算颜色变量
const { themeOverrides } = useNaiveTheme()
const successBg = computed(() => themeOverrides.value?.common?.successColorSuppl || 'rgba(34, 197, 94, 0.15)')
const successColor = computed(() => themeOverrides.value?.common?.successColor || '#16a34a')
const errorBg = computed(() => themeOverrides.value?.common?.errorColorSuppl || 'rgba(239, 68, 68, 0.15)')
const errorColor = computed(() => themeOverrides.value?.common?.errorColor || '#dc2626')
const textColor3 = computed(() => themeOverrides.value?.common?.textColor3 || '#6b7280')

// 长度阈值：超过此值降级显示
// Set to 60000 to support comparing two 30000-char prompts
const MAX_LENGTH = 60000

// 本地 fallback service（仅在全局不可用时创建）
let localService: ICompareService | null = null
const getLocalService = () => {
  if (!localService) localService = createCompareService()
  return localService
}

// 动态获取 compareService（优先全局，fallback 本地）
const services = inject<Ref<AppServices | null> | null>('services', null)
const compareService = computed<ICompareService>(() => {
  const svc = services?.value?.compareService
  return svc ?? getLocalService()
})

// 错误状态
const hasError = ref(false)

// 是否需要降级（长度超限或计算出错）
const fallback = computed(() => {
  const totalLen = (props.oldText?.length || 0) + (props.newText?.length || 0)
  return totalLen > MAX_LENGTH || hasError.value
})

// 检测是否为无空格文本（如中文），自动选择 char 级 diff
const detectGranularity = (text: string): 'word' | 'char' => {
  if (!text) return 'word'
  const spaceRatio = (text.match(/\s/g)?.length || 0) / text.length
  return spaceRatio < 0.05 ? 'char' : 'word'
}

const fragments = computed<TextFragment[]>(() => {
  // 重置错误状态
  hasError.value = false

  if (!props.oldText && !props.newText) return []

  const totalLen = (props.oldText?.length || 0) + (props.newText?.length || 0)
  if (totalLen > MAX_LENGTH) return []

  try {
    const granularity = detectGranularity(props.oldText + props.newText)
    const result = compareService.value.compareTexts(props.oldText, props.newText, {
      granularity,
      ignoreWhitespace: false,
      caseSensitive: true
    })
    return result.fragments
  } catch {
    hasError.value = true
    return []
  }
})

const getFragmentClass = (type: ChangeType): string => {
  switch (type) {
    case 'added':
      return 'diff-added'
    case 'removed':
      return 'diff-removed'
    default:
      return 'diff-unchanged'
  }
}
</script>

<style scoped>
.inline-diff {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: inherit;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.diff-added {
  background-color: v-bind(successBg);
  color: v-bind(successColor);
  border-radius: 2px;
  padding: 0 2px;
}

.diff-removed {
  background-color: v-bind(errorBg);
  color: v-bind(errorColor);
  text-decoration: line-through;
  border-radius: 2px;
  padding: 0 2px;
}

.diff-unchanged {
  color: v-bind(textColor3);
}
</style>
