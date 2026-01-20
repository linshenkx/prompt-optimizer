import { ITemplateManager, Template, TemplateType } from './types';
import { IStorageProvider } from '../storage/types';
import { StaticLoader } from './static-loader';
import { TemplateError, TemplateValidationError, TemplateStorageError } from './errors';
import { templateSchema } from './types';
import { BuiltinTemplateLanguage, ITemplateLanguageService } from './languageService';
import { CORE_SERVICE_KEYS } from '../../constants/storage-keys';
import { ImportExportError } from '../../interfaces/import-export';
import { IMPORT_EXPORT_ERROR_CODES, TEMPLATE_ERROR_CODES } from '../../constants/error-codes';



/**
 * 提示词管理器实现
 */
export class TemplateManager implements ITemplateManager {
  private readonly staticLoader: StaticLoader;

  constructor(
    private storageProvider: IStorageProvider,
    private languageService: ITemplateLanguageService
  ) {
    this.staticLoader = new StaticLoader();
  }

  private validateTemplateSchema(template: Partial<Template>): void {
    const result = templateSchema.safeParse(template);
    if (!result.success) {
      const errorDetails = result.error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      throw new TemplateValidationError('Template validation failed: ' + errorDetails);
    }
  }

  /**
   * Validates template ID
   * @param id Template ID
   */
  private validateTemplateId(id: string | null | undefined): void {
    if (!id) {
      throw new TemplateValidationError('Invalid template ID');
    }
    
    // Minimum 3 characters, only letters, numbers, and hyphens
    const idRegex = /^[a-z0-9-]{3,}$/;
    if (!idRegex.test(id)) {
      throw new TemplateValidationError('Invalid template ID format: must be at least 3 characters, using only lowercase letters, numbers, and hyphens');
    }
  }

  /**
   * Gets a template by ID
   * @param id Template ID
   * @returns Template or null if not found
   */
  async getTemplate(id: string | null | undefined): Promise<Template> {
    this.validateTemplateId(id);

    // Check built-in templates first
    const builtinTemplates = await this.getBuiltinTemplates();
    const builtinTemplate = builtinTemplates[id!];
    if (builtinTemplate) {
      return builtinTemplate;
    }

    // Check user templates
    const userTemplates = await this.getUserTemplates();
    const userTemplate = userTemplates.find(t => t.id === id);
    if (userTemplate) {
      return userTemplate;
    }
    
    throw new TemplateError(TEMPLATE_ERROR_CODES.NOT_FOUND, undefined, { context: id! });
  }

  /**
   * Saves a template
   * @param template Template to save
   */
  async saveTemplate(template: Template): Promise<void> {
    this.validateTemplateSchema(template);
    this.validateTemplateId(template.id);

    // Don't allow saving built-in templates
    if (template.isBuiltin) {
      throw new TemplateValidationError('Cannot save built-in template');
    }

    // Check if template ID conflicts with built-in templates
    const builtinTemplates = await this.getBuiltinTemplates();
    if (builtinTemplates[template.id]) {
      throw new TemplateValidationError(`Cannot overwrite built-in template: ${template.id}`);
    }

    // Set template as non-built-in
    template.isBuiltin = false;
    
    // Set timestamp
    template.metadata.lastModified = Date.now();

    // Get current user templates
    const userTemplates = await this.getUserTemplates();
    
    // Update or add the template
    const existingIndex = userTemplates.findIndex(t => t.id === template.id);
    if (existingIndex >= 0) {
      userTemplates[existingIndex] = template;
    } else {
      userTemplates.push(template);
    }
    
    // Save to storage
    await this.persistUserTemplates(userTemplates);
  }

  /**
   * Deletes a template
   * @param id Template ID
   */
  async deleteTemplate(id: string): Promise<void> {
    this.validateTemplateId(id);
    
    // Check if template is built-in
    const builtinTemplates = await this.getBuiltinTemplates();
    if (builtinTemplates[id]) {
      throw new TemplateValidationError(`Cannot delete built-in template: ${id}`);
    }
    
    // Get current user templates
    const userTemplates = await this.getUserTemplates();
    
    // Remove the template
    const filteredTemplates = userTemplates.filter(t => t.id !== id);
    
    // Save to storage
    await this.persistUserTemplates(filteredTemplates);
  }

