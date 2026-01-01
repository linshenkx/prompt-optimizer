/**
 * 真实LLM测试辅助工具
 *
 * 提供基础方法用于在单元测试中获取真实的LLM接口
 * 根据本地环境变量自动选择可用的提供商和模型
 */

import { getDefaultTextModels } from '../../src/services/model/defaults';
import type { TextModelConfig } from '../../src/services/llm/types';
import { createLLMService } from '../../src/services/llm/service';
import { createModelManager } from '../../src/services/model/manager';
import { LocalStorageProvider } from '../../src/services/storage/localStorageProvider';
import type { ILLMService } from '../../src/services/llm/types';
import type { IModelManager } from '../../src/services/model/types';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * 可用提供商信息
 */
export interface AvailableProvider {
  /** 提供商ID */
  providerId: string;
  /** 提供商显示名称 */
  providerName: string;
  /** 完整的模型配置 */
  modelConfig: TextModelConfig;
}

/**
 * 真实LLM测试上下文
 */
export interface RealLLMTestContext {
  /** 提供商信息 */
  provider: AvailableProvider;
  /** 模型配置（使用第一个可用模型） */
  modelConfig: TextModelConfig;
  /** LLM服务实例 */
  llmService: ILLMService;
  /** 模型管理器实例 */
  modelManager: IModelManager;
  /** 模型键（已添加到modelManager） */
  modelKey: string;
}

/**
 * 获取所有可用的提供商
 *
 * 使用系统内置的配置加载逻辑，自动处理API密钥和baseURL
 *
 * @returns 可用的提供商列表
 */
export function getAvailableProviders(): AvailableProvider[] {
  // 使用系统自带的配置加载器
  const allConfigs = getDefaultTextModels();
  const available: AvailableProvider[] = [];

  // 筛选已启用（有API密钥）的提供商
  for (const [providerId, config] of Object.entries(allConfigs)) {
    if (config.enabled && config.connectionConfig.apiKey) {
      available.push({
        providerId,
        providerName: config.name,
        modelConfig: config
      });
    }
  }

  return available;
}

/**
 * 获取第一个可用的提供商
 *
 * @returns 第一个可用的提供商，如果没有可用提供商则返回undefined
 */
export function getFirstAvailableProvider(): AvailableProvider | undefined {
  const available = getAvailableProviders();
  return available.length > 0 ? available[0] : undefined;
}

/**
 * 从提供商信息创建测试配置
 *
 * @param provider - 提供商信息
 * @param paramOverrides - 参数覆盖（可选）
 * @returns 模型配置
 */
export function createTestConfig(
  provider: AvailableProvider,
  paramOverrides: Record<string, any> = {}
): TextModelConfig {
  // 直接使用系统加载的配置，只覆盖参数
  return {
    ...provider.modelConfig,
    id: `test-${provider.providerId}`,
    name: `Test ${provider.providerName}`,
    paramOverrides: {
      ...provider.modelConfig.paramOverrides,
      ...paramOverrides
    }
  };
}

/**
 * 创建真实LLM测试上下文
 *
 * 自动选择第一个可用的提供商，创建LLM服务和模型管理器
 *
 * @param options - 可选配置
 * @param options.paramOverrides - 参数覆盖
 * @returns 测试上下文，如果没有可用提供商则返回undefined
 *
 * @example
 * ```typescript
 * const context = await createRealLLMTestContext();
 * if (!context) {
 *   console.log('No API keys available, skipping test');
 *   return;
 * }
 *
 * const messages = [{ role: 'user', content: 'Hello' }];
 * const response = await context.llmService.sendMessage(messages, context.modelKey);
 * console.log(response.content);
 * ```
 */
export async function createRealLLMTestContext(options?: {
  paramOverrides?: Record<string, any>;
}): Promise<RealLLMTestContext | undefined> {
  const provider = getFirstAvailableProvider();
  if (!provider) {
    return undefined;
  }

  // 创建模型配置（使用系统加载的配置 + 可选的参数覆盖）
  const modelConfig = createTestConfig(
    provider,
    options?.paramOverrides ?? {}
  );

  // 创建存储和模型管理器
  const storage = new LocalStorageProvider();
  await storage.clearAll();

  const modelManager = createModelManager(storage);

  // 添加模型到管理器
  const modelKey = `test-${provider.providerId}`;
  await modelManager.addModel(modelKey, {
    ...modelConfig,
    id: modelKey
  });

  // 创建LLM服务
  const llmService = createLLMService(modelManager);

  return {
    provider,
    modelConfig,
    llmService,
    modelManager,
    modelKey
  };
}

/**
 * 检查是否有可用的API密钥
 *
 * @returns 是否有至少一个可用的提供商
 */
export function hasAvailableProvider(): boolean {
  return getAvailableProviders().length > 0;
}

/**
 * 打印可用提供商信息（用于调试）
 */
export function printAvailableProviders(): void {
  const available = getAvailableProviders();

  if (available.length === 0) {
    console.log('❌ 没有可用的API密钥');
    console.log('\n请在 .env.local 文件中配置至少一个提供商的 API 密钥');
    console.log('例如：VITE_OPENAI_API_KEY=your_api_key');
    return;
  }

  console.log(`✅ 找到 ${available.length} 个可用提供商：\n`);
  available.forEach((p, index) => {
    console.log(`${index + 1}. ${p.providerName}`);
    console.log(`   - Provider ID: ${p.providerId}`);
    console.log(`   - Model: ${p.modelConfig.modelMeta.name} (${p.modelConfig.modelMeta.id})`);
    console.log(`   - Base URL: ${p.modelConfig.connectionConfig.baseURL || 'default'}`);
    console.log('');
  });
}
