import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import type { ImageModelConfig } from '@prompt-optimizer/core'

import ImageModelQuickSwitch from '../../../src/components/ImageModelQuickSwitch.vue'
import type { SelectOption } from '../../../src/types/select-options'

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => toast,
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        params?.model ? `${key}:${params.model}` : key,
    }),
  }
})

const NPopoverStub = defineComponent({
  name: 'NPopover',
  emits: ['update:show'],
  setup(_, { slots, emit }) {
    return () =>
      h('div', { class: 'n-popover-stub' }, [
        h(
          'button',
          {
            type: 'button',
            'data-testid': 'image-quick-switch-trigger',
            onClick: () => emit('update:show', true),
          },
          slots.trigger?.(),
        ),
        h('div', { class: 'n-popover-content' }, slots.default?.()),
      ])
  },
})

const NSelectStub = defineComponent({
  name: 'NSelect',
  props: {
    value: { type: [String, Number], default: '' },
    options: { type: Array, default: () => [] },
  },
  emits: ['update:value'],
  setup(props, { emit }) {
    return () =>
      h(
        'select',
        {
          'data-testid': 'image-quick-switch-select',
          value: props.value,
          onChange: (event: Event) => {
            emit('update:value', (event.target as HTMLSelectElement).value)
          },
        },
        (props.options as Array<{ value: string | number; label: string }>).map((option) =>
          h('option', { value: option.value }, option.label),
        ),
      )
  },
})

const simpleStub = (name: string, tag = 'div') =>
  defineComponent({
    name,
    setup(_, { slots, attrs }) {
      return () => h(tag, attrs, slots.default?.())
    },
  })

const createConfig = (): ImageModelConfig => ({
  id: 'image-config-1',
  name: 'Image Gateway',
  enabled: true,
  providerId: 'openai',
  modelId: 'gpt-image-1',
  provider: {
    id: 'openai',
    name: 'OpenAI Image',
    requiresApiKey: true,
    defaultBaseURL: 'https://api.openai.com/v1',
    supportsDynamicModels: true,
  },
  model: {
    id: 'gpt-image-1',
    name: 'GPT Image 1',
    providerId: 'openai',
    capabilities: {
      text2image: true,
      image2image: true,
    },
    parameterDefinitions: [],
  },
  connectionConfig: {
    apiKey: 'secret',
    baseURL: 'https://api.example.com/v1',
  },
})

const createOption = (config: ImageModelConfig): SelectOption<ImageModelConfig> => ({
  primary: config.name,
  secondary: `${config.provider.name} · ${config.model.name}`,
  value: config.id,
  raw: config,
})

const mountComponent = (config = createConfig()) => {
  const updateConfig = vi.fn().mockResolvedValue(undefined)
  const getDynamicModels = vi.fn().mockResolvedValue([
    {
      id: 'gpt-image-2',
      name: 'GPT Image 2',
      providerId: 'openai',
      capabilities: {
        text2image: true,
        image2image: true,
        multiImage: true,
      },
      parameterDefinitions: [],
    },
  ])
  const refreshModels = vi.fn().mockResolvedValue(undefined)

  const services = ref({
    imageModelManager: {
      updateConfig,
    },
    imageService: {
      getDynamicModels,
    },
    imageAdapterRegistry: {
      supportsDynamicModels: vi.fn().mockReturnValue(true),
      getStaticModels: vi.fn().mockReturnValue([config.model]),
      getAdapter: vi.fn().mockReturnValue({
        getModels: vi.fn().mockReturnValue([config.model]),
        buildDefaultModel: vi.fn((modelId: string) => ({
          id: modelId,
          name: modelId,
          providerId: config.providerId,
          capabilities: {
            text2image: true,
            image2image: true,
          },
          parameterDefinitions: [],
        })),
      }),
    },
  })

  const wrapper = mount(ImageModelQuickSwitch, {
    props: {
      modelKey: config.id,
      options: [createOption(config)],
      refreshModels,
    },
    global: {
      provide: {
        services,
      },
      stubs: {
        NPopover: NPopoverStub,
        'n-popover': NPopoverStub,
        Popover: NPopoverStub,
        ModelIdSelector: NSelectStub,
        NSelect: NSelectStub,
        'n-select': NSelectStub,
        Select: NSelectStub,
        NSpace: simpleStub('NSpace'),
        'n-space': simpleStub('NSpace'),
        Space: simpleStub('NSpace'),
        NTag: simpleStub('NTag', 'span'),
        'n-tag': simpleStub('NTag', 'span'),
        Tag: simpleStub('NTag', 'span'),
        NText: simpleStub('NText', 'span'),
        'n-text': simpleStub('NText', 'span'),
        Text: simpleStub('NText', 'span'),
      },
    },
  })

  return {
    wrapper,
    updateConfig,
    getDynamicModels,
    refreshModels,
  }
}

describe('ImageModelQuickSwitch', () => {
  it('shows a compact model tag for the selected image model config', () => {
    const { wrapper } = mountComponent()

    expect(wrapper.text()).toContain('GPT Image 1')
    expect(wrapper.text()).not.toContain('OpenAI Image')
    expect(wrapper.get('.image-model-quick-switch__model').attributes('title')).toBe(
      'image.model.quickSwitch.modelTagTitle - OpenAI Image / GPT Image 1',
    )
  })

  it('fetches image models and updates only model identity on the selected config', async () => {
    const { wrapper, updateConfig, getDynamicModels, refreshModels } = mountComponent()

    await wrapper.get('[data-testid="image-quick-switch-trigger"]').trigger('click')
    await flushPromises()

    expect(getDynamicModels).toHaveBeenCalledWith('openai', expect.objectContaining({
      baseURL: 'https://api.example.com/v1',
    }))

    await wrapper.get('[data-testid="image-quick-switch-select"]').setValue('gpt-image-2')
    await flushPromises()

    expect(updateConfig).toHaveBeenCalledWith('image-config-1', {
      modelId: 'gpt-image-2',
      model: expect.objectContaining({
        id: 'gpt-image-2',
        name: 'GPT Image 2',
        providerId: 'openai',
      }),
    })
    expect(refreshModels).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('image.model.quickSwitch.updateSuccess:GPT Image 2')
  })
})
