import type { Ref } from 'vue'
import type { ConversationMessage, PromptRecordChain } from '@prompt-optimizer/core'

import { isValidVariableName } from '../types/variable'

export type WorkspaceApplyTargetKey =
  | 'basic-system'
  | 'basic-user'
  | 'pro-multi'
  | 'pro-variable'
  | 'image-text2image'
  | 'image-image2image'
  | 'image-multiimage'

export const WORKSPACE_APPLY_TARGET_KEYS: ReadonlyArray<WorkspaceApplyTargetKey> = [
  'basic-system',
  'basic-user',
  'pro-multi',
  'pro-variable',
  'image-text2image',
  'image-image2image',
  'image-multiimage',
]

export const isWorkspaceApplyTargetKey = (
  value: string | null | undefined,
): value is WorkspaceApplyTargetKey => {
  if (!value) return false
  return (WORKSPACE_APPLY_TARGET_KEYS as readonly string[]).includes(value)
}

export type WorkspaceClearableSession = {
  clearContent?: (options?: { persist?: boolean }) => void
}

export type WorkspaceTemporaryVariablesSession = {
  getTemporaryVariable: (name: string) => string | undefined
  setTemporaryVariable: (name: string, value: string) => void
  clearTemporaryVariables: () => void
}

export type WorkspaceExternalApplySessions = {
  basicSystemSession?: WorkspaceClearableSession
  basicUserSession?: WorkspaceClearableSession
  proMultiMessageSession?: WorkspaceClearableSession & WorkspaceTemporaryVariablesSession
  proVariableSession?: WorkspaceClearableSession & WorkspaceTemporaryVariablesSession
  imageText2ImageSession?: WorkspaceClearableSession & WorkspaceTemporaryVariablesSession
  imageImage2ImageSession?: WorkspaceClearableSession & WorkspaceTemporaryVariablesSession
  imageMultiImageSession?: WorkspaceClearableSession & WorkspaceTemporaryVariablesSession
  optimizerCurrentVersions?: Ref<PromptRecordChain['versions']>
}

export type WorkspaceVariableDefinition = {
  name: string
  defaultValue?: unknown
  description?: unknown
  required?: unknown
  options?: unknown
}

export const OPTIONAL_VARIABLE_PLACEHOLDER = 'undefined'

const resolveVariableApplyValue = (
  variable: WorkspaceVariableDefinition | undefined,
  value: unknown = variable?.defaultValue,
): string => {
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    return String(value)
  }

  return variable?.required === false ? OPTIONAL_VARIABLE_PLACEHOLDER : ''
}

export const getWorkspaceTemporaryVariablesSession = (
  targetKey: string | null | undefined,
  api: Pick<
    WorkspaceExternalApplySessions,
    | 'proMultiMessageSession'
    | 'proVariableSession'
    | 'imageText2ImageSession'
    | 'imageImage2ImageSession'
    | 'imageMultiImageSession'
  >,
): WorkspaceTemporaryVariablesSession | null => {
  switch (targetKey) {
    case 'pro-multi':
      return api.proMultiMessageSession || null
    case 'pro-variable':
      return api.proVariableSession || null
    case 'image-text2image':
      return api.imageText2ImageSession || null
    case 'image-image2image':
      return api.imageImage2ImageSession || null
    case 'image-multiimage':
      return api.imageMultiImageSession || null
    default:
      return null
  }
}

export const clearWorkspaceContentForExternalApply = (
  targetKey: string | null | undefined,
  api: WorkspaceExternalApplySessions,
): boolean => {
  if (!isWorkspaceApplyTargetKey(targetKey)) return false

  if (targetKey === 'basic-system') {
    api.basicSystemSession?.clearContent?.({ persist: false })
    if (api.optimizerCurrentVersions) api.optimizerCurrentVersions.value = []
    return true
  }

  if (targetKey === 'basic-user') {
    api.basicUserSession?.clearContent?.({ persist: false })
    if (api.optimizerCurrentVersions) api.optimizerCurrentVersions.value = []
    return true
  }

  if (targetKey === 'pro-multi') {
    api.proMultiMessageSession?.clearContent?.({ persist: false })
    return true
  }

  if (targetKey === 'pro-variable') {
    api.proVariableSession?.clearContent?.({ persist: false })
    return true
  }

  if (targetKey === 'image-text2image') {
    api.imageText2ImageSession?.clearContent?.({ persist: false })
    return true
  }

  if (targetKey === 'image-multiimage') {
    api.imageMultiImageSession?.clearContent?.({ persist: false })
    return true
  }

  api.imageImage2ImageSession?.clearContent?.({ persist: false })
  return true
}

export const applyWorkspaceTemporaryVariables = (
  targetKey: string | null | undefined,
  api: Pick<
    WorkspaceExternalApplySessions,
    | 'proMultiMessageSession'
    | 'proVariableSession'
    | 'imageText2ImageSession'
    | 'imageImage2ImageSession'
    | 'imageMultiImageSession'
  >,
  opts: {
    variables: WorkspaceVariableDefinition[]
    parameters?: Record<string, unknown>
    preserveExistingValues?: boolean
    restrictParametersToDefinitions?: boolean
  },
) => {
  const session = getWorkspaceTemporaryVariablesSession(targetKey, api)
  if (!session) return

  const variableEntries = opts.variables
    .map((variable) => ({
      name: String(variable?.name || '').trim(),
      value: resolveVariableApplyValue(variable),
      definition: variable,
    }))
    .filter((variable) => isValidVariableName(variable.name))

  const variableNames = new Set(variableEntries.map((variable) => variable.name))
  const variableDefinitions = new Map(variableEntries.map((variable) => [
    variable.name,
    variable.definition,
  ]))
  const preservedValues = new Map<string, string>()

  if (opts.preserveExistingValues) {
    for (const { name } of variableEntries) {
      const existing = session.getTemporaryVariable(name)
      if (existing !== undefined && String(existing).trim() !== '') {
        preservedValues.set(name, existing)
      }
    }
  }

  session.clearTemporaryVariables()

  for (const { name, value } of variableEntries) {
    session.setTemporaryVariable(name, preservedValues.get(name) ?? value)
  }

  for (const [key, value] of Object.entries(opts.parameters || {})) {
    const name = key.trim()
    if (!isValidVariableName(name)) continue
    if (opts.restrictParametersToDefinitions && variableNames.size > 0 && !variableNames.has(name)) continue
    session.setTemporaryVariable(name, resolveVariableApplyValue(variableDefinitions.get(name), value))
  }
}

let workspaceApplyMessageIdSeed = 0

export const generateWorkspaceApplyMessageId = (prefix = 'workspace-apply'): string => {
  const maybeCrypto = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined
  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
    return maybeCrypto.randomUUID()
  }

  workspaceApplyMessageIdSeed += 1
  return `${prefix}-${Date.now()}-${workspaceApplyMessageIdSeed}`
}

export const buildWorkspaceConversationFromPromptText = (
  content: string,
  idPrefix = 'workspace-apply',
): ConversationMessage[] => {
  const text = String(content || '')
  if (!text) return []
  const id = generateWorkspaceApplyMessageId(idPrefix)
  return [{ id, role: 'system', content: text, originalContent: text }]
}
