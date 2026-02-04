import { describe, it, expect, beforeEach } from 'vitest';
import {
  LLMService,
  ModelManager,
  APIError,
  RequestConfigError,
  Message
} from '../../../src/index';
import { TextModelConfig } from '../../../src/services/model/types';
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry';
import { createMockStorage } from '../../mocks/mockStorage';

describe('LLMService', () => {
  let service: LLMService;
  let modelManager: ModelManager;
  let registry: TextAdapterRegistry;

  beforeEach(() => {
    const mockStorage = createMockStorage();
    registry = new TextAdapterRegistry();
    modelManager = new ModelManager(mockStorage, registry);
    service = new LLMService(modelManager, registry);
  });

  const createMockModelConfig = (): TextModelConfig => {
    const adapter = registry.getAdapter('openai');
    return {
      id: 'test-model',
      name: 'Test Model',
      enabled: true,
      providerMeta: adapter.getProvider(),
      modelMeta: adapter.buildDefaultModel('model-1'),
      connectionConfig: {
        apiKey: 'test-key',
        baseURL: 'https://api.test.com'
      },
      paramOverrides: {}
    };
  };

  const mockMessages: Message[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ];

  describe('validateModelConfig', () => {
    it('should throw error when model is disabled', () => {
      const mockConfig = createMockModelConfig();
      const disabledConfig = { ...mockConfig, enabled: false };
      expect(() => service['validateModelConfig'](disabledConfig))
        .toThrow();
    });

    it('should allow empty apiKey for services like Ollama', () => {
      const mockConfig = createMockModelConfig();
      const configWithEmptyApiKey = {
        ...mockConfig,
        connectionConfig: { ...mockConfig.connectionConfig, apiKey: '' }
      };
      // 新架构下不在这里验证 apiKey，Adapter 会处理
      expect(() => service['validateModelConfig'](configWithEmptyApiKey))
        .not.toThrow();
    });

    it('should throw error when provider is missing', () => {
      const mockConfig = createMockModelConfig();
      const invalidConfig = {
        ...mockConfig,
        providerMeta: { ...mockConfig.providerMeta, id: '' }
      };
      expect(() => service['validateModelConfig'](invalidConfig))
        .toThrow();
    });

    it('should throw error when defaultModel is missing', () => {
      const mockConfig = createMockModelConfig();
      const invalidConfig = {
        ...mockConfig,
        modelMeta: { ...mockConfig.modelMeta, id: '' }
      };
      expect(() => service['validateModelConfig'](invalidConfig))
        .toThrow();
    });
  });

  describe('validateMessages', () => {
    it('should validate valid messages', () => {
      expect(() => service['validateMessages'](mockMessages)).not.toThrow();
    });

    it('should throw error for empty messages', () => {
      expect(() => service['validateMessages']([]))
        .toThrow();
    });

    it('should throw error for invalid role', () => {
      const invalidMessages: Message[] = [{ role: 'invalid' as any, content: 'test' }];
      expect(() => service['validateMessages'](invalidMessages))
        .toThrow();
    });

    it('should throw error for missing content', () => {
      const invalidMessages: Message[] = [{ role: 'user', content: '' }];
      expect(() => service['validateMessages'](invalidMessages))
        .toThrow();
    });
  });

  describe('testConnection', () => {
    it('should allow connection test when model is disabled', async () => {
      const mockConfig = createMockModelConfig();
      const disabledConfig = { ...mockConfig, enabled: false };

      await modelManager.addModel(disabledConfig.id, disabledConfig);

      const adapter = registry.getAdapter(disabledConfig.providerMeta.id);
      const sendSpy = vi
        .spyOn(adapter, 'sendMessage')
        .mockResolvedValue({ content: 'ok' });

      await expect(service.testConnection(disabledConfig.id)).resolves.toBeUndefined();
      expect(sendSpy).toHaveBeenCalled();
    });

    it('should still reject sendMessage when model is disabled', async () => {
      const mockConfig = createMockModelConfig();
      const disabledConfig = { ...mockConfig, enabled: false };

      await modelManager.addModel(disabledConfig.id, disabledConfig);

      await expect(
        service.sendMessage([{ role: 'user', content: 'Hello' }], disabledConfig.id)
      ).rejects.toThrow(RequestConfigError);
    });
  });

  describe('fetchModelList', () => {
    it('should reject when dynamic model fetch fails instead of silently falling back to static models', async () => {
      const adapter = registry.getAdapter('openai');

      const spy = vi
        .spyOn(adapter, 'getModelsAsync')
        .mockRejectedValue(new APIError('Unauthorized'));

      await expect(
        service.fetchModelList('openai', {
          connectionConfig: {
            apiKey: 'bad-key',
            baseURL: adapter.getProvider().defaultBaseURL,
          },
        })
      ).rejects.toThrow(APIError);

      expect(spy).toHaveBeenCalled();
    });

    it('should return merged dynamic + static models when dynamic fetch succeeds', async () => {
      const adapter = registry.getAdapter('openai');
      const staticCount = adapter.getModels().length;
      const dynamicModel = adapter.buildDefaultModel('dyn-1');

      vi
        .spyOn(adapter, 'getModelsAsync')
        .mockResolvedValue([dynamicModel]);

      const models = await service.fetchModelList('openai', {
        connectionConfig: {
          apiKey: 'ok-key',
          baseURL: adapter.getProvider().defaultBaseURL,
        },
      });

      expect(models[0]?.value).toBe('dyn-1');
      expect(models).toHaveLength(staticCount + 1);
    });
  });
}); 
