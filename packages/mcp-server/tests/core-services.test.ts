import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MCPServerConfig } from '../src/config/environment.js';

const mocks = vi.hoisted(() => {
  const modelManager = {
    getModel: vi.fn()
  };
  const llmService = {};
  const templateManager = {};
  const historyManager = {};
  const promptService = {};
  const imageUnderstandingService = {};
  const MemoryStorageProvider = vi.fn(function MemoryStorageProvider() {});
  const setupDefaultModel = vi.fn();

  return {
    modelManager,
    llmService,
    templateManager,
    historyManager,
    promptService,
    imageUnderstandingService,
    MemoryStorageProvider,
    setupDefaultModel,
    coreModule: {
      MemoryStorageProvider,
      createModelManager: vi.fn(() => modelManager),
      createLLMService: vi.fn(() => llmService),
      createTemplateManager: vi.fn(() => templateManager),
      createHistoryManager: vi.fn(() => historyManager),
      createPromptService: vi.fn(() => promptService),
      createImageUnderstandingService: vi.fn(() => imageUnderstandingService)
    },
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  };
});

vi.mock('@prompt-optimizer/core', () => mocks.coreModule);
vi.mock('../src/config/models.js', () => ({
  setupDefaultModel: mocks.setupDefaultModel
}));
vi.mock('../src/utils/logging.js', () => mocks.logger);

import { CoreServicesManager, resolveDefaultLanguage } from '../src/adapters/core-services.js';

function resetSingleton(): void {
  (CoreServicesManager as unknown as { instance?: CoreServicesManager }).instance = undefined;
}

function createConfig(overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    httpPort: 3001,
    logLevel: 'error',
    defaultLanguage: 'zh-CN',
    preferredModelProvider: 'deepseek',
    authToken: undefined,
    allowedOrigins: ['http://127.0.0.1:3000'],
    enableDnsRebindingProtection: true,
    ...overrides
  };
}

