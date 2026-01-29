/**
 * App-level Prompt Garden import.
 *
 * The optimizer receives an import payload via route query, fetches prompt content
 * from the Garden site, and writes it into the correct session store.
 *
 * Notes:
 * - Uses isLoadingExternalData to prevent route-driven session restore from
 *   overwriting imported content.
 * - Clears import-related query params after successful import.
 */

import { watch, nextTick, type Ref } from 'vue'
import type { LocationQuery, Router } from 'vue-router'
import type { ConversationMessage, PromptRecordChain } from '@prompt-optimizer/core'

import { useToast } from '../ui/useToast'
import { createDefaultEvaluationResults } from '../../types/evaluation'
import { isValidVariableName } from '../../types/variable'
import { i18n } from '../../plugins/i18n'
import type { BasicSystemSessionApi } from '../../stores/session/useBasicSystemSession'
import type { BasicUserSessionApi } from '../../stores/session/useBasicUserSession'
import type { ProMultiMessageSessionApi } from '../../stores/session/useProMultiMessageSession'
import type { ProVariableSessionApi } from '../../stores/session/useProVariableSession'
import type { ImageText2ImageSessionApi } from '../../stores/session/useImageText2ImageSession'
import type { ImageImage2ImageSessionApi } from '../../stores/session/useImageImage2ImageSession'

type SupportedSubModeKey =
  | 'basic-system'
  | 'basic-user'
  | 'pro-multi'
  | 'pro-variable'
  | 'image-text2image'
  | 'image-image2image'

const SUPPORTED_KEYS: ReadonlyArray<SupportedSubModeKey> = [
  'basic-system',
  'basic-user',
  'pro-multi',
  'pro-variable',
  'image-text2image',
  'image-image2image'
]

const isSupportedKey = (value: string | null | undefined): value is SupportedSubModeKey => {
  if (!value) return false
  return (SUPPORTED_KEYS as readonly string[]).includes(value)
}

const getQueryString = (query: LocationQuery, key: string): string | null => {
  const value = query[key]
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return null
}

const omitKeys = (query: LocationQuery, keys: string[]): LocationQuery => {
  const next: Record<string, unknown> = { ...query }
  for (const k of keys) {
    delete next[k]
  }
  return next as LocationQuery
}

