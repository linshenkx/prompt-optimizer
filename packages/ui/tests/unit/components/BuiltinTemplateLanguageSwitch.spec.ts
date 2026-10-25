import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { shallowRef } from 'vue'
import { MemoryStorageProvider, PreferenceService, UI_SETTINGS_KEYS } from '@prompt-optimizer/core'
import BuiltinTemplateLanguageSwitch from '../../../src/components/BuiltinTemplateLanguageSwitch.vue'
import { useGlobalSettings } from '../../../src/stores/settings/useGlobalSettings'
import { createTestPinia } from '../../utils/pinia-test-helpers'

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

afterEach(() => vi.restoreAllMocks())

async function setup() {
  const preferenceService = new PreferenceService(new MemoryStorageProvider())
  const change = vi.fn(async (language: string) => {
    await preferenceService.set(UI_SETTINGS_KEYS.BUILTIN_TEMPLATE_LANGUAGE, language)
  })
  const { pinia, services } = createTestPinia({
    preferenceService,
    templateManager: { changeBuiltinTemplateLanguage: change } as any,
    templateLanguageService: {
      isInitialized: () => true,
      getCurrentLanguage: async () => 'zh-CN',
      getSupportedLanguages: async () => ['zh-CN', 'en-US'],
      getLanguageDisplayName: (language: string) => language,
    } as any,
  })
  const settings = useGlobalSettings(pinia)
  await settings.restoreGlobalSettings()
  const wrapper = mount(BuiltinTemplateLanguageSwitch, {
    global: { plugins: [pinia], provide: { services: shallowRef(services) } },
  })
  await flushPromises()
  return { wrapper, settings, preferenceService, change }
}

describe('built-in template language persistence', () => {
  it('updates the backup snapshot together with the successful language change', async () => {
    const { wrapper, settings, preferenceService, change } = await setup()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(change).toHaveBeenCalledWith('en-US')
    expect(settings.state.builtinTemplateLanguage).toBe('en-US')
    expect(JSON.parse(await preferenceService.get('global-settings/v1', '{}')).builtinTemplateLanguage).toBe('en-US')
    expect(await preferenceService.get(UI_SETTINGS_KEYS.BUILTIN_TEMPLATE_LANGUAGE, '')).toBe('en-US')
    expect(wrapper.emitted('languageChanged')).toEqual([['en-US']])
    wrapper.unmount()
  })

  it('preserves the snapshot and allows retry after the template service fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { wrapper, settings, change } = await setup()
    change.mockRejectedValueOnce(new Error('unavailable'))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(settings.state.builtinTemplateLanguage).toBe('zh-CN')
    expect(wrapper.emitted('languageChanged')).toBeUndefined()
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
