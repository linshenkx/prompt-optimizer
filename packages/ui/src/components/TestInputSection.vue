<template>
  <div>
    <NSpace vertical :size="8">
      <!-- 标题和控制区域 -->
      <NFlex justify="space-between" align="center" :wrap="false">
        <NText :depth="2" class="test-input-section__label">
          {{ label }}
        </NText>
        <div
          v-if="$slots['header-actions'] || enableFullscreen"
          class="test-input-section__header-actions"
        >
          <slot name="header-actions" />
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
              <NIcon :size="16">
                <UiMaximize2 />
              </NIcon>
            </template>
          </NButton>
        </div>
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
        :autosize="false"
        style="height: 100%; min-height: 0;"
        clearable
        show-count
      />
    </FullscreenDialog>
  </div>
</template>

<script setup lang="ts">
import { Maximize2 as UiMaximize2 } from '@lucide/vue'
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

<style scoped>
.test-input-section__label {
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
}

.test-input-section__header-actions {
  display: inline-flex;
  min-width: 0;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}
</style>
