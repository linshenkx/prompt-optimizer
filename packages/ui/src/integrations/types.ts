import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import type { ConversationMessage, PromptRecordChain } from '@prompt-optimizer/core'

import type { BasicSystemSessionApi } from '../stores/session/useBasicSystemSession'
import type { BasicUserSessionApi } from '../stores/session/useBasicUserSession'
import type { ProMultiMessageSessionApi } from '../stores/session/useProMultiMessageSession'
import type { ProVariableSessionApi } from '../stores/session/useProVariableSession'
import type { ImageText2ImageSessionApi } from '../stores/session/useImageText2ImageSession'
import type { ImageImage2ImageSessionApi } from '../stores/session/useImageImage2ImageSession'

export interface OptionalIntegrationsContext {
  router: Pick<Router, 'currentRoute' | 'push' | 'replace'>
  hasRestoredInitialState: Ref<boolean>
  isLoadingExternalData: Ref<boolean>

  /**
   * Optimization context messages stored in the context repo.
   * Note: Pro-multi conversation messages are session-owned (see proMultiMessageSession).
   */
  optimizationContext: Ref<ConversationMessage[]>

  basicSystemSession: BasicSystemSessionApi
  basicUserSession: BasicUserSessionApi
  proMultiMessageSession: ProMultiMessageSessionApi
  proVariableSession: ProVariableSessionApi
  imageText2ImageSession: ImageText2ImageSessionApi
  imageImage2ImageSession: ImageImage2ImageSessionApi
  optimizerCurrentVersions: Ref<PromptRecordChain['versions']>
}

export interface OptionalIntegration {
  /** Stable identifier for logging / debugging. */
  id: string
  /** Env var name used to enable the integration. */
  envFlag: string
  /** Register integration side-effects (watchers, listeners, etc.). */
  register: (ctx: OptionalIntegrationsContext) => void | Promise<void>
}
