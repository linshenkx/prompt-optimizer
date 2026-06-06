import { describe, it, expect, beforeEach } from 'vitest';
import { FavoriteManager } from '../../src/services/favorite/manager';
import type { IStorageProvider } from '../../src/services/storage/types';
import type { FavoritePrompt } from '../../src/services/favorite/types';
import { promptAssetFromFavorite } from '../../src/services/prompt-model';

const FAVORITES_STORAGE_KEY = 'favorites';
const BASE_TIME = 1700000000000;

type FavoriteSeed = Omit<FavoritePrompt, 'id' | 'createdAt' | 'updatedAt' | 'useCount'> & {
  id?: string;
  createdAt?: number;
  updatedAt?: number;
  useCount?: number;
};

const createSeededFavorite = (favorite: FavoriteSeed, index: number): FavoritePrompt => {
  const createdAt = favorite.createdAt ?? BASE_TIME + index;
  const updatedAt = favorite.updatedAt ?? createdAt;
  const record: FavoritePrompt = {
    id: favorite.id ?? `perf-favorite-${index}`,
    title: favorite.title,
    content: favorite.content,
    description: favorite.description,
    createdAt,
    updatedAt,
    tags: favorite.tags,
    category: favorite.category,
    useCount: favorite.useCount ?? 0,
    functionMode: favorite.functionMode,
    optimizationMode: favorite.optimizationMode,
    imageSubMode: favorite.imageSubMode,
    metadata: favorite.metadata,
  };

  return {
    ...record,
    metadata: {
      ...(record.metadata || {}),
      promptAsset: promptAssetFromFavorite(record, {
        ignoreEmbeddedAsset: true,
        stripWorkspaceDraft: true,
      }),
    },
  };
};

const seedFavorites = (
  storage: Map<string, string>,
  favorites: FavoriteSeed[],
): void => {
  storage.set(
    FAVORITES_STORAGE_KEY,
    JSON.stringify(favorites.map((favorite, index) => createSeededFavorite(favorite, index))),
  );
};

/**
 * 性能回归测试
 *
 * 目的: 确保性能没有明显下降
 * 基准:
 * - 查询1000个收藏: < 1000ms
 * - 添加/更新/删除单个收藏: < 500ms
 * - 搜索1000个收藏: < 1000ms
 * - 导出1000个收藏: < 1000ms
 */
