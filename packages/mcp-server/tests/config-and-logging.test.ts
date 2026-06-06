import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSimpleLanguageService, SimpleLanguageService } from '../src/adapters/language-service.js';
import { getDefaultTemplateId, getTemplateOptions } from '../src/config/templates.js';
import * as logging from '../src/utils/logging.js';

function createTemplateManager(options?: { throwOnList?: boolean; empty?: boolean }) {
  return {
    listTemplatesByType: vi.fn(async (type: string) => {
      if (options?.throwOnList) {
        throw new Error(`failed ${type}`);
      }
      if (options?.empty) {
        return [];
      }
      return [
        {
          id: `${type}-builtin`,
          name: `${type} Builtin`,
          isBuiltin: true,
          metadata: {}
        },
        {
          id: `${type}-custom`,
          name: `${type} Custom`,
          isBuiltin: false,
          metadata: { description: `${type} custom description` }
        }
      ];
    })
  };
}

describe('MCP template config', () => {
  it('returns default template ids for supported optimization modes', async () => {
    const templateManager = createTemplateManager();

    await expect(getDefaultTemplateId(templateManager as never, 'user')).resolves.toBe('userOptimize-builtin');
    await expect(getDefaultTemplateId(templateManager as never, 'system')).resolves.toBe('optimize-builtin');
    await expect(getDefaultTemplateId(templateManager as never, 'iterate')).resolves.toBe('iterate-builtin');
  });

  it('throws when no templates exist or optimization mode is invalid', async () => {
    const emptyTemplateManager = createTemplateManager({ empty: true });
    await expect(getDefaultTemplateId(emptyTemplateManager as never, 'user')).rejects.toThrow('No templates found');

    const templateManager = createTemplateManager();
    await expect(getDefaultTemplateId(templateManager as never, 'invalid' as never)).rejects.toThrow('Unknown optimization mode');
  });

  it('returns template options and falls back to an empty list on errors', async () => {
    const templateManager = createTemplateManager();

    await expect(getTemplateOptions(templateManager as never, 'userOptimize')).resolves.toEqual([
      {
        value: 'userOptimize-builtin',
        label: 'userOptimize Builtin',
        description: 'Built-in template'
      },
      {
        value: 'userOptimize-custom',
        label: 'userOptimize Custom',
        description: 'userOptimize custom description'
      }
    ]);

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(getTemplateOptions(createTemplateManager({ throwOnList: true }) as never, 'iterate')).resolves.toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Failed to get template options for iterate:'), expect.any(Error));
    consoleError.mockRestore();
  });

  it('uses the user-template description fallback for custom templates without metadata descriptions', async () => {
    const templateManager = {
      listTemplatesByType: vi.fn(async () => [{
        id: 'custom-without-description',
        name: 'Custom without description',
        isBuiltin: false,
        metadata: {}
      }])
    };

    await expect(getTemplateOptions(templateManager as never, 'iterate')).resolves.toEqual([{
      value: 'custom-without-description',
      label: 'Custom without description',
      description: 'User template'
    }]);
  });
});

describe('MCP simple language service', () => {
  it('normalizes default languages and toggles between supported languages', async () => {
    const zhService = createSimpleLanguageService('chinese');
    expect(zhService.isInitialized()).toBe(false);

    await zhService.initialize();
    expect(zhService.isInitialized()).toBe(true);
    await expect(zhService.getCurrentLanguage()).resolves.toBe('zh-CN');
    await expect(zhService.toggleLanguage()).resolves.toBe('en-US');
    await expect(zhService.getCurrentLanguage()).resolves.toBe('en-US');
  });

  it('validates language support and exposes display names', async () => {
    const service = new SimpleLanguageService('unknown');

    await expect(service.getCurrentLanguage()).resolves.toBe('en-US');
    await expect(service.isValidLanguage('zh-CN')).resolves.toBe(true);
    await expect(service.isValidLanguage('zh-TW')).resolves.toBe(false);
    await expect(service.setLanguage('zh-TW' as never)).rejects.toThrow('Unsupported language');
    expect(service.getLanguageDisplayName('zh-CN')).toBe('中文');
    expect(service.getLanguageDisplayName('en-US')).toBe('English');
    expect(service.getLanguageDisplayName('zh-TW' as never)).toBe('zh-TW');
  });
});

describe('MCP logging utility', () => {
  afterEach(() => {
    delete process.env.DEBUG;
  });

  it('sets DEBUG patterns for each log level and accepts optional metadata', () => {
    delete process.env.DEBUG;
    logging.setLogLevel('debug');
    expect(process.env.DEBUG).toBe('mcp:*');

    logging.debug('debug message', { ok: true });
    logging.info('info message', { ok: true });
    logging.warn('warn message', { ok: true });
    logging.error('error message', new Error('boom'));
  });

  it('respects an existing DEBUG pattern while refreshing logger enablement', () => {
    process.env.DEBUG = 'mcp:warn,mcp:error';

    logging.setLogLevel('info');
    expect(process.env.DEBUG).toBe('mcp:warn,mcp:error');

    logging.debug('debug disabled by pattern');
    logging.info('info disabled by pattern');
    logging.warn('warn enabled by pattern');
    logging.error('error enabled without Error instance');
  });
});
