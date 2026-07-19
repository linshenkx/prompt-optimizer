import { ref, shallowRef, onMounted, type Ref } from 'vue'

import {
  StorageFactory,
  STARTUP_REPAIR_REPORT_PREFERENCE_KEY,
  createModelManager,
  createTemplateManager,
  createHistoryManager,
  createDataManager,
  createLLMService,
  createPromptService,
  createTemplateLanguageService,
  createCompareService,
  createContextRepo,
  createEvaluationService,
  createImageUnderstandingService,
  createVariableExtractionService,
  createVariableValueGenerationService,
  isRunningInElectron,
  createPreferenceService,
  FavoriteManager,
  createImageModelManager,
  createImageService,
  createImageAdapterRegistry,
  createTextAdapterRegistry,
  createImageStorageService,
  runStorageStartupSafetyCheck,
  writeStartupRepairReport,
  // migrateLegacySessions - 已移除，session 是本次重构新引入
  type IImageModelManager,
  type IImageService,
  type ITextAdapterRegistry,
  type IModelManager,
  type ITemplateManager,
  type IHistoryManager,
  type ILLMService,
  type IPromptService,
  type IDataManager,
  type IPreferenceService,
  type IFavoriteManager,
  type IEvaluationService,
  type IVariableExtractionService,
  type IVariableValueGenerationService,
  type IImageStorageService,
  type StartupRepairReport,
  type ContextMode,
  DEFAULT_CONTEXT_MODE
} from '@prompt-optimizer/core';
import type { AppServices } from '../../types/services';
import { scheduleImageStorageGc } from '../../stores/session/imageStorageMaintenance'
import {
  attachFavoriteAssetGc,
  runFavoriteAssetGc,
} from '../../utils/favorite-asset-maintenance'
import { autoEnableChromeBuiltInModelIfReady } from '../../utils/chrome-built-in-auto-enable'

const appendStartupRepairReport = (
  currentReport: StartupRepairReport | null,
  nextAction: StartupRepairReport['actions'][number],
): StartupRepairReport => ({
  checkedAt: currentReport?.checkedAt ?? Date.now(),
  actions: [...(currentReport?.actions || []), nextAction],
})

const consumeStartupRepairReport = async (
  preferenceService: IPreferenceService,
): Promise<StartupRepairReport | null> => {
  const report = await preferenceService.get<StartupRepairReport | null>(
    STARTUP_REPAIR_REPORT_PREFERENCE_KEY,
    null,
  )

  if (report) {
    await preferenceService.delete(STARTUP_REPAIR_REPORT_PREFERENCE_KEY)
  }

  return report
}

/**
 * 应用服务统一初始化器。
 * 负责根据运行环境（Web 或 Electron）创建和初始化所有核心服务。
 * @returns { services, isInitializing, error }
 */
