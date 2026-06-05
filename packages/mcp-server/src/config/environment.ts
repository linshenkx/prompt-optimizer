/**
 * 环境变量配置管理
 *
 * 注意：环境变量已通过 preload-env.js 在应用启动前加载
 * 这里的 config() 调用是备用加载机制
 */

import { config } from 'dotenv';

// 备用环境变量加载（preload-env.js 已经处理了主要加载）
config();

// 导入共享常量
const CUSTOM_API_PATTERN = /^VITE_CUSTOM_API_(KEY|BASE_URL|MODEL|PARAMS|HEADERS)_(.+)$/;
const SUFFIX_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_SUFFIX_LENGTH = 50;

/**
 * 扫描动态自定义模型环境变量
 * 查找 VITE_CUSTOM_API_*_suffix 模式的环境变量
 */
function scanDynamicCustomEnvVars(): Record<string, string> {
  const dynamicMappings: Record<string, string> = {};

  // 使用共享的正则表达式模式
  const customApiPattern = CUSTOM_API_PATTERN;

  Object.keys(process.env).forEach(key => {
    const match = key.match(customApiPattern);
    if (match) {
      const [, configType, suffix] = match;

      // 验证后缀名（不能为空，不能包含特殊字符，不能超过长度限制）
      if (!suffix || suffix.length > MAX_SUFFIX_LENGTH || !SUFFIX_PATTERN.test(suffix)) {
        console.warn(`[MCP Environment] Invalid suffix in ${key}: ${suffix}`);
        return;
      }

      // 生成对应的MCP环境变量名（保持suffix原始大小写）
      const mcpKey = `CUSTOM_API_${configType}_${suffix}`;
      dynamicMappings[key] = mcpKey;
    }
  });

  console.log(`[MCP Environment] Found ${Object.keys(dynamicMappings).length} dynamic custom environment variables`);

  return dynamicMappings;
}

// 静态环境变量映射
const staticEnvMappings = {
  'VITE_OPENAI_API_KEY': 'OPENAI_API_KEY',
  'VITE_GEMINI_API_KEY': 'GEMINI_API_KEY',
  'VITE_DEEPSEEK_API_KEY': 'DEEPSEEK_API_KEY',
  'VITE_ZHIPU_API_KEY': 'ZHIPU_API_KEY',
  'VITE_SILICONFLOW_API_KEY': 'SILICONFLOW_API_KEY',
  'VITE_CUSTOM_API_KEY': 'CUSTOM_API_KEY',
  'VITE_CUSTOM_API_BASE_URL': 'CUSTOM_API_BASE_URL',
  'VITE_CUSTOM_API_MODEL': 'CUSTOM_API_MODEL',
  'VITE_CUSTOM_API_PARAMS': 'CUSTOM_API_PARAMS',
  'VITE_CUSTOM_API_HEADERS': 'CUSTOM_API_HEADERS'
};

// 动态环境变量映射
const dynamicEnvMappings = scanDynamicCustomEnvVars();

// 合并所有环境变量映射
const allEnvMappings = {
  ...staticEnvMappings,
  ...dynamicEnvMappings
};

// 执行环境变量映射
Object.entries(allEnvMappings).forEach(([viteKey, mcpKey]) => {
  if (process.env[viteKey] && !process.env[mcpKey]) {
    process.env[mcpKey] = process.env[viteKey];
    console.log(`[MCP Environment] Mapped ${viteKey} -> ${mcpKey}`);
  }
});

export interface MCPServerConfig {
  httpPort: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  defaultLanguage: string;
  preferredModelProvider?: string;
  authToken?: string;
  allowedOrigins: string[];
  enableDnsRebindingProtection: boolean;
}

export function loadConfig(): MCPServerConfig {
  return {
    httpPort: parseInt(process.env.MCP_HTTP_PORT || '3000'),
    logLevel: (process.env.MCP_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'debug',
    defaultLanguage: process.env.MCP_DEFAULT_LANGUAGE || 'en-US',
    preferredModelProvider: process.env.MCP_DEFAULT_MODEL_PROVIDER,
    authToken: process.env.MCP_AUTH_TOKEN || process.env.XC_MCP_TOKEN,
    allowedOrigins: parseAllowedOrigins(process.env.MCP_ALLOWED_ORIGINS),
    enableDnsRebindingProtection: process.env.MCP_ENABLE_DNS_REBINDING_PROTECTION === 'true'
  };
}

export function validateConfig(config: MCPServerConfig): void {
  if (config.httpPort < 1 || config.httpPort > 65535) {
    throw new Error('HTTP port must be between 1 and 65535');
  }

  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.logLevel)) {
    throw new Error(`Log level must be one of: ${validLogLevels.join(', ')}`);
  }

  if (config.authToken !== undefined && config.authToken.trim().length < 16) {
    throw new Error('MCP auth token must be at least 16 characters when configured');
  }
}

function parseAllowedOrigins(raw?: string): string[] {
  if (!raw || raw.trim().length === 0) {
    return ['*'];
  }

  return raw
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
}
