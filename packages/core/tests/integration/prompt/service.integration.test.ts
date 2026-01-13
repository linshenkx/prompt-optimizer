import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { PromptService } from '../../../src/services/prompt/service';
import { ModelManager } from '../../../src/services/model/manager';
import { TemplateManager } from '../../../src/services/template/manager';
import { HistoryManager } from '../../../src/services/history/manager';
import { LocalStorageProvider } from '../../../src/services/storage/localStorageProvider';
import { createLLMService } from '../../../src/services/llm/service';
import { createTemplateManager } from '../../../src/services/template/manager';
import { createTemplateLanguageService } from '../../../src/services/template/languageService';
import { createModelManager } from '../../../src/services/model/manager';
import { createHistoryManager } from '../../../src/services/history/manager';
import { Template, MessageTemplate } from '../../../src/services/template/types';
import { TextModelConfig } from '../../../src/services/model/types';
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry';

/**
 * PromptService集成测试 - 使用真实的Gemini API
 */
describe('PromptService Integration Tests', () => {
  const hasGeminiKey = !!process.env.VITE_GEMINI_API_KEY;
  const DELAY_BETWEEN_TESTS = 60000; // 1分钟延迟避免速率限制
  const TEST_TIMEOUT = 120000; // 2分钟超时


  let promptService: PromptService;
  let modelManager: ModelManager;
  let llmService: any;
  let templateManager: TemplateManager;
  let historyManager: HistoryManager;
  let storage: LocalStorageProvider;
  let registry: TextAdapterRegistry;
  let lastTestTime = 0;

  // 在测试之间添加延迟以避免 API 速率限制
  const delayBetweenTests = async () => {
    const now = Date.now();
    const timeSinceLastTest = now - lastTestTime;
    if (lastTestTime > 0 && timeSinceLastTest < DELAY_BETWEEN_TESTS) {
      const waitTime = DELAY_BETWEEN_TESTS - timeSinceLastTest;
      console.log(`⏳ Waiting ${Math.round(waitTime / 1000)}s before next test to avoid rate limiting...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastTestTime = Date.now();
  };

  beforeAll(() => {
    console.log('Gemini API Key available:', hasGeminiKey);
    if (!hasGeminiKey) {
      console.log('Skipping PromptService integration tests: GEMINI_API_KEY environment variable not set');
    }
  });

  beforeEach(async () => {
    // 初始化存储和管理器
    storage = new LocalStorageProvider();
    registry = new TextAdapterRegistry();
    modelManager = createModelManager(storage);
    llmService = createLLMService(modelManager);

    const languageService = createTemplateLanguageService(storage);
    templateManager = createTemplateManager(storage, languageService);


    historyManager = createHistoryManager(storage, modelManager);

    // 初始化服务
    promptService = new PromptService(modelManager, llmService, templateManager, historyManager);

    // 清理存储
    await storage.clearAll();

    // 只有在有API密钥时才添加模型
    if (hasGeminiKey) {
      const adapter = registry.getAdapter('gemini');
      // 自动使用 adapter 提供的第一个可用模型，避免硬编码模型 ID
      const availableModels = adapter.getModels();
      if (availableModels.length === 0) {
        throw new Error('No Gemini models available from adapter');
      }
      
      const geminiConfig: TextModelConfig = {
        id: 'test-gemini',
        name: 'Test Gemini Model',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: availableModels[0], // 使用第一个可用模型
        connectionConfig: {
          apiKey: process.env.VITE_GEMINI_API_KEY!
          // 不覆盖 baseURL，使用 adapter 的默认值
        },
        paramOverrides: {
          temperature: 0.7,
          maxOutputTokens: 1000,
          // 禁用 Gemini 2.5 的思考功能以获得稳定的测试结果
          // 参考：https://ai.google.dev/gemini-api/docs/text-generation
          thinkingBudget: 0
        }
      };

      await modelManager.addModel('test-gemini', geminiConfig);
    }
  });

  describe('optimizePrompt with different template formats', () => {
    it.runIf(hasGeminiKey)('should work with string-based templates', async () => {
      await delayBetweenTests();
      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Write a simple greeting',
        modelKey: 'test-gemini'
      };
      const result = await promptService.optimizePrompt(request);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // 模拟UI层保存历史记录
      await historyManager.createNewChain({
        id: `test_${Date.now()}`,
        originalPrompt: request.targetPrompt,
        optimizedPrompt: result,
        type: 'optimize',
        modelKey: request.modelKey,
        timestamp: Date.now()
      });

      // 验证历史记录
      const records = await historyManager.getRecords();
      expect(records.length).toBe(1);
      expect(records[0].type).toBe('optimize');
    }, TEST_TIMEOUT);

    it.runIf(hasGeminiKey)('should work with message-based templates', async () => {
      await delayBetweenTests();
      // 添加一个消息模板 - 使用实际存在的变量
      const messageTemplate: Template = {
        id: 'test-message-template',
        name: 'Test Message Template',
        content: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant specialized in prompt optimization.'
          },
          {
            role: 'user',
            content: 'Please optimize this prompt: {{originalPrompt}}'
          }
        ] as MessageTemplate[],
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'optimize',
          language: 'zh' as const
        }
      };

      await templateManager.saveTemplate(messageTemplate);

      // 使用spy来模拟getTemplate返回我们的模板
      const getTemplateSpy = vi.spyOn(templateManager, 'getTemplate').mockReturnValue(messageTemplate);

      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Write a simple greeting',
        modelKey: 'test-gemini'
      };
      const result = await promptService.optimizePrompt(request);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // 验证模板被调用
      expect(getTemplateSpy).toHaveBeenCalled();

      // 恢复spy
      getTemplateSpy.mockRestore();
    }, TEST_TIMEOUT);

    it.skipIf(!hasGeminiKey)('skip string-based templates test - no Gemini API key', () => {
      expect(true).toBe(true);
    });
  });

  describe('iteratePrompt with different template formats', () => {
    it.runIf(hasGeminiKey)('should work with string-based iterate templates', async () => {
      await delayBetweenTests();
      // 添加一个简单的迭代模板供测试使用
      const simpleIterateTemplate: Template = {
        id: 'simple-iterate-template',
        name: 'Simple Iterate Template',
        content: [
          {
            role: 'system',
            content: 'You are an expert prompt optimizer.'
          },
          {
            role: 'user',
            content: 'Improve this prompt: {{lastOptimizedPrompt}}\n\nSuggestion: {{iterateInput}}'
          }
        ] as MessageTemplate[],
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'iterate',
          language: 'zh' as const
        }
      };

      await templateManager.saveTemplate(simpleIterateTemplate);

      // 模拟getTemplate返回迭代模板
      const getTemplateSpy = vi.spyOn(templateManager, 'getTemplate').mockReturnValue(simpleIterateTemplate);

      const result = await promptService.iteratePrompt(
        'Write a simple greeting',
        'Hello world',
        'Make it more formal',
        'test-gemini'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // 恢复spy
      getTemplateSpy.mockRestore();

      // 模拟UI层保存历史记录 - 对于迭代，需要先创建一个链，然后添加迭代
      const chain = await historyManager.createNewChain({
        id: `test_${Date.now()}`,
        originalPrompt: 'Write a simple greeting',
        optimizedPrompt: 'Hello world',
        type: 'optimize',
        modelKey: 'test-gemini',
        timestamp: Date.now()
      });

      await historyManager.addIteration({
        chainId: chain.chainId,
        originalPrompt: 'Write a simple greeting',
        optimizedPrompt: result,
        modelKey: 'test-gemini',
        templateId: 'iterate',
        iterationNote: 'Make it more formal'
      });

      // 验证历史记录
      const records = await historyManager.getRecords();
      expect(records.length).toBe(2); // 一个初始记录 + 一个迭代记录
      expect(records.find(r => r.type === 'iterate')).toBeDefined();
    }, TEST_TIMEOUT);

    it.runIf(hasGeminiKey)('should work with message-based iterate templates', async () => {
      await delayBetweenTests();
      // 添加迭代模板 - 合并为单个 user 消息
      const iterateTemplate: Template = {
        id: 'test-iterate-template',
        name: 'Test Iterate Template',
        content: [
          {
            role: 'system',
            content: 'You are an expert prompt optimizer.'
          },
          {
            role: 'user',
            content: 'Original prompt: {{originalPrompt}}\n\nLast optimized version: {{lastOptimizedPrompt}}\n\nImprovement request: {{iterateInput}}'
          }
        ] as MessageTemplate[],
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'iterate',
          language: 'zh' as const
        }
      };

      await templateManager.saveTemplate(iterateTemplate);

      // 模拟getTemplate返回迭代模板
      const getTemplateSpy = vi.spyOn(templateManager, 'getTemplate').mockReturnValue(iterateTemplate);

      const result = await promptService.iteratePrompt(
        'Write a simple greeting',
        'Hello world',
        'Make it more creative',
        'test-gemini'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // 验证模板被调用
      expect(getTemplateSpy).toHaveBeenCalled();

      // 恢复spy
      getTemplateSpy.mockRestore();
    }, TEST_TIMEOUT);

    it.skipIf(!hasGeminiKey)('skip iterate templates test - no Gemini API key', () => {
      expect(true).toBe(true);
    });
  });

  describe('streaming methods', () => {
    it.runIf(hasGeminiKey)('should handle optimizePromptStream', async () => {
      await delayBetweenTests();
      const tokens: string[] = [];
      let completed = false;

      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Write a simple greeting',
        modelKey: 'test-gemini',
        templateId: 'general-optimize'
      };

      // 使用Promise来确保onComplete被正确等待
      await new Promise<void>((resolve, reject) => {
        promptService.optimizePromptStream(
          request,
          {
            onToken: (token) => tokens.push(token),
            onComplete: () => {
              completed = true;
              resolve();
            },
            onError: (error) => {
              reject(error);
            }
          }
        ).catch(reject);
      });

      expect(tokens.length).toBeGreaterThan(0);
      expect(completed).toBe(true);

      // 验证接收到的内容
      const fullContent = tokens.join('');
      expect(fullContent.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it.runIf(hasGeminiKey)('should handle iteratePromptStream with template objects', async () => {
      await delayBetweenTests();
      const tokens: string[] = [];
      let completed = false;

      // 添加流式迭代模板
      const streamIterateTemplate: Template = {
        id: 'stream-iterate-template',
        name: 'Stream Iterate Template',
        content: [
          {
            role: 'system',
            content: 'You are a prompt refinement expert.'
          },
          {
            role: 'user',
            content: 'Original: {{originalPrompt}}\n\nCurrent version: {{lastOptimizedPrompt}}\n\nRefinement: {{iterateInput}}'
          }
        ] as MessageTemplate[],
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'iterate',
          language: 'zh' as const
        }
      };

      await templateManager.saveTemplate(streamIterateTemplate);

      // 模拟getTemplate返回流式迭代模板
      const getTemplateSpy = vi.spyOn(templateManager, 'getTemplate').mockReturnValue(streamIterateTemplate);

      // 使用Promise来确保onComplete被正确等待
      await new Promise<void>((resolve, reject) => {
        promptService.iteratePromptStream(
          'Write a simple greeting',
          'Hello world',
          'Make it better',
          'test-gemini',
          {
            onToken: (token) => tokens.push(token),
            onComplete: () => {
              completed = true;
              resolve();
            },
            onError: (error) => {
              reject(error);
            }
          },
          'iterate'
        ).catch(reject);
      });

      expect(tokens.length).toBeGreaterThan(0);
      expect(completed).toBe(true);

      // 验证接收到的内容
      const fullContent = tokens.join('');
      expect(fullContent.length).toBeGreaterThan(0);

      // 恢复spy
      getTemplateSpy.mockRestore();
    }, TEST_TIMEOUT);

    it.skipIf(!hasGeminiKey)('skip streaming tests - no Gemini API key', () => {
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it.runIf(hasGeminiKey)('should handle template not found errors', async () => {
      // 模拟模板未找到
      const getTemplateSpy = vi.spyOn(templateManager, 'getTemplate').mockImplementation(() => {
        throw new Error('Template not found');
      });

      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Test prompt',
        modelKey: 'test-gemini'
      };
      await expect(
        promptService.optimizePrompt(request)
      ).rejects.toThrow(/Template not found/);

      // 恢复spy
      getTemplateSpy.mockRestore();
    });

    it.runIf(hasGeminiKey)('should handle invalid template content', async () => {
      const invalidTemplate: Template = {
        id: 'invalid',
        name: 'Invalid Template',
        content: null as any,
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'optimize',
          language: 'zh' as const
        }
      };

      const getTemplateSpy = vi.spyOn(templateManager, 'getTemplate').mockReturnValue(invalidTemplate);

      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Test prompt',
        modelKey: 'test-gemini'
      };
      await expect(
        promptService.optimizePrompt(request)
      ).rejects.toThrow(/Template not found or invalid/);

      // 恢复spy
      getTemplateSpy.mockRestore();
    });

    it.skipIf(!hasGeminiKey)('skip error handling tests - no Gemini API key', () => {
      expect(true).toBe(true);
    });
  });
});
