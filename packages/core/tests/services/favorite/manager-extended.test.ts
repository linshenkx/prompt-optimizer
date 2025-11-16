import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FavoriteManager } from '../../../src/services/favorite/manager';
import type { IStorageProvider } from '../../../src/services/storage/types';
import { FavoriteValidationError } from '../../../src/services/favorite/errors';
import { TypeMapper } from '../../../src/services/favorite/type-mapper';

/**
 * FavoriteManager 扩展功能单元测试
 * 测试 functionMode 验证、分类管理等功能
 */
describe('FavoriteManager - 扩展功能', () => {
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

  describe('addFavorite - functionMode 验证', () => {
    it('应该拒绝缺少 functionMode 的收藏', async () => {
      await expect(
        manager.addFavorite({
          title: '测试',
          content: '内容',
          tags: [],
          // @ts-expect-error 故意省略 functionMode 测试验证
          optimizationMode: 'system'
        })
      ).rejects.toThrow(FavoriteValidationError);
    });

    it('应该接受合法的 basic/system 模式', async () => {
      const id = await manager.addFavorite({
        title: '测试基础模式',
        content: '测试内容',
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      expect(id).toBeTruthy();
      const favorite = await manager.getFavorite(id);
      expect(favorite.functionMode).toBe('basic');
      expect(favorite.optimizationMode).toBe('system');
    });

    it('应该接受合法的 context/user 模式', async () => {
      const id = await manager.addFavorite({
        title: '测试上下文模式',
        content: '测试内容',
        tags: [],
        functionMode: 'context',
        optimizationMode: 'user'
      });

      expect(id).toBeTruthy();
      const favorite = await manager.getFavorite(id);
      expect(favorite.functionMode).toBe('context');
      expect(favorite.optimizationMode).toBe('user');
    });

    it('应该接受合法的 image/text2image 模式', async () => {
      const id = await manager.addFavorite({
        title: '测试图像模式',
        content: '测试内容',
        tags: [],
        functionMode: 'image',
        imageSubMode: 'text2image'
      });

      expect(id).toBeTruthy();
      const favorite = await manager.getFavorite(id);
      expect(favorite.functionMode).toBe('image');
      expect(favorite.imageSubMode).toBe('text2image');
    });

    it('应该拒绝 basic 模式缺少 optimizationMode', async () => {
      await expect(
        manager.addFavorite({
          title: '测试',
          content: '内容',
          tags: [],
          functionMode: 'basic'
          // 缺少 optimizationMode
        })
      ).rejects.toThrow(FavoriteValidationError);
    });

    it('应该拒绝 image 模式缺少 imageSubMode', async () => {
      await expect(
        manager.addFavorite({
          title: '测试',
          content: '内容',
          tags: [],
          functionMode: 'image'
          // 缺少 imageSubMode
        })
      ).rejects.toThrow(FavoriteValidationError);
    });

    it('basic 模式包含 imageSubMode 不会报错(字段会被保存但不使用)', async () => {
      // 注意: 当前实现不验证冲突字段,这是一个已知的设计选择
      const id = await manager.addFavorite({
        title: '测试',
        content: '内容',
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system',
        imageSubMode: 'text2image' // 冗余字段,不会报错
      });

      expect(id).toBeTruthy();
      const favorite = await manager.getFavorite(id);
      expect(favorite.functionMode).toBe('basic');
      expect(favorite.optimizationMode).toBe('system');
      // imageSubMode 会被保存但在 basic 模式下不使用
    });

    it('image 模式包含 optimizationMode 不会报错(字段会被保存但不使用)', async () => {
      // 注意: 当前实现不验证冲突字段,这是一个已知的设计选择
      const id = await manager.addFavorite({
        title: '测试',
        content: '内容',
        tags: [],
        functionMode: 'image',
        imageSubMode: 'text2image',
        optimizationMode: 'system' // 冗余字段,不会报错
      });

      expect(id).toBeTruthy();
      const favorite = await manager.getFavorite(id);
      expect(favorite.functionMode).toBe('image');
      expect(favorite.imageSubMode).toBe('text2image');
      // optimizationMode 会被保存但在 image 模式下不使用
    });
  });

  describe('addFavorite - metadata 处理', () => {
    it('应该正确存储 metadata.originalContent', async () => {
      const id = await manager.addFavorite({
        title: '测试',
        content: '优化后内容',
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system',
        metadata: {
          originalContent: '原始内容'
        }
      });

      const favorite = await manager.getFavorite(id);
      expect(favorite.metadata?.originalContent).toBe('原始内容');
    });

    it('应该正确存储 metadata.sourceHistoryId', async () => {
      const id = await manager.addFavorite({
        title: '测试',
        content: '优化后内容',
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system',
        metadata: {
          sourceHistoryId: 'history-123'
        }
      });

      const favorite = await manager.getFavorite(id);
      expect(favorite.metadata?.sourceHistoryId).toBe('history-123');
    });

    it('应该保留其他 metadata 字段', async () => {
      const id = await manager.addFavorite({
        title: '测试',
        content: '内容',
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system',
        metadata: {
          customField: '自定义值',
          anotherField: 123
        }
      });

      const favorite = await manager.getFavorite(id);
      expect(favorite.metadata?.customField).toBe('自定义值');
      expect(favorite.metadata?.anotherField).toBe(123);
    });
  });

  describe('分类管理 - reorderCategories', () => {
    it('应该能重新排序分类', async () => {
      // 创建测试分类
      const cat1Id = await manager.addCategory({ name: '分类1', color: '#ff0000' });
      const cat2Id = await manager.addCategory({ name: '分类2', color: '#00ff00' });
      const cat3Id = await manager.addCategory({ name: '分类3', color: '#0000ff' });

      // 重新排序：3, 1, 2
      await manager.reorderCategories([cat3Id, cat1Id, cat2Id]);

      const categories = await manager.getCategories();

      // 按 sortOrder 排序
      const sorted = categories.sort((a, b) => a.sortOrder - b.sortOrder);

      expect(sorted[0].id).toBe(cat3Id);
      expect(sorted[0].sortOrder).toBe(0);

      expect(sorted[1].id).toBe(cat1Id);
      expect(sorted[1].sortOrder).toBe(1);

      expect(sorted[2].id).toBe(cat2Id);
      expect(sorted[2].sortOrder).toBe(2);
    });

    it('应该过滤不存在的分类ID', async () => {
      const cat1Id = await manager.addCategory({ name: '分类1', color: '#ff0000' });

      // 包含不存在的ID
      await manager.reorderCategories(['non-existent', cat1Id]);

      const categories = await manager.getCategories();
      const existingCategory = categories.find(c => c.id === cat1Id);

      expect(existingCategory).toBeDefined();
      expect(existingCategory!.sortOrder).toBeDefined();
    });

    it('空数组应该抛出验证错误', async () => {
      await expect(manager.reorderCategories([])).rejects.toThrow(FavoriteValidationError);
    });
  });

  describe('分类管理 - getCategoryUsage', () => {
    it('应该返回分类的使用次数', async () => {
      const catId = await manager.addCategory({ name: '测试分类', color: '#ff0000' });

      // 添加3个收藏使用该分类
      await manager.addFavorite({
        title: '收藏1',
        content: '内容1',
        category: catId,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: '收藏2',
        content: '内容2',
        category: catId,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: '收藏3',
        content: '内容3',
        category: catId,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const usage = await manager.getCategoryUsage(catId);
      expect(usage).toBe(3);
    });

    it('应该返回0对于未使用的分类', async () => {
      const catId = await manager.addCategory({ name: '未使用分类', color: '#ff0000' });

      const usage = await manager.getCategoryUsage(catId);
      expect(usage).toBe(0);
    });

    it('应该返回0对于不存在的分类', async () => {
      const usage = await manager.getCategoryUsage('non-existent-id');
      expect(usage).toBe(0);
    });

    it('不同分类应该独立计数', async () => {
      const cat1Id = await manager.addCategory({ name: '分类1', color: '#ff0000' });
      const cat2Id = await manager.addCategory({ name: '分类2', color: '#00ff00' });

      // 分类1: 2个收藏
      await manager.addFavorite({
        title: '收藏1-1',
        content: '内容',
        category: cat1Id,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      await manager.addFavorite({
        title: '收藏1-2',
        content: '内容',
        category: cat1Id,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      // 分类2: 1个收藏
      await manager.addFavorite({
        title: '收藏2-1',
        content: '内容',
        category: cat2Id,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const usage1 = await manager.getCategoryUsage(cat1Id);
      const usage2 = await manager.getCategoryUsage(cat2Id);

      expect(usage1).toBe(2);
      expect(usage2).toBe(1);
    });
  });

  describe('分类管理 - deleteCategory', () => {
    it('删除分类时应清空收藏的分类字段并返回受影响数量', async () => {
      const catId = await manager.addCategory({ name: '测试分类', color: '#ff0000' });

      // 添加2个使用该分类的收藏
      const fav1Id = await manager.addFavorite({
        title: '收藏1',
        content: '内容1',
        category: catId,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      const fav2Id = await manager.addFavorite({
        title: '收藏2',
        content: '内容2',
        category: catId,
        tags: [],
        functionMode: 'basic',
        optimizationMode: 'system'
      });

      // 删除分类
      const affectedCount = await manager.deleteCategory(catId);

      // 应该返回受影响的收藏数量
      expect(affectedCount).toBe(2);

      // 收藏的分类字段应该被清空
      const fav1 = await manager.getFavorite(fav1Id);
      const fav2 = await manager.getFavorite(fav2Id);
      expect(fav1.category).toBeUndefined();
      expect(fav2.category).toBeUndefined();

      // 分类应该被删除
      const categories = await manager.getCategories();
      expect(categories.find(c => c.id === catId)).toBeUndefined();
    });

    it('删除空分类应该返回0', async () => {
      const catId = await manager.addCategory({ name: '空分类', color: '#ff0000' });

      const affectedCount = await manager.deleteCategory(catId);

      expect(affectedCount).toBe(0);
    });

    it('删除不存在的分类应该抛出错误', async () => {
      await expect(manager.deleteCategory('non-existent-id')).rejects.toThrow();
    });
  });

  describe('ensureDefaultCategories - 默认分类管理', () => {
    it('首次调用应该创建默认分类', async () => {
      const customCategories = [
        { name: 'Category 1', description: 'Desc 1', color: '#FF0000' },
        { name: 'Category 2', description: 'Desc 2', color: '#00FF00' }
      ];

      await manager.ensureDefaultCategories(customCategories);
      const categories = await manager.getCategories();

      expect(categories.length).toBe(2);
      expect(categories.find(c => c.name === 'Category 1')).toBeDefined();
      expect(categories.find(c => c.name === 'Category 2')).toBeDefined();
    });

    it('用户删除所有分类后不应自动重建', async () => {
      // 首次创建
      await manager.ensureDefaultCategories([
        { name: 'Cat1', color: '#FF0000' }
      ]);

      let categories = await manager.getCategories();
      expect(categories.length).toBe(1);

      // 用户删除所有分类
      for (const cat of categories) {
        await manager.deleteCategory(cat.id);
      }

      categories = await manager.getCategories();
      expect(categories.length).toBe(0);

      // 再次调用不应创建(已标记为已初始化)
      await manager.ensureDefaultCategories([
        { name: 'Cat1', color: '#FF0000' }
      ]);

      categories = await manager.getCategories();
      expect(categories.length).toBe(0); // 仍然为0
    });

    it('已有分类时不应重复创建', async () => {
      // 先手动创建一个分类
      await manager.addCategory({ name: 'Existing', color: '#000000' });

      // 调用 ensureDefaultCategories 不应创建新分类
      await manager.ensureDefaultCategories([
        { name: 'New Category', color: '#FFFFFF' }
      ]);

      const categories = await manager.getCategories();
      expect(categories.length).toBe(1); // 仍然只有1个
      expect(categories[0].name).toBe('Existing');
    });

    it('默认分类应该有正确的 sortOrder', async () => {
      await manager.ensureDefaultCategories([
        { name: 'Cat1', color: '#FF0000' },
        { name: 'Cat2', color: '#00FF00' },
        { name: 'Cat3', color: '#0000FF' }
      ]);

      const categories = await manager.getCategories();
      const sorted = categories.sort((a, b) => a.sortOrder - b.sortOrder);

      // sortOrder 应该是连续递增的
      sorted.forEach((cat, index) => {
        expect(cat.sortOrder).toBe(index);
      });
    });
  });

  describe('TypeMapper 集成测试', () => {
    it('TypeMapper 映射的结果应该能通过 addFavorite 验证', () => {
      const testTypes = [
        'optimize',
        'userOptimize',
        'conversationMessageOptimize',
        'contextUserOptimize',
        'imageOptimize',
        'text2imageOptimize',
        'image2imageOptimize'
      ] as const;

      testTypes.forEach(type => {
        const mapping = TypeMapper.mapFromRecordType(type);
        // 验证映射结果的有效性
        expect(TypeMapper.validateMapping(mapping)).toBe(true);
      });
    });

    it('应该能使用 TypeMapper 映射结果创建收藏', async () => {
      const mapping = TypeMapper.mapFromRecordType('optimize');

      const id = await manager.addFavorite({
        title: '从TypeMapper映射创建',
        content: '测试内容',
        tags: [],
        ...mapping
      });

      expect(id).toBeTruthy();

      const favorite = await manager.getFavorite(id);
      expect(favorite.functionMode).toBe(mapping.functionMode);
      expect(favorite.optimizationMode).toBe(mapping.optimizationMode);
    });
  });
});