describe('CoreServicesManager', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    resetSingleton();
    process.env = { ...originalEnv };
    delete process.env.MCP_DEFAULT_LANGUAGE;
    delete process.env.VITE_OPENAI_API_KEY;
    delete process.env.VITE_GEMINI_API_KEY;
    delete process.env.VITE_DEEPSEEK_API_KEY;
    delete process.env.VITE_ZHIPU_API_KEY;
    delete process.env.VITE_SILICONFLOW_API_KEY;
    delete process.env.VITE_CUSTOM_API_KEY;
    delete process.env.VITE_CUSTOM_API_KEY_qwen3;
    mocks.setupDefaultModel.mockResolvedValue(undefined);
    mocks.modelManager.getModel.mockResolvedValue({
      id: 'mcp-default',
      name: 'DeepSeek Chat',
      providerMeta: {
        id: 'deepseek',
        defaultBaseURL: 'https://api.deepseek.com'
      },
      modelMeta: {
        id: 'deepseek-chat'
      },
      connectionConfig: {
        baseURL: ''
      },
      enabled: true
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    resetSingleton();
  });

  it('initializes all core services once and exposes health status', async () => {
    const manager = CoreServicesManager.getInstance();

    await manager.initialize(createConfig());

    expect(manager.isInitialized()).toBe(true);
    expect(mocks.MemoryStorageProvider).toHaveBeenCalledOnce();
    expect(mocks.coreModule.createModelManager).toHaveBeenCalledOnce();
    expect(mocks.setupDefaultModel).toHaveBeenCalledWith(mocks.modelManager, 'deepseek');
    expect(mocks.coreModule.createLLMService).toHaveBeenCalledWith(mocks.modelManager);
    expect(mocks.coreModule.createTemplateManager).toHaveBeenCalled();
    expect(mocks.coreModule.createHistoryManager).toHaveBeenCalledWith(expect.anything(), mocks.modelManager);
    expect(mocks.coreModule.createPromptService).toHaveBeenCalledWith(
      mocks.modelManager,
      mocks.llmService,
      mocks.templateManager,
      mocks.historyManager,
      mocks.imageUnderstandingService
    );

    expect(manager.getModelManager()).toBe(mocks.modelManager);
    expect(manager.getTemplateManager()).toBe(mocks.templateManager);
    expect(manager.getPromptService()).toBe(mocks.promptService);
    await expect(manager.getHealthStatus()).resolves.toEqual({
      initialized: true,
      services: {
        modelManager: true,
        llmService: true,
        languageService: true,
        templateManager: true,
        historyManager: true,
        promptService: true
      }
    });
  });

  it('does not rebuild services when initialized more than once', async () => {
    const manager = CoreServicesManager.getInstance();

    await manager.initialize(createConfig());
    await manager.initialize(createConfig({ preferredModelProvider: 'openai' }));

    expect(mocks.logger.warn).toHaveBeenCalledWith('CoreServicesManager already initialized');
    expect(mocks.coreModule.createModelManager).toHaveBeenCalledOnce();
    expect(mocks.setupDefaultModel).toHaveBeenCalledOnce();
  });

  it('throws clear getter errors before initialization', async () => {
    const manager = CoreServicesManager.getInstance();

    expect(manager.isInitialized()).toBe(false);
    expect(() => manager.getModelManager()).toThrow('CoreServicesManager not initialized or ModelManager not available');
    expect(() => manager.getTemplateManager()).toThrow('CoreServicesManager not initialized or TemplateManager not available');
    expect(() => manager.getPromptService()).toThrow('CoreServicesManager not initialized or PromptService not available');
    await expect(manager.getHealthStatus()).resolves.toEqual({
      initialized: false,
      services: {
        modelManager: false,
        llmService: false,
        languageService: false,
        templateManager: false,
        historyManager: false,
        promptService: false
      }
    });
  });

  it('reports missing API key hints when default model setup fails without configured keys', async () => {
    mocks.setupDefaultModel.mockRejectedValue(new Error('No available provider'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const manager = CoreServicesManager.getInstance();

    await expect(manager.initialize(createConfig())).rejects.toThrow('Core services initialization failed: Failed to setup default model: No available provider');

    expect(mocks.logger.error).toHaveBeenCalledWith('Failed to initialize Core services', expect.any(Error));
    expect(consoleError).toHaveBeenCalledWith('💡 No API keys found. Please set at least one:');
    expect(manager.isInitialized()).toBe(false);
    consoleError.mockRestore();
  });

  it('reports configured API key hints without leaking values when setup fails', async () => {
    process.env.VITE_DEEPSEEK_API_KEY = 'secret-value';
    process.env.VITE_CUSTOM_API_KEY_qwen3 = 'custom-secret';
    mocks.setupDefaultModel.mockRejectedValue(new Error('Invalid provider credentials'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const manager = CoreServicesManager.getInstance();

    await expect(manager.initialize(createConfig())).rejects.toThrow('Core services initialization failed: Failed to setup default model: Invalid provider credentials');

    expect(consoleError).toHaveBeenCalledWith('💡 Found API keys but no models are enabled:');
    expect(consoleError).toHaveBeenCalledWith('   VITE_DEEPSEEK_API_KEY=[CONFIGURED]');
    expect(consoleError).toHaveBeenCalledWith('   VITE_CUSTOM_API_KEY_qwen3=[CONFIGURED]');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret-value');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('custom-secret');
    consoleError.mockRestore();
  });
});

describe('resolveDefaultLanguage', () => {
  afterEach(() => {
    delete process.env.MCP_DEFAULT_LANGUAGE;
  });

  it('uses config language, then environment language, then English fallback', () => {
    expect(resolveDefaultLanguage({ defaultLanguage: 'zh-CN' })).toBe('zh-CN');

    process.env.MCP_DEFAULT_LANGUAGE = 'zh-CN';
    expect(resolveDefaultLanguage({ defaultLanguage: undefined })).toBe('zh-CN');

    delete process.env.MCP_DEFAULT_LANGUAGE;
    expect(resolveDefaultLanguage({ defaultLanguage: undefined })).toBe('en-US');
  });
});
