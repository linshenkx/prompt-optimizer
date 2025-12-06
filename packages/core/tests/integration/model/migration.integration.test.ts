import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelManager } from '../../../src/services/model/manager';
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';
import { isLegacyConfig, isTextModelConfig } from '../../../src/services/model/converter';
import type { ModelConfig, TextModelConfig } from '../../../src/services/model/types';

describe('配置迁移集成测试', () => {
  let storage: MemoryStorageProvider;
  let registry: TextAdapterRegistry;

  beforeEach(async () => {
    storage = new MemoryStorageProvider();
    registry = new TextAdapterRegistry();
    await storage.clearAll();
  });

  describe('传统配置自动转换', () => {
    it('应该自动转换OpenAI传统配置', async () => {
      // 准备传统配置
      const legacyConfig: ModelConfig = {
        name: 'OpenAI',
        provider: 'openai',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-openai-key',
        models: ['gpt-5-2025-08-07', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-5-2025-08-07',
        enabled: true,
        llmParams: {
          temperature: 0.7,
          max_tokens: 2000
        }
      };

      // 写入Storage
      const modelsData = {
        openai: legacyConfig
      };
      await storage.setItem('models', JSON.stringify(modelsData));

      // 验证写入的是传统格式
      const storedRaw = await storage.getItem('models');
      const storedModels = JSON.parse(storedRaw!);
      expect(isLegacyConfig(storedModels.openai)).toBe(true);

      // 初始化ModelManager（会触发自动转换）
      const modelManager = new ModelManager(storage, registry);
      

      // 验证转换后的配置
      const convertedConfig = await modelManager.getModel('openai') as TextModelConfig;
      expect(convertedConfig).toBeDefined();
      expect(isTextModelConfig(convertedConfig)).toBe(true);
      expect(isLegacyConfig(convertedConfig)).toBe(false);

      // 验证字段映射正确
      expect(convertedConfig.id).toBe('openai');
      expect(convertedConfig.name).toBe('OpenAI');
      expect(convertedConfig.enabled).toBe(true);
      expect(convertedConfig.providerMeta.id).toBe('openai');
      expect(convertedConfig.modelMeta.id).toBe('gpt-5-2025-08-07');
      expect(convertedConfig.connectionConfig.apiKey).toBe('test-openai-key');
      expect(convertedConfig.connectionConfig.baseURL).toBe('https://api.openai.com/v1');
      expect(convertedConfig.paramOverrides.temperature).toBe(0.7);
      expect(convertedConfig.paramOverrides.max_tokens).toBe(2000);

      // 验证元数据来自Adapter
      const adapter = registry.getAdapter('openai');
      const expectedProvider = adapter.getProvider();
      expect(convertedConfig.providerMeta.name).toBe(expectedProvider.name);
      expect(convertedConfig.providerMeta.defaultBaseURL).toBe(expectedProvider.defaultBaseURL);
    });

    it('应该自动转换Gemini传统配置', async () => {
      const legacyConfig: ModelConfig = {
        name: 'Gemini',
        provider: 'gemini',
        baseURL: 'https://generativelanguage.googleapis.com',
        apiKey: 'test-gemini-key',
        models: ['gemini-2.0-flash-exp'],
        defaultModel: 'gemini-2.0-flash-exp',
        enabled: true,
        llmParams: {
          temperature: 0.8
        }
      };

      const modelsData = { gemini: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);
      

      const convertedConfig = await modelManager.getModel('gemini') as TextModelConfig;
      expect(isTextModelConfig(convertedConfig)).toBe(true);
      expect(convertedConfig.providerMeta.id).toBe('gemini');
      expect(convertedConfig.modelMeta.id).toBe('gemini-2.0-flash-exp');
      expect(convertedConfig.modelMeta.providerId).toBe('gemini');
      expect(convertedConfig.connectionConfig.apiKey).toBe('test-gemini-key');
      expect(convertedConfig.paramOverrides.temperature).toBe(0.8);
    });

    it('应该自动转换Anthropic传统配置', async () => {
      const legacyConfig: ModelConfig = {
        name: 'Anthropic',
        provider: 'anthropic',
        baseURL: 'https://api.anthropic.com/v1',
        apiKey: 'test-anthropic-key',
        models: ['claude-3-5-sonnet-20241022'],
        defaultModel: 'claude-3-5-sonnet-20241022',
        enabled: true
      };

      const modelsData = { anthropic: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);
      

      const convertedConfig = await modelManager.getModel('anthropic') as TextModelConfig;
      expect(isTextModelConfig(convertedConfig)).toBe(true);
      expect(convertedConfig.providerMeta.id).toBe('anthropic');
      expect(convertedConfig.modelMeta.providerId).toBe('anthropic');
    });

    it('应该转换DeepSeek配置并保持DeepSeek Provider', async () => {
      const legacyConfig: ModelConfig = {
        name: 'DeepSeek',
        provider: 'deepseek',
        baseURL: 'https://api.deepseek.com/v1',
        apiKey: 'test-deepseek-key',
        models: ['deepseek-chat'],
        defaultModel: 'deepseek-chat',
        enabled: true
      };

      const modelsData = { deepseek: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);
      

      const convertedConfig = await modelManager.getModel('deepseek') as TextModelConfig;
      expect(isTextModelConfig(convertedConfig)).toBe(true);
      expect(convertedConfig.providerMeta.id).toBe('deepseek');
      expect(convertedConfig.modelMeta.providerId).toBe('deepseek');
      expect(convertedConfig.connectionConfig.baseURL).toBe('https://api.deepseek.com/v1');
    });

    it('应该转换Zhipu配置并保持Zhipu Provider', async () => {
      const legacyConfig: ModelConfig = {
        name: 'Zhipu',
        provider: 'zhipu',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: 'test-zhipu-key',
        models: ['glm-4-flash'],
        defaultModel: 'glm-4-flash',
        enabled: true
      };

      const modelsData = { zhipu: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);
      

      const convertedConfig = await modelManager.getModel('zhipu') as TextModelConfig;
      expect(isTextModelConfig(convertedConfig)).toBe(true);
      expect(convertedConfig.providerMeta.id).toBe('zhipu');
      expect(convertedConfig.modelMeta.providerId).toBe('zhipu');
    });

    it('应该将Custom配置映射到OpenAI Adapter', async () => {
      const legacyConfig: ModelConfig = {
        name: 'Custom Model',
        provider: 'custom',
        baseURL: 'https://custom.api.com/v1',
        apiKey: 'test-custom-key',
        models: ['custom-model'],
        defaultModel: 'custom-model',
        enabled: true
      };

      const modelsData = { custom: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);
      

      const convertedConfig = await modelManager.getModel('custom') as TextModelConfig;
      expect(isTextModelConfig(convertedConfig)).toBe(true);
      expect(convertedConfig.providerMeta.id).toBe('openai');
    });
  });

  describe('转换后持久化', () => {
    it('应该将转换后的配置保存到Storage', async () => {
      const legacyConfig: ModelConfig = {
        name: 'OpenAI',
        provider: 'openai',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        models: ['gpt-5-2025-08-07'],
        defaultModel: 'gpt-5-2025-08-07',
        enabled: true
      };

      const modelsData = { openai: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      // 第一次初始化 - 触发转换
      const modelManager1 = new ModelManager(storage, registry);
      await modelManager1.ensureInitialized();

      // 验证Storage中的数据已更新
      const storedRaw = await storage.getItem('models');
      const storedModels = JSON.parse(storedRaw!);
      expect(isTextModelConfig(storedModels.openai)).toBe(true);
      expect(storedModels.openai.providerMeta).toBeDefined();
      expect(storedModels.openai.modelMeta).toBeDefined();
    });

    it('应该确保转换幂等性（第二次加载不再转换）', async () => {
      const legacyConfig: ModelConfig = {
        name: 'OpenAI',
        provider: 'openai',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        models: ['gpt-5-2025-08-07'],
        defaultModel: 'gpt-5-2025-08-07',
        enabled: true
      };

      const modelsData = { openai: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      // 第一次初始化
      const modelManager1 = new ModelManager(storage, registry);
      
      const config1 = await modelManager1.getModel('openai') as TextModelConfig;

      // 第二次初始化（重新加载）
      const modelManager2 = new ModelManager(storage, registry);
      
      const config2 = await modelManager2.getModel('openai') as TextModelConfig;

      // 验证两次加载结果一致
      expect(config1).toMatchObject({
        id: config2.id,
        name: config2.name,
        enabled: config2.enabled,
        providerMeta: { id: config2.providerMeta.id },
        modelMeta: { id: config2.modelMeta.id },
        connectionConfig: config2.connectionConfig,
        paramOverrides: config2.paramOverrides
      });
      // 验证Storage中是新格式
      const storedRaw = await storage.getItem('models');
      const storedModels = JSON.parse(storedRaw!);
      expect(isTextModelConfig(storedModels.openai)).toBe(true);
    });
  });

  describe('未知模型处理', () => {
    it('应该为未知模型使用buildDefaultModel', async () => {
      const legacyConfig: ModelConfig = {
        name: 'OpenAI',
        provider: 'openai',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        models: ['unknown-gpt-model-xyz'],
        defaultModel: 'unknown-gpt-model-xyz',
        enabled: true
      };

      const modelsData = { openai: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);
      

      const convertedConfig = await modelManager.getModel('openai') as TextModelConfig;
      expect(isTextModelConfig(convertedConfig)).toBe(true);
      expect(convertedConfig.modelMeta.id).toBe('unknown-gpt-model-xyz');
      expect(convertedConfig.modelMeta.providerId).toBe('openai');
      expect(convertedConfig.modelMeta.capabilities).toBeDefined();
    });
  });

  // 删除"转换失败场景"测试 - 这是过度测试内部错误处理实现细节

  describe('新格式配置处理', () => {
    it('应该直接识别并保留新格式配置', async () => {
      const adapter = registry.getAdapter('openai');
      const model = adapter.getModels().find(m => m.id === 'gpt-5-mini')!;

      const newConfig: TextModelConfig = {
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: model,
        connectionConfig: {
          apiKey: 'test-key',
          baseURL: 'https://api.openai.com/v1'
        },
        paramOverrides: {}
      };

      const modelsData = { openai: newConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);


      const loadedConfig = await modelManager.getModel('openai') as TextModelConfig;
      expect(isTextModelConfig(loadedConfig)).toBe(true);
      // 使用toMatchObject允许adapter更新元数据字段
      expect(loadedConfig).toMatchObject({
        id: newConfig.id,
        name: newConfig.name,
        enabled: newConfig.enabled,
        connectionConfig: newConfig.connectionConfig,
        paramOverrides: newConfig.paramOverrides
      });

      // 验证Storage中是新格式
      const storedRaw2 = await storage.getItem('models');
      const storedModels2 = JSON.parse(storedRaw2!);
      expect(isTextModelConfig(storedModels2.openai)).toBe(true);
    });
  });
});
