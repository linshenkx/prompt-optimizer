import type { FavoritePrompt, FavoriteCategory, FavoriteStats, IFavoriteManager } from './types';
import {
  FavoriteError,
  FavoriteNotFoundError,
  FavoriteAlreadyExistsError,
  FavoriteCategoryNotFoundError,
  FavoriteValidationError,
  FavoriteStorageError,
  FavoriteTagAlreadyExistsError,
  FavoriteTagNotFoundError,
  FavoriteTagError,
  FavoriteMigrationError,
  FavoriteImportExportError
} from './errors';

declare const window: {
  electronAPI: {
    favoriteManager: IFavoriteManager;
  }
};

/**
 * Electron 收藏服务代理
 * 在渲染进程中通过 window.electronAPI 与主进程的收藏服务通信
 */
export class FavoriteManagerElectronProxy implements IFavoriteManager {

  private ensureApiAvailable() {
    const windowAny = window as any;
    if (!windowAny?.electronAPI?.favoriteManager) {
      throw new Error('Electron API not available. Please ensure preload script is loaded and window.electronAPI.favoriteManager is accessible.');
    }
  }

  private async invokeMethod<T>(method: string, ...args: any[]): Promise<T> {
    this.ensureApiAvailable();
    try {
      return await (window.electronAPI.favoriteManager as any)[method](...args);
    } catch (error: any) {
      // 将IPC错误转换为具体的错误类型
      if (error.code === 'FAVORITE_NOT_FOUND') {
        throw new FavoriteNotFoundError(error.id || '');
      }
      if (error.code === 'FAVORITE_ALREADY_EXISTS') {
        throw new FavoriteAlreadyExistsError(error.content || '');
      }
      if (error.code === 'CATEGORY_NOT_FOUND') {
        throw new FavoriteCategoryNotFoundError(error.id || '');
      }
      if (error.code === 'VALIDATION_ERROR') {
        throw new FavoriteValidationError(error.message || '');
      }
      if (error.code === 'STORAGE_ERROR') {
        throw new FavoriteStorageError(error.message || '');
      }
      // 标签相关错误
      if (error.code === 'TAG_ALREADY_EXISTS') {
        throw new FavoriteTagAlreadyExistsError(error.tag || '');
      }
      if (error.code === 'TAG_NOT_FOUND') {
        throw new FavoriteTagNotFoundError(error.tag || '');
      }
      if (error.code === 'TAG_ERROR') {
        throw new FavoriteTagError(error.message || '', error.code);
      }
      // 数据迁移和导入导出错误
      if (error.code === 'MIGRATION_ERROR') {
        throw new FavoriteMigrationError(error.message || '', error.cause);
      }
      if (error.code === 'IMPORT_EXPORT_ERROR') {
        throw new FavoriteImportExportError(error.message || '', error.cause, error.details);
      }
      throw new FavoriteError(error.message || 'Unknown error');
    }
  }

  async addFavorite(favorite: Omit<FavoritePrompt, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>): Promise<string> {
    return this.invokeMethod('addFavorite', favorite);
  }

  async getFavorites(options?: {
    categoryId?: string;
    tags?: string[];
    keyword?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'useCount' | 'title';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<FavoritePrompt[]> {
    return this.invokeMethod('getFavorites', options);
  }

  async getFavorite(id: string): Promise<FavoritePrompt> {
    return this.invokeMethod('getFavorite', id);
  }

  async updateFavorite(id: string, updates: Partial<FavoritePrompt>): Promise<void> {
    return this.invokeMethod('updateFavorite', id, updates);
  }

  async deleteFavorite(id: string): Promise<void> {
    return this.invokeMethod('deleteFavorite', id);
  }

  async deleteFavorites(ids: string[]): Promise<void> {
    return this.invokeMethod('deleteFavorites', ids);
  }

  async incrementUseCount(id: string): Promise<void> {
    return this.invokeMethod('incrementUseCount', id);
  }

  async getCategories(): Promise<FavoriteCategory[]> {
    return this.invokeMethod('getCategories');
  }

  async addCategory(category: Omit<FavoriteCategory, 'id' | 'createdAt'>): Promise<string> {
    return this.invokeMethod('addCategory', category);
  }

  async updateCategory(id: string, updates: Partial<FavoriteCategory>): Promise<void> {
    return this.invokeMethod('updateCategory', id, updates);
  }

  async deleteCategory(id: string): Promise<number> {
    return this.invokeMethod('deleteCategory', id);
  }

  async getStats(): Promise<FavoriteStats> {
    return this.invokeMethod('getStats');
  }

  async searchFavorites(keyword: string, options?: {
    categoryId?: string;
    tags?: string[];
  }): Promise<FavoritePrompt[]> {
    return this.invokeMethod('searchFavorites', keyword, options);
  }

  async exportFavorites(ids?: string[]): Promise<string> {
    return this.invokeMethod('exportFavorites', ids);
  }

  async importFavorites(data: string, options?: {
    mergeStrategy?: 'skip' | 'overwrite' | 'merge';
    categoryMapping?: Record<string, string>;
  }): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    return this.invokeMethod('importFavorites', data, options);
  }

  async getAllTags(): Promise<Array<{ tag: string; count: number }>> {
    return this.invokeMethod('getAllTags');
  }

  async addTag(tag: string): Promise<void> {
    return this.invokeMethod('addTag', tag);
  }

  async renameTag(oldTag: string, newTag: string): Promise<number> {
    return this.invokeMethod('renameTag', oldTag, newTag);
  }

  async mergeTags(sourceTags: string[], targetTag: string): Promise<number> {
    return this.invokeMethod('mergeTags', sourceTags, targetTag);
  }

  async deleteTag(tag: string): Promise<number> {
    return this.invokeMethod('deleteTag', tag);
  }

  async reorderCategories(categoryIds: string[]): Promise<void> {
    return this.invokeMethod('reorderCategories', categoryIds);
  }

  async getCategoryUsage(categoryId: string): Promise<number> {
    return this.invokeMethod('getCategoryUsage', categoryId);
  }

  async ensureDefaultCategories(defaultCategories: Array<{
    name: string;
    description?: string;
    color: string;
  }>): Promise<void> {
    return this.invokeMethod('ensureDefaultCategories', defaultCategories);
  }
}
