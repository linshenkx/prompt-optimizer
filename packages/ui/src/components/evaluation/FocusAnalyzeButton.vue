<template>
  <NButtonGroup class="focus-analyze-group">
    <NButton
      v-bind="buttonPropsMerged"
      :disabled="isDisabled"
      :loading="loading"
      class="focus-analyze-main"
      :aria-label="label"
      :title="label"
      data-testid="focus-analyze-main"
      @click="handleEvaluate"
    >
      <template v-if="$slots.icon" #icon>
        <slot name="icon" />
      </template>
      {{ label }}
    </NButton>

    <NPopover
      v-model:show="focusVisible"
      trigger="manual"
      placement="bottom-end"
      flip
      :disabled="isDisabled"
      :style="{ padding: '0' }"
      :content-style="{ padding: '0' }"
      @clickoutside="handleClickOutside"
    >
      <template #trigger>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton
              v-bind="buttonPropsMerged"
              :disabled="isDisabled"
              :loading="loading"
              class="focus-analyze-trigger"
              :aria-label="t('evaluation.focus')"
              :title="t('evaluation.focus')"
              data-testid="focus-analyze-trigger"
              @click="handleOpenFocus"
            >
              <template #icon>
                <NIcon :size="14" aria-hidden="true">
                  <Focus2 />
                </NIcon>
              </template>
            </NButton>
          </template>
          {{ t('evaluation.focus') }}
        </NTooltip>
      </template>

      <NCard embedded size="small" :bordered="false" class="focus-popover-card">
        <template #header>
          <NSpace align="center" :size="8">
            <span class="focus-title">{{ t('evaluation.focusTitle') }}</span>
            <NTag size="small" round :bordered="false" type="default" class="optional-tag">
              {{ t('evaluation.optional') }}
            </NTag>
          </NSpace>
        </template>

        <NSpace vertical :size="10">
          <FeedbackEditor
            v-model="focusDraft"
            :show-actions="false"
            :placeholder="t('evaluation.focusPlaceholder')"
            :disabled="isDisabled"
          />

          <NText depth="3" class="focus-hint">{{ t('evaluation.focusHint') }}</NText>

          <NSpace justify="end" :size="8">
            <NButton size="small" @click="handleCancel">
              {{ t('common.cancel') }}
            </NButton>
            <NButton
              size="small"
              type="primary"
              :loading="loading"
              :disabled="isDisabled"
              @click="handleStart"
            >
              {{ label }}
            </NButton>
          </NSpace>
        </NSpace>
      </NCard>
    </NPopover>
  </NButtonGroup>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NButtonGroup,
  NCard,
  NIcon,
  NPopover,
  NSpace,
  NTag,
  NText,
  NTooltip,
} from 'naive-ui'
import type { EvaluationType } from '@prompt-optimizer/core'
import { Focus2 } from '@vicons/tabler'
import FeedbackEditor from './FeedbackEditor.vue'

const props = withDefaults(
  defineProps<{
    type: EvaluationType
    label: string
    disabled?: boolean
    loading?: boolean
    /**
     * Pass-through style props for both buttons (e.g. secondary/quaternary/type/size).
     * Component-level disabled/loading will override.
     */
    buttonProps?: Record<string, unknown>
  }>(),
  {
    disabled: false,
    loading: false,
    buttonProps: () => ({}),
  }
)

const emit = defineEmits<{
  (e: 'evaluate'): void
  (e: 'evaluate-with-feedback', payload: { type: EvaluationType; feedback: string }): void
}>()

const { t } = useI18n()

const focusVisible = ref(false)
const focusDraft = ref('')

const isDisabled = computed(() => props.disabled || props.loading)
const loading = computed(() => !!props.loading)

const buttonPropsMerged = computed(() => ({
  ...(props.buttonProps || {}),
}))

const closePopover = () => {
  focusVisible.value = false
  focusDraft.value = ''
}

const handleEvaluate = () => {
  if (isDisabled.value) return
  closePopover()
  emit('evaluate')
}

const handleOpenFocus = () => {
  if (isDisabled.value) return
  focusVisible.value = true
}

const handleClickOutside = () => {
  if (!focusVisible.value) return
  closePopover()
}

const handleCancel = () => {
  closePopover()
}

const handleStart = () => {
  if (isDisabled.value) return

  const trimmed = focusDraft.value.trim()
  closePopover()

  if (trimmed) {
    emit('evaluate-with-feedback', { type: props.type, feedback: trimmed })
    return
  }

  // Empty focus is allowed: fall back to the default smart evaluation.
  emit('evaluate')
}
</script>

<style scoped>
.focus-analyze-group {
  display: inline-flex;
}

.focus-analyze-trigger {
  min-width: 34px;
  padding: 0 8px;
}

.focus-popover-card {
  width: min(360px, calc(100vw - 32px));
}

.focus-popover-card :deep(.n-card__header) {
  padding: 10px 12px 6px;
}

.focus-popover-card :deep(.n-card__content) {
  padding: 0 12px 12px;
}

.focus-title {
  font-weight: 600;
}

.optional-tag {
  opacity: 0.85;
}

.focus-hint {
  font-size: 12px;
}
</style>
