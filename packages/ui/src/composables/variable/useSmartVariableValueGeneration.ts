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
import { getI18nErrorMessage } from '../../utils/error'

type VariableSource = 'predefined' | 'test' | 'global' | 'empty'

export interface UseSmartVariableValueGenerationOptions {
  services: Ref<AppServices | null>

  // Prompt content to use as context for generation.
  promptContent: Ref<string> | ComputedRef<string>

  // Variables to consider; only missing (empty/whitespace) ones are generated.
  variableNames: Ref<string[]> | ComputedRef<string[]>
  getVariableValue: (name: string) => string
  getVariableSource: (name: string) => VariableSource
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

    const buildVariableToGenerate = (name: string): VariableToGenerate => {
      const currentValueRaw = options.getVariableValue(name)
      const currentValue = typeof currentValueRaw === 'string' ? currentValueRaw : String(currentValueRaw ?? '')
      const trimmedCurrentValue = currentValue.trim()
      return {
        name,
        source: options.getVariableSource(name),
        // For single-variable inference, passing currentValue helps the model refine/override.
        ...(trimmedCurrentValue ? { currentValue: trimmedCurrentValue } : {}),
      }
    }

    const trimmedTargetName = (targetName || '').trim()

    // Batch mode (no target): only generate missing (empty/whitespace) variables.
    // Single mode (target provided): allow inferring a single variable even if it already has a value.
    const variablesToGenerate: VariableToGenerate[] = trimmedTargetName
      ? [buildVariableToGenerate(trimmedTargetName)]
      : options.variableNames.value
          .filter((name) => {
            const value = options.getVariableValue(name)
            return !value || value.trim() === ''
          })
          .map((name) => buildVariableToGenerate(name))

    if (!trimmedTargetName && variablesToGenerate.length === 0) {
      toast.info(t('test.variableValueGeneration.noMissingVariables'))
      return
    }

    try {
      await functionModelManager.initialize()
    } catch (error) {
      const errorMsg = getI18nErrorMessage(error, 'Unknown error')
      toast.error(`${t('test.variableValueGeneration.generateFailed')}: ${errorMsg}`)
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

    await generateValues(promptContent, variablesToGenerate, generationModelKey)
  }

  return {
    isGenerating,
    generationResult,
    showPreviewDialog,
    handleGenerateValues,
    confirmBatchApply,
  }
}
