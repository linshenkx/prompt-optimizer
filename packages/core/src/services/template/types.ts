import { z } from 'zod';
import { IImportExportable } from '../../interfaces/import-export';
import type { BuiltinTemplateLanguage } from './languageService';
import type { ToolCall } from '../prompt/types';

/**
 * 提示词元数据
 */
export interface TemplateMetadata {
  version: string;          // 提示词版本
  lastModified: number;     // 最后修改时间
  author?: string;          // 作者（可选）
  description?: string;     // 描述（可选）
  templateType: 'optimize' | 'userOptimize' | 'text2imageOptimize' | 'image2imageOptimize' | 'imageIterate' | 'iterate' | 'conversationMessageOptimize' | 'contextUserOptimize' | 'contextIterate'; // 模板类型标识
  language?: 'zh' | 'en';   // 模板语言（可选，主要用于内置模板语言切换）
  [key: string]: any;       // 允许任意额外字段
}

/**
 * 消息模板定义
 */
export interface MessageTemplate {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * 提示词定义
 */
export interface Template {
  id: string;              // 提示词唯一标识
  name: string;            // 提示词名称
  content: string | MessageTemplate[];         // 提示词内容 - 支持字符串或消息数组
  metadata: TemplateMetadata;
  isBuiltin?: boolean;     // 是否为内置提示词
}

/**
 * 提示词来源类型
 */
export type TemplateSourceType = 'builtin' | 'localStorage';

// TemplateManagerConfig 已删除 - 配置参数从未被使用

/**
 * 提示词管理器接口
 */
export interface ITemplateManager extends IImportExportable {
  /**
   * Get a template by ID
   */
  getTemplate(id: string): Promise<Template>;

  /**
   * Save a template
   */
  saveTemplate(template: Template): Promise<void>;

  /**
   * Delete a template
   */
  deleteTemplate(id: string): Promise<void>;

  /**
   * List all templates
   */
  listTemplates(): Promise<Template[]>;

  /**
   * Export a template as JSON string
   */
  exportTemplate(id: string): Promise<string>;

  /**
   * Import a template from JSON string
   */
  importTemplate(jsonString: string): Promise<void>;

  /**
   * List templates by type
   */
  listTemplatesByType(type: 'optimize' | 'userOptimize' | 'text2imageOptimize' | 'image2imageOptimize' | 'imageIterate' | 'iterate' | 'contextUserOptimize' | 'contextIterate' | 'conversationMessageOptimize'): Promise<Template[]>;

  /**
   * Change built-in template language
   */
  changeBuiltinTemplateLanguage(language: BuiltinTemplateLanguage): Promise<void>;

  /**
   * Get current built-in template language
   */
  getCurrentBuiltinTemplateLanguage(): Promise<BuiltinTemplateLanguage>;

  /**
   * Get supported built-in template languages
   */
  getSupportedBuiltinTemplateLanguages(): Promise<BuiltinTemplateLanguage[]>;
}

/**
 * 消息模板验证Schema
 */
export const messageTemplateSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().min(1)
});

/**
 * 提示词验证Schema
 */
export const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  content: z.union([
    z.string().min(1),
    z.array(messageTemplateSchema).min(1)
  ]),
  metadata: z.object({
    version: z.string(),
    lastModified: z.number(),
    author: z.string().optional(),
    description: z.string().optional(),
    templateType: z.enum(['optimize', 'userOptimize', 'text2imageOptimize', 'image2imageOptimize', 'imageIterate', 'iterate', 'conversationMessageOptimize', 'contextUserOptimize', 'contextIterate']),
    language: z.enum(['zh', 'en']).optional()
  }).passthrough(), // 允许额外字段通过验证
  isBuiltin: z.boolean().optional()
});
