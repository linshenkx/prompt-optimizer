/**
 * 上下文相关类型定义
 * 
 * 该模块定义了上下文持久化与变量管理的核心数据结构：
 * - ContextPackage: 单个上下文的完整数据包
 * - ContextStoreDoc: 单文档仓库的存储结构（包含所有上下文与当前选择）
 * - ContextRepo: 上下文仓库服务接口
 * - ContextBundle: 导入导出的数据包格式
 */

import type { IImportExportable } from '../../interfaces/import-export';
import type { ConversationMessage, ToolDefinition } from '../prompt/types';
import { CONTEXT_ERROR_CODES, type ErrorParams } from '../../constants/error-codes';

/**
 * 上下文模式
 * - system: 系统模式，保留完整的消息编辑能力
 * - user: 用户模式，聚焦于变量与工具管理
 */
export type ContextMode = 'system' | 'user';

/**
 * 上下文数据包
 * 包含一个完整上下文的所有信息：消息、变量覆盖、工具等
 */
export interface ContextPackage {
  /** 上下文唯一标识符 */
  id: string;
  /** 上下文标题 */
  title: string;
  /** 上下文模式 */
  mode: ContextMode;
  /** 数据版本，用于未来兼容性 */
  version?: string;
  /** 创建时间（ISO字符串） */
  createdAt: string;
  /** 最后更新时间（ISO字符串） */
  updatedAt: string;
  /** 对话消息列表 */
  messages: ConversationMessage[];
  /** 变量覆盖项（仅包含上下文级覆盖，不包含全局变量） */
  variables: Record<string, string>;
  /** 工具定义列表 */
  tools: ToolDefinition[];
  /** 标签列表，用于分类和搜索 */
  tags?: string[];
  /** 上下文描述 */
  description?: string;
  /** 元数据，用于扩展 */
  meta?: Record<string, any>;
}

/**
 * 上下文存储文档
 * 单文档仓库的根数据结构，包含所有上下文与当前选择
 */
export interface ContextStoreDoc {
  /** 文档格式版本 */
  version: '1.0.0';
  /** 当前选中的上下文ID */
  currentId: string;
  /** 所有上下文的映射表 */
  contexts: Record<string, ContextPackage>;
}

/**
 * 上下文列表项
 * 用于列表显示的精简信息
 */
export interface ContextListItem {
  /** 上下文ID */
  id: string;
  /** 上下文标题 */
  title: string;
  /** 最后更新时间（ISO字符串） */
  updatedAt: string;
}

/**
 * 上下文导入导出包
 * 用于上下文集合的迁移和分享
 */
export interface ContextBundle {
  /** 数据包类型标识 */
  type: 'context-bundle';
  /** 数据包版本 */
  version: '1.0.0';
  /** 当前选中的上下文ID */
  currentId: string;
  /** 上下文列表 */
  contexts: ContextPackage[];
}

/**
 * 导入模式
 */
export type ImportMode = 'replace' | 'append' | 'merge';

/**
 * 导入结果统计
 */
export interface ImportResult {
  /** 成功导入的上下文数量 */
  imported: number;
  /** 跳过的上下文数量（格式错误等） */
  skipped: number;
  /** 被剔除的预定义变量覆盖项数量 */
  predefinedVariablesRemoved: number;
  /** 生成的新ID映射（用于append模式ID冲突处理） */
  idMapping?: Record<string, string>;
}

/**
 * 上下文仓库接口
 * 提供上下文的增删改查、导入导出等功能
 */
export interface ContextRepo extends IImportExportable {
  // === 基础查询 ===
  /**
   * 获取上下文列表
   * @returns 上下文列表项数组
   */
  list(): Promise<ContextListItem[]>;

  /**
   * 获取当前选中的上下文ID
   * @returns 当前上下文ID
   */
  getCurrentId(): Promise<string>;

  /**
   * 设置当前选中的上下文ID
   * @param id 要设置的上下文ID
   * @throws 如果指定ID不存在则抛出错误
   */
  setCurrentId(id: string): Promise<void>;

  /**
   * 获取指定上下文的完整数据
   * @param id 上下文ID
   * @returns 上下文数据包
   * @throws 如果指定ID不存在则抛出错误
   */
  get(id: string): Promise<ContextPackage>;

  // === 内容管理 ===
  /**
   * 创建新的上下文
   * @param meta 可选的元数据（标题、模式等）
   * @returns 新创建的上下文ID
   */
  create(meta?: { title?: string; mode?: ContextMode }): Promise<string>;

  /**
   * 复制现有上下文
   * @param id 要复制的上下文ID
   * @param options 可选配置，包括模式
   * @returns 新创建的上下文ID
   * @throws 如果源ID不存在则抛出错误
   */
  duplicate(id: string, options?: { mode?: ContextMode }): Promise<string>;

  /**
   * 重命名上下文
   * @param id 上下文ID
   * @param title 新标题
   * @throws 如果指定ID不存在则抛出错误
   */
  rename(id: string, title: string): Promise<void>;

  /**
   * 保存完整的上下文数据（覆盖模式）
   * @param ctx 上下文数据包
   */
  save(ctx: ContextPackage): Promise<void>;

  /**
   * 更新上下文的部分数据（合并模式）
   * @param id 上下文ID
   * @param patch 要更新的字段
   * @throws 如果指定ID不存在则抛出错误
   */
  update(id: string, patch: Partial<ContextPackage>): Promise<void>;

  /**
   * 删除上下文
   * @param id 上下文ID
   * @throws 如果指定ID不存在或为最后一个上下文则抛出错误
   */
  remove(id: string): Promise<void>;

  // === 导入导出 ===
  /**
   * 导出所有上下文
   * @returns 上下文导入导出包
   */
  exportAll(): Promise<ContextBundle>;

  /**
   * 导入上下文集合
   * @param bundle 上下文导入导出包
   * @param mode 导入模式
   * @returns 导入结果统计
   */
  importAll(bundle: ContextBundle, mode: ImportMode): Promise<ImportResult>;
}

/**
 * 上下文服务错误类
 */
export class ContextError extends Error {
  public readonly code: string
  public readonly params?: ErrorParams

  constructor(code: string, message?: string, params?: ErrorParams) {
    super(message ? `[${code}] ${message}` : `[${code}]`)
    this.name = 'ContextError'
    this.code = code
    this.params = params ?? (message ? { details: message } : undefined)
  }
}

export { CONTEXT_ERROR_CODES }
