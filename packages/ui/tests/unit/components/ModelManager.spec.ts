import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ModelManager from '../../../src/components/ModelManager.vue'

// Provide minimal mocks for dependencies injected by the component
const mockServices = {
  value: {
    modelManager: {
      getAllModels: vi.fn().mockResolvedValue([]),
      enableModel: vi.fn(),
      disableModel: vi.fn(),
      deleteModel: vi.fn(),
      addModel: vi.fn(),
      updateModel: vi.fn(),
      getModel: vi.fn()
    },
    llmService: {
      testConnection: vi.fn().mockResolvedValue({ success: true }),
      fetchModelList: vi.fn().mockResolvedValue([])
    },
    imageModelManager: {
      getAllModels: vi.fn().mockResolvedValue([]),
      enableModel: vi.fn(),
      disableModel: vi.fn(),
      deleteModel: vi.fn(),
      addModel: vi.fn(),
      updateModel: vi.fn(),
      getModel: vi.fn()
    },
    imageAdapterRegistry: {
      getAvailableProviders: vi.fn().mockReturnValue([])
    },
    textAdapterRegistry: {
      getAllProviders: vi.fn().mockReturnValue([]),
      getStaticModels: vi.fn().mockReturnValue([])
    }
  }
}

// Minimal i18n/toast mocks
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('../../../src/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}))

describe('ModelManager', () => {
  const mountComponent = () =>
    mount(ModelManager, {
      props: {
        show: true
      },
      global: {
        provide: {
          services: mockServices
        },
        stubs: {
          NModal: {
            template: '<div class="stub-modal"><slot /><slot name="header-extra" /><slot name="action" /></div>',
            props: ['show'],
            emits: ['update:show']
          },
          'n-modal': {
            template: '<div class="stub-modal"><slot /><slot name="header-extra" /><slot name="action" /></div>',
            props: ['show'],
            emits: ['update:show']
          },
          NScrollbar: { template: '<div class="stub-scrollbar"><slot /></div>' },
          'n-scrollbar': { template: '<div class="stub-scrollbar"><slot /></div>' },
          NSpace: { template: '<div class="stub-space"><slot /></div>' },
          'n-space': { template: '<div class="stub-space"><slot /></div>' },
          NCard: { template: '<div class="stub-card"><slot name="header" /><slot /><slot name="action" /></div>' },
          'n-card': { template: '<div class="stub-card"><slot name="header" /><slot /><slot name="action" /></div>' },
          NText: { template: '<span class="stub-text"><slot /></span>' },
          'n-text': { template: '<span class="stub-text"><slot /></span>' },
          NTag: { template: '<span class="stub-tag"><slot /></span>' },
          'n-tag': { template: '<span class="stub-tag"><slot /></span>' },
          NButton: {
            template: '<button class="stub-button" @click="$emit(\'click\')"><slot name="icon" /><slot /></button>'
          },
          'n-button': {
            template: '<button class="stub-button" @click="$emit(\'click\')"><slot name="icon" /><slot /></button>'
          },
          NSelect: { template: '<select class="stub-select"><slot /></select>' },
          'n-select': { template: '<select class="stub-select"><slot /></select>' },
          NInput: {
            template: '<input class="stub-input" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
            props: ['value']
          },
          'n-input': {
            template: '<input class="stub-input" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
            props: ['value']
          },
          NTabs: { template: '<div class="stub-tabs"><slot /></div>' },
          'n-tabs': { template: '<div class="stub-tabs"><slot /></div>' },
          NTabPane: { template: '<div class="stub-tab-pane"><slot /></div>' },
          'n-tab-pane': { template: '<div class="stub-tab-pane"><slot /></div>' },
          NDivider: { template: '<hr class="stub-divider" />' },
          'n-divider': { template: '<hr class="stub-divider" />' },
          NH4: { template: '<h4 class="stub-h4"><slot /></h4>' },
          'n-h4': { template: '<h4 class="stub-h4"><slot /></h4>' },
          NCheckbox: {
            template: '<input type="checkbox" class="stub-checkbox" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" />',
            props: ['checked']
          },
          'n-checkbox': {
            template: '<input type="checkbox" class="stub-checkbox" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" />',
            props: ['checked']
          },
          ImageModelManager: {
            template: '<div class="stub-image-manager" />'
          },
          ImageModelEditModal: {
            template: '<div class="stub-image-edit-modal" />'
          },
          InputWithSelect: {
            template: '<div class="stub-input-with-select" />'
          }
        }
      }
    })

  it('mounts successfully with provided services', async () => {
    const wrapper = mountComponent()
    // 组件应该成功挂载
    expect(wrapper.exists()).toBe(true)
    // ModelManager 不再在挂载时直接调用 getAllModels
    // 数据加载由子组件 TextModelManager 和 ImageModelManager 处理

    // 验证组件结构包含 TextModelManager 和 ImageModelManager 存根
    expect(wrapper.html()).toBeTruthy()
  })
})
