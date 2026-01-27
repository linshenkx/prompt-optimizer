import { computed, unref, type ComputedRef, type Ref } from 'vue'

import { useI18n } from 'vue-i18n'

import { platform } from '../../utils/platform'
import { useToast } from '../ui/useToast'

export type VariableExtractionType = 'global' | 'temporary'

export type VariableExtractionPayload = {
  variableName: string
  variableValue: string
  variableType: VariableExtractionType
}

export type VariableAwareInputData = {
  existingGlobalVariables: string[]
  existingTemporaryVariables: string[]
  predefinedVariables: string[]
  globalVariableValues: Record<string, string>
  temporaryVariableValues: Record<string, string>
  predefinedVariableValues: Record<string, string>
}

type MaybeRef<T> = T | Ref<T> | ComputedRef<T>

export type UseVariableAwareInputBridgeParams = {
  enabled: MaybeRef<boolean>
  isReady?: MaybeRef<boolean>

  // Sources for VariableAwareInput maps
  globalVariables: MaybeRef<Record<string, string>>
  temporaryVariables: MaybeRef<Record<string, string>>

  // Either provide predefinedVariables explicitly OR let bridge derive it from allVariables - globalVariables.
  predefinedVariables?: MaybeRef<Record<string, string>>
  allVariables?: MaybeRef<Record<string, string>>

  // Persistence / storage actions
  saveGlobalVariable: (name: string, value: string) => void
  saveTemporaryVariable: (name: string, value: string) => void

  // Optional hooks (e.g. Pro mode wants to emit extra events)
  afterVariableExtracted?: (data: VariableExtractionPayload) => void
  afterAddMissingVariable?: (name: string) => void

  // For consistent logs/toasts
  logPrefix?: string
}

const computePredefinedFromAll = (
  all: Record<string, string>,
  global: Record<string, string>,
): Record<string, string> => {
  const predefined: Record<string, string> = {}
  for (const [key, value] of Object.entries(all)) {
    if (!(key in global)) predefined[key] = value
  }
  return predefined
}

export function useVariableAwareInputBridge(params: UseVariableAwareInputBridgeParams) {
  const { t } = useI18n()
  const toast = useToast()

  const predefinedVariableValues = computed<Record<string, string>>(() => {
    if (params.predefinedVariables) {
      return unref(params.predefinedVariables) || {}
    }

    const all = params.allVariables ? unref(params.allVariables) || {} : {}
    const global = unref(params.globalVariables) || {}
    return computePredefinedFromAll(all, global)
  })

  const variableInputData = computed<VariableAwareInputData | null>(() => {
    if (!unref(params.enabled)) return null
    if (params.isReady !== undefined && !unref(params.isReady)) return null

    const global = unref(params.globalVariables) || {}
    const temporary = unref(params.temporaryVariables) || {}
    const predefined = predefinedVariableValues.value || {}

    return {
      existingGlobalVariables: Object.keys(global),
      existingTemporaryVariables: Object.keys(temporary),
      predefinedVariables: Object.keys(predefined),
      globalVariableValues: global,
      temporaryVariableValues: temporary,
      predefinedVariableValues: predefined,
    }
  })

  const handleVariableExtracted = (data: VariableExtractionPayload) => {
    const prefix = params.logPrefix ? `[${params.logPrefix}] ` : ''

    if (data.variableType === 'global') {
      try {
        params.saveGlobalVariable(data.variableName, data.variableValue)
        toast.success(t('variableExtraction.savedToGlobal', { name: data.variableName }))
      } catch (error) {
        // Some callers persist to PreferenceService and may throw (invalid name, etc.).
        console.error(`${prefix}Failed to save global variable:`, error)
        toast.error(
          t('variableExtraction.saveFailedWithUndo', {
            name: data.variableName,
            undo: platform.getUndoKey(),
          }),
          { duration: 8000, closable: true },
        )
      }

      params.afterVariableExtracted?.(data)
      return
    }

    try {
      params.saveTemporaryVariable(data.variableName, data.variableValue)
      toast.success(t('variableExtraction.savedToTemporary', { name: data.variableName }))
    } catch (error) {
      console.error(`${prefix}Failed to save temporary variable:`, error)
      toast.error(
        t('variableExtraction.saveFailedWithUndo', {
          name: data.variableName,
          undo: platform.getUndoKey(),
        }),
        { duration: 8000, closable: true },
      )
    }

    params.afterVariableExtracted?.(data)
  }

  const handleAddMissingVariable = (name: string) => {
    const prefix = params.logPrefix ? `[${params.logPrefix}] ` : ''

    try {
      params.saveTemporaryVariable(name, '')
      // VariableAwareInput already shows a success toast. Keep bridge silent on success
      // to avoid duplicate notifications across workspaces.
    } catch (error) {
      console.error(`${prefix}Failed to add missing variable:`, error)
      toast.error(
        t('variableExtraction.saveFailedWithUndo', {
          name,
          undo: platform.getUndoKey(),
        }),
        { duration: 8000, closable: true },
      )
    }

    params.afterAddMissingVariable?.(name)
  }

  return {
    variableInputData,
    predefinedVariableValues,
    handleVariableExtracted,
    handleAddMissingVariable,
  }
}
