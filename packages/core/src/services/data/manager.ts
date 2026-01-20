import { IHistoryManager } from '../history/types';
import { IModelManager } from '../model/types';
import { ITemplateManager } from '../template/types';
import { IPreferenceService } from '../preference/types';
import { ContextRepo } from '../context/types';
import {
  DataExportFailedError,
  DataImportPartialFailedError,
  DataInvalidFormatError,
  DataInvalidJsonError,
} from './errors';
import { toErrorWithCode } from '../../utils/error';

/**
 * 数据导入导出管理器
 *
 * 采用协调者模式：
 * - DataManager只负责协调各个服务的导入导出
 * - 具体的导入导出实现由各个服务自己负责
 * - 通过IImportExportable接口统一各服务的导入导出行为
 */

// 旧版本兼容性处理现在由各个服务自己负责

/**
 * 数据管理器接口
 */
export interface IDataManager {
  /**
   * 导出所有数据
   * @returns JSON格式的数据字符串
   */
  exportAllData(): Promise<string>;

  /**
   * 导入所有数据
   * @param dataString JSON格式的数据字符串
   */
  importAllData(dataString: string): Promise<void>;
}

export class DataManager implements IDataManager {
  private modelManager: IModelManager;
  private templateManager: ITemplateManager;
  private historyManager: IHistoryManager;
  private preferenceService: IPreferenceService;
  private contextRepo: ContextRepo;

  constructor(
    modelManager: IModelManager,
    templateManager: ITemplateManager,
    historyManager: IHistoryManager,
    preferenceService: IPreferenceService,
    contextRepo: ContextRepo
  ) {
    this.modelManager = modelManager;
    this.templateManager = templateManager;
    this.historyManager = historyManager;
    this.preferenceService = preferenceService;
    this.contextRepo = contextRepo;
  }

  async exportAllData(): Promise<string> {
    const data: Record<string, any> = {};

    try {
      // 使用各服务的exportData接口，使用固定的键名保持兼容性
      data['history'] = await this.historyManager.exportData();
      data['models'] = await this.modelManager.exportData();
      data['userTemplates'] = await this.templateManager.exportData();
      data['userSettings'] = await this.preferenceService.exportData();
      data['contexts'] = await this.contextRepo.exportData();
    } catch (error) {
      console.error('导出数据失败:', error);
      if (typeof (error as any)?.code === 'string') {
        throw toErrorWithCode(error)
      }
      throw new DataExportFailedError(error instanceof Error ? error.message : String(error))
    }

    const exportFormat = {
      version: 1,
      data
    };

    return JSON.stringify(exportFormat, null, 2); // 格式化输出，便于调试
  }

  async importAllData(dataString: string): Promise<void> {
    let exportData: any;

    try {
      exportData = JSON.parse(dataString);
    } catch (error) {
      throw new DataInvalidJsonError(error instanceof Error ? error.message : String(error))
    }

    if (!exportData || typeof exportData !== 'object' || Array.isArray(exportData)) {
      throw new DataInvalidFormatError('Data must be an object')
    }

    // Support both old and new format for backward compatibility
    let dataToImport: Record<string, any>;

    // New format: { version: 1, data: { ... } }
    if (exportData.version) {
      if (!exportData.data || typeof exportData.data !== 'object' || Array.isArray(exportData.data)) {
        throw new DataInvalidFormatError('"data" property is missing or not an object')
      }
      dataToImport = exportData.data;
    }
    // Old format: direct data object { history: [...], models: [...], ... }
    else if (exportData.history || exportData.models || exportData.userTemplates || exportData.userSettings || exportData.contexts) {
      dataToImport = exportData;
    }
    else {
      throw new DataInvalidFormatError('Unrecognized data structure')
    }

    const errors: string[] = [];

    // 使用各服务的importData接口
    const serviceMap = [
      { service: this.historyManager, dataKey: 'history' },
      { service: this.modelManager, dataKey: 'models' },
      { service: this.templateManager, dataKey: 'userTemplates' },
      { service: this.preferenceService, dataKey: 'userSettings' },
      { service: this.contextRepo, dataKey: 'contexts' }
    ];

    for (const { service, dataKey } of serviceMap) {
      if (dataToImport[dataKey] !== undefined) {
        try {
          await service.importData(dataToImport[dataKey]);
          console.log(`Successfully imported ${dataKey}`);
        } catch (error) {
          const errorMessage = `Failed to import ${dataKey}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMessage);
          console.error(errorMessage, error);
        }
      }
    }

    if (errors.length > 0) {
      throw new DataImportPartialFailedError(errors.length, errors.join('; '))
    }
  }
}

/**
 * 创建数据管理器的工厂函数
 * @param modelManager 模型管理器实例
 * @param templateManager 模板管理器实例
 * @param historyManager 历史记录管理器实例
 * @param preferenceService 偏好设置服务实例
 * @param contextRepo 上下文仓库实例
 * @returns 数据管理器实例
 */
export function createDataManager(
  modelManager: IModelManager,
  templateManager: ITemplateManager,
  historyManager: IHistoryManager,
  preferenceService: IPreferenceService,
  contextRepo: ContextRepo
): DataManager {
  return new DataManager(modelManager, templateManager, historyManager, preferenceService, contextRepo);
}
