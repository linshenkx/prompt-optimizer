/**
 * 变量值生成服务 Composable
 *
 * 提供 AI 智能变量值生成功能的响应式接口
 */

import { ref, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import type { AppServices } from '../../types/services'
import type {
  VariableValueGenerationResponse,
  GeneratedVariableValue,
  VariableToGenerate,
} from '@prompt-optimizer/core'

/**
 * 变量值生成 Composable 返回类型
 */
export interface UseVariableValueGenerationReturn {
  /** 是否正在生成 */
  isGenerating: Ref<boolean>
  /** 生成结果 */
  generationResult: Ref<VariableValueGenerationResponse | null>
  /** 是否显示预览对话框 */
  showPreviewDialog: Ref<boolean>
  /** 生成变量值方法 */
  generateValues: (
    promptContent: string,
    variables: VariableToGenerate[],
    generationModelKey: string
  ) => Promise<void>
  /** 批量应用变量值方法 */
  confirmBatchApply: (selectedValues: GeneratedVariableValue[]) => void
}

/**
 * 使用变量值生成功能
 *
 * @param services - 应用服务
 * @param onValueApplied - 变量值应用回调 (name, value) => void
 * @returns 变量值生成相关状态和方法
 */
export function useVariableValueGeneration(
  services: Ref<AppServices | null>,
  onValueApplied?: (name: string, value: string) => void
): UseVariableValueGenerationReturn {
  const toast = useToast()
  const { t } = useI18n()

  // 状态
  const isGenerating = ref(false)
  const generationResult = ref<VariableValueGenerationResponse | null>(null)
  const showPreviewDialog = ref(false)

  /**
   * 生成变量值
   */
  const generateValues = async (
    promptContent: string,
    variables: VariableToGenerate[],
    generationModelKey: string
  ): Promise<void> => {
    if (!services.value?.variableValueGenerationService) {
      toast.error(t('test.variableValueGeneration.serviceNotReady'))
      return
    }

    if (variables.length === 0) {
      toast.info(t('test.variableValueGeneration.noVariablesToGenerate'))
      return
    }

    isGenerating.value = true

    try {
      const result = await services.value.variableValueGenerationService.generate({
        promptContent,
        variables,
        generationModelKey,
      })

      generationResult.value = result

      if (result.values.length > 0) {
        showPreviewDialog.value = true
      } else {
        toast.info(t('test.variableValueGeneration.noValues'))
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      toast.error(`${t('test.variableValueGeneration.generateFailed')}: ${errorMsg}`)
      console.error('[useVariableValueGeneration] Generate failed:', error)
    } finally {
      isGenerating.value = false
    }
  }

  /**
   * 批量应用变量值
   */
  const confirmBatchApply = (selectedValues: GeneratedVariableValue[]): void => {
    let successCount = 0

    // 应用变量值
    for (const item of selectedValues) {
      try {
        if (onValueApplied) {
          onValueApplied(item.name, item.value)
          successCount++
        }
      } catch (error) {
        console.error(`[useVariableValueGeneration] Failed to apply value for ${item.name}:`, error)
      }
    }

    showPreviewDialog.value = false

    if (successCount > 0) {
      toast.success(t('test.variableValueGeneration.applySuccess', { count: successCount }))
    }
  }

  return {
    isGenerating,
    generationResult,
    showPreviewDialog,
    generateValues,
    confirmBatchApply,
  }
}
