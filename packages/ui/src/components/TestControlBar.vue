<template>
  <NGrid :cols="24" :x-gap="12" responsive="screen">
    <!-- 模型选择区域 -->
    <NGridItem :span="modelSelectSpan" :xs="24" :sm="modelSelectSpan">
      <NFlex align="center" :size="12" :wrap="false">
        <NText :depth="2" style="font-size: 14px; font-weight: 500; flex-shrink: 0;">
          {{ modelLabel }}：
        </NText>
        <div style="flex-shrink: 0;">
          <slot name="model-select"></slot>
        </div>
        <!-- 模型信息标签（窄屏幕时隐藏） -->
        <NFlex
          v-if="modelProvider || modelName"
          align="center"
          :size="4"
          :wrap="false"
          class="model-info-tags"
        >
          <NTag v-if="modelProvider" size="small" type="info" :bordered="false">
            {{ modelProvider }}
          </NTag>
          <NTag v-if="modelName" size="small" type="primary" :bordered="false">
            {{ modelName }}
          </NTag>
        </NFlex>
      </NFlex>
    </NGridItem>

    <!-- 控制按钮区域 -->
    <NGridItem :span="controlButtonsSpan" :xs="24" :sm="controlButtonsSpan">
      <NFlex justify="end" align="end" vertical :style="{ height: '100%' }">
        <!-- 次要控制按钮 -->
        <NFlex v-if="hasSecondaryControls" justify="end" align="center" :size="8">
          <slot name="secondary-controls"></slot>
        </NFlex>
        
        <!-- 主要控制按钮 -->
        <NFlex justify="end" align="center" :size="8">
          <!-- 对比模式开关 -->
          <NFlex v-if="showCompareToggle" align="center" :size="8">
            <NSwitch
              :value="isCompareMode"
              @update:value="handleCompareToggle"
              :size="buttonSize === 'large' ? 'medium' : 'small'"
            />
            <NText :depth="3" style="font-size: 13px; white-space: nowrap;">
              {{ t('test.compareMode') }}
            </NText>
          </NFlex>

          <!-- 主要操作按钮 -->
          <NButton
            @click="handlePrimaryAction"
            :disabled="primaryActionDisabled"
            :loading="primaryActionLoading"
            type="primary"
            :size="buttonSize"
            class="whitespace-nowrap"
          >
            {{ primaryActionText }}
          </NButton>

          <!-- 自定义操作按钮 -->
          <slot name="custom-actions"></slot>
        </NFlex>
      </NFlex>
    </NGridItem>
  </NGrid>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from 'vue-i18n'
import { NGrid, NGridItem, NFlex, NText, NButton, NSwitch, NTag } from 'naive-ui'

const { t } = useI18n()

interface Props {
  // 模型选择相关
  modelLabel: string
  modelProvider?: string
  modelName?: string

  // 对比模式控制
  showCompareToggle?: boolean
  isCompareMode?: boolean
  
  // 主要操作按钮
  primaryActionText: string
  primaryActionDisabled?: boolean
  primaryActionLoading?: boolean
  
  // 布局配置
  layout?: 'default' | 'compact' | 'minimal'
  buttonSize?: 'small' | 'medium' | 'large'
  
  // 响应式配置
  modelSelectSpan?: number
  controlButtonsSpan?: number
}

withDefaults(defineProps<Props>(), {
  showCompareToggle: true,
  isCompareMode: false,
  primaryActionDisabled: false,
  primaryActionLoading: false,
  layout: 'default',
  buttonSize: 'medium',
  modelSelectSpan: 8,
  controlButtonsSpan: 16
})

const emit = defineEmits<{
  'compare-toggle': []
  'primary-action': []
}>()

// 计算属性
const hasSecondaryControls = computed(() => {
  // 检查是否有次要控制插槽内容
  return false // 可以通过插槽检测实现
})

// 事件处理
const handleCompareToggle = () => {
  emit('compare-toggle')
}

const handlePrimaryAction = () => {
  emit('primary-action')
}
</script>

<style scoped>
/* 窄屏幕时隐藏模型信息标签 */
@media (max-width: 900px) {
  .model-info-tags {
    display: none;
  }
}
</style>