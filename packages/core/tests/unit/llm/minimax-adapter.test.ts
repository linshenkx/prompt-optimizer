import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MinimaxAdapter } from '../../../src/services/llm/adapters/minimax-adapter';
import type { TextModelConfig, Message } from '../../../src/services/llm/types';

let mockOpenAIInstance: any;
let mockOpenAIConfig: any;

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      constructor(config: any) {
        mockOpenAIConfig = config;
        return mockOpenAIInstance;
      }
    }
  };
});

describe('MinimaxAdapter', () => {
  let adapter: MinimaxAdapter;

  const mockConfig: TextModelConfig = {
    id: 'minimax',
    name: 'MiniMax',
    enabled: true,
    providerMeta: {
      id: 'minimax',
      name: 'MiniMax',
      description: 'MiniMax AI models via OpenAI-compatible API',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.minimax.io/v1',
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
      id: 'MiniMax-M2.7',
      name: 'MiniMax M2.7',
      description: 'Latest flagship model with enhanced reasoning and coding',
      providerId: 'minimax',
      capabilities: {
        supportsTools: true,
        supportsReasoning: false,
        maxContextLength: 1000000
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
      apiKey: 'test-minimax-key',
      baseURL: 'https://api.minimax.io/v1'
    },
    paramOverrides: {}
  };

  const mockMessages: Message[] = [
    { role: 'user', content: 'Hello, world!' }
  ];

  beforeEach(() => {
    adapter = new MinimaxAdapter();
    mockOpenAIConfig = undefined;
    vi.clearAllMocks();

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
    it('should return MiniMax provider metadata', () => {
      const provider = adapter.getProvider();

      expect(provider.id).toBe('minimax');
      expect(provider.name).toBe('MiniMax');
      expect(provider.defaultBaseURL).toBe('https://api.minimax.io/v1');
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
    it('should return static MiniMax models list', () => {
      const models = adapter.getModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      const m27 = models.find(m => m.id === 'MiniMax-M2.7');
      expect(m27).toBeDefined();
      expect(m27?.name).toBe('MiniMax M2.7');
      expect(m27?.providerId).toBe('minimax');
      expect(m27?.capabilities.supportsTools).toBe(true);
    });

    it('should include all expected models', () => {
      const models = adapter.getModels();
      const modelIds = models.map(m => m.id);

      expect(modelIds).toContain('MiniMax-M2.7');
      expect(modelIds).toContain('MiniMax-M2.7-highspeed');
      expect(modelIds).toContain('MiniMax-M2.5');
      expect(modelIds).toContain('MiniMax-M2.5-highspeed');
      expect(models.length).toBe(4);
    });

    it('should have M2.7 as the first model', () => {
      const models = adapter.getModels();

      expect(models[0].id).toBe('MiniMax-M2.7');
      expect(models[1].id).toBe('MiniMax-M2.7-highspeed');
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
      const model = adapter.buildDefaultModel('unknown-minimax-model');

      expect(model.id).toBe('unknown-minimax-model');
      expect(model.name).toBe('unknown-minimax-model');
      expect(model.providerId).toBe('minimax');
      expect(model.capabilities).toBeDefined();
    });
  });

  describe('sendMessage', () => {
    it('should return LLMResponse with correct format', async () => {
      const mockResponse = {
        id: 'chatcmpl-minimax-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'MiniMax-M2.7',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello from MiniMax!'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockResponse);

      const response = await adapter.sendMessage(mockMessages, mockConfig);

      expect(response.content).toBe('Hello from MiniMax!');
      expect(response.metadata).toEqual({
        model: 'MiniMax-M2.7',
        finishReason: 'stop'
      });
    });
  });

  describe('sendMessageStream', () => {
    it('should trigger callbacks correctly', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'chatcmpl-minimax-123',
            choices: [{
              index: 0,
              delta: { content: 'Hello' },
              finish_reason: null
            }]
          };
          yield {
            id: 'chatcmpl-minimax-123',
            choices: [{
              index: 0,
              delta: { content: ' MiniMax' },
              finish_reason: null
            }]
          };
          yield {
            id: 'chatcmpl-minimax-123',
            choices: [{
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }]
          };
        }
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockStream);

      const callbacks = {
        onToken: vi.fn(),
        onReasoningToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      await adapter.sendMessageStream(mockMessages, mockConfig, callbacks);

      expect(callbacks.onToken).toHaveBeenCalledWith('Hello');
      expect(callbacks.onToken).toHaveBeenCalledWith(' MiniMax');
      expect(callbacks.onComplete).toHaveBeenCalled();
      expect(callbacks.onError).not.toHaveBeenCalled();
    });
  });
});
