import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, provide, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { TextAdapterRegistry } from '@prompt-optimizer/core'
import TextModelEditModal from '../../../src/components/TextModelEditModal.vue'
import { useTextModelManager } from '../../../src/composables/model/useTextModelManager'
import { allowConsole } from '../../utils/error-detection'

const mocks = vi.hoisted(() => ({ warning: vi.fn(), error: vi.fn(), compact: { current: null as unknown } }))
vi.mock('../../../src/composables/ui/useWorkspaceLayout', () => ({
  useWorkspaceLayout: () => ({ isCompact: mocks.compact.current }),
}))
vi.mock('../../../src/composables/ui/useCompactModalBack', () => ({ useCompactModalBack: vi.fn() }))
vi.mock('../../../src/composables/ui/useToast', () => ({ useToast: () => ({ error: mocks.error }) }))
vi.mock('../../../src/composables/ui/useConfirmDialog', () => ({ useConfirmDialog: () => ({ warning: mocks.warning }) }))
vi.mock('naive-ui', async original => ({ ...await original<typeof import('naive-ui')>(), useDialog: () => ({ warning: vi.fn() }) }))

const Container = defineComponent({ template: '<div><slot name="header"/><slot/><slot name="action"/></div>' })
const FormItem = defineComponent({ template: '<div><slot name="label"/><slot/></div>' })
const Input = defineComponent({
  props: ['value'], emits: ['update:value'],
  template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
})
const Button = defineComponent({ props: ['disabled', 'loading'], template: '<button :disabled="disabled || loading"><slot/></button>' })
const Select = defineComponent({ props: ['value', 'options'], emits: ['update:value'], template: '<select :value="value"><slot/></select>' })
const editorStubs = {
  AdaptiveModal: Container, NModal: Container, NForm: Container, NFormItem: FormItem,
  NInput: Input, NInputNumber: Input, NButton: Button, NSelect: Select, ProviderPillSelect: Select,
  NSpace: Container, NFlex: Container, NCheckbox: true, NText: Container, NTag: Container,
  NH4: Container, NDivider: true, NAlert: Container, NSpin: true, NProgress: true,
  ModelAdvancedSection: true, ModelNetworkStatus: true, ThemedTooltip: Container,
}

function createManager() {
  const isTestingFormConnection = ref(false)
  const isSaving = ref(false)
  return {
    modalTitle: ref('Edit model'),
    form: ref({ name: 'Existing model', enabled: true, providerId: 'openai-compatible', modelId: 'model-a',
      connectionConfig: { apiKey: '********', baseURL: '/test/v1', customHeaders: [{ key: 'X-Tenant', value: 'tenant-a' }] },
      paramOverrides: { temperature: 0.6 }, originalApiKey: 'retained-secret', displayMaskedKey: true }),
    formReady: ref(true), editingModelId: ref('existing'), providerOptions: ref([{ label: 'Custom', value: 'openai-compatible' }]),
    isLoadingProviders: ref(false), connectionFields: ref([{ name: 'baseURL', type: 'string' }, { name: 'apiKey', type: 'string' }]),
    modelOptions: ref([{ label: 'Model A', value: 'model-a' }]), isLoadingModelOptions: ref(false),
    canRefreshModelOptions: ref(true), refreshModelOptions: vi.fn(), currentParameterDefinitions: ref([]),
    updateParamOverrides: vi.fn(), onModelChange: vi.fn(), currentProviderType: ref('openai-compatible'),
    formConnectionStatus: ref<{ type: string; message: string } | null>(null), testFormConnection: vi.fn(), isTestingFormConnection,
    canTestFormConnection: computed(() => !isTestingFormConnection.value), canSaveForm: ref(true), isSaving,
    isChromeBuiltInProvider: ref(false), chromeBuiltInStatus: ref(null), isCheckingChromeBuiltIn: ref(false),
    isPreparingChromeBuiltIn: ref(false), chromeBuiltInDownloadProgress: ref(null), refreshChromeBuiltInStatus: vi.fn(),
    prepareChromeBuiltInDownload: vi.fn(), selectedProvider: ref({ id: 'openai-compatible' }),
    selectProvider: vi.fn(), resetFormState: vi.fn(), saveForm: vi.fn().mockResolvedValue('existing'),
  }
}

function renderEditor() {
  const compact = ref(true)
  mocks.compact.current = compact
  const manager = createManager()
  const wrapper = mount(TextModelEditModal, {
    props: { show: true },
    global: {
      provide: { textModelManager: manager },
      stubs: editorStubs,
    },
  })
  return { wrapper, manager, compact }
}

