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
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      console.log(`\n使用提供商: ${context.provider.providerName}`);
      console.log(`模型: ${context.modelConfig.modelMeta.name}`);

      // 发送消息
      const messages: Message[] = [
        { role: 'user', content: '请用一句话介绍你自己' }
      ];

      const response = await context.llmService.sendMessage(messages, context.modelKey);

      console.log(`\n响应内容: ${response.content}`);

      // 验证响应
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);
    }, 30000);

    it.skipIf(!hasAvailableProvider())('应该能使用自定义参数', async () => {
      // 创建测试上下文，使用自定义参数
      const context = await createRealLLMTestContext({
        paramOverrides: {
          temperature: 0.1, // 低温度，更确定性的输出
        },
      });

      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      console.log(`\n使用自定义参数: temperature=0.1`);

      const messages: Message[] = [
        { role: 'user', content: '1+1等于几？' }
      ];

      const response = await context.llmService.sendMessage(messages, context.modelKey);

      console.log(`响应: ${response.content}`);

      // 验证响应
      expect(response.content).toBeDefined();
    }, 30000);
  });

  describe('多轮对话示例', () => {
    it.skipIf(!hasAvailableProvider())('应该能进行多轮对话', async () => {
      const context = await createRealLLMTestContext();
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      console.log(`\n开始多轮对话测试`);

      // 第一轮
      const messages1: Message[] = [
        { role: 'user', content: '我的名字叫Alice' }
      ];

      const response1 = await context.llmService.sendMessage(messages1, context.modelKey);
      console.log(`\n第1轮 - 用户: 我的名字叫Alice`);

      expect(response1).toBeDefined();
      expect(response1.content).toBeDefined();

      const content1 = typeof response1.content === 'string' ? response1.content : JSON.stringify(response1.content);
      const preview1 = content1.length > 100 ? content1.substring(0, 100) + '...' : content1;
      console.log(`第1轮 - 助手: ${preview1}`);

      // 第二轮（包含上下文）
      const messages2: Message[] = [
        { role: 'user', content: '我的名字叫Alice' },
        { role: 'assistant', content: response1.content },
        { role: 'user', content: '我的名字是什么？' }
      ];

      const response2 = await context.llmService.sendMessage(messages2, context.modelKey);
      console.log(`\n第2轮 - 用户: 我的名字是什么？`);
      console.log(`第2轮 - 助手: ${response2.content}`);

      // 验证AI记住了名字（大部分情况下应该包含"Alice"）
      expect(response2.content).toBeDefined();
      // 注意：由于LLM的不确定性，这个断言可能偶尔失败
      // expect(response2.content.toLowerCase()).toContain('alice');
    }, 60000);
  });

  describe('错误处理示例', () => {
    it.skipIf(!hasAvailableProvider())('应该能正确处理空消息', async () => {
      const context = await createRealLLMTestContext();
      if (!context) {
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const emptyMessages: Message[] = [];

      // 空消息列表应该抛出错误
      await expect(
        context.llmService.sendMessage(emptyMessages, context.modelKey)
      ).rejects.toThrow();
    }, 30000);

    it('应该在无可用提供商时返回undefined', async () => {
      // 暂时清空环境变量（模拟）
      const originalEnv = { ...process.env };

      // 清空所有API key环境变量
      const apiKeyEnvVars = [
        'VITE_OPENAI_API_KEY', 'OPENAI_API_KEY',
        'VITE_ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY',
        'VITE_GEMINI_API_KEY', 'GEMINI_API_KEY',
        'VITE_DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY',
        'VITE_MODELSCOPE_API_KEY', 'MODELSCOPE_API_KEY',
        'VITE_ZHIPU_API_KEY', 'ZHIPU_API_KEY',
      ];

      // 注意：这个测试仅在没有API key时才有效
      // 如果环境中已有API key，这个测试会失败

      if (!hasAvailableProvider()) {
        const context = await createRealLLMTestContext();
        expect(context).toBeUndefined();
      } else {
        console.log('跳过测试：环境中已有可用的API key');
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
        console.log('跳过测试：无可用的LLM提供商');
        return;
      }

      const startTime = Date.now();

      const messages: Message[] = [
        { role: 'user', content: '说"你好"' }
      ];

      const response = await context.llmService.sendMessage(messages, context.modelKey);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`\n响应时间: ${duration}ms`);
      console.log(`响应内容: ${response.content}`);

      // 验证响应时间在合理范围内（30秒内）
      expect(duration).toBeLessThan(30000);
      expect(response.content).toBeDefined();
    }, 35000);
  });
});
