import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import LanguageSwitchDropdown from '../../../src/components/LanguageSwitchDropdown.vue'

// Mock Naive UI components
vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    template: '<button><slot name="icon"></slot><slot></slot></button>'
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
    return mount(LanguageSwitchDropdown, {
      global: {
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

    it('应该包含正确的语言选项', () => {
      wrapper = createWrapper()
      const vm = wrapper.vm
      expect(vm.availableLanguages).toHaveLength(3)
      expect(vm.availableLanguages[0].key).toBe('zh-CN')
      expect(vm.availableLanguages[1].key).toBe('zh-TW')
      expect(vm.availableLanguages[2].key).toBe('en-US')
    })

    it('应该能够调用语言切换方法', async () => {
      wrapper = createWrapper()
      const vm = wrapper.vm

      // 只验证方法能被调用，不测试具体的切换逻辑
      expect(typeof vm.handleLanguageSelect).toBe('function')
      await vm.handleLanguageSelect('en-US')
      expect(mockServices.value.preferenceService.set).toHaveBeenCalled()
    })
  })
})
