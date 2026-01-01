/**
 * 变量提取服务 - 真实API集成测试
 *
 * 测试变量提取服务与真实LLM API的集成
 * 只有在环境变量存在时才执行
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createVariableExtractionService } from '../../../src/services/variable-extraction/service';
import { createTemplateManager } from '../../../src/services/template/manager';
import { createTemplateLanguageService } from '../../../src/services/template/languageService';
import { LocalStorageProvider } from '../../../src/services/storage/localStorageProvider';
import {
  createRealLLMTestContext,
  hasAvailableProvider,
  printAvailableProviders,
  type RealLLMTestContext,
} from '../../helpers/real-llm';
import type {
  IVariableExtractionService,
  VariableExtractionRequest,
} from '../../../src/services/variable-extraction/types';
import type { ITemplateManager } from '../../../src/services/template/types';

const RUN_REAL_API = process.env.RUN_REAL_API === '1';

describe.skipIf(!RUN_REAL_API)('VariableExtractionService - Real API Integration', () => {
  let context: RealLLMTestContext | undefined;
  let variableExtractionService: IVariableExtractionService;
  let templateManager: ITemplateManager;
  let storage: LocalStorageProvider;

  beforeAll(() => {
    console.log('\n=== 变量提取服务 - 真实API测试 ===\n');
    printAvailableProviders();

    if (!hasAvailableProvider()) {
      console.log('⚠️  跳过真实API测试：未设置任何API密钥环境变量');
    }
  });

  beforeEach(async () => {
    // 先创建存储和模板管理器
    storage = new LocalStorageProvider();
    await storage.clearAll();

    const languageService = createTemplateLanguageService(storage);
    templateManager = createTemplateManager(storage, languageService);

    // 创建真实LLM测试上下文（它会使用自己的存储和modelManager）
    context = await createRealLLMTestContext({
      paramOverrides: {
        temperature: 0.7,
        // 不使用max_tokens，让系统使用默认值
      },
    });

    if (!context) {
      console.log('⚠️  无可用的LLM提供商，跳过测试');
      return;
    }

    // 使用context返回的modelManager创建变量提取服务
    variableExtractionService = createVariableExtractionService(
      context.llmService,
      context.modelManager,  // 使用context的modelManager
      templateManager
    );

    console.log(`\n✅ 使用提供商: ${context.provider.providerName}`);
    console.log(`   模型: ${context.modelConfig.modelMeta.name} (${context.modelConfig.modelMeta.id})\n`);
  });

  describe('基础变量提取测试', () => {
    it.skipIf(!hasAvailableProvider())('应该能成功提取简单提示词中的变量', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: '请写一篇关于春天的文章，字数要求在500字以内。',
        extractionModelKey: context.modelKey,
        existingVariableNames: [],
      };

      const result = await variableExtractionService.extract(request);

      // 验证返回结构
      expect(result).toBeDefined();
      expect(result.variables).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');

      // 打印结果
      console.log('\n📝 提取结果:');
      console.log(`   总结: ${result.summary}`);
      console.log(`   提取的变量数量: ${result.variables.length}`);

      if (result.variables.length > 0) {
        console.log('\n   变量详情:');
        result.variables.forEach((v, index) => {
          console.log(`   ${index + 1}. ${v.name} = "${v.value}"`);
          console.log(`      理由: ${v.reason}`);
          console.log(`      分类: ${v.category || '无'}`);
          console.log(`      位置: 第${v.position.occurrence}次出现的"${v.position.originalText}"`);
        });

        // 验证第一个变量的结构
        const firstVar = result.variables[0];
        expect(firstVar.name).toBeDefined();
        expect(typeof firstVar.name).toBe('string');
        expect(firstVar.value).toBeDefined();
        expect(typeof firstVar.value).toBe('string');
        expect(firstVar.position).toBeDefined();
        expect(firstVar.position.originalText).toBeDefined();
        expect(typeof firstVar.position.occurrence).toBe('number');
        expect(firstVar.position.occurrence).toBeGreaterThan(0);
        expect(firstVar.reason).toBeDefined();
        expect(typeof firstVar.reason).toBe('string');

        // 验证变量名符合规范（中文/英文/数字/下划线，不以数字开头）
        expect(firstVar.name).toMatch(/^[a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*$/);
      }
    }, 60000);

    it.skipIf(!hasAvailableProvider())('应该能提取包含多个变量的复杂提示词', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: `作为一名专业的小说作家，请创作一篇科幻小说。
要求：
- 主题：人工智能
- 风格：悬疑紧张
- 字数：3000字
- 目标读者：成年人
- 叙事视角：第一人称

请确保故事情节引人入胜，人物性格鲜明。`,
        extractionModelKey: context.modelKey,
        existingVariableNames: [],
      };

      const result = await variableExtractionService.extract(request);

      console.log('\n📝 复杂提示词提取结果:');
      console.log(`   总结: ${result.summary}`);
      console.log(`   提取的变量数量: ${result.variables.length}`);

      // 应该提取到多个变量（主题、风格、字数、目标读者、叙事视角等）
      expect(result.variables.length).toBeGreaterThan(0);

      if (result.variables.length > 0) {
        console.log('\n   变量详情:');
        result.variables.forEach((v, index) => {
          console.log(`   ${index + 1}. ${v.name} = "${v.value}"`);
          console.log(`      理由: ${v.reason}`);
          if (v.category) {
            console.log(`      分类: ${v.category}`);
          }
        });

        // 验证所有变量都有有效的定位信息
        result.variables.forEach((v) => {
          expect(v.position.originalText).toBeTruthy();
          expect(request.promptContent).toContain(v.position.originalText);
        });
      }
    }, 60000);

    it.skipIf(!hasAvailableProvider())('应该避免与已存在变量重名', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: '请写一篇关于春天的文章，字数要求在500字以内。',
        extractionModelKey: context.modelKey,
        existingVariableNames: ['season', 'topic', '季节', '主题', 'word_count'],
      };

      const result = await variableExtractionService.extract(request);

      console.log('\n📝 避免重名测试结果:');
      console.log(`   已存在的变量: ${request.existingVariableNames.join(', ')}`);
      console.log(`   提取的变量数量: ${result.variables.length}`);

      if (result.variables.length > 0) {
        console.log('\n   新提取的变量:');
        result.variables.forEach((v, index) => {
          console.log(`   ${index + 1}. ${v.name} = "${v.value}"`);

          // 验证没有重名
          expect(request.existingVariableNames).not.toContain(v.name);
        });
      }
    }, 60000);
  });

  describe('错误处理测试', () => {
    it.skipIf(!hasAvailableProvider())('应该在提示词为空时抛出验证错误', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: '',
        extractionModelKey: context.modelKey,
        existingVariableNames: [],
      };

      await expect(variableExtractionService.extract(request)).rejects.toThrow();
    });

    it.skipIf(!hasAvailableProvider())('应该在模型不存在时抛出模型错误', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: '测试提示词',
        extractionModelKey: 'non-existent-model',
        existingVariableNames: [],
      };

      await expect(variableExtractionService.extract(request)).rejects.toThrow();
    });
  });

  describe('特殊场景测试', () => {
    it.skipIf(!hasAvailableProvider())('应该能处理包含变量标记{{}}的提示词', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: '请根据{{用户输入}}生成一篇关于人工智能的文章。',
        extractionModelKey: context.modelKey,
        existingVariableNames: ['用户输入'],
      };

      const result = await variableExtractionService.extract(request);

      console.log('\n📝 包含变量标记的提示词测试结果:');
      console.log(`   原始提示词: ${request.promptContent}`);
      console.log(`   提取的变量数量: ${result.variables.length}`);

      if (result.variables.length > 0) {
        console.log('\n   变量详情:');
        result.variables.forEach((v, index) => {
          console.log(`   ${index + 1}. ${v.name} = "${v.value}"`);
        });
      }

      // 变量可能包括"人工智能"等内容
      expect(result).toBeDefined();
    }, 60000);

    it.skipIf(!hasAvailableProvider())('应该能处理纯英文提示词', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: 'Write a story about artificial intelligence in 500 words.',
        extractionModelKey: context.modelKey,
        existingVariableNames: [],
      };

      const result = await variableExtractionService.extract(request);

      console.log('\n📝 英文提示词测试结果:');
      console.log(`   提取的变量数量: ${result.variables.length}`);

      if (result.variables.length > 0) {
        console.log('\n   变量详情:');
        result.variables.forEach((v, index) => {
          console.log(`   ${index + 1}. ${v.name} = "${v.value}"`);
          console.log(`      理由: ${v.reason}`);
        });

        // 验证变量名符合规范
        result.variables.forEach((v) => {
          expect(v.name).toMatch(/^[a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*$/);
        });
      }
    }, 60000);

    it.skipIf(!hasAvailableProvider())('应该能处理没有明显变量的提示词', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: '你好！',
        extractionModelKey: context.modelKey,
        existingVariableNames: [],
      };

      const result = await variableExtractionService.extract(request);

      console.log('\n📝 无明显变量的提示词测试结果:');
      console.log(`   总结: ${result.summary}`);
      console.log(`   提取的变量数量: ${result.variables.length}`);

      // 应该返回空数组或极少变量
      expect(result.variables).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
    }, 60000);
  });

  describe('端到端工作流测试', () => {
    it.skipIf(!hasAvailableProvider())('应该完成完整的变量提取→替换流程', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const originalPrompt = '请写一篇关于春天的文章，字数要求在500字以内，风格要轻松愉快。';

      // 1. 提取变量
      const extractRequest: VariableExtractionRequest = {
        promptContent: originalPrompt,
        extractionModelKey: context.modelKey,
        existingVariableNames: [],
      };

      const extractResult = await variableExtractionService.extract(extractRequest);

      console.log('\n📝 端到端工作流测试:');
      console.log(`   原始提示词: ${originalPrompt}`);
      console.log(`   提取的变量数量: ${extractResult.variables.length}`);

      if (extractResult.variables.length > 0) {
        // 2. 模拟替换过程（从后往前替换）
        let replacedPrompt = originalPrompt;
        const sortedVariables = [...extractResult.variables].sort((a, b) => {
          const indexA = findOccurrenceIndex(originalPrompt, a.position.originalText, a.position.occurrence);
          const indexB = findOccurrenceIndex(originalPrompt, b.position.originalText, b.position.occurrence);
          return indexB - indexA;
        });

        for (const variable of sortedVariables) {
          const { originalText, occurrence } = variable.position;
          const placeholder = `{{${variable.name}}}`;

          const index = findOccurrenceIndex(replacedPrompt, originalText, occurrence);
          if (index !== -1) {
            replacedPrompt =
              replacedPrompt.substring(0, index) +
              placeholder +
              replacedPrompt.substring(index + originalText.length);
          }
        }

        console.log(`   替换后提示词: ${replacedPrompt}`);
        console.log('\n   变量映射:');
        extractResult.variables.forEach((v, index) => {
          console.log(`   ${index + 1}. {{${v.name}}} = "${v.value}"`);
        });

        // 验证替换后的提示词包含变量占位符
        extractResult.variables.forEach((v) => {
          expect(replacedPrompt).toContain(`{{${v.name}}}`);
        });

        // 验证替换后的提示词不再包含被替换的原文（除非是未被替换的部分）
        // 注意：这个验证比较复杂，因为原文可能在多处出现
      }
    }, 60000);
  });
});

/**
 * 辅助函数：查找文本第N次出现的索引位置
 */
function findOccurrenceIndex(text: string, searchText: string, occurrence: number): number {
  let count = 0;
  let index = -1;

  while (count < occurrence) {
    index = text.indexOf(searchText, index + 1);
    if (index === -1) {
      return -1;
    }
    count++;
  }

  return index;
}
