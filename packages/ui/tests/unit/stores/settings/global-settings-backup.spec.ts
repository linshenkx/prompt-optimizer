import { describe, it, expect, vi } from 'vitest'
import { PreferenceService, MemoryStorageProvider, GLOBAL_SETTINGS_STORAGE_KEY } from '@prompt-optimizer/core'
import { createTestPinia } from '../../../utils/pinia-test-helpers'
import { useGlobalSettings } from '../../../../src/stores/settings/useGlobalSettings'
import { createVariableManager } from '../../../../src/services/VariableManager'

describe('global settings backup hydration', () => {
  it('hydrates global variables as objects after a fresh-device backup import', async () => {
    const sourceStorage = new MemoryStorageProvider()
    const sourcePreferences = new PreferenceService(sourceStorage)
    const sourceVariables = await createVariableManager(sourcePreferences)
    sourceVariables.setVariable('customer', '甲公司')
    sourceVariables.setVariable('instructions', 'line one\n{{customer}}\n' + 'x'.repeat(2000))
    await vi.waitFor(async () => {
      const stored = await sourcePreferences.get<{ customVariables: Record<string, string> } | null>('variableManager.storage', null)
      expect(stored?.customVariables).toEqual(sourceVariables.listVariables())
    })

    // Exporting must work before the new service has read any variable/settings keys.
    const backup = await new PreferenceService(sourceStorage).exportData()
    const destinationPreferences = new PreferenceService(new MemoryStorageProvider())
    await destinationPreferences.importData(backup)
    const destinationVariables = await createVariableManager(destinationPreferences)
    expect(destinationVariables.listVariables()).toEqual(sourceVariables.listVariables())
    expect(destinationVariables.replaceVariables('Hello {{customer}}')).toBe('Hello 甲公司')
  })

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
