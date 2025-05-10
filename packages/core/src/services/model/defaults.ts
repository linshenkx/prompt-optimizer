import { ModelConfig } from './types';

// 获取环境变量的辅助函数
const getEnvVar = (key: string): string => {
  // 0. 首先检查运行时配置
  if (typeof window !== 'undefined' && window.runtime_config) {
    // 移除 VITE_ 前缀以匹配运行时配置中的键名
    const runtimeKey = key.replace('VITE_', '');
    const value = window.runtime_config[runtimeKey];
    if (value !== undefined && value !== null) {
      return String(value);
    }
  }

  // 1. 然后尝试 process.env
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] || '';
  }

  // 2. 然后尝试 import.meta.env（Vite 环境）
  try {
    // @ts-ignore - 在构建时忽略此错误
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore - 在构建时忽略此错误
      const value = import.meta.env[key];
      if (value) return value;
    }
  } catch {
    // 忽略错误
  }

  // 3. 最后返回空字符串
  return '';
};

// 从环境变量获取 API keys
const OPENAI_API_KEY = getEnvVar('VITE_OPENAI_API_KEY').trim();
const GEMINI_API_KEY = getEnvVar('VITE_GEMINI_API_KEY').trim();
const DEEPSEEK_API_KEY = getEnvVar('VITE_DEEPSEEK_API_KEY').trim();
const SILICONFLOW_API_KEY = getEnvVar('VITE_SILICONFLOW_API_KEY').trim();
const ZHIPU_API_KEY = getEnvVar('VITE_ZHIPU_API_KEY').trim();
const CUSTOM_API_KEY = getEnvVar('VITE_CUSTOM_API_KEY').trim();
const CUSTOM_API_BASE_URL = getEnvVar('VITE_CUSTOM_API_BASE_URL');
const CUSTOM_API_MODEL = getEnvVar('VITE_CUSTOM_API_MODEL');

export const defaultModels: Record<string, ModelConfig> = {
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-3.5-turbo',
    apiKey: OPENAI_API_KEY,
    enabled: !!OPENAI_API_KEY,
    provider: 'openai'
  },
  gemini: {
    name: 'Gemini',
    baseURL: 'https://generativelanguage.googleapis.com',
    models: ['gemini-2.0-flash'],
    defaultModel: 'gemini-2.0-flash',
    apiKey: GEMINI_API_KEY,
    enabled: !!GEMINI_API_KEY,
    provider: 'gemini'
  },
  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat'],
    defaultModel: 'deepseek-chat',
    apiKey: DEEPSEEK_API_KEY,
    enabled: !!DEEPSEEK_API_KEY,
    provider: 'deepseek'
  },
  siliconflow: {
    name: 'SiliconFlow',
    baseURL: 'https://api.siliconflow.cn/v1',
    models: ['Pro/deepseek-ai/DeepSeek-V3'],
    defaultModel: 'Pro/deepseek-ai/DeepSeek-V3',
    apiKey: SILICONFLOW_API_KEY,
    enabled: !!SILICONFLOW_API_KEY,
    provider: 'siliconflow'
  },
  zhipu: {
    name: 'Zhipu',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-flash', 'glm-4', 'glm-3-turbo', 'glm-3'],
    defaultModel: 'glm-4-flash',
    apiKey: ZHIPU_API_KEY,
    enabled: !!ZHIPU_API_KEY,
    provider: 'zhipu'
  },
  custom: {
    name: 'Custom',
    baseURL: CUSTOM_API_BASE_URL,
    models: [CUSTOM_API_MODEL],
    defaultModel: CUSTOM_API_MODEL,
    apiKey: CUSTOM_API_KEY,
    enabled: !!CUSTOM_API_KEY,
    provider: 'custom'
  }
}; 