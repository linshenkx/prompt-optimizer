<template>
  <div>
    <NSpace vertical :size="8">
      <!-- 标题和控制区域 -->
      <NFlex justify="space-between" align="center" :wrap="false">
        <NText :depth="2" style="font-size: 14px; font-weight: 500;">
          {{ label }}
        </NText>
        <NButton
          v-if="enableFullscreen"
          type="tertiary"
          size="small"
          @click="openFullscreen"
          :title="t('common.expand')"
          ghost
          round
        >
          <template #icon>
            <NIcon>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </NIcon>
          </template>
        </NButton>
      </NFlex>

      <!-- 输入区域 -->
      <NInput
        :value="modelValue"
        @update:value="$emit('update:modelValue', $event)"
        type="textarea"
        :placeholder="placeholder"
        :disabled="disabled"
        :autosize="autosizeConfig"
        clearable
        show-count
        :size="size"
        :data-testid="props.testId"
      />

      <!-- 帮助文本 -->
      <NText v-if="helpText" :depth="3" style="font-size: 12px;">
        {{ helpText }}
      </NText>
    </NSpace>

    <!-- 全屏弹窗 -->
    <FullscreenDialog v-if="enableFullscreen" v-model="isFullscreen" :title="label">
      <NInput
        v-model:value="fullscreenValue"
        type="textarea"
        :placeholder="placeholder"
        :autosize="{ minRows: 20 }"
        clearable
        show-count
      />
    </FullscreenDialog>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from 'vue-i18n'
import { NSpace, NFlex, NText, NButton, NIcon, NInput } from 'naive-ui'
import { useFullscreen } from '../composables/ui/useFullscreen'
import FullscreenDialog from './FullscreenDialog.vue'

const { t } = useI18n()

interface Props {
  modelValue: string
  label: string
  placeholder?: string
  helpText?: string
  disabled?: boolean
  size?: 'small' | 'medium' | 'large'
  mode?: 'compact' | 'normal'
  enableFullscreen?: boolean
  minRows?: number
  maxRows?: number

  /** E2E: stable selector for the textarea input */
  testId?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  helpText: '',
  disabled: false,
  size: 'medium',
  mode: 'normal',
  enableFullscreen: true,
  minRows: 3,
  maxRows: 8,
  testId: undefined
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// autosize 配置
const autosizeConfig = computed(() => {
  const baseConfig = {
    minRows: props.mode === 'compact' ? Math.max(2, props.minRows - 1) : props.minRows,
    maxRows: props.mode === 'compact' ? Math.max(4, props.maxRows - 2) : props.maxRows
  }
  
  return baseConfig
})

// 全屏功能
const { isFullscreen, fullscreenValue, openFullscreen } = useFullscreen(
  computed(() => props.modelValue),
  (value) => emit('update:modelValue', value)
)
</script>