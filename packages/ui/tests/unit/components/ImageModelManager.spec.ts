import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ImageModelManager from '../../../src/components/ImageModelManager.vue'

// Mock dependencies
vi.mock('@prompt-optimizer/core', () => ({}))

// Mock i18n
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

// Mock the useImageModelManager composable
const mockLoadConfigs = vi.fn().mockResolvedValue(undefined)
const mockInitialize = vi.fn(async () => {
  await mockLoadConfigs()
})
const mockUpdateConfig = vi.fn().mockResolvedValue(undefined)
const mockDeleteConfig = vi.fn().mockResolvedValue(undefined)

vi.mock('../../../src/composables/useImageModelManager', () => ({
  useImageModelManager: () => ({
    providers: ref([
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'OpenAI Image models'
      }
    ]),
    configs: ref([
      {
        id: 'gpt-image-1',
        name: 'GPT Image 1',
        enabled: true,
        model: {
          id: 'gpt-image-1',
          capabilities: {
            text2image: true,
            image2image: false
          }
        }
      }
    ]),
    models: ref([
      {
        id: 'gpt-image-1',
        name: 'GPT Image 1',
        enabled: true,
        capabilities: {
          text2image: true,
          image2image: false
        }
      }
    ]),
    isLoading: ref(false),
    error: ref(null),
    initialize: mockInitialize,
    loadConfigs: mockLoadConfigs,
    updateConfig: mockUpdateConfig,
    deleteConfig: mockDeleteConfig,
    testConnection: vi.fn().mockResolvedValue({ success: true }),
    enableModel: vi.fn().mockResolvedValue(undefined),
    disableModel: vi.fn().mockResolvedValue(undefined),
    openAddModal: vi.fn(),
    openEditModal: vi.fn()
  })
}))

describe('ImageModelManager', () => {
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockInitialize.mockClear()
    mockLoadConfigs.mockClear()
    mockUpdateConfig.mockClear()
    mockDeleteConfig.mockClear()
  })

  const mockImageRegistry = {
    getAvailableProviders: vi.fn().mockReturnValue([
      {
        value: 'openai',
        label: 'OpenAI',
        aliases: []
      }
    ])
  }

  const mockImageService = {
    testConnection: vi.fn().mockResolvedValue({ success: true })
  }

  const createWrapper = (props = {}) => {
    return mount(ImageModelManager, {
      props: {
        ...props
      },
      global: {
        provide: {
          imageRegistry: mockImageRegistry,
          imageService: mockImageService
        },
        stubs: {
          // Stub all NaiveUI components
          'n-card': { template: '<div><slot name="header" /><slot /></div>' },
          'n-space': { template: '<div><slot /></div>' },
          'n-button': { template: '<button><slot /></button>' },
          'n-input': { template: '<input />' },
          'n-select': { template: '<select><slot /></select>' },
          'n-form': { template: '<form><slot /></form>' },
          'n-form-item': { template: '<div><slot /></div>' },
          'n-text': { template: '<span><slot /></span>' },
          'n-tag': { template: '<span><slot /></span>' },
          'n-divider': { template: '<hr />' },
          'n-empty': { template: '<div><slot name="extra" /></div>' }
        },
        mocks: {
          $t: (key: string) => key
        }
      }
    })
  }

  // TODO: 添加测试用例
  it.todo('应该正确初始化组件')
})
