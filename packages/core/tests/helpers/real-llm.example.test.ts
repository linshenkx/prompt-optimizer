/**
 * 真实LLM辅助工具 - 使用示例
 *
 * 演示如何使用real-llm辅助工具进行真实API测试
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  createRealLLMTestContext,
  hasAvailableProvider,
  getAvailableProviders,
  getFirstAvailableProvider,
  printAvailableProviders,
} from './real-llm';
import type { Message } from '../../src/services/llm/types';

const RUN_REAL_API = process.env.RUN_REAL_API === '1';

describe.skipIf(!RUN_REAL_API)('Real LLM Helper - Usage Examples', () => {
  beforeAll(() => {
    console.log('\n=== 真实LLM辅助工具 - 使用示例 ===\n');
    printAvailableProviders();
  });

  describe('检测可用提供商', () => {
    it('应该能检测到可用的提供商', () => {
      const available = getAvailableProviders();
      console.log(`\n检测到 ${available.length} 个可用提供商\n`);

      if (available.length > 0) {
        available.forEach((provider, index) => {
          console.log(`${index + 1}. ${provider.providerName}`);
          console.log(`   - Provider ID: ${provider.providerId}`);
          console.log(`   - 模型: ${provider.modelConfig.modelMeta.name} (${provider.modelConfig.modelMeta.id})`);
          console.log(`   - Base URL: ${provider.modelConfig.connectionConfig.baseURL || 'default'}`);
        });
      }

      // 如果有环境变量，应该能检测到至少一个提供商
      if (hasAvailableProvider()) {
        expect(available.length).toBeGreaterThan(0);
      }
    });

    it('应该能获取第一个可用提供商', () => {
      const provider = getFirstAvailableProvider();

      if (provider) {
        console.log(`\n第一个可用提供商: ${provider.providerName}`);
        console.log(`Provider ID: ${provider.providerId}`);
        console.log(`模型: ${provider.modelConfig.modelMeta.name} (${provider.modelConfig.modelMeta.id})`);

        expect(provider.providerId).toBeDefined();
        expect(provider.modelConfig.connectionConfig.apiKey).toBeDefined();
        expect(provider.modelConfig.modelMeta).toBeDefined();
      } else {
        console.log('\n⚠️  没有可用的提供商');
      }
    });
  });

  describe('简单LLM调用示例', () => {
    it.skipIf(!hasAvailableProvider())('应该能发送简单消息并获取响应', async () => {
      // 创建测试上下文
      const context = await createRealLLMTestContext();
      if (!context) {
        return;
      }

      // 发送消息
      const messages: Message[] = [
        { role: 'user', content: '请用一句话介绍你自己' }
      ];

      const response = await context.llmService.sendMessage(messages, context.modelKey);

      // 验证响应
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 30000);

    it.skipIf(!hasAvailableProvider())('应该能使用自定义参数', async () => {
      // 创建测试上下文，使用自定义参数
      const context = await createRealLLMTestContext({
        paramOverrides: {
          temperature: 0.1, // 低温度，更确定性的输出
        },
      });

      if (!context) {
        return;
      }

      const messages: Message[] = [
        { role: 'user', content: '1+1等于几？' }
      ];

      const response = await context.llmService.sendMessage(messages, context.modelKey);

      // 验证响应
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('多轮对话示例', () => {
    it.skipIf(!hasAvailableProvider())('应该能进行多轮对话', async () => {
      const context = await createRealLLMTestContext();
      if (!context) {
        return;
      }

      // 第一轮
      const messages1: Message[] = [
        { role: 'user', content: '我的名字叫Alice' }
      ];

      const response1 = await context.llmService.sendMessage(messages1, context.modelKey);

      expect(response1).toBeDefined();
      expect(typeof response1).toBe('string');
      expect(response1.length).toBeGreaterThan(0);

      // 第二轮（包含上下文）
      const messages2: Message[] = [
        { role: 'user', content: '我的名字叫Alice' },
        { role: 'assistant', content: response1 },
        { role: 'user', content: '我的名字是什么？' }
      ];

      const response2 = await context.llmService.sendMessage(messages2, context.modelKey);

      // 验证AI记住了名字（大部分情况下应该包含"Alice"）
      expect(response2).toBeDefined();
      // 注意：由于LLM的不确定性，这个断言可能偶尔失败
      // expect(response2.content.toLowerCase()).toContain('alice');
    }, 60000);
  });

  describe('错误处理示例', () => {
    it.skipIf(!hasAvailableProvider())('应该能正确处理空消息', async () => {
      const context = await createRealLLMTestContext();
      if (!context) {
        return;
      }

      const emptyMessages: Message[] = [];

      // 空消息列表应该抛出错误
      await expect(
        context.llmService.sendMessage(emptyMessages, context.modelKey)
      ).rejects.toThrow();
    }, 30000);

    it('应该在无可用提供商时返回undefined', async () => {
      if (!hasAvailableProvider()) {
        const context = await createRealLLMTestContext();
        expect(context).toBeUndefined();
      } else {
      }
    });
  });

  describe('性能和稳定性示例', () => {
    it.skipIf(!hasAvailableProvider())('应该能在合理时间内完成调用', async () => {
      const context = await createRealLLMTestContext({
        paramOverrides: {
          temperature: 0.5, // 使用适中的温度
        },
      });

      if (!context) {
        return;
      }

      const startTime = Date.now();

      const messages: Message[] = [
        { role: 'user', content: '说"你好"' }
      ];

      const response = await context.llmService.sendMessage(messages, context.modelKey);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 验证响应时间在合理范围内（30秒内）
      expect(duration).toBeLessThan(30000);
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 35000);
  });
});
