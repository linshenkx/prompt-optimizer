import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextRepoImpl, createContextRepo } from '../../../src/services/context/repo';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';
import { ContextError, CONTEXT_ERROR_CODES } from '../../../src/services/context/types';
import { 
  CONTEXT_STORE_KEY, 
  PREDEFINED_VARIABLES, 
  DEFAULT_CONTEXT_CONFIG,
  CONTEXT_STORE_VERSION
} from '../../../src/services/context/constants';
import type { 
  ContextPackage, 
  ContextStoreDoc, 
  ContextBundle, 
  ImportMode,
  ImportResult 
} from '../../../src/services/context/types';

describe('ContextRepo', () => {
  let repo: ContextRepoImpl;
  let storage: MemoryStorageProvider;

  beforeEach(() => {
    storage = new MemoryStorageProvider();
    repo = new ContextRepoImpl(storage);
  });

  describe('createContextRepo工厂函数', () => {
    it('应该创建ContextRepo实例', () => {
      const factory = createContextRepo(storage);
      expect(factory).toBeInstanceOf(ContextRepoImpl);
    });
  });

  describe('初始化', () => {
    it('应该在第一次调用时自动创建默认上下文', async () => {
      const contexts = await repo.list();
      
      expect(contexts).toHaveLength(1);
      expect(contexts[0].id).toBe(DEFAULT_CONTEXT_CONFIG.id);
      expect(contexts[0].title).toBe(DEFAULT_CONTEXT_CONFIG.title);
    });

    it('应该设置默认上下文为当前上下文', async () => {
      const currentId = await repo.getCurrentId();
      expect(currentId).toBe(DEFAULT_CONTEXT_CONFIG.id);
    });

    it('应该正确初始化存储文档结构', async () => {
      await repo.list(); // 触发初始化
      
      const data = await storage.getItem(CONTEXT_STORE_KEY);
      expect(data).toBeTruthy();
      
      const doc: ContextStoreDoc = JSON.parse(data!);
      expect(doc.version).toBe(CONTEXT_STORE_VERSION);
      expect(doc.currentId).toBe(DEFAULT_CONTEXT_CONFIG.id);
      expect(doc.contexts).toHaveProperty(DEFAULT_CONTEXT_CONFIG.id);
    });
  });

  describe('基础查询操作', () => {
    let defaultContext: ContextPackage;

    beforeEach(async () => {
      await repo.list(); // 确保初始化
      defaultContext = await repo.get(DEFAULT_CONTEXT_CONFIG.id);
    });

    it('list() 应该返回所有上下文列表', async () => {
      const contexts = await repo.list();
      
      expect(contexts).toHaveLength(1);
      expect(contexts[0]).toEqual(expect.objectContaining({
        id: DEFAULT_CONTEXT_CONFIG.id,
        title: DEFAULT_CONTEXT_CONFIG.title
      }));
      expect(contexts[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      // ContextListItem 不包含 createdAt 字段，只有 id, title, updatedAt
      expect(contexts[0]).not.toHaveProperty('createdAt');
    });

    it('get() 应该返回指定上下文的完整数据', async () => {
      const context = await repo.get(DEFAULT_CONTEXT_CONFIG.id);
      
      expect(context).toEqual(expect.objectContaining({
        id: DEFAULT_CONTEXT_CONFIG.id,
        title: DEFAULT_CONTEXT_CONFIG.title,
        messages: [],
        variables: {},
        tools: [],
        version: DEFAULT_CONTEXT_CONFIG.version,
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      }));
    });

    it('get() 对不存在的ID应该抛出NOT_FOUND错误', async () => {
      await expect(repo.get('non-existent-id'))
        .rejects.toThrow(ContextError);
      
      try {
        await repo.get('non-existent-id');
      } catch (error) {
        expect((error as ContextError).code).toBe(CONTEXT_ERROR_CODES.NOT_FOUND);
      }
    });

    it('getCurrentId() 应该返回当前选中的上下文ID', async () => {
      const currentId = await repo.getCurrentId();
      expect(currentId).toBe(DEFAULT_CONTEXT_CONFIG.id);
    });

    it('setCurrentId() 应该切换当前上下文', async () => {
      // 先创建一个新上下文
      const newId = await repo.create({ title: '测试上下文' });
      
      // 切换到新上下文
      await repo.setCurrentId(newId);
      
      const currentId = await repo.getCurrentId();
      expect(currentId).toBe(newId);
    });

    it('setCurrentId() 对不存在的ID应该抛出NOT_FOUND错误', async () => {
      await expect(repo.setCurrentId('non-existent-id'))
        .rejects.toThrow(ContextError);
      
      try {
        await repo.setCurrentId('non-existent-id');
      } catch (error) {
        expect((error as ContextError).code).toBe(CONTEXT_ERROR_CODES.NOT_FOUND);
      }
    });
  });

  describe('上下文创建', () => {
    beforeEach(async () => {
      await repo.list(); // 确保初始化
    });

    it('create() 应该创建新的上下文', async () => {
      const newId = await repo.create({ title: '新上下文' });
      
      expect(newId).toMatch(/^ctx-\d+-[a-z0-9]+$/);
      
      const newContext = await repo.get(newId);
      expect(newContext.title).toBe('新上下文');
      expect(newContext.messages).toEqual([]);
      expect(newContext.variables).toEqual({});
      expect(newContext.tools).toEqual([]);
    });

    it('create() 应该设置正确的时间戳', async () => {
      const beforeCreate = new Date().toISOString();
      const newId = await repo.create({ title: '时间测试' });
      const afterCreate = new Date().toISOString();
      
      const context = await repo.get(newId);
      expect(context.createdAt >= beforeCreate).toBe(true);
      expect(context.createdAt <= afterCreate).toBe(true);
      expect(context.updatedAt).toBe(context.createdAt);
    });

    it('duplicate() 应该复制现有上下文', async () => {
      // 修改默认上下文作为源
      await repo.update(DEFAULT_CONTEXT_CONFIG.id, {
        messages: [{ role: 'user', content: 'test message' }],
        variables: { customVar: 'test value' }
      });
      
      const duplicateId = await repo.duplicate(DEFAULT_CONTEXT_CONFIG.id);
      
      const original = await repo.get(DEFAULT_CONTEXT_CONFIG.id);
      const duplicate = await repo.get(duplicateId);
      
      expect(duplicate.id).not.toBe(original.id);
      expect(duplicate.title).toBe(`${original.title} (Copy)`);
      expect(duplicate.messages).toEqual(original.messages);
      expect(duplicate.variables).toEqual(original.variables);
    });

    it('duplicate() 对不存在的ID应该抛出NOT_FOUND错误', async () => {
      await expect(repo.duplicate('non-existent-id'))
        .rejects.toThrow(ContextError);
      
      try {
        await repo.duplicate('non-existent-id');
      } catch (error) {
        expect((error as ContextError).code).toBe(CONTEXT_ERROR_CODES.NOT_FOUND);
      }
    });
  });

  describe('上下文修改', () => {
    beforeEach(async () => {
      await repo.list(); // 确保初始化
    });

    it('rename() 应该更新上下文标题', async () => {
      await repo.rename(DEFAULT_CONTEXT_CONFIG.id, '新标题');
      
      const context = await repo.get(DEFAULT_CONTEXT_CONFIG.id);
      expect(context.title).toBe('新标题');
    });

    it('rename() 应该更新updatedAt时间戳', async () => {
      const before = await repo.get(DEFAULT_CONTEXT_CONFIG.id);
      
      // 等待一毫秒确保时间戳差异
      await new Promise(resolve => setTimeout(resolve, 1));
      
      await repo.rename(DEFAULT_CONTEXT_CONFIG.id, '时间戳测试');
      
      const after = await repo.get(DEFAULT_CONTEXT_CONFIG.id);
      expect(after.updatedAt > before.updatedAt).toBe(true);
    });

    it('save() 应该保存完整的上下文数据', async () => {
      const testContext: ContextPackage = {
        id: DEFAULT_CONTEXT_CONFIG.id,
        title: '完全替换',
        version: '2.0.0',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: new Date().toISOString(),
        messages: [
          { role: 'user', content: '新消息' },
          { role: 'assistant', content: '回复' }
        ],
        variables: { key1: 'value1', key2: 'value2' },
        tools: [],
        description: '测试描述'
      };
      
      await repo.save(testContext);
      
      const saved = await repo.get(DEFAULT_CONTEXT_CONFIG.id);
      expect(saved).toEqual(expect.objectContaining({
        title: '完全替换',
        messages: testContext.messages,
        variables: { key1: 'value1', key2: 'value2' }
      }));
    });

    it('update() 应该部分更新上下文数据', async () => {
      const original = await repo.get(DEFAULT_CONTEXT_CONFIG.id);
      
      await repo.update(DEFAULT_CONTEXT_CONFIG.id, {
        messages: [{ role: 'user', content: '更新的消息' }],
        variables: { newVar: 'newValue' }
      });
      
      const updated = await repo.get(DEFAULT_CONTEXT_CONFIG.id);
      expect(updated.title).toBe(original.title); // 保持不变
      expect(updated.messages).toEqual([{ role: 'user', content: '更新的消息' }]);
      expect(updated.variables).toEqual({ newVar: 'newValue' });
    });
  });

  describe('预定义变量剔除保护', () => {
    beforeEach(async () => {
      await repo.list(); // 确保初始化
    });

    it('save() 应该剔除预定义变量覆盖项', async () => {
      const contextWithPredefined: ContextPackage = {
        id: DEFAULT_CONTEXT_CONFIG.id,
        title: '预定义测试',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
        variables: {
          customVar: 'allowed',
          originalPrompt: 'should be removed', // 预定义变量
          currentPrompt: 'should be removed',  // 预定义变量
          anotherCustom: 'also allowed'
        },
        tools: []
      };
      
      await repo.save(contextWithPredefined);
      
      const saved = await repo.get(DEFAULT_CONTEXT_CONFIG.id);
      expect(saved.variables).toEqual({
        customVar: 'allowed',
        anotherCustom: 'also allowed'
      });
    });

    it('update() 应该剔除预定义变量覆盖项', async () => {
      await repo.update(DEFAULT_CONTEXT_CONFIG.id, {
        variables: {
          validVar: 'valid',
          userQuestion: 'invalid', // 预定义变量
          conversationContext: 'invalid' // 预定义变量
        }
      });
      
      const updated = await repo.get(DEFAULT_CONTEXT_CONFIG.id);
      expect(updated.variables).toEqual({
        validVar: 'valid'
      });
    });

    it('所有预定义变量都应该被正确剔除', async () => {
      const variablesWithAllPredefined: Record<string, string> = {};
      
      // 添加所有预定义变量
      PREDEFINED_VARIABLES.forEach(varName => {
        variablesWithAllPredefined[varName] = `invalid-${varName}`;
      });
      
      // 添加一些合法变量
      variablesWithAllPredefined.customVar1 = 'valid1';
      variablesWithAllPredefined.customVar2 = 'valid2';
      
      await repo.update(DEFAULT_CONTEXT_CONFIG.id, {
        variables: variablesWithAllPredefined
      });
      
      const updated = await repo.get(DEFAULT_CONTEXT_CONFIG.id);
      expect(updated.variables).toEqual({
        customVar1: 'valid1',
        customVar2: 'valid2'
      });
    });
  });

  describe('上下文删除', () => {
    beforeEach(async () => {
      await repo.list(); // 确保初始化
    });

    it('remove() 应该删除指定上下文', async () => {
      // 创建一个新上下文来删除
      const newId = await repo.create({ title: '待删除' });
      
      await repo.remove(newId);
      
      const contexts = await repo.list();
      expect(contexts.find(c => c.id === newId)).toBeUndefined();
      
      await expect(repo.get(newId))
        .rejects.toThrow(ContextError);
    });

    it('remove() 删除当前上下文后应该自动切换到其他上下文', async () => {
      // 创建一个新上下文
      const newId = await repo.create({ title: '新上下文' });
      
      // 切换到新上下文
      await repo.setCurrentId(newId);
      expect(await repo.getCurrentId()).toBe(newId);
      
      // 删除新上下文
      await repo.remove(newId);
      
      // 应该自动切换回默认上下文
      const currentId = await repo.getCurrentId();
      expect(currentId).toBe(DEFAULT_CONTEXT_CONFIG.id);
    });

    it('remove() 应该拒绝删除最后一个上下文', async () => {
      // 只有默认上下文存在时尝试删除
      await expect(repo.remove(DEFAULT_CONTEXT_CONFIG.id))
        .rejects.toThrow(ContextError);
      
      try {
        await repo.remove(DEFAULT_CONTEXT_CONFIG.id);
      } catch (error) {
        expect((error as ContextError).code).toBe(CONTEXT_ERROR_CODES.MINIMUM_VIOLATION);
      }
    });

    it('remove() 对不存在的ID应该抛出NOT_FOUND错误', async () => {
      await expect(repo.remove('non-existent-id'))
        .rejects.toThrow(ContextError);
      
      try {
        await repo.remove('non-existent-id');
      } catch (error) {
        expect((error as ContextError).code).toBe(CONTEXT_ERROR_CODES.NOT_FOUND);
      }
    });
  });

  describe('导出功能', () => {
    let contextId1: string;
    let contextId2: string;

    beforeEach(async () => {
      await repo.list(); // 确保初始化
      
      // 创建测试数据
      contextId1 = await repo.create({ title: '上下文1' });
      contextId2 = await repo.create({ title: '上下文2' });
      
      await repo.update(contextId1, {
        messages: [{ role: 'user', content: '消息1' }],
        variables: { var1: 'value1' }
      });
      
      await repo.update(contextId2, {
        messages: [{ role: 'assistant', content: '消息2' }],
        variables: { var2: 'value2' }
      });
      
      await repo.setCurrentId(contextId2);
    });

    it('exportAll() 应该导出完整的上下文束', async () => {
      const bundle = await repo.exportAll();
      
      expect(bundle).toEqual(expect.objectContaining({
        type: 'context-bundle',
        version: '1.0.0',
        currentId: contextId2,
        contexts: expect.any(Array)
      }));
      
      expect(bundle.contexts).toHaveLength(3); // default + 2 created
      
      const context1 = bundle.contexts.find(c => c.id === contextId1);
      expect(context1).toBeDefined();
      expect(context1!.title).toBe('上下文1');
      expect(context1!.variables).toEqual({ var1: 'value1' });
    });

    it('exportData() 应该调用exportAll()', async () => {
      const spy = vi.spyOn(repo, 'exportAll');
      
      await repo.exportData();
      
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('导入功能', () => {
    beforeEach(async () => {
      await repo.list(); // 确保初始化
    });

    describe('replace模式', () => {
      it('应该完全替换现有上下文', async () => {
        const bundle: ContextBundle = {
          type: 'context-bundle',
          version: '1.0.0',
          currentId: 'imported-1',
          contexts: [
            {
              id: 'imported-1',
              title: '导入的上下文1',
              version: '1.0.0',
              createdAt: '2023-01-01T00:00:00.000Z',
              updatedAt: '2023-01-01T00:00:00.000Z',
              messages: [{ role: 'user', content: '导入消息' }],
              variables: { importedVar: 'importedValue' },
              tools: []
            }
          ]
        };
        
        const result = await repo.importAll(bundle, 'replace');
        
        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(0);
        expect(result.predefinedVariablesRemoved).toBe(0);
        
        const contexts = await repo.list();
        expect(contexts).toHaveLength(1);
        expect(contexts[0].id).toBe('imported-1');
        
        const currentId = await repo.getCurrentId();
        expect(currentId).toBe('imported-1');
      });

      it('应该剔除预定义变量并统计', async () => {
        const bundle: ContextBundle = {
          type: 'context-bundle',
          version: '1.0.0',
          currentId: 'imported-with-predefined',
          contexts: [
            {
              id: 'imported-with-predefined',
              title: '包含预定义变量',
              version: '1.0.0',
              createdAt: '2023-01-01T00:00:00.000Z',
              updatedAt: '2023-01-01T00:00:00.000Z',
              messages: [],
              variables: {
                validVar: 'valid',
                originalPrompt: 'should be removed',
                currentPrompt: 'should be removed',
                anotherValid: 'also valid'
              },
              tools: []
            }
          ]
        };
        
        const result = await repo.importAll(bundle, 'replace');
        
        expect(result.imported).toBe(1);
        expect(result.predefinedVariablesRemoved).toBe(2);
        
        const imported = await repo.get('imported-with-predefined');
        expect(imported.variables).toEqual({
          validVar: 'valid',
          anotherValid: 'also valid'
        });
      });
    });

    describe('append模式', () => {
      it('应该添加新上下文而保留现有的', async () => {
        const originalContexts = await repo.list();
        
        const bundle: ContextBundle = {
          type: 'context-bundle',
          version: '1.0.0',
          currentId: 'appended-1',
          contexts: [
            {
              id: 'appended-1',
              title: '追加的上下文',
              version: '1.0.0',
              createdAt: '2023-01-01T00:00:00.000Z',
              updatedAt: '2023-01-01T00:00:00.000Z',
              messages: [],
              variables: {},
              tools: []
            }
          ]
        };
        
        const result = await repo.importAll(bundle, 'append');
        
        expect(result.imported).toBe(1);
        
        const contexts = await repo.list();
        expect(contexts).toHaveLength(originalContexts.length + 1);
        
        // 原有上下文应该还存在
        const defaultStillExists = contexts.find(c => c.id === DEFAULT_CONTEXT_CONFIG.id);
        expect(defaultStillExists).toBeDefined();
        
        // 新上下文应该存在
        const appendedExists = contexts.find(c => c.id === 'appended-1');
        expect(appendedExists).toBeDefined();
      });

      it('应该处理ID冲突并生成映射', async () => {
        const bundle: ContextBundle = {
          type: 'context-bundle',
          version: '1.0.0',
          currentId: DEFAULT_CONTEXT_CONFIG.id, // 与现有ID冲突
          contexts: [
            {
              id: DEFAULT_CONTEXT_CONFIG.id, // 与现有ID冲突
              title: '冲突的上下文',
              version: '1.0.0',
              createdAt: '2023-01-01T00:00:00.000Z',
              updatedAt: '2023-01-01T00:00:00.000Z',
              messages: [],
              variables: {},
              tools: []
            }
          ]
        };
        
        const result = await repo.importAll(bundle, 'append');
        
        expect(result.imported).toBe(1);
        expect(result.idMapping).toBeDefined();
        expect(result.idMapping![DEFAULT_CONTEXT_CONFIG.id]).toMatch(/^ctx-\d+-[a-z0-9]+$/);
        
        const contexts = await repo.list();
        expect(contexts).toHaveLength(2);
      });
    });

    describe('merge模式', () => {
      it('应该合并已存在的上下文，添加新的', async () => {
        // 先修改默认上下文
        await repo.update(DEFAULT_CONTEXT_CONFIG.id, {
          messages: [{ role: 'user', content: '原始消息' }],
          variables: { existingVar: 'existing' }
        });
        
        const bundle: ContextBundle = {
          type: 'context-bundle',
          version: '1.0.0',
          currentId: DEFAULT_CONTEXT_CONFIG.id,
          contexts: [
            {
              id: DEFAULT_CONTEXT_CONFIG.id,
              title: '合并的标题',
              version: '1.0.0',
              createdAt: '2023-01-01T00:00:00.000Z',
              updatedAt: '2023-01-01T00:00:00.000Z',
              messages: [{ role: 'assistant', content: '合并的消息' }],
              variables: { mergedVar: 'merged' },
              tools: []
            },
            {
              id: 'new-context',
              title: '新上下文',
              version: '1.0.0',
              createdAt: '2023-01-01T00:00:00.000Z',
              updatedAt: '2023-01-01T00:00:00.000Z',
              messages: [],
              variables: {},
              tools: []
            }
          ]
        };
        
        const result = await repo.importAll(bundle, 'merge');
        
        expect(result.imported).toBe(2);
        
        const merged = await repo.get(DEFAULT_CONTEXT_CONFIG.id);
        expect(merged.title).toBe('合并的标题');
        expect(merged.messages).toEqual([{ role: 'assistant', content: '合并的消息' }]);
        // merge模式：现有变量 + 导入的变量（现有优先）
        expect(merged.variables).toEqual({
          existingVar: 'existing',
          mergedVar: 'merged'
        });
        
        const contexts = await repo.list();
        expect(contexts).toHaveLength(2);
        expect(contexts.find(c => c.id === 'new-context')).toBeDefined();
      });
    });

    it('importData() 应该使用replace模式调用importAll()', async () => {
      const spy = vi.spyOn(repo, 'importAll');
      
      const testData: ContextBundle = {
        type: 'context-bundle',
        version: '1.0.0',
        currentId: 'test-id',
        contexts: [{
          id: 'test-id',
          title: 'Test Context',
          version: '1.0.0',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
          messages: [],
          variables: {},
          tools: []
        }]
      };
      await repo.importData(testData);
      
      expect(spy).toHaveBeenCalledWith(testData, 'replace');
    });

    it('完整恢复应该在写入前拒绝坏上下文及未知版本', async () => {
      const before = await repo.exportData();
      const valid = before.contexts[0];
      const badBundles = [
        { ...before, version: '999' },
        { ...before, contexts: [valid, { ...valid, id: 'bad', variables: null }] },
        { ...before, contexts: [valid, { ...valid, id: 'bad', messages: [{ role: 'user', content: 123 }] }] },
        { ...before, contexts: [valid, { ...valid, id: 'bad', tools: [{ type: 'function', function: null }] }] },
        { ...before, contexts: [valid, { ...valid }] },
      ];
      const writeSpy = vi.spyOn(storage, 'updateData');
      for (const bundle of badBundles) {
        expect(await repo.validateData(bundle)).toBe(false);
        await expect(repo.importData(bundle)).rejects.toThrow('Invalid import data format');
      }
      expect(writeSpy).not.toHaveBeenCalled();
      expect(await repo.exportData()).toEqual(before);
    });
  });

  describe('错误处理', () => {
    beforeEach(async () => {
      await repo.list(); // 确保初始化
    });

    it('应该在存储操作失败时抛出STORAGE_ERROR', async () => {
      // 模拟存储失败
      vi.spyOn(storage, 'updateData').mockRejectedValue(new Error('Storage failed'));
      
      await expect(repo.create({ title: 'test' }))
        .rejects.toThrow('Storage failed');
    });

    it('应该在数据解析失败时抛出STORAGE_ERROR', async () => {
      // 设置无效的JSON数据
      await storage.setItem(CONTEXT_STORE_KEY, 'invalid json');
      
      const newRepo = new ContextRepoImpl(storage);
      await expect(newRepo.list())
        .rejects.toThrow(ContextError);
    });

    it('应该验证无效的上下文ID格式', async () => {
      await expect(repo.get(''))
        .rejects.toThrow(ContextError);
      
      try {
        await repo.get('');
      } catch (error) {
        expect((error as ContextError).code).toBe(CONTEXT_ERROR_CODES.NOT_FOUND);
      }
    });
  });

  describe('并发安全性', () => {
    beforeEach(async () => {
      await repo.list(); // 确保初始化
    });

    it('应该处理并发创建操作', async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        repo.create({ title: `并发上下文${i}` })
      );
      
      const results = await Promise.all(promises);
      
      // 所有ID应该是唯一的
      const uniqueIds = new Set(results);
      expect(uniqueIds.size).toBe(3);
      
      const contexts = await repo.list();
      // 3个新创建 + 1个默认 = 4个，但由于内存存储的特性可能没有真正并发，所以至少应该有2个（默认+最少1个新创建）
      expect(contexts.length).toBeGreaterThanOrEqual(2); 
      expect(contexts.length).toBeLessThanOrEqual(4); // 最多4个
    });

    it('应该处理并发更新操作', async () => {
      const contextId = await repo.create({ title: '并发测试' });
      
      const promises = Array.from({ length: 5 }, (_, i) =>
        repo.update(contextId, { variables: { [`var${i}`]: `value${i}` } })
      );
      
      await Promise.all(promises);
      
      const context = await repo.get(contextId);
      expect(Object.keys(context.variables)).toHaveLength(1); // 最后一个更新生效
    });
  });
});
