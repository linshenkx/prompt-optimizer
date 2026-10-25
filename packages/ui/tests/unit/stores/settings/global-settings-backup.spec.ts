import { describe, it, expect } from 'vitest'
import { PreferenceService, MemoryStorageProvider, GLOBAL_SETTINGS_STORAGE_KEY } from '@prompt-optimizer/core'
import { createTestPinia } from '../../../utils/pinia-test-helpers'
import { useGlobalSettings } from '../../../../src/stores/settings/useGlobalSettings'

describe('global settings backup hydration', () => {
  it('restores the exported theme, languages and all mode preferences on next app startup', async () => {
    const preferenceService = new PreferenceService(new MemoryStorageProvider())
    const source = useGlobalSettings(createTestPinia({ preferenceService }).pinia)
    await source.restoreGlobalSettings()
    source.updateThemeId('light')
    source.updatePreferredLanguage('en-US')
    source.updateBuiltinTemplateLanguage('en-US')
    source.updateFunctionMode('image')
    source.updateBasicSubMode('user')
    source.updateProSubMode('multi')
    source.updateImageSubMode('multiimage')
    await source.saveGlobalSettings()
    const expected = { ...source.state }
    const backup = await preferenceService.exportData()
    source.$dispose()

    await preferenceService.set(GLOBAL_SETTINGS_STORAGE_KEY, JSON.stringify({
      ...expected, selectedThemeId: 'dark', preferredLanguage: 'zh-CN', functionMode: 'basic',
    }))
    await preferenceService.importData(backup)
    const restored = useGlobalSettings(createTestPinia({ preferenceService }).pinia)
    await restored.restoreGlobalSettings()
    expect(restored.state).toEqual({ ...expected, lastActiveAt: expect.any(Number) })
    expect(restored.state.lastActiveAt).toBeGreaterThanOrEqual(expected.lastActiveAt)
    expect(restored.hasRestored).toBe(true)
  })
})
