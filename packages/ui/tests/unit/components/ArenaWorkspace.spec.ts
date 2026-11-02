import { defineComponent, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createArenaState } from '@prompt-optimizer/core'
import ArenaWorkspace from '../../../src/components/arena-mode/ArenaWorkspace.vue'

const { current, toastError } = vi.hoisted(() => ({ current: { store: null as any }, toastError: vi.fn() }))
vi.mock('../../../src/stores/session/useArenaSession', () => ({ useArenaSession: () => current.store }))
vi.mock('../../../src/composables/ui/useToast', () => ({ useToast: () => ({ error: toastError }) }))
vi.mock('../../../src/composables/image/useImageInputPreparation', () => ({
  useImageInputPreparation: () => ({ prepareInputRefs: vi.fn() }),
}))
vi.mock('../../../src/components/arena-mode/useArenaModels', () => ({
  useArenaModels: () => ({
    textOptions: ref([]), selection: () => '', select: vi.fn(), compatible: () => true,
    imageGroups: () => [], loadImages: async () => [],
  }),
}))
vi.mock('vue-i18n', async importOriginal => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))

const Button = defineComponent({
  name: 'NButton', props: { disabled: Boolean, loading: Boolean }, emits: ['click'],
  template: '<button :disabled="disabled" :data-loading="loading" @click="$emit(\'click\')"><slot name="icon" /><slot /></button>',
})
const Output = defineComponent({
  name: 'OutputDisplay',
  props: { content: String, outputRecord: Object, loading: Boolean, streaming: Boolean, enableStop: Boolean, reasoningMode: String },
  template: '<div class="shared-output" />',
})
const Input = defineComponent({
  name: 'TestInputSection', setup: () => ({ open: vi.fn() }),
  template: '<div><slot name="footer" :open-fullscreen="open" /></div>',
})
const render = () => mount(ArenaWorkspace, {
  global: { stubs: {
    NButton: Button, NCard: { template: '<div><slot /></div>' },
    NScrollbar: { template: '<div class="arena-scroll-container"><slot /></div>' },
    NText: { template: '<span><slot /></span>' }, NAlert: { template: '<div role="alert"><slot /></div>' },
    TextModelSelector: { template: '<button class="text-model-selector" />' },
    TestInputSection: Input, OutputDisplay: Output,
    AppPreviewImageGroup: { template: '<div><slot /></div>' }, ArenaImage: true,
  } },
})

describe('Arena shared workspace presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const state = reactive(createArenaState())
    state.prompt = 'Local task'
    state.contestants.forEach(column => { column.configKey = 'local'; column.modelId = 'local-model' })
    current.store = reactive({
      state, configurations: { image: [], text: [] }, saveError: '',
      get running() { return Object.values(state.results).some(result => result.status === 'running') },
      busy: (id: string) => state.results[id]?.status === 'running',
      cancellable: (id: string) => state.results[id]?.model.kind === 'text',
      isStale: () => false,
      refreshConfigs: vi.fn(async () => {}), saveSession: vi.fn(async () => {}),
      run: vi.fn(async () => {}), runAll: vi.fn(async () => {}),
      addContestant: vi.fn(), removeContestant: vi.fn(),
    })
  })

  const setResult = (kind: 'text' | 'image', status = 'running', error?: string) => {
    const column = current.store.state.contestants[0]
    column.kind = kind
    current.store.state.results[column.id] = {
      model: { ...column }, status, error, output: { result: error ? 'partial output' : '', reasoning: '' }, images: [],
    }
    return column.id
  }

  it('uses the existing result component for an untested column and runs its selected model', async () => {
    const wrapper = render()
    const outputs = wrapper.findAllComponents(Output)
    expect(outputs).toHaveLength(2)
    expect(outputs[0].props()).toMatchObject({ content: '', loading: false, streaming: false, reasoningMode: 'hide' })
    await wrapper.find('.column-run').trigger('click')
    expect(current.store.run).toHaveBeenCalledWith(current.store.state.contestants[0].id)
    wrapper.unmount()
  })

  it('keeps the run action loading while the shared result owns text-stream cancellation', () => {
    setResult('text')
    const wrapper = render()
    expect(wrapper.find('.column-run').attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent('.column-run').props('loading')).toBe(true)
    expect(wrapper.findComponent(Output).props()).toMatchObject({ loading: true, streaming: true, enableStop: true })
    wrapper.unmount()
  })

  it('shows the shared loading state for image generation without offering unsupported cancellation', () => {
    setResult('image')
    const wrapper = render()
    expect(wrapper.findComponent(Output).props()).toMatchObject({ loading: true, streaming: false, enableStop: false })
    expect(wrapper.findComponent('.column-run').props('loading')).toBe(true)
    wrapper.unmount()
  })

  it('keeps a failed column error and partial output visible through the same result component', () => {
    setResult('text', 'error', 'Local provider rejected the request')
    const wrapper = render()
    expect(wrapper.find('[role="alert"]').text()).toBe('Local provider rejected the request')
    expect(wrapper.findComponent(Output).props()).toMatchObject({ content: 'partial output', loading: false })
    wrapper.unmount()
  })

  it('uses the existing toast feedback for a failed model refresh', async () => {
    current.store.refreshConfigs.mockRejectedValueOnce(new Error('Local catalog unavailable'))
    const wrapper = render()
    await flushPromises()
    expect(toastError).toHaveBeenCalledWith('Local catalog unavailable')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
