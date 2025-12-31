import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelScopeAdapter } from '../../../src/services/llm/adapters/modelscope-adapter';
import type { TextModelConfig, Message } from '../../../src/services/llm/types';

// 创建 mock OpenAI 实例
let mockOpenAIInstance: any;

// Mock OpenAI SDK - 使用工厂函数返回一个类
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      constructor() {
        return mockOpenAIInstance;
      }
    }
  };
});

describe('ModelScopeAdapter', () => {
  let adapter: ModelScopeAdapter;
  let mockConfig: TextModelConfig;

  const mockMessages: Message[] = [
    { role: 'user', content: 'Hello, world!' }
  ];

  beforeEach(() => {
    adapter = new ModelScopeAdapter();

    // 动态获取第一个可用模型来构建 mockConfig
    const firstModel = adapter.getModels()[0];
    const provider = adapter.getProvider();

    mockConfig = {
      id: provider.id,
      name: provider.name,
      enabled: true,
      providerMeta: {
        id: provider.id,
        name: provider.name,
        description: provider.description,
        requiresApiKey: provider.requiresApiKey,
        defaultBaseURL: provider.defaultBaseURL,
        supportsDynamicModels: provider.supportsDynamicModels,
        connectionSchema: provider.connectionSchema
      },
      modelMeta: firstModel,
      connectionConfig: {
        apiKey: 'test-api-key',
        baseURL: provider.defaultBaseURL
      },
      paramOverrides: {}
    };

    vi.clearAllMocks();

    // 在每个测试前重新创建 mock OpenAI 实例
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
    it('should return ModelScope provider metadata', () => {
      const provider = adapter.getProvider();

      expect(provider.id).toBe('modelscope');
      expect(provider.name).toBe('ModelScope');
      expect(provider.defaultBaseURL).toBe('https://api-inference.modelscope.cn/v1');
      expect(provider.requiresApiKey).toBe(true);
      expect(provider.supportsDynamicModels).toBe(true);
    });

    it('should have correct connection schema', () => {
      const provider = adapter.getProvider();

      expect(provider.connectionSchema.required).toEqual(['apiKey']);
      expect(provider.connectionSchema.optional).toEqual(['baseURL']);
    });
  });

  describe('getModels', () => {
    it('should return static models list', () => {
      const models = adapter.getModels();

      expect(models.length).toBeGreaterThan(0);
      expect(models[0].id).toBeDefined();
      expect(models[0].name).toBeDefined();
      expect(models[0].providerId).toBe('modelscope');
    });

    it('should have correct model capabilities', () => {
      const models = adapter.getModels();
      const model = models[0];

      expect(model.capabilities.supportsTools).toBe(false);
      expect(model.capabilities.supportsReasoning).toBe(false);
      expect(model.capabilities.maxContextLength).toBe(131072);
    });
  });

  describe('sendMessage', () => {
    it('should call OpenAI SDK with correct parameters', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?'
            }
          }
        ],
        model: mockConfig.modelMeta.id,
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockResponse);

      const response = await adapter.sendMessage(mockMessages, mockConfig);

      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: mockConfig.modelMeta.id,
          messages: mockMessages
        })
      );

      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.metadata.model).toBe(mockConfig.modelMeta.id);
    });

    it('should throw error when API key is missing', async () => {
      const invalidConfig = {
        ...mockConfig,
        connectionConfig: {}
      };

      mockOpenAIInstance.chat.completions.create.mockRejectedValue(
        new Error('Cannot read properties of undefined')
      );

      await expect(
        adapter.sendMessage(mockMessages, invalidConfig)
      ).rejects.toThrow();
    });
  });

  describe('sendMessageStream', () => {
    it('should trigger callbacks correctly', async () => {
      const mockStream = (async function* () {
        yield {
          choices: [
            {
              delta: { role: 'assistant', content: 'Hello' }
            }
          ]
        };
        yield {
          choices: [
            {
              delta: { content: ' World' }
            }
          ]
        };
      })();

      mockOpenAIInstance.chat.completions.create.mockReturnValue(mockStream);

      let tokens: string[] = [];
      let completeCalled = false;

      await adapter.sendMessageStream(mockMessages, mockConfig, {
        onToken: (token) => {
          tokens.push(token);
        },
        onComplete: () => {
          completeCalled = true;
        },
        onError: (error) => {
          throw error;
        }
      });

      expect(tokens).toEqual(['Hello', ' World']);
      expect(completeCalled).toBe(true);
    });
  });
});
