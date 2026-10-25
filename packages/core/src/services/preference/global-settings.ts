/** Versioned persistence contract shared by UI stores and backup import. */
export const GLOBAL_SETTINGS_STORAGE_KEY = 'global-settings/v1';

export interface GlobalSettingsSnapshot {
  selectedThemeId: string;
  preferredLanguage: string;
  builtinTemplateLanguage: string;
  functionMode: 'basic' | 'pro' | 'image';
  basicSubMode: 'system' | 'user';
  proSubMode: 'multi' | 'variable';
  imageSubMode: 'text2image' | 'image2image' | 'multiimage';
  lastActiveAt: number;
}

/** Accept partial v1 snapshots, but never arbitrary preference keys or fields. */
export function parseGlobalSettingsSnapshot(value: unknown): Partial<GlobalSettingsSnapshot> | null {
  if (typeof value !== 'string' || value.length > 1000) return null;
  try {
    const source: unknown = JSON.parse(value);
    if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
    const data = source as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of ['selectedThemeId', 'preferredLanguage', 'builtinTemplateLanguage'] as const) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      const field = data[key];
      // Theme/language catalogs belong to the UI; allow bounded identifiers for future entries.
      if (typeof field !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(field)) return null;
      result[key] = field;
    }
    const modes = {
      functionMode: ['basic', 'pro', 'image'],
      basicSubMode: ['system', 'user'],
      proSubMode: ['multi', 'variable'],
      imageSubMode: ['text2image', 'image2image', 'multiimage'],
    };
    for (const [key, allowed] of Object.entries(modes)) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      const field = key === 'proSubMode' && data[key] === 'system' ? 'multi'
        : key === 'proSubMode' && data[key] === 'user' ? 'variable' : data[key];
      if (typeof field !== 'string' || !allowed.includes(field)) return null;
      result[key] = field;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'lastActiveAt')) {
      if (typeof data.lastActiveAt !== 'number' || !Number.isFinite(data.lastActiveAt) || data.lastActiveAt < 0) return null;
      result.lastActiveAt = data.lastActiveAt;
    }
    return Object.keys(result).length ? result as Partial<GlobalSettingsSnapshot> : null;
  } catch {
    return null;
  }
}

export const LEGACY_GLOBAL_SETTING_FIELDS = {
  'app:settings:ui:theme-id': 'selectedThemeId',
  'app:settings:ui:preferred-language': 'preferredLanguage',
  'app:settings:ui:builtin-template-language': 'builtinTemplateLanguage',
} as const;
