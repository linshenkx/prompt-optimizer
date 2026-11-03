import type { OptionalIntegration } from './types'

import { getEnvVar } from '@prompt-optimizer/core'
import { useArenaSession } from '../stores/session/useArenaSession'

export const integration: OptionalIntegration = {
  id: 'prompt-garden',
  envFlag: 'VITE_ENABLE_PROMPT_GARDEN_IMPORT',
  register: async (ctx) => {
    const { useAppPromptGardenImport } = await import(
      '../composables/app/useAppPromptGardenImport'
    )

    const gardenBaseUrl = getEnvVar('VITE_PROMPT_GARDEN_BASE_URL').trim() || null

    useAppPromptGardenImport({
      router: ctx.router,
      hasRestoredInitialState: ctx.hasRestoredInitialState,
      isLoadingExternalData: ctx.isLoadingExternalData,
      gardenBaseUrl,
      arenaSession: useArenaSession(),
      basicSystemSession: ctx.basicSystemSession,
      basicUserSession: ctx.basicUserSession,
      proMultiMessageSession: ctx.proMultiMessageSession,
      proVariableSession: ctx.proVariableSession,
      imageText2ImageSession: ctx.imageText2ImageSession,
      imageImage2ImageSession: ctx.imageImage2ImageSession,
      imageMultiImageSession: ctx.imageMultiImageSession,
      getFavoriteManager: () => ctx.getFavoriteManager(),
      getFavoriteImageStorageService: () => ctx.getFavoriteImageStorageService(),
      openSaveFavoriteDialog: (draft) => ctx.openSaveFavoriteDialog?.(draft),
      optimizerCurrentVersions: ctx.optimizerCurrentVersions,
    })
  },
}
