import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest'
import {
  createLLMService,
  createModelManager,
  createTemplateManager,
  createHistoryManager,
  createPreferenceService,
  PromptService,
  OptimizationRequest,
  OptimizationError,
  TestError,
  IStorageProvider,
  MemoryStorageProvider,
} from '../../../src'
import { TextModelConfig } from '../../../src/services/model/types'
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry'
import { createTemplateLanguageService } from '../../../src/services/template/languageService'

describe('PromptService', () => {
  let storageProvider: IStorageProvider;
  let promptService: PromptService;
  let modelManager: any;
  let llmService: any;
  let templateManager: any;
  let historyManager: any;
  let languageService: any;
  let registry: TextAdapterRegistry;

  beforeEach(async () => {
    storageProvider = new MemoryStorageProvider();

    // 清理存储状态
    await storageProvider.clearAll();

    // Create all required services
    registry = new TextAdapterRegistry();
    languageService = createTemplateLanguageService(createPreferenceService(storageProvider));
    templateManager = createTemplateManager(storageProvider, languageService);
    historyManager = createHistoryManager(storageProvider);
    modelManager = createModelManager(storageProvider);
    llmService = createLLMService(modelManager);

    // Create TextModelConfig
    const adapter = registry.getAdapter('openai');
    const mockModelConfig: TextModelConfig = {
      id: 'test-model',
      name: 'test-model',
      enabled: true,
      providerMeta: adapter.getProvider(),
      modelMeta: adapter.buildDefaultModel('test-model'),
      connectionConfig: {
        apiKey: 'test-key',
        baseURL: 'https://test.api'
      },
      paramOverrides: {}
    };

    // Initialize services
    await modelManager.addModel('test-model', mockModelConfig);

    // Create PromptService directly
    promptService = new PromptService(modelManager, llmService, templateManager, historyManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('optimizePrompt', () => {
    it('应该成功优化提示词', async () => {
      vi.spyOn(llmService, 'sendMessage').mockResolvedValue('优化后的提示词');

      const request: OptimizationRequest = {
        optimizationMode: 'system',
        targetPrompt: 'test prompt',
        modelKey: 'test-model',
      };
      const result = await promptService.optimizePrompt(request);
      expect(result).toBe('优化后的提示词');
      expect(llmService.sendMessage).toHaveBeenCalled();
    });

    it('当模型不存在时应抛出错误', async () => {
      const request: OptimizationRequest = {
        optimizationMode: 'system',
        targetPrompt: 'test prompt',
        modelKey: 'non-existent-model',
      };
      await expect(promptService.optimizePrompt(request)).rejects.toThrow(OptimizationError);
    });
  });

  describe('testPrompt', () => {
    it('应该成功测试提示词', async () => {
      vi.spyOn(llmService, 'sendMessage').mockResolvedValue('测试结果');

      const result = await promptService.testPrompt(
        'system prompt',
        'user prompt',
        'test-model',
      );
      expect(result).toBe('测试结果');
    });

    it('当模型不存在时应抛出错误', async () => {
      await expect(
        promptService.testPrompt(
          'system prompt',
          'user prompt',
          'non-existent-model',
        ),
      ).rejects.toThrow(TestError);
    });
  });

  describe('getHistory', () => {
    it('应该返回历史记录', async () => {
      const history = await promptService.getHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });
});
