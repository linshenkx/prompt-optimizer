import { describe, it, expect, vi, afterEach } from 'vitest';
import { PreferenceService } from '../../../src/services/preference/service';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';
import { GLOBAL_SETTINGS_STORAGE_KEY as key } from '../../../src/services/preference/global-settings';

const saved = {
  selectedThemeId: 'light', preferredLanguage: 'en-US', builtinTemplateLanguage: 'en-US',
  functionMode: 'image', basicSubMode: 'user', proSubMode: 'multi', imageSubMode: 'multiimage', lastActiveAt: 123,
};
const create = () => new PreferenceService(new MemoryStorageProvider());
const snapshot = async (service: PreferenceService) => JSON.parse(await service.get(key, '{}'));
afterEach(() => vi.restoreAllMocks());

describe('global settings backup restore', () => {
  it('round trips every global setting over a different destination snapshot', async () => {
    const source = create();
    await source.set(key, JSON.stringify(saved));
    const destination = create();
    await destination.set(key, JSON.stringify({ ...saved, selectedThemeId: 'dark', functionMode: 'basic' }));
    await destination.importData(await source.exportData());
    expect(await snapshot(destination)).toEqual(saved);
  });

  it('applies legacy keys over an existing snapshot without resetting unrelated fields', async () => {
    const service = create();
    await service.set(key, JSON.stringify(saved));
    await service.importData({ 'theme-id': 'dark', 'preferred-language': 'zh-CN' });
    expect(await snapshot(service)).toEqual({ ...saved, selectedThemeId: 'dark', preferredLanguage: 'zh-CN' });
  });

  it.each([true, false])('gives the versioned snapshot priority independent of key order (%s)', async reverse => {
    const service = create();
    const entries = [[key, JSON.stringify(saved)], ['theme-id', 'dark'], ['preferred-language', 'zh-CN']];
    await service.importData(Object.fromEntries(reverse ? entries.reverse() : entries));
    expect(await snapshot(service)).toEqual(saved);
  });

  it.each(['{', '[]', 'null', '{}', '{"unknown":"value"}', '{"functionMode":"other"}',
    '{"selectedThemeId":123}', '{"preferredLanguage":"en-US\\u0000"}',
    '{"lastActiveAt":-1}', '{"lastActiveAt":1e999}', ' '.repeat(1001)])(
    'does not overwrite current settings with invalid snapshot %s', async invalid => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const service = create();
      await service.set(key, JSON.stringify(saved));
      await service.importData({ [key]: invalid });
      expect(await snapshot(service)).toEqual(saved);
    },
  );

  it('normalizes old pro modes and strips unknown fields without widening the key whitelist', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const service = create();
    await service.importData({
      [key]: '{"proSubMode":"user","__proto__":{"polluted":true},"unexpected":42}',
      'session/basic-user/v1': 'do not import through preferences',
      'global-settings/v2': '{}',
    });
    expect(await snapshot(service)).toEqual({ proSubMode: 'variable' });
    expect(await service.get('session/basic-user/v1', null)).toBeNull();
    expect(await service.get('global-settings/v2', null)).toBeNull();
  });

  it('reports a snapshot write failure instead of claiming restoration succeeded', async () => {
    const service = create();
    vi.spyOn(service, 'set').mockRejectedValue(new Error('storage unavailable'));
    await expect(service.importData({ [key]: JSON.stringify(saved) })).rejects.toThrow('Failed to import global settings');
  });
});
