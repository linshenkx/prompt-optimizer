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
      :title="currentLanguageLabel"
      :aria-label="currentLanguageLabel"
    >
      <template #icon>
        <UiLanguages class="language-icon"  :size="20" />
      </template>
    </NButton>
  </NDropdown>
</template>

<script setup lang="ts">
import { Languages as UiLanguages } from '@lucide/vue'
import { computed, inject, type Ref } from 'vue'

import { useI18n } from 'vue-i18n'
import { NButton, NDropdown, type DropdownOption } from 'naive-ui'
import { i18n, type SupportedLocale } from '../plugins/i18n'
import { UI_SETTINGS_KEYS } from '@prompt-optimizer/core'
import { useGlobalSettings } from '../stores/settings/useGlobalSettings'
import { usePreferences } from '../composables/storage/usePreferenceManager'
import type { AppServices } from '../types/services'

// 服务注入
const services = inject<Ref<AppServices | null>>('services')!
const { setPreference } = usePreferences(services)
const globalSettings = useGlobalSettings()
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
    globalSettings.updatePreferredLanguage(selectedLanguage.locale)
    console.log(`[LanguageSwitchDropdown] Language switched to: ${selectedLanguage.label}`)
  } catch (error) {
    console.error('[LanguageSwitchDropdown] Failed to save language preference:', error)
    // 语言切换仍然生效，只是偏好设置保存失败
  }
}
</script>
