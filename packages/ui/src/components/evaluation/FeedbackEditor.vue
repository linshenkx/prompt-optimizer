<template>
  <NForm :show-feedback="false" label-placement="top" class="feedback-form">
    <NFormItem :label="showTitle ? titleText : undefined" :show-label="showTitle">
      <NSpace vertical :size="10" class="feedback-body">
        <NInput
          v-model:value="feedbackValue"
          type="textarea"
          :rows="rows"
          :autosize="autosize"
          :placeholder="placeholderText"
          :aria-label="titleText"
          :disabled="disabled"
          class="feedback-input"
          @keydown="handleKeydown"
        />

        <NText v-if="showHint" depth="3" class="feedback-hint">{{ hintText }}</NText>

        <NSpace v-if="showActions" justify="end" :size="8" class="feedback-actions">
          <NButton size="small" @click="handleCancel">{{ cancelText }}</NButton>
          <NButton
            size="small"
            type="primary"
            :disabled="!trimmedFeedback"
            @click="handleSubmit"
          >
            {{ submitText }}
          </NButton>
        </NSpace>
      </NSpace>
    </NFormItem>
  </NForm>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NForm, NFormItem, NInput, NSpace, NText } from 'naive-ui'

const props = withDefaults(
  defineProps<{
    /**
     * 受控输入（可选）。
     * - 传入时：组件作为受控输入，透出 update:modelValue。
     * - 不传时：组件维护内部状态（兼容旧用法）。
     */
    modelValue?: string

    showTitle?: boolean
    showHint?: boolean
    /** 是否显示内置的取消/提交操作按钮（默认显示） */
    showActions?: boolean
    title?: string
    placeholder?: string
    hint?: string
    rows?: number
    autosize?: {
      minRows: number
      maxRows: number
    }
    disabled?: boolean
  }>(),
  {
    modelValue: undefined,
    showTitle: false,
    showHint: false,
    showActions: true,
    title: '',
    placeholder: '',
    hint: '',
    rows: 3,
    autosize: () => ({ minRows: 3, maxRows: 6 }),
    disabled: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'cancel'): void
  (e: 'submit', payload: { feedback: string }): void
}>()

const { t } = useI18n()

const uncontrolledValue = ref('')

const feedbackValue = computed({
  get: () => (props.modelValue !== undefined ? props.modelValue : uncontrolledValue.value),
  set: (value: string) => {
    if (props.modelValue !== undefined) {
      emit('update:modelValue', value)
      return
    }

    uncontrolledValue.value = value
  },
})

const trimmedFeedback = computed(() => feedbackValue.value.trim())

const titleText = computed(() => props.title || t('evaluation.feedbackTitle'))

const placeholderText = computed(
  () => props.placeholder || t('evaluation.feedbackPlaceholder')
)

const hintText = computed(() => props.hint || t('evaluation.feedbackHint'))

const cancelText = computed(() => t('common.cancel'))

const submitText = computed(() => t('evaluation.feedbackSubmit'))

const handleKeydown = (event: KeyboardEvent) => {
  // 在没有内置动作区时，不拦截快捷键，避免影响外部容器（如 Drawer 的 Esc 关闭）
  if (!props.showActions) return

  if (event.key === 'Escape') {
    event.preventDefault()
    handleCancel()
    return
  }

  const isEnter = event.key === 'Enter'
  const isModified = event.ctrlKey || event.metaKey

  if (isEnter && isModified) {
    event.preventDefault()
    handleSubmit()
  }
}

const handleCancel = () => {
  feedbackValue.value = ''
  emit('cancel')
}

const handleSubmit = () => {
  if (!trimmedFeedback.value) return

  emit('submit', { feedback: trimmedFeedback.value })
  feedbackValue.value = ''
}
</script>

<style scoped>
.feedback-form {
  width: 100%;
}

/* 更紧凑的表单项：可选反馈场景不需要额外留白 */
.feedback-form :deep(.n-form-item) {
  margin-bottom: 0;
}

.feedback-form :deep(.n-form-item-blank) {
  width: 100%;
  min-width: 0;
}

/*
 * Naive UI 的 NSpace 默认是 inline-flex，会导致内部子元素在某些布局下无法自然铺满。
 * 这里强制 space 及其 item 占满，以确保 textarea 不会“被挤窄”。
 */
.feedback-body {
  width: 100%;
}

.feedback-body :deep(.n-space-item) {
  width: 100%;
}

.feedback-input {
  width: 100%;
}

.feedback-hint {
  font-size: 12px;
}

.feedback-actions {
  margin-top: 2px;
}
</style>