  /**
   * Lists all templates
   * @returns Array of templates
   */
  async listTemplates(): Promise<Template[]> {
    const [builtinTemplates, userTemplates] = await Promise.all([
      this.getBuiltinTemplates(),
      this.getUserTemplates()
    ]);

    const templates = [
      ...Object.values(builtinTemplates),
      ...userTemplates
    ];

    return templates.sort((a, b) => {
      // Built-in templates come first
      if (a.isBuiltin !== b.isBuiltin) {
        return a.isBuiltin ? -1 : 1;
      }

      // Non-built-in templates sorted by timestamp descending
      if (!a.isBuiltin && !b.isBuiltin) {
        const timeA = a.metadata.lastModified || 0;
        const timeB = b.metadata.lastModified || 0;
        return timeB - timeA;
      }

      return 0;
    });
  }

  /**
   * Exports a template as a JSON string
   * @param id Template ID
   * @returns Template as JSON string
   */
  async exportTemplate(id: string): Promise<string> {
    const template = await this.getTemplate(id);
    return JSON.stringify(template, null, 2);
  }

  /**
   * Imports a template from a JSON string
   * @param jsonString Template as JSON string
   * @returns Promise<void>
   */
  async importTemplate(jsonString: string): Promise<void> {
    try {
      const template = JSON.parse(jsonString);
      
      // Validate schema
      this.validateTemplateSchema(template);
      
      // Save template
      await this.saveTemplate(template);
    } catch (error) {
      if (error instanceof TemplateError || error instanceof TemplateValidationError) {
        throw error;
      }
      throw new TemplateStorageError(
        `Failed to import template: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get built-in templates based on current language setting
   */
  private async getBuiltinTemplates(): Promise<Record<string, Template>> {
    // Get current language from template language service
    const currentLanguage = await this.languageService.getCurrentLanguage();

    // Get appropriate template set based on language
    const templateSet = await this.getTemplateSet(currentLanguage);

    // Mark all templates as built-in
    const builtinTemplates: Record<string, Template> = {};
    for (const [id, template] of Object.entries(templateSet)) {
      builtinTemplates[id] = { ...template, isBuiltin: true };
    }

    return builtinTemplates;
  }

  /**
   * Load user templates from storage
   */
  private async getUserTemplates(): Promise<Template[]> {
    try {
      const data = await this.storageProvider.getItem(CORE_SERVICE_KEYS.USER_TEMPLATES);
      if (!data) return [];

      const templates = JSON.parse(data) as Template[];
      
      // Ensure isBuiltin is set to false for loaded templates
      return templates.map(template => ({
        ...template,
        isBuiltin: false
      }));
    } catch (error) {
      throw new TemplateStorageError(
        `Failed to load user templates: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Saves user templates to storage
   */
  private async persistUserTemplates(templates: Template[]): Promise<void> {
    try {
      await this.storageProvider.setItem(
        CORE_SERVICE_KEYS.USER_TEMPLATES,
        JSON.stringify(templates)
      );
    } catch (error) {
      throw new TemplateStorageError(
        `Failed to save user templates: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get template set for the specified language
   * This method provides better extensibility for adding new languages
   */
  private async getTemplateSet(language: BuiltinTemplateLanguage): Promise<Record<string, Template>> {
    switch (language) {
      case 'en-US':
        return this.staticLoader.getDefaultTemplatesEn();
      case 'zh-CN':
        return this.staticLoader.getDefaultTemplates();
      default:
        console.warn(`Unsupported language: ${language}, falling back to Chinese templates`);
        return this.staticLoader.getDefaultTemplates();
    }
  }

  /**
   * List templates by type
   */
  async listTemplatesByType(type: TemplateType): Promise<Template[]> {
    try {
      const templates = await this.listTemplates();
      return templates.filter(
        template => template.metadata.templateType === type
      );
    } catch (error) {
      console.error(`Failed to get ${type} template list:`, error);
      return [];
    }
  }

  /**
   * Change built-in template language
   */
  async changeBuiltinTemplateLanguage(language: BuiltinTemplateLanguage): Promise<void> {
    await this.languageService.setLanguage(language);
  }

  /**
   * Get current built-in template language
   */
  async getCurrentBuiltinTemplateLanguage(): Promise<BuiltinTemplateLanguage> {
    return await this.languageService.getCurrentLanguage();
  }

  /**
   * Get supported built-in template languages
   */
  async getSupportedBuiltinTemplateLanguages(): Promise<BuiltinTemplateLanguage[]> {
    return await this.languageService.getSupportedLanguages();
  }

  // 实现 IImportExportable 接口

  /**
   * 导出所有用户模板
   */
  async exportData(): Promise<Template[]> {
    try {
      const allTemplates = await this.listTemplates();
      // 只导出用户模板，不导出内置模板
      return allTemplates.filter(template => !template.isBuiltin);
    } catch (error) {
      throw new ImportExportError(
        'Failed to export template data',
        await this.getDataType(),
        error as Error,
        IMPORT_EXPORT_ERROR_CODES.EXPORT_FAILED,
      );
    }
  }

  /**
   * 导入用户模板
   */
  async importData(data: any): Promise<void> {
    // 基本格式验证：必须是数组
    if (!Array.isArray(data)) {
      throw new ImportExportError(
        'Invalid template data format: data must be an array of template objects',
        await this.getDataType(),
        undefined,
        IMPORT_EXPORT_ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const templates = data as Template[];

    // Get existing user templates to clean up (替换模式)
    const existingTemplates = await this.listTemplates();
    const userTemplateIds = existingTemplates
      .filter(template => !template.isBuiltin)
      .map(template => template.id);

    // Delete all existing user templates
    for (const id of userTemplateIds) {
      try {
        await this.deleteTemplate(id);
      } catch (error) {
        console.warn(`Failed to delete template ${id}:`, error);
      }
    }

    const failedTemplates: { template: Template; error: Error }[] = [];

    // Import each template individually, capturing failures
    for (const template of templates) {
      try {
        // 使用 validateData 验证单个模板
        if (!this.validateSingleTemplate(template)) {
          console.warn(`Skipping invalid template configuration:`, template);
          failedTemplates.push({ template, error: new Error('Invalid template configuration') });
          continue;
        }

        // 检查是否与内置模板ID冲突
        const builtinTemplate = existingTemplates.find(t => t.id === template.id && t.isBuiltin);
        let finalTemplateId = template.id;
        let finalTemplateName = template.name;

        if (builtinTemplate) {
          // 为冲突的模板生成新的ID和名称
          const timestamp = Date.now();
          const random = Math.random().toString(36).substr(2, 6);
          finalTemplateId = `user-${template.id}-${timestamp}-${random}`;
          finalTemplateName = `${template.name} (导入副本)`;
          console.warn(`Detected conflict with built-in template ID: ${template.id}, renamed to: ${finalTemplateId}`);
        }

        // 确保导入的模板标记为用户模板，并为缺失字段提供默认值
        const userTemplate: Template = {
          ...template,
          id: finalTemplateId,
          name: finalTemplateName,
          isBuiltin: false,
          metadata: {
            version: template.metadata?.version || '1.0.0',
            lastModified: Date.now(), // 更新为当前时间
            templateType: template.metadata?.templateType || 'optimize', // 为旧版本数据提供默认类型
            author: template.metadata?.author || 'User', // 导入的模板标记为用户创建
            ...(template.metadata?.description && { description: template.metadata.description }),
            ...(template.metadata?.language && { language: template.metadata.language }) // 只在原本有language字段时才保留
          }
        };

        await this.saveTemplate(userTemplate);
        console.log(`Imported template: ${finalTemplateId} (${finalTemplateName})`);
      } catch (error) {
        console.warn('Failed to import template:', error);
        failedTemplates.push({ template, error: error as Error });
      }
    }

    if (failedTemplates.length > 0) {
      console.warn(`Failed to import ${failedTemplates.length} templates`);
      // 不抛出错误，允许部分成功的导入
    }
  }

  /**
   * 获取数据类型标识
   */
  async getDataType(): Promise<string> {
    return 'userTemplates';
  }

  /**
   * 验证模板数据格式
   */
  async validateData(data: any): Promise<boolean> {
    if (!Array.isArray(data)) {
      return false;
    }

    return data.every(item => this.validateSingleTemplate(item));
  }

  /**
   * 验证单个模板配置
   */
  private validateSingleTemplate(item: any): boolean {
    return typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.content === 'string' &&
      typeof item.isBuiltin === 'boolean' &&
      typeof item.metadata === 'object' &&
      item.metadata !== null;
  }
}

/**
 * 创建模板管理器的工厂函数
 * @param storageProvider 存储提供器实例
 * @param languageService 模板语言服务实例
 * @returns 模板管理器实例
 */
export function createTemplateManager(
  storageProvider: IStorageProvider,
  languageService: ITemplateLanguageService
): TemplateManager {
  return new TemplateManager(storageProvider, languageService);
}
