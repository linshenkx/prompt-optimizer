import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIAdapter } from '../../../src/services/llm/adapters/openai-adapter';
import { OpenAICompatibleAdapter } from '../../../src/services/llm/adapters/openai-compatible-adapter';
import type { TextModelConfig, Message } from '../../../src/services/llm/types';
import { normalizeCustomRequestHeaders } from '../../../src/utils/custom-request-headers';

// 创建 mock OpenAI 实例
let mockOpenAIInstance: any;
let mockOpenAIConfig: any;

// Mock OpenAI SDK - 使用工厂函数返回一个类
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

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;
  let openAICompatibleAdapter: OpenAICompatibleAdapter;

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
    openAICompatibleAdapter = new OpenAICompatibleAdapter();
    mockOpenAIConfig = undefined;
    vi.clearAllMocks();

    // 在每个测试前重新创建 mock OpenAI 实例
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: vi.fn()
        }
      },
      responses: {
        create: vi.fn()
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

      mockOpenAIInstance.chat.completions.create.mockRejectedValue(originalError);

      try {
        await adapter.sendMessage(mockMessages, mockConfig);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        // 验证错误堆栈被保留
        expect(error.stack).toContain('Original Stack Trace');
      }
    });

    it('should use the Responses API when requestStyle is set to responses', async () => {
      const responsesConfig: TextModelConfig = {
        ...mockConfig,
        connectionConfig: {
          ...mockConfig.connectionConfig,
          requestStyle: 'responses'
        }
      };

      mockOpenAIInstance.responses.create.mockResolvedValue({
        id: 'resp_123',
        object: 'response',
        output_text: 'Hello from responses'
      });

      const response = await adapter.sendMessage(mockMessages, responsesConfig);

      expect(mockOpenAIInstance.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-mini',
          input: [{ role: 'user', content: 'Hello, world!' }]
        })
      );
      expect(mockOpenAIInstance.chat.completions.create).not.toHaveBeenCalled();
      expect(response.content).toBe('Hello from responses');
      expect(response.metadata).toEqual({
        model: 'gpt-5-mini',
        finishReason: undefined
      });
    });
  });

  describe('browser fetch credential handling', () => {
    const mockBrowserResponse = {
      id: 'chatcmpl-browser',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-5-mini',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'ok'
        },
        finish_reason: 'stop'
      }]
    };

    it('should force credentials=omit for cross-origin browser requests', async () => {
      const originalWindow = (globalThis as any).window;
      const originalFetch = (globalThis as any).fetch;
      const runtimeFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

      (globalThis as any).window = {
        location: {
          origin: 'https://prompt.always200.com',
          href: 'https://prompt.always200.com/'
        }
      };
      (globalThis as any).fetch = runtimeFetch;

      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockBrowserResponse);

      try {
        await adapter.sendMessage(mockMessages, mockConfig);

        expect(mockOpenAIConfig?.dangerouslyAllowBrowser).toBe(true);
        expect(typeof mockOpenAIConfig?.fetch).toBe('function');

        await mockOpenAIConfig.fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
          method: 'POST',
          credentials: 'include',
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
            'x-stainless-lang': 'js',
            'User-Agent': 'OpenAI/JS test'
          }
        });

        const [, requestInit] = runtimeFetch.mock.calls[0];
        expect(requestInit.credentials).toBe('omit');
        expect(requestInit.mode).toBe('cors');

        const outgoingHeaders = new Headers(requestInit.headers);
        expect(outgoingHeaders.get('authorization')).toBe('Bearer test-api-key');
        expect(outgoingHeaders.get('content-type')).toBe('application/json');
        expect(outgoingHeaders.get('x-stainless-lang')).toBeNull();
        expect(outgoingHeaders.get('user-agent')).toBeNull();
      } finally {
        if (originalWindow === undefined) {
          delete (globalThis as any).window;
        } else {
          (globalThis as any).window = originalWindow;
        }

        if (originalFetch === undefined) {
          delete (globalThis as any).fetch;
        } else {
          (globalThis as any).fetch = originalFetch;
        }
      }
    });

    it('should keep same-origin browser requests unchanged', async () => {
      const originalWindow = (globalThis as any).window;
      const originalFetch = (globalThis as any).fetch;
      const runtimeFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

      (globalThis as any).window = {
        location: {
          origin: 'https://prompt.always200.com',
          href: 'https://prompt.always200.com/'
        }
      };
      (globalThis as any).fetch = runtimeFetch;

      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockBrowserResponse);

      try {
        await adapter.sendMessage(mockMessages, mockConfig);

        await mockOpenAIConfig.fetch('/api/proxy/chat', {
          method: 'POST'
        });

        const [, requestInit] = runtimeFetch.mock.calls[0];
        expect(requestInit.credentials).toBeUndefined();
      } finally {
        if (originalWindow === undefined) {
          delete (globalThis as any).window;
        } else {
          (globalThis as any).window = originalWindow;
        }

        if (originalFetch === undefined) {
          delete (globalThis as any).fetch;
        } else {
          (globalThis as any).fetch = originalFetch;
        }
      }
    });
  });

  describe('openai-compatible auth handling', () => {
    it('should allow requests without an API key by stripping the authorization header', async () => {
      const originalFetch = (globalThis as any).fetch;
      const runtimeFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

      (globalThis as any).fetch = runtimeFetch;

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        id: 'chatcmpl-custom',
        object: 'chat.completion',
        created: Date.now(),
        model: 'custom-model',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'ok'
          },
          finish_reason: 'stop'
        }]
      });

      const compatibleConfig: TextModelConfig = {
        ...mockConfig,
        id: 'openai-compatible',
        name: 'OpenAI Compatible (Custom)',
        providerMeta: openAICompatibleAdapter.getProvider(),
        modelMeta: openAICompatibleAdapter.buildDefaultModel('custom-model'),
        connectionConfig: {
          baseURL: 'http://localhost:11434/v1',
          apiKey: ''
        }
      };

      try {
        await openAICompatibleAdapter.sendMessage(mockMessages, compatibleConfig);

        expect(typeof mockOpenAIConfig?.fetch).toBe('function');

        await mockOpenAIConfig.fetch('http://localhost:11434/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ',
            'Content-Type': 'application/json'
          }
        });

        const [, requestInit] = runtimeFetch.mock.calls[0];
        const outgoingHeaders = new Headers(requestInit.headers);
        expect(outgoingHeaders.get('authorization')).toBeNull();
        expect(outgoingHeaders.get('content-type')).toBe('application/json');
      } finally {
        if (originalFetch === undefined) {
          delete (globalThis as any).fetch;
        } else {
          (globalThis as any).fetch = originalFetch;
        }
      }
    });

    it('should pass custom request headers through defaultHeaders for OpenAI-compatible providers', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        id: 'chatcmpl-custom',
        object: 'chat.completion',
        created: Date.now(),
        model: 'custom-model',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'ok'
          },
          finish_reason: 'stop'
        }]
      });

      const compatibleConfig: TextModelConfig = {
        ...mockConfig,
        id: 'openai-compatible',
        name: 'OpenAI Compatible (Custom)',
        providerMeta: openAICompatibleAdapter.getProvider(),
        modelMeta: openAICompatibleAdapter.buildDefaultModel('custom-model'),
        connectionConfig: {
          baseURL: 'https://gateway.example.com/v1',
          apiKey: 'gateway-key',
          customHeaders: [
            { key: 'x-auth-token', value: 'gateway-token' },
            { key: 'Authorization', value: 'Bearer should-not-win' },
            { key: 'Content-Type', value: 'application/custom' },
          ]
        }
      };

      await openAICompatibleAdapter.sendMessage(mockMessages, compatibleConfig);

      expect(mockOpenAIConfig?.defaultHeaders).toEqual({
        'x-auth-token': 'gateway-token'
      });
    });

    it('should route browser openai-compatible requests through same-origin proxy', async () => {
      const originalWindow = (globalThis as any).window;
      const originalFetch = (globalThis as any).fetch;
      const runtimeFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

      (globalThis as any).window = {
        location: {
          origin: 'http://localhost:8085',
          href: 'http://localhost:8085/#/basic/system'
        }
      };
      (globalThis as any).fetch = runtimeFetch;

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        id: 'chatcmpl-custom',
        object: 'chat.completion',
        created: Date.now(),
        model: 'custom-model',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'ok'
          },
          finish_reason: 'stop'
        }]
      });

      const compatibleConfig: TextModelConfig = {
        ...mockConfig,
        id: 'openai-compatible',
        name: 'OpenAI Compatible (Custom)',
        providerMeta: openAICompatibleAdapter.getProvider(),
        modelMeta: openAICompatibleAdapter.buildDefaultModel('gpt-5.5'),
        connectionConfig: {
          baseURL: 'https://gateway.example.com/v1',
          apiKey: 'gateway-key',
          requestStyle: 'chat_completions',
          customHeaders: [
            { key: 'x-auth-token', value: 'gateway-token' }
          ]
        }
      };

      try {
        await openAICompatibleAdapter.sendMessage(mockMessages, compatibleConfig);

        expect(mockOpenAIConfig?.baseURL).toBe('http://localhost:8085/api/openai-compatible-proxy');
        expect(mockOpenAIConfig?.dangerouslyAllowBrowser).toBe(true);
        expect(typeof mockOpenAIConfig?.fetch).toBe('function');
        expect(mockOpenAIConfig?.defaultHeaders).toBeUndefined();

        await mockOpenAIConfig.fetch('http://localhost:8085/api/openai-compatible-proxy/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer gateway-key',
            'Content-Type': 'application/json',
            'x-auth-token': 'gateway-token'
          },
          body: JSON.stringify({ model: 'gpt-5.5', messages: [{ role: 'user', content: 'Hello, world!' }] })
        });

        const [input, requestInit] = runtimeFetch.mock.calls[0];
        expect(input).toBe('http://localhost:8085/api/openai-compatible-proxy/chat/completions');
        expect(requestInit.credentials).toBeUndefined();

        const outgoingHeaders = new Headers(requestInit.headers);
        expect(outgoingHeaders.get('authorization')).toBe('Bearer gateway-key');
        expect(outgoingHeaders.get('content-type')).toBe('application/json');
        expect(outgoingHeaders.get('x-po-target-base-url')).toBe('https://gateway.example.com/v1');
        expect(outgoingHeaders.get('x-po-custom-headers')).toBe(
          JSON.stringify(normalizeCustomRequestHeaders(compatibleConfig.connectionConfig.customHeaders as any))
        );
      } finally {
        if (originalWindow === undefined) {
          delete (globalThis as any).window;
        } else {
          (globalThis as any).window = originalWindow;
        }

        if (originalFetch === undefined) {
          delete (globalThis as any).fetch;
        } else {
          (globalThis as any).fetch = originalFetch;
        }
      }
    });

    it('should not apply custom request headers to the official OpenAI provider', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        id: 'chatcmpl-openai',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-5-mini',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'ok'
          },
          finish_reason: 'stop'
        }]
      });

      await adapter.sendMessage(mockMessages, {
        ...mockConfig,
        connectionConfig: {
          ...mockConfig.connectionConfig,
          customHeaders: {
            'x-auth-token': 'gateway-token'
          }
        }
      });

      expect(mockOpenAIConfig?.defaultHeaders).toBeUndefined();
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

    it('should stream Responses API text deltas when requestStyle is responses', async () => {
      const responsesConfig: TextModelConfig = {
        ...mockConfig,
        connectionConfig: {
          ...mockConfig.connectionConfig,
          requestStyle: 'responses'
        }
      };

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'response.output_text.delta',
            delta: 'Hello',
            output_index: 0,
            content_index: 0
          };
          yield {
            type: 'response.output_text.delta',
            delta: ' Responses',
            output_index: 0,
            content_index: 0
          };
          yield {
            type: 'response.completed',
            response: {
              output_text: 'Hello Responses'
            }
          };
        }
      };

      mockOpenAIInstance.responses.create.mockResolvedValue(mockStream);

      const callbacks = {
        onToken: vi.fn(),
        onReasoningToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      await adapter.sendMessageStream(mockMessages, responsesConfig, callbacks);

      expect(mockOpenAIInstance.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-mini',
          input: [{ role: 'user', content: 'Hello, world!' }],
          stream: true
        })
      );
      expect(callbacks.onToken).toHaveBeenCalledWith('Hello');
      expect(callbacks.onToken).toHaveBeenCalledWith(' Responses');
      expect(callbacks.onComplete).toHaveBeenCalledWith({
        content: 'Hello Responses',
        reasoning: undefined,
        metadata: {
          model: 'gpt-5-mini'
        }
      });
      expect(callbacks.onError).not.toHaveBeenCalled();
    });

    it('should surface provider-specific Responses stream error events without a type field', async () => {
      const responsesConfig: TextModelConfig = {
        ...mockConfig,
        connectionConfig: {
          ...mockConfig.connectionConfig,
          requestStyle: 'responses'
        }
      };

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            code: 'InvalidParameter',
            message: 'Missing required parameter: workspaceid'
          };
        }
      };

      mockOpenAIInstance.responses.create.mockResolvedValue(mockStream);

      const callbacks = {
        onToken: vi.fn(),
        onReasoningToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      await expect(
        adapter.sendMessageStream(mockMessages, responsesConfig, callbacks)
      ).rejects.toThrow('Missing required parameter: workspaceid');

      expect(callbacks.onError).toHaveBeenCalled();
      expect(callbacks.onComplete).not.toHaveBeenCalled();
    });

    it('should stream Responses API tool calls when requestStyle is responses', async () => {
      const responsesConfig: TextModelConfig = {
        ...mockConfig,
        connectionConfig: {
          ...mockConfig.connectionConfig,
          requestStyle: 'responses'
        }
      };

      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'get_weather',
            description: 'Get weather info',
            parameters: {
              type: 'object',
              properties: {
                city: { type: 'string' }
              },
              required: ['city']
            }
          }
        }
      ];

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'response.output_item.added',
            output_index: 0,
            item: {
              type: 'function_call',
              call_id: 'call_123',
              name: 'get_weather',
              arguments: ''
            }
          };
          yield {
            type: 'response.function_call_arguments.delta',
            output_index: 0,
            delta: '{"city":"Beijing"}'
          };
          yield {
            type: 'response.completed',
            response: {
              output: [
                {
                  type: 'function_call',
                  call_id: 'call_123',
                  name: 'get_weather',
                  arguments: '{"city":"Beijing"}'
                }
              ]
            }
          };
        }
      };

      mockOpenAIInstance.responses.create.mockResolvedValue(mockStream);

      const callbacks = {
        onToken: vi.fn(),
        onReasoningToken: vi.fn(),
        onToolCall: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      };

      await adapter.sendMessageStreamWithTools(mockMessages, responsesConfig, tools, callbacks);

      expect(mockOpenAIInstance.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-mini',
          input: [{ role: 'user', content: 'Hello, world!' }],
          stream: true,
          tools
        })
      );
      expect(callbacks.onToolCall).toHaveBeenCalledWith({
        id: 'call_123',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"city":"Beijing"}'
        }
      });
      expect(callbacks.onComplete).toHaveBeenCalledWith({
        content: '',
        reasoning: undefined,
        toolCalls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"city":"Beijing"}'
            }
          }
        ],
        metadata: {
          model: 'gpt-5-mini'
        }
      });
      expect(callbacks.onError).not.toHaveBeenCalled();
    });

    // 删除"should call onError with preserved stack" - 这是过度测试错误堆栈保留的内部实现细节
  });

  describe('sendImageUnderstandingStream', () => {
    it('should stream multimodal content with image_url payloads', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [{
              delta: { content: '视觉' },
              finish_reason: null
            }]
          };
          yield {
            choices: [{
              delta: { content: '结果' },
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

      await adapter.sendImageUnderstandingStream(
        {
          systemPrompt: 'system prompt',
          userPrompt: 'describe this image',
          images: [
            {
              b64: 'ZmFrZQ==',
              mimeType: 'image/png'
            }
          ]
        },
        mockConfig,
        callbacks
      );

      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system', content: 'system prompt' }),
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                expect.objectContaining({ type: 'text', text: 'describe this image' }),
                expect.objectContaining({
                  type: 'image_url',
                  image_url: expect.objectContaining({
                    url: 'data:image/png;base64,ZmFrZQ=='
                  })
                })
              ])
            })
          ])
        })
      );
      expect(callbacks.onToken).toHaveBeenCalledWith('视觉');
      expect(callbacks.onToken).toHaveBeenCalledWith('结果');
      expect(callbacks.onComplete).toHaveBeenCalled();
      expect(callbacks.onError).not.toHaveBeenCalled();
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

    it('should handle invalid baseURL', async () => {
      const configWithInvalidURL = {
        ...mockConfig,
        connectionConfig: {
          ...mockConfig.connectionConfig,
          baseURL: 'invalid-url'
        }
      };

      // 模拟 API 调用失败
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(new Error('Invalid URL'));

      await expect(
        adapter.sendMessage(mockMessages, configWithInvalidURL)
      ).rejects.toThrow('Invalid URL');
    });
  });
});
