import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModelManager, createModelManager } from '../../../src/services/model/manager';
import { IStorageProvider } from '../../../src/services/storage/types';
import { TextModelConfig } from '../../../src/services/model/types';
import { ModelConfigError } from '../../../src/services/llm/errors';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry';
import { defaultModels } from '../../../src/services/model/defaults';

describe('ModelManager', () => {
  let modelManager: ModelManager;
  let storageProvider: IStorageProvider;
  let registry: TextAdapterRegistry;

  const createTextModelConfig = (
    id: string,
    name: string,
    enabled = true,
    apiKey = 'test_api_key',
    providerId = 'openai'
  ): TextModelConfig => {
    const adapter = registry.getAdapter(providerId);
    const provider = adapter.getProvider();
    const models = adapter.getModels();

    return {
      id,
      name,
      enabled,
      providerId: provider.id,
      modelId: (models[0] || adapter.buildDefaultModel('test-model')).id,
      providerMeta: provider,
      modelMeta: models[0] || adapter.buildDefaultModel('test-model'),
      connectionConfig: {
        apiKey,
        baseURL: provider.defaultBaseURL
      },
      paramOverrides: {}
    };
  };

  beforeEach(async () => {
    // 为每个测试创建一个新的、干净的内存存储实例
    storageProvider = new MemoryStorageProvider();
    registry = new TextAdapterRegistry();
    // 清理存储状态
    await storageProvider.clearAll();
    // 使用工厂函数创建 ModelManager 实例,注入Registry
    modelManager = new ModelManager(storageProvider, registry);
  });

  afterEach(async () => {
    // 清理存储状态
    await storageProvider.clearAll();
  });

  describe('addModel', () => {
    it('should add a new model and save', async () => {
      const newModel = createTextModelConfig('newKey', 'NewModel');
      await modelManager.addModel('newKey', newModel);

      const result = await modelManager.getModel('newKey');
      expect(result).toBeDefined();
      expect(result?.name).toBe('NewModel');
    });

    it('should throw ModelConfigError when adding a model with an existing key', async () => {
      const existingModel = createTextModelConfig('existingKey', 'ExistingModel');
      await modelManager.addModel('existingKey', existingModel);

      await expect(modelManager.addModel('existingKey', createTextModelConfig('existingKey', 'DuplicateKey')))
        .rejects.toThrow(ModelConfigError);
    });

    it('should throw ModelConfigError when adding a model with invalid config', async () => {
      const invalidModel = { ...createTextModelConfig('invalidKey', 'Invalid'), id: '' };

      await expect(modelManager.addModel('invalidKey', invalidModel as TextModelConfig))
        .rejects.toThrow(ModelConfigError);
    });

    it('should reject provider/model metadata mismatches', async () => {
      const openaiModel = createTextModelConfig('badKey', 'BadModel', true, 'test_api_key', 'openai');
      const compatibleProvider = registry.getAdapter('openai-compatible').getProvider();
      const invalidModel: TextModelConfig = {
        ...openaiModel,
        providerId: undefined,
        modelId: undefined,
        providerMeta: compatibleProvider
      };

      await expect(modelManager.addModel('badKey', invalidModel))
        .rejects.toThrow(ModelConfigError);
    });
  });
  
  describe('getAllModels', () => {
    it('should return all models including their keys', async () => {
      const model = createTextModelConfig('testKey', 'TestModel');
      await modelManager.addModel('testKey', model);

      const result = await modelManager.getAllModels();
      expect(result.some(m => m.id === 'testKey')).toBe(true);
    });

    it('should return default models after initialization', async () => {
      const result = await modelManager.getAllModels();
      // 检查是否包含默认模型
      expect(result.length).toBeGreaterThan(0);

      // 检查是否包含一个已知的默认模型
      const defaultKeys = Object.keys(defaultModels);
      if (defaultKeys.length > 0) {
        const firstDefaultKey = defaultKeys[0];
        expect(result.some(m => m.id === firstDefaultKey)).toBe(true);
      }
    });
  });

  describe('initialization behavior', () => {
    it('should migrate exact legacy builtin defaults while preserving connection settings', async () => {
      const existing = await modelManager.getModel('openai')
      expect(existing).toBeDefined()

      const legacyOpenAI: TextModelConfig = {
        ...existing!,
        modelId: 'gpt-5-mini',
        modelMeta: {
          ...existing!.modelMeta,
          id: 'gpt-5-mini',
          name: 'GPT-5 Mini'
        },
        connectionConfig: {
          ...existing!.connectionConfig,
          baseURL: 'https://custom-openai.example/v1'
        }
      }
      await storageProvider.setItem('models', JSON.stringify({ openai: legacyOpenAI }))

      const reloadedManager = new ModelManager(storageProvider, new TextAdapterRegistry())
      const reloaded = await reloadedManager.getModel('openai')

      expect(reloaded?.modelId).toBe('gpt-5.6-terra')
      expect(reloaded?.modelMeta.id).toBe('gpt-5.6-terra')
      expect(reloaded?.paramOverrides.reasoning_effort).toBe('none')
      expect(reloaded?.connectionConfig.baseURL).toBe('https://custom-openai.example/v1')
    })

    it('should not migrate a legacy model id stored under a custom config key', async () => {
      const existing = await modelManager.getModel('openai')
      expect(existing).toBeDefined()
      const custom = {
        ...existing!,
        id: 'custom-openai-legacy',
        name: 'Custom Legacy OpenAI',
        modelId: 'gpt-5-mini',
        modelMeta: {
          ...existing!.modelMeta,
          id: 'gpt-5-mini',
          name: 'GPT-5 Mini'
        }
      }
      await modelManager.addModel(custom.id, custom)

      const reloadedManager = new ModelManager(storageProvider, new TextAdapterRegistry())
      const reloaded = await reloadedManager.getModel(custom.id)

      expect(reloaded?.modelId).toBe('gpt-5-mini')
      expect(reloaded?.modelMeta.id).toBe('gpt-5-mini')
    })

    it('should backfill missing builtin apiKey when env key becomes available for an enabled model', async () => {
      const originalGeminiKey = process.env.VITE_GEMINI_API_KEY
      process.env.VITE_GEMINI_API_KEY = 'env_gemini_key'

      try {
        const existing = await modelManager.getModel('gemini')
        expect(existing).toBeDefined()

        const storedGemini: TextModelConfig = {
          ...existing!,
          enabled: true,
          connectionConfig: {
            ...existing!.connectionConfig,
            apiKey: ''
          }
        }

        await storageProvider.setItem('models', JSON.stringify({ gemini: storedGemini }))

        const reloadedManager = new ModelManager(storageProvider, new TextAdapterRegistry())
        const reloaded = await reloadedManager.getModel('gemini')

        expect(reloaded?.enabled).toBe(true)
        expect(reloaded?.connectionConfig.apiKey).toBe('env_gemini_key')
      } finally {
        if (originalGeminiKey === undefined) {
          delete process.env.VITE_GEMINI_API_KEY
        } else {
          process.env.VITE_GEMINI_API_KEY = originalGeminiKey
        }
      }
    })

    it('should auto-enable cloudflare when missing required connection fields become available from env', async () => {
      const originalCloudflareToken = process.env.VITE_CF_API_TOKEN
      const originalCloudflareAccountId = process.env.VITE_CF_ACCOUNT_ID
      process.env.VITE_CF_API_TOKEN = 'env_cloudflare_token'
      process.env.VITE_CF_ACCOUNT_ID = 'env_cloudflare_account'

      try {
        const existing = await modelManager.getModel('cloudflare')
        expect(existing).toBeDefined()

        const storedCloudflare: TextModelConfig = {
          ...existing!,
          enabled: false,
          connectionConfig: {
            ...existing!.connectionConfig,
            apiKey: '',
            accountId: ''
          }
        }

        await storageProvider.setItem('models', JSON.stringify({ cloudflare: storedCloudflare }))

        const reloadedManager = new ModelManager(storageProvider, new TextAdapterRegistry())
        const reloaded = await reloadedManager.getModel('cloudflare')

        expect(reloaded?.enabled).toBe(true)
        expect(reloaded?.connectionConfig.apiKey).toBe('env_cloudflare_token')
        expect(reloaded?.connectionConfig.accountId).toBe('env_cloudflare_account')
      } finally {
        if (originalCloudflareToken === undefined) {
          delete process.env.VITE_CF_API_TOKEN
        } else {
          process.env.VITE_CF_API_TOKEN = originalCloudflareToken
        }

        if (originalCloudflareAccountId === undefined) {
          delete process.env.VITE_CF_ACCOUNT_ID
        } else {
          process.env.VITE_CF_ACCOUNT_ID = originalCloudflareAccountId
        }
      }
    })

    it('should not overwrite existing model metadata or connection settings when reinitialized', async () => {
      const targetId = 'openai';
      const existing = await modelManager.getModel(targetId);
      expect(existing).toBeDefined();

      const customProviderMeta = {
        ...existing!.providerMeta,
        name: 'Custom Provider Name'
      };

      const customModelMeta = {
        ...existing!.modelMeta,
        id: 'custom-openai-model',
        name: 'Custom OpenAI Model'
      };

      const customBaseURL = 'https://custom-openai.example.com/v1';

      await modelManager.updateModel(targetId, {
        providerMeta: customProviderMeta,
        modelMeta: customModelMeta,
        connectionConfig: {
          ...existing!.connectionConfig,
          baseURL: customBaseURL
        }
      });

      const secondRegistry = new TextAdapterRegistry();
      const reloadedManager = new ModelManager(storageProvider, secondRegistry);
      const reloaded = await reloadedManager.getModel(targetId);

      expect(reloaded?.providerMeta.name).toBe('Custom Provider Name');
      expect(reloaded?.modelMeta.id).toBe('custom-openai-model');
      expect(reloaded?.modelMeta.name).toBe('Custom OpenAI Model');
      expect(reloaded?.connectionConfig.baseURL).toBe(customBaseURL);
    });

    it('should migrate builtin DeepSeek chat config to V4 Flash with thinking disabled', async () => {
      const existing = await modelManager.getModel('deepseek')
      expect(existing).toBeDefined()

      const legacyDeepseek: TextModelConfig = {
        ...existing!,
        modelMeta: {
          ...existing!.modelMeta,
          id: 'deepseek-chat',
          name: 'DeepSeek Chat',
          defaultParameterValues: {}
        },
        paramOverrides: {
          temperature: 0.3
        }
      }

      await storageProvider.setItem('models', JSON.stringify({ deepseek: legacyDeepseek }))

      const reloadedManager = new ModelManager(storageProvider, new TextAdapterRegistry())
      const reloaded = await reloadedManager.getModel('deepseek')

      expect(reloaded?.modelMeta.id).toBe('deepseek-v4-flash')
      expect(reloaded?.paramOverrides).toEqual({
        temperature: 0.3,
        thinking_type: 'disabled'
      })
      expect(reloaded?.modelMeta.parameterDefinitions.map((definition) => definition.name)).toContain('thinking_type')
    })

    it('should migrate builtin DeepSeek reasoner config to V4 Pro with thinking enabled', async () => {
      const existing = await modelManager.getModel('deepseek')
      expect(existing).toBeDefined()

      const legacyDeepseekReasoner: TextModelConfig = {
        ...existing!,
        modelMeta: {
          ...existing!.modelMeta,
          id: 'deepseek-reasoner',
          name: 'DeepSeek Reasoner',
          defaultParameterValues: {}
        },
        paramOverrides: {}
      }

      await storageProvider.setItem('models', JSON.stringify({ deepseek: legacyDeepseekReasoner }))

      const reloadedManager = new ModelManager(storageProvider, new TextAdapterRegistry())
      const reloaded = await reloadedManager.getModel('deepseek')

      expect(reloaded?.modelMeta.id).toBe('deepseek-v4-pro')
      expect(reloaded?.paramOverrides).toEqual({
        thinking_type: 'enabled',
        reasoning_effort: 'high'
      })
    })

    it('should preserve custom DeepSeek model id while patching DeepSeek parameters', async () => {
      const existing = await modelManager.getModel('deepseek')
      expect(existing).toBeDefined()

      const customDeepseek: TextModelConfig = {
        ...existing!,
        id: 'custom-deepseek',
        name: 'Custom DeepSeek',
        modelId: 'custom-deepseek-model',
        modelMeta: {
          ...existing!.modelMeta,
          id: 'custom-deepseek-model',
          name: 'Custom DeepSeek Model',
          parameterDefinitions: [],
          defaultParameterValues: {}
        },
        paramOverrides: {}
      }

      await modelManager.addModel('custom-deepseek', customDeepseek)

      const reloaded = await modelManager.getModel('custom-deepseek')

      expect(reloaded?.modelMeta.id).toBe('custom-deepseek-model')
      expect(reloaded?.modelMeta.parameterDefinitions.map((definition) => definition.name)).toContain('thinking_type')
      expect(reloaded?.paramOverrides).toEqual({
        thinking_type: 'disabled'
      })
    })
  });

  describe('provider metadata patching', () => {
    it('should backfill providerMeta.corsRestricted for stored configs missing it', async () => {
      const baseAdapter = registry.getAdapter('openai')
      const baseProvider = baseAdapter.getProvider()
      const models = baseAdapter.getModels()
      const mockRegistry = {
        getAdapter: vi.fn().mockReturnValue({
          getProvider: () => ({
            ...baseProvider,
            id: 'test-provider',
            name: 'Test Provider',
            corsRestricted: true
          })
        })
      } as any
      const localManager = new ModelManager(storageProvider, mockRegistry)

      // Simulate legacy stored providerMeta without the newly added field.
      // Also tweak the name to ensure we don't overwrite user-customized metadata.
      const { corsRestricted: _ignored, ...providerWithoutCors } = {
        ...baseProvider,
        id: 'test-provider',
        name: 'Test Provider',
        corsRestricted: true
      }

      const legacyConfig: TextModelConfig = {
        id: 'legacy-test-provider',
        name: 'Legacy Test Provider',
        enabled: true,
        providerMeta: {
          ...providerWithoutCors,
          name: 'Legacy Provider Name'
        },
        modelMeta: {
          ...(models[0] || baseAdapter.buildDefaultModel('test-model')),
          providerId: 'test-provider'
        },
        connectionConfig: {
          apiKey: 'test_api_key',
          baseURL: baseProvider.defaultBaseURL
        },
        paramOverrides: {}
      }

      await localManager.addModel('legacy-test-provider', legacyConfig)

      const reloaded = await localManager.getModel('legacy-test-provider')
      expect(reloaded?.providerMeta.name).toBe('Legacy Provider Name')
      expect(reloaded?.providerMeta.corsRestricted).toBe(true)
    })

    it('should not override providerMeta.corsRestricted when already set', async () => {
      const baseAdapter = registry.getAdapter('openai')
      const baseProvider = baseAdapter.getProvider()
      const models = baseAdapter.getModels()
      const mockRegistry = {
        getAdapter: vi.fn().mockReturnValue({
          getProvider: () => ({
            ...baseProvider,
            id: 'test-provider',
            name: 'Test Provider',
            corsRestricted: false
          })
        })
      } as any
      const localManager = new ModelManager(storageProvider, mockRegistry)

      const customConfig: TextModelConfig = {
        id: 'custom-test-provider',
        name: 'Custom Test Provider',
        enabled: true,
        providerMeta: {
          ...baseProvider,
          id: 'test-provider',
          name: 'Test Provider',
          corsRestricted: true
        },
        modelMeta: {
          ...(models[0] || baseAdapter.buildDefaultModel('test-model')),
          providerId: 'test-provider'
        },
        connectionConfig: {
          apiKey: 'test_api_key',
          baseURL: baseProvider.defaultBaseURL
        },
        paramOverrides: {}
      }

      await localManager.addModel('custom-test-provider', customConfig)

      const reloaded = await localManager.getModel('custom-test-provider')
      expect(reloaded?.providerMeta.corsRestricted).toBe(true)
    })
  })

  describe('getModel', () => {
    it('should retrieve an existing model by key', async () => {
      const model = createTextModelConfig('MyModel', 'MyModel');
      await modelManager.addModel('myKey', model);
      
      const result = await modelManager.getModel('myKey');
      expect(result).toEqual(model);
    });

    it('should return undefined for a non-existent model key', async () => {
      const result = await modelManager.getModel('nonExistentKey');
      expect(result).toBeUndefined();
    });
  });

  describe('updateModel', () => {
    it('should update an existing model and save', async () => {
      const originalModel = createTextModelConfig('OriginalName', 'OriginalName');
      await modelManager.addModel('updateKey', originalModel);
      
      const updates: Partial<TextModelConfig> = {
        name: 'UpdatedName',
        connectionConfig: {
          apiKey: 'new_api_key'
        }
      };
      
      await modelManager.updateModel('updateKey', updates);
      
      const updatedModel = await modelManager.getModel('updateKey');
      expect(updatedModel?.name).toBe('UpdatedName');
      expect(updatedModel?.connectionConfig.apiKey).toBe('new_api_key');
    });

    it('should throw ModelConfigError when updating a non-existent model', async () => {
      await expect(modelManager.updateModel('nonExistentKey', { name: 'NewName' }))
        .rejects.toThrow(ModelConfigError);
    });

    it('should reject updates that leave provider and model metadata out of sync', async () => {
      const originalModel = createTextModelConfig('updateMismatchKey', 'OriginalName', true, 'test_api_key', 'openai');
      await modelManager.addModel('updateMismatchKey', originalModel);

      await expect(modelManager.updateModel('updateMismatchKey', {
        providerMeta: registry.getAdapter('openai-compatible').getProvider()
      })).rejects.toThrow(ModelConfigError);
    });

    it('should resolve metadata from providerId/modelId identity updates', async () => {
      const originalModel = createTextModelConfig('identityUpdateKey', 'OriginalName', true, 'test_api_key', 'openai');
      await modelManager.addModel('identityUpdateKey', originalModel);

      await modelManager.updateModel('identityUpdateKey', {
        providerId: 'openai-compatible',
        modelId: 'vendor-custom-model'
      });

      const updated = await modelManager.getModel('identityUpdateKey');
      expect(updated?.providerId).toBe('openai-compatible');
      expect(updated?.providerMeta.id).toBe('openai-compatible');
      expect(updated?.modelId).toBe('vendor-custom-model');
      expect(updated?.modelMeta.id).toBe('vendor-custom-model');
      expect(updated?.modelMeta.providerId).toBe('openai-compatible');
    });

    it('should repair stale stored metadata when explicit identity fields exist', async () => {
      const originalModel = createTextModelConfig('staleStoredKey', 'OriginalName', true, 'test_api_key', 'openai');
      await storageProvider.setItem('models', JSON.stringify({
        staleStoredKey: {
          ...originalModel,
          providerId: 'openai-compatible',
          modelId: 'vendor-custom-model'
        }
      }));

      const updated = await modelManager.getModel('staleStoredKey');

      expect(updated?.providerId).toBe('openai-compatible');
      expect(updated?.providerMeta.id).toBe('openai-compatible');
      expect(updated?.modelId).toBe('vendor-custom-model');
      expect(updated?.modelMeta.providerId).toBe('openai-compatible');
    });

    it('should import identity-only text model configs by resolving metadata', async () => {
      await modelManager.importData([{
        id: 'identity-import',
        name: 'Identity Import',
        enabled: true,
        providerId: 'openai-compatible',
        modelId: 'imported-custom-model',
        connectionConfig: {
          apiKey: 'import-key',
          baseURL: 'https://gateway.example.com/v1'
        },
        paramOverrides: {}
      }]);

      const imported = await modelManager.getModel('identity-import');
      expect(imported?.providerMeta.id).toBe('openai-compatible');
      expect(imported?.modelMeta.id).toBe('imported-custom-model');
      expect(imported?.modelMeta.providerId).toBe('openai-compatible');

      const exported = await modelManager.exportData();
      const exportedImport = exported.find(config => config.id === 'identity-import');
      expect(exportedImport?.providerId).toBe('openai-compatible');
      expect(exportedImport?.modelId).toBe('imported-custom-model');
      expect(exportedImport?.providerMeta.id).toBe('openai-compatible');
      expect(exportedImport?.modelMeta.providerId).toBe('openai-compatible');
    });

    it('should isolate malformed metadata configs instead of failing the full model list', async () => {
      await storageProvider.setItem('models', JSON.stringify({
        custom_broken: {
          id: 'custom_broken',
          name: 'Broken Model',
          enabled: true,
          providerMeta: {},
          modelMeta: {},
          connectionConfig: {
            apiKey: 'keep-key',
            baseURL: 'https://broken.example.com/v1'
          },
          paramOverrides: {
            temperature: 0.2
          }
        },
        openai: createTextModelConfig('openai', 'OpenAI')
      }));

      const allModels = await modelManager.getAllModels();
      const broken = allModels.find(model => model.id === 'custom_broken');
      const enabled = await modelManager.getEnabledModels();

      expect(broken).toBeDefined();
      expect(broken?.enabled).toBe(false);
      expect(broken?.providerId).toBe('unknown');
      expect(broken?.modelId).toBe('unknown');
      expect(broken?.connectionConfig.apiKey).toBe('keep-key');
      expect(broken?.paramOverrides).toEqual({ temperature: 0.2 });
      expect(enabled.some(model => model.id === 'custom_broken')).toBe(false);
      expect(allModels.some(model => model.id === 'openai')).toBe(true);
    });

    it('should repair malformed builtin custom config from defaults while preserving user settings', async () => {
      await storageProvider.setItem('models', JSON.stringify({
        custom: {
          id: 'custom',
          name: 'My Custom Gateway',
          enabled: true,
          providerMeta: {},
          modelMeta: {},
          connectionConfig: {
            apiKey: 'keep-custom-key',
            baseURL: 'https://gateway.example.com/v1'
          },
          paramOverrides: {
            temperature: 0.2
          }
        }
      }));

      const repaired = await modelManager.getModel('custom');

      expect(repaired?.enabled).toBe(true);
      expect(repaired?.name).toBe('My Custom Gateway');
      expect(repaired?.providerId).toBe('openai-compatible');
      expect(repaired?.providerMeta.id).toBe('openai-compatible');
      expect(repaired?.modelId).toBeTruthy();
      expect(repaired?.modelId).not.toBe('unknown');
      expect(repaired?.modelMeta.id).toBe(repaired?.modelId);
      expect(repaired?.modelMeta.providerId).toBe('openai-compatible');
      expect(repaired?.connectionConfig.apiKey).toBe('keep-custom-key');
      expect(repaired?.connectionConfig.baseURL).toBe('https://gateway.example.com/v1');
      expect(repaired?.paramOverrides).toEqual({ temperature: 0.2 });
    });

    it('should preserve partial builtin custom identity and legacy custom parameter overrides during repair', async () => {
      await storageProvider.setItem('models', JSON.stringify({
        custom: {
          id: 'custom',
          name: 'Partial Custom Gateway',
          enabled: true,
          providerMeta: {},
          modelMeta: {
            id: 'user-selected-model'
          },
          connectionConfig: {
            apiKey: 'keep-custom-key',
            baseURL: 'https://gateway.example.com/v1'
          },
          customParamOverrides: {
            temperature: 0.3,
            top_p: 0.8
          }
        }
      }));

      const repaired = await modelManager.getModel('custom');

      expect(repaired?.providerId).toBe('openai-compatible');
      expect(repaired?.modelId).toBe('user-selected-model');
      expect(repaired?.modelMeta.id).toBe('user-selected-model');
      expect(repaired?.modelMeta.providerId).toBe('openai-compatible');
      expect(repaired?.connectionConfig.apiKey).toBe('keep-custom-key');
      expect(repaired?.paramOverrides).toMatchObject({
        temperature: 0.3,
        top_p: 0.8
      });
    });

    it('should return a disabled placeholder for a single malformed model config', async () => {
      await storageProvider.setItem('models', JSON.stringify({
        brokenSingle: {
          id: 'brokenSingle',
          name: 'Broken Single',
          providerMeta: {},
          modelMeta: {},
          connectionConfig: {}
        }
      }));

      const broken = await modelManager.getModel('brokenSingle');

      expect(broken?.id).toBe('brokenSingle');
      expect(broken?.enabled).toBe(false);
      expect(broken?.providerMeta.id).toBe('unknown');
      expect(broken?.modelMeta.id).toBe('unknown');
    });
  });

  describe('deleteModel', () => {
    it('should delete an existing model', async () => {
      const model = createTextModelConfig('DeleteMe', 'DeleteMe');
      await modelManager.addModel('deleteKey', model);
      
      await modelManager.deleteModel('deleteKey');
      
      const modelAfterDelete = await modelManager.getModel('deleteKey');
      expect(modelAfterDelete).toBeUndefined();
    });

    it('should not fail when deleting a non-existent model', async () => {
      await expect(modelManager.deleteModel('nonExistentKey'))
        .rejects.toThrow(ModelConfigError);
    });
  });

  describe('enableModel & disableModel', () => {
    it('should enable a disabled model', async () => {
      const disabledModel = createTextModelConfig('DisabledModel', 'DisabledModel', false);
      await modelManager.addModel('disabledKey', disabledModel);
      
      await modelManager.enableModel('disabledKey');
      
      const model = await modelManager.getModel('disabledKey');
      expect(model?.enabled).toBe(true);
    });

    it('should disable an enabled model', async () => {
      const enabledModel = createTextModelConfig('EnabledModel', 'EnabledModel', true);
      await modelManager.addModel('enabledKey', enabledModel);
      
      await modelManager.disableModel('enabledKey');
      
      const model = await modelManager.getModel('enabledKey');
      expect(model?.enabled).toBe(false);
    });
  });

  describe('getEnabledModels', () => {
    it('should return only enabled models', async () => {
      // The beforeEach hook now provides a clean, initialized modelManager for each test.
      const enabledModel1 = createTextModelConfig('test-enabled-1', 'EnabledModel1', true);
      const enabledModel2 = createTextModelConfig('test-enabled-2', 'EnabledModel2', true);
      const disabledModel = createTextModelConfig('test-disabled', 'DisabledModel', false);

      // Add models to the manager instance for this test
      await modelManager.addModel('test-enabled-1', enabledModel1);
      await modelManager.addModel('test-enabled-2', enabledModel2);
      await modelManager.addModel('test-disabled', disabledModel);

      const enabledModels = await modelManager.getEnabledModels();

      // Default models might also be enabled, so we check for at least 2
      expect(enabledModels.length).toBeGreaterThanOrEqual(2);

      // Verify our specific enabled models are present
      const enabledModel1Found = enabledModels.find(m => m.id === 'test-enabled-1');
      const enabledModel2Found = enabledModels.find(m => m.id === 'test-enabled-2');
      expect(enabledModel1Found).toBeDefined();
      expect(enabledModel1Found?.name).toBe('EnabledModel1');
      expect(enabledModel2Found).toBeDefined();

      // Verify our specific disabled model is not present
      const disabledModelInResults = enabledModels.find(m => m.id === 'test-disabled');
      expect(disabledModelInResults).toBeUndefined();
    });
  });

  describe('paramOverrides deep copy', () => {
    it('should deep copy paramOverrides to avoid reference sharing when adding models', async () => {
      const originalLlmParams = {
        temperature: 0.7,
        max_tokens: 4096
      };
      
      const modelConfig = createTextModelConfig('TestModel', 'TestModel', true, 'test_key', 'openai');
      modelConfig.paramOverrides = originalLlmParams;

      await modelManager.addModel('test-model', modelConfig);
      
      // Modify the original paramOverrides
      originalLlmParams.temperature = 0.9;
      originalLlmParams.max_tokens = 2048;
      
      // Get the stored model and verify it wasn't affected
      const storedModel = await modelManager.getModel('test-model');
      expect(storedModel?.paramOverrides?.temperature).toBe(0.7);
      expect(storedModel?.paramOverrides?.max_tokens).toBe(4096);
    });

    it('should deep copy paramOverrides when updating models', async () => {
      const initialModel = createTextModelConfig('TestModel', 'TestModel', true);
      await modelManager.addModel('test-model', initialModel);

      const updateLlmParams = {
        temperature: 0.5,
        top_p: 0.9
      };

      await modelManager.updateModel('test-model', {
        paramOverrides: updateLlmParams
      });

      // Modify the original update params
      updateLlmParams.temperature = 1.0;
      updateLlmParams.top_p = 0.5;

      // Get the stored model and verify it wasn't affected
      const storedModel = await modelManager.getModel('test-model');
      expect(storedModel?.paramOverrides?.temperature).toBe(0.5);
      expect(storedModel?.paramOverrides?.top_p).toBe(0.9);
    });

    it('should handle undefined paramOverrides gracefully', async () => {
      const modelConfig = createTextModelConfig('TestModel', 'TestModel', true);
      // Explicitly set paramOverrides to undefined
      modelConfig.paramOverrides = undefined;

      await modelManager.addModel('test-model', modelConfig);
      
      const storedModel = await modelManager.getModel('test-model');
      expect(storedModel?.paramOverrides).toBeUndefined();
    });
  });

  describe('paramOverrides security validation', () => {
    it('should reject dangerous parameters when adding models', async () => {
      const modelWithDangerousParams = createTextModelConfig('DangerousModel', 'DangerousModel', true, 'test_key', 'openai');
      modelWithDangerousParams.paramOverrides = {
        temperature: 0.7,
        __proto__: { malicious: 'code' }, // Dangerous parameter
        constructor: function() { return 'hack'; } // Another dangerous parameter
      };

      await expect(modelManager.addModel('dangerous-model', modelWithDangerousParams))
        .rejects.toThrow(ModelConfigError);
    });

    it('should reject invalid parameter types when adding models', async () => {
      const modelWithInvalidTypes = createTextModelConfig('InvalidModel', 'InvalidModel', true, 'test_key', 'openai');
      modelWithInvalidTypes.paramOverrides = {
        temperature: 'invalid_string', // Should be number
        max_tokens: 1024.5 // Should be integer
      };

      await expect(modelManager.addModel('invalid-model', modelWithInvalidTypes))
        .rejects.toThrow(ModelConfigError);
    });

    it('should reject out-of-range parameters when adding models', async () => {
      const modelWithOutOfRangeParams = createTextModelConfig('OutOfRangeModel', 'OutOfRangeModel', true, 'test_key', 'openai');
      modelWithOutOfRangeParams.paramOverrides = {
        temperature: 5.0, // Exceeds maximum 2.0
        presence_penalty: -3.0 // Below minimum -2.0
      };

      await expect(modelManager.addModel('out-of-range-model', modelWithOutOfRangeParams))
        .rejects.toThrow(ModelConfigError);
    });

    it('should accept valid parameters when adding models', async () => {
      const modelWithValidParams = createTextModelConfig('ValidModel', 'ValidModel', true, 'test_key', 'openai');
      modelWithValidParams.paramOverrides = {
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 0.9,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      };

      await expect(modelManager.addModel('valid-model', modelWithValidParams))
        .resolves.not.toThrow();
      
      const storedModel = await modelManager.getModel('valid-model');
      expect(storedModel?.paramOverrides).toEqual(modelWithValidParams.paramOverrides);
    });

    it('should validate paramOverrides when updating models', async () => {
      const initialModel = createTextModelConfig('TestModel', 'TestModel', true, 'test_key', 'openai');
      await modelManager.addModel('test-model', initialModel);

      // Try to update with dangerous parameters
      await expect(modelManager.updateModel('test-model', {
        paramOverrides: {
          temperature: 0.5,
          eval: 'malicious_code()' // Dangerous parameter
        }
      })).rejects.toThrow(ModelConfigError);
    });

    it('should validate provider-specific parameters', async () => {
      const geminiModel = createTextModelConfig('GeminiModel', 'GeminiModel', true, 'test_key', 'gemini');
      geminiModel.paramOverrides = {
        temperature: 0.8,
        maxOutputTokens: 2048,
        topK: 40,
        topP: 0.9,
        stopSequences: ['END', 'STOP']
      };

      await expect(modelManager.addModel('gemini-model', geminiModel))
        .resolves.not.toThrow();
      
      const storedModel = await modelManager.getModel('gemini-model');
      expect(storedModel?.paramOverrides).toEqual(geminiModel.paramOverrides);
    });
  });
});
