import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadConfig, validateConfig } from '../src/config/environment.js';
import { resolveDefaultLanguage } from '../src/adapters/core-services.js';

describe('MCP environment defaults', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.MCP_DEFAULT_LANGUAGE;
    delete process.env.MCP_HTTP_PORT;
    delete process.env.MCP_LOG_LEVEL;
    delete process.env.MCP_DEFAULT_MODEL_PROVIDER;
    delete process.env.MCP_AUTH_TOKEN;
    delete process.env.XC_MCP_TOKEN;
    delete process.env.MCP_ALLOWED_ORIGINS;
    delete process.env.MCP_ENABLE_DNS_REBINDING_PROTECTION;
  });

  it('defaults loadConfig to en-US when MCP_DEFAULT_LANGUAGE is unset', () => {
    delete process.env.MCP_DEFAULT_LANGUAGE;

    expect(loadConfig().defaultLanguage).toBe('en-US');
  });

  it('resolves the core services language fallback to en-US', () => {
    delete process.env.MCP_DEFAULT_LANGUAGE;

    expect(resolveDefaultLanguage({ defaultLanguage: '' })).toBe('en-US');
  });

  it('honors MCP_DEFAULT_LANGUAGE when config.defaultLanguage is missing', () => {
    vi.stubEnv('MCP_DEFAULT_LANGUAGE', 'zh-CN');

    expect(resolveDefaultLanguage({ defaultLanguage: '' })).toBe('zh-CN');
  });

  it('loads configured HTTP, model, auth, origin, and DNS rebinding settings', () => {
    vi.stubEnv('MCP_HTTP_PORT', '3315');
    vi.stubEnv('MCP_LOG_LEVEL', 'warn');
    vi.stubEnv('MCP_DEFAULT_MODEL_PROVIDER', 'openai');
    vi.stubEnv('MCP_AUTH_TOKEN', '0123456789abcdef');
    vi.stubEnv('MCP_ALLOWED_ORIGINS', 'https://feishu.example.com, https://xgd.example.com, ');
    vi.stubEnv('MCP_ENABLE_DNS_REBINDING_PROTECTION', 'true');

    expect(loadConfig()).toEqual({
      httpPort: 3315,
      logLevel: 'warn',
      defaultLanguage: 'en-US',
      preferredModelProvider: 'openai',
      authToken: '0123456789abcdef',
      allowedOrigins: ['https://feishu.example.com', 'https://xgd.example.com'],
      enableDnsRebindingProtection: true
    });
  });

  it('falls back to XC_MCP_TOKEN when MCP_AUTH_TOKEN is unset', () => {
    vi.stubEnv('XC_MCP_TOKEN', 'fedcba9876543210');

    expect(loadConfig().authToken).toBe('fedcba9876543210');
  });

  it('validates config bounds and auth token length', () => {
    const validConfig = loadConfig();
    expect(() => validateConfig(validConfig)).not.toThrow();

    expect(() => validateConfig({ ...validConfig, httpPort: 0 })).toThrow('HTTP port must be between 1 and 65535');
    expect(() => validateConfig({ ...validConfig, httpPort: 65536 })).toThrow('HTTP port must be between 1 and 65535');
    expect(() => validateConfig({ ...validConfig, logLevel: 'trace' as 'debug' })).toThrow('Log level must be one of');
    expect(() => validateConfig({ ...validConfig, authToken: 'short' })).toThrow('MCP auth token must be at least 16 characters');
  });
});
