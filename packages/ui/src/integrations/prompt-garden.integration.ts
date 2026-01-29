import type { OptionalIntegration } from './types'

export const integration: OptionalIntegration = {
  id: 'prompt-garden',
  envFlag: 'VITE_ENABLE_PROMPT_GARDEN_IMPORT',
  register: async (ctx) => {
    const { useAppPromptGardenImport } = await import(
      '../composables/app/useAppPromptGardenImport'
    )

    const gardenBaseUrl = (import.meta.env.VITE_PROMPT_GARDEN_BASE_URL as string | undefined) || null

    useAppPromptGardenImport({
      router: ctx.router,
      hasRestoredInitialState: ctx.hasRestoredInitialState,
      isLoadingExternalData: ctx.isLoadingExternalData,
      gardenBaseUrl,
      optimizationContext: ctx.optimizationContext,
      basicSystemSession: ctx.basicSystemSession,
      basicUserSession: ctx.basicUserSession,
      proMultiMessageSession: ctx.proMultiMessageSession,
      proVariableSession: ctx.proVariableSession,
      imageText2ImageSession: ctx.imageText2ImageSession,
      imageImage2ImageSession: ctx.imageImage2ImageSession,
      optimizerCurrentVersions: ctx.optimizerCurrentVersions,
    })
  },
}
