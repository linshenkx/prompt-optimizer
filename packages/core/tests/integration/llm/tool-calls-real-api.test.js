import { createLLMService, ModelManager, LocalStorageProvider } from '../../../src/index.js';
import { expect, describe, it, beforeAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
beforeAll(() => {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
});

const RUN_REAL_API = process.env.RUN_REAL_API === '1'

describe.skipIf(!RUN_REAL_API)('Tool Calls Real API Integration Tests', () => {
  const OPENAI_COMPATIBLE_PROVIDERS = new Set([
    'openai',
    'deepseek',
    'siliconflow',
    'zhipu',
    'openrouter',
    'dashscope',
    'modelscope'
  ])

  const createServices = async () => {
    const storage = new LocalStorageProvider()
    const modelManager = new ModelManager(storage)
    const llmService = createLLMService(modelManager)

    await storage.clearAll()

    return { storage, modelManager, llmService }
  }

  const pickEnabledModelId = async (modelManager, predicate) => {
    const models = await modelManager.getAllModels()
    const candidate = models.find((m) => {
      if (!m.enabled) return false
      if (!m.modelMeta?.capabilities?.supportsTools) return false
      return predicate(m)
    })
    return candidate?.id
  }

  // 测试用工具定义
  const weatherTool = {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather information for a specific location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The location to get weather for (e.g., "Beijing", "New York")'
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'Temperature unit',
            default: 'celsius'
          }
        },
        required: ['location']
      }
    }
  };

  const calculatorTool = {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Perform basic mathematical calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate (e.g., "2 + 3 * 4")'
          }
        },
        required: ['expression']
      }
    }
  };

  describe('OpenAI Compatible API Tool Calls', () => {
    it('should handle tool calls with OpenAI compatible API', async () => {
      const { modelManager, llmService } = await createServices()
      const modelId = await pickEnabledModelId(
        modelManager,
        (m) => OPENAI_COMPATIBLE_PROVIDERS.has(m.providerMeta?.id)
      )

      if (!modelId) return

      const messages = [
        { role: 'system', content: 'You are a helpful assistant that can get weather information and perform calculations. When users ask about weather or math, use the appropriate tools.' },
        { role: 'user', content: 'What is the weather like in Beijing, and what is 15 * 24?' }
      ];

      const tools = [weatherTool, calculatorTool];
      let toolCallsReceived = [];
      let responseContent = '';

      const result = await new Promise((resolve, reject) => {
        llmService.sendMessageStreamWithTools(
          messages,
          modelId,
          tools,
          {
            onToken: (token) => {
              responseContent += token;
            },
            onToolCall: (toolCall) => {
              toolCallsReceived.push(toolCall);
            },
            onComplete: (response) => {
              resolve({ content: responseContent, toolCalls: toolCallsReceived, response });
            },
            onError: reject
          }
        );
      });

      // 验证响应
      expect(result).toBeDefined();
      expect(typeof result.content).toBe('string');

      // 验证工具调用（如果有的话）
      if (result.toolCalls.length > 0) {
        result.toolCalls.forEach(toolCall => {
          expect(toolCall).toHaveProperty('id');
          expect(toolCall.type).toBe('function');
          expect(toolCall.function).toHaveProperty('name');
          expect(toolCall.function).toHaveProperty('arguments');
          expect(['get_weather', 'calculate']).toContain(toolCall.function.name);
          
          // 验证参数是有效的JSON
          expect(() => JSON.parse(toolCall.function.arguments)).not.toThrow();
        });
      }

    }, 30000);
  });

  describe('Gemini API Tool Calls', () => {
    it('should handle tool calls with Gemini API', async () => {
      const { modelManager, llmService } = await createServices()
      const modelId = await pickEnabledModelId(modelManager, (m) => m.providerMeta?.id === 'gemini')
      if (!modelId) return

      const messages = [
        { role: 'system', content: 'You are a helpful assistant that can get weather information and perform calculations. When users ask about weather or math, use the appropriate tools.' },
        { role: 'user', content: 'Please tell me the weather in Shanghai and calculate 25 + 17' }
      ];

      const tools = [weatherTool, calculatorTool];
      let toolCallsReceived = [];
      let responseContent = '';

      const result = await new Promise((resolve, reject) => {
        llmService.sendMessageStreamWithTools(
          messages,
          modelId,
          tools,
          {
            onToken: (token) => {
              responseContent += token;
            },
            onToolCall: (toolCall) => {
              toolCallsReceived.push(toolCall);
            },
            onComplete: (response) => {
              resolve({ content: responseContent, toolCalls: toolCallsReceived, response });
            },
            onError: reject
          }
        );
      });

      // 验证响应
      expect(result).toBeDefined();
      expect(typeof result.content).toBe('string');

      // 验证工具调用（如果有的话）
      if (result.toolCalls.length > 0) {
        result.toolCalls.forEach(toolCall => {
          expect(toolCall).toHaveProperty('id');
          expect(toolCall.type).toBe('function');
          expect(toolCall.function).toHaveProperty('name');
          expect(toolCall.function).toHaveProperty('arguments');
          expect(['get_weather', 'calculate']).toContain(toolCall.function.name);
          
          // 验证参数是有效的JSON
          expect(() => JSON.parse(toolCall.function.arguments)).not.toThrow();
        });
      }

    }, 30000);
  });

  describe('Tool Call Format Validation', () => {
    it('should generate valid tool call IDs and formats', async () => {
      const { modelManager, llmService } = await createServices()
      const modelId =
        (await pickEnabledModelId(
          modelManager,
          (m) => OPENAI_COMPATIBLE_PROVIDERS.has(m.providerMeta?.id)
        )) ?? (await pickEnabledModelId(modelManager, (m) => m.providerMeta?.id === 'gemini'))

      if (!modelId) return

      const messages = [
        { role: 'user', content: 'What is the weather in Tokyo?' }
      ];

      const tools = [weatherTool];
      let toolCallsReceived = [];

      await new Promise((resolve, reject) => {
        llmService.sendMessageStreamWithTools(
          messages,
          modelId,
          tools,
          {
            onToken: () => {}, // 忽略token
            onToolCall: (toolCall) => {
              toolCallsReceived.push(toolCall);
              
              // 验证工具调用格式
              expect(toolCall.id).toMatch(/^call_\d+_[a-z0-9]+$/);
              expect(toolCall.type).toBe('function');
              expect(toolCall.function.name).toBe('get_weather');
              
              const args = JSON.parse(toolCall.function.arguments);
              expect(args).toHaveProperty('location');
              expect(typeof args.location).toBe('string');
              expect(args.location.toLowerCase()).toContain('tokyo');
            },
            onComplete: resolve,
            onError: reject
          }
        );
      });

    }, 30000);
  });

  describe('Complex Tool Scenarios', () => {
    it('should handle multiple tools in single request', async () => {
      const { modelManager, llmService } = await createServices()
      const modelId = await pickEnabledModelId(
        modelManager,
        (m) => OPENAI_COMPATIBLE_PROVIDERS.has(m.providerMeta?.id)
      )

      if (!modelId) return

      const complexTool = {
        type: 'function',
        function: {
          name: 'search_database',
          description: 'Search database with filters',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              category: { 
                type: 'string', 
                enum: ['news', 'articles', 'reports'],
                description: 'Content category'
              },
              limit: { 
                type: 'integer', 
                minimum: 1, 
                maximum: 100,
                default: 10,
                description: 'Number of results to return'
              }
            },
            required: ['query']
          }
        }
      };

      const messages = [
        { role: 'system', content: 'You have access to weather data, calculator, and database search. Use appropriate tools for user requests.' },
        { role: 'user', content: 'Search for news about AI, get weather for London, and calculate 45 * 12' }
      ];

      const tools = [weatherTool, calculatorTool, complexTool];
      let toolCallsReceived = [];
      let responseContent = '';

      const result = await new Promise((resolve, reject) => {
        llmService.sendMessageStreamWithTools(
          messages,
          modelId,
          tools,
          {
            onToken: (token) => {
              responseContent += token;
            },
            onToolCall: (toolCall) => {
              toolCallsReceived.push(toolCall);
            },
            onComplete: (response) => {
              resolve({ content: responseContent, toolCalls: toolCallsReceived });
            },
            onError: reject
          }
        );
      });

      expect(result).toBeDefined();

      // 验证工具调用的多样性
      if (result.toolCalls.length > 0) {
        const toolNames = result.toolCalls.map(tc => tc.function.name);
        const uniqueTools = [...new Set(toolNames)];
        
        result.toolCalls.forEach(toolCall => {
          expect(['get_weather', 'calculate', 'search_database']).toContain(toolCall.function.name);
          const args = JSON.parse(toolCall.function.arguments);
          expect(args).toBeDefined();
        });
      }

    }, 45000);
  });
});
