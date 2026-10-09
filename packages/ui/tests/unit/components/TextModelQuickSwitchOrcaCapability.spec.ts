import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'

import TextModelQuickSwitch from '../../../src/components/TextModelQuickSwitch.vue'
import type { ModelSelectOption } from '../../../src/types/select-options'
import type { TextModelConfig } from '@prompt-optimizer/core'

const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => toast,
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const NPopoverStub = defineComponent({
  name: 'NPopover',
  props: { show: { type: Boolean, default: false } },
  emits: ['update:show'],
  setup(_, { slots, emit }) {
    return () =>
      h('div', { class: 'n-popover-stub' }, [
        h(
          'button',
          { type: 'button', 'data-testid': 'quick-switch-trigger', onClick: () => emit('update:show', true) },
          slots.trigger?.()
        ),
        h('div', { class: 'n-popover-content' }, slots.default?.()),
      ])
  },
})

const NSelectStub = defineComponent({
  name: 'NSelect',
  props: { value: { type: [String, Number], default: '' }, options: { type: Array, default: () => [] } },
  emits: ['update:value'],
  setup(props) {
    return () =>
      h(
        'select',
        { 'data-testid': 'quick-switch-select' },
        (props.options as Array<{ value: string; label: string }>).map((option) =>
          h('option', { value: option.value }, option.label)
        )
      )
  },
})

const simpleStub = (name: string, tag = 'div') =>
  defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { slots, attrs }) {
      return () => h(tag, attrs, slots.default?.())
    },
  })

function createConfig(providerId: string): TextModelConfig {
  return {
    id: 'config-1',
    name: 'OrcaRouter',
    enabled: true,
    providerMeta: {
      id: providerId,
      name: 'OrcaRouter - API',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.orcarouter.ai/v1',
      supportsDynamicModels: true,
    },
    modelMeta: {
      id: 'deepseek/deepseek-v4-pro',
      name: 'DeepSeek V4 Pro',
      providerId,
      capabilities: { supportsTools: true },
      parameterDefinitions: [],
    },
    connectionConfig: { apiKey: 'sk-orca-fake', baseURL: 'https://api.orcarouter.ai/v1' },
  } as TextModelConfig
}

const createOption = (config: TextModelConfig): ModelSelectOption => ({
  primary: config.name,
  secondary: config.providerMeta.name,
  value: config.id,
  raw: config,
})

