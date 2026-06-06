<template>
  <NDropdown
    :options="dropdownOptions"
    @select="handleLanguageSelect"
    placement="bottom-end"
    trigger="click"
  >
    <NButton 
      quaternary 
      size="small"
      class="flex items-center justify-center"
      data-testid="language-switch"
      :title="currentLanguageLabel"
      :aria-label="currentLanguageLabel"
    >
      <template #icon>
        <svg class="w-5 h-5 language-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- 简洁的地球图标 - 更大更清晰 -->
          <circle cx="16" cy="16" r="14" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="2.5"/>
          
          <!-- 经线 -->
          <ellipse cx="16" cy="16" rx="6" ry="14" 
                   fill="none" 
                   stroke="currentColor" 
                   stroke-width="2"/>
          <ellipse cx="16" cy="16" rx="11" ry="8" 
                   fill="none" 
                   stroke="currentColor" 
                   stroke-width="2"/>
          
          <!-- 纬线 -->
          <line x1="2" y1="16" x2="30" y2="16" 
                stroke="currentColor" 
                stroke-width="2"/>
          
          <!-- 语言符号 - 清晰的 A 字母 -->
          <text x="21" y="12" 
                fill="currentColor" 
                font-family="system-ui, -apple-system" 
                font-size="8" 
                font-weight="bold">A</text>
          
          <!-- Secondary character to hint multi-language support -->
          <text x="8" y="25" 
                fill="currentColor" 
                font-family="system-ui" 
                font-size="7" 
                font-weight="bold">B</text>
        </svg>
      </template>
    </NButton>
  </NDropdown>
</template>

<script setup lang="ts">
import { computed, inject, type Ref } from 'vue'

import { useI18n } from 'vue-i18n'
import { NButton, NDropdown, type DropdownOption } from 'naive-ui'
import { i18n, type SupportedLocale } from '../plugins/i18n'
import { UI_SETTINGS_KEYS } from '@prompt-optimizer/core'
import { usePreferences } from '../composables/storage/usePreferenceManager'
import type { AppServices } from '../types/services'

// 服务注入
const services = inject<Ref<AppServices | null>>('services')!
const { setPreference } = usePreferences(services)
const { t } = useI18n()

interface LanguageOption {
  key: SupportedLocale
  label: string
  locale: SupportedLocale
}

const availableLanguages = computed<LanguageOption[]>(() => [
  {
    key: 'zh-CN',
    label: t('settings.languageSwitcher.languages.zh-CN'),
    locale: 'zh-CN'
  },
  {
    key: 'zh-TW',
    label: t('settings.languageSwitcher.languages.zh-TW'),
    locale: 'zh-TW'
  },
  {
    key: 'en-US',
    label: t('settings.languageSwitcher.languages.en-US'),
    locale: 'en-US'
  }
])

// 当前语言计算属性
const currentLocale = computed(() => i18n.global.locale.value as SupportedLocale)

const currentLanguageLabel = computed(() => {
  const current = availableLanguages.value.find(lang => lang.locale === currentLocale.value)
  return current
    ? t('settings.languageSwitcher.ariaLabel', { language: current.label })
    : t('settings.languageSwitcher.label')
})

// 为Naive UI Dropdown创建选项
const dropdownOptions = computed<DropdownOption[]>(() => {
  return availableLanguages.value.map(language => ({
    key: language.key,
    label: language.label
  }))
})

const isSupportedLocale = (value: unknown): value is SupportedLocale =>
  value === 'zh-CN' || value === 'zh-TW' || value === 'en-US'

// 处理语言选择
const handleLanguageSelect = async (key: string) => {
  if (!isSupportedLocale(key)) return
  const selectedLanguage = availableLanguages.value.find(lang => lang.key === key)
  if (!selectedLanguage) return

  // 切换语言
  i18n.global.locale.value = selectedLanguage.locale
  
  // 保存用户偏好
  try {
    await setPreference(UI_SETTINGS_KEYS.PREFERRED_LANGUAGE, selectedLanguage.locale)
    console.log(`[LanguageSwitchDropdown] Language switched to: ${selectedLanguage.label}`)
  } catch (error) {
    console.error('[LanguageSwitchDropdown] Failed to save language preference:', error)
    // 语言切换仍然生效，只是偏好设置保存失败
  }
}
</script>

<style scoped>
.language-icon {
  transition: all 0.2s ease;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.language-icon:hover {
  opacity: 0.8;
  transform: scale(1.05);
}

/* 确保文字在深色主题下也清晰可见 */
.language-icon text {
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  paint-order: stroke fill;
  stroke: var(--base-color, currentColor);
  stroke-width: 0.5;
  stroke-linejoin: round;
}
</style>
