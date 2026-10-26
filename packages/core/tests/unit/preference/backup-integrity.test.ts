import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferenceService } from '../../../src/services/preference/service';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';
import { GLOBAL_SETTINGS_STORAGE_KEY } from '../../../src/services/preference/global-settings';

const variableKey = 'variableManager.storage';
const themeKey = 'app:settings:ui:theme-id';
const globalSettings = { functionMode: 'image', imageSubMode: 'multiimage', preferredLanguage: 'en-US' };
const variables = {
  customVariables: { 客户名称: '甲公司', instructions: 'line one\n{{other}}\n' + 'x'.repeat(2000) },
  advancedModeEnabled: true,
  lastConversationMessages: [{
    role: 'assistant', content: 'Previous message', id: 'message-1',
    tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'lookup', arguments: '{"q":"value"}' } }],
  }],
};

afterEach(() => vi.restoreAllMocks());

describe('preference backup integrity', () => {
  it('restores structured global variables and settings from an unread new service instance', async () => {
    const storage = new MemoryStorageProvider();
    const source = new PreferenceService(storage);
    await source.set(variableKey, variables);
    await source.set(GLOBAL_SETTINGS_STORAGE_KEY, JSON.stringify(globalSettings));
    await source.set('runtime-only', { local: true });
    await source.set('session/v1/basic-user', { prompt: 'session has its own backup section' });

    const reopened = new PreferenceService(storage);
    const backup = await reopened.exportData();
    expect(backup[variableKey]).toBe(JSON.stringify(variables));
    expect(backup[GLOBAL_SETTINGS_STORAGE_KEY]).toBe(JSON.stringify(globalSettings));
    expect(backup).not.toHaveProperty('runtime-only');
    expect(backup).not.toHaveProperty('session/v1/basic-user');

    const destination = new PreferenceService(new MemoryStorageProvider());
    await destination.set(variableKey, { customVariables: { old: 'remove me' } });
    await destination.importData(JSON.parse(JSON.stringify(backup)));
    expect(await destination.get(variableKey, null)).toEqual(variables);
    expect(JSON.parse(await destination.get(GLOBAL_SETTINGS_STORAGE_KEY, '{}'))).toEqual(globalSettings);
  });

  it('does not export unsupported cached preferences', async () => {
    const storage = new MemoryStorageProvider();
    const source = new PreferenceService(storage);
    await source.set('machine-secret', 'stay local');
    await source.set(themeKey, 'dark');
    await source.set('session/v1/basic-user', { prompt: 'session' });
    const reads = vi.spyOn(storage, 'getItem');
    expect(await source.exportData()).toEqual({ [themeKey]: 'dark' });
    expect(reads).not.toHaveBeenCalledWith('pref:machine-secret');
    expect(reads).not.toHaveBeenCalledWith('pref:session/v1/basic-user');
  });

  it('keeps legacy supported UI keys available after reopening', async () => {
    const storage = new MemoryStorageProvider();
    await new PreferenceService(storage).set('theme-id', 'light');
    const backup = await new PreferenceService(storage).exportData();
    expect(backup['theme-id']).toBe('light');
    const destination = new PreferenceService(new MemoryStorageProvider());
    await destination.importData(backup);
    expect(await destination.get(themeKey, null)).toBe('light');
  });

  it('does not let a stale legacy alias override the current UI preference', async () => {
    const storage = new MemoryStorageProvider();
    const source = new PreferenceService(storage);
    await source.set('theme-id', 'light');
    await source.set(themeKey, 'dark');
    const backup = await new PreferenceService(storage).exportData();
    expect(backup).toEqual({ [themeKey]: 'dark' });
    const destination = new PreferenceService(new MemoryStorageProvider());
    await destination.importData(backup);
    expect(await destination.get(themeKey, null)).toBe('dark');
  });

  it('preserves valid boundary names and existing long string values', async () => {
    const snapshot = {
      customVariables: {
        ['v'.repeat(50)]: 'x'.repeat(10000),
        客户名称: '公司',
        'customer.name': 'A',
        // Existing variable-only imports accepted strings above the editor limit.
        legacyValue: 'y'.repeat(10001),
      },
    };
    const source = new PreferenceService(new MemoryStorageProvider());
    await source.set(variableKey, snapshot);
    const destination = new PreferenceService(new MemoryStorageProvider());
    await destination.importData(await source.exportData());
    expect(await destination.get(variableKey, null)).toEqual(snapshot);
  });

  it.each([
    '[object Object]', '{', '[]', '{}',
    '{"customVariables":{"customer":42}}',
    '{"customVariables":{"__proto__":"bad"}}',
    '{"customVariables":{"constructor":"bad"}}',
    '{"customVariables":{"invalid name":"bad"}}',
    '{"customVariables":{},"advancedModeEnabled":"yes"}',
    '{"customVariables":{},"lastConversationMessages":[{"role":"system","content":12}]}',
    '{"customVariables":{},"lastConversationMessages":[{"role":"other","content":"x"}]}',
    '{"customVariables":{},"lastConversationMessages":[{"role":["system"],"content":"x"}]}',
  ])('rejects corrupt structured variables before any preference writes: %s', async invalid => {
    const destination = new PreferenceService(new MemoryStorageProvider());
    await destination.set(themeKey, 'light');
    await destination.set(variableKey, variables);
    await expect(destination.importData({ [themeKey]: 'dark', [variableKey]: invalid })).rejects.toThrow('Invalid preference data format');
    expect(await destination.get(themeKey, null)).toBe('light');
    expect(await destination.get(variableKey, null)).toEqual(variables);
  });

  it('fails export when a supported stored preference cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const storage = new MemoryStorageProvider();
    await storage.setItem(`pref:${variableKey}`, '{unreadable');
    await expect(new PreferenceService(storage).exportData()).rejects.toThrow('Failed to export preference data');
  });

  it('fails export instead of carrying an already-corrupted variables snapshot', async () => {
    const source = new PreferenceService(new MemoryStorageProvider());
    await source.set(variableKey, '[object Object]');
    await expect(source.exportData()).rejects.toThrow('Failed to export preference data');
  });

  it('reports a supported preference write failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const destination = new PreferenceService(new MemoryStorageProvider());
    vi.spyOn(destination, 'set').mockRejectedValue(new Error('storage unavailable'));
    await expect(destination.importData({ [variableKey]: JSON.stringify(variables) })).rejects.toThrow('Failed to import 1 preference setting');
  });
});
