import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const usePromptDraftStore = defineStore('promptDraft', () => {
  const userPrompt = ref<string>('')
  const userOptimizedPrompt = ref<string>('')

  const systemPrompt = ref<string>('')
  const systemOptimizedPrompt = ref<string>('')

  const effectiveUserPrompt = computed<string>(() => {
    return userOptimizedPrompt.value || userPrompt.value
  })

  const effectiveSystemPrompt = computed<string>(() => {
    return systemOptimizedPrompt.value || systemPrompt.value
  })

  const setUserPrompt = (prompt: string): void => {
    userPrompt.value = prompt ?? ''
  }

  const setUserOptimizedPrompt = (prompt: string): void => {
    userOptimizedPrompt.value = prompt ?? ''
  }

  const clearUserOptimizedPrompt = (): void => {
    userOptimizedPrompt.value = ''
  }

  const setSystemPrompt = (prompt: string): void => {
    systemPrompt.value = prompt ?? ''
  }

  const setSystemOptimizedPrompt = (prompt: string): void => {
    systemOptimizedPrompt.value = prompt ?? ''
  }

  const clearSystemOptimizedPrompt = (): void => {
    systemOptimizedPrompt.value = ''
  }

  return {
    userPrompt,
    userOptimizedPrompt,
    systemPrompt,
    systemOptimizedPrompt,

    effectiveUserPrompt,
    effectiveSystemPrompt,

    setUserPrompt,
    setUserOptimizedPrompt,
    clearUserOptimizedPrompt,

    setSystemPrompt,
    setSystemOptimizedPrompt,
    clearSystemOptimizedPrompt,
  }
})

export type PromptDraftStoreApi = ReturnType<typeof usePromptDraftStore>
