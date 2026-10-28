<template>
  <NDropdown
    :options="dropdownOptions"
    @select="handleThemeSelect"
    placement="bottom-end"
    trigger="click"
  >
    <NButton 
      quaternary 
      size="small"
      class="flex items-center justify-center gap-1"
    >
      <template #icon>
        <component :is="currentThemeIcon" />
      </template>
      <span class="text-sm max-md:hidden truncate">{{ currentThemeLabel }}</span>
    </NButton>
  </NDropdown>
</template>
  
<script setup lang="ts">
import { Sun, Moon, Snowflake, Palette, Leaf, Bot } from '@lucide/vue'
import { computed, h } from 'vue'

import { useI18n } from 'vue-i18n'
import { NButton, NDropdown, type DropdownOption } from 'naive-ui'
import { useNaiveTheme } from '../composables/ui/useNaiveTheme'

const { t } = useI18n()

// 使用新的主题系统
const { 
  themeId, 
  availableThemes, 
  changeTheme 
} = useNaiveTheme()

// Theme choices share Lucide geometry and retain their identifying colors.
const themeIcons = {
  light: { icon: Sun, color: '#eab308' },
  dark: { icon: Moon, color: '#60a5fa' },
  blue: { icon: Snowflake, color: '#2563eb' },
  classic: { icon: Palette, color: '#b08968' },
  green: { icon: Leaf, color: '#16a34a' },
  purple: { icon: Bot, color: '#9333ea' },
}
const createThemeIcon = (id: string, isColored = false) => {
  const theme = themeIcons[id as keyof typeof themeIcons]
  if (!theme) return null
  return h(theme.icon, { size: 16, color: isColored ? theme.color : 'currentColor', 'aria-hidden': true })
}

// 当前主题的图标
const currentThemeIcon = computed(() => createThemeIcon(themeId.value, true))

// 当前主题的标签（使用国际化）
const currentThemeLabel = computed(() => {
  return t(`theme.${themeId.value}`)
})

// 为Naive UI Dropdown创建选项
const dropdownOptions = computed<DropdownOption[]>(() => {
  return availableThemes.map(theme => ({
    key: theme.id,
    label: t(`theme.${theme.id}`),
    icon: () => createThemeIcon(theme.id, true)
  }))
})

// 处理主题选择
const handleThemeSelect = (key: string) => {
  changeTheme(key)
}
</script>
