import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest'
import { EvaluationService } from '../../../src/services/evaluation/service'
import {
  EvaluationValidationError,
  EvaluationModelError,
  EvaluationTemplateError,
} from '../../../src/services/evaluation/errors'
import type {
  OriginalEvaluationRequest,
  OptimizedEvaluationRequest,
  CompareEvaluationRequest,
  PromptOnlyEvaluationRequest,
  PromptIterateEvaluationRequest,
  EvaluationModeConfig,
} from '../../../src/services/evaluation/types'

describe('EvaluationService', () => {
  let evaluationService: EvaluationService
  let mockLLMService: any
  let mockModelManager: any
  let mockTemplateManager: any

  const defaultModeConfig: EvaluationModeConfig = {
    functionMode: 'basic',
    subMode: 'system',
  }

  const mockEvaluationResult = JSON.stringify({
    score: {
      overall: 85,
      dimensions: [
        { key: 'clarity', label: 'Clarity', score: 90 },
        { key: 'structure', label: 'Structure', score: 80 },
      ],
    },
    improvements: ['Add more examples'],
    patchPlan: [
      {
        op: 'replace',
        oldText: 'Old section',
        newText: 'New section with better instructions',
        instruction: 'Clarify the expected output structure',
      },
    ],
    summary: 'Good prompt',
  })

  beforeEach(() => {
    mockLLMService = {
      sendMessage: vi.fn().mockResolvedValue(mockEvaluationResult),
      sendMessageStream: vi.fn(),
    }

    mockModelManager = {
      getModel: vi.fn().mockResolvedValue({ id: 'test-model', enabled: true }),
    }

    mockTemplateManager = {
      getTemplate: vi.fn().mockResolvedValue({
        id: 'evaluation-basic-system-original',
        content: [
          { role: 'system', content: 'You are an evaluator.' },
          { role: 'user', content: '{{originalPrompt}}' },
        ],
      }),
    }

    evaluationService = new EvaluationService(
      mockLLMService,
      mockModelManager,
      mockTemplateManager
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('validateRequest', () => {
    describe('prompt-only type', () => {
      it('should pass validation with valid prompt-only request', async () => {
        const request: PromptOnlyEvaluationRequest = {
          type: 'prompt-only',
          originalPrompt: 'Original prompt',
          optimizedPrompt: 'Optimized prompt',
          evaluationModelKey: 'test-model',
          mode: defaultModeConfig,
        }

        await expect(evaluationService.evaluate(request)).resolves.toBeDefined()
      })

      it('should throw error when optimizedPrompt is empty for prompt-only', async () => {
        const request: PromptOnlyEvaluationRequest = {
          type: 'prompt-only',
          originalPrompt: 'Original prompt',
          optimizedPrompt: '',
          evaluationModelKey: 'test-model',
          mode: defaultModeConfig,
        }

        await expect(evaluationService.evaluate(request)).rejects.toThrow(
          EvaluationValidationError
        )
      })

      it('should NOT require testResult for prompt-only type', async () => {
        const request: PromptOnlyEvaluationRequest = {
          type: 'prompt-only',
          originalPrompt: 'Original prompt',
          optimizedPrompt: 'Optimized prompt',
          evaluationModelKey: 'test-model',
          mode: defaultModeConfig,
          // No testResult - this should be valid
        }

        await expect(evaluationService.evaluate(request)).resolves.toBeDefined()
      })
    })

    describe('prompt-iterate type', () => {
      it('should pass validation with valid prompt-iterate request', async () => {
        const request: PromptIterateEvaluationRequest = {
          type: 'prompt-iterate',
          originalPrompt: 'Original prompt',
          optimizedPrompt: 'Optimized prompt',
          iterateRequirement: 'Make it more concise',
          evaluationModelKey: 'test-model',
          mode: defaultModeConfig,
        }

        await expect(evaluationService.evaluate(request)).resolves.toBeDefined()
      })

      it('should throw error when optimizedPrompt is empty for prompt-iterate', async () => {
        const request: PromptIterateEvaluationRequest = {
          type: 'prompt-iterate',
          originalPrompt: 'Original prompt',
          optimizedPrompt: '',
          iterateRequirement: 'Make it more concise',
          evaluationModelKey: 'test-model',
          mode: defaultModeConfig,
        }

        await expect(evaluationService.evaluate(request)).rejects.toThrow(
          EvaluationValidationError
        )
      })

      it('should throw error when iterateRequirement is empty for prompt-iterate', async () => {
        const request: PromptIterateEvaluationRequest = {
          type: 'prompt-iterate',
          originalPrompt: 'Original prompt',
          optimizedPrompt: 'Optimized prompt',
          iterateRequirement: '',
          evaluationModelKey: 'test-model',
          mode: defaultModeConfig,
        }

        await expect(evaluationService.evaluate(request)).rejects.toThrow()
      })

      it('should throw error when iterateRequirement is whitespace only', async () => {
        const request: PromptIterateEvaluationRequest = {
          type: 'prompt-iterate',
          originalPrompt: 'Original prompt',
          optimizedPrompt: 'Optimized prompt',
          iterateRequirement: '   ',
          evaluationModelKey: 'test-model',
          mode: defaultModeConfig,
        }

        await expect(evaluationService.evaluate(request)).rejects.toThrow()
      })
    })

    describe('common validations', () => {
      it('should allow empty originalPrompt for original type', async () => {
        const request: OriginalEvaluationRequest = {
          type: 'original',
          testResult: 'some result',
          evaluationModelKey: 'test-model',
          mode: defaultModeConfig,
        }

        await expect(evaluationService.evaluate(request)).resolves.toBeDefined()
      })

      it('should throw error when evaluationModelKey is empty', async () => {
        const request: PromptOnlyEvaluationRequest = {
          type: 'prompt-only',
          originalPrompt: 'Original prompt',
          optimizedPrompt: 'Optimized prompt',
          evaluationModelKey: '',
          mode: defaultModeConfig,
        }

        await expect(evaluationService.evaluate(request)).rejects.toThrow()
      })

      it('should throw error when mode is missing', async () => {
        const request = {
          type: 'prompt-only',
          originalPrompt: 'Original prompt',
          optimizedPrompt: 'Optimized prompt',
          evaluationModelKey: 'test-model',
          // mode is missing
        } as PromptOnlyEvaluationRequest

        await expect(evaluationService.evaluate(request)).rejects.toThrow()
      })

      it('should throw error for unknown evaluation type', async () => {
        const request = {
          type: 'unknown-type',
          originalPrompt: 'Original prompt',
          evaluationModelKey: 'test-model',
          mode: defaultModeConfig,
        } as any

        await expect(evaluationService.evaluate(request)).rejects.toThrow()
      })
    })
  })

  describe('buildTemplateContext', () => {
    it('should include optimizedPrompt for prompt-only type', async () => {
      const request: PromptOnlyEvaluationRequest = {
        type: 'prompt-only',
        originalPrompt: 'Original prompt',
        optimizedPrompt: 'Optimized prompt',
        evaluationModelKey: 'test-model',
        mode: defaultModeConfig,
      }

      await evaluationService.evaluate(request)

      // Verify template was fetched with correct ID
      expect(mockTemplateManager.getTemplate).toHaveBeenCalledWith(
        'evaluation-basic-system-prompt-only'
      )
    })

    it('should include iterateRequirement for prompt-iterate type', async () => {
      const request: PromptIterateEvaluationRequest = {
        type: 'prompt-iterate',
        originalPrompt: 'Original prompt',
        optimizedPrompt: 'Optimized prompt',
        iterateRequirement: 'Make it more concise',
        evaluationModelKey: 'test-model',
        mode: defaultModeConfig,
      }

      await evaluationService.evaluate(request)

      // Verify template was fetched with correct ID
      expect(mockTemplateManager.getTemplate).toHaveBeenCalledWith(
        'evaluation-basic-system-prompt-iterate'
      )
    })
  })

  describe('getTemplateId', () => {
    it('should generate correct template ID for prompt-only', async () => {
      const request: PromptOnlyEvaluationRequest = {
        type: 'prompt-only',
        originalPrompt: 'Original',
        optimizedPrompt: 'Optimized',
        evaluationModelKey: 'test-model',
        mode: { functionMode: 'pro', subMode: 'variable' },
      }

      await evaluationService.evaluate(request)

      expect(mockTemplateManager.getTemplate).toHaveBeenCalledWith(
        'evaluation-pro-variable-prompt-only'
      )
    })

    it('should generate correct template ID for prompt-iterate', async () => {
      const request: PromptIterateEvaluationRequest = {
        type: 'prompt-iterate',
        originalPrompt: 'Original',
        optimizedPrompt: 'Optimized',
        iterateRequirement: 'Improve clarity',
        evaluationModelKey: 'test-model',
        mode: { functionMode: 'basic', subMode: 'user' },
      }

      await evaluationService.evaluate(request)

      expect(mockTemplateManager.getTemplate).toHaveBeenCalledWith(
        'evaluation-basic-user-prompt-iterate'
      )
    })
  })

  describe('model validation', () => {
    it('should throw EvaluationModelError when model not found', async () => {
      mockModelManager.getModel.mockResolvedValue(null)

      const request: PromptOnlyEvaluationRequest = {
        type: 'prompt-only',
        originalPrompt: 'Original',
        optimizedPrompt: 'Optimized',
        evaluationModelKey: 'non-existent-model',
        mode: defaultModeConfig,
      }

      await expect(evaluationService.evaluate(request)).rejects.toThrow(
        EvaluationModelError
      )
    })
  })

  describe('template validation', () => {
    it('should throw EvaluationTemplateError when template not found', async () => {
      mockTemplateManager.getTemplate.mockResolvedValue(null)

      const request: PromptOnlyEvaluationRequest = {
        type: 'prompt-only',
        originalPrompt: 'Original',
        optimizedPrompt: 'Optimized',
        evaluationModelKey: 'test-model',
        mode: defaultModeConfig,
      }

      await expect(evaluationService.evaluate(request)).rejects.toThrow(
        EvaluationTemplateError
      )
    })
  })

  describe('evaluateStream', () => {
    it('should call callbacks correctly for prompt-only', async () => {
      const onToken = vi.fn()
      const onComplete = vi.fn()
      const onError = vi.fn()

      mockLLMService.sendMessageStream.mockImplementation(
        async (_messages: any, _model: any, handlers: any) => {
          handlers.onToken('{"score":')
          handlers.onToken('{"overall":85,"dimensions":[{"key":"test","label":"Test","score":85}]}}')
          handlers.onComplete()
        }
      )

      const request: PromptOnlyEvaluationRequest = {
        type: 'prompt-only',
        originalPrompt: 'Original',
        optimizedPrompt: 'Optimized',
        evaluationModelKey: 'test-model',
        mode: defaultModeConfig,
      }

      await evaluationService.evaluateStream(request, {
        onToken,
        onComplete,
        onError,
      })

      expect(onToken).toHaveBeenCalled()
      expect(onComplete).toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
    })

    it('should call onError for validation failure in prompt-iterate', async () => {
      const onToken = vi.fn()
      const onComplete = vi.fn()
      const onError = vi.fn()

      const request: PromptIterateEvaluationRequest = {
        type: 'prompt-iterate',
        originalPrompt: 'Original',
        optimizedPrompt: 'Optimized',
        iterateRequirement: '', // Invalid: empty
        evaluationModelKey: 'test-model',
        mode: defaultModeConfig,
      }

      await evaluationService.evaluateStream(request, {
        onToken,
        onComplete,
        onError,
      })

      expect(onError).toHaveBeenCalled()
      expect(onToken).not.toHaveBeenCalled()
      expect(onComplete).not.toHaveBeenCalled()
    })
  })
})
