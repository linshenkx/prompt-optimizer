import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, defineComponent, h } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { NInput, NCard } from 'naive-ui'
import ImageModelEditModal from '../../../src/components/ImageModelEditModal.vue'
import { allowConsole } from '../../utils/error-detection'

const state = vi.hoisted(() => ({ current: null as any, compact: null as any, createManager: vi.fn(), confirm: vi.fn(), realManager: null as any, useRealManager: false }))
vi.mock('@prompt-optimizer/core', () => ({ isRunningInElectron: () => false }))
vi.mock('../../../src/composables/model/useImageModelManager', () => ({
  useImageModelManager: () => { state.createManager(); return state.useRealManager ? state.realManager() : state.current },
}))
vi.mock('../../../src/composables/ui/useWorkspaceLayout', () => ({ useWorkspaceLayout: () => ({ isCompact: state.compact }) }))
vi.mock('../../../src/composables/ui/useConfirmDialog', () => ({ useConfirmDialog: () => ({ warning: state.confirm }) }))
vi.mock('naive-ui', async original => ({ ...await original<typeof import('naive-ui')>(), useDialog: () => ({ warning: vi.fn() }) }))
vi.mock('../../../src/composables/ui/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
const stubs = {
  AdaptiveModal: { name: 'AdaptiveModal', props: ['show'], template: '<section><slot name="header" /><slot /><slot name="action" /></section>' },
  NSpace: { template: '<div><slot /></div>' },
  NForm: { template: '<div><slot /></div>' }, NFormItem: { template: '<div><slot /></div>' },
  NInput: true, NInputNumber: true, NCheckbox: true, NSelect: true, NDivider: true,
  H4: { template: '<h4><slot /></h4>' }, NText: { template: '<span><slot /></span>' }, NTag: { template: '<span><slot /></span>' },
  Button: { props: ['disabled'], emits: ['click'], template: `<button :disabled="disabled" @click="$emit('click')"><slot /></button>` },
  ThemedTooltip: { template: '<span><slot /></span>' },
  ModelAdvancedSection: true, ProviderPillSelect: true, AppPreviewImage: true, ModelNetworkStatus: true,
}
const draft = () => ({
  id: 'image-a', name: 'Image A', providerId: 'openai', modelId: 'image-model-a', enabled: true,
  connectionConfig: { apiKey: 'preserved-key' }, paramOverrides: { quality: 'high' },
})
const createWrapper = async (compact = true) => {
  state.compact.value = compact
  const wrapper = shallowMount(ImageModelEditModal, { props: { show: false, configId: 'image-a' }, global: { renderStubDefaultSlot: true, stubs } })
  await wrapper.setProps({ show: true })
  await flushPromises()
  return wrapper
}
const close = async (wrapper: ReturnType<typeof shallowMount>) => {
  wrapper.findComponent({ name: 'AdaptiveModal' }).vm.$emit('update:show', false)
  await flushPromises()
}
const save = async (wrapper: ReturnType<typeof shallowMount>) => {
  await wrapper.find('[data-testid="image-model-save"]').trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  state.useRealManager = false
  state.compact = ref(true)
  state.confirm.mockResolvedValue(false)
  state.current = {
    providers: ref([{ id: 'openai', name: 'OpenAI', supportsDynamicModels: false, connectionSchema: { required: ['apiKey'], optional: [], fieldTypes: { apiKey: 'string' } } }]),
    configs: ref([draft()]), models: ref([{ id: 'image-model-a', capabilities: { text2image: true } }]),
    selectedProviderId: ref(''), selectedModelId: ref(''), configForm: ref(draft()),
    isLoadingModels: ref(false), isLoadingProviders: ref(false), isTestingConnection: ref(false), isSaving: ref(false),
    connectionStatus: ref(null), testResult: ref(null), modelLoadingStatus: ref(null),
    currentParameterDefinitions: ref([]), isConnectionConfigured: ref(true), canTestConnection: ref(true), canRefreshModels: ref(false),
    onProviderChange: vi.fn().mockResolvedValue(undefined), onConnectionConfigChange: vi.fn(), onModelChange: vi.fn(),
    testConnection: vi.fn().mockResolvedValue(undefined), refreshModels: vi.fn().mockResolvedValue(undefined), updateParamOverrides: vi.fn(),
    saveConfig: vi.fn().mockResolvedValue(true), loadConfigs: vi.fn().mockResolvedValue(undefined), loadProviders: vi.fn().mockResolvedValue(undefined),
  }
  state.current.selectedProvider = computed(() => state.current.providers.value[0])
  state.current.selectedModel = computed(() => state.current.models.value[0])
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('mobile image model editor draft lifecycle', () => {
  it('keeps provider and model search menus above the IME without changing desktop selection props', async () => {
    vi.stubGlobal('visualViewport', Object.assign(new EventTarget(), { offsetTop: 0, height: 299, scale: 1 }))
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 225, bottom: 257 } as DOMRect)
    const wrapper = await createWrapper()
    for (const id of ['image-model-provider-select', 'image-model-id-select']) {
      const select = wrapper.getComponent(`[data-testid="${id}"]`)
      select.vm.$emit('update:show', true)
      await flushPromises()
      expect(select.props('filterable')).toBe(true)
      expect(select.props('placement')).toBe('top-start')
      expect(select.props('menuProps').style['--n-height']).toBe('213px')
      select.vm.$emit('update:show', false)
      await flushPromises()
    }
    state.compact.value = false
    await flushPromises()
    const desktopModel = wrapper.getComponent('[data-testid="image-model-id-select"]')
    desktopModel.vm.$emit('update:show', true)
    await flushPromises()
    expect(desktopModel.props('menuProps')).toBeUndefined()
    expect(desktopModel.props('placement')).toBe('bottom-start')
    expect(state.current.configForm.value.modelId).toBe('image-model-a')
    wrapper.unmount()
  })

  it.each([true, false])('renders the real Naive card heading and keeps mobile back reachable (compact: %s)', async compact => {
    state.compact.value = compact
    // Use the real Card here: unlike a slot-only stub, its title prop takes
    // precedence over the header slot and can hide the mobile back button.
    const CardModal = defineComponent({
      props: ['title', 'show'],
      setup: (props, { slots }) => () => h(NCard, { title: props.title }, slots),
    })
    const wrapper = shallowMount(ImageModelEditModal, {
      props: { show: false, configId: 'image-a' },
      global: { renderStubDefaultSlot: true, stubs: { ...stubs, AdaptiveModal: CardModal, Card: false } },
    })
    await wrapper.setProps({ show: true })
    await flushPromises()
    const heading = wrapper.find('.n-card-header')
    expect(heading.exists()).toBe(true)
    expect(heading.find('.image-model-editor-heading').exists()).toBe(compact)
    if (compact) {
      await heading.find('button').trigger('click')
      await flushPromises()
      expect(wrapper.emitted('update:show')).toEqual([[false]])
    } else {
      expect(heading.text()).toBe('Edit')
    }
    wrapper.unmount()
  })

  it('loads once and preserves an edited draft and test result through width changes', async () => {
    const wrapper = await createWrapper()
    wrapper.findComponent(NInput).vm.$emit('update:value', 'Edited on phone')
    state.current.testResult.value = { success: true, image: { b64: 'preview' } }
    state.current.connectionStatus.value = { type: 'success', messageKey: 'image.connection.testSuccess' }
    state.compact.value = false
    await flushPromises()
    state.compact.value = true
    await flushPromises()
    expect(state.createManager).toHaveBeenCalledOnce()
    expect(state.current.loadProviders).toHaveBeenCalledOnce()
    expect(state.current.loadConfigs).toHaveBeenCalledOnce()
    expect(state.current.configForm.value.name).toBe('Edited on phone')
    expect(state.current.configForm.value.connectionConfig.apiKey).toBe('preserved-key')
    expect(state.current.testResult.value.image.b64).toBe('preview')
    expect(state.current.testConnection).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not restore a closed draft when its delayed load completes', async () => {
    let finish!: () => void
    state.current.loadConfigs.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    const wrapper = shallowMount(ImageModelEditModal, { props: { show: false, configId: 'image-a' }, global: { renderStubDefaultSlot: true, stubs } })
    await wrapper.setProps({ show: true })
    await flushPromises()
    await close(wrapper)
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    finish()
    await flushPromises()
    expect(state.current.configForm.value.name).toBe('')
    expect(state.current.onProviderChange).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('keeps mobile edits on cancelled back, then discards only after confirmation', async () => {
    const wrapper = await createWrapper()
    wrapper.findComponent(NInput).vm.$emit('update:value', 'Unsaved')
    await close(wrapper)
    expect(state.confirm).toHaveBeenCalledOnce()
    expect(wrapper.emitted('update:show')).toBeUndefined()
    expect(state.current.configForm.value.name).toBe('Unsaved')
    state.confirm.mockResolvedValue(true)
    await close(wrapper)
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    expect(state.current.configForm.value.name).toBe('')
    wrapper.unmount()
  })

  it('keeps the desktop close behavior without introducing discard confirmation', async () => {
    const wrapper = await createWrapper(false)
    wrapper.findComponent(NInput).vm.$emit('update:value', 'Unsaved desktop')
    await close(wrapper)
    expect(state.confirm).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    wrapper.unmount()
  })

  it('retains the draft and inline failure after save rejects, then closes after a successful retry', async () => {
    allowConsole(/\[ImageModelEditModal\] Failed to save config/)
    const wrapper = await createWrapper()
    wrapper.findComponent(NInput).vm.$emit('update:value', 'Retryable draft')
    state.current.saveConfig.mockRejectedValueOnce(new Error('storage unavailable'))
    await save(wrapper)
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('update:show')).toBeUndefined()
    expect(state.current.configForm.value.name).toBe('Retryable draft')
    expect(wrapper.find('.image-model-editor-feedback').exists()).toBe(true)
    await save(wrapper)
    expect(state.current.saveConfig).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    expect(state.confirm).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})


describe('image model editor with the real save controller', () => {
  it('preserves a cloned configuration when its current mobile provider is reselected, but resets on an actual change', async () => {
    const actual = await vi.importActual<typeof import('../../../src/composables/model/useImageModelManager')>(
      '../../../src/composables/model/useImageModelManager',
    )
    state.realManager = () => { state.current = actual.useImageModelManager(); return state.current }
    state.useRealManager = true
    const providers = ['openai', 'gemini'].map(id => ({
      id, name: id, supportsDynamicModels: false, defaultBaseURL: `https://${id}.example/v1`,
      connectionSchema: { required: ['apiKey'], optional: ['baseURL'], fieldTypes: { apiKey: 'string', baseURL: 'string' } },
    }))
    const models = providers.map(provider => ({
      id: `${provider.id}-first`, providerId: provider.id, name: `${provider.name} first`,
      capabilities: { text2image: true }, parameterDefinitions: [], defaultParameterValues: { quality: 'standard' },
    }))
    const config = {
      ...draft(), modelId: 'custom-proxy/image',
      connectionConfig: { apiKey: 'preserved-key', baseURL: 'https://gateway.example/v1' },
    }
    const registry = {
      getAllProviders: () => providers,
      getStaticModels: (id: string) => models.filter(model => model.providerId === id),
      getAdapter: (id: string) => ({ buildDefaultModel: (modelId: string) => ({ ...models.find(model => model.providerId === id), id: modelId }) }),
      supportsDynamicModels: () => false,
    }
    const wrapper = shallowMount(ImageModelEditModal, {
      props: { show: false, initialConfig: { ...config, provider: providers[0], model: { ...models[0], id: config.modelId } } as any },
      global: {
        renderStubDefaultSlot: true, stubs,
        provide: { imageRegistry: registry, imageModelManager: { getAllConfigs: vi.fn().mockResolvedValue([]) }, imageService: {} },
      },
    })
    await wrapper.setProps({ show: true })
    await flushPromises()
    const original = JSON.parse(JSON.stringify(state.current.configForm.value))
    const select = wrapper.getComponent('[data-testid="image-model-provider-select"]')
    select.vm.$emit('update:value', 'openai', { label: 'OpenAI', value: 'openai' })
    await flushPromises()
    expect(state.current.configForm.value).toEqual(original)
    expect(wrapper.get('.image-model-editor-primary-actions button').attributes('disabled')).toBeUndefined()

    select.vm.$emit('update:value', 'gemini', { label: 'Gemini', value: 'gemini' })
    await flushPromises()
    expect(state.current.configForm.value).toMatchObject({
      name: config.name, providerId: 'gemini', modelId: 'gemini-first',
      connectionConfig: { apiKey: '', baseURL: 'https://gemini.example/v1' },
      paramOverrides: { quality: 'standard' },
    })
    wrapper.unmount()
  })

  it.each([
    { compact: true, editing: false },
    { compact: true, editing: true },
    { compact: false, editing: true },
  ])('retains a rejected storage draft and saves the same values on retry (%j)', async ({ compact, editing }) => {
    allowConsole(/Failed to save config:/)
    const actual = await vi.importActual<typeof import('../../../src/composables/model/useImageModelManager')>(
      '../../../src/composables/model/useImageModelManager',
    )
    state.realManager = actual.useImageModelManager
    state.useRealManager = true
    state.compact.value = compact
    const provider = {
      id: 'openai', name: 'OpenAI', supportsDynamicModels: false,
      connectionSchema: { required: ['apiKey'], optional: [], fieldTypes: { apiKey: 'string' } },
    }
    const model = {
      id: 'image-model-a', providerId: 'openai', name: 'Image model A',
      capabilities: { text2image: true }, parameterDefinitions: [], defaultParameterValues: {},
    }
    const persist = vi.fn().mockRejectedValueOnce(new Error('storage unavailable')).mockResolvedValue(undefined)
    const manager = {
      getAllConfigs: vi.fn().mockResolvedValue([draft()]),
      addConfig: editing ? vi.fn() : persist,
      updateConfig: editing ? persist : vi.fn(),
    }
    const registry = {
      getAllProviders: () => [provider], getStaticModels: () => [model],
      getAdapter: () => ({ buildDefaultModel: () => model }), supportsDynamicModels: () => false,
    }
    const wrapper = shallowMount(ImageModelEditModal, {
      props: { show: false, ...(editing ? { configId: 'image-a' } : { initialConfig: { ...draft(), provider, model } as any }) },
      global: {
        renderStubDefaultSlot: true, stubs,
        provide: { imageRegistry: registry, imageModelManager: manager, imageService: {} },
      },
    })
    const submit = async () => {
      await wrapper.find('form').trigger('submit')
      await flushPromises()
    }
    await wrapper.setProps({ show: true })
    await flushPromises()
    wrapper.findComponent(NInput).vm.$emit('update:value', 'Storage retry draft')
    await submit()
    expect(persist).toHaveBeenCalledOnce()
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('update:show')).toBeUndefined()
    expect(wrapper.findComponent(NInput).props('value')).toBe('Storage retry draft')
    if (compact) expect(wrapper.find('.image-model-editor-feedback').exists()).toBe(true)
    if (compact) expect(wrapper.find('[data-testid="image-model-save"]').attributes('disabled')).toBeUndefined()

    await submit()
    expect(persist).toHaveBeenCalledTimes(2)
    const submitted = persist.mock.calls[1][editing ? 1 : 0]
    expect(submitted.name).toBe('Storage retry draft')
    expect(submitted.connectionConfig).toEqual({ apiKey: 'preserved-key' })
    expect(submitted.paramOverrides).toEqual({ quality: 'high' })
    expect(wrapper.emitted('saved')).toEqual([[]])
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    wrapper.unmount()
  })
})
