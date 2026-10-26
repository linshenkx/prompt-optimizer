/**
 * 收藏的提示词记录接口
 */
export interface FavoritePrompt {
  /** 收藏ID */
  id: string;
  /** 提示词标题 */
  title: string;
  /** 提示词内容 */
  content: string;
  /** 提示词描述 */
  description?: string;
  /** 收藏时间 */
  createdAt: number;
  /** 最后修改时间 */
  updatedAt: number;
  /** 标签 */
  tags: string[];
  /** 分类ID (用户自定义分类,与功能模式独立) */
  category?: string;
  /** 使用次数 */
  useCount: number;

  // 🆕 新增字段 - 功能模式分类体系
  /** 功能模式 (一级分类,必填) */
  functionMode: 'basic' | 'context' | 'image';
  /** 优化模式 (二级分类,仅用于 basic/context 模式) */
  optimizationMode?: 'system' | 'user';
  /** 图像子模式 (二级分类,仅用于 image 模式) */
  imageSubMode?: 'text2image' | 'image2image' | 'multiimage';

  /** 元数据 (系统管理,用户不可编辑) */
  metadata?: {
    /** 原始内容 (优化前) - 仅从优化历史保存时有值 */
    originalContent?: string;
    /** 来源历史记录ID - 仅从优化历史保存时有值 */
    sourceHistoryId?: string;
    /** 模型信息 */
    modelKey?: string;
    modelName?: string;
    templateId?: string;
    /** 收藏图片资源（通用收藏能力） */
    media?: {
      /** 封面图片资源 ID（优先使用） */
      coverAssetId?: string;
      /** 封面图片回退 URL（当资产持久化失败时） */
      coverUrl?: string;
      /** 图片资源 ID 列表 */
      assetIds?: string[];
      /** 图片回退 URL 列表 */
      urls?: string[];
    };
    [key: string]: any;
  };
}

/**
 * 收藏夹分类接口
 */
export interface FavoriteCategory {
  /** 分类ID */
  id: string;
  /** 分类名称 */
  name: string;
  /** 分类描述 */
  description?: string;
  /** 父分类ID（支持层级分类） */
  parentId?: string;
  /** 分类颜色 */
  color?: string;
  /** 创建时间 */
  createdAt: number;
  /** 排序权重 */
  sortOrder: number;
}

/**
 * 收藏项统计信息
 */
export interface FavoriteStats {
  /** 总收藏数 */
  totalFavorites: number;
  /** 各分类收藏数 */
  categoryStats: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
  }>;
  /** 标签使用统计 */
  tagStats: Array<{
    tag: string;
    count: number;
  }>;
  /** 最近使用时间 */
  lastUsedAt?: number;
}

/**
 * 独立标签接口
 */
export interface FavoriteTag {
  /** 标签名称 */
  tag: string;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 标签统计信息接口
 * 用于标签管理器展示标签使用情况
 */
export interface TagStatistics {
  /** 标签名称 */
  name: string;
  /** 使用次数 */
  count: number;
  /** 最后使用时间（可选，暂未实现） */
  lastUsed?: number;
}

/**
 * 收藏管理器接口
 */
export interface FavoriteImportOptions {
  mergeStrategy?: 'skip' | 'overwrite' | 'merge';
  categoryMapping?: Record<string, string>;
  /** Full backup restore matches stable identities; manual imports default to content matching. */
  matchBy?: 'content' | 'id';
}

export interface IFavoriteManager {
  /** 添加收藏 */
  addFavorite(favorite: Omit<FavoritePrompt, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>): Promise<string>;

  /** 获取收藏列表 */
  getFavorites(options?: {
    categoryId?: string;
    tags?: string[];
    keyword?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'useCount' | 'title';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<FavoritePrompt[]>;

  /** 获取收藏详情 */
  getFavorite(id: string): Promise<FavoritePrompt>;

  /** 更新收藏 */
  updateFavorite(id: string, updates: Partial<FavoritePrompt>): Promise<void>;

  /** 显式切换收藏内提示词资产的当前版本 */
  setFavoritePromptAssetCurrentVersion(id: string, versionId: string): Promise<void>;

  /** 删除收藏内提示词资产的非当前版本 */
  deleteFavoritePromptAssetVersion(id: string, versionId: string): Promise<void>;

  /** 删除收藏 */
  deleteFavorite(id: string): Promise<void>;

  /** 批量删除收藏 */
  deleteFavorites(ids: string[]): Promise<void>;

  /** 增加使用次数 */
  incrementUseCount(id: string): Promise<void>;

  /** 获取分类列表 */
  getCategories(): Promise<FavoriteCategory[]>;

  /** 添加分类 */
  addCategory(category: Omit<FavoriteCategory, 'id' | 'createdAt'>): Promise<string>;

  /** 更新分类 */
  updateCategory(id: string, updates: Partial<FavoriteCategory>): Promise<void>;

  /** 删除分类 */
  deleteCategory(id: string): Promise<number>;

  /** 获取统计信息 */
  getStats(): Promise<FavoriteStats>;

  /** 搜索收藏 */
  searchFavorites(keyword: string, options?: {
    categoryId?: string;
    tags?: string[];
  }): Promise<FavoritePrompt[]>;

  /** 导出收藏 */
  exportFavorites(ids?: string[]): Promise<string>;

  /** 导入收藏 */
  importFavorites(data: string, options?: FavoriteImportOptions): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }>;

  /** Validate a restore against current data before any image or application data is written. */
  validateImportData?(data: string, options?: FavoriteImportOptions): Promise<void>;

  /** 获取所有标签及其使用统计（包含独立标签和使用中的标签） */
  getAllTags(): Promise<Array<{ tag: string; count: number }>>;

  /** 添加独立标签 */
  addTag(tag: string): Promise<void>;

  /** 重命名标签 */
  renameTag(oldTag: string, newTag: string): Promise<number>;

  /** 合并多个标签为一个 */
  mergeTags(sourceTags: string[], targetTag: string): Promise<number>;

  /** 删除标签（同时从独立标签和所有收藏项中删除） */
  deleteTag(tag: string): Promise<number>;

  /** 对分类进行重新排序 */
  reorderCategories(categoryIds: string[]): Promise<void>;

  /** 获取分类使用统计 */
  getCategoryUsage(categoryId: string): Promise<number>;

  /** 确保默认分类存在（仅首次执行有效） */
  ensureDefaultCategories(defaultCategories: Array<{
    name: string;
    description?: string;
    color: string;
  }>): Promise<void>;
}
