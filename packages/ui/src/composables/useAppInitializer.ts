import { ref, onMounted } from 'vue';
import {
  StorageFactory,
  MemoryStorageProvider,
  createModelManager,
  createTemplateManager,
  createHistoryManager,
  createDataManager,
  createLLMService,
  createPromptService,
  createTemplateLanguageService,
  createCompareService,
  ElectronModelManagerProxy,
  ElectronTemplateManagerProxy,
  ElectronHistoryManagerProxy,
  ElectronDataManagerProxy,
  ElectronLLMProxy,
  ElectronPromptServiceProxy,
  ElectronTemplateLanguageServiceProxy, // 暂时注释掉直到构建完成
  isRunningInElectron,
  waitForElectronApi,
  DataManager,
  ElectronPreferenceServiceProxy,
  createPreferenceService,
} from '@prompt-optimizer/core'; // 从core包导入所有核心模块
import type { AppServices } from '../types/services';
import type { IModelManager, ITemplateManager, IHistoryManager, ILLMService, IPromptService, IDataManager } from '@prompt-optimizer/core';
import type { IPreferenceService } from '../types/services';

/**
 * 应用服务统一初始化器。
 * 负责根据运行环境（Web 或 Electron）创建和初始化所有核心服务。
 * @returns { services, isInitializing, error }
 */
export function useAppInitializer() {
  const services = ref<AppServices | null>(null);
  const isInitializing = ref(true);
  const error = ref<Error | null>(null);

  onMounted(async () => {
    try {
      console.log('[AppInitializer] 开始应用初始化...');


      let modelManager: IModelManager;
      let templateManager: ITemplateManager;
      let historyManager: IHistoryManager;
      let dataManager: IDataManager;
      let llmService: ILLMService;
      let promptService: IPromptService;
      let preferenceService: IPreferenceService;

      if (isRunningInElectron()) {
        console.log('[AppInitializer] 检测到Electron环境，等待API就绪...');
        
        // 等待 Electron API 完全就绪
        const apiReady = await waitForElectronApi();
        if (!apiReady) {
          throw new Error('Electron API 初始化超时，请检查preload脚本是否正确加载');
        }
        
        console.log('[AppInitializer] Electron API 就绪，初始化代理服务...');

        // 在Electron环境中，不需要storageProvider
        // 所有存储操作都通过各个manager的代理完成

        // 在Electron环境中，我们实例化所有轻量级的代理类
        modelManager = new ElectronModelManagerProxy();
        templateManager = new ElectronTemplateManagerProxy();
        historyManager = new ElectronHistoryManagerProxy();
        llmService = new ElectronLLMProxy();
        promptService = new ElectronPromptServiceProxy();
        preferenceService = new ElectronPreferenceServiceProxy();

        // DataManager在Electron环境下使用代理模式
        dataManager = new ElectronDataManagerProxy();

        // 使用真正的 Electron 模板语言服务代理
        const templateLanguageService = new ElectronTemplateLanguageServiceProxy();

        // 创建 CompareService（直接使用，无需代理）
        const compareService = createCompareService();

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
          storageProvider: new MemoryStorageProvider(), // Electron环境下使用内存存储提供者作为占位符
        };
        console.log('[AppInitializer] Electron代理服务初始化完成');

      } else {
        console.log('[AppInitializer] 检测到Web环境，初始化完整服务...');
        // 在Web环境中，我们创建一套完整的、真实的服务
        const storageProvider = StorageFactory.create('dexie');

        // 创建基于存储提供器的偏好设置服务，使用core包中的createPreferenceService
        preferenceService = createPreferenceService(storageProvider);

        const languageService = createTemplateLanguageService(preferenceService);
        
        // Services with no dependencies or only storage
        const modelManagerInstance = createModelManager(storageProvider);
        
        // Initialize language service first, as template manager depends on it
        console.log('[AppInitializer] 初始化语言服务...');
        await languageService.initialize();
        
        const templateManagerInstance = createTemplateManager(storageProvider, languageService);
        templateManager = templateManagerInstance;
        console.log('[AppInitializer] TemplateManager instance in Web:', templateManager);
        
        // Initialize managers that depend on other managers
        const historyManagerInstance = createHistoryManager(storageProvider, modelManagerInstance);
        
        // Now ensure model manager with async init is ready (template manager no longer needs async init)
        console.log('[AppInitializer] 确保模型管理器初始化完成...');
        await modelManagerInstance.ensureInitialized();

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
          exportData: () => modelManagerInstance.exportData(),
          importData: (data) => modelManagerInstance.importData(data),
          getDataType: () => modelManagerInstance.getDataType(),
          validateData: (data) => modelManagerInstance.validateData(data),
        };

        const languageServiceAdapter = {
          initialize: () => languageService.initialize(),
          getCurrentLanguage: () => languageService.getCurrentLanguage(),
          setLanguage: (language: any) => languageService.setLanguage(language),
          toggleLanguage: () => languageService.toggleLanguage(),
          isValidLanguage: (language: string) => languageService.isValidLanguage(language),
          getSupportedLanguages: () => languageService.getSupportedLanguages(),
          getLanguageDisplayName: (language: any) => languageService.getLanguageDisplayName(language),
          isInitialized: () => languageService.isInitialized(),
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
          exportData: () => historyManagerInstance.exportData(),
          importData: (data) => historyManagerInstance.importData(data),
          getDataType: () => historyManagerInstance.getDataType(),
          validateData: (data) => historyManagerInstance.validateData(data),
        };

        // Services that depend on initialized managers
        console.log('[AppInitializer] 创建依赖其他管理器的服务...');
        llmService = createLLMService(modelManagerInstance);
        promptService = createPromptService(modelManager, llmService, templateManager, historyManager);

        dataManager = createDataManager(modelManagerInstance, templateManagerInstance, historyManagerInstance, preferenceService);

        // 创建 CompareService（直接使用）
        const compareService = createCompareService();

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
          storageProvider, // 添加storageProvider到服务对象中
        };
      }

      console.log('[AppInitializer] 所有服务初始化完成');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[AppInitializer] 关键服务初始化失败:", errorMessage);
      console.error("[AppInitializer] 错误详情:", err);
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      isInitializing.value = false;
      console.log('[AppInitializer] 应用初始化完成');
    }
  });

  return { services, isInitializing, error };
}