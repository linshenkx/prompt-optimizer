/**
 * 变量值生成服务 - 真实API集成测试
 *
 * 测试变量值生成服务与真实LLM API的集成
 * 只有在环境变量存在时才执行
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createVariableValueGenerationService } from '../../../src/services/variable-value-generation/service';
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
  IVariableValueGenerationService,
  VariableValueGenerationRequest,
} from '../../../src/services/variable-value-generation/types';
import type { ITemplateManager } from '../../../src/services/template/types';

const RUN_REAL_API = process.env.RUN_REAL_API === '1';

describe.skipIf(!RUN_REAL_API)('VariableValueGenerationService - Real API Integration', () => {
  let context: RealLLMTestContext | undefined;
  let variableValueGenerationService: IVariableValueGenerationService;
  let templateManager: ITemplateManager;
  let storage: LocalStorageProvider;

  beforeAll(() => {
    console.log('\n=== 变量值生成服务 - 真实API测试 ===\n');
    printAvailableProviders();

    if (!hasAvailableProvider()) {
      console.log('⚠️  跳过真实API测试：未设置任何API密钥环境变量');
    }
  });

  beforeEach(async () => {
    // 创建存储和模板管理器
    storage = new LocalStorageProvider();
    await storage.clearAll();

    const languageService = createTemplateLanguageService(storage);
    templateManager = createTemplateManager(storage, languageService);

    // 创建真实LLM测试上下文
    context = await createRealLLMTestContext({
      paramOverrides: {
        temperature: 0.7,
      },
    });

    if (!context) {
      console.log('⚠️  无可用的LLM提供商，跳过测试');
      return;
    }

    // 使用context的modelManager创建变量值生成服务
    variableValueGenerationService = createVariableValueGenerationService(
      context.llmService,
      context.modelManager,
      templateManager
    );

    console.log(`\n✅ 使用提供商: ${context.provider.providerName}`);
    console.log(`   模型: ${context.modelConfig.modelMeta.name} (${context.modelConfig.modelMeta.id})\n`);
  });

  describe('基础变量值生成测试', () => {
    it.skipIf(!hasAvailableProvider())('应该能成功为简单提示词生成变量值', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: '请写一篇关于{{主题}}的文章，字数要求在{{字数}}字以内。',
        variables: [
          { name: '主题' },
          { name: '字数' }
        ],
        generationModelKey: context.modelKey,
      };

      const result = await variableValueGenerationService.generate(request);

      // 验证返回结构
      expect(result).toBeDefined();
      expect(result.values).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');

      // 应该为所有变量都生成了值
      expect(result.values.length).toBe(2);

      // 打印结果
      console.log('\n📝 生成结果:');
      console.log(`   总结: ${result.summary}`);
      console.log(`   生成的变量值数量: ${result.values.length}`);

      console.log('\n   变量值详情:');
      result.values.forEach((v, index) => {
        console.log(`   ${index + 1}. ${v.name} = "${v.value}"`);
        console.log(`      理由: ${v.reason}`);
        if (v.confidence !== undefined) {
          console.log(`      置信度: ${(v.confidence * 100).toFixed(0)}%`);
        }
      });

      // 验证第一个变量值的结构
      const firstValue = result.values[0];
      expect(firstValue.name).toBeDefined();
      expect(typeof firstValue.name).toBe('string');
      expect(firstValue.value).toBeDefined();
      expect(typeof firstValue.value).toBe('string');
      expect(firstValue.reason).toBeDefined();
      expect(typeof firstValue.reason).toBe('string');

      // 验证变量名匹配
      const names = result.values.map(v => v.name);
      expect(names).toContain('主题');
      expect(names).toContain('字数');
    }, 60000);

    it.skipIf(!hasAvailableProvider())('应该能生成包含多个变量的复杂场景值', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: `作为一名专业的{{职业}}，请创作一篇{{文体}}。
要求：
- 主题：{{主题}}
- 风格：{{风格}}
- 字数：{{字数}}字
- 目标读者：{{读者}}`,
        variables: [
          { name: '职业' },
          { name: '文体' },
          { name: '主题' },
          { name: '风格' },
          { name: '字数' },
          { name: '读者' }
        ],
        generationModelKey: context.modelKey,
      };

      const result = await variableValueGenerationService.generate(request);

      console.log('\n📝 复杂场景生成结果:');
      console.log(`   总结: ${result.summary}`);
      console.log(`   生成的变量值数量: ${result.values.length}`);

      // 应该为所有6个变量都生成了值
      expect(result.values.length).toBe(6);

      console.log('\n   变量值详情:');
      result.values.forEach((v, index) => {
        console.log(`   ${index + 1}. ${v.name} = "${v.value}"`);
        console.log(`      理由: ${v.reason}`);
      });

      // 验证所有变量都有值
      result.values.forEach((v) => {
        expect(v.value).toBeTruthy();
        expect(v.value.trim().length).toBeGreaterThan(0);
      });
    }, 60000);

    it.skipIf(!hasAvailableProvider())('应该能参考当前值生成新值', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: '请写一篇关于{{主题}}的{{文体}}，字数{{字数}}字。',
        variables: [
          { name: '主题', currentValue: '人工智能' },
          { name: '文体', currentValue: '科普文章' },
          { name: '字数' }  // 这个没有当前值
        ],
        generationModelKey: context.modelKey,
      };

      const result = await variableValueGenerationService.generate(request);

      console.log('\n📝 参考当前值生成结果:');
      console.log(`   总结: ${result.summary}`);

      console.log('\n   变量值详情:');
      result.values.forEach((v, index) => {
        const currentValue = request.variables.find(rv => rv.name === v.name)?.currentValue;
        console.log(`   ${index + 1}. ${v.name} = "${v.value}" ${currentValue ? `(当前值: ${currentValue})` : ''}`);
        console.log(`      理由: ${v.reason}`);
      });

      expect(result.values.length).toBe(3);
    }, 60000);
  });

  describe('错误处理测试', () => {
    it.skipIf(!hasAvailableProvider())('应该在提示词为空时抛出验证错误', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: '',
        variables: [{ name: '主题' }],
        generationModelKey: context.modelKey,
      };

      await expect(variableValueGenerationService.generate(request)).rejects.toThrow();
    });

    it.skipIf(!hasAvailableProvider())('应该在变量列表为空时抛出验证错误', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: '测试提示词',
        variables: [],
        generationModelKey: context.modelKey,
      };

      await expect(variableValueGenerationService.generate(request)).rejects.toThrow();
    });

    it.skipIf(!hasAvailableProvider())('应该在模型不存在时抛出模型错误', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: '测试提示词',
        variables: [{ name: '主题' }],
        generationModelKey: 'non-existent-model',
      };

      await expect(variableValueGenerationService.generate(request)).rejects.toThrow();
    });
  });

  describe('特殊场景测试', () => {
    it.skipIf(!hasAvailableProvider())('应该能处理纯英文提示词', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: 'Write a {{type}} about {{topic}} in {{word_count}} words.',
        variables: [
          { name: 'type' },
          { name: 'topic' },
          { name: 'word_count' }
        ],
        generationModelKey: context.modelKey,
      };

      const result = await variableValueGenerationService.generate(request);

      console.log('\n📝 英文提示词生成结果:');
      console.log(`   总结: ${result.summary}`);

      console.log('\n   变量值详情:');
      result.values.forEach((v, index) => {
        console.log(`   ${index + 1}. ${v.name} = "${v.value}"`);
        console.log(`      理由: ${v.reason}`);
      });

      expect(result.values.length).toBe(3);
      result.values.forEach((v) => {
        expect(v.value).toBeTruthy();
      });
    }, 60000);

    it.skipIf(!hasAvailableProvider())('应该能处理带变量来源标识的请求', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: '请写一篇关于{{主题}}的文章，风格为{{风格}}。',
        variables: [
          { name: '主题', source: 'global' },
          { name: '风格', source: 'test', currentValue: '轻松幽默' }
        ],
        generationModelKey: context.modelKey,
      };

      const result = await variableValueGenerationService.generate(request);

      console.log('\n📝 带来源标识的生成结果:');
      console.log(`   总结: ${result.summary}`);

      console.log('\n   变量值详情:');
      result.values.forEach((v, index) => {
        const variable = request.variables.find(rv => rv.name === v.name);
        console.log(`   ${index + 1}. ${v.name} = "${v.value}" [${variable?.source || 'unknown'}]`);
        console.log(`      理由: ${v.reason}`);
      });

      expect(result.values.length).toBe(2);
    }, 60000);
  });

  describe('数据质量测试', () => {
    it.skipIf(!hasAvailableProvider())('生成的值应该与提示词上下文相关', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: '请作为一名儿童教育专家，编写一个针对5-7岁儿童的{{课程类型}}课程计划，主题是{{主题}}。',
        variables: [
          { name: '课程类型' },
          { name: '主题' }
        ],
        generationModelKey: context.modelKey,
      };

      const result = await variableValueGenerationService.generate(request);

      console.log('\n📝 上下文相关性测试结果:');
      result.values.forEach((v) => {
        console.log(`   ${v.name}: "${v.value}"`);
        console.log(`   理由: ${v.reason}`);
      });

      // 验证生成的理由字段不为空（说明LLM理解了上下文）
      result.values.forEach((v) => {
        expect(v.reason.length).toBeGreaterThan(10); // 理由应该有一定长度
      });
    }, 60000);

    it.skipIf(!hasAvailableProvider())('应该为所有请求的变量都生成值', async () => {
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const variableNames = ['变量1', '变量2', '变量3', '变量4', '变量5'];
      const request: VariableValueGenerationRequest = {
        promptContent: `测试提示词，包含多个变量：${variableNames.map(name => `{{${name}}}`).join('、')}`,
        variables: variableNames.map(name => ({ name })),
        generationModelKey: context.modelKey,
      };

      const result = await variableValueGenerationService.generate(request);

      console.log('\n📝 完整性测试结果:');
      console.log(`   请求变量数: ${variableNames.length}`);
      console.log(`   生成变量数: ${result.values.length}`);

      // 应该为所有变量都生成值
      expect(result.values.length).toBe(variableNames.length);

      // 验证变量名都匹配
      const generatedNames = result.values.map(v => v.name);
      variableNames.forEach(name => {
        expect(generatedNames).toContain(name);
      });
    }, 60000);
  });
});
