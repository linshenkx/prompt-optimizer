import type { BuiltinTemplateLanguage, ITemplateLanguageService } from './languageService';
import { TemplateStorageError } from './errors';

/**
 * Electron环境下的TemplateLanguageService代理
 * 通过template namespace的IPC调用主进程中的语言相关功能
 */
export class ElectronTemplateLanguageServiceProxy implements ITemplateLanguageService {
  private electronAPI: any;

  constructor() {
    const windowAny = window as any;
    if (!windowAny?.electronAPI?.template) {
      throw new TemplateStorageError('Electron API not available. Please ensure preload script is loaded.');
    }
    this.electronAPI = windowAny.electronAPI;
  }

  async initialize(): Promise<void> {
    // 在Electron环境中，语言服务由主进程管理，渲染进程不需要单独初始化
    return Promise.resolve();
  }

  async getCurrentLanguage(): Promise<BuiltinTemplateLanguage> {
    return this.electronAPI.template.getCurrentBuiltinTemplateLanguage();
  }

  async setLanguage(language: BuiltinTemplateLanguage): Promise<void> {
    return this.electronAPI.template.changeBuiltinTemplateLanguage(language);
  }

  async toggleLanguage(): Promise<BuiltinTemplateLanguage> {
    const currentLanguage = await this.getCurrentLanguage();
    const newLanguage = currentLanguage === 'zh-CN' ? 'en-US' : 'zh-CN';
    await this.setLanguage(newLanguage);
    return newLanguage;
  }

  async isValidLanguage(language: string): Promise<boolean> {
    const supportedLanguages = await this.getSupportedLanguages();
    return supportedLanguages.includes(language as BuiltinTemplateLanguage);
  }

  async getSupportedLanguages(): Promise<BuiltinTemplateLanguage[]> {
    return this.electronAPI.template.getSupportedBuiltinTemplateLanguages();
  }

  getLanguageDisplayName(language: BuiltinTemplateLanguage): string {
    switch (language) {
      case 'zh-CN':
        return '中文';
      case 'en-US':
        return 'English';
      default:
        return language;
    }
  }

  isInitialized(): boolean {
    return true; // 在Electron环境中，主进程管理初始化状态
  }
} 
