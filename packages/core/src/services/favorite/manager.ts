import type { IStorageProvider } from '../storage/types';
import type {
  FavoritePrompt,
  FavoriteCategory,
  FavoriteStats,
  FavoriteTag,
  IFavoriteManager
} from './types';
import {
  FavoriteError,
  FavoriteNotFoundError,
  FavoriteCategoryNotFoundError,
  FavoriteValidationError,
  FavoriteStorageError,
  FavoriteMigrationError,
  FavoriteImportExportError
} from './errors';
import { TypeMapper } from './type-mapper';
import { TagTypeConverter } from './type-converter';

/**
 * 收藏管理器实现
 */
export class FavoriteManager implements IFavoriteManager {
  private readonly STORAGE_KEYS = {
    FAVORITES: 'favorites',
    CATEGORIES: 'favorite_categories',
    STATS: 'favorite_stats',
    TAGS: 'favorite_tags'
  } as const;

  private initPromise: Promise<void>;
  private initialized = false;
  /**
   * 初始化状态标志
   * - 'pending': 初始化尚未开始
   * - 'initializing': 正在初始化中
   * - 'initialized': 初始化已完成
   */
  private initState: 'pending' | 'initializing' | 'initialized' = 'pending';

  constructor(private storageProvider: IStorageProvider) {
    // 立即开始异步初始化
    this.initPromise = this.initialize();
  }

  /**
   * 显式初始化方法
   * 确保默认分类和数据迁移都完成
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.initState = 'initializing';
      // ❌ 移除自动创建默认分类 - 改由 UI 层调用 ensureDefaultCategories
      // await this.initializeDefaultCategories();
      await this.migrateLegacyData();
      this.initialized = true;
      this.initState = 'initialized';
    } catch (error) {
      console.error('[FavoriteManager] 初始化失败:', error);
      // 即使初始化失败,也标记为已初始化,避免阻塞后续操作
      this.initialized = true;
      this.initState = 'initialized';
    }
  }

  /**
   * 确保初始化完成
   * 所有公共方法都应该先调用这个方法
   *
   * 🔒 死锁防护:
   * 如果当前正在初始化中,直接返回而不等待,允许初始化逻辑调用自身方法
   */
  private async ensureInitialized(): Promise<void> {
    // 如果正在初始化中,直接返回,避免死锁
    if (this.initState === 'initializing') {
      return;
    }

    // 否则等待初始化完成
    await this.initPromise;
  }

  /**
   * 迁移旧数据
   * 为不包含 functionMode 的旧收藏添加默认值
   */
  private async migrateLegacyData(): Promise<void> {
    try {
      let migrated = false;

      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: any[] | null) => {
        // 如果没有数据，返回空数组
        if (!favorites || favorites.length === 0) return favorites || [];

        const migratedFavorites = favorites.map((favorite: any) => {
          // 检查是否为旧数据 (没有 functionMode 字段)
          if (!favorite.functionMode) {
            migrated = true;

            // 移除已废弃的 isPublic 字段
            const { isPublic, originalContent, ...rest } = favorite;

            // 添加新的必需字段
            return {
              ...rest,
              functionMode: 'basic',  // 默认为基础模式
              optimizationMode: 'system',  // 默认为系统优化模式
              metadata: {
                ...(favorite.metadata || {}),
                // 如果存在 originalContent,迁移到 metadata 中
                ...(originalContent ? { originalContent } : {})
              }
            };
          }

          return favorite;
        });

        return migratedFavorites;
      });

