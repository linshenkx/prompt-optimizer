import { afterEach, describe, expect, it, vi } from 'vitest';

async function importFreshEnvironmentModule(caseName: string) {
  vi.resetModules();
  if (caseName === 'valid-dynamic') {
    return import('../src/config/environment.js?case=valid-dynamic');
  }
  return import('../src/config/environment.js?case=invalid-dynamic');
}

describe('MCP environment import-time mappings', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('maps static and dynamic VITE custom API environment variables without overwriting existing MCP values', async () => {
    vi.stubEnv('VITE_OPENAI_API_KEY', 'openai-key');
    vi.stubEnv('VITE_CUSTOM_API_KEY_qwen3', 'qwen-key');
    vi.stubEnv('VITE_CUSTOM_API_BASE_URL_qwen3', 'https://example.com/qwen');
    vi.stubEnv('CUSTOM_API_MODEL_qwen3', 'existing-model');
    vi.stubEnv('VITE_CUSTOM_API_MODEL_qwen3', 'qwen-model');
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await importFreshEnvironmentModule('valid-dynamic');

    expect(process.env.OPENAI_API_KEY).toBe('openai-key');
    expect(process.env.CUSTOM_API_KEY_qwen3).toBe('qwen-key');
    expect(process.env.CUSTOM_API_BASE_URL_qwen3).toBe('https://example.com/qwen');
    expect(process.env.CUSTOM_API_MODEL_qwen3).toBe('existing-model');
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Found 3 dynamic custom environment variables'));
    expect(consoleLog).toHaveBeenCalledWith('[MCP Environment] Mapped VITE_OPENAI_API_KEY -> OPENAI_API_KEY');
    expect(consoleLog).toHaveBeenCalledWith('[MCP Environment] Mapped VITE_CUSTOM_API_KEY_qwen3 -> CUSTOM_API_KEY_qwen3');
  });

  it('warns and skips invalid dynamic custom API suffixes', async () => {
    process.env.VITE_CUSTOM_API_KEY_bad_suffix = 'valid-key';
    process.env['VITE_CUSTOM_API_KEY_bad!'] = 'invalid-key';
    process.env[`VITE_CUSTOM_API_KEY_${'x'.repeat(51)}`] = 'too-long';
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await importFreshEnvironmentModule('invalid-dynamic');

    expect(process.env.CUSTOM_API_KEY_bad_suffix).toBe('valid-key');
    expect(process.env.CUSTOM_API_KEY_bad).toBeUndefined();
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Invalid suffix in VITE_CUSTOM_API_KEY_bad!: bad!'));
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Invalid suffix in VITE_CUSTOM_API_KEY_'));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Found 1 dynamic custom environment variables'));
  });
});
