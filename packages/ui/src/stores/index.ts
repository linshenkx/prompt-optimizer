/**
 * Pinia Stores 统一导出
 */

// 临时变量 store
export {
  useTemporaryVariablesStore,
  type TemporaryVariablesMap,
  type TemporaryVariablesStoreApi,
} from './temporaryVariables'

// PromptDraft store（计划废弃，将被 session stores 替代）
export { usePromptDraftStore, type PromptDraftStoreApi } from './promptDraft'

// Session 管理
export {
  useSessionManager,
  type SubModeKey,
  type SubModeReaders,
  type SessionManagerApi,
} from './session/useSessionManager'

// Session Stores（按子模式组织）
export {
  useBasicSystemSession,
  type BasicSystemSessionState,
  type BasicSystemSessionApi,
} from './session/useBasicSystemSession'

export {
  useBasicUserSession,
  type BasicUserSessionState,
  type BasicUserSessionApi,
} from './session/useBasicUserSession'

export {
  useProMultiMessageSession,
  type ProMultiMessageSessionApi,
} from './session/useProMultiMessageSession'

export {
  useProVariableSession,
  type ProVariableSessionApi,
} from './session/useProVariableSession'

export {
  useImageText2ImageSession,
  type ImageText2ImageSessionApi,
} from './session/useImageText2ImageSession'

export {
  useImageImage2ImageSession,
  type ImageImage2ImageSessionApi,
} from './session/useImageImage2ImageSession'

// Global settings（Phase 1）
export {
  useGlobalSettings,
  type GlobalSettingsState,
  type GlobalSettingsApi,
} from './settings/useGlobalSettings'
