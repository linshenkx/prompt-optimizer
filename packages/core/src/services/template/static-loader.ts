import { Template } from './types';
import { ALL_TEMPLATES } from './default-templates';

/**
 * 静态模板加载器 - 简化版
 *
 * 🎯 极简设计：模板自身包含完整信息（id、name、language、type等）
 * 🔄 直接使用：无需复杂的元数据推导和映射
 */

// 类型定义
export type TemplateType = 'optimize' | 'iterate' | 'user-optimize';
export type Language = 'zh' | 'en' | 'ru';

export interface StaticTemplateCollection {
  all: Record<string, Template>;
  byLanguage: Record<Language, Record<string, Template>>;
  byType: Record<TemplateType, Record<Language, Record<string, Template>>>;
}

export class StaticLoader {
  private static templateCache: StaticTemplateCollection | null = null;

  /**
   * 静态加载器总是支持的（因为使用的是静态导入）
   */
  public isSupported(): boolean {
    return true;
  }

  /**
   * 语言映射：将 TemplateManager 的语言标识符映射到标准语言标识符
   */
  private mapLanguage(language: string): Language {
    switch (language) {
      case 'zh-CN':
      case 'zh':
        return 'zh';
      case 'en-US':
      case 'en':
        return 'en';
      case 'ru-RU':
      case 'ru':
        return 'ru';
      default:
        console.warn(`Unknown language: ${language}, defaulting to zh`);
        return 'zh';
    }
  }

  /**
   * 加载所有模板（使用模板自身的完整信息）
   */
  public loadTemplates(): StaticTemplateCollection {
    if (StaticLoader.templateCache) {
      return StaticLoader.templateCache;
    }

    try {
      console.log(`🔄 静态导入开始加载模板...`);
      
      const all: Record<string, Template> = {};
      const byLanguage: Record<Language, Record<string, Template>> = { zh: {}, en: {}, ru: {} };
      const byType: Record<TemplateType, Record<Language, Record<string, Template>>> = {
        'optimize': { zh: {}, en: {}, ru: {} },
        'iterate': { zh: {}, en: {}, ru: {} },
        'user-optimize': { zh: {}, en: {}, ru: {} }
      };

      // 处理每个模板
      Object.values(ALL_TEMPLATES).forEach(template => {
        const { id, metadata } = template;
        const { language, templateType } = metadata;
        
        // 验证内置模板必须包含language字段
        if (template.isBuiltin && !language) {
          console.error(`❌ 内置模板缺少language字段: ${id}`);
          throw new Error(`Built-in template '${id}' is missing required 'language' field in metadata`);
        }
        
        // 规范化模板类型
        const normalizedType: TemplateType = templateType === 'userOptimize' ? 'user-optimize' : templateType as TemplateType;
        
        // 存储到各个分类中
        all[id] = template;
        
        // 只有内置模板且有language字段时才按语言分类
        if (template.isBuiltin && language) {
          byLanguage[language][id] = template;
          byType[normalizedType][language][id] = template;
        }
      });

      const result = { all, byLanguage, byType };
      
      console.log(`✅ 成功加载 ${Object.keys(all).length} 个模板`, {
        '总数': Object.keys(all).length,
        '中文': Object.keys(byLanguage.zh).length,
        '英文': Object.keys(byLanguage.en).length,
        optimize: Object.keys(byType.optimize.zh).length + Object.keys(byType.optimize.en).length,
        iterate: Object.keys(byType.iterate.zh).length + Object.keys(byType.iterate.en).length,
        'user-optimize': Object.keys(byType['user-optimize'].zh).length + Object.keys(byType['user-optimize'].en).length
      });

      StaticLoader.templateCache = result;
      return result;

    } catch (error) {
      console.error('❌ 静态导入加载模板失败:', error);
      throw new Error(`Failed to load static templates: ${error}`);
    }
  }

  /**
   * 根据语言加载模板
   */
  public loadTemplatesByLanguage(language: string): Record<string, Template> {
    const mappedLanguage = this.mapLanguage(language);
    const collection = this.loadTemplates();
    return collection.byLanguage[mappedLanguage];
  }

  /**
   * 根据类型和语言获取模板
   */
  public getTemplatesByType(type: TemplateType, language: string = 'zh'): Record<string, Template> {
    const mappedLanguage = this.mapLanguage(language);
    const collection = this.loadTemplates();
    return collection.byType[type][mappedLanguage];
  }

  /**
   * 获取所有模板 ID
   */
  public getAllTemplateIds(): string[] {
    const collection = this.loadTemplates();
    return Object.keys(collection.all);
  }

  /**
   * 获取默认中文模板集合
   */
  public getDefaultTemplates(): Record<string, Template> {
    return this.loadTemplatesByLanguage('zh');
  }

  /**
   * 获取默认英文模板集合
   */
  public getDefaultTemplatesEn(): Record<string, Template> {
    return this.loadTemplatesByLanguage('en');
  }

  /**
   * 获取加载状态信息
   */
  public getLoaderStatus() {
    const collection = this.loadTemplates();
    return {
      isSupported: this.isSupported(),
      totalTemplates: Object.keys(collection.all).length,
      byLanguage: {
        zh: Object.keys(collection.byLanguage.zh).length,
        en: Object.keys(collection.byLanguage.en).length
      }
    };
  }

  /**
   * 重新加载模板（清除缓存）
   */
  public reloadTemplates(): Record<string, Template> {
    StaticLoader.templateCache = null;
    return this.getDefaultTemplates();
  }
}

// 创建单例实例
const staticLoader = new StaticLoader();

// 导出单例实例供外部使用
export { staticLoader }; 