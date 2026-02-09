<template>
  <div class="feedback-analyze">
    <NTooltip v-if="compact" trigger="hover">
      <template #trigger>
        <NButton
          :size="size"
          :quaternary="true"
          :circle="true"
          :disabled="disabled || loading"
          :loading="loading"
          class="feedback-trigger"
          :aria-label="t('evaluation.feedbackAnalyze')"
          :title="t('evaluation.feedbackAnalyze')"
          data-testid="feedback-analyze-trigger"
          @click="handleOpen"
        >
          <template #icon>
            <NIcon :size="14" aria-hidden="true">
              <Focus2 />
            </NIcon>
          </template>
        </NButton>
      </template>
      {{ t('evaluation.feedbackAnalyze') }}
    </NTooltip>

    <NButton
      v-else
      :size="size"
      text
      :disabled="disabled || loading"
      :loading="loading"
      class="feedback-trigger"
      :aria-label="t('evaluation.feedbackAnalyze')"
      :title="t('evaluation.feedbackAnalyze')"
      data-testid="feedback-analyze-trigger"
      @click="handleOpen"
    >
      <template #icon>
        <NIcon :size="14" aria-hidden="true">
          <Focus2 />
        </NIcon>
      </template>
      {{ t('evaluation.feedbackAnalyze') }}
    </NButton>

    <template v-if="showEditor">
      <NDivider class="feedback-divider" />
      <NCard embedded size="small" :bordered="false" class="feedback-editor-card">
        <FeedbackEditor
          show-title
          :title="t('evaluation.feedbackTitle')"
          @cancel="handleCancel"
          @submit="handleSubmit"
        />
      </NCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NCard, NDivider, NIcon, NTooltip } from 'naive-ui'
import type { EvaluationType } from '@prompt-optimizer/core'
import { Focus2 } from '@vicons/tabler'
import FeedbackEditor from './FeedbackEditor.vue'

const props = withDefaults(
  defineProps<{
    type: EvaluationType
    disabled?: boolean
    loading?: boolean
    size?: 'tiny' | 'small' | 'medium' | 'large'
    compact?: boolean
  }>(),
  {
    disabled: false,
    loading: false,
    size: 'tiny',
    compact: true,
  }
)

const emit = defineEmits<{
  (e: 'evaluate-with-feedback', payload: { type: EvaluationType; feedback: string }): void
}>()

const { t } = useI18n()

const showEditor = ref(false)

const handleOpen = () => {
  if (props.disabled || props.loading) return

  // 幂等打开，避免重复点击导致误关闭
  showEditor.value = true
}

const handleCancel = () => {
  showEditor.value = false
}

const handleSubmit = (payload: { feedback: string }) => {
  emit('evaluate-with-feedback', {
    type: props.type,
    feedback: payload.feedback,
  })

  showEditor.value = false
}
</script>

<style scoped>
.feedback-analyze {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
}

.feedback-trigger {
  flex-shrink: 0;
}

.feedback-divider {
  margin: 8px 0;
}

.feedback-editor-card {
  margin: 0;
  width: min(360px, calc(100vw - 32px));
}
</style>