export function useAppInitializer(): {
  services: Ref<AppServices | null>;
  isInitializing: Ref<boolean>;
  error: Ref<Error | null>;
  startupRepairReport: Ref<StartupRepairReport | null>;
} {
  const services = shallowRef<AppServices | null>(null);
  const isInitializing = ref(true);
  const error = ref<Error | null>(null);
  const startupRepairReport = ref<StartupRepairReport | null>(null);

  onMounted(async () => {
    try {
      console.log('[AppInitializer] Starting application initialization...');


      let modelManager: IModelManager;
      let templateManager: ITemplateManager;
      let historyManager: IHistoryManager;
      let dataManager: IDataManager;
      let llmService: ILLMService;
      let promptService: IPromptService;
      let preferenceService: IPreferenceService;
      let favoriteManager: IFavoriteManager;
      let evaluationService: IEvaluationService | undefined;
      let variableExtractionService: IVariableExtractionService | undefined;
      let variableValueGenerationService: IVariableValueGenerationService | undefined;
      let imageModelManager: IImageModelManager | undefined;
      let imageService: IImageService | undefined;
      let imageAdapterRegistryInstance: ReturnType<typeof createImageAdapterRegistry> | undefined;
      let imageStorageService: IImageStorageService | undefined;
      let favoriteImageStorageService: IImageStorageService | undefined;
      let textAdapterRegistryInstance: ITextAdapterRegistry | undefined;

      if (isRunningInElectron()) {
        console.log('[AppInitializer] Electron environment detected; waiting for API readiness...');

        const {
          ElectronContextRepoProxy,
          ElectronDataManagerProxy,
          ElectronHistoryManagerProxy,
          ElectronImageModelManagerProxy,
          ElectronImageServiceProxy,
          ElectronImageUnderstandingServiceProxy,
          ElectronLLMProxy,
          ElectronModelManagerProxy,
          ElectronPreferenceServiceProxy,
          ElectronPromptServiceProxy,
          ElectronTemplateLanguageServiceProxy,
          ElectronTemplateManagerProxy,
          FavoriteManagerElectronProxy,
          waitForElectronApi,
        } = await import('@prompt-optimizer/core/electron')
        
        // 等待 Electron API 完全就绪
        const apiReady = await waitForElectronApi();
        if (!apiReady) {
          throw new Error('Electron API initialization timed out. Please verify that the preload script loaded correctly.')
        }
        
        console.log('[AppInitializer] Electron API is ready; initializing proxy services...');

        // 在Electron环境中，不需要storageProvider
        // 所有存储操作都通过各个manager的代理完成

        // 在Electron环境中，我们实例化所有轻量级的代理类
        modelManager = new ElectronModelManagerProxy();
        templateManager = new ElectronTemplateManagerProxy();
        historyManager = new ElectronHistoryManagerProxy();
        llmService = new ElectronLLMProxy();
        promptService = new ElectronPromptServiceProxy();
        preferenceService = new ElectronPreferenceServiceProxy();
        startupRepairReport.value = await consumeStartupRepairReport(preferenceService)

        // 文本模型适配器注册表（本地实例，不需要代理）
        textAdapterRegistryInstance = createTextAdapterRegistry();

        // 图像相关（Electron 渲染进程代理）
        imageAdapterRegistryInstance = createImageAdapterRegistry();
        imageModelManager = new ElectronImageModelManagerProxy();
        imageService = new ElectronImageServiceProxy();

        // 🆕 图像存储服务：Electron 渲染进程同样使用 IndexedDB（与 Web 行为一致）
        console.log('[AppInitializer] Initializing image storage service (Electron)...');
        imageStorageService = createImageStorageService({
          maxCacheSize: 50 * 1024 * 1024,  // 50 MB
          maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 天
          maxCount: 100,                     // 最多 100 张
          autoCleanupThreshold: 0.8,         // 达到 80% 时触发清理
          dbName: 'PromptOptimizerImageDB',
        });

        // 收藏快照图像存储（独立数据库，避免与 session 图片清理策略耦合）
        favoriteImageStorageService = createImageStorageService({
          maxCacheSize: 200 * 1024 * 1024,      // 200 MB
          maxAge: undefined,
          maxCount: 1000,
          quotaStrategy: 'reject',
          dbName: 'PromptOptimizerFavoriteImageDB',
        });

        // DataManager在Electron环境下使用代理模式
        dataManager = new ElectronDataManagerProxy();

        // 使用真正的 Electron 模板语言服务代理
        const templateLanguageService = new ElectronTemplateLanguageServiceProxy();

        // 创建 CompareService（直接使用，无需代理）
        const compareService = createCompareService();

        // 使用 ElectronContextRepoProxy 代替临时方案
        const contextRepo = new ElectronContextRepoProxy();

        // 创建收藏管理器代理
        favoriteManager = new FavoriteManagerElectronProxy();
        favoriteManager = attachFavoriteAssetGc(favoriteManager, favoriteImageStorageService)

        if (favoriteImageStorageService) {
          const favoriteAssetGcResult = await runFavoriteAssetGc(
            favoriteManager,
            favoriteImageStorageService,
          )
          if (favoriteAssetGcResult.deletedIds.length > 0) {
            startupRepairReport.value = appendStartupRepairReport(startupRepairReport.value, {
              key: 'PromptOptimizerFavoriteImageDB',
              action: 'removed',
              reason: 'orphan_assets_removed',
              deletedCount: favoriteAssetGcResult.deletedIds.length,
            })
          }
        }

        // 🆕 创建评估服务（使用代理的 llmService, modelManager, templateManager）
        evaluationService = createEvaluationService(llmService, modelManager, templateManager, {
          imageStorageService,
          imageUnderstandingService: new ElectronImageUnderstandingServiceProxy(),
        });

        // 🆕 创建变量提取服务（使用代理的 llmService, modelManager, templateManager）
        variableExtractionService = createVariableExtractionService(llmService, modelManager, templateManager);

        // 🆕 创建变量值生成服务（使用代理的 llmService, modelManager, templateManager）
        variableValueGenerationService = createVariableValueGenerationService(llmService, modelManager, templateManager);

        // 🆕 读取当前上下文的模式
        console.log('[AppInitializer] Reading current context mode...');
        const contextMode = ref<ContextMode>(DEFAULT_CONTEXT_MODE);
        try {
          const currentId = await contextRepo.getCurrentId();
          const currentContext = await contextRepo.get(currentId);
          contextMode.value = currentContext.mode || DEFAULT_CONTEXT_MODE;
          console.log('[AppInitializer] Current context mode:', contextMode.value);
        } catch (err) {
          console.warn('[AppInitializer] Failed to read context mode; using default value:', err);
        }

        services.value = {
          modelManager,
          templateManager,
          historyManager,
          dataManager,
          llmService,
          promptService,
          templateLanguageService, // 使用代理而不是null
          preferenceService, // 使用从core包导入的ElectronPreferenceServiceProxy
          compareService, // 直接使用，无需代理
          contextRepo, // 使用Electron代理
          favoriteManager, // 使用Electron代理
          contextMode, // 🆕 上下文模式
          textAdapterRegistry: textAdapterRegistryInstance,
          imageModelManager,
          imageService,
          imageAdapterRegistry: imageAdapterRegistryInstance,
          imageStorageService, // 🆕 图像存储服务
          favoriteImageStorageService,
          evaluationService, // 🆕 评估服务
          variableExtractionService, // 🆕 变量提取服务
          variableValueGenerationService, // 🆕 变量值生成服务
        };
        console.log('[AppInitializer] Electron proxy services initialized');

        // 只保留 session 引用的图片：启动后做一次 best-effort GC
        if (imageStorageService) {
          scheduleImageStorageGc(preferenceService, imageStorageService, {
            getFavoritesPayload: () => favoriteManager.getFavorites(),
          })
        }

      } else {
        console.log('[AppInitializer] Web environment detected; initializing full service set...');
        // 在Web环境中，我们创建一套完整的、真实的服务
        const storageProvider = StorageFactory.create('dexie');
        const stage1StartupRepairReport = await runStorageStartupSafetyCheck(storageProvider)
        await writeStartupRepairReport(storageProvider, stage1StartupRepairReport)

        // 创建基于存储提供器的偏好设置服务，使用core包中的createPreferenceService
        preferenceService = createPreferenceService(storageProvider);
        startupRepairReport.value = await consumeStartupRepairReport(preferenceService)

        const languageService = createTemplateLanguageService(preferenceService);
        
        // Services with no dependencies or only storage
        const modelManagerInstance = createModelManager(storageProvider);

        // 文本模型适配器注册表（本地实例）
        textAdapterRegistryInstance = createTextAdapterRegistry();

        // 图像模型管理器（独立存储空间）
        const imageAdapterRegistry = await import('@prompt-optimizer/core').then(m => m.createImageAdapterRegistry())
        imageAdapterRegistryInstance = imageAdapterRegistry
        const imageModelManagerInstance = createImageModelManager(storageProvider, imageAdapterRegistry);

        // 🆕 创建图像存储服务（独立 IndexedDB 数据库）
        console.log('[AppInitializer] Initializing image storage service...');
        imageStorageService = createImageStorageService({
          maxCacheSize: 50 * 1024 * 1024,  // 50 MB
          maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 天
          maxCount: 100,                     // 最多 100 张
          autoCleanupThreshold: 0.8,         // 达到 80% 时触发清理
          dbName: 'PromptOptimizerImageDB',
        });

        // 收藏快照图像存储（独立数据库，避免与 session 图片清理策略耦合）
        favoriteImageStorageService = createImageStorageService({
          maxCacheSize: 200 * 1024 * 1024,      // 200 MB
          maxAge: undefined,
          maxCount: 1000,
          quotaStrategy: 'reject',
          dbName: 'PromptOptimizerFavoriteImageDB',
        });

        // 📝 图像数据迁移已移除（session 是本次重构新引入，无历史数据需要迁移）
        // 如果将来需要迁移，可以使用 migrateLegacySessions() 函数

        // Initialize language service first, as template manager depends on it
        console.log('[AppInitializer] Initializing language service...');
        await languageService.initialize();
        
        const templateManagerInstance = createTemplateManager(storageProvider, languageService);
        templateManager = templateManagerInstance;
        console.log('[AppInitializer] TemplateManager instance in Web:', templateManager);
        
        // Initialize managers that depend on other managers
        const historyManagerInstance = createHistoryManager(storageProvider, modelManagerInstance);
        
        // Now ensure model manager with async init is ready (template manager no longer needs async init)
        console.log('[AppInitializer] Ensuring model manager initialization is complete...');
        await modelManagerInstance.ensureInitialized();
        try {
          const chromeBuiltInSync = await autoEnableChromeBuiltInModelIfReady(modelManagerInstance)
          if (chromeBuiltInSync.enabled) {
            console.log('[AppInitializer] Auto-enabled Chrome built-in AI because the browser model is available.');
          }
        } catch (err) {
          console.warn('[AppInitializer] Chrome built-in AI auto-enable check failed (non-critical):', err);
        }

        // Assign instances after they are fully initialized
        modelManager = modelManagerInstance;
        templateManager = templateManagerInstance;
        historyManager = historyManagerInstance;

        // 创建严格符合接口的适配器
        const modelManagerAdapter: IModelManager = {
          ensureInitialized: () => modelManagerInstance.ensureInitialized(),
          isInitialized: () => modelManagerInstance.isInitialized(),
          getAllModels: () => modelManagerInstance.getAllModels(),
          getModel: (key) => modelManagerInstance.getModel(key),
          addModel: (key, config) => modelManagerInstance.addModel(key, config),
          updateModel: (id, updates) => modelManagerInstance.updateModel(id, updates),
          deleteModel: (id) => modelManagerInstance.deleteModel(id),
          enableModel: (key) => modelManagerInstance.enableModel(key),
          disableModel: (key) => modelManagerInstance.disableModel(key),
          getEnabledModels: () => modelManagerInstance.getEnabledModels(),
          // IImportExportable methods
          exportData: () => modelManagerInstance.exportData(),
          importData: (data) => modelManagerInstance.importData(data),
          getDataType: () => modelManagerInstance.getDataType(),
          validateData: (data) => modelManagerInstance.validateData(data),
        };

        const templateManagerAdapter: ITemplateManager = {
          getTemplate: (id) => templateManagerInstance.getTemplate(id),
          saveTemplate: (template) => templateManagerInstance.saveTemplate(template),
          deleteTemplate: (id) => templateManagerInstance.deleteTemplate(id),
          listTemplates: () => templateManagerInstance.listTemplates(),
          exportTemplate: (id) => templateManagerInstance.exportTemplate(id),
          importTemplate: (json) => templateManagerInstance.importTemplate(json),
          listTemplatesByType: (type) => templateManagerInstance.listTemplatesByType(type),
          changeBuiltinTemplateLanguage: (language) => templateManagerInstance.changeBuiltinTemplateLanguage(language),
          getCurrentBuiltinTemplateLanguage: async () => await templateManagerInstance.getCurrentBuiltinTemplateLanguage(),
          getSupportedBuiltinTemplateLanguages: async () => await templateManagerInstance.getSupportedBuiltinTemplateLanguages(),
          // IImportExportable methods
          exportData: () => templateManagerInstance.exportData(),
          importData: (data) => templateManagerInstance.importData(data),
          getDataType: () => templateManagerInstance.getDataType(),
          validateData: (data) => templateManagerInstance.validateData(data),
        };

        const historyManagerAdapter: IHistoryManager = {
          getRecords: () => historyManagerInstance.getRecords(),
          getRecord: (id) => historyManagerInstance.getRecord(id),
          addRecord: (record) => historyManagerInstance.addRecord(record),
          deleteRecord: (id) => historyManagerInstance.deleteRecord(id),
          clearHistory: () => historyManagerInstance.clearHistory(),
          getIterationChain: (id) => historyManagerInstance.getIterationChain(id),
          getAllChains: () => historyManagerInstance.getAllChains(),
          getChain: (id) => historyManagerInstance.getChain(id),
          createNewChain: (record) => historyManagerInstance.createNewChain(record),
          addIteration: (params) => historyManagerInstance.addIteration(params),
          deleteChain: (id) => historyManagerInstance.deleteChain(id),
          // IImportExportable methods
          exportData: () => historyManagerInstance.exportData(),
          importData: (data) => historyManagerInstance.importData(data),
          getDataType: () => historyManagerInstance.getDataType(),
          validateData: (data) => historyManagerInstance.validateData(data),
        };

        // Services that depend on initialized managers
        console.log('[AppInitializer] Creating services that depend on initialized managers...');
        llmService = createLLMService(modelManagerInstance);
        const imageUnderstandingService = createImageUnderstandingService({
          registry: textAdapterRegistryInstance,
        })
        promptService = createPromptService(
          modelManager,
          llmService,
          templateManager,
          historyManager,
          imageUnderstandingService,
        );
        imageService = createImageService(imageModelManagerInstance, imageAdapterRegistryInstance);

        // Ensure image model defaults are seeded (similar to text models)
        try {
          if (typeof imageModelManagerInstance.ensureInitialized === 'function') {
            await imageModelManagerInstance.ensureInitialized()
          }
        } catch (e) {
          console.warn('[AppInitializer] ImageModelManager ensureInitialized failed (non-critical):', e)
        }

        // 创建 CompareService（直接使用）
        const compareService = createCompareService();

        // 创建 ContextRepo（使用相同的存储提供器）
        const contextRepo = createContextRepo(storageProvider);

        // 创建 DataManager（需要contextRepo）
        dataManager = createDataManager(
          modelManagerInstance,
          templateManagerInstance,
          historyManagerInstance,
          preferenceService,
          contextRepo,
          imageModelManagerInstance,
        );

        // 创建收藏管理器
        favoriteManager = new FavoriteManager(storageProvider);
        favoriteManager = attachFavoriteAssetGc(favoriteManager, favoriteImageStorageService)

        if (favoriteImageStorageService) {
          const favoriteAssetGcResult = await runFavoriteAssetGc(
            favoriteManager,
            favoriteImageStorageService,
          )
          if (favoriteAssetGcResult.deletedIds.length > 0) {
            startupRepairReport.value = appendStartupRepairReport(startupRepairReport.value, {
              key: 'PromptOptimizerFavoriteImageDB',
              action: 'removed',
              reason: 'orphan_assets_removed',
              deletedCount: favoriteAssetGcResult.deletedIds.length,
            })
          }
        }

        // 🆕 创建评估服务
        evaluationService = createEvaluationService(llmService, modelManagerAdapter, templateManagerAdapter, {
          imageStorageService,
          imageUnderstandingService: createImageUnderstandingService({
            registry: textAdapterRegistryInstance,
          }),
        });

        // 🆕 创建变量提取服务
        variableExtractionService = createVariableExtractionService(llmService, modelManagerAdapter, templateManagerAdapter);

        // 🆕 创建变量值生成服务
        variableValueGenerationService = createVariableValueGenerationService(llmService, modelManagerAdapter, templateManagerAdapter);

        // 🆕 读取当前上下文的模式
        console.log('[AppInitializer] Reading current context mode...');
        const contextMode = ref<ContextMode>(DEFAULT_CONTEXT_MODE);
        try {
          const currentId = await contextRepo.getCurrentId();
          const currentContext = await contextRepo.get(currentId);
          contextMode.value = currentContext.mode || DEFAULT_CONTEXT_MODE;
          console.log('[AppInitializer] Current context mode:', contextMode.value);
        } catch (err) {
          console.warn('[AppInitializer] Failed to read context mode; using default value:', err);
        }

        // 将所有服务实例赋值给 services.value
        services.value = {
          modelManager: modelManagerAdapter, // 使用适配器
          templateManager: templateManagerAdapter, // 使用适配器
          historyManager: historyManagerAdapter, // 使用适配器
          dataManager,
          llmService,
          promptService,
          templateLanguageService: languageService,
          preferenceService, // 使用从core包导入的PreferenceService
          compareService, // 直接使用
          contextRepo, // 上下文仓库
          favoriteManager, // 收藏管理器
          contextMode, // 🆕 上下文模式
          textAdapterRegistry: textAdapterRegistryInstance,
          imageModelManager: imageModelManagerInstance,
          imageService,
          imageAdapterRegistry: imageAdapterRegistryInstance,
          imageStorageService, // 🆕 图像存储服务
          favoriteImageStorageService,
          evaluationService, // 🆕 评估服务
          variableExtractionService, // 🆕 变量提取服务
          variableValueGenerationService, // 🆕 变量值生成服务
        };

        console.log('[AppInitializer] All services initialized');

        // 只保留 session 引用的图片：启动后做一次 best-effort GC
        if (imageStorageService) {
          scheduleImageStorageGc(preferenceService, imageStorageService, {
            getFavoritesPayload: () => favoriteManager.getFavorites(),
          })
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[AppInitializer] Critical service initialization failed:", errorMessage);
      console.error("[AppInitializer] Error details:", err);
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      isInitializing.value = false;
      console.log('[AppInitializer] Application initialization complete');
    }
  });

  return { services, isInitializing, error, startupRepairReport };
} 
