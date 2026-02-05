import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnthropicAdapter } from '../../../src/services/llm/adapters/anthropic-adapter';
import type { TextModelConfig, Message, StreamHandlers } from '../../../src/services/llm/types';
import Anthropic from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn();
  MockAnthropic.prototype.messages = {
    create: vi.fn(),
    stream: vi.fn()
  };
  return { default: MockAnthropic };
});

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;

  const mockConfig: TextModelConfig = {
    id: 'anthropic',
    name: 'Anthropic',
    enabled: true,
    providerMeta: {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Anthropic Claude models',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.anthropic.com',
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
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      description: 'Most intelligent Claude model',
      providerId: 'anthropic',
      capabilities: {
        supportsTools: true,
        supportsReasoning: false,
        maxContextLength: 200000
      },
      parameterDefinitions: [],
      defaultParameterValues: {}
    },
    connectionConfig: {
      apiKey: 'test-api-key',
      baseURL: 'https://api.anthropic.com'
    },
    paramOverrides: {}
  };

  const mockMessages: Message[] = [
    { role: 'user', content: 'Hello, Claude!' }
  ];

  beforeEach(() => {
    adapter = new AnthropicAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getProvider', () => {
    it('should return Anthropic provider metadata', () => {
      const provider = adapter.getProvider();

      expect(provider.id).toBe('anthropic');
      expect(provider.name).toBe('Anthropic');
      expect(provider.defaultBaseURL).toBe('https://api.anthropic.com');
      expect(provider.supportsDynamicModels).toBe(true);
      expect(provider.requiresApiKey).toBe(true);
    });
  });

  describe('getModels', () => {
    it('should return static Claude models list', () => {
      const models = adapter.getModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      // 更新为新的 Claude 4.0 模型
      const claude4 = models.find(m => m.id.includes('claude-'));
      expect(claude4).toBeDefined();
      expect(claude4?.providerId).toBe('anthropic');
    });
  });

  describe('buildDefaultModel', () => {
    it('should build valid TextModel for unknown model ID', () => {
      const model = adapter.buildDefaultModel('unknown-claude-model');

      expect(model.id).toBe('unknown-claude-model');
      expect(model.providerId).toBe('anthropic');
      expect(model.capabilities).toBeDefined();
    });
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
  });

  describe('sendMessage', () => {
    it('should return response content from Anthropic API', async () => {
      const anthropicResponse = {
        content: [
          { type: 'text', text: 'Hello from Claude.' }
        ],
        model: 'claude-sonnet-4-5',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 12,
          output_tokens: 50
        }
      };

      // Mock Anthropic SDK's messages.create method
      const mockCreate = vi.fn().mockResolvedValue(anthropicResponse);
      (Anthropic as any).prototype.messages = {
        create: mockCreate,
        stream: vi.fn()
      };

      const response = await adapter.sendMessage(mockMessages, mockConfig);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(response.content).toBe('Hello from Claude.');
      expect(response.metadata).toEqual({
        model: 'claude-sonnet-4-5',
        finishReason: 'end_turn',
        tokens: 62
      });
    });

    it('should throw descriptive error when HTTP request fails', async () => {
      const error = new Error('Unauthorized');
      (error as any).status = 401;

      // Mock Anthropic SDK to throw an error
      const mockCreate = vi.fn().mockRejectedValue(error);
      (Anthropic as any).prototype.messages = {
        create: mockCreate,
        stream: vi.fn()
      };

      await expect(adapter.sendMessage(mockMessages, mockConfig)).rejects.toThrow(
        /Anthropic API error \(401\)/
      );
    });
  });

  describe('sendMessageStream', () => {
    it('should simulate streaming by splitting response content', async () => {
      const finalMessage = {
        content: [
          { type: 'text', text: 'Hello world. This is Claude.' }
        ],
        model: 'claude-sonnet-4-5',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 20
        }
      };

      // Mock Anthropic SDK's stream
      const mockStream = {
        on: vi.fn((event: string, callback: any) => {
          if (event === 'text') {
            // Simulate streaming text content in chunks
            setTimeout(() => callback('Hello world. '), 10);
            setTimeout(() => callback('This is Claude.'), 20);
          } else if (event === 'message') {
            // Emit final message event
            setTimeout(() => callback(finalMessage), 30);
          }
          return mockStream;
        }),
        finalMessage: vi.fn().mockResolvedValue(finalMessage)
      };

      const mockStreamFn = vi.fn().mockResolvedValue(mockStream);
      (Anthropic as any).prototype.messages = {
        create: vi.fn(),
        stream: mockStreamFn
      };

      const callbacks: StreamHandlers = {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      await adapter.sendMessageStream(mockMessages, mockConfig, callbacks);

      // Wait a bit for async callbacks to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockStreamFn).toHaveBeenCalledTimes(1);
      expect(callbacks.onToken).toHaveBeenCalled();
      expect(callbacks.onComplete).toHaveBeenCalledWith({
        content: 'Hello world. This is Claude.',
        reasoning: undefined,
        metadata: {
          model: 'claude-sonnet-4-5',
          finishReason: 'end_turn',
          tokens: 30
        }
      });
      expect(callbacks.onError).not.toHaveBeenCalled();
    });
  });
});
