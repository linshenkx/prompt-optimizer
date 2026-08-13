import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIAdapter } from '../../../src/services/llm/adapters/openai-adapter';
import { OpenAICompatibleAdapter } from '../../../src/services/llm/adapters/openai-compatible-adapter';
import type { TextModelConfig, Message } from '../../../src/services/llm/types';

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

      expect(models.map(model => model.id)).toEqual([
        'gpt-5.6-terra',
        'gpt-5.6-sol',
        'gpt-5.6-luna'
      ]);
      const terra = models[0];
      expect(terra.name).toBe('GPT-5.6 Terra');
      expect(terra.providerId).toBe('openai');
      expect(terra.capabilities.supportsTools).toBe(true);
      expect(terra.capabilities.supportsReasoning).toBe(true);
      expect(terra.capabilities.maxContextLength).toBe(1050000);
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
      expect(model.parameterDefinitions.find(p => p.name === 'reasoning_effort')?.allowedValues)
        .toEqual(['none', 'low', 'medium', 'high', 'xhigh', 'max']);
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
        },
        paramOverrides: {
          reasoning_effort: 'high'
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
          input: [{ role: 'user', content: 'Hello, world!' }],
          reasoning: { effort: 'high' }
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

  describe('image understanding request styles', () => {
    it('should send Chat Completions image_url payloads for non-streaming requests', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        model: 'gpt-5-mini',
        choices: [{
          message: { content: '视觉结果' },
          finish_reason: 'stop'
        }]
      });

      const response = await adapter.sendImageUnderstanding(
        {
          systemPrompt: 'system prompt',
          userPrompt: 'describe this image',
          images: [{ b64: 'ZmFrZQ==', mimeType: 'image/png' }]
        },
        mockConfig
      );

      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5-mini',
          messages: [
            { role: 'system', content: 'system prompt' },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'describe this image' },
                {
                  type: 'image_url',
                  image_url: { url: 'data:image/png;base64,ZmFrZQ==' }
                }
              ]
            }
          ]
        })
      );
      expect(mockOpenAIInstance.responses.create).not.toHaveBeenCalled();
      expect(response.content).toBe('视觉结果');
    });

    it('should send Responses API input_image payloads for non-streaming requests', async () => {
      const responsesConfig: TextModelConfig = {
        ...mockConfig,
        connectionConfig: {
          ...mockConfig.connectionConfig,
          requestStyle: 'responses'
        }
      };
      mockOpenAIInstance.responses.create.mockResolvedValue({
        id: 'resp_image',
        output_text: 'Responses 视觉结果'
      });

      const response = await adapter.sendImageUnderstanding(
        {
          systemPrompt: 'system prompt',
          userPrompt: 'describe this image',
          images: [{ b64: 'ZmFrZQ==', mimeType: 'image/jpeg' }],
          paramOverrides: { max_tokens: 64 }
        },
        responsesConfig
      );

      expect(mockOpenAIInstance.responses.create).toHaveBeenCalledWith({
        model: 'gpt-5-mini',
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: 'system prompt' }]
          },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'describe this image' },
              {
                type: 'input_image',
                image_url: 'data:image/jpeg;base64,ZmFrZQ=='
              }
            ]
          }
        ],
        max_output_tokens: 64
      });
      expect(mockOpenAIInstance.chat.completions.create).not.toHaveBeenCalled();
      expect(response.content).toBe('Responses 视觉结果');
    });

    it('should not add a second data URL prefix when an IPC caller already supplied one', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }]
      });

      await adapter.sendImageUnderstanding(
        {
          userPrompt: 'describe this image',
          images: [{ b64: 'data:image/png;base64,ZmFrZQ==', mimeType: 'image/png' }]
        },
        mockConfig
      );

      const request = mockOpenAIInstance.chat.completions.create.mock.calls[0][0];
      const imageUrl = request.messages[0].content[1].image_url.url;
      expect(imageUrl).toBe('data:image/png;base64,ZmFrZQ==');
      expect(imageUrl.match(/data:image\/png;base64,/g)).toHaveLength(1);
    });

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

    it('should stream image understanding through Responses API when configured', async () => {
      const responsesConfig: TextModelConfig = {
        ...mockConfig,
        connectionConfig: {
          ...mockConfig.connectionConfig,
          requestStyle: 'responses'
        }
      };
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'response.output_text.delta', delta: '视觉' };
          yield { type: 'response.output_text.delta', delta: '结果' };
          yield {
            type: 'response.completed',
            response: { output_text: '视觉结果' }
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

      await adapter.sendImageUnderstandingStream(
        {
          userPrompt: 'describe this image',
          images: [{ b64: 'ZmFrZQ==', mimeType: 'image/png' }]
        },
        responsesConfig,
        callbacks
      );

      expect(mockOpenAIInstance.responses.create).toHaveBeenCalledWith({
        model: 'gpt-5-mini',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'describe this image' },
              {
                type: 'input_image',
                image_url: 'data:image/png;base64,ZmFrZQ=='
              }
            ]
          }
        ],
        stream: true
      });
      expect(mockOpenAIInstance.chat.completions.create).not.toHaveBeenCalled();
      expect(callbacks.onToken).toHaveBeenNthCalledWith(1, '视觉');
      expect(callbacks.onToken).toHaveBeenNthCalledWith(2, '结果');
      expect(callbacks.onComplete).toHaveBeenCalledWith({
        content: '视觉结果',
        reasoning: undefined,
        metadata: { model: 'gpt-5-mini' }
      });
      expect(callbacks.onError).not.toHaveBeenCalled();
    });

    it('should propagate image provider errors without logging echoed payloads', async () => {
      const responsesConfig: TextModelConfig = {
        ...mockConfig,
        connectionConfig: {
          ...mockConfig.connectionConfig,
          requestStyle: 'responses'
        }
      };
      const providerError = new Error(
        'provider rejected data:image/png;base64,U0VDUkVUX0lNQUdF'
      );
      mockOpenAIInstance.responses.create.mockRejectedValue(providerError);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await expect(
          adapter.sendImageUnderstanding(
            {
              userPrompt: 'describe this image',
              images: [{ b64: 'U0VDUkVUX0lNQUdF', mimeType: 'image/png' }]
            },
            responsesConfig
          )
        ).rejects.toBe(providerError);
        expect(consoleError).not.toHaveBeenCalled();
      } finally {
        consoleError.mockRestore();
      }
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
