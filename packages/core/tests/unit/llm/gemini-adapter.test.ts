import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiAdapter } from '../../../src/services/llm/adapters/gemini-adapter';
import type { TextModelConfig, Message } from '../../../src/services/llm/types';

// 单元测试不应触发真实网络请求，必要处通过最小 mock 隔离 SDK

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;

  const mockConfig: TextModelConfig = {
    id: 'gemini',
    name: 'Gemini',
    enabled: true,
    providerMeta: {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Google Generative AI models',
      requiresApiKey: true,
      defaultBaseURL: 'https://generativelanguage.googleapis.com',
      supportsDynamicModels: true, // 更新为 true
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
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      description: 'Latest Gemini model',
      providerId: 'gemini',
      capabilities: {
        supportsTools: true,
        supportsReasoning: false,
        maxContextLength: 1000000
      },
      parameterDefinitions: [],
      defaultParameterValues: {}
    },
    connectionConfig: {
      apiKey: 'test-api-key',
      baseURL: 'https://generativelanguage.googleapis.com'
    },
    paramOverrides: {}
  };

  const mockMessages: Message[] = [
    { role: 'user', content: 'Hello, Gemini!' }
  ];

  beforeEach(() => {
    adapter = new GeminiAdapter();
  });

  describe('getProvider', () => {
    it('should return Gemini provider metadata', () => {
      const provider = adapter.getProvider();

      expect(provider.id).toBe('gemini');
      expect(provider.name).toBe('Google Gemini');
      expect(provider.defaultBaseURL).toBe('https://generativelanguage.googleapis.com');
      expect(provider.supportsDynamicModels).toBe(true); // 更新期望值
      expect(provider.requiresApiKey).toBe(true);
    });
  });

  describe('getModels', () => {
    it('should return static Gemini models list', () => {
      const models = adapter.getModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      expect(models.map(model => model.id)).toEqual([
        'gemini-3.6-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-pro-preview'
      ]);
      expect(models[0].providerId).toBe('gemini');
    });
  });

  describe('buildDefaultModel', () => {
    it('should build valid TextModel for unknown model ID', () => {
      const model = adapter.buildDefaultModel('unknown-gemini-model');

      expect(model.id).toBe('unknown-gemini-model');
      expect(model.providerId).toBe('gemini');
      expect(model.capabilities).toBeDefined();
    });
  });

  describe('parameter definitions', () => {
    it('should include thinking parameters in definitions', () => {
      const models = adapter.getModels();
      const model = models[0];

      const paramNames = model.parameterDefinitions.map(p => p.name);

      // Gemini 3.5/3.6 已弃用这些采样参数
      expect(paramNames).not.toContain('temperature');
      expect(paramNames).not.toContain('topP');
      expect(paramNames).not.toContain('topK');
      expect(paramNames).toContain('maxOutputTokens');

      // Gemini 3 使用 thinkingLevel，不再使用 token budget
      expect(paramNames).not.toContain('thinkingBudget');
      expect(paramNames).toContain('thinkingLevel');
      expect(paramNames).toContain('includeThoughts');

      const thinkingLevel = model.parameterDefinitions.find(p => p.name === 'thinkingLevel');
      expect(thinkingLevel?.allowedValues).toEqual(['minimal', 'low', 'medium', 'high']);

      const includeThoughts = model.parameterDefinitions.find(p => p.name === 'includeThoughts');
      expect(includeThoughts).toBeDefined();
      expect(includeThoughts?.type).toBe('boolean');
      expect(includeThoughts?.description).toContain('Gemini 2.5+');
    });

    it('should NOT enable thinking parameters by default', () => {
      const models = adapter.getModels();
      const model = models[0];

      const defaultValues = model.defaultParameterValues || {};

      // 默认值现在返回空对象，让服务器使用官方默认值
      // 这是为了避免客户端错误默认值影响效果
      expect(defaultValues).toEqual({});

      // 验证参数定义中包含思考参数
      const paramNames = model.parameterDefinitions.map(p => p.name);
      expect(paramNames).toContain('thinkingLevel');
      expect(paramNames).toContain('includeThoughts');
    });
  });

  describe('error handling', () => {
    it('filters deprecated sampling parameters for Gemini 3.6 requests', async () => {
      const generateContent = vi.fn().mockResolvedValue({
        text: 'ok',
        candidates: [{ content: { parts: [{ text: 'ok' }] } }]
      });
      (adapter as any).createClient = () => ({ models: { generateContent } });

      await adapter.sendMessage(mockMessages, {
        ...mockConfig,
        modelMeta: adapter.getModels()[0],
        paramOverrides: {
          temperature: 0.2,
          topP: 0.8,
          topK: 20,
          candidateCount: 2,
          thinkingBudget: 2000,
          thinkingLevel: 'high',
          maxOutputTokens: 2048
        }
      });

      const requestConfig = generateContent.mock.calls[0][0].config;
      expect(requestConfig.temperature).toBeUndefined();
      expect(requestConfig.topP).toBeUndefined();
      expect(requestConfig.topK).toBeUndefined();
      expect(requestConfig.candidateCount).toBeUndefined();
      expect(requestConfig.maxOutputTokens).toBe(2048);
      expect(requestConfig.thinkingConfig).toEqual({ thinkingLevel: 'high' });
    });

    it('should throw error when API key is missing', async () => {
      const configWithoutKey = {
        ...mockConfig,
        connectionConfig: {
          ...mockConfig.connectionConfig,
          apiKey: ''
        }
      };

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 避免调用真实 SDK / 网络：注入一个会拒绝的 client
      (adapter as any).createClient = () => ({
        models: {
          generateContent: vi.fn().mockRejectedValue(new Error('Missing API key'))
        }
      });

      await expect(adapter.sendMessage(mockMessages, configWithoutKey)).rejects.toThrow(
        'Missing API key'
      );

      errorSpy.mockRestore();
    });
  });

  describe('sendImageUnderstandingStream', () => {
    it('streams multimodal responses with inline image data', async () => {
      const generateContentStream = vi.fn().mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          yield {
            candidates: [{
              content: {
                parts: [{ text: '视觉' }],
              },
            }],
          }
          yield {
            candidates: [{
              content: {
                parts: [{ text: '结果' }],
              },
            }],
          }
        },
      })

      ;(adapter as any).createClient = () => ({
        models: {
          generateContentStream,
        },
      })

      const callbacks = {
        onToken: vi.fn(),
        onReasoningToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      }

      await (adapter as any).sendImageUnderstandingStream(
        {
          systemPrompt: 'system prompt',
          userPrompt: 'describe this image',
          images: [
            {
              b64: 'ZmFrZQ==',
              mimeType: 'image/png',
            },
          ],
        },
        mockConfig,
        callbacks,
      )

      expect(generateContentStream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: mockConfig.modelMeta.id,
          contents: [
            {
              role: 'user',
              parts: [
                { text: 'describe this image' },
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: 'ZmFrZQ==',
                  },
                },
              ],
            },
          ],
        }),
      )
      expect(callbacks.onToken).toHaveBeenCalledWith('视觉')
      expect(callbacks.onToken).toHaveBeenCalledWith('结果')
      expect(callbacks.onComplete).toHaveBeenCalled()
    })
  })
});
