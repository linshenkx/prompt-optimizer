import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadConfig, validateConfig } from '../src/config/environment.js';
import { resolveDefaultLanguage } from '../src/adapters/core-services.js';

describe('MCP environment defaults', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.MCP_DEFAULT_LANGUAGE;
    delete process.env.MCP_HTTP_HOST;
    delete process.env.MCP_AUTH_TOKEN;
    delete process.env.MCP_ALLOWED_ORIGINS;
    delete process.env.MCP_HTTP_BODY_LIMIT;
    delete process.env.MCP_MAX_SESSIONS;
    delete process.env.MCP_SESSION_TTL_MS;
  });

  it('defaults loadConfig to en-US when MCP_DEFAULT_LANGUAGE is unset', () => {
    delete process.env.MCP_DEFAULT_LANGUAGE;

    expect(loadConfig().defaultLanguage).toBe('en-US');
  });

  it('uses secure HTTP defaults', () => {
    const config = loadConfig();

    expect(config.httpHost).toBe('127.0.0.1');
    expect(config.httpAuthToken).toBeUndefined();
    expect(config.httpAllowedOrigins).toEqual([]);
    expect(config.httpBodyLimitBytes).toBe(256 * 1024);
    expect(config.httpMaxSessions).toBe(100);
    expect(config.httpSessionTtlMs).toBe(30 * 60 * 1000);
  });

  it('requires a bearer token for a non-loopback listener', () => {
    vi.stubEnv('MCP_HTTP_HOST', '0.0.0.0');

    expect(() => validateConfig(loadConfig())).toThrow(/MCP_AUTH_TOKEN/);
  });

  it('accepts a non-loopback listener when a bearer token is configured', () => {
    vi.stubEnv('MCP_HTTP_HOST', '0.0.0.0');
    vi.stubEnv('MCP_AUTH_TOKEN', 'test-token-with-sufficient-length');

    expect(() => validateConfig(loadConfig())).not.toThrow();
  });

  it('parses a comma-separated Origin allowlist', () => {
    vi.stubEnv('MCP_ALLOWED_ORIGINS', 'https://one.example, http://localhost:5173');

    expect(loadConfig().httpAllowedOrigins).toEqual([
      'https://one.example',
      'http://localhost:5173'
    ]);
  });

  it.each([
    ['MCP_HTTP_BODY_LIMIT', 'unbounded'],
    ['MCP_MAX_SESSIONS', '0'],
    ['MCP_SESSION_TTL_MS', 'not-a-number']
  ])('rejects invalid %s values', (name, value) => {
    vi.stubEnv(name, value);

    expect(() => validateConfig(loadConfig())).toThrow(name);
  });

  it('rejects wildcard Origins without exposing the configured token', () => {
    const token = 'test-token-that-must-stay-secret';
    vi.stubEnv('MCP_AUTH_TOKEN', token);
    vi.stubEnv('MCP_ALLOWED_ORIGINS', '*');

    let message = '';
    try {
      validateConfig(loadConfig());
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('MCP_ALLOWED_ORIGINS');
    expect(message).not.toContain(token);
  });

  it('resolves the core services language fallback to en-US', () => {
    delete process.env.MCP_DEFAULT_LANGUAGE;

    expect(resolveDefaultLanguage({ defaultLanguage: '' })).toBe('en-US');
  });

  it('honors MCP_DEFAULT_LANGUAGE when config.defaultLanguage is missing', () => {
    vi.stubEnv('MCP_DEFAULT_LANGUAGE', 'zh-CN');

    expect(resolveDefaultLanguage({ defaultLanguage: '' })).toBe('zh-CN');
  });
});
