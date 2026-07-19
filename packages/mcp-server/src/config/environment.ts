/**
 * 环境变量配置管理
 *
 * 注意：环境变量已通过 preload-env.js 在应用启动前加载
 * 这里的 config() 调用是备用加载机制
 */

import { config } from 'dotenv';
import type { HttpSecurityConfig } from '../http-security.js';

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

export interface MCPServerConfig extends HttpSecurityConfig {
  httpPort: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  defaultLanguage: string;
  preferredModelProvider?: string;
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  return /^\d+$/.test(value.trim()) ? Number(value) : Number.NaN;
}

function parseBodyLimit(value: string | undefined): number {
  const raw = value?.trim() || '256kb';
  const match = raw.match(/^(\d+)\s*(b|kb|mb)?$/i);
  if (!match) {
    return Number.NaN;
  }

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() || 'b';
  const multiplier = unit === 'mb' ? 1024 * 1024 : unit === 'kb' ? 1024 : 1;
  return amount * multiplier;
}

function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value.split(',').map(origin => origin.trim()).filter(Boolean);
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1';
}

export function loadConfig(): MCPServerConfig {
  return {
    httpPort: parseInteger(process.env.MCP_HTTP_PORT, 3000),
    httpHost: process.env.MCP_HTTP_HOST?.trim() || '127.0.0.1',
    httpAuthToken: process.env.MCP_AUTH_TOKEN?.trim() || undefined,
    httpAllowedOrigins: parseAllowedOrigins(process.env.MCP_ALLOWED_ORIGINS),
    httpBodyLimitBytes: parseBodyLimit(process.env.MCP_HTTP_BODY_LIMIT),
    httpMaxSessions: parseInteger(process.env.MCP_MAX_SESSIONS, 100),
    httpSessionTtlMs: parseInteger(process.env.MCP_SESSION_TTL_MS, 30 * 60 * 1000),
    logLevel: (process.env.MCP_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'debug',
    defaultLanguage: process.env.MCP_DEFAULT_LANGUAGE || 'en-US',
    preferredModelProvider: process.env.MCP_DEFAULT_MODEL_PROVIDER
  };
}

export function validateConfig(config: MCPServerConfig): void {
  if (!Number.isInteger(config.httpPort) || config.httpPort < 1 || config.httpPort > 65535) {
    throw new Error('HTTP port must be between 1 and 65535');
  }

  if (!config.httpHost.trim()) {
    throw new Error('MCP_HTTP_HOST must not be empty');
  }
  if (!isLoopbackHost(config.httpHost) && !config.httpAuthToken) {
    throw new Error('MCP_AUTH_TOKEN is required when MCP_HTTP_HOST is not loopback');
  }
  if (config.httpAuthToken && /\s/.test(config.httpAuthToken)) {
    throw new Error('MCP_AUTH_TOKEN must not contain whitespace');
  }

  for (const origin of config.httpAllowedOrigins) {
    if (origin === '*') {
      throw new Error('MCP_ALLOWED_ORIGINS must not contain a wildcard');
    }

    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
        throw new Error('invalid origin');
      }
    } catch {
      throw new Error('MCP_ALLOWED_ORIGINS must contain only HTTP(S) origins without paths');
    }
  }

  if (!Number.isSafeInteger(config.httpBodyLimitBytes) || config.httpBodyLimitBytes < 1) {
    throw new Error('MCP_HTTP_BODY_LIMIT must be a positive byte value such as 256kb');
  }
  if (!Number.isSafeInteger(config.httpMaxSessions) || config.httpMaxSessions < 1) {
    throw new Error('MCP_MAX_SESSIONS must be a positive integer');
  }
  if (!Number.isSafeInteger(config.httpSessionTtlMs) || config.httpSessionTtlMs < 1) {
    throw new Error('MCP_SESSION_TTL_MS must be a positive integer');
  }

  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.logLevel)) {
    throw new Error(`Log level must be one of: ${validLogLevels.join(', ')}`);
  }
}