/** Chat-capable and multimodal-capable options, as discovery would return. */
function mountQuickSwitch(options: {
  requiresImageInput?: boolean
  fetched?: Array<{ value: string; label: string }>
  staticModels?: Array<{ id: string; name: string }>
}) {
  const config = createConfig('orcarouter')
  const fetchModelList = vi.fn(async () => options.fetched ?? [])

  const services = {
    modelManager: { updateModel: vi.fn() },
    llmService: { fetchModelList },
    textAdapterRegistry: {
      getAdapter: vi.fn(() => ({
        getProvider: () => config.providerMeta,
        getModels: () => options.staticModels ?? [],
        buildDefaultModel: (id: string) => ({
          id,
          name: id,
          providerId: 'orcarouter',
          capabilities: { supportsTools: true },
          parameterDefinitions: [],
        }),
      })),
      getStaticModels: () => options.staticModels ?? [],
    },
  }

  const wrapper = mount(TextModelQuickSwitch, {
    props: {
      modelKey: config.id,
      options: [createOption(config)],
      requiresImageInput: options.requiresImageInput ?? false,
    },
    global: {
      provide: { services: ref(services) },
      stubs: {
        // naive-ui registers both `NPopover` and the bare `Popover` alias in
        // this environment, so both names must be stubbed.
        NPopover: NPopoverStub,
        'n-popover': NPopoverStub,
        Popover: NPopoverStub,
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

  return { wrapper, fetchModelList, config }
}

describe('TextModelQuickSwitch capability filtering', () => {
  it('requests the chat catalog for a text-only entry point', async () => {
    const { wrapper, fetchModelList } = mountQuickSwitch({
      fetched: [
        { value: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
        { value: 'deepseek/deepseek-v4-flash-vision-exp', label: 'V4 Flash Vision' },
      ],
    })

    await wrapper.get('[data-testid="quick-switch-trigger"]').trigger('click')
    await flushPromises()

    expect(fetchModelList).toHaveBeenCalledTimes(1)
    // No capability requirement for a plain text entry point.
    expect(fetchModelList.mock.calls[0][2]).toBeUndefined()

    const rendered = Array.from(
      wrapper.element.querySelectorAll('[data-testid="quick-switch-select"] option')
    ).map((option) => (option as HTMLOptionElement).value)
    expect(rendered).toEqual([
      'deepseek/deepseek-v4-pro',
      'deepseek/deepseek-v4-flash-vision-exp',
    ])
  })

  it('requests the image-understanding catalog when images are attached', async () => {
    const { wrapper, fetchModelList } = mountQuickSwitch({
      requiresImageInput: true,
      fetched: [{ value: 'deepseek/deepseek-v4-flash-vision-exp', label: 'V4 Flash Vision' }],
    })

    await wrapper.get('[data-testid="quick-switch-trigger"]').trigger('click')
    await flushPromises()

    expect(fetchModelList.mock.calls[0][2]).toEqual({
      capability: 'image-understanding',
      requiredInputModalities: ['image'],
    })
  })

  it('binds only the filtered options to the selector', async () => {
    const { wrapper } = mountQuickSwitch({
      requiresImageInput: true,
      fetched: [{ value: 'deepseek/deepseek-v4-flash-vision-exp', label: 'V4 Flash Vision' }],
    })

    await wrapper.get('[data-testid="quick-switch-trigger"]').trigger('click')
    await flushPromises()

    const rendered = Array.from(
      wrapper.element.querySelectorAll('[data-testid="quick-switch-select"] option')
    ).map((option) => (option as HTMLOptionElement).value)

    expect(rendered).toEqual(['deepseek/deepseek-v4-flash-vision-exp'])
    // The text-only model is absent from the options actually passed down.
    expect(rendered).not.toContain('deepseek/deepseek-v4-pro')
  })

  it('does not re-add an incompatible current model when the filter narrows', async () => {
    const { wrapper } = mountQuickSwitch({
      requiresImageInput: true,
      // The live catalog returns only image-capable models.
      fetched: [{ value: 'deepseek/deepseek-v4-flash-vision-exp', label: 'V4 Flash Vision' }],
      staticModels: [{ id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro' }],
    })

    await wrapper.get('[data-testid="quick-switch-trigger"]').trigger('click')
    await flushPromises()

    const rendered = Array.from(
      wrapper.element.querySelectorAll('[data-testid="quick-switch-select"] option')
    ).map((option) => (option as HTMLOptionElement).value)

    // The currently-selected text-only model must not be silently preserved.
    expect(rendered).not.toContain('deepseek/deepseek-v4-pro')
  })

  it('recomputes the dropdown when the attachment requirement changes', async () => {
    const config = createConfig('orcarouter')
    const fetchModelList = vi.fn(async (_provider: string, _cfg: unknown, requirements?: unknown) =>
      requirements
        ? [{ value: 'deepseek/deepseek-v4-flash-vision-exp', label: 'V4 Flash Vision' }]
        : [
            { value: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
            { value: 'deepseek/deepseek-v4-flash-vision-exp', label: 'V4 Flash Vision' },
          ]
    )

    const services = {
      modelManager: { updateModel: vi.fn() },
      llmService: { fetchModelList },
      textAdapterRegistry: {
        getAdapter: vi.fn(() => ({
          getProvider: () => config.providerMeta,
          getModels: () => [],
          buildDefaultModel: (id: string) => ({
            id,
            name: id,
            providerId: 'orcarouter',
            capabilities: { supportsTools: true },
            parameterDefinitions: [],
          }),
        })),
        getStaticModels: () => [],
      },
    }

    const wrapper = mount(TextModelQuickSwitch, {
      props: {
        modelKey: config.id,
        options: [createOption(config)],
        requiresImageInput: false,
      },
      global: {
        provide: { services: ref(services) },
      stubs: {
        // naive-ui registers both `NPopover` and the bare `Popover` alias in
        // this environment, so both names must be stubbed.
        NPopover: NPopoverStub,
        'n-popover': NPopoverStub,
        Popover: NPopoverStub,
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

    await wrapper.get('[data-testid="quick-switch-trigger"]').trigger('click')
    await flushPromises()

    let rendered = Array.from(
      wrapper.element.querySelectorAll('[data-testid="quick-switch-select"] option')
    ).map((option) => (option as HTMLOptionElement).value)
    expect(rendered).toEqual([
      'deepseek/deepseek-v4-pro',
      'deepseek/deepseek-v4-flash-vision-exp',
    ])

    // Attaching an image recomputes the options actually offered.
    await wrapper.setProps({ requiresImageInput: true })
    await flushPromises()

    rendered = Array.from(
      wrapper.element.querySelectorAll('[data-testid="quick-switch-select"] option')
    ).map((option) => (option as HTMLOptionElement).value)
    expect(rendered).toEqual(['deepseek/deepseek-v4-flash-vision-exp'])
  })

  it('falls back to the verified seed when discovery fails', async () => {
    const config = createConfig('orcarouter')
    const fetchModelList = vi.fn(async () => {
      throw new Error('catalog offline')
    })

    const services = {
      modelManager: { updateModel: vi.fn() },
      llmService: { fetchModelList },
      textAdapterRegistry: {
        getAdapter: vi.fn(() => ({
          getProvider: () => config.providerMeta,
          getModels: () => [],
          buildDefaultModel: (id: string) => ({ id, name: id, providerId: 'orcarouter', capabilities: { supportsTools: true }, parameterDefinitions: [] }),
        })),
        getStaticModels: () => [
          { id: 'openai/gpt-5.5', name: 'OpenAI: GPT-5.5' },
          { id: 'orcarouter/auto', name: 'OrcaRouter: Auto' },
        ],
      },
    }

    const wrapper = mount(TextModelQuickSwitch, {
      props: { modelKey: config.id, options: [createOption(config)], requiresImageInput: false },
      global: {
        provide: { services: ref(services) },
      stubs: {
        // naive-ui registers both `NPopover` and the bare `Popover` alias in
        // this environment, so both names must be stubbed.
        NPopover: NPopoverStub,
        'n-popover': NPopoverStub,
        Popover: NPopoverStub,
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

    await wrapper.get('[data-testid="quick-switch-trigger"]').trigger('click')
    await flushPromises()

    const rendered = Array.from(
      wrapper.element.querySelectorAll('[data-testid="quick-switch-select"] option')
    ).map((option) => (option as HTMLOptionElement).value)

    // Still a real list built from the verified seed — never free text, never
    // an empty selector. The currently-selected model stays visible so the
    // user can see what is applied while the catalog is unreachable.
    expect(rendered).toContain('openai/gpt-5.5')
    expect(rendered).toContain('orcarouter/auto')
    expect(wrapper.text()).toContain('model.quickSwitch.fetchFailed')
  })

  it('fails closed when the live catalog holds no model for this entry point', async () => {
    const { wrapper } = mountQuickSwitch({
      requiresImageInput: false,
      // A live catalog that answered successfully but advertised nothing usable.
      fetched: [],
      staticModels: [{ id: 'openai/gpt-5.5', name: 'OpenAI: GPT-5.5' }],
    })

    await wrapper.get('[data-testid="quick-switch-trigger"]').trigger('click')
    await flushPromises()

    const rendered = Array.from(
      wrapper.element.querySelectorAll('[data-testid="quick-switch-select"] option')
    ).map((option) => (option as HTMLOptionElement).value)

    // The unadvertised seed must not be mixed into a successful live result.
    expect(rendered).toEqual([])
    expect(wrapper.find('[data-testid="quick-switch-capability-notice"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('model.quickSwitch.noCompatibleModel')
    // No free-text entry is offered either: the selector stays a real list.
    expect(wrapper.find('[data-testid="quick-switch-select"]').exists()).toBe(true)
  })

  it('fails closed rather than offering text-only models for an image attachment', async () => {
    const { wrapper } = mountQuickSwitch({
      requiresImageInput: true,
      // The catalog has nothing that declares image input.
      fetched: [],
      staticModels: [
        { id: 'openai/gpt-5.5', name: 'OpenAI: GPT-5.5' },
        { id: 'orcarouter/auto', name: 'OrcaRouter: Auto' },
      ],
    })

    await wrapper.get('[data-testid="quick-switch-trigger"]').trigger('click')
    await flushPromises()

    const rendered = Array.from(
      wrapper.element.querySelectorAll('[data-testid="quick-switch-select"] option')
    ).map((option) => (option as HTMLOptionElement).value)

    // The seed declares no image modality, so it must not be offered here.
    expect(rendered).toEqual([])
    expect(rendered).not.toContain('openai/gpt-5.5')
    expect(wrapper.text()).toContain('model.quickSwitch.noImageCapableModel')
  })

  it('fails closed for an image attachment when the catalog is unreachable', async () => {
    const config = createConfig('orcarouter')
    const fetchModelList = vi.fn(async () => {
      throw new Error('catalog is unavailable (Model catalog could not be reached)')
    })

    const services = {
      modelManager: { updateModel: vi.fn() },
      llmService: { fetchModelList },
      textAdapterRegistry: {
        getAdapter: vi.fn(() => ({
          getProvider: () => config.providerMeta,
          getModels: () => [],
          buildDefaultModel: (id: string) => ({
            id,
            name: id,
            providerId: 'orcarouter',
            capabilities: { supportsTools: true },
            parameterDefinitions: [],
          }),
        })),
        getStaticModels: () => [{ id: 'openai/gpt-5.5', name: 'OpenAI: GPT-5.5' }],
      },
    }

    const wrapper = mount(TextModelQuickSwitch, {
      props: {
        modelKey: config.id,
        options: [createOption(config)],
        requiresImageInput: true,
      },
      global: {
        provide: { services: ref(services) },
        stubs: {
          NPopover: NPopoverStub,
          'n-popover': NPopoverStub,
          Popover: NPopoverStub,
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

    await wrapper.get('[data-testid="quick-switch-trigger"]').trigger('click')
    await flushPromises()

    const rendered = Array.from(
      wrapper.element.querySelectorAll('[data-testid="quick-switch-select"] option')
    ).map((option) => (option as HTMLOptionElement).value)

    // The outage is reported, and no text-only model is presented as usable
    // with an attachment.
    expect(rendered).toEqual([])
    expect(wrapper.text()).toContain('model.quickSwitch.fetchFailed')
  })
})
