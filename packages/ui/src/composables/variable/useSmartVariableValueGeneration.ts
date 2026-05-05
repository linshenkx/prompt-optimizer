import type { ComputedRef, Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  GeneratedVariableValue,
  VariableToGenerate,
  VariableValueGenerationResponse,
} from '@prompt-optimizer/core'

import { useToast } from '../ui/useToast'
import { useFunctionModelManager } from '../model/useFunctionModelManager'
import { useVariableValueGeneration } from './useVariableValueGeneration'
import type { AppServices } from '../../types/services'
import { formatErrorSummary } from '../../utils/error'

type VariableSource = 'predefined' | 'test' | 'global' | 'empty'

export type VariableValueGenerationMetadata = {
  description?: string
  defaultValue?: string
}

export interface UseSmartVariableValueGenerationOptions {
  services: Ref<AppServices | null>

  // Prompt content to use as context for generation.
  promptContent: Ref<string> | ComputedRef<string>

  // Variables to consider; only missing (empty/whitespace) ones are generated.
  variableNames: Ref<string[]> | ComputedRef<string[]>
  getVariableValue: (name: string) => string
  getVariableSource: (name: string) => VariableSource
  getVariableMetadata?: (name: string) => VariableValueGenerationMetadata | undefined
  applyValue: (name: string, value: string) => void

  // Optional fallback model key, e.g. passed from workspace props.
  evaluationModelKey?: Ref<string> | ComputedRef<string>
}

export interface UseSmartVariableValueGenerationReturn {
  isGenerating: Ref<boolean>
  generationResult: Ref<VariableValueGenerationResponse | null>
  showPreviewDialog: Ref<boolean>
  handleGenerateValues: (targetName?: string) => Promise<void>
  confirmBatchApply: (selectedValues: GeneratedVariableValue[]) => void
}

export interface VariableValueGenerationPlan {
  variablesToGenerate: VariableToGenerate[]
  contextVariables: VariableToGenerate[]
}

export function buildVariableValueGenerationPlan(
  variableNames: string[],
  getVariableValue: (name: string) => string,
  getVariableSource: (name: string) => VariableSource,
  targetName = '',
  getVariableMetadata?: (name: string) => VariableValueGenerationMetadata | undefined
): VariableValueGenerationPlan {
  const buildVariableToGenerate = (name: string): VariableToGenerate => {
    const currentValueRaw = getVariableValue(name)
    const currentValue = typeof currentValueRaw === 'string' ? currentValueRaw : String(currentValueRaw ?? '')
    const trimmedCurrentValue = currentValue.trim()
    const metadata = getVariableMetadata?.(name)
    return {
      name,
      ...(metadata?.description?.trim() ? { description: metadata.description.trim() } : {}),
      ...(metadata?.defaultValue?.trim() ? { defaultValue: metadata.defaultValue.trim() } : {}),
      source: getVariableSource(name),
      ...(trimmedCurrentValue ? { currentValue: trimmedCurrentValue } : {}),
    }
  }

  const trimmedTargetName = targetName.trim()
  const allVariables = variableNames.map((name) => buildVariableToGenerate(name))

  if (trimmedTargetName) {
    return {
      variablesToGenerate: [buildVariableToGenerate(trimmedTargetName)],
      contextVariables: [],
    }
  }

  return {
    variablesToGenerate: allVariables.filter((variable) => {
      const value = getVariableValue(variable.name)
      return !value || value.trim() === ''
    }),
    contextVariables: allVariables.filter((variable) => {
      const value = getVariableValue(variable.name)
      return !!value && value.trim() !== ''
    }),
  }
}

export function useSmartVariableValueGeneration(
  options: UseSmartVariableValueGenerationOptions
): UseSmartVariableValueGenerationReturn {
  const { t } = useI18n()
  const toast = useToast()

  const functionModelManager = useFunctionModelManager(options.services)

  const {
    isGenerating,
    generationResult,
    showPreviewDialog,
    generateValues,
    confirmBatchApply,
  } = useVariableValueGeneration(options.services, options.applyValue)

  const handleGenerateValues = async (targetName?: string) => {
    const promptContent = options.promptContent.value || ''
    if (!promptContent) {
      toast.warning(t('test.variableValueGeneration.noPrompt'))
      return
    }

    const trimmedTargetName = (targetName || '').trim()

    const { variablesToGenerate, contextVariables } = buildVariableValueGenerationPlan(
      options.variableNames.value,
      options.getVariableValue,
      options.getVariableSource,
      trimmedTargetName,
      options.getVariableMetadata
    )

    if (!trimmedTargetName && variablesToGenerate.length === 0) {
      toast.info(t('test.variableValueGeneration.noMissingVariables'))
      return
    }

    try {
      await functionModelManager.initialize()
    } catch (error) {
      toast.error(formatErrorSummary(t('test.variableValueGeneration.generateFailed'), error))
      console.error('[useSmartVariableValueGeneration] initialize failed:', error)
      return
    }

    const passedEvaluationModelKey = options.evaluationModelKey?.value || ''
    const generationModelKey =
      functionModelManager.evaluationModel.value ||
      passedEvaluationModelKey ||
      functionModelManager.effectiveEvaluationModel.value ||
      ''

    if (!generationModelKey) {
      toast.warning(t('evaluation.variableExtraction.noEvaluationModel'))
      return
    }

    await generateValues(promptContent, variablesToGenerate, generationModelKey, contextVariables)
  }

  return {
    isGenerating,
    generationResult,
    showPreviewDialog,
    handleGenerateValues,
    confirmBatchApply,
  }
}
