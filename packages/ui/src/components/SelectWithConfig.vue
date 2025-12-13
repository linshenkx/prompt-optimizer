<template>
  <NSelect
    v-bind="forwardedAttrs"
    :value="normalizedValue"
    :options="mappedOptions"
    :render-label="renderOptionLabel"
    :render-tag="multiple ? renderSelectedTag : undefined"
    @update:value="onUpdateValue"
  >
    <template #empty>
      <slot name="empty">
        <NSpace vertical align="center" style="padding: 12px 0;">
          <NText depth="3">{{ emptyText || t('model.select.noAvailableModels') }}</NText>
          <NButton
            v-if="shouldShowEmptyConfigCTA"
            type="tertiary"
            size="small"
            ghost
            @click="emitConfig()"
          >
            <template #icon>
              <span>⚙️</span>
            </template>
            {{ configText || t('model.select.configure') }}
          </NButton>
        </NSpace>
      </slot>
    </template>

    <template #action>
      <slot name="action">
        <div v-if="shouldShowConfigAction" style="padding: 8px 12px;">
          <NButton quaternary size="small" @click="emitConfig()">
            <template #icon>
              <span>⚙️</span>
            </template>
            {{ configText || t('model.select.configure') }}
          </NButton>
        </div>
      </slot>
    </template>
  </NSelect>
</template>

<script setup lang="ts">
import { computed, h, useAttrs } from 'vue'

import { useI18n } from 'vue-i18n'
import { NSelect, NSpace, NButton, NText } from 'naive-ui'

interface SelectOption {
  [key: string]: unknown
}

interface Props {
  modelValue: string | number | Array<string | number>
  options: SelectOption[]
  getPrimary: (opt: SelectOption) => string
  getSecondary?: (opt: SelectOption) => string
  getValue: (opt: SelectOption) => string | number
  selectedTooltip?: boolean
  showConfigAction?: boolean
  showEmptyConfigCTA?: boolean
  configText?: string
  emptyText?: string
  multiple?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  options: () => [],
  getSecondary: undefined,
  selectedTooltip: true,
  showConfigAction: false,
  showEmptyConfigCTA: false,
  configText: undefined,
  emptyText: undefined,
  multiple: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | Array<string | number>]
  'config': [payload?: Record<string, unknown>]
}>()

const attrs = useAttrs() as Record<string, unknown>
const { t } = useI18n()

// 检测是否有 config 事件处理器 - 始终显示配置按钮确保功能可用
// 动态显示配置相关功能（由父级显式开启）
const shouldShowConfigAction = computed(() => !!props.showConfigAction)
const shouldShowEmptyConfigCTA = computed(() => !!props.showEmptyConfigCTA)

// 将外部原始 options 转换为 NSelect 可识别的选项，label 为两行结构
const mappedOptions = computed(() => {
  return (props.options || []).map((opt: SelectOption) => {
    const primary = props.getPrimary(opt) || ''
    const secondary = props.getSecondary ? (props.getSecondary(opt) || '') : ''
    const value = props.getValue(opt)
    return {
      label: primary,
      value,
      raw: opt,
      primary,
      secondary
    }
  })
})

// 使用 Naive UI 官方的 render-label 自定义选项渲染
const renderOptionLabel = (option: { primary: string; secondary: string; raw: SelectOption }) => {
  const primary = option?.primary || ''
  const secondary = option?.secondary || ''
  const title = props.selectedTooltip && secondary ? `${primary} · ${secondary}` : undefined
  return h('div', { class: 'swc-opt', title }, [
    h('div', { class: 'swc-primary' }, primary),
    secondary ? h('div', { class: 'swc-secondary' }, secondary) : null
  ])
}

// 多选 tag 渲染
const renderSelectedTag = ({ option }: { option: { primary: string; secondary: string } }) => {
  const title = props.selectedTooltip && option?.secondary ? `${option.primary} · ${option.secondary}` : undefined
  return h('span', { title }, option?.primary || '')
}

// 透传属性，若无自定义 filter，则提供默认过滤（匹配主/副文本）
const forwardedAttrs = computed(() => {
  const hasCustomFilter = Object.prototype.hasOwnProperty.call(attrs, 'filter')
  const internalFilter = (pattern: string, option: { primary: string; secondary: string }) => {
    const p = (pattern || '').toLowerCase()
    return (
      (option?.primary || '').toLowerCase().includes(p) ||
      (option?.secondary || '').toLowerCase().includes(p)
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ['onUpdate:value']: _, multiple: attrsMultiple, class: rootClass, ['menu-props']: menuPropsKebab, menuProps, style: rootStyle, ...rest } = attrs as Record<string, unknown>

  // 规范：通过 class & menu-props.class 注入样式作用域，避免使用 :deep
  const mergedRootClass = [rootClass, 'swc-select'].filter(Boolean).join(' ')
  const mp = (menuPropsKebab || menuProps || {}) as Record<string, unknown>
  const mergedMenuClass = [mp.class, 'swc-select-menu'].filter(Boolean).join(' ')
  const normalizedMenuProps = { ...mp, class: mergedMenuClass }

  return {
    filterable: true,
    multiple: attrsMultiple ?? props.multiple,
    class: mergedRootClass,
    style: { minWidth: '160px', ...(rootStyle as Record<string, unknown> || {}) },
    menuProps: normalizedMenuProps,
    ...rest,
    filter: hasCustomFilter ? (attrs as Record<string, unknown>).filter : internalFilter
  }
})

const normalizedValue = computed(() => props.modelValue)

const onUpdateValue = (val: string | number | Array<string | number>) => {
  emit('update:modelValue', val)
  const cb = (attrs as Record<string, unknown>)['onUpdate:value']
  if (typeof cb === 'function') cb(val)
}

const emitConfig = () => emit('config')
</script>

<style scoped>
.swc-opt {
  display: flex;
  flex-direction: column;
}
.swc-primary {
  font-weight: 500;
  line-height: 1.35;
}
.swc-secondary {
  font-size: 12px;
  opacity: 0.72;
  line-height: 1.3;
  white-space: normal;
}
</style>

<style>
/* 使用类作用域（通过 class & menu-props 注入），避免 :deep */
.swc-select-menu .n-base-select-option__content {
  white-space: normal;
  line-height: 1.35;
  display: block;
}
.swc-select-menu .n-base-select-option {
  align-items: flex-start;
  padding-top: 6px;
  padding-bottom: 6px;
}
.swc-select-menu .swc-opt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
}
.swc-select-menu .swc-primary {
  font-weight: 600;
  line-height: 1.35;
  margin-bottom: 2px;
}
.swc-select-menu .swc-secondary {
  font-size: 12px;
  opacity: 0.65;
  line-height: 1.25;
  white-space: normal;
  word-break: break-word;
}
/* 选中区仅显示主行 */
.swc-select .n-base-selection .swc-secondary,
.swc-select .n-base-selection-label .swc-secondary {
  display: none;
}
</style>