const normalizeBaseUrl = (value: string): string | null => {
  try {
    const u = new URL(value)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    // Keep pathname to support subpath deployments; just trim trailing slash.
    return u.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

const keyToPath = (key: SupportedSubModeKey): string => {
  const [mode, subMode] = key.split('-')
  return `/${mode}/${subMode}`
}

const parseKeyFromCurrentPath = (path: string): SupportedSubModeKey | null => {
  const match = path.match(/^\/(basic|pro|image)\/([^/]+)$/)
  if (!match) return null
  const key = `${match[1]}-${match[2]}`
  return isSupportedKey(key) ? key : null
}

const resolveTargetKey = (
  query: LocationQuery,
  fallbackPath: string,
  suggestedKey?: string | null,
): SupportedSubModeKey => {
  const explicitKey = getQueryString(query, 'subModeKey')
  if (isSupportedKey(explicitKey)) return explicitKey

  if (isSupportedKey(suggestedKey)) return suggestedKey

  return parseKeyFromCurrentPath(fallbackPath) ?? 'basic-system'
}

type FetchedPrompt = {
  optimizerTargetKey: string
  promptFormat: 'text' | 'messages'
  promptText?: string
  promptMessages?: ConversationMessage[]
  variables: Array<{ name: string; defaultValue?: string }>
}

type ImportedVariable = {
  name: string
  defaultValue?: string
}

type TemporaryVariablesSessionApi = {
  getTemporaryVariable: (name: string) => string | undefined
  setTemporaryVariable: (name: string, value: string) => void
}

const ensureImportedTemporaryVariables = (
  targetKey: SupportedSubModeKey,
  api: {
    proMultiMessageSession: ProMultiMessageSessionApi
    proVariableSession: ProVariableSessionApi
    imageText2ImageSession: ImageText2ImageSessionApi
    imageImage2ImageSession: ImageImage2ImageSessionApi
  },
  opts: {
    variables: ImportedVariable[]
  },
) => {
  const session: TemporaryVariablesSessionApi | null = (() => {
    switch (targetKey) {
      case 'pro-multi':
        return api.proMultiMessageSession
      case 'pro-variable':
        return api.proVariableSession
      case 'image-text2image':
        return api.imageText2ImageSession
      case 'image-image2image':
        return api.imageImage2ImageSession
      default:
        return null
    }
  })()

  if (!session) return

  const variableEntries: Array<{ name: string; value: string }> = opts.variables
    .map((v) => ({
      name: String(v?.name || '').trim(),
      value: v?.defaultValue !== undefined ? String(v.defaultValue) : '',
    }))
    .filter((v) => isValidVariableName(v.name))

  if (!variableEntries.length) return

  // Add missing variable keys so the variables panel can render them immediately.
  // Preserve existing values to avoid unexpected destructive behavior.
  for (const { name, value } of variableEntries) {
    if (session.getTemporaryVariable(name) === undefined) {
      session.setTemporaryVariable(name, value)
    }
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

let importedMessageIdSeed = 0
const generateImportedMessageId = (): string => {
  // Prefer stable UUIDs when available (browser + modern Node).
  const maybeCrypto = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined
  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
    return maybeCrypto.randomUUID()
  }
  importedMessageIdSeed += 1
  return `imported-${Date.now()}-${importedMessageIdSeed}`
}

const normalizeImportedConversationMessages = (input: unknown): ConversationMessage[] => {
  if (!Array.isArray(input)) return []
  const out: ConversationMessage[] = []

  for (const item of input) {
    if (!isPlainObject(item)) continue
    const role = item.role
    if (role !== 'system' && role !== 'user' && role !== 'assistant' && role !== 'tool') continue
    const content = typeof item.content === 'string' ? item.content : ''
    if (!content) continue

    const id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim()
        : generateImportedMessageId()

    const originalContent = typeof item.originalContent === 'string' ? item.originalContent : content

    out.push({
      id,
      role,
      content,
      originalContent,
    })
  }

  return out
}

const buildConversationFromPromptText = (content: string): ConversationMessage[] => {
  const text = String(content || '')
  if (!text) return []
  const id = generateImportedMessageId()
  return [{ id, role: 'system', content: text, originalContent: text }]
}

const fetchPromptFromGarden = async (opts: {
  gardenBaseUrl: string | null
  importCode: string
}): Promise<FetchedPrompt> => {
  const { gardenBaseUrl, importCode } = opts

  const url = (() => {
    if (!gardenBaseUrl) return null
    const base = normalizeBaseUrl(gardenBaseUrl)
    if (!base) return null
    return `${base}/api/prompt-source/${encodeURIComponent(importCode)}`
  })()

  if (!url) {
    throw new Error('Missing VITE_PROMPT_GARDEN_BASE_URL')
  }

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  })

  if (!resp.ok) {
    throw new Error(`Garden request failed: ${resp.status}`)
  }
  const text = await resp.text()

  const parseV1 = (data: unknown): FetchedPrompt => {
    if (!isPlainObject(data)) {
      throw new Error('Garden response must be a JSON object')
    }
    if (data.schema !== 'prompt-garden.prompt.v1') {
      throw new Error('Unsupported Garden response schema')
    }
    if (data.schemaVersion !== 1) {
      throw new Error('Unsupported Garden response schemaVersion')
    }

    const optimizerTarget = isPlainObject(data.optimizerTarget) ? data.optimizerTarget : null
    const optimizerTargetKey =
      optimizerTarget && typeof optimizerTarget.subModeKey === 'string'
        ? optimizerTarget.subModeKey.trim()
        : ''
    if (!optimizerTargetKey) {
      throw new Error('Missing optimizerTarget.subModeKey')
    }

    const prompt = isPlainObject(data.prompt) ? data.prompt : null
    const format = prompt && (prompt.format === 'text' || prompt.format === 'messages')
      ? (prompt.format as 'text' | 'messages')
      : null
    if (!format) {
      throw new Error('Missing prompt.format')
    }

    let promptText: string | undefined
    let promptMessages: ConversationMessage[] | undefined
    if (format === 'text') {
      const t = prompt && typeof prompt.text === 'string' ? prompt.text : ''
      if (!t.trim()) {
        throw new Error('Empty prompt.text')
      }
      promptText = t
    } else {
      const msgs = normalizeImportedConversationMessages(prompt?.messages)
      if (!msgs.length) {
        throw new Error('Empty prompt.messages')
      }
      promptMessages = msgs
    }

    if (!Array.isArray(data.variables)) {
      throw new Error('Missing variables')
    }
    const variables = data.variables
      .map((v): { name: string; defaultValue?: string } => {
        if (!isPlainObject(v)) return { name: '' }
        const name = typeof v.name === 'string' ? v.name.trim() : ''
        const defaultValue = typeof v.defaultValue === 'string' ? v.defaultValue : undefined
        return { name, defaultValue }
      })
      .filter((v) => isValidVariableName(v.name))

    return {
      optimizerTargetKey,
      promptFormat: format,
      promptText,
      promptMessages,
      variables,
    }
  }

  let data: unknown
  try {
    data = JSON.parse(text) as unknown
  } catch {
    throw new Error('Garden response is not valid JSON')
  }

  return parseV1(data)
}

const clearSessionForExternalImport = (targetKey: SupportedSubModeKey, api: {
  basicSystemSession: BasicSystemSessionApi
  basicUserSession: BasicUserSessionApi
  proVariableSession: ProVariableSessionApi
  imageText2ImageSession: ImageText2ImageSessionApi
  imageImage2ImageSession: ImageImage2ImageSessionApi
  optimizerCurrentVersions: Ref<PromptRecordChain['versions']>
}, content: string) => {
  const resetCommon = (session: {
    updateOptimizedResult: (payload: {
      optimizedPrompt: string
      reasoning?: string
      chainId: string
      versionId: string
    }) => void
    // Pinia setup stores unwrap refs on the store type, so this is the plain value.
    evaluationResults?: unknown
  }) => {
    session.updateOptimizedResult({
      optimizedPrompt: '',
      reasoning: '',
      chainId: '',
      versionId: ''
    })
    if (session.evaluationResults !== undefined) {
      session.evaluationResults = createDefaultEvaluationResults()
    }
  }

  if (targetKey === 'basic-system') {
    api.basicSystemSession.updatePrompt(content)
    resetCommon(api.basicSystemSession)
    api.basicSystemSession.updateTestContent('')
    api.basicSystemSession.updateTestResults(null)
    api.optimizerCurrentVersions.value = []
    return
  }

  if (targetKey === 'basic-user') {
    api.basicUserSession.updatePrompt(content)
    resetCommon(api.basicUserSession)
    api.basicUserSession.updateTestContent('')
    api.basicUserSession.updateTestResults(null)
    api.optimizerCurrentVersions.value = []
    return
  }

  if (targetKey === 'pro-variable') {
    api.proVariableSession.updatePrompt(content)
    resetCommon(api.proVariableSession)
    api.proVariableSession.updateTestContent('')
    api.proVariableSession.updateTestResults(null)
    return
  }

  if (targetKey === 'pro-multi') {
    // Conversation mode uses a different state tree (messages snapshot + selection).
    return
  }

  if (targetKey === 'image-text2image') {
    api.imageText2ImageSession.updatePrompt(content)
    resetCommon(api.imageText2ImageSession)
    api.imageText2ImageSession.updateOriginalImageResult(null)
    api.imageText2ImageSession.updateOptimizedImageResult(null)
    return
  }

  // image-image2image
  api.imageImage2ImageSession.updatePrompt(content)
  resetCommon(api.imageImage2ImageSession)
  api.imageImage2ImageSession.updateInputImage(null)
  api.imageImage2ImageSession.updateOriginalImageResult(null)
  api.imageImage2ImageSession.updateOptimizedImageResult(null)
}

export interface AppPromptGardenImportOptions {
  router: Pick<Router, 'currentRoute' | 'push' | 'replace'>
  hasRestoredInitialState: Ref<boolean>
  isLoadingExternalData: Ref<boolean>

  /** Pro multi-mode conversation messages (owned by PromptOptimizerApp context management). */
  optimizationContext: Ref<ConversationMessage[]>

  /** Fixed integration base URL (no per-link overrides). */
  gardenBaseUrl: string | null

  basicSystemSession: BasicSystemSessionApi
  basicUserSession: BasicUserSessionApi
  proMultiMessageSession: ProMultiMessageSessionApi
  proVariableSession: ProVariableSessionApi
  imageText2ImageSession: ImageText2ImageSessionApi
  imageImage2ImageSession: ImageImage2ImageSessionApi

  /** UI-only current versions list for history drawer; safe to clear for basic imports */
  optimizerCurrentVersions: Ref<PromptRecordChain['versions']>
}

export function useAppPromptGardenImport(options: AppPromptGardenImportOptions) {
  const toast = useToast()
  const {
    router,
    hasRestoredInitialState,
    isLoadingExternalData,
    gardenBaseUrl,
    optimizationContext,
    basicSystemSession,
    basicUserSession,
    proMultiMessageSession,
    proVariableSession,
    imageText2ImageSession,
    imageImage2ImageSession,
    optimizerCurrentVersions,
  } = options

  const inFlight = { value: false }

  // Watch both route changes and the "initial restore" gate.
  // If the app loads directly on an import URL, the route may never change after restore;
  // we still need to run the import once restore completes.
  watch(
    () => [router.currentRoute.value.fullPath, hasRestoredInitialState.value] as const,
    async ([, restored]) => {
      if (!restored) return
      if (inFlight.value) return

      const currentRoute = router.currentRoute.value
      const query = currentRoute.query

      const importCode = getQueryString(query, 'importCode')
      if (!importCode) return

      inFlight.value = true
      isLoadingExternalData.value = true
      try {
        const fetched = await fetchPromptFromGarden({
          gardenBaseUrl,
          importCode,
        })

        const targetKey = resolveTargetKey(query, currentRoute.path, fetched.optimizerTargetKey)

        // If caller opened the wrong workspace, navigate first.
        const targetPath = keyToPath(targetKey)
        if (router.currentRoute.value.path !== targetPath) {
          // Preserve existing query during navigation; we'll strip import params after import.
          await router.push({ path: targetPath, query })
          await nextTick()
        }

        if (targetKey === 'pro-multi') {
          const messages =
            fetched.promptFormat === 'messages'
              ? (fetched.promptMessages as ConversationMessage[])
              : buildConversationFromPromptText(fetched.promptText ?? '')

          if (!messages.length) {
            throw new Error('Empty conversation content')
          }

          // Pro Multi UI reads from optimizationContext; session store keeps a persisted snapshot.
          optimizationContext.value = messages
          proMultiMessageSession.updateConversationMessages(messages)

          // Reset state that is tied to the previously selected message/chain.
          proMultiMessageSession.setMessageChainMap({})
          proMultiMessageSession.updateTestResults(null)
          proMultiMessageSession.updateOptimizedResult({
            optimizedPrompt: '',
            reasoning: '',
            chainId: '',
            versionId: '',
          })
          proMultiMessageSession.evaluationResults = createDefaultEvaluationResults()

          // Auto-select latest system/user message for convenience.
          let selectedId = ''
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i]
            if (!msg) continue
            if ((msg.role === 'system' || msg.role === 'user') && msg.id) {
              selectedId = msg.id
              break
            }
          }
          proMultiMessageSession.selectMessage(selectedId)
        } else {
          const content = fetched.promptText ?? ''
          if (!content) {
            throw new Error('Empty prompt content')
          }

          clearSessionForExternalImport(
            targetKey,
            {
              basicSystemSession,
              basicUserSession,
              proVariableSession,
              imageText2ImageSession,
              imageImage2ImageSession,
              optimizerCurrentVersions,
            },
            content
          )
        }

        // Import variables into submode-scoped temporary variables.
        ensureImportedTemporaryVariables(
          targetKey,
          {
            proMultiMessageSession,
            proVariableSession,
            imageText2ImageSession,
            imageImage2ImageSession,
          },
          {
            variables: fetched.variables,
          }
        )

        // Best-effort persist.
        try {
          if (targetKey === 'basic-system') await basicSystemSession.saveSession()
          else if (targetKey === 'basic-user') await basicUserSession.saveSession()
          else if (targetKey === 'pro-multi') await proMultiMessageSession.saveSession()
          else if (targetKey === 'pro-variable') await proVariableSession.saveSession()
          else if (targetKey === 'image-text2image') await imageText2ImageSession.saveSession()
          else await imageImage2ImageSession.saveSession()
        } catch (e) {
          console.warn('[PromptGardenImport] saveSession failed:', e)
        }

        // Remove import params to avoid re-import on refresh.
        const cleanedQuery = omitKeys(query, ['importCode', 'subModeKey'])
        await router.replace({ path: router.currentRoute.value.path, query: cleanedQuery })
        await nextTick()

        toast.success(String(i18n.global.t('toast.success.promptGardenImportSuccess')))
      } catch (error) {
        console.error('[PromptGardenImport] Failed:', error)
        toast.error(String(i18n.global.t('toast.error.promptGardenImportFailed')))
      } finally {
        isLoadingExternalData.value = false
        inFlight.value = false
      }
    },
    { immediate: true }
  )

  return {
    // For potential future manual triggers.
  }
}
