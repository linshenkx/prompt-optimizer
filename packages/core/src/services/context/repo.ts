/**
 * 上下文仓库实现
 * 
 * 基于IStorageProvider的单文档仓库，管理多个上下文的持久化：
 * - 使用单一键 'ctx:store' 存储所有上下文与当前选择
 * - 通过updateData保证原子更新与并发安全
 * - 支持导入导出功能，包含多种导入模式
 * - 预定义变量覆盖项剔除保护
 */

import type { IStorageProvider } from '../storage/types';
import type {
  ContextPackage,
  ContextStoreDoc,
  ContextListItem,
  ContextBundle,
  ContextRepo,
  ImportMode,
  ImportResult
} from './types';
import { ContextError, CONTEXT_ERROR_CODES } from './types';
import {
  CONTEXT_STORE_KEY,
  PREDEFINED_VARIABLES,
  DEFAULT_CONTEXT_CONFIG,
  CONTEXT_STORE_VERSION,
  CONTEXT_UI_LABELS,
  DEFAULT_CONTEXT_MODE
} from './constants';

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取当前时间的ISO字符串
 */
function getCurrentISOTime(): string {
  return new Date().toISOString();
}

/**
 * 基于上一次时间戳生成严格单调递增的 ISO 时间
 */
function getMonotonicISO(previous?: string): string {
  const nowIso = new Date().toISOString();
  if (!previous) return nowIso;
  // 直接字符串比较对 ISO8601 有序有效
  if (nowIso > previous) return nowIso;
  const nextMs = new Date(previous).getTime() + 1;
  return new Date(nextMs).toISOString();
}

/**
 * 检查是否为预定义变量名
 */
function isPredefinedVariable(name: string): boolean {
  return (PREDEFINED_VARIABLES as readonly string[]).includes(name);
}

/**
 * 剔除变量对象中的预定义变量覆盖项
 * @param variables 原始变量对象
 * @returns [清理后的变量对象, 被剔除的数量]
 */
