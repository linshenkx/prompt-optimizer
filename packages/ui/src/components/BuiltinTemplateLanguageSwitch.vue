<template>
  <div class="flex items-center">
    <button
      @click="handleLanguageToggle"
      :disabled="isChanging"
      :title="t('template.switchBuiltinLanguage')"
      class="theme-language-button"
    >
      <span class="flex items-center gap-1">
        <svg
          class="w-3 h-3 theme-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
          />
        </svg>
        <span class="font-medium">{{ getCurrentLanguageShort }}</span>
        <div v-if="isChanging" class="w-3 h-3 animate-spin">
          <svg class="w-full h-full" viewBox="0 0 24 24">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
              fill="none"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, inject, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '../composables/useToast'
import type { BuiltinTemplateLanguage, ITemplateManager, TemplateLanguageService } from '@prompt-optimizer/core'
import type { AppServices } from '../types/services'

const { t } = useI18n()
const toast = useToast()

// 移除props定义，现在统一通过inject获取services
// const props = defineProps({
//   // templateManager和templateLanguageService现在通过inject获取
// })

// 统一使用inject获取services
const services = inject<Ref<AppServices | null>>('services')
if (!services) {
  throw new Error('[BuiltinTemplateLanguageSwitch] services未正确注入，请确保在App组件中正确provide了services')
}

const getTemplateManager = computed(() => {
  const servicesValue = services.value
  if (!servicesValue) {
    throw new Error('[BuiltinTemplateLanguageSwitch] services未初始化，请确保应用已正确启动')
  }

  const manager = servicesValue.templateManager
  if (!manager) {
    throw new Error('[BuiltinTemplateLanguageSwitch] templateManager未初始化，请确保服务已正确配置')
  }

  return manager
})

const getTemplateLanguageService = computed(() => {
  const servicesValue = services.value
  if (!servicesValue) {
    throw new Error('[BuiltinTemplateLanguageSwitch] services未初始化，请确保应用已正确启动')
  }

  const service = servicesValue.templateLanguageService
  if (!service) {
    throw new Error('[BuiltinTemplateLanguageSwitch] templateLanguageService未初始化，请确保服务已正确配置')
  }

  return service
})

// Reactive state
const currentLanguage = ref<BuiltinTemplateLanguage>('zh-CN')
const supportedLanguages = ref<BuiltinTemplateLanguage[]>([])
const isChanging = ref(false)

// Computed properties
const getCurrentLanguageShort = computed<string>(() => {
  try {
    const service = getTemplateLanguageService.value
    if (!service) {
      throw new Error('Template language service not available')
    }
    return service.getLanguageDisplayName(currentLanguage.value)
  } catch (error) {
    console.error('Error getting current language short:', error)
    return '中文' // fallback to Chinese
  }
})

// Event emitters
const emit = defineEmits<{
  languageChanged: [language: BuiltinTemplateLanguage]
}>()

/**
 * Initialize component
 */
onMounted(async () => {
  try {
    const service = getTemplateLanguageService.value
    if (!service) {
 throw new Error('Template language service not available');
    }

    // Ensure template language service is initialized
    if (!service.isInitialized()) {
      await service.initialize()
    }

    // Get current language and supported languages (now async)
    currentLanguage.value = await service.getCurrentLanguage()
    supportedLanguages.value = await service.getSupportedLanguages()
  } catch (error) {
 console.error('Failed to initialize builtin template language switch:', error);
    // Set fallback values
    currentLanguage.value = 'zh-CN'
    supportedLanguages.value = ['zh-CN', 'en-US']

    // Only show toast error if toast is available
    try {
      toast.error(t('template.languageInitError'))
    } catch (toastError) { // Corrected variable name
      console.error('Failed to show toast error:', toastError)
    }
  }
})

/**
 * Handle language toggle
 */
const handleLanguageToggle = async () => {
  if (isChanging.value) return

  const oldLanguage = currentLanguage.value
  const currentIndex = supportedLanguages.value.indexOf(oldLanguage);
  const nextIndex = (currentIndex + 1) % supportedLanguages.value.length;
  const newLanguage = supportedLanguages.value[nextIndex];

  if (!newLanguage) {
    return; // Should not happen if supportedLanguages is not empty
  }

  try {
    isChanging.value = true
    
    const manager = getTemplateManager.value
    if (!manager) {
      throw new Error('Template manager not available')
    }

    // Change the built-in template language
    await manager.changeBuiltinTemplateLanguage(newLanguage)

    // Update local state
    currentLanguage.value = newLanguage

    // Emit event to notify parent components
    emit('languageChanged', newLanguage)

    // Show success message
    try {
      const service = getTemplateLanguageService.value
      if (!service) {
        throw new Error('Template language service not available')
      }
      const languageName = service.getLanguageDisplayName(newLanguage)
      toast.success(t('template.languageChanged', { language: languageName }))
    } catch (toastError) {
      console.error('Failed to show success toast:', toastError)
    }

  } catch (error) {
    console.error('Failed to toggle builtin template language:', error)

    // Revert to old language on error
    currentLanguage.value = oldLanguage

    // Show error message
    try {
      toast.error(t('template.languageChangeError'))
    } catch (toastError) {
      console.error('Failed to show error toast:', toastError)
    }
  } finally {
    isChanging.value = false
  }
}

/**
 * Refresh current language (useful for external updates)
 */
const refresh = async () => {
  const service = getTemplateLanguageService.value
  if (!service) {
    throw new Error('Template language service not available')
  }

  currentLanguage.value = await service.getCurrentLanguage()
}

// Expose methods for parent components
defineExpose({
  refresh
})
</script>

<style scoped>
.theme-language-button {
  @apply inline-flex items-center px-2 py-1 text-xs rounded-md border transition-all duration-200;
  @apply bg-white border-gray-300 text-gray-700 hover:bg-gray-50;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white;
}

.theme-icon {
  @apply text-gray-500;
}

/* Theme variants */
:root.dark .theme-language-button {
  @apply bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700;
  @apply focus:ring-blue-400 focus:border-blue-400;
  @apply disabled:hover:bg-slate-800;
}

:root.dark .theme-icon {
  @apply text-slate-400;
}

:root.theme-blue .theme-language-button {
  @apply bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100;
  @apply focus:ring-sky-500 focus:border-sky-500;
  @apply disabled:hover:bg-sky-50;
}

:root.theme-blue .theme-icon {
  @apply text-sky-600;
}

:root.theme-green .theme-language-button {
  @apply bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100;
  @apply focus:ring-teal-500 focus:border-teal-500;
  @apply disabled:hover:bg-teal-50;
}

:root.theme-green .theme-icon {
  @apply text-teal-600;
}

:root.theme-purple .theme-language-button {
  @apply bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100;
  @apply focus:ring-purple-500 focus:border-purple-500;
  @apply disabled:hover:bg-purple-50;
}

:root.theme-purple .theme-icon {
  @apply text-purple-600;
}
</style>
