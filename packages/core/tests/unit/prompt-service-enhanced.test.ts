import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PromptService } from '../../src/services/prompt/service'
import type { OptimizationRequest } from '../../src/services/prompt/types'

describe('PromptService Enhanced Features', () => {
  let promptService: PromptService
  let mockModelManager: any
  let mockLLMService: any
  let mockTemplateManager: any
  let mockHistoryManager: any

  beforeEach(() => {
    // Setup mocks
    mockModelManager = {
      getModel: vi.fn().mockResolvedValue({ id: 'test-model' })
    }
    
    mockLLMService = {
      sendMessage: vi.fn().mockResolvedValue('optimized result'),
      sendMessageStream: vi.fn()
    }
    
    mockTemplateManager = {
      getTemplate: vi.fn().mockImplementation((id: string) => {
        // Return null for non-existent templates
        if (id === 'non-existent-template') {
          return null
        }
        // Return valid template for existing IDs
        return {
          id: id,
          content: 'test template content {{originalPrompt}}',
          metadata: { optimizationMode: 'system' }
        }
      }),
      listTemplatesByType: vi.fn().mockReturnValue([
        {
          id: 'user-prompt-optimize',
          content: 'user prompt template {{originalPrompt}}',
          metadata: { templateType: 'optimize', version: '1.0', lastModified: Date.now(), language: 'zh' }
        }
      ])
    }
    
    mockHistoryManager = {
      addRecord: vi.fn().mockResolvedValue(undefined)
    }

    promptService = new PromptService(
      mockModelManager,
      mockLLMService,
      mockTemplateManager,
      mockHistoryManager
    )
  })

  describe('optimizePrompt', () => {
    it('should optimize system prompt successfully', async () => {
      const request: OptimizationRequest = {
        optimizationMode: 'system' as const,
        targetPrompt: 'test system prompt',
        modelKey: 'test-model',
        templateId: 'test-template'
      }

      const result = await promptService.optimizePrompt(request)

      expect(result).toBe('optimized result')
      expect(mockLLMService.sendMessage).toHaveBeenCalled()
      // 注意：历史记录保存由UI层处理，Service层不保存历史记录
    })

    it('should optimize user prompt successfully', async () => {
      const request: OptimizationRequest = {
        optimizationMode: 'user' as const,
        targetPrompt: 'test user prompt',
        modelKey: 'test-model',
        templateId: 'test-template'
      }

      const result = await promptService.optimizePrompt(request)

      expect(result).toBe('optimized result')
      expect(mockLLMService.sendMessage).toHaveBeenCalled()
    })

    it('should optimize user prompt without context successfully', async () => {
      const request: OptimizationRequest = {
        optimizationMode: 'user' as const,
        targetPrompt: 'test user prompt',
        modelKey: 'test-model'
      }

      const result = await promptService.optimizePrompt(request)

      expect(result).toBe('optimized result')
      expect(mockLLMService.sendMessage).toHaveBeenCalled()
    })

    it('should throw error for empty target prompt', async () => {
      const request: OptimizationRequest = {
        optimizationMode: 'system' as const,
        targetPrompt: '',
        modelKey: 'test-model'
      }

      await expect(promptService.optimizePrompt(request))
        .rejects.toThrow('Target prompt is required')
    })

    it('should throw error for empty model key', async () => {
      const request: OptimizationRequest = {
        optimizationMode: 'system' as const,
        targetPrompt: 'test prompt',
        modelKey: ''
      }

      await expect(promptService.optimizePrompt(request))
        .rejects.toThrow('Model key is required')
    })
  })

  describe('testPrompt', () => {
    it('should test prompts with proper context', async () => {
      const result = await promptService.testPrompt(
        'system prompt',
        'user prompt',
        'test-model'
      )

      expect(result).toBe('optimized result')
      expect(mockLLMService.sendMessage).toHaveBeenCalledWith(
        [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'user prompt' }
        ],
        'test-model'
      )
    })

    it('should test user prompt without system prompt', async () => {
      const result = await promptService.testPrompt(
        '',
        'user prompt only',
        'test-model'
      )

      expect(result).toBe('optimized result')
      expect(mockLLMService.sendMessage).toHaveBeenCalledWith(
        [
          { role: 'user', content: 'user prompt only' }
        ],
        'test-model'
      )
    })

    it('should throw error for empty user prompt', async () => {
      await expect(promptService.testPrompt(
        'system prompt',
        '',
        'test-model'
      )).rejects.toThrow('User prompt is required')
    })

    it('should throw error for empty model key', async () => {
      await expect(promptService.testPrompt(
        'system prompt',
        'user prompt',
        ''
      )).rejects.toThrow('Model key is required')
    })
  })

  describe('optimizePromptStream', () => {
    it('should handle streaming optimization', async () => {
      const request: OptimizationRequest = {
        optimizationMode: 'system' as const,
        targetPrompt: 'test prompt',
        modelKey: 'test-model'
      }

      const callbacks = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      }

      // Mock streaming behavior
      mockLLMService.sendMessageStream.mockImplementation(async (messages, modelKey, streamCallbacks) => {
        streamCallbacks.onToken('test')
        streamCallbacks.onToken(' result')
        // 模拟结构化响应
        const mockResponse = {
          content: 'test result',
          reasoning: 'some reasoning'
        }
        await streamCallbacks.onComplete(mockResponse)
      })

      await promptService.optimizePromptStream(request, callbacks)

      expect(callbacks.onToken).toHaveBeenCalledWith('test')
      expect(callbacks.onToken).toHaveBeenCalledWith(' result')
      expect(callbacks.onComplete).toHaveBeenCalled()
      // 注意：历史记录保存由UI层处理，Service层不保存历史记录
    })

    it('should handle missing model key', async () => {
      const callbacks = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      }

      const request: OptimizationRequest = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Test prompt',
        templateId: 'general-optimize',
        modelKey: '' // Empty model key
      }

      await expect(
        promptService.optimizePromptStream(request, callbacks)
      ).rejects.toThrow('Model key is required')
    })

    it('should handle undefined model key', async () => {
      const callbacks = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      }

      const request: OptimizationRequest = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Test prompt',
        templateId: 'general-optimize',
        modelKey: undefined as any // Undefined model key
      }

      await expect(
        promptService.optimizePromptStream(request, callbacks)
      ).rejects.toThrow('Model key is required')
    })

    it('should handle missing template gracefully', async () => {
      const callbacks = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      }

      const request: OptimizationRequest = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Test prompt',
        templateId: 'non-existent-template',
        modelKey: 'test-model'
      }

      await expect(
        promptService.optimizePromptStream(request, callbacks)
      ).rejects.toThrow('Template not found or invalid')
    })
  })

  describe('testPromptStream', () => {
    it('should handle streaming context testing', async () => {
      const callbacks = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      }

      mockLLMService.sendMessageStream.mockImplementation(async (messages, modelKey, streamCallbacks) => {
        streamCallbacks.onToken('test')
        streamCallbacks.onToken(' response')
        await streamCallbacks.onComplete()
      })

      await promptService.testPromptStream(
        'system prompt',
        'user prompt',
        'test-model',
        callbacks
      )

      expect(mockLLMService.sendMessageStream).toHaveBeenCalledWith(
        [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'user prompt' }
        ],
        'test-model',
        callbacks
      )
    })
  })

  describe('iteratePrompt', () => {
    it('should throw error when template is simple string format', async () => {
      // Mock template manager to return a simple template
      mockTemplateManager.getTemplate.mockResolvedValue({
        id: 'simple-iterate-template',
        name: 'Simple Iterate',
        content: 'This is a simple string template',
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'iterate'
        }
      })

      await expect(
        promptService.iteratePrompt(
          'original prompt',
          'last optimized prompt',
          'iterate input',
          'test-model'
        )
      ).rejects.toThrow('Iteration requires advanced template (message array format)')
    })

    it('should work with message array template', async () => {
      // Mock template manager to return an advanced template
      mockTemplateManager.getTemplate.mockResolvedValue({
        id: 'advanced-iterate-template',
        name: 'Advanced Iterate',
        content: [
          {
            role: 'system',
            content: 'You are a prompt optimizer'
          },
          {
            role: 'user',
            content: 'Optimize: {{lastOptimizedPrompt}}\nRequirement: {{iterateInput}}'
          }
        ],
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'iterate'
        }
      })

      mockLLMService.sendMessage.mockResolvedValue('iterated result')

      const result = await promptService.iteratePrompt(
        '',  // originalPrompt can be empty
        'last optimized prompt',
        'iterate input',
        'test-model'
      )

      expect(result).toBe('iterated result')
      expect(mockLLMService.sendMessage).toHaveBeenCalled()
    })
  })

  describe('iteratePromptStream', () => {
    it('should throw error when template is simple string format', async () => {
      // Mock template manager to return a simple template
      mockTemplateManager.getTemplate.mockResolvedValue({
        id: 'simple-iterate-template',
        name: 'Simple Iterate',
        content: 'This is a simple string template',
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'iterate'
        }
      })

      const callbacks = {
        onContent: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      }

      await expect(
        promptService.iteratePromptStream(
          'original prompt',
          'last optimized prompt',
          'iterate input',
          'test-model',
          callbacks
        )
      ).rejects.toThrow('Iteration requires advanced template (message array format)')
    })
  })
})
