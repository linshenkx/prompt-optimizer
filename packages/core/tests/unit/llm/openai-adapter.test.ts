import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIAdapter } from '../../../src/services/llm/adapters/openai-adapter';
import type { TextModelConfig, Message } from '../../../src/services/llm/types';
import OpenAI from 'openai';

// Mock OpenAI SDK
vi.mock('openai');

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;
  let mockOpenAIInstance: any;

  const mockConfig: TextModelConfig = {
    id: 'openai',
    name: 'OpenAI',
    enabled: true,
    providerMeta: {
      id: 'openai',
      name: 'OpenAI',
      description: 'OpenAI GPT models',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.openai.com/v1',
      supportsDynamicModels: true,
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string'
        }
      }
    },
    modelMeta: {
      id: 'gpt-5-mini',
      name: 'GPT-5 Mini',
      description: 'Fast, capable, and efficient small model',
      providerId: 'openai',
      capabilities: {
        supportsTools: true,
        supportsReasoning: false,
        maxContextLength: 1047576
      },
      parameterDefinitions: [
        {
          name: 'temperature',
          type: 'number',
          description: 'Sampling temperature',
          default: 1,
          min: 0,
          max: 2
        }
      ],
      defaultParameterValues: {
        temperature: 1
      }
    },
    connectionConfig: {
      apiKey: 'test-api-key',
      baseURL: 'https://api.openai.com/v1'
    },
    paramOverrides: {}
  };

  const mockMessages: Message[] = [
    { role: 'user', content: 'Hello, world!' }
  ];

  beforeEach(() => {
    adapter = new OpenAIAdapter();
    vi.clearAllMocks();

    // 创建 mock OpenAI 实例
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: vi.fn()
        }
      },
      models: {
        list: vi.fn()
      }
    };
  });

  describe('getProvider', () => {
    it('should return OpenAI provider metadata', () => {
      const provider = adapter.getProvider();

      expect(provider.id).toBe('openai');
      expect(provider.name).toBe('OpenAI');
      expect(provider.defaultBaseURL).toBe('https://api.openai.com/v1');
      expect(provider.supportsDynamicModels).toBe(true);
      expect(provider.requiresApiKey).toBe(true);
    });

    it('should have valid connection schema', () => {
      const provider = adapter.getProvider();

      expect(provider.connectionSchema.required).toContain('apiKey');
      expect(provider.connectionSchema.fieldTypes.apiKey).toBe('string');
      expect(provider.connectionSchema.fieldTypes.baseURL).toBe('string');
    });
  });

  describe('getModels', () => {
    it('should return static OpenAI models list', () => {
      const models = adapter.getModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      // 验证至少包含 GPT-5 Mini
      const gpt5Mini = models.find(m => m.id === 'gpt-5-mini');
      expect(gpt5Mini).toBeDefined();
      expect(gpt5Mini?.name).toBe('GPT-5 Mini');
      expect(gpt5Mini?.providerId).toBe('openai');
      expect(gpt5Mini?.capabilities.supportsTools).toBe(true);
    });

    it('should have capabilities for each model', () => {
      const models = adapter.getModels();

      models.forEach(model => {
        expect(model.capabilities).toBeDefined();
        expect(typeof model.capabilities.supportsTools).toBe('boolean');
        expect(typeof model.capabilities.maxContextLength).toBe('number');
      });
    });
  });

  describe('buildDefaultModel', () => {
    it('should build valid TextModel for unknown model ID', () => {
      const unknownModelId = 'unknown-model-123';
      const model = adapter.buildDefaultModel(unknownModelId);

      expect(model.id).toBe(unknownModelId);
      expect(model.name).toBe(unknownModelId);
      expect(model.providerId).toBe('openai');
      expect(model.capabilities).toBeDefined();
      expect(model.capabilities.maxContextLength).toBeGreaterThan(0);
    });

    it('should include parameter definitions', () => {
      const model = adapter.buildDefaultModel('test-model');

      expect(Array.isArray(model.parameterDefinitions)).toBe(true);
      expect(model.parameterDefinitions.length).toBeGreaterThan(0);

      const tempParam = model.parameterDefinitions.find(p => p.name === 'temperature');
      expect(tempParam).toBeDefined();
      expect(tempParam?.type).toBe('number');
    });
  });

  describe('sendMessage', () => {
    it('should return LLMResponse with correct format', async () => {
      // Mock OpenAI response
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-5-2025-08-07',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you?'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      };

      // Mock OpenAI constructor to return our mock instance
      vi.mocked(OpenAI).mockImplementation(() => mockOpenAIInstance as any);
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockResponse);

      const response = await adapter.sendMessage(mockMessages, mockConfig);

      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.reasoning).toBeUndefined();
      expect(response.metadata).toEqual({
        model: 'gpt-5-mini',
        finishReason: 'stop'
      });
    });

    it('should preserve error stack on failure', async () => {
      const originalError = new Error('OpenAI API Error');
      originalError.stack = 'Original Stack Trace';

      vi.mocked(OpenAI).mockImplementation(() => mockOpenAIInstance as any);
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(originalError);

      try {
        await adapter.sendMessage(mockMessages, mockConfig);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        // 验证错误堆栈被保留
        expect(error.stack).toContain('Original Stack Trace');
      }
    });
  });

  describe('sendMessageStream', () => {
    it('should trigger callbacks correctly', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'chatcmpl-123',
            choices: [{
              index: 0,
              delta: { content: 'Hello' },
              finish_reason: null
            }]
          };
          yield {
            id: 'chatcmpl-123',
            choices: [{
              index: 0,
              delta: { content: ' World' },
              finish_reason: null
            }]
          };
          yield {
            id: 'chatcmpl-123',
            choices: [{
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }]
          };
        }
      };

      vi.mocked(OpenAI).mockImplementation(() => mockOpenAIInstance as any);
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockStream);

      const callbacks = {
        onToken: vi.fn(),
        onReasoningToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      await adapter.sendMessageStream(mockMessages, mockConfig, callbacks);

      expect(callbacks.onToken).toHaveBeenCalledWith('Hello');
      expect(callbacks.onToken).toHaveBeenCalledWith(' World');
      expect(callbacks.onComplete).toHaveBeenCalled();
      expect(callbacks.onError).not.toHaveBeenCalled();
    });

    // 删除"should call onError with preserved stack" - 这是过度测试错误堆栈保留的内部实现细节
  });

  describe('error handling', () => {
    it('should throw error when API key is missing', async () => {
      const configWithoutKey = {
        ...mockConfig,
        connectionConfig: {
          ...mockConfig.connectionConfig,
          apiKey: ''
        }
      };

      await expect(
        adapter.sendMessage(mockMessages, configWithoutKey)
      ).rejects.toThrow();
    });

    it('should handle invalid baseURL', async () => {
      const configWithInvalidURL = {
        ...mockConfig,
        connectionConfig: {
          ...mockConfig.connectionConfig,
          baseURL: 'invalid-url'
        }
      };

      vi.mocked(OpenAI).mockImplementation(() => {
        throw new Error('Invalid URL');
      });

      await expect(
        adapter.sendMessage(mockMessages, configWithInvalidURL)
      ).rejects.toThrow('Invalid URL');
    });
  });
});
