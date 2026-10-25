import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import LanguageSwitchDropdown from '../../../src/components/LanguageSwitchDropdown.vue'
import { createTestPinia } from '../../utils/pinia-test-helpers'
import { useGlobalSettings } from '../../../src/stores/settings/useGlobalSettings'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    useI18n: () => ({
      t: (key, params = {}) => {
        const dictionary = {
          'settings.languageSwitcher.label': 'Switch language',
          'settings.languageSwitcher.ariaLabel': `Switch language (${params.language ?? ''})`,
          'settings.languageSwitcher.languages.zh-CN': 'Chinese (Simplified)',
          'settings.languageSwitcher.languages.zh-TW': 'Chinese (Traditional)',
          'settings.languageSwitcher.languages.en-US': 'English'
        }

        return dictionary[key] ?? key
      }
    })
  }
})

// Mock Naive UI components
vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    template: '<button><slot name="icon"></slot><slot></slot></button>',
    props: ['title', 'ariaLabel']
  },
  NDropdown: {
    name: 'NDropdown',
    template: '<div><slot></slot></div>',
    emits: ['select'],
    props: ['options', 'placement', 'trigger']
  }
}))

// Mock服务注入
const mockServices = {
  value: {
    preferenceService: {
      get: vi.fn().mockResolvedValue('zh-CN'),
      set: vi.fn().mockResolvedValue(true)
    }
  }
}

describe('LanguageSwitchDropdown', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createWrapper = (props = {}) => {
    const { pinia } = createTestPinia(mockServices.value)
    return mount(LanguageSwitchDropdown, {
      global: {
        plugins: [pinia],
        provide: {
          services: mockServices
        }
      },
      props
    })
  }

  describe('基本功能', () => {
    it('应该正确渲染组件', () => {
      wrapper = createWrapper()
      expect(wrapper.vm).toBeDefined()
    })

    it('应该通过 locale 提供语言选项文案', () => {
      wrapper = createWrapper()
      const vm = wrapper.vm
      expect(vm.availableLanguages).toHaveLength(3)
      expect(vm.availableLanguages[0].key).toBe('zh-CN')
      expect(vm.availableLanguages[0].label).toBe('Chinese (Simplified)')
      expect(vm.availableLanguages[1].key).toBe('zh-TW')
      expect(vm.availableLanguages[1].label).toBe('Chinese (Traditional)')
      expect(vm.availableLanguages[2].key).toBe('en-US')
      expect(vm.availableLanguages[2].label).toBe('English')
    })

    it('应该通过 locale 生成当前语言提示文案', () => {
      wrapper = createWrapper()
      const vm = wrapper.vm

      expect(vm.currentLanguageLabel).toBe('Switch language (English)')
    })

    it('应该能够调用语言切换方法', async () => {
      wrapper = createWrapper()
      const vm = wrapper.vm

      // The visible language and the backup snapshot must follow the same selection.
      expect(typeof vm.handleLanguageSelect).toBe('function')
      await vm.handleLanguageSelect('en-US')
      expect(mockServices.value.preferenceService.set).toHaveBeenCalled()
      expect(useGlobalSettings().state.preferredLanguage).toBe('en-US')
    })

    it('keeps the snapshot unchanged for unsupported language selections', async () => {
      wrapper = createWrapper()
      const settings = useGlobalSettings()
      const original = settings.state.preferredLanguage
      await wrapper.vm.handleLanguageSelect('unknown')
      expect(settings.state.preferredLanguage).toBe(original)
      expect(mockServices.value.preferenceService.set).not.toHaveBeenCalled()
    })
  })
})
