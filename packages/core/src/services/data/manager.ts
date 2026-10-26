import { IHistoryManager } from '../history/types';
import { IModelManager } from '../model/types';
import type { IImageModelManager } from '../image/types';
import { ITemplateManager } from '../template/types';
import { IPreferenceService } from '../preference/types';
import { ContextRepo } from '../context/types';
import {
  DataExportFailedError,
  DataImportPartialFailedError,
  DataInvalidFormatError,
  DataInvalidJsonError,
} from './errors';
import { stripErrorCodeMarkers, toErrorWithCode } from '../../utils/error';
import { WorkspaceSessionTransfer } from './workspace-session-transfer';
import type { IImportExportable } from '../../interfaces/import-export';

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

  /** Validate every supplied section before a package restores any resources. */
  validateImportData(dataString: string): Promise<void>;

  /**
   * 导入所有数据
   * @param dataString JSON格式的数据字符串
   */
  importAllData(dataString: string): Promise<void>;
}

export class DataManager implements IDataManager {
  private modelManager: IModelManager;
  private imageModelManager?: IImageModelManager;
  private templateManager: ITemplateManager;
  private historyManager: IHistoryManager;
  private preferenceService: IPreferenceService;
  private contextRepo: ContextRepo;
  private workspaceSessions: WorkspaceSessionTransfer;

  constructor(
    modelManager: IModelManager,
    templateManager: ITemplateManager,
    historyManager: IHistoryManager,
    preferenceService: IPreferenceService,
    contextRepo: ContextRepo,
    imageModelManager?: IImageModelManager
  ) {
    this.modelManager = modelManager;
    this.imageModelManager = imageModelManager;
    this.templateManager = templateManager;
    this.historyManager = historyManager;
    this.preferenceService = preferenceService;
    this.contextRepo = contextRepo;
    this.workspaceSessions = new WorkspaceSessionTransfer(preferenceService);
  }

  async exportAllData(): Promise<string> {
    const data: Record<string, any> = {};

    try {
      // 使用各服务的exportData接口，使用固定的键名保持兼容性
      data['history'] = await this.historyManager.exportData();
      data['models'] = await this.modelManager.exportData();
      if (this.imageModelManager) {
        data['imageModels'] = await this.imageModelManager.exportData();
      }
      data['userTemplates'] = await this.templateManager.exportData();
      data['userSettings'] = await this.preferenceService.exportData();
      data['contexts'] = await this.contextRepo.exportData();
      data['workspaceSessions'] = await this.workspaceSessions.exportData();
    } catch (error) {
      console.error('Failed to export data:', error);
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

  private parseImportData(dataString: string): Record<string, unknown> {
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
    if (Object.prototype.hasOwnProperty.call(exportData, 'version')) {
      if (exportData.version !== 1) {
        throw new DataInvalidFormatError('Unsupported app backup version')
      }
      if (!exportData.data || typeof exportData.data !== 'object' || Array.isArray(exportData.data)) {
        throw new DataInvalidFormatError('"data" property is missing or not an object')
      }
      dataToImport = exportData.data;
    }
    // Old format: direct data object { history: [...], models: [...], ... }
    else if (exportData.history || exportData.models || exportData.imageModels || exportData.userTemplates || exportData.userSettings || exportData.contexts || exportData.workspaceSessions) {
      dataToImport = exportData;
    }
    else {
      throw new DataInvalidFormatError('Unrecognized data structure')
    }

    const supported = new Set(['history', 'models', 'imageModels', 'userTemplates', 'userSettings', 'contexts', 'workspaceSessions']);
    if (Object.keys(dataToImport).some(key => !supported.has(key))) {
      throw new DataInvalidFormatError('Unsupported app backup section')
    }
    return dataToImport;
  }

  private importServices(): Array<{ service: IImportExportable; dataKey: string }> {
    return [
      { service: this.historyManager, dataKey: 'history' },
      { service: this.modelManager, dataKey: 'models' },
      ...(this.imageModelManager ? [{ service: this.imageModelManager, dataKey: 'imageModels' }] : []),
      { service: this.templateManager, dataKey: 'userTemplates' },
      { service: this.preferenceService, dataKey: 'userSettings' },
      { service: this.contextRepo, dataKey: 'contexts' },
      { service: this.workspaceSessions, dataKey: 'workspaceSessions' }
    ];
  }

  private async validateSections(data: Record<string, unknown>): Promise<void> {
    if (!this.imageModelManager && data.imageModels !== undefined &&
      (!Array.isArray(data.imageModels) || data.imageModels.length > 0)) {
      throw new DataInvalidFormatError('Image model restoration is unavailable')
    }
    for (const { service, dataKey } of this.importServices()) {
      if (data[dataKey] === undefined) continue;
      if (dataKey === 'workspaceSessions') {
        this.workspaceSessions.assertValidData(data[dataKey]);
      } else if (!await service.validateData(data[dataKey])) {
        throw new DataInvalidFormatError(`Invalid ${dataKey} backup data`)
      }
    }
    // Standalone template import may rename a built-in collision. A full
    // backup must not silently leave its history/session references on that ID.
    if (Array.isArray(data.userTemplates) && data.userTemplates.length > 0) {
      const builtinIds = new Set((await this.templateManager.listTemplates())
        .filter(template => template.isBuiltin).map(template => template.id));
      if (data.userTemplates.some(template => builtinIds.has(template.id))) {
        throw new DataInvalidFormatError('User template ID conflicts with a built-in template')
      }
    }
  }

  async validateImportData(dataString: string): Promise<void> {
    await this.validateSections(this.parseImportData(dataString));
  }

  async importAllData(dataString: string): Promise<void> {
    const dataToImport = this.parseImportData(dataString);
    await this.validateSections(dataToImport);
    const imported: string[] = [];
    for (const { service, dataKey } of this.importServices()) {
      if (dataToImport[dataKey] !== undefined) {
        try {
          await service.importData(dataToImport[dataKey]);
          imported.push(dataKey);
        } catch (error) {
          // Nested structured errors may contain markers outside the leading position.
          const detail = stripErrorCodeMarkers(
            error instanceof Error ? error.message : String(error)
          );
          const errorMessage = `Failed to import ${dataKey}: ${detail}`;
          // Stop immediately. The workspace remains the final commit; a runtime
          // storage failure must never be presented as a complete restore.
          const partial = imported.length ? `; already imported: ${imported.join(', ')}` : '';
          throw new DataImportPartialFailedError(1, errorMessage + partial)
        }
      }
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
  contextRepo: ContextRepo,
  imageModelManager?: IImageModelManager
): DataManager {
  return new DataManager(modelManager, templateManager, historyManager, preferenceService, contextRepo, imageModelManager);
}
