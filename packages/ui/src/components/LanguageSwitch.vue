<!-- 语言切换组件 -->
<template>
  <button
    @click="toggleLanguage"
    class="theme-icon-button ml-auto"
    :aria-label="currentLocale === 'en-US' ? 'Переключиться на русский' : 'Switch to English'"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      <path d="M2 12h20"/>
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { i18n } from '../plugins/i18n'
import { UI_SETTINGS_KEYS } from '@prompt-optimizer/core'
import { usePreferences } from '../composables/usePreferenceManager'
import type { Ref } from 'vue'
import type { AppServices } from '../types/services'

const services = inject<Ref<AppServices | null>>('services')!;
const { setPreference } = usePreferences(services);

const currentLocale = computed(() => i18n.global.locale.value)

/**
 * 切换语言并保存用户偏好
 */
const toggleLanguage = async () => {
  let newLocale;
  switch (i18n.global.locale.value) {
    case 'en-US':
      newLocale = 'ru-RU';
      break;
    case 'ru-RU':
      newLocale = 'en-US';
      break;
  }
  i18n.global.locale.value = newLocale
  
  try {
    await setPreference(UI_SETTINGS_KEYS.PREFERRED_LANGUAGE, newLocale)
  } catch (error) {
    console.error('保存语言设置失败:', error)
  }
}
</script> 