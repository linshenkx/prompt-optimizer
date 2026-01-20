import type { Template, ITemplateManager, TemplateType } from './types';
import type { BuiltinTemplateLanguage } from './languageService';
import { safeSerializeForIPC } from '../../utils/ipc-serialization';
import { TemplateStorageError } from './errors';

// 为window.electronAPI提供完整的类型定义，以确保类型安全
interface ElectronAPI {
  template: {
    getTemplate: (id: string) => Promise<Template>;
    createTemplate: (template: Template) => Promise<void>;
    deleteTemplate: (id: string) => Promise<void>;
    getTemplates: () => Promise<Template[]>;
    exportTemplate: (id: string) => Promise<string>;
    importTemplate: (jsonString: string) => Promise<void>;
    listTemplatesByType: (type: TemplateType) => Promise<Template[]>;
    changeBuiltinTemplateLanguage: (language: BuiltinTemplateLanguage) => Promise<void>;
    getCurrentBuiltinTemplateLanguage: () => Promise<BuiltinTemplateLanguage>;
    getSupportedBuiltinTemplateLanguages: () => Promise<BuiltinTemplateLanguage[]>;
    // Import/Export Data methods
    exportData: () => Promise<Template[]>;
    importData: (data: any) => Promise<void>;
    getDataType: () => Promise<string>;
    validateData: (data: any) => Promise<boolean>;
  };
  // 添加其他服务的定义以避免编译错误
  [key: string]: any;
}

declare const window: {
  electronAPI: ElectronAPI;
};


/**
 * Electron环境下的TemplateManager代理
 * 通过IPC调用主进程中的真实TemplateManager实例
 */
export class ElectronTemplateManagerProxy implements ITemplateManager {
  private electronAPI: ElectronAPI['template'];

  constructor() {
    if (!window.electronAPI?.template) {
      throw new TemplateStorageError(
        'Electron API for TemplateManager not available. Please ensure preload script is loaded.',
      );
    }
    this.electronAPI = window.electronAPI.template;
  }

  async getTemplate(id: string): Promise<Template> {
    return this.electronAPI.getTemplate(id);
  }

  async saveTemplate(template: Template): Promise<void> {
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeTemplate = safeSerializeForIPC(template);
    return this.electronAPI.createTemplate(safeTemplate);
  }

  async deleteTemplate(id: string): Promise<void> {
    return this.electronAPI.deleteTemplate(id);
  }

  async listTemplates(): Promise<Template[]> {
    return this.electronAPI.getTemplates();
  }

  async exportTemplate(id: string): Promise<string> {
    return this.electronAPI.exportTemplate(id);
  }

  async importTemplate(jsonString: string): Promise<void> {
    // jsonString是基本类型，不需要序列化，但为了一致性保留注释
    return this.electronAPI.importTemplate(jsonString);
  }

  async listTemplatesByType(type: TemplateType): Promise<Template[]> {
    return this.electronAPI.listTemplatesByType(type);
  }

  async changeBuiltinTemplateLanguage(language: BuiltinTemplateLanguage): Promise<void> {
    return this.electronAPI.changeBuiltinTemplateLanguage(language);
  }

  async getCurrentBuiltinTemplateLanguage(): Promise<BuiltinTemplateLanguage> {
    return await this.electronAPI.getCurrentBuiltinTemplateLanguage();
  }

  async getSupportedBuiltinTemplateLanguages(): Promise<BuiltinTemplateLanguage[]> {
    return await this.electronAPI.getSupportedBuiltinTemplateLanguages();
  }

  // 实现 IImportExportable 接口

  /**
   * 导出所有用户模板
   */
  async exportData(): Promise<Template[]> {
    return this.electronAPI.exportData();
  }

  /**
   * 导入用户模板
   */
  async importData(data: any): Promise<void> {
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeData = safeSerializeForIPC(data);
    return this.electronAPI.importData(safeData);
  }

  /**
   * 获取数据类型标识
   */
  async getDataType(): Promise<string> {
    return this.electronAPI.getDataType();
  }

  /**
   * 验证模板数据格式
   */
  async validateData(data: any): Promise<boolean> {
    // 自动序列化，防止Vue响应式对象IPC传递错误
    const safeData = safeSerializeForIPC(data);
    return this.electronAPI.validateData(safeData);
  }
}
