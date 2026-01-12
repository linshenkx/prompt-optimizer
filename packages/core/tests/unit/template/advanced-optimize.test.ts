import { describe, it, expect } from 'vitest';
import {
  createPromptService,
  createModelManager,
  createTemplateManager,
  createHistoryManager,
  LocalStorageProvider,
  createLLMService,
} from '../../../src';
import { createTemplateLanguageService } from '../../../src/services/template/languageService';

const RUN_REAL_API = process.env.RUN_REAL_API === '1'

describe.skipIf(!RUN_REAL_API)('Advanced Optimize Template Real API Test', () => {
  it('should optimize "你是一个诗人" with real API', async () => {
    // 检查是否有可用的API密钥
    const hasApiKey = process.env.GEMINI_API_KEY || process.env.DEEPSEEK_API_KEY ||
                     process.env.OPENAI_API_KEY || process.env.CUSTOM_API_KEY ||
                     process.env.VITE_GEMINI_API_KEY || process.env.VITE_DEEPSEEK_API_KEY ||
                     process.env.VITE_OPENAI_API_KEY || process.env.VITE_CUSTOM_API_KEY;

    if (!hasApiKey) {
      return;
    }

    // 1. 创建所有依赖
    const storageProvider = new LocalStorageProvider();
    await storageProvider.clearAll(); // 确保干净的环境

    const modelManager = createModelManager(storageProvider);
    const languageService = createTemplateLanguageService(storageProvider);
    const templateManager = createTemplateManager(storageProvider, languageService);
    const historyManager = createHistoryManager(storageProvider, modelManager);
    const llmService = createLLMService(modelManager);

    // 2. 初始化服务 (ModelManager会自动初始化)


    // 3. 创建被测试的服务
    const promptService = createPromptService(
      modelManager,
      llmService,
      templateManager,
      historyManager
    );

    // 获取可用的模型
    const models = await modelManager.getAllModels();
    const availableModel = models.find(m => m.enabled);

    if (!availableModel) {
      return;
    }


    const result = await promptService.optimizePrompt({
      optimizationMode: 'system',
      targetPrompt: '你是一个诗人',
      templateId: 'analytical-optimize',
      modelKey: availableModel.id
    });


    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  }, 300000); // 300秒超时
}); 