beforeEach(() => { vi.clearAllMocks(); mocks.warning.mockResolvedValue(false) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('mobile text model editor draft lifecycle', () => {
  it('retains the real edit draft on mobile provider reselection and applies a different provider normally', async () => {
    mocks.compact.current = ref(true)
    const registry = new TextAdapterRegistry()
    const adapter = registry.getAdapter('openai-compatible')
    const existing = {
      id: 'qa-gateway', name: 'QA gateway', enabled: true,
      providerMeta: adapter.getProvider(), modelMeta: adapter.buildDefaultModel('custom-proxy/text'),
      connectionConfig: { apiKey: 'retained-test-secret', baseURL: 'https://gateway.example/v1', customHeaders: { 'X-Tenant': 'tenant-a' } },
      paramOverrides: { temperature: 0.6 },
    }
    let manager!: ReturnType<typeof useTextModelManager>
    const Harness = defineComponent({
      setup() {
        manager = useTextModelManager()
        provide('textModelManager', manager)
        return () => h(TextModelEditModal, { show: true })
      },
    })
    const wrapper = mount(Harness, {
      global: {
        stubs: editorStubs,
        provide: { services: ref({
          modelManager: { getModel: vi.fn().mockResolvedValue(existing) },
          llmService: {}, textAdapterRegistry: registry,
        }) },
      },
    })
    await manager.prepareForEdit(existing.id)
    await flushPromises()
    const original = JSON.parse(JSON.stringify(manager.form.value))
    const select = wrapper.getComponent('[data-testid="text-model-provider-select"]')
    select.vm.$emit('update:value', 'openai-compatible', { label: 'Custom', value: 'openai-compatible' })
    await flushPromises()
    expect(manager.form.value).toEqual(original)
    expect(wrapper.get('[data-testid="text-model-test"]').attributes('disabled')).toBeUndefined()

    select.vm.$emit('update:value', 'openai', { label: 'OpenAI', value: 'openai' })
    await flushPromises()
    expect(manager.form.value.name).toBe(existing.name)
    expect(manager.form.value.providerId).toBe('openai')
    expect(manager.form.value.modelId).toBe(registry.getStaticModels('openai')[0].id)
    expect(manager.form.value.connectionConfig.apiKey).toBe('')
    expect(manager.form.value.connectionConfig.baseURL).toBe(registry.getAdapter('openai').getProvider().defaultBaseURL)
    expect(manager.form.value.paramOverrides).not.toEqual(existing.paramOverrides)
    expect(wrapper.get('[data-testid="text-model-test"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('constrains both searchable pickers to the keyboard viewport and removes desktop constraints', async () => {
    vi.stubGlobal('visualViewport', Object.assign(new EventTarget(), { offsetTop: 0, height: 299, scale: 1 }))
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 225, bottom: 257 } as DOMRect)
    const { wrapper, manager, compact } = renderEditor()
    await flushPromises()
    for (const id of ['text-model-provider-select', 'text-model-id-select']) {
      const select = wrapper.getComponent(`[data-testid="${id}"]`)
      select.vm.$emit('update:show', true)
      await flushPromises()
      expect(select.props('filterable')).toBe(true)
      expect(select.props('placement')).toBe('top-start')
      expect(select.props('menuProps').style['--n-height']).toBe('213px')
      select.vm.$emit('update:show', false)
      await flushPromises()
    }
    compact.value = false
    await flushPromises()
    const desktopModel = wrapper.getComponent('[data-testid="text-model-id-select"]')
    desktopModel.vm.$emit('update:show', true)
    await flushPromises()
    expect(desktopModel.props('menuProps')).toBeUndefined()
    expect(desktopModel.props('placement')).toBe('bottom-start')
    expect(manager.form.value.modelId).toBe('model-a')
    expect(manager.resetFormState).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('keeps edits, secret masking and expanded headers through wide/narrow changes without running requests', async () => {
    const { wrapper, manager, compact } = renderEditor()
    await flushPromises()
    await wrapper.get('[data-testid="text-model-name"] input').setValue('Edited on phone')
    await wrapper.get('.mobile-text-model-disclosure').trigger('click')
    compact.value = false
    await nextTick()
    expect(wrapper.find('.mobile-text-model-footer').exists()).toBe(false)
    compact.value = true
    await nextTick()
    expect(wrapper.get('[data-testid="text-model-name"] input').element).toHaveProperty('value', 'Edited on phone')
    expect(wrapper.get('.mobile-text-model-disclosure').attributes('aria-expanded')).toBe('true')
    expect(manager.form.value.connectionConfig.apiKey).toBe('********')
    expect(manager.form.value.originalApiKey).toBe('retained-secret')
    expect(manager.form.value.connectionConfig.customHeaders).toEqual([{ key: 'X-Tenant', value: 'tenant-a' }])
    expect(manager.testFormConnection).not.toHaveBeenCalled()
    expect(manager.saveForm).not.toHaveBeenCalled()
    expect(manager.resetFormState).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('retains failed saves and surfaces the error until the user retries successfully', async () => {
    const { wrapper, manager } = renderEditor()
    await flushPromises()
    await wrapper.get('[data-testid="text-model-name"] input').setValue('Draft to retain')
    manager.saveForm.mockRejectedValueOnce(new Error('Temporary storage failure'))
    allowConsole(/Failed to save model:/)
    await wrapper.get('[data-testid="text-model-save"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Temporary storage failure')
    expect(manager.form.value.name).toBe('Draft to retain')
    expect(wrapper.emitted('update:show')).toBeUndefined()
    expect(manager.resetFormState).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="text-model-save"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('saved')).toEqual([['existing']])
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    wrapper.unmount()
  })

  it('allows continued editing on cancel and only resets after confirmed discard', async () => {
    const { wrapper, manager } = renderEditor()
    await flushPromises()
    await wrapper.get('[data-testid="text-model-name"] input').setValue('Unsaved edit')
    await wrapper.get('.mobile-text-model-heading button').trigger('click')
    await flushPromises()
    expect(mocks.warning).toHaveBeenCalledOnce()
    expect(wrapper.emitted('update:show')).toBeUndefined()
    expect(manager.form.value.name).toBe('Unsaved edit')
    mocks.warning.mockResolvedValueOnce(true)
    await wrapper.get('.mobile-text-model-heading button').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    expect(manager.resetFormState).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('does not close or duplicate a save when the layout changes during its request', async () => {
    const { wrapper, manager, compact } = renderEditor()
    await flushPromises()
    let finish!: () => void
    manager.saveForm.mockImplementationOnce(async () => {
      manager.isSaving.value = true
      await new Promise<void>(resolve => { finish = resolve })
      manager.isSaving.value = false
      return 'existing'
    })
    await wrapper.get('[data-testid="text-model-save"]').trigger('click')
    compact.value = false
    await nextTick()
    await wrapper.get('form').trigger('submit')
    expect(manager.saveForm).toHaveBeenCalledOnce()
    expect(wrapper.emitted('update:show')).toBeUndefined()
    finish()
    await flushPromises()
    expect(wrapper.emitted('saved')).toEqual([['existing']])
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    wrapper.unmount()
  })

  it('keeps one connection test active while resizing and displays its eventual result', async () => {
    const { wrapper, manager, compact } = renderEditor()
    await flushPromises()
    let finish!: () => void
    manager.testFormConnection.mockImplementationOnce(async () => {
      manager.isTestingFormConnection.value = true
      await new Promise<void>(resolve => { finish = resolve })
      manager.formConnectionStatus.value = { type: 'success', message: 'Connection succeeded' }
      manager.isTestingFormConnection.value = false
    })
    await wrapper.get('[data-testid="text-model-test"]').trigger('click')
    compact.value = false
    await nextTick()
    compact.value = true
    await nextTick()
    expect(wrapper.get('[data-testid="text-model-test"]').attributes('disabled')).toBeDefined()
    expect(manager.testFormConnection).toHaveBeenCalledOnce()
    finish()
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toBe('Connection succeeded')
    wrapper.unmount()
  })
})


describe('text model editor real modal header', () => {
  it('renders the mobile return action through the real Naive card header and preserves the desktop title', async () => {
    const compact = ref(true)
    mocks.compact.current = compact
    const manager = createManager()
    const host = document.createElement('div')
    const target = document.createElement('div')
    document.body.append(host, target)
    const wrapper = mount(TextModelEditModal, {
      attachTo: host,
      props: { show: true },
      attrs: { to: target },
      global: {
        provide: { textModelManager: manager },
        stubs: { Teleport: false, ModelAdvancedSection: true, ModelNetworkStatus: true },
      },
    })
    try {
      await flushPromises()
      const card = target.querySelector('.n-card')
      expect(card).not.toBeNull()
      expect(card?.classList.contains('text-model-editor--compact')).toBe(true)
      const back = card?.querySelector<HTMLButtonElement>('.n-card-header .mobile-text-model-heading button')
      expect(back).not.toBeNull()
      expect(back?.getAttribute('aria-label')).toBe('Close')
      expect(card?.querySelector('.n-card-header .n-base-close')).toBeNull()
      expect(card?.querySelector('.mobile-text-model-heading')?.textContent).toContain('Existing model')
      compact.value = false
      await nextTick()
      expect(card?.querySelector('.mobile-text-model-heading')).toBeNull()
      expect(card?.querySelector('.n-card-header__main')?.textContent).toBe('Edit model')
      expect(card?.querySelector('.n-card-header .n-base-close')).not.toBeNull()
      compact.value = true
      await nextTick()
      card?.querySelector<HTMLButtonElement>('.mobile-text-model-heading button')?.click()
      await flushPromises()
      expect(wrapper.emitted('update:show')).toEqual([[false]])
      expect(manager.resetFormState).toHaveBeenCalledOnce()
    } finally {
      wrapper.unmount()
      target.remove()
      host.remove()
    }
  })
})