      if (migrated) {
        // 迁移后更新统计信息
        await this.updateStats();
        console.info('[FavoriteManager] 数据迁移完成，已更新收藏项格式');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const migrationError = new FavoriteMigrationError(
        `Legacy data migration failed: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      console.warn('[FavoriteManager]', migrationError);
      // 迁移失败不应该阻止服务初始化，仅记录警告
    }
  }

  /**
   * 确保默认分类存在(仅首次)
   * 由 UI 层调用,传入国际化后的分类配置
   *
   * @param defaultCategories 默认分类配置数组
   */
  async ensureDefaultCategories(
    defaultCategories: Array<{
      name: string;
      description?: string;
      color: string;
    }>
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      // ✅ 检查是否已初始化过默认分类
      const hasInitialized = await this.storageProvider.getItem('favorite_categories_initialized');
      if (hasInitialized === 'true') {
        return; // 已经初始化过,即使用户删光了也不再自动创建
      }

      // ✅ 检查是否已有分类
      const existingCategories = await this.getCategories();

      if (existingCategories.length === 0) {
        // ✅ 首次使用,创建默认分类
        for (let i = 0; i < defaultCategories.length; i++) {
          const category = defaultCategories[i];
          await this.addCategory({
            name: category.name,
            description: category.description,
            color: category.color,
            sortOrder: i
          });
        }

        // ✅ 标记已初始化
        await this.storageProvider.setItem('favorite_categories_initialized', 'true');
      }
    } catch (error) {
      console.warn('[FavoriteManager] 确保默认分类失败:', error);
    }
  }

  async addFavorite(favorite: Omit<FavoritePrompt, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>): Promise<string> {
    await this.ensureInitialized();

    // 验证输入
    if (!favorite.content?.trim()) {
      throw new FavoriteValidationError('Prompt content cannot be empty');
    }

    // 验证 functionMode 必填
    if (!favorite.functionMode) {
      throw new FavoriteValidationError('Function mode (functionMode) cannot be empty');
    }

    // 验证功能模式分类的完整性
    if (favorite.functionMode === 'basic' || favorite.functionMode === 'context') {
      if (!favorite.optimizationMode) {
        throw new FavoriteValidationError(`${favorite.functionMode} mode must specify optimizationMode`);
      }
    }

    if (favorite.functionMode === 'image') {
      if (!favorite.imageSubMode) {
        throw new FavoriteValidationError('Image mode must specify imageSubMode');
      }
    }

    const favoriteData = {
      title: favorite.title?.trim() || favorite.content.slice(0, 50) + (favorite.content.length > 50 ? '...' : ''),
      content: favorite.content,
      description: favorite.description,
      category: favorite.category,
      tags: favorite.tags || [],
      functionMode: favorite.functionMode,
      optimizationMode: favorite.optimizationMode,
      imageSubMode: favorite.imageSubMode,
      metadata: favorite.metadata
    };

    const now = Date.now();
    const id = `fav_${now}_${Math.random().toString(36).substr(2, 9)}`;

    const newFavorite: FavoritePrompt = {
      ...favoriteData,
      id,
      createdAt: now,
      updatedAt: now,
      useCount: 0
    };

    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites || [];
        // 🔧 移除重复内容检查 - 允许收藏相同内容但属性不同的提示词
        // 用户可能需要��同一内容设置不同的标题、分类、标签等
        return [...favoritesList, newFavorite];
      });

      await this.updateStats();
      return id;
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to add favorite: ${errorMessage}`);
    }
  }

  async getFavorites(options: {
    categoryId?: string;
    tags?: string[];
    keyword?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'useCount' | 'title';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  } = {}): Promise<FavoritePrompt[]> {
    await this.ensureInitialized();

    try {
      const favorites = await this.storageProvider.getItem(this.STORAGE_KEYS.FAVORITES);
      let favoritesList: FavoritePrompt[] = favorites ? JSON.parse(favorites) : [];

      // 过滤
      if (options.categoryId) {
        favoritesList = favoritesList.filter(f => f.category === options.categoryId);
      }

      if (options.tags && options.tags.length > 0) {
        favoritesList = favoritesList.filter(f =>
          options.tags!.some(tag => f.tags.includes(tag))
        );
      }

      if (options.keyword) {
        const keyword = options.keyword.toLowerCase();
        favoritesList = favoritesList.filter(f =>
          f.title.toLowerCase().includes(keyword) ||
          f.content.toLowerCase().includes(keyword) ||
          f.description?.toLowerCase().includes(keyword)
        );
      }

      // 排序
      const sortBy = options.sortBy || 'updatedAt';
      const sortOrder = options.sortOrder || 'desc';

      favoritesList.sort((a, b) => {
        let aValue: any = a[sortBy];
        let bValue: any = b[sortBy];

        if (sortBy === 'title') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      // 分页
      if (options.offset) {
        favoritesList = favoritesList.slice(options.offset);
      }

      if (options.limit) {
        favoritesList = favoritesList.slice(0, options.limit);
      }

      return favoritesList;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to get favorites: ${errorMessage}`);
    }
  }

  async getFavorite(id: string): Promise<FavoritePrompt> {
    try {
      const favorites = await this.getFavorites();
      const favorite = favorites.find(f => f.id === id);

      if (!favorite) {
        throw new FavoriteNotFoundError(id);
      }

      return favorite;
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to get favorite details: ${errorMessage}`);
    }
  }

  async updateFavorite(id: string, updates: Partial<FavoritePrompt>): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites || [];
        const index = favoritesList.findIndex(f => f.id === id);
        if (index === -1) {
          throw new FavoriteNotFoundError(id);
        }

        favoritesList[index] = {
          ...favoritesList[index],
          ...updates,
          updatedAt: Date.now()
        };

        return favoritesList;
      });

      await this.updateStats();
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to update favorite: ${errorMessage}`);
    }
  }

  async deleteFavorite(id: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites || [];
        const index = favoritesList.findIndex(f => f.id === id);
        if (index === -1) {
          throw new FavoriteNotFoundError(id);
        }

        return favoritesList.filter(f => f.id !== id);
      });

      await this.updateStats();
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to delete favorite: ${errorMessage}`);
    }
  }

  async deleteFavorites(ids: string[]): Promise<void> {
    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites || [];
        const deletedCount = favoritesList.filter(f => ids.includes(f.id)).length;
        if (deletedCount === 0) {
          throw new FavoriteNotFoundError('Favorite to delete not found');
        }

        return favoritesList.filter(f => !ids.includes(f.id));
      });

      await this.updateStats();
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to batch delete favorites: ${errorMessage}`);
    }
  }

  async incrementUseCount(id: string): Promise<void> {
    try {
      await this.updateFavorite(id, { useCount: (await this.getFavorite(id)).useCount + 1 });
    } catch (error) {
      // 静默处理使用次数增加失败，不影响主要功能
      console.warn('增加使用次数失败:', error);
    }
  }

  async getCategories(): Promise<FavoriteCategory[]> {
    await this.ensureInitialized();

    try {
      const categories = await this.storageProvider.getItem(this.STORAGE_KEYS.CATEGORIES);
      return categories ? JSON.parse(categories) : [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to get categories: ${errorMessage}`);
    }
  }

  async addCategory(category: Omit<FavoriteCategory, 'id' | 'createdAt'>): Promise<string> {
    await this.ensureInitialized();

    if (!category.name?.trim()) {
      throw new FavoriteValidationError('Category name cannot be empty');
    }

    const now = Date.now();
    const id = `cat_${now}_${Math.random().toString(36).substr(2, 9)}`;

    const newCategory: FavoriteCategory = {
      ...category,
      id,
      createdAt: now,
      sortOrder: category.sortOrder || 0
    };

    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.CATEGORIES, (categories: FavoriteCategory[] | null) => {
        const categoriesList = categories || [];
        // 检查是否已存在同名分类
        const existing = categoriesList.find(c => c.name === category.name);
        if (existing) {
          throw new FavoriteValidationError(`Category already exists: ${category.name}`);
        }
        return [...categoriesList, newCategory];
      });

      return id;
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to add category: ${errorMessage}`);
    }
  }

  async updateCategory(id: string, updates: Partial<FavoriteCategory>): Promise<void> {
    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.CATEGORIES, (categories: FavoriteCategory[] | null) => {
        const categoriesList = categories || [];
        const index = categoriesList.findIndex(c => c.id === id);
        if (index === -1) {
          throw new FavoriteCategoryNotFoundError(id);
        }

        categoriesList[index] = {
          ...categoriesList[index],
          ...updates
        };

        return categoriesList;
      });
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to update category: ${errorMessage}`);
    }
  }

  /**
   * 删除分类
   * 会自动清空该分类下所有收藏的分类字段
   *
   * @param id 分类ID
   * @returns 受影响的收藏数量
   */
  async deleteCategory(id: string): Promise<number> {
    await this.ensureInitialized();

    try {
      // ✅ 获取该分类下的所有收藏
      const allFavorites = await this.getFavorites();
      const favoritesInCategory = allFavorites.filter(f => f.category === id);

      // ✅ 清空这些收藏的分类字段(不依赖"未分类"是否存在)
      for (const favorite of favoritesInCategory) {
        await this.updateFavorite(favorite.id, {
          ...favorite,
          category: undefined // 清空分类
        });
      }

      // ✅ 删除分类
      await this.storageProvider.updateData(this.STORAGE_KEYS.CATEGORIES, (categories: FavoriteCategory[] | null) => {
        const categoriesList = categories || [];
        const index = categoriesList.findIndex(c => c.id === id);
        if (index === -1) {
          throw new FavoriteCategoryNotFoundError(id);
        }

        return categoriesList.filter(c => c.id !== id);
      });

      return favoritesInCategory.length;
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to delete category: ${errorMessage}`);
    }
  }

  async getStats(): Promise<FavoriteStats> {
    try {
      const stats = await this.storageProvider.getItem(this.STORAGE_KEYS.STATS);
      if (stats) {
        return JSON.parse(stats);
      }

      // 如果没有缓存的统计数据，计算并缓存
      return await this.updateStats();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to get statistics: ${errorMessage}`);
    }
  }

  private async updateStats(): Promise<FavoriteStats> {
    const favorites = await this.getFavorites();
    const categories = await this.getCategories();

    const categoryStats = categories.map(category => ({
      categoryId: category.id,
      categoryName: category.name,
      count: favorites.filter(f => f.category === category.id).length
    }));

    const tagCounts = new Map<string, number>();
    favorites.forEach(favorite => {
      favorite.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const tagStats = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    const stats: FavoriteStats = {
      totalFavorites: favorites.length,
      categoryStats,
      tagStats,
      lastUsedAt: Math.max(...favorites.map(f => f.updatedAt), 0)
    };

    // 缓存统计数据
    try {
      await this.storageProvider.setItem(this.STORAGE_KEYS.STATS, JSON.stringify(stats));
    } catch (error) {
      console.warn('缓存统计数据失败:', error);
    }

    return stats;
  }

  async searchFavorites(keyword: string, options?: {
    categoryId?: string;
    tags?: string[];
  }): Promise<FavoritePrompt[]> {
    return this.getFavorites({
      keyword,
      categoryId: options?.categoryId,
      tags: options?.tags,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });
  }

  /**
   * 获取独立标签库中的所有标签名称
   * @private
   */
  private async getAllIndependentTags(): Promise<string[]> {
    try {
      const storedTags = await this.storageProvider.getItem(this.STORAGE_KEYS.TAGS);
      const independentTags: FavoriteTag[] = storedTags ? JSON.parse(storedTags) : [];
      return independentTags.map(t => t.tag);
    } catch (error) {
      console.warn('获取独立标签失败:', error);
      return [];
    }
  }

  async exportFavorites(ids?: string[]): Promise<string> {
    try {
      let favorites: FavoritePrompt[];

      if (ids) {
        favorites = await Promise.all(ids.map(id => this.getFavorite(id)));
      } else {
        favorites = await this.getFavorites();
      }

      const categories = await this.getCategories();
      const tags = await this.getAllIndependentTags();

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        favorites,
        categories,
        tags  // 导出独立标签库（包含所有标签：使用中的 + 预创建的）
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteImportExportError(
        `Failed to export favorites: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 计算标签使用统计
   * @private
   * @returns 包含标签名和使用次数的 Map
   */
  private async computeTagCounts(): Promise<Map<string, number>> {
    // 1. 获取独立标签
    const storedTags = await this.storageProvider.getItem(this.STORAGE_KEYS.TAGS);
    const independentTags: FavoriteTag[] = storedTags ? JSON.parse(storedTags) : [];

    // 2. 统计收藏项中使用的标签
    const favorites = await this.getFavorites();
    const tagCounts = new Map<string, number>();

    favorites.forEach(favorite => {
      favorite.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    // 3. 合并独立标签和使用中的标签
    // 独立标签如果未被使用，count 为 0
    independentTags.forEach(({ tag }) => {
      if (!tagCounts.has(tag)) {
        tagCounts.set(tag, 0);
      }
    });

    return tagCounts;
  }

  async getAllTags(): Promise<Array<{ tag: string; count: number }>> {
    try {
      const tagCounts = await this.computeTagCounts();

      // 返回排序后的结果（使用次数降序，相同次数按标签名升序）
      return Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count; // 按使用次数降序
          }
          return TagTypeConverter.compareTagNames(a.tag, b.tag); // 相同次数按标签名升序
        });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to get tags: ${errorMessage}`);
    }
  }

  async addTag(tag: string): Promise<void> {
    await this.ensureInitialized();

    const trimmedTag = tag.trim();
    if (!trimmedTag) {
      throw new FavoriteValidationError('Tag name cannot be empty');
    }

    let added = false;

    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.TAGS, (tags: FavoriteTag[] | null) => {
        const tagsList = tags || [];

        // 检查是否已存在
        const existing = tagsList.find(t => t.tag === trimmedTag);
        if (existing) {
          // 标签已存在，保持幂等，不再抛错
          return tagsList;
        }

        const now = Date.now();
        const newTag: FavoriteTag = {
          tag: trimmedTag,
          createdAt: now
        };

        added = true;
        return [...tagsList, newTag];
      });

      // 仅在新增标签时更新统计信息
      if (added) {
        await this.updateStats();
      }
    } catch (error) {
      if (error instanceof FavoriteError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(
        `Failed to add tag: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async renameTag(oldTag: string, newTag: string): Promise<number> {
    if (!oldTag || !newTag) {
      throw new FavoriteValidationError('Tag name cannot be empty');
    }

    if (oldTag === newTag) {
      return 0; // 无需操作
    }

    let affectedCount = 0;
    let oldTagExistedInIndependentLib = false;

    try {
      // 1. 更新独立标签库:删除旧标签,记录是否存在
      await this.storageProvider.updateData(this.STORAGE_KEYS.TAGS, (tags: FavoriteTag[] | null) => {
        const tagsList = tags || [];

        // 检查旧标签是否存在
        oldTagExistedInIndependentLib = tagsList.some(t => t.tag === oldTag);

        // 删除旧标签
        return tagsList.filter(t => t.tag !== oldTag);
      });

      // 2. 更新收藏列表中的标签
      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites || [];

        favoritesList.forEach(favorite => {
          const oldTagIndex = favorite.tags.indexOf(oldTag);
          if (oldTagIndex !== -1) {
            // 移除旧标签
            favorite.tags.splice(oldTagIndex, 1);
            // 添加新标签(如果不存在)
            if (!favorite.tags.includes(newTag)) {
              favorite.tags.push(newTag);
            }
            favorite.updatedAt = Date.now();
            affectedCount++;
          }
        });

        return favoritesList;
      });

      // 3. 只有当旧标签存在于独立库或被收藏使用时,才添加新标签到独立库
      if (oldTagExistedInIndependentLib || affectedCount > 0) {
        await this.storageProvider.updateData(this.STORAGE_KEYS.TAGS, (tags: FavoriteTag[] | null) => {
          const tagsList = tags || [];

          // 添加新标签(如果不存在)
          const hasNewTag = tagsList.some(t => t.tag === newTag);
          if (!hasNewTag) {
            tagsList.push({
              tag: newTag,
              createdAt: Date.now()
            });
          }

          return tagsList;
        });
      }

      await this.updateStats();
      return affectedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to rename tag: ${errorMessage}`);
    }
  }

  async mergeTags(sourceTags: string[], targetTag: string): Promise<number> {
    if (!sourceTags || sourceTags.length === 0) {
      throw new FavoriteValidationError('Source tag list cannot be empty');
    }

    if (!targetTag) {
      throw new FavoriteValidationError('Target tag cannot be empty');
    }

    let affectedCount = 0;

    try {
      // 1. 更新独立标签库:删除所有源标签,确保目标标签存在
      await this.storageProvider.updateData(this.STORAGE_KEYS.TAGS, (tags: FavoriteTag[] | null) => {
        const tagsList = tags || [];

        // 删除所有源标签
        const filteredTags = tagsList.filter(t => !sourceTags.includes(t.tag));

        // 确保目标标签存在
        const hasTargetTag = filteredTags.some(t => t.tag === targetTag);
        if (!hasTargetTag) {
          filteredTags.push({
            tag: targetTag,
            createdAt: Date.now()
          });
        }

        return filteredTags;
      });

      // 2. 更新收藏列表中的标签
      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites || [];

        favoritesList.forEach(favorite => {
          let hasSourceTag = false;

          // 移除所有源标签
          sourceTags.forEach(sourceTag => {
            const index = favorite.tags.indexOf(sourceTag);
            if (index !== -1) {
              favorite.tags.splice(index, 1);
              hasSourceTag = true;
            }
          });

          // 如果存在源标签,添加目标标签(如果不存在)
          if (hasSourceTag) {
            if (!favorite.tags.includes(targetTag)) {
              favorite.tags.push(targetTag);
            }
            favorite.updatedAt = Date.now();
            affectedCount++;
          }
        });

        return favoritesList;
      });

      await this.updateStats();
      return affectedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to merge tags: ${errorMessage}`);
    }
  }

  async deleteTag(tag: string): Promise<number> {
    if (!tag) {
      throw new FavoriteValidationError('Tag name cannot be empty');
    }

    let affectedCount = 0;

    try {
      // 1. 从独立标签中删除
      await this.storageProvider.updateData(this.STORAGE_KEYS.TAGS, (tags: FavoriteTag[] | null) => {
        const tagsList = tags || [];
        return tagsList.filter(t => t.tag !== tag);
      });

      // 2. 从所有收藏项中删除
      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites || [];

        favoritesList.forEach(favorite => {
          const index = favorite.tags.indexOf(tag);
          if (index !== -1) {
            favorite.tags.splice(index, 1);
            favorite.updatedAt = Date.now();
            affectedCount++;
          }
        });

        return favoritesList;
      });

      await this.updateStats();
      return affectedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to delete tag: ${errorMessage}`);
    }
  }

  async reorderCategories(categoryIds: string[]): Promise<void> {
    if (!categoryIds || categoryIds.length === 0) {
      throw new FavoriteValidationError('Category ID list cannot be empty');
    }

    try {
      await this.storageProvider.updateData(this.STORAGE_KEYS.CATEGORIES, (categories: FavoriteCategory[] | null) => {
        const categoriesList = categories || [];

        // 创建ID到分类的映射
        const categoryMap = new Map<string, FavoriteCategory>();
        categoriesList.forEach(cat => categoryMap.set(cat.id, cat));

        // 按提供的ID顺序重新排序,并更新sortOrder
        const reorderedCategories: FavoriteCategory[] = [];
        categoryIds.forEach((id, index) => {
          const category = categoryMap.get(id);
          if (category) {
            reorderedCategories.push({
              ...category,
              sortOrder: index
            });
            categoryMap.delete(id);
          }
        });

        // 将未在ID列表中的分类追加到末尾
        categoryMap.forEach(category => {
          reorderedCategories.push({
            ...category,
            sortOrder: reorderedCategories.length
          });
        });

        return reorderedCategories;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to reorder categories: ${errorMessage}`);
    }
  }

  async getCategoryUsage(categoryId: string): Promise<number> {
    try {
      const favorites = await this.getFavorites({ categoryId });
      return favorites.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteStorageError(`Failed to get category usage: ${errorMessage}`);
    }
  }

  async importFavorites(data: string, options?: {
    mergeStrategy?: 'skip' | 'overwrite' | 'merge';
    categoryMapping?: Record<string, string>;
  }): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const mergeStrategy = options?.mergeStrategy || 'skip';
    const categoryMapping = options?.categoryMapping || {};
    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    try {
      await this.ensureInitialized();
      const importData = JSON.parse(data);

      if (!importData.favorites || !Array.isArray(importData.favorites)) {
        throw new FavoriteValidationError('Invalid import data format');
      }
      // 预处理分类：避免重复获取
      if (importData.categories && Array.isArray(importData.categories)) {
        const existingCategories = await this.getCategories();
        const existingCategoryIds = new Set(existingCategories.map(c => c.id));
        const existingCategoryNames = new Set(existingCategories.map(c => c.name));

        for (const category of importData.categories) {
          if (!category || typeof category.name !== 'string') continue;
          try {
            const exists =
              (category.id && existingCategoryIds.has(category.id)) ||
              existingCategoryNames.has(category.name);

            if (!exists) {
              await this.addCategory({
                name: category.name,
                description: category.description,
                color: category.color,
                sortOrder: category.sortOrder
              });
              existingCategoryNames.add(category.name);
            }
          } catch (error) {
            console.warn('Failed to import category:', category?.name, error);
          }
        }
      }

      // 预处理独立标签：一次性合并，避免重复刷新统计
      if (importData.tags && Array.isArray(importData.tags) && importData.tags.length > 0) {
        const tagsToMerge = new Set<string>();
        importData.tags.forEach((tag: unknown) => {
          if (typeof tag === 'string' && tag.trim()) {
            tagsToMerge.add(tag.trim());
          }
        });

        if (tagsToMerge.size > 0) {
          await this.storageProvider.updateData(this.STORAGE_KEYS.TAGS, (tags: FavoriteTag[] | null) => {
            const tagsList = tags ? [...tags] : [];
            const existing = new Set(tagsList.map(t => t.tag));
            const now = Date.now();

            tagsToMerge.forEach((tag: string) => {
              if (!existing.has(tag)) {
                tagsList.push({ tag, createdAt: now });
                existing.add(tag);
              }
            });

            return tagsList;
          });
        }
      }

      const parseTimestamp = (value: unknown, fallback: number): number => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
        if (typeof value === 'string') {
          const parsed = Date.parse(value);
          if (!Number.isNaN(parsed)) {
            return parsed;
          }
        }
        return fallback;
      };

      const sanitizeTags = (rawTags: unknown): string[] => {
        if (!Array.isArray(rawTags)) return [];
        const tagSet = new Set<string>();
        rawTags.forEach(tag => {
          if (typeof tag === 'string' && tag.trim()) {
            tagSet.add(tag.trim());
          }
        });
        return Array.from(tagSet);
      };

      const baseTimestamp = Date.now();
      let timestampOffset = 0;

      await this.storageProvider.updateData(this.STORAGE_KEYS.FAVORITES, (favorites: FavoritePrompt[] | null) => {
        const favoritesList = favorites ? [...favorites] : [];
        const existingFavoritesMap = new Map<string, FavoritePrompt>();
        const existingIds = new Set<string>();
        favoritesList.forEach(f => {
          existingFavoritesMap.set(f.content, f);
          existingIds.add(f.id);
        });

        const generateId = (preferredId?: unknown) => {
          if (typeof preferredId === 'string' && preferredId.trim() && !existingIds.has(preferredId)) {
            existingIds.add(preferredId);
            return preferredId;
          }
          let newId = '';
          do {
            newId = `fav_${baseTimestamp + timestampOffset}_${Math.random().toString(36).slice(2, 11)}`;
          } while (existingIds.has(newId));
          existingIds.add(newId);
          return newId;
        };

        const buildTitle = (title: unknown, content: string) => {
          if (typeof title === 'string' && title.trim()) {
            return title.trim();
          }
          const trimmed = content.trim();
          return trimmed.length > 50 ? `${trimmed.slice(0, 50)}...` : trimmed;
        };

        const normalizeMetadata = (metadata: unknown) => {
          if (metadata && typeof metadata === 'object') {
            return metadata as Record<string, unknown>;
          }
          return undefined;
        };

        const favoritesToImport = Array.isArray(importData.favorites) ? importData.favorites : [];

        favoritesToImport.forEach((favorite: any) => {
          try {
            if (!favorite || typeof favorite.content !== 'string' || !favorite.content.trim()) {
              throw new FavoriteValidationError('Import data contains favorite with empty content');
            }

            const functionMode = favorite.functionMode || 'basic';
            const optimizationMode =
              favorite.optimizationMode ||
              (functionMode !== 'image' ? 'system' : undefined);
            const imageSubMode =
              favorite.imageSubMode ||
              (functionMode === 'image' ? 'text2image' : undefined);

            const mapping = { functionMode, optimizationMode, imageSubMode };
            if (!TypeMapper.validateMapping(mapping)) {
              throw new FavoriteValidationError(
                `Invalid function mode in import data: functionMode=${functionMode}, optimizationMode=${optimizationMode}, imageSubMode=${imageSubMode}`
              );
            }

            const category = categoryMapping[favorite.category] || favorite.category;
            const tags = sanitizeTags(favorite.tags);
            const createdAt = parseTimestamp(favorite.createdAt, baseTimestamp + timestampOffset);
            const updatedAt = parseTimestamp(favorite.updatedAt, createdAt);
            const useCount = typeof favorite.useCount === 'number' && favorite.useCount >= 0
              ? favorite.useCount
              : 0;

            const existingFavorite = existingFavoritesMap.get(favorite.content);

            if (existingFavorite) {
              if (mergeStrategy === 'skip') {
                result.skipped++;
                return;
              }

              if (mergeStrategy === 'overwrite') {
                existingFavorite.title = buildTitle(favorite.title, favorite.content);
                existingFavorite.content = favorite.content;
                existingFavorite.description = typeof favorite.description === 'string'
                  ? favorite.description
                  : favorite.description ?? existingFavorite.description;
                existingFavorite.tags = tags;
                existingFavorite.category = category;
                existingFavorite.functionMode = functionMode;
                existingFavorite.optimizationMode = optimizationMode;
                existingFavorite.imageSubMode = imageSubMode;
                existingFavorite.metadata = normalizeMetadata(favorite.metadata);
                existingFavorite.createdAt = parseTimestamp(favorite.createdAt, existingFavorite.createdAt);
                existingFavorite.updatedAt = updatedAt;
                existingFavorite.useCount = useCount;
                result.imported++;
                return;
              }
              // merge 策略 fallthrough 到新增逻辑
            }

            const id = generateId(favorite.id);
            const newFavorite: FavoritePrompt = {
              id,
              title: buildTitle(favorite.title, favorite.content),
              content: favorite.content,
              description: typeof favorite.description === 'string' ? favorite.description : undefined,
              category,
              tags,
              functionMode,
              optimizationMode,
              imageSubMode,
              metadata: normalizeMetadata(favorite.metadata),
              createdAt,
              updatedAt,
              useCount
            };

            favoritesList.push(newFavorite);
            timestampOffset++;
            result.imported++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.errors.push(`Failed to import favorite: ${errorMessage}`);
          }
        });

        return favoritesList;
      });

      await this.updateStats();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new FavoriteImportExportError(
        `Failed to import favorites: ${errorMessage}`,
        error instanceof Error ? error : undefined,
        result.errors.length > 0 ? result.errors : undefined
      );
    }
  }
}
