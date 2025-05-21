import { ITemplateManager, Template, TemplateManagerConfig, templateSchema } from './types';
import { DEFAULT_TEMPLATES } from './defaults';
import { TemplateError, TemplateValidationError } from './errors';
import { IStorageProvider } from '../storage/types';
import { LocalStorageProvider } from '../storage/localStorageProvider';

/**
 * 提示词管理器实现
 */
export class TemplateManager implements ITemplateManager {
  private readonly builtinTemplates: Map<string, Template>;
  private readonly userTemplates: Map<string, Template>;
  private readonly config: Required<TemplateManagerConfig>;

  constructor(private storageProvider: IStorageProvider, config?: TemplateManagerConfig) {
    this.builtinTemplates = new Map();
    this.userTemplates = new Map();
    this.config = {
      storageKey: 'app:templates',
      cacheTimeout: 5 * 60 * 1000,
      ...config
    };

    // 在构造函数中执行初始化
    this.init().catch(err => console.error('Error during TemplateManager init:', err));
  }

  /**
   * 私有初始化方法
   */
  private async init(): Promise<void> {
    try {
      // 需要先清空已有提示词避免重复加载
      this.builtinTemplates.clear();
      this.userTemplates.clear();

      // 加载内置提示词需要深拷贝避免引用问题
      for (const [id, template] of Object.entries(DEFAULT_TEMPLATES)) {
        this.builtinTemplates.set(id, JSON.parse(JSON.stringify({
          ...template,
          isBuiltin: true
        })));
      }

      // 增加加载后的验证
      if (this.builtinTemplates.size === 0) {
        throw new TemplateError('内置提示词加载失败');
      }

      await this.loadUserTemplates();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('模板管理器初始化失败:', errorMessage);
      throw new TemplateError(`初始化失败: ${errorMessage}`);
    }
  }

  /**
   * 获取提示词
   */
  getTemplate(templateId: string): Template {
    // 增加空值校验
    if (!templateId || typeof templateId !== 'string') {
      throw new TemplateError('无效的提示词ID');
    }

    // 优先检查用户提示词
    const template = this.userTemplates.get(templateId) || 
                    this.builtinTemplates.get(templateId);
    
    if (!template) {
      // 增加调试信息
      console.error(`提示词 ${templateId} 不存在， 可用提示词:`, [...this.builtinTemplates.keys(), ...this.userTemplates.keys()]);
      throw new TemplateError(`提示词 ${templateId} 不存在`);
    }
    
    // 返回深拷贝避免外部修改
    return JSON.parse(JSON.stringify(template));
  }

  /**
   * 保存用户提示词
   */
  async saveTemplate(template: Template): Promise<void> {
    // 增加类型校验
    if (!['optimize', 'iterate'].includes(template.metadata.templateType)) {
      throw new TemplateValidationError('无效的提示词类型');
    }

    // 增加ID格式校验
    if (!/^[a-zA-Z0-9_-]{3,50}$/.test(template.id)) {
      throw new TemplateValidationError('提示词ID格式无效（3-50位字母数字）');
    }

    // 保留原始提示词的不可变属性
    if (this.userTemplates.has(template.id)) {
      const original = this.userTemplates.get(template.id)!;
      template = {
        ...original,
        ...template,
        metadata: {
          ...original.metadata,
          ...template.metadata,
          lastModified: Date.now()
        }
      };
    }

    // 验证提示词
    const result = templateSchema.safeParse(template);
    if (!result.success) {
      throw new TemplateValidationError(`提示词验证失败: ${result.error.message}`);
    }

    // 不允许覆盖内置提示词
    if (this.builtinTemplates.has(template.id)) {
      throw new TemplateError(`不能覆盖内置提示词: ${template.id}`);
    }

    // 只在没有时间戳时设置
    if (!template.metadata.lastModified) {
      template.metadata.lastModified = Date.now();
    }

    // 保存提示词
    this.userTemplates.set(template.id, { ...template, isBuiltin: false });
    await this.persistUserTemplates();
  }

  /**
   * 删除用户提示词
   */
  async deleteTemplate(templateId: string): Promise<void> {
    if (this.builtinTemplates.has(templateId)) {
      throw new TemplateError(`不能删除内置提示词: ${templateId}`);
    }

    if (!this.userTemplates.has(templateId)) {
      throw new TemplateError(`提示词不存在: ${templateId}`);
    }

    this.userTemplates.delete(templateId);
    await this.persistUserTemplates();
  }

  /**
   * 列出所有提示词
   */
  listTemplates(): Template[] {
    const templates = [
      ...Array.from(this.builtinTemplates.values()),
      ...Array.from(this.userTemplates.values())
    ];
    return templates.sort((a, b) => {
      // 内置提示词排在前面
      if (a.isBuiltin !== b.isBuiltin) {
        return a.isBuiltin ? -1 : 1;
      }
      
      // 非内置提示词按时间戳倒序
      if (!a.isBuiltin && !b.isBuiltin) {
        const timeA = a.metadata.lastModified || 0;
        const timeB = b.metadata.lastModified || 0;
        return timeB - timeA;
      }
      
      return 0;
    });
  }

  /**
   * 导出提示词
   */
  exportTemplate(templateId: string): string {
    const template = this.userTemplates.get(templateId) || 
                    this.builtinTemplates.get(templateId);
    if (!template) {
      throw new TemplateError(`提示词不存在: ${templateId}`);
    }
    return JSON.stringify(template, null, 2);
  }

  /**
   * 导入提示词
   */
  async importTemplate(templateJson: string): Promise<void> {
    try {
      const template = JSON.parse(templateJson) as Template;
      const result = templateSchema.safeParse(template);
      if (!result.success) {
        throw new TemplateValidationError(`提示词验证失败: ${result.error.errors.map((e: { message: string }) => e.message).join(', ')}`);
      }
      this.userTemplates.set(template.id, template);
      await this.persistUserTemplates();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new TemplateError(`导入提示词失败: ${errorMessage}`);
    }
  }

  /**
   * 清除缓存
   */
  clearCache(templateId?: string): void {
    if (templateId) {
      this.userTemplates.delete(templateId);
    } else {
      this.userTemplates.clear();
    }
  }

  /**
   * 持久化用户提示词
   */
  private async persistUserTemplates(): Promise<void> {
    try {
      const templates = Array.from(this.userTemplates.values());
      await this.storageProvider.setItem(this.config.storageKey, JSON.stringify(templates));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new TemplateError(`保存用户提示词失败: ${errorMessage}`);
    }
  }

  /**
   * 加载用户提示词
   */
  private async loadUserTemplates(): Promise<void> {
    try {
      const data = await this.storageProvider.getItem(this.config.storageKey);
      if (data) {
        const templates = JSON.parse(data) as Template[];
        templates.forEach(template => {
          this.userTemplates.set(template.id, template);
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new TemplateError(`加载用户提示词失败: ${errorMessage}`);
    }
  }

  /**
   * 根据提示词类型获取提示词列表
   * @deprecated 使用 listTemplatesByType 替代
   */
  getTemplatesByType(type: 'optimize' | 'iterate'): Template[] {
    return this.listTemplatesByType(type);
  }

  /**
   * 按类型列出提示词
   */
  listTemplatesByType(type: 'optimize' | 'iterate'): Template[] {
    try {
      return this.listTemplates().filter(
        template => template.metadata.templateType === type
      );
    } catch (error) {
      console.error(`获取${type}类型模板列表失败:`, error);
      return [];
    }
  }
}

// 导出单例实例
export const templateManager = new TemplateManager(new LocalStorageProvider());