function sanitizeVariables(variables: Record<string, string>): [Record<string, string>, number] {
  const sanitized: Record<string, string> = {};
  let removedCount = 0;

  for (const [name, value] of Object.entries(variables)) {
    if (isPredefinedVariable(name)) {
      removedCount++;
      // 只记录警告，不输出console（按照要求）
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[ContextRepo] Removed predefined variable override: ${name}`);
      }
    } else {
      sanitized[name] = value;
    }
  }

  return [sanitized, removedCount];
}

/**
 * 上下文仓库实现类
 */
export class ContextRepoImpl implements ContextRepo {
  private storage: IStorageProvider;

  constructor(storage: IStorageProvider) {
    this.storage = storage;
  }

  // === 私有辅助方法 ===

  /**
   * 获取存储文档，如果不存在则初始化
   */
  private async getStoreDoc(): Promise<ContextStoreDoc> {
    const data = await this.storage.getItem(CONTEXT_STORE_KEY);
    
    if (!data) {
      // 初始化默认文档
      const now = getCurrentISOTime();
      const defaultContext: ContextPackage = {
        id: DEFAULT_CONTEXT_CONFIG.id,
        title: DEFAULT_CONTEXT_CONFIG.title,
        mode: DEFAULT_CONTEXT_MODE,
        version: DEFAULT_CONTEXT_CONFIG.version,
        createdAt: now,
        updatedAt: now,
        messages: [],
        variables: {},
        tools: [],
        tags: [],
        description: '',
        meta: {}
      };

      const doc: ContextStoreDoc = {
        version: CONTEXT_STORE_VERSION,
        currentId: DEFAULT_CONTEXT_CONFIG.id,
        contexts: {
          [DEFAULT_CONTEXT_CONFIG.id]: defaultContext
        }
      };

      // 立即保存初始文档
      await this.storage.setItem(CONTEXT_STORE_KEY, JSON.stringify(doc));
      return doc;
    }

    try {
      const doc = JSON.parse(data) as ContextStoreDoc;

      // 基础验证
      if (!doc.currentId || !doc.contexts || typeof doc.contexts !== 'object') {
        throw new ContextError(CONTEXT_ERROR_CODES.INVALID_STORE, 'Invalid document structure');
      }

      // 迁移逻辑：为旧文档的上下文补写 mode 字段
      let migrated = false;
      for (const ctx of Object.values(doc.contexts)) {
        if (!ctx.mode) {
          ctx.mode = DEFAULT_CONTEXT_MODE;
          migrated = true;
        }
      }

      // 如果有迁移，需要保存回存储
      if (migrated) {
        await this.storage.setItem(CONTEXT_STORE_KEY, JSON.stringify(doc));
        if (process.env.NODE_ENV === 'development') {
          console.log('[ContextRepo] Migrated contexts to add mode field');
        }
      }

      // 确保currentId对应的上下文存在
      if (!doc.contexts[doc.currentId]) {
        // 修复：选择第一个可用的上下文
        const availableIds = Object.keys(doc.contexts);
        if (availableIds.length > 0) {
          doc.currentId = availableIds[0];
        } else {
          throw new ContextError(CONTEXT_ERROR_CODES.INVALID_STORE, 'No contexts available');
        }
      }

      return doc;
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error)
      throw new ContextError(
        CONTEXT_ERROR_CODES.STORAGE_ERROR,
        `Failed to parse context store: ${details}`,
        { details },
      );
    }
  }

  /**
   * 更新存储文档
   */
  private async updateStoreDoc(
    updater: (doc: ContextStoreDoc) => ContextStoreDoc
  ): Promise<ContextStoreDoc> {
    let updatedDoc: ContextStoreDoc;

    await this.storage.updateData<ContextStoreDoc>(
      CONTEXT_STORE_KEY,
      (currentDoc: ContextStoreDoc | null) => {
        // 如果当前数据为空，创建完整的默认文档
        let baseDoc: ContextStoreDoc;
        if (!currentDoc) {
          const now = getCurrentISOTime();
          const defaultContext: ContextPackage = {
            id: DEFAULT_CONTEXT_CONFIG.id,
            title: DEFAULT_CONTEXT_CONFIG.title,
            mode: DEFAULT_CONTEXT_MODE,
            version: DEFAULT_CONTEXT_CONFIG.version,
            createdAt: now,
            updatedAt: now,
            messages: [],
            variables: {},
            tools: [],
            tags: [],
            description: '',
            meta: {}
          };
          baseDoc = {
            version: CONTEXT_STORE_VERSION,
            currentId: DEFAULT_CONTEXT_CONFIG.id,
            contexts: {
              [DEFAULT_CONTEXT_CONFIG.id]: defaultContext
            }
          };
        } else {
          baseDoc = currentDoc;
        }

        updatedDoc = updater(baseDoc);
        return updatedDoc;
      }
    );

    return updatedDoc!;
  }

  // === 公共API方法 ===

  async list(): Promise<ContextListItem[]> {
    const doc = await this.getStoreDoc();
    
    return Object.values(doc.contexts).map(ctx => ({
      id: ctx.id,
      title: ctx.title,
      updatedAt: ctx.updatedAt
    })).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getCurrentId(): Promise<string> {
    const doc = await this.getStoreDoc();
    return doc.currentId;
  }

  async setCurrentId(id: string): Promise<void> {
    await this.updateStoreDoc(doc => {
      if (!doc.contexts[id]) {
        throw new ContextError(CONTEXT_ERROR_CODES.NOT_FOUND, undefined, { context: id });
      }
      doc.currentId = id;
      return doc;
    });
  }

  async get(id: string): Promise<ContextPackage> {
    const doc = await this.getStoreDoc();
    const context = doc.contexts[id];
    
    if (!context) {
      throw new ContextError(CONTEXT_ERROR_CODES.NOT_FOUND, undefined, { context: id });
    }

    return { ...context };
  }

  async create(meta?: { title?: string; mode?: import('./types').ContextMode }): Promise<string> {
    const id = generateId();
    const now = getCurrentISOTime();

    const newContext: ContextPackage = {
      id,
      title: meta?.title || `${CONTEXT_UI_LABELS.DEFAULT_TITLE_TEMPLATE} ${new Date().toLocaleDateString()}`,
      mode: meta?.mode || DEFAULT_CONTEXT_MODE,
      version: DEFAULT_CONTEXT_CONFIG.version,
      createdAt: now,
      updatedAt: now,
      messages: [],
      variables: {},
      tools: [],
      tags: [],
      description: '',
      meta: {}
    };

    await this.updateStoreDoc(doc => {
      doc.contexts[id] = newContext;
      return doc;
    });

    return id;
  }

  async duplicate(id: string, options?: { mode?: import('./types').ContextMode }): Promise<string> {
    const originalCtx = await this.get(id); // 会抛出错误如果不存在
    const newId = generateId();
    const now = getCurrentISOTime();

    // 复制时也需要清理变量
    const [sanitizedVariables] = sanitizeVariables(originalCtx.variables);

    const newContext: ContextPackage = {
      ...originalCtx,
      id: newId,
      title: `${originalCtx.title} ${CONTEXT_UI_LABELS.DUPLICATE_SUFFIX}`,
      mode: options?.mode || originalCtx.mode || DEFAULT_CONTEXT_MODE,
      variables: sanitizedVariables,
      createdAt: now,
      updatedAt: now
    };

    await this.updateStoreDoc(doc => {
      doc.contexts[newId] = newContext;
      return doc;
    });

    return newId;
  }

  async rename(id: string, title: string): Promise<void> {
    await this.updateStoreDoc(doc => {
      const context = doc.contexts[id];
      if (!context) {
        throw new ContextError(CONTEXT_ERROR_CODES.NOT_FOUND, undefined, { context: id });
      }

      context.title = title;
      context.updatedAt = getMonotonicISO(context.updatedAt);
      return doc;
    });
  }

  async save(ctx: ContextPackage): Promise<void> {
    // 剔除预定义变量覆盖项
    const [sanitizedVariables, removedCount] = sanitizeVariables(ctx.variables);
    
    const contextToSave: ContextPackage = {
      ...ctx,
      mode: ctx.mode || DEFAULT_CONTEXT_MODE,
      variables: sanitizedVariables,
      updatedAt: getCurrentISOTime()
    };

    await this.updateStoreDoc(doc => {
      doc.contexts[ctx.id] = contextToSave;
      return doc;
    });

    if (removedCount > 0 && process.env.NODE_ENV === 'development') {
      console.warn(`[ContextRepo] Removed ${removedCount} predefined variable overrides during save`);
    }
  }

  async update(id: string, patch: Partial<ContextPackage>): Promise<void> {
    await this.updateStoreDoc(doc => {
      const context = doc.contexts[id];
      if (!context) {
        throw new ContextError(CONTEXT_ERROR_CODES.NOT_FOUND, undefined, { context: id });
      }

      // 处理变量更新时的预定义变量剔除
      let sanitizedVariables = patch.variables;
      let removedCount = 0;
      
      if (patch.variables) {
        [sanitizedVariables, removedCount] = sanitizeVariables(patch.variables);
      }

      // 只读字段保护：剔除不可变字段，只允许更新特定字段
      const allowedFields = ['title', 'messages', 'tools', 'tags', 'description', 'meta'] as const;
      const safeUpdate: Partial<ContextPackage> = {};
      
      for (const field of allowedFields) {
        if (field in patch && patch[field] !== undefined) {
          (safeUpdate as any)[field] = patch[field];
        }
      }
      
      // 合并安全的更新字段
      Object.assign(context, safeUpdate, {
        mode: patch.mode ?? context.mode ?? DEFAULT_CONTEXT_MODE,
        variables: sanitizedVariables || context.variables,
        updatedAt: getMonotonicISO(context.updatedAt)
      });

      if (removedCount > 0 && process.env.NODE_ENV === 'development') {
        console.warn(`[ContextRepo] Removed ${removedCount} predefined variable overrides during update`);
      }

      return doc;
    });
  }

  async remove(id: string): Promise<void> {
    await this.updateStoreDoc(doc => {
      // 先检查上下文是否存在
      if (!doc.contexts[id]) {
        throw new ContextError(CONTEXT_ERROR_CODES.NOT_FOUND, undefined, { context: id });
      }

      const contextIds = Object.keys(doc.contexts);
      
      // 再检查是否为最后一个上下文
      if (contextIds.length <= 1) {
        throw new ContextError(CONTEXT_ERROR_CODES.MINIMUM_VIOLATION);
      }

      // 删除上下文
      delete doc.contexts[id];

      // 如果删除的是当前上下文，需要切换到其他上下文
      if (doc.currentId === id) {
        const remainingIds = Object.keys(doc.contexts);
        // 优先选择default，否则选择第一个可用的
        doc.currentId = remainingIds.includes(DEFAULT_CONTEXT_CONFIG.id) 
          ? DEFAULT_CONTEXT_CONFIG.id 
          : remainingIds[0];
      }

      return doc;
    });
  }

  async exportAll(): Promise<ContextBundle> {
    const doc = await this.getStoreDoc();
    
    return {
      type: 'context-bundle',
      version: CONTEXT_STORE_VERSION,
      currentId: doc.currentId,
      contexts: Object.values(doc.contexts)
    };
  }

  async importAll(bundle: ContextBundle, mode: ImportMode): Promise<ImportResult> {
    // 验证bundle格式
    if (!bundle || bundle.type !== 'context-bundle' || !Array.isArray(bundle.contexts)) {
      throw new ContextError(CONTEXT_ERROR_CODES.IMPORT_FORMAT_ERROR, 'Invalid context bundle format');
    }

    if (bundle.contexts.length === 0) {
      throw new ContextError(CONTEXT_ERROR_CODES.IMPORT_FORMAT_ERROR, 'Context bundle must contain at least one context');
    }

    let imported = 0;
    let skipped = 0;
    let predefinedVariablesRemoved = 0;
    const idMapping: Record<string, string> = {};

    await this.updateStoreDoc(doc => {
      const now = getCurrentISOTime();

      switch (mode) {
        case 'replace':
          // 替换模式：清空现有数据
          doc.contexts = {};
          doc.currentId = bundle.currentId;
          
          // 导入所有上下文
          for (const ctx of bundle.contexts) {
            try {
              const [sanitizedVariables, removedCount] = sanitizeVariables(ctx.variables);
              predefinedVariablesRemoved += removedCount;

              const contextToImport: ContextPackage = {
                ...ctx,
                mode: ctx.mode || DEFAULT_CONTEXT_MODE,
                variables: sanitizedVariables,
                updatedAt: now
              };

              doc.contexts[ctx.id] = contextToImport;
              imported++;
            } catch (error) {
              skipped++;
            }
          }

          // 验证currentId是否有效
          if (!doc.contexts[doc.currentId] && Object.keys(doc.contexts).length > 0) {
            doc.currentId = Object.keys(doc.contexts)[0];
          }
          break;

        case 'append':
          // 追加模式：处理ID冲突
          for (const ctx of bundle.contexts) {
            try {
              const [sanitizedVariables, removedCount] = sanitizeVariables(ctx.variables);
              predefinedVariablesRemoved += removedCount;

              let finalId = ctx.id;
              
              // 如果ID冲突，生成新ID
              if (doc.contexts[ctx.id]) {
                finalId = generateId();
                idMapping[ctx.id] = finalId;
              }

              const contextToImport: ContextPackage = {
                ...ctx,
                id: finalId,
                mode: ctx.mode || DEFAULT_CONTEXT_MODE,
                variables: sanitizedVariables,
                updatedAt: now
              };

              doc.contexts[finalId] = contextToImport;
              imported++;
            } catch (error) {
              skipped++;
            }
          }
          break;

        case 'merge':
          // 合并模式：同ID覆盖，变量合并
          for (const ctx of bundle.contexts) {
            try {
              const [sanitizedVariables, removedCount] = sanitizeVariables(ctx.variables);
              predefinedVariablesRemoved += removedCount;

              if (doc.contexts[ctx.id]) {
                // 存在同ID：合并变量，其他字段以导入为准
                const existingCtx = doc.contexts[ctx.id];
                const mergedVariables = {
                  ...existingCtx.variables,
                  ...sanitizedVariables
                };

                doc.contexts[ctx.id] = {
                  ...ctx,
                  mode: ctx.mode || existingCtx.mode || DEFAULT_CONTEXT_MODE,
                  variables: mergedVariables,
                  updatedAt: now
                };
              } else {
                // 新ID：直接添加
                doc.contexts[ctx.id] = {
                  ...ctx,
                  mode: ctx.mode || DEFAULT_CONTEXT_MODE,
                  variables: sanitizedVariables,
                  updatedAt: now
                };
              }
              imported++;
            } catch (error) {
              skipped++;
            }
          }
          break;
      }

      // 确保至少有一个上下文存在
      if (Object.keys(doc.contexts).length === 0) {
        throw new ContextError(CONTEXT_ERROR_CODES.IMPORT_FORMAT_ERROR, 'Import failed: No valid contexts found');
      }

      // 确保currentId有效
      if (!doc.contexts[doc.currentId]) {
        doc.currentId = Object.keys(doc.contexts)[0];
      }

      return doc;
    });

    const result: ImportResult = {
      imported,
      skipped,
      predefinedVariablesRemoved
    };

    if (Object.keys(idMapping).length > 0) {
      result.idMapping = idMapping;
    }

    return result;
  }

  // === IImportExportable 实现 ===

  async exportData(): Promise<ContextBundle> {
    return this.exportAll();
  }

  async importData(data: any): Promise<void> {
    if (!(await this.validateData(data))) {
      throw new ContextError(CONTEXT_ERROR_CODES.IMPORT_FORMAT_ERROR, 'Invalid import data format');
    }
    
    await this.importAll(data as ContextBundle, 'replace');
  }

  async getDataType(): Promise<string> {
    return 'context-bundle';
  }

  async validateData(data: any): Promise<boolean> {
    return !!(
      data &&
      data.type === 'context-bundle' &&
      typeof data.version === 'string' &&
      typeof data.currentId === 'string' &&
      Array.isArray(data.contexts) &&
      data.contexts.length > 0
    );
  }
}

/**
 * 创建ContextRepo实例的工厂函数
 */
export function createContextRepo(storage: IStorageProvider): ContextRepo {
  return new ContextRepoImpl(storage);
}