describe('性能回归测试', () => {
  let manager: FavoriteManager;
  let storage: Map<string, string>;

  // 创建内存存储提供者
  const createMemoryStorage = (): IStorageProvider => {
    storage = new Map();
    return {
      async getItem(key: string): Promise<string | null> {
        return storage.get(key) || null;
      },
      async setItem(key: string, value: string): Promise<void> {
        storage.set(key, value);
      },
      async removeItem(key: string): Promise<void> {
        storage.delete(key);
      },
      async clearAll(): Promise<void> {
        storage.clear();
      },
      async updateData<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void> {
        const currentStr = storage.get(key);
        const currentValue = currentStr ? JSON.parse(currentStr) : null;
        const updated = modifier(currentValue);
        storage.set(key, JSON.stringify(updated));
      },
      async batchUpdate(operations: Array<{
        key: string;
        operation: 'set' | 'remove';
        value?: string;
      }>): Promise<void> {
        for (const op of operations) {
          if (op.operation === 'set' && op.value) {
            storage.set(op.key, op.value);
          } else if (op.operation === 'remove') {
            storage.delete(op.key);
          }
        }
      }
    };
  };

  beforeEach(async () => {
    manager = new FavoriteManager(createMemoryStorage());
    await manager.initialize();
  });

  it('应该能在合理时间内添加单个收藏 (< 500ms)', async () => {
    const startTime = performance.now();

    await manager.addFavorite({
      title: '性能测试收藏',
      content: '这是用于性能测试的收藏',
      tags: ['性能', '测试'],
      functionMode: 'basic',
      optimizationMode: 'system'
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 应该在 500ms 内完成，避免在高负载本机/CI 上产生时间敏感误报
    expect(duration).toBeLessThan(500);
  });

  it('应该能在合理时间内查询大量收藏 (< 1000ms for 1000 items)', async () => {
    // 1. 准备大量测试数据
    const favorites = Array.from({ length: 1000 }, (_, i) => ({
      title: `性能测试收藏 ${i}`,
      content: `这是第 ${i} 个收藏的内容`,
      tags: [`tag${i % 10}`, '性能测试'],
      functionMode: 'basic' as const,
      optimizationMode: 'system' as const
    }));

    // 2. 批量准备数据（不测试逐条写入性能）
    seedFavorites(storage, favorites);

    // 3. 测试查询性能
    const startTime = performance.now();

    const result = await manager.getFavorites();

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 4. 验证查询成功
    expect(result.length).toBeGreaterThanOrEqual(1000);

    // 5. 验证性能
    // 查询1000个收藏应该在 1000ms 内完成
    expect(duration).toBeLessThan(1000);
  });

  it('应该能在合理时间内搜索大量收藏 (< 1000ms for 1000 items)', async () => {
    // 1. 准备测试数据
    const favorites = Array.from({ length: 1000 }, (_, i) => ({
      title: `搜索测试 ${i}`,
      content: i % 10 === 0 ? '包含关键词的内容' : '普通内容',
      tags: ['测试'],
      functionMode: 'basic' as const,
      optimizationMode: 'system' as const
    }));

    seedFavorites(storage, favorites);

    // 2. 测试搜索性能
    const startTime = performance.now();

    const searchResults = await manager.searchFavorites('关键词');

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 3. 验证搜索结果
    expect(searchResults.length).toBeGreaterThan(0);

    // 4. 验证性能
    // 搜索应该在 1000ms 内完成
    expect(duration).toBeLessThan(1000);
  });

  it('应该能在合理时间内导出大量收藏 (< 1000ms for 1000 items)', async () => {
    // 1. 准备测试数据
    const favorites = Array.from({ length: 1000 }, (_, i) => ({
      title: `导出测试 ${i}`,
      content: `导出测试内容 ${i}`,
      tags: ['导出', `tag${i % 5}`],
      functionMode: 'basic' as const,
      optimizationMode: 'system' as const
    }));

    seedFavorites(storage, favorites);

    // 2. 测试导出性能
    const startTime = performance.now();

    const exportData = await manager.exportFavorites();

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 3. 验证导出数据
    expect(exportData).toBeTruthy();
    const parsed = JSON.parse(exportData);
    expect(parsed.favorites.length).toBeGreaterThanOrEqual(1000);

    // 4. 验证性能
    // 导出应该在 1000ms 内完成
    expect(duration).toBeLessThan(1000);
  });

  it('应该能在合理时间内导入大量收藏 (< 2000ms for 1000 items)', async () => {
    // 1. 准备导入数据
    const importData = {
      favorites: Array.from({ length: 1000 }, (_, i) => ({
        id: `import-${i}`,
        title: `导入测试 ${i}`,
        content: `导入内容 ${i}`,
        tags: ['导入'],
        functionMode: 'basic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      categories: [],
      tags: []
    };

    // 2. 测试导入性能
    const startTime = performance.now();

    await manager.importFavorites(JSON.stringify(importData));

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 3. 验证导入成功
    const favorites = await manager.getFavorites();
    expect(favorites.length).toBeGreaterThanOrEqual(1000);

    // 4. 验证性能
    // 导入1000个收藏应该在 2000ms 内完成
    expect(duration).toBeLessThan(2000);
  });

  it('应该能在合理时间内按分类过滤 (< 1000ms)', async () => {
    // 1. 创建分类
    const categoryId = await manager.addCategory({
      name: '性能测试分类',
      description: '用于性能测试',
      color: '#FF5722'
    });

    // 2. 准备大量收藏到该分类
    seedFavorites(
      storage,
      Array.from({ length: 500 }, (_, i) => ({
        title: `分类测试 ${i}`,
        content: `内容 ${i}`,
        tags: ['测试'],
        category: categoryId,
        functionMode: 'basic',
        optimizationMode: 'system'
      })),
    );

    // 3. 测试按分类过滤的性能
    const startTime = performance.now();

    const filtered = await manager.getFavorites({ categoryId });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 4. 验证过滤结果
    expect(filtered.length).toBe(500);

    // 5. 验证性能
    expect(duration).toBeLessThan(1000);
  });

  it('应该能在合理时间内按标签过滤 (< 1000ms)', async () => {
    // 1. 准备大量收藏，部分带特定标签
    seedFavorites(
      storage,
      Array.from({ length: 500 }, (_, i) => ({
        title: `标签测试 ${i}`,
        content: `内容 ${i}`,
        tags: i % 2 === 0 ? ['性能标签', '测试'] : ['测试'],
        functionMode: 'basic',
        optimizationMode: 'system'
      })),
    );

    // 2. 测试按标签过滤的性能
    const startTime = performance.now();

    const filtered = await manager.getFavorites({ tags: ['性能标签'] });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 3. 验证过滤结果
    expect(filtered.length).toBeGreaterThan(0);

    // 4. 验证性能
    expect(duration).toBeLessThan(1000);
  });

  it('应该能在合理时间内更新单个收藏 (< 500ms)', async () => {
    // 1. 添加一个收藏
    const favoriteId = await manager.addFavorite({
      title: '待更新的收藏',
      content: '原始内容',
      tags: ['测试'],
      functionMode: 'basic',
      optimizationMode: 'system'
    });

    // 2. 测试更新性能
    const startTime = performance.now();

    await manager.updateFavorite(favoriteId, {
      title: '更新后的标题',
      content: '更新后的内容'
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 3. 验证更新成功
    const updated = await manager.getFavorite(favoriteId);
    expect(updated!.title).toBe('更新后的标题');

    // 4. 验证性能
    expect(duration).toBeLessThan(500);
  });

  it('应该能在合理时间内删除单个收藏 (< 500ms)', async () => {
    // 1. 添加一个收藏
    const favoriteId = await manager.addFavorite({
      title: '待删除的收藏',
      content: '内容',
      tags: ['测试'],
      functionMode: 'basic',
      optimizationMode: 'system'
    });

    // 2. 测试删除性能
    const startTime = performance.now();

    await manager.deleteFavorite(favoriteId);

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 3. 验证删除成功（getFavorite在找不到时会抛出错误）
    const allFavorites = await manager.getFavorites();
    expect(allFavorites.find(f => f.id === favoriteId)).toBeUndefined();

    // 4. 验证性能
    expect(duration).toBeLessThan(500);
  });

  it('应该能在合理时间内获取标签统计 (< 1000ms for 1000 items)', async () => {
    // 1. 准备大量收藏，包含各种标签
    seedFavorites(
      storage,
      Array.from({ length: 1000 }, (_, i) => ({
        title: `标签统计测试 ${i}`,
        content: `内容 ${i}`,
        tags: [`tag${i % 20}`, '通用标签'],
        functionMode: 'basic',
        optimizationMode: 'system'
      })),
    );

    // 2. 测试标签统计性能
    const startTime = performance.now();

    const tagStats = await manager.getAllTags();

    const endTime = performance.now();
    const duration = endTime - startTime;

    // 3. 验证统计结果
    expect(tagStats.length).toBeGreaterThan(0);

    // 4. 验证性能
    expect(duration).toBeLessThan(1000);
  });
});

/**
 * 内存使用测试
 * 确保没有明显的内存泄漏
 */
describe('内存使用测试', () => {
  let manager: FavoriteManager;
  let storage: Map<string, string>;

  const createMemoryStorage = (): IStorageProvider => {
    storage = new Map();
    return {
      async getItem(key: string): Promise<string | null> {
        return storage.get(key) || null;
      },
      async setItem(key: string, value: string): Promise<void> {
        storage.set(key, value);
      },
      async removeItem(key: string): Promise<void> {
        storage.delete(key);
      },
      async clearAll(): Promise<void> {
        storage.clear();
      },
      async updateData<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void> {
        const currentStr = storage.get(key);
        const currentValue = currentStr ? JSON.parse(currentStr) : null;
        const updated = modifier(currentValue);
        storage.set(key, JSON.stringify(updated));
      },
      async batchUpdate(operations: Array<{
        key: string;
        operation: 'set' | 'remove';
        value?: string;
      }>): Promise<void> {
        for (const op of operations) {
          if (op.operation === 'set' && op.value) {
            storage.set(op.key, op.value);
          } else if (op.operation === 'remove') {
            storage.delete(op.key);
          }
        }
      }
    };
  };

  beforeEach(async () => {
    manager = new FavoriteManager(createMemoryStorage());
    await manager.initialize();
  });

  it('重复添加和删除不应导致内存泄漏', async () => {
    // 1. 记录初始状态
    const initialSize = storage.size;

    // 2. 重复添加和删除
    for (let i = 0; i < 100; i++) {
      const id = await manager.addFavorite({
        title: `临时收藏 ${i}`,
        content: '临时内容',
        tags: ['临时'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.deleteFavorite(id);
    }

    // 3. 验证存储大小没有显著增长
    const finalSize = storage.size;

    // 存储大小应该基本相同或略有增加（因为可能有缓存）
    expect(finalSize - initialSize).toBeLessThan(5);
  });

  it('大量数据操作后存储应该合理', async () => {
    // 1. 准备1000个收藏
    seedFavorites(
      storage,
      Array.from({ length: 1000 }, (_, i) => ({
        title: `收藏 ${i}`,
        content: `内容 ${i}`,
        tags: ['测试'],
        functionMode: 'basic',
        optimizationMode: 'system'
      })),
    );

    // 2. 导出数据检查大小
    const exported = await manager.exportFavorites();
    const exportedSize = exported.length;

    // 3. 存储的数据不应过分膨胀
    // 1000个带标准 promptAsset 的简单收藏应该仍低于收藏软限制
    expect(exportedSize).toBeLessThan(2 * 1024 * 1024); // < 2MB
  });
});
