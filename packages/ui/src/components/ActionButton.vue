<template>
  <NButton
    :type="buttonType"
    :size="buttonSize"
    :loading="loading"
    :loading-text="loadingText || t('common.loading')"
    :disabled="loading"
    @click="$emit('click')"
    class="action-button"
    :ghost="ghost"
    :round="round"
  >
    <template #icon>
      <slot name="icon">
        <span class="text-base sm:text-lg">{{ icon }}</span>
      </slot>
    </template>
    <span class="text-sm max-md:hidden">{{ text }}</span>
  </NButton>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from 'vue-i18n'
import { NButton } from 'naive-ui'

const { t } = useI18n()

interface Props {
  icon?: string
  text: string
  loading?: boolean
  loadingText?: string
  type?: 'default' | 'tertiary' | 'primary' | 'success' | 'info' | 'warning' | 'error'
  size?: 'tiny' | 'small' | 'medium' | 'large'
  ghost?: boolean
  round?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  size: 'medium',
  ghost: false,
  round: true
})

defineEmits<{
  (e: 'click'): void
}>()

// 动态计算按钮类型和尺寸，保持与主题的一致性
const buttonType = computed(() => props.type)
const buttonSize = computed(() => props.size)
</script>

<style scoped>
.action-button {
  /* 保持与原有主题系统的兼容性 */
  transition: all 0.2s ease;
}

.action-button:hover {
  transform: translateY(-1px);
}
</style>