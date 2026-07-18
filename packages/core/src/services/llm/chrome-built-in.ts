import type { TextModelConfig } from '../model/types'

export const CHROME_BUILT_IN_PROVIDER_ID = 'chrome-built-in'
export const CHROME_BUILT_IN_MODEL_ID = 'gemini-nano'
export const CHROME_BUILT_IN_AUTO_ENABLE_SOURCE = 'chrome-built-in-availability'

export type ChromeBuiltInAvailability =
  | 'api-missing'
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'

export interface ChromeBuiltInStatus {
  availability: ChromeBuiltInAvailability
  error?: string
}

export interface ChromeBuiltInDownloadProgress {
  loaded: number
  total?: number
}

const hasConnectionConfigValue = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.keys(value).length > 0
  return value !== undefined && value !== null && value !== false
}

export const canAutoEnableChromeBuiltInConfig = (config: TextModelConfig | undefined): config is TextModelConfig => {
  if (!config) return false
  if (config.id !== CHROME_BUILT_IN_PROVIDER_ID) return false
  if (config.providerMeta?.id !== CHROME_BUILT_IN_PROVIDER_ID) return false
  if (config.enabled) return false
  if (config.activationState?.userConfigured) return false

  return !Object.values(config.connectionConfig || {}).some(hasConnectionConfigValue)
}

export const markChromeBuiltInAutoEnabled = (config: TextModelConfig): Partial<TextModelConfig> => ({
  enabled: true,
  activationState: {
    ...(config.activationState || {}),
    userConfigured: false,
    autoEnabledBy: CHROME_BUILT_IN_AUTO_ENABLE_SOURCE
  }
})

export const markChromeBuiltInUserConfigured = (
  config: TextModelConfig | undefined,
  enabled: boolean
): Partial<TextModelConfig> => ({
  enabled,
  activationState: {
    ...(config?.activationState || {}),
    userConfigured: true,
    autoEnabledBy: undefined
  }
})

export interface ChromeLanguageModelSession {
  prompt(
    input: ChromeLanguageModelPromptInput,
    options?: { signal?: AbortSignal }
  ): Promise<string>
  promptStreaming(
    input: ChromeLanguageModelPromptInput,
    options?: { signal?: AbortSignal }
  ): AsyncIterable<string> | Promise<AsyncIterable<string>>
  destroy?: () => void
}

export interface ChromeLanguageModelMonitor {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: ChromeBuiltInDownloadProgress) => void
  ): void
}

export type ChromeLanguageModelPromptRole = 'system' | 'user' | 'assistant'
export type ChromeLanguageModelSupportedLanguage = 'en' | 'es' | 'ja'

export interface ChromeLanguageModelPrompt {
  role: ChromeLanguageModelPromptRole
  content: string
}

export type ChromeLanguageModelPromptInput = string | ChromeLanguageModelPrompt[]

export interface ChromeLanguageModelTextExpectation {
  type: 'text'
  languages: ChromeLanguageModelSupportedLanguage[]
}

export interface ChromeLanguageModelLanguageOptions {
  expectedInputs?: ChromeLanguageModelTextExpectation[]
  expectedOutputs?: ChromeLanguageModelTextExpectation[]
}

export interface ChromeLanguageModelCreateOptions extends ChromeLanguageModelLanguageOptions {
  initialPrompts?: ChromeLanguageModelPrompt[]
  monitor?: (monitor: ChromeLanguageModelMonitor) => void
}

export interface ChromeLanguageModelGlobal {
  availability(options?: ChromeLanguageModelLanguageOptions): Promise<Exclude<ChromeBuiltInAvailability, 'api-missing'>>
  create(options?: ChromeLanguageModelCreateOptions): Promise<ChromeLanguageModelSession>
}

export const CHROME_BUILT_IN_DEFAULT_LANGUAGE_OPTIONS: ChromeLanguageModelLanguageOptions = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }]
}

declare global {
  // Chrome Prompt API is browser-provided and absent in most non-Chrome runtimes.
  // Keep the declaration narrow to the API surface this app actually uses.
  // eslint-disable-next-line no-var
  var LanguageModel: ChromeLanguageModelGlobal | undefined
}

const getLanguageModel = (): ChromeLanguageModelGlobal | undefined => {
  return globalThis.LanguageModel
}

export const checkChromeBuiltInAvailability = async (
  options?: ChromeLanguageModelLanguageOptions
): Promise<ChromeBuiltInStatus> => {
  const languageModel = getLanguageModel()
  if (!languageModel) {
    return { availability: 'api-missing' }
  }

  try {
    const availability = await languageModel.availability({
      ...CHROME_BUILT_IN_DEFAULT_LANGUAGE_OPTIONS,
      ...options
    })
    return { availability }
  } catch (error) {
    return {
      availability: 'unavailable',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export const createChromeBuiltInSession = async (
  options: ChromeLanguageModelCreateOptions = {}
): Promise<ChromeLanguageModelSession> => {
  const languageModel = getLanguageModel()
  if (!languageModel) {
    throw new Error('Chrome built-in AI is not available in this browser')
  }

  return await languageModel.create({
    ...CHROME_BUILT_IN_DEFAULT_LANGUAGE_OPTIONS,
    ...options
  })
}

export const prepareChromeBuiltInModel = async (
  onDownloadProgress?: (progress: ChromeBuiltInDownloadProgress) => void
): Promise<ChromeBuiltInStatus> => {
  const status = await checkChromeBuiltInAvailability()
  if (status.availability === 'api-missing' || status.availability === 'unavailable') {
    return status
  }

  const session = await createChromeBuiltInSession({
    monitor: onDownloadProgress
      ? (monitor) => {
          monitor.addEventListener('downloadprogress', onDownloadProgress)
        }
      : undefined
  })

  session.destroy?.()
  return await checkChromeBuiltInAvailability()
}
