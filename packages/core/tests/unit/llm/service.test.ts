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
}); 