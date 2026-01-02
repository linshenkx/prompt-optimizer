import { type Ref } from 'vue'

import type {
  IModelManager,
  ITemplateManager,
  IHistoryManager,
  IDataManager,
  ILLMService,
  IPromptService,
  ITemplateLanguageService,
  ICompareService,
  IPreferenceService,
  ContextRepo,
  IImageModelManager,
  IImageService,
  IImageAdapterRegistry,
  ITextAdapterRegistry,
  IFavoriteManager,
  ContextMode,
  IEvaluationService,
  IVariableExtractionService,
  IVariableValueGenerationService,
  IImageStorageService
} from '@prompt-optimizer/core'

/**
 * 统一的应用服务接口定义
 */
export interface AppServices {
  modelManager: IModelManager;
  templateManager: ITemplateManager;
  historyManager: IHistoryManager;
  dataManager: IDataManager;
  llmService: ILLMService;
  promptService: IPromptService;
  templateLanguageService: ITemplateLanguageService;
  preferenceService: IPreferenceService;
  compareService: ICompareService;
  contextRepo: ContextRepo;
  favoriteManager: IFavoriteManager;
  // 🆕 上下文模式（响应式，用于 UI 行为决策）
  contextMode: Ref<ContextMode>;
  // 文本模型适配器注册表（本地实例）
  textAdapterRegistry?: ITextAdapterRegistry;
  // 图像相关（Web 优先，可选）
  imageModelManager?: IImageModelManager;
  imageService?: IImageService;
  imageAdapterRegistry?: IImageAdapterRegistry;
  // 🆕 图像存储服务（可选）
  imageStorageService?: IImageStorageService;
  // 🆕 评估服务（可选）
  evaluationService?: IEvaluationService;
  // 🆕 变量提取服务（可选）
  variableExtractionService?: IVariableExtractionService;
  // 🆕 变量值生成服务（可选）
  variableValueGenerationService?: IVariableValueGenerationService;
}
