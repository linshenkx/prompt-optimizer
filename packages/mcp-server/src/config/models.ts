/**
 * MCP 服务器模型配置
 * 完全复用 core 包的模型管理功能
 */

import { ModelManager } from '@prompt-optimizer/core';

/**
 * 为 MCP 服务器设置默认模型
 * 完全基于 core 的 defaultModels，根据环境变量和配置选择合适的模型
 */
export async function setupDefaultModel(
  modelManager: ModelManager,
  preferredProvider?: string
): Promise<void> {
  // 动态导入 defaultModels，确保环境变量已经加载
  const { defaultModels } = await import('@prompt-optimizer/core');

  // 获取所有可用的默认模型（已启用的）
  const availableModels = Object.entries(defaultModels).filter(([_, config]) => config.enabled);

  if (availableModels.length === 0) {
    throw new Error('No enabled models found in core defaultModels');
  }

  let selectedModel: [string, any] | undefined;

  // 1. 如果指定了 preferredProvider，尝试匹配
  if (preferredProvider) {
    const normalizedPreferred = preferredProvider.toLowerCase();

    selectedModel = availableModels.find(([key, config]) =>
      // 直接匹配模型 key（支持 custom_<suffix>）
      key.toLowerCase() === normalizedPreferred ||
      // 匹配 provider id
      String(config.providerMeta?.id || config.modelMeta?.providerId || config.provider || '').toLowerCase() === normalizedPreferred ||
      // 兼容通过名称模糊匹配
      String(config.name || '').toLowerCase().includes(normalizedPreferred)
    );
  }

  // 2. 如果没有找到匹配的或没有指定，使用第一个可用的模型
  if (!selectedModel) {
    selectedModel = availableModels[0];
  }

  const [modelKey, modelConfig] = selectedModel;

  // 3. 使用 core 的模型配置，确保模型启用
  const finalConfig = {
    ...modelConfig,
    // 确保模型启用
    enabled: true
  };

  // 4. 使用 ModelManager 的标准 API 添加或更新模型
  const mcpModelKey = `mcp-default`;

  try {
    // 尝试更新现有模型
    await modelManager.updateModel(mcpModelKey, finalConfig);
  } catch (error) {
    // 如果模型不存在，则添加新模型
    await modelManager.addModel(mcpModelKey, finalConfig);
  }
}


