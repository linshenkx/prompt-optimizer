<template>
  <div class="tcb-root">
    <!-- 左侧：标签 + 模型下拉 + 可选 tags（tags 断点隐藏，且不允许挤压右侧控件） -->
    <NSpace class="tcb-left" align="center" :size="12" :wrap="false">
      <NText :depth="2" strong class="tcb-label">
        {{ modelLabel }}：
      </NText>
      <div class="tcb-model-select">
        <slot name="model-select"></slot>
      </div>
      <NTag
        v-if="modelName"
        class="tcb-tags"
        size="small"
        type="primary"
        :bordered="false"
      >
        <NEllipsis :style="{ maxWidth: '180px' }">
          {{ modelName }}
        </NEllipsis>
      </NTag>
    </NSpace>

    <!-- 右侧：强约束控件（必须始终可用、不可被遮挡） -->
    <NSpace class="tcb-right" align="center" justify="end" :size="12" :wrap="false">
      <NSpace v-if="showCompareToggle" align="center" :size="8" :wrap="false">
        <NSwitch
          :value="isCompareMode"
          @update:value="handleCompareToggle"
          :size="buttonSize === 'large' ? 'medium' : 'small'"
        />
        <NText :depth="3" tag="span" class="tcb-compare-label">
          {{ t('test.compareMode') }}
        </NText>
      </NSpace>

      <slot name="secondary-controls"></slot>

      <NButton
        @click="handlePrimaryAction"
        :disabled="primaryActionDisabled"
        :loading="primaryActionLoading"
        type="primary"
        :size="buttonSize"
      >
        {{ primaryActionText }}
      </NButton>

      <slot name="custom-actions"></slot>
    </NSpace>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NSpace, NText, NButton, NSwitch, NTag, NEllipsis } from 'naive-ui'

const { t } = useI18n()

interface Props {
  // 模型选择相关
  modelLabel: string
  modelName?: string

  // 对比模式控制
  showCompareToggle?: boolean
  isCompareMode?: boolean

  // 主要操作按钮
  primaryActionText: string
  primaryActionDisabled?: boolean
  primaryActionLoading?: boolean

  // 布局配置
  buttonSize?: 'small' | 'medium' | 'large'
}

withDefaults(defineProps<Props>(), {
  showCompareToggle: true,
  isCompareMode: false,
  primaryActionDisabled: false,
  primaryActionLoading: false,
  buttonSize: 'medium'
})

const emit = defineEmits<{
  'compare-toggle': []
  'primary-action': []
}>()

const handleCompareToggle = () => {
  emit('compare-toggle')
}

const handlePrimaryAction = () => {
  emit('primary-action')
}
</script>

<style scoped>
.tcb-root {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 12px;
  align-items: center;
  width: 100%;
}

.tcb-left {
  min-width: 0;
  overflow: hidden;
}

.tcb-label {
  white-space: nowrap;
}

.tcb-model-select {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.tcb-tags {
  flex-shrink: 1;
  min-width: 0;
}

.tcb-right {
  flex-shrink: 0;
}

.tcb-compare-label {
  white-space: nowrap;
}

/* 断点隐藏：空间不足时优先隐藏 tags，保证右侧控件可用 */
@media (max-width: 900px) {
  .tcb-tags {
    display: none;
  }
}

/* 极窄屏：右侧控件换到下一行，避免任何遮挡 */
@media (max-width: 640px) {
  .tcb-root {
    grid-template-columns: 1fr;
    row-gap: 8px;
  }
}
</style>
