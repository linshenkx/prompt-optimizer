import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FavoriteManager } from '../../../src/services/favorite/manager';
import type { IStorageProvider } from '../../../src/services/storage/types';
import { TypeMapper } from '../../../src/services/favorite/type-mapper';
import type { PromptRecordType } from '../../../src/services/history/types';

/**
 * FavoriteManager 集成测试
 * 测试完整的业务流程和跨功能交互
 */
describe('FavoriteManager - 集成测试', () => {
  let manager: FavoriteManager;
  let mockStorage: Map<string, string>;
  let storageProvider: IStorageProvider;

  beforeEach(() => {
    // 创建模拟存储
    mockStorage = new Map<string, string>();

    storageProvider = {
      getItem: vi.fn(async (key: string) => mockStorage.get(key) || null),
      setItem: vi.fn(async (key: string, value: string) => {
        mockStorage.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        mockStorage.delete(key);
      }),
      clearAll: vi.fn(async () => {
        mockStorage.clear();
      }),
      batchUpdate: vi.fn(async (operations: Array<{ key: string; operation: 'set' | 'remove'; value?: string }>) => {
        operations.forEach(({ key, operation, value }) => {
          if (operation === 'set' && value) {
            mockStorage.set(key, value);
          } else if (operation === 'remove') {
            mockStorage.delete(key);
          }
        });
      }),
      updateData: vi.fn(async (key: string, updater: (data: any) => any) => {
        const currentData = mockStorage.get(key);
        const parsedData = currentData ? JSON.parse(currentData) : null;
        const updatedData = updater(parsedData);
        mockStorage.set(key, JSON.stringify(updatedData));
      })
    };

    manager = new FavoriteManager(storageProvider);
  });

  describe('收藏 CRUD 完整流程', () => {
    it('应该完成完整的增删改查流程', async () => {
      // 1. 创建分类
      const categoryId = await manager.addCategory({
        name: '测试分类',
        description: '用于集成测试',
        color: '#FF5722'
      });

      // 2. 添加收藏
      const favoriteId = await manager.addFavorite({
        title: '测试收藏',
        content: '测试内容',
        tags: ['测试', '集成'],
        category: categoryId,
        functionMode: 'basic',
        optimizationMode: 'system',
        metadata: {
          originalContent: '原始内容',
          sourceHistoryId: 'history-001'
        }
      });

      expect(favoriteId).toBeTruthy();

      // 3. 查询单个收藏
      const favorite = await manager.getFavorite(favoriteId);
      expect(favorite.id).toBe(favoriteId);
      expect(favorite.title).toBe('测试收藏');
      expect(favorite.tags).toEqual(['测试', '集成']);
      expect(favorite.category).toBe(categoryId);
      expect(favorite.functionMode).toBe('basic');
      expect(favorite.optimizationMode).toBe('system');
      expect(favorite.metadata?.originalContent).toBe('原始内容');
      expect(favorite.metadata?.sourceHistoryId).toBe('history-001');

      // 4. 查询列表
      const favorites = await manager.getFavorites();
      expect(favorites.length).toBe(1);
      expect(favorites[0].id).toBe(favoriteId);

      // 5. 更新收藏
      await manager.updateFavorite(favoriteId, {
        title: '更新后的标题',
        tags: ['测试', '集成', '更新'],
        functionMode: 'context',
        optimizationMode: 'user'
      });

      const updated = await manager.getFavorite(favoriteId);
      expect(updated.title).toBe('更新后的标题');
      expect(updated.tags).toEqual(['测试', '集成', '更新']);
      expect(updated.functionMode).toBe('context');
      expect(updated.optimizationMode).toBe('user');
      expect(updated.updatedAt).not.toBe(favorite.updatedAt);

      // 6. 删除收藏
      await manager.deleteFavorite(favoriteId);
      const allFavorites = await manager.getFavorites();
      expect(allFavorites.length).toBe(0);

      // 7. 验证分类仍然存在
      const categories = await manager.getCategories();
      expect(categories.find(c => c.id === categoryId)).toBeDefined();
    });

    it('应该正确处理多个收藏的关联关系', async () => {
      // 创建2个分类
      const cat1Id = await manager.addCategory({ name: '分类1', color: '#FF0000' });
      const cat2Id = await manager.addCategory({ name: '分类2', color: '#00FF00' });

      // 创建3个收藏
      const fav1Id = await manager.addFavorite({
        title: '收藏1',
        content: '内容1',
        tags: ['共享标签', '标签1'],
        category: cat1Id,
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const fav2Id = await manager.addFavorite({
        title: '收藏2',
        content: '内容2',
        tags: ['共享标签', '标签2'],
        category: cat1Id,
        functionMode: 'basic',
        optimizationMode: 'user'
      });

      const fav3Id = await manager.addFavorite({
        title: '收藏3',
        content: '内容3',
        tags: ['标签3'],
        category: cat2Id,
        functionMode: 'image',
        imageSubMode: 'text2image'
      });

      // 验证标签统计
      const tags = await manager.getAllTags();
      const sharedTag = tags.find(t => t.tag === '共享标签');
      expect(sharedTag?.count).toBe(2);

      // 验证分类使用统计
      const cat1Usage = await manager.getCategoryUsage(cat1Id);
      const cat2Usage = await manager.getCategoryUsage(cat2Id);
      expect(cat1Usage).toBe(2);
      expect(cat2Usage).toBe(1);

      // 按分类查询
      const cat1Favorites = await manager.getFavorites({ categoryId: cat1Id });
      expect(cat1Favorites.length).toBe(2);

      // 按标签查询
      const sharedTagFavorites = await manager.getFavorites({ tags: ['共享标签'] });
      expect(sharedTagFavorites.length).toBe(2);
    });

    it('应该支持功能模式验证的完整流程', async () => {
      // 添加各种模式的收藏
      const basicId = await manager.addFavorite({
        title: 'Basic Mode',
        content: 'Content',
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const contextId = await manager.addFavorite({
        title: 'Context Mode',
        content: 'Content',
        tags: [],
        functionMode: 'context',
        optimizationMode: 'user'
      });

      const imageId = await manager.addFavorite({
        title: 'Image Mode',
        content: 'Content',
        tags: [],
        functionMode: 'image',
        imageSubMode: 'text2image'
      });

      // 验证每个收藏的模式
      const basic = await manager.getFavorite(basicId);
      expect(basic.functionMode).toBe('basic');
      expect(basic.optimizationMode).toBe('system');
      expect(basic.imageSubMode).toBeUndefined();

      const context = await manager.getFavorite(contextId);
      expect(context.functionMode).toBe('context');
      expect(context.optimizationMode).toBe('user');
      expect(context.imageSubMode).toBeUndefined();

      const image = await manager.getFavorite(imageId);
      expect(image.functionMode).toBe('image');
      expect(image.imageSubMode).toBe('text2image');
      expect(image.optimizationMode).toBeUndefined();

      // 更新模式应该生效
      await manager.updateFavorite(basicId, {
        functionMode: 'context',
        optimizationMode: 'system'
      });

      const updated = await manager.getFavorite(basicId);
      expect(updated.functionMode).toBe('context');
      expect(updated.optimizationMode).toBe('system');
    });
  });

  describe('从优化历史保存收藏集成测试', () => {
    it('应该从 optimize 类型正确创建收藏', async () => {
      // 模拟历史记录
      const recordType: PromptRecordType = 'optimize';
      const mapping = TypeMapper.mapFromRecordType(recordType);

      // 创建收藏
      const favoriteId = await manager.addFavorite({
        title: '优化后的提示词',
        content: '这是优化后的内容',
        tags: ['AI', '优化'],
        ...mapping,
        metadata: {
          originalContent: '这是原始内容',
          sourceHistoryId: 'hist-123'
        }
      });

      // 验证
      const favorite = await manager.getFavorite(favoriteId);
      expect(favorite.functionMode).toBe('basic');
      expect(favorite.optimizationMode).toBe('system');
      expect(favorite.metadata?.originalContent).toBe('这是原始内容');
      expect(favorite.metadata?.sourceHistoryId).toBe('hist-123');
    });

    it('应该从 contextUserOptimize 类型正确创建收藏', async () => {
      const recordType: PromptRecordType = 'contextUserOptimize';
      const mapping = TypeMapper.mapFromRecordType(recordType);

      const favoriteId = await manager.addFavorite({
        title: '用户上下文优化',
        content: '优化内容',
        tags: [],
        ...mapping,
        metadata: {
          originalContent: '原始内容',
          sourceHistoryId: 'hist-456'
        }
      });

      const favorite = await manager.getFavorite(favoriteId);
      expect(favorite.functionMode).toBe('context');
      expect(favorite.optimizationMode).toBe('user');
    });

    it('应该从 imageOptimize 类型正确创建收藏', async () => {
      const recordType: PromptRecordType = 'imageOptimize';
      const mapping = TypeMapper.mapFromRecordType(recordType);

      const favoriteId = await manager.addFavorite({
        title: '图像提示词优化',
        content: '优化后的图像提示词',
        tags: ['图像生成'],
        ...mapping
      });

      const favorite = await manager.getFavorite(favoriteId);
      expect(favorite.functionMode).toBe('image');
      expect(favorite.imageSubMode).toBe('text2image');
    });

    it('应该从 image2imageOptimize 类型正确创建收藏', async () => {
      const recordType: PromptRecordType = 'image2imageOptimize';
      const mapping = TypeMapper.mapFromRecordType(recordType);

      const favoriteId = await manager.addFavorite({
        title: '图生图提示词',
        content: '图生图优化内容',
        tags: [],
        ...mapping
      });

      const favorite = await manager.getFavorite(favoriteId);
      expect(favorite.functionMode).toBe('image');
      expect(favorite.imageSubMode).toBe('image2image');
    });

    it('应该处理所有历史记录类型', async () => {
      const allTypes: PromptRecordType[] = [
        'optimize',
        'userOptimize',
        'iterate',
        'test',
        'conversationMessageOptimize',
        'contextUserOptimize',
        'contextIterate',
        'imageOptimize',
        'contextImageOptimize',
        'imageIterate',
        'text2imageOptimize',
        'image2imageOptimize'
      ];

      const ids: string[] = [];

      for (const type of allTypes) {
        const mapping = TypeMapper.mapFromRecordType(type);
        const id = await manager.addFavorite({
          title: `收藏-${type}`,
          content: `内容-${type}`,
          tags: [type],
          ...mapping
        });
        ids.push(id);
      }

      // 验证所有收藏都创建成功
      expect(ids.length).toBe(allTypes.length);

      const favorites = await manager.getFavorites();
      expect(favorites.length).toBe(allTypes.length);

      // 验证每个收藏的功能模式都有效
      for (const favorite of favorites) {
        const mapping = {
          functionMode: favorite.functionMode,
          optimizationMode: favorite.optimizationMode,
          imageSubMode: favorite.imageSubMode
        };
        expect(TypeMapper.validateMapping(mapping)).toBe(true);
      }
    });
  });

  describe('标签和分类管理集成测试', () => {
    it('标签重命名应该更新所有关联收藏', async () => {
      // 创建多个使用相同标签的收藏
      await manager.addFavorite({
        title: '收藏1',
        content: '内容1',
        tags: ['旧标签', '其他标签'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: '收藏2',
        content: '内容2',
        tags: ['旧标签'],
        functionMode: 'basic',
        optimizationMode: 'user'
      });

      await manager.addFavorite({
        title: '收藏3',
        content: '内容3',
        tags: ['不相关标签'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      // 重命名标签
      await manager.renameTag('旧标签', '新标签');

      // 验证所有收藏更新
      const favorites = await manager.getFavorites();
      const fav1 = favorites.find(f => f.title === '收藏1');
      const fav2 = favorites.find(f => f.title === '收藏2');
      const fav3 = favorites.find(f => f.title === '收藏3');

      expect(fav1?.tags).toContain('新标签');
      expect(fav1?.tags).not.toContain('旧标签');
      expect(fav1?.tags).toContain('其他标签');

      expect(fav2?.tags).toContain('新标签');
      expect(fav2?.tags).not.toContain('旧标签');

      expect(fav3?.tags).toContain('不相关标签');
      expect(fav3?.tags).not.toContain('新标签');

      // 验证标签统计
      const tags = await manager.getAllTags();
      const newTag = tags.find(t => t.tag === '新标签');
      const oldTag = tags.find(t => t.tag === '旧标签');

      expect(newTag?.count).toBe(2);
      expect(oldTag).toBeUndefined();
    });

    it('标签合并应该正确去重', async () => {
      // 创建测试数据
      await manager.addFavorite({
        title: '收藏1',
        content: '内容',
        tags: ['标签A', '标签B'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: '收藏2',
        content: '内容',
        tags: ['标签A', '标签C'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: '收藏3',
        content: '内容',
        tags: ['标签B', '标签C'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      // 合并标签A和标签B -> 标签B
      await manager.mergeTags(['标签A'], '标签B');

      const favorites = await manager.getFavorites();
      const fav1 = favorites.find(f => f.title === '收藏1');
      const fav2 = favorites.find(f => f.title === '收藏2');
      const fav3 = favorites.find(f => f.title === '收藏3');

      // 收藏1: 原本 [A, B] -> [B] (去重)
      expect(fav1?.tags).toEqual(['标签B']);

      // 收藏2: 原本 [A, C] -> [B, C]
      expect(fav2?.tags).toContain('标签B');
      expect(fav2?.tags).toContain('标签C');
      expect(fav2?.tags).not.toContain('标签A');

      // 收藏3: 原本 [B, C] -> [B, C] (不变)
      expect(fav3?.tags).toContain('标签B');
      expect(fav3?.tags).toContain('标签C');

      // 验证标签统计
      const tags = await manager.getAllTags();
      const tagA = tags.find(t => t.tag === '标签A');
      const tagB = tags.find(t => t.tag === '标签B');

      expect(tagA).toBeUndefined();
      expect(tagB?.count).toBe(3); // 所有3个收藏都有标签B
    });

    it('标签删除应该从所有收藏中移除', async () => {
      await manager.addFavorite({
        title: '收藏1',
        content: '内容',
        tags: ['要删除', '保留'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: '收藏2',
        content: '内容',
        tags: ['要删除'],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.deleteTag('要删除');

      const favorites = await manager.getFavorites();
      favorites.forEach(fav => {
        expect(fav.tags).not.toContain('要删除');
      });

      const tags = await manager.getAllTags();
      expect(tags.find(t => t.tag === '要删除')).toBeUndefined();
      expect(tags.find(t => t.tag === '保留')).toBeDefined();
    });

    it('分类排序应该更新所有分类的 sortOrder', async () => {
      const cat1 = await manager.addCategory({ name: '分类1', color: '#FF0000' });
      const cat2 = await manager.addCategory({ name: '分类2', color: '#00FF00' });
      const cat3 = await manager.addCategory({ name: '分类3', color: '#0000FF' });

      // 新顺序: 3, 1, 2
      await manager.reorderCategories([cat3, cat1, cat2]);

      const categories = await manager.getCategories();
      const sorted = categories.sort((a, b) => a.sortOrder - b.sortOrder);

      expect(sorted[0].id).toBe(cat3);
      expect(sorted[0].sortOrder).toBe(0);
      expect(sorted[1].id).toBe(cat1);
      expect(sorted[1].sortOrder).toBe(1);
      expect(sorted[2].id).toBe(cat2);
      expect(sorted[2].sortOrder).toBe(2);
    });

    it('分类使用统计应该实时更新', async () => {
      const catId = await manager.addCategory({ name: '测试分类', color: '#FF0000' });

      // 初始使用为0
      expect(await manager.getCategoryUsage(catId)).toBe(0);

      // 添加收藏
      const fav1 = await manager.addFavorite({
        title: '收藏1',
        content: '内容',
        tags: [],
        category: catId,
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      expect(await manager.getCategoryUsage(catId)).toBe(1);

      const fav2 = await manager.addFavorite({
        title: '收藏2',
        content: '内容',
        tags: [],
        category: catId,
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      expect(await manager.getCategoryUsage(catId)).toBe(2);

      // 删除一个收藏
      await manager.deleteFavorite(fav1);
      expect(await manager.getCategoryUsage(catId)).toBe(1);

      // 更新收藏移除分类
      await manager.updateFavorite(fav2, { category: undefined });
      expect(await manager.getCategoryUsage(catId)).toBe(0);
    });

    it('删除分类应该清空关联收藏的分类字段', async () => {
      const catId = await manager.addCategory({ name: '要删除的分类', color: '#FF0000' });

      const fav1 = await manager.addFavorite({
        title: '收藏1',
        content: '内容',
        tags: [],
        category: catId,
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const fav2 = await manager.addFavorite({
        title: '收藏2',
        content: '内容',
        tags: [],
        category: catId,
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const affectedCount = await manager.deleteCategory(catId);
      expect(affectedCount).toBe(2);

      const updated1 = await manager.getFavorite(fav1);
      const updated2 = await manager.getFavorite(fav2);

      expect(updated1.category).toBeUndefined();
      expect(updated2.category).toBeUndefined();
    });
  });

  describe('导入导出集成测试', () => {
    it('应该正确导出和导入包含所有关联数据', async () => {
      // 创建完整的测试数据
      const catId = await manager.addCategory({
        name: '测试分类',
        description: '描述',
        color: '#FF5722'
      });

      await manager.addFavorite({
        title: '完整收藏',
        content: '内容',
        tags: ['标签1', '标签2'],
        category: catId,
        functionMode: 'basic',
        optimizationMode: 'system',
        metadata: {
          originalContent: '原始内容',
          sourceHistoryId: 'hist-001',
          customField: '自定义值'
        }
      });

      // 导出
      const exportData = await manager.exportFavorites();

      // 清空数据
      await storageProvider.clearAll();

      // 导入
      await manager.importFavorites(exportData);

      // 验证
      const favorites = await manager.getFavorites();
      expect(favorites.length).toBe(1);

      const favorite = favorites[0];
      expect(favorite.title).toBe('完整收藏');
      expect(favorite.tags).toEqual(['标签1', '标签2']);
      expect(favorite.category).toBe(catId);
      expect(favorite.functionMode).toBe('basic');
      expect(favorite.optimizationMode).toBe('system');
      expect(favorite.metadata?.originalContent).toBe('原始内容');
      expect(favorite.metadata?.sourceHistoryId).toBe('hist-001');
      expect(favorite.metadata?.customField).toBe('自定义值');

      const categories = await manager.getCategories();
      expect(categories.length).toBe(1);
      expect(categories[0].name).toBe('测试分类');
    });

    it('应该正确处理导入时的分类和标签关联', async () => {
      const cat1 = await manager.addCategory({ name: '分类1', color: '#FF0000' });
      const cat2 = await manager.addCategory({ name: '分类2', color: '#00FF00' });

      await manager.addFavorite({
        title: '收藏1',
        content: '内容1',
        tags: ['共享', 'A'],
        category: cat1,
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: '收藏2',
        content: '内容2',
        tags: ['共享', 'B'],
        category: cat2,
        functionMode: 'context',
        optimizationMode: 'user'
      });

      const exportData = await manager.exportFavorites();
      await storageProvider.clearAll();
      await manager.importFavorites(exportData);

      // 验证分类
      const categories = await manager.getCategories();
      expect(categories.length).toBe(2);

      // 验证标签
      const tags = await manager.getAllTags();
      const sharedTag = tags.find(t => t.tag === '共享');
      expect(sharedTag?.count).toBe(2);

      // 验证收藏
      const favorites = await manager.getFavorites();
      expect(favorites.length).toBe(2);
    });
  });

  describe('搜索和过滤集成测试', () => {
    beforeEach(async () => {
      // 创建测试数据集
      const cat1 = await manager.addCategory({ name: 'AI工具', color: '#FF0000' });
      const cat2 = await manager.addCategory({ name: '写作助手', color: '#00FF00' });

      await manager.addFavorite({
        title: 'ChatGPT提示词',
        content: '帮助我写一个关于AI的文章',
        tags: ['AI', 'ChatGPT'],
        category: cat1,
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: '创意写作助手',
        content: '帮我生成创意故事大纲',
        tags: ['写作', '创意'],
        category: cat2,
        functionMode: 'context',
        optimizationMode: 'user'
      });

      await manager.addFavorite({
        title: 'AI绘图提示词',
        content: 'a beautiful sunset over mountains',
        tags: ['AI', '绘图'],
        category: cat1,
        functionMode: 'image',
        imageSubMode: 'text2image'
      });
    });

    it('应该能按关键词搜索', async () => {
      const results = await manager.searchFavorites('AI');
      expect(results.length).toBe(2);
      expect(results.every(f => f.title.includes('AI') || f.content.includes('AI'))).toBe(true);
    });

    it('应该能按分类过滤', async () => {
      const categories = await manager.getCategories();
      const aiCategory = categories.find(c => c.name === 'AI工具');

      const results = await manager.getFavorites({ categoryId: aiCategory!.id });
      expect(results.length).toBe(2);
      expect(results.every(f => f.category === aiCategory!.id)).toBe(true);
    });

    it('应该能按标签过滤', async () => {
      const results = await manager.getFavorites({ tags: ['AI'] });
      expect(results.length).toBe(2);
      expect(results.every(f => f.tags.includes('AI'))).toBe(true);
    });

    it('应该支持组合过滤', async () => {
      const categories = await manager.getCategories();
      const aiCategory = categories.find(c => c.name === 'AI工具');

      const results = await manager.searchFavorites('提示词', {
        tags: ['AI'],
        categoryId: aiCategory!.id
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(f => {
        expect(f.title.includes('提示词') || f.content.includes('提示词')).toBe(true);
        expect(f.tags.includes('AI')).toBe(true);
        expect(f.category).toBe(aiCategory!.id);
      });
    });
  });
});
