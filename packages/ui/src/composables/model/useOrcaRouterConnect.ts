/**
 * Bridges the OrcaRouter login controller into the Vue UI.
 *
 * The controller owns the generation guard, the single-login lock and the
 * `pagehide` semantics; this composable only reflects its state and forwards
 * user intent. Persistence goes through the caller's `persist` callback, which
 * writes into the model form's `connectionConfig` — the same place every other
 * provider secret already lives, so no second credential store is introduced.
 */

import { computed, onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'

import {
  OrcaLoginController,
  describeOrcaAuthError,
  redactSecret,
  type OrcaCredential,
  type OrcaCredentialRecord,
  type OrcaLoginState
} from '@prompt-optimizer/core'

export interface UseOrcaRouterConnectOptions {
  /** Persist the freshly acquired credential into the host form. */
  persist: (credential: OrcaCredential) => void | Promise<void>
  /** Optional override for the authorization origin. */
  authBaseUrl?: string
  /** Optional override for the inference origin. */
  apiBaseUrl?: string
  /** Label shown on the consent screen. */
  appName?: string
}

export interface UseOrcaRouterConnectResult {
  phase: Ref<string>
  busy: Ref<boolean>
  hint: Ref<string>
  error: Ref<string>
  authorizeUrl: Ref<string>
  /** True once the current attempt has produced a URL the user can copy. */
  hasAuthorizeUrl: Ref<boolean>
  start: () => Promise<void>
  submitCode: (code: string) => Promise<boolean>
  cancel: () => void
  /** Masked, display-safe rendering of an acquired key. */
  maskedKey: Ref<string>
  credentialRecord: Ref<OrcaCredentialRecord | undefined>
}

/**
 * Redact a credential for display. Uses the project's existing masking shape
 * (first four and last four characters visible) so OrcaRouter keys look the
 * same as every other provider secret in the settings UI.
 */
export function maskOrcaCredential(value: string | undefined): string {
  if (!value) return ''
  return redactSecret(value)
}

export function useOrcaRouterConnect(
  options: UseOrcaRouterConnectOptions
): UseOrcaRouterConnectResult {
  const phase = ref<string>('idle')
  const busy = ref(false)
  const hint = ref('')
  const error = ref('')
  const authorizeUrl = ref('')
  const maskedKey = ref('')
  const credentialRecord = shallowRef<OrcaCredentialRecord | undefined>(undefined)

  const controller = shallowRef<OrcaLoginController | null>(null)

  const applyState = (state: OrcaLoginState) => {
    phase.value = state.phase
    busy.value = state.busy
    hint.value = state.hint ?? ''
    error.value = state.error ?? ''
    if (state.authorizeUrl) {
      authorizeUrl.value = state.authorizeUrl
    }
  }

  const getController = (): OrcaLoginController => {
    if (!controller.value) {
      controller.value = new OrcaLoginController({
        authBaseUrl: options.authBaseUrl,
        apiBaseUrl: options.apiBaseUrl,
        appName: options.appName,
        onStateChange: applyState,
        persist: async (credential) => {
          await options.persist(credential)
          maskedKey.value = maskOrcaCredential(credential.apiKey)
          credentialRecord.value = {
            apiKey: credential.apiKey,
            source: credential.source,
            scope: credential.scope,
            userId: credential.userId,
            generation: credential.generation,
            status: 'ready'
          }
        }
      })
    }
    return controller.value
  }

  const start = async (): Promise<void> => {
    error.value = ''
    authorizeUrl.value = ''
    try {
      await getController().start()
    } catch (caught) {
      error.value = describeOrcaAuthError(caught)
    }
  }

  const submitCode = async (code: string): Promise<boolean> => {
    error.value = ''
    try {
      await getController().submitCode(code)
      return true
    } catch (caught) {
      error.value = describeOrcaAuthError(caught)
      return false
    }
  }

  const cancel = (): void => {
    controller.value?.cancel()
    authorizeUrl.value = ''
    error.value = ''
  }

  /**
   * `pagehide` needs the synchronous state clear to happen before anything
   * else, so the back-forward-cache restored page is never stuck busy. The
   * controller does that itself; the keepalive cancellation is fire-and-forget.
   */
  const handlePageHide = () => {
    authorizeUrl.value = ''
    error.value = ''
    controller.value?.handlePageHide()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', handlePageHide)
  }

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', handlePageHide)
    }
    // Unmount cancels server work; the controller writes no UI state for it.
    controller.value?.handlePageHide()
  })

  return {
    phase,
    busy,
    hint,
    error,
    authorizeUrl,
    hasAuthorizeUrl: computed(() => authorizeUrl.value.length > 0) as Ref<boolean>,
    start,
    submitCode,
    cancel,
    maskedKey,
    credentialRecord
  }
}
