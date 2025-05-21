import { z } from 'zod';

/**
 * 提示词元数据
 */
export interface TemplateMetadata {
  version: string;          // 提示词版本
  lastModified: number;     // 最后修改时间
  author?: string;          // 作者（可选）
  description?: string;     // 描述（可选）
  templateType: 'optimize' | 'iterate'; // 新增类型标识
}

/**
 * 提示词定义
 */
export interface Template {
  id: string;              // 提示词唯一标识
  name: string;            // 提示词名称
  content: string;         // 提示词内容
  metadata: TemplateMetadata;
  isBuiltin?: boolean;     // 是否为内置提示词
}

/**
 * 提示词来源类型
 */
export type TemplateSourceType = 'builtin' | 'localStorage';

/**
 * 提示词管理器配置
 */
export interface TemplateManagerConfig {
  storageKey?: string;     // localStorage存储键名
  cacheTimeout?: number;   // 缓存超时时间
}

/**
 * 提示词管理器接口
 */
export interface ITemplateManager {
  /** 获取指定ID的模板 */
  getTemplate(templateId: string): Template; // Stays synchronous

  /** 保存模板 */
  saveTemplate(template: Template): Promise<void>; // Async

  /** 删除模板 */
  deleteTemplate(templateId: string): Promise<void>; // Async

  /** 列出所有模板 */
  listTemplates(): Template[]; // Stays synchronous

  /** 导出模板 */
  exportTemplate(templateId: string): string; // Stays synchronous

  /** 导入模板 */
  importTemplate(templateJson: string): Promise<void>; // Async

  /** 清除缓存 */
  clearCache(templateId?: string): void; // Synchronous
  
  /** 按类型列出模板 */
  listTemplatesByType(type: 'optimize' | 'iterate'): Template[];
  
  /** 
   * 根据类型获取模板列表（已废弃）
   * @deprecated 使用 listTemplatesByType 替代
   */
  getTemplatesByType(type: 'optimize' | 'iterate'): Template[];
}

/**
 * 提示词验证Schema
 */
export const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  content: z.string().min(1),
  metadata: z.object({
    version: z.string(),
    lastModified: z.number(),
    author: z.string().optional(),
    description: z.string().optional(),
    templateType: z.enum(['optimize', 'iterate'])
  }),
  isBuiltin: z.boolean().optional()
}); 