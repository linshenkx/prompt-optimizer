import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import { defineComponent, reactive, ref } from 'vue'
import type { LLMTokenUsage } from '@prompt-optimizer/core'
import OutputDisplay from '../../../src/components/OutputDisplay.vue'
import OutputDisplayCore from '../../../src/components/OutputDisplayCore.vue'
import { beginOutputStream, type OutputRecord } from '../../../src/utils/output-document'
import {
  clearOutputTokenUsage,
  getOutputTokenUsage,
  setOutputTokenUsage,
} from '../../../src/utils/token-usage'

vi.mock('../../../src/router', () => ({
  router: {
    currentRoute: {
      value: {
        path: '/basic/system',
      },
    },
  },
}))

vi.mock('../../../src/composables/ui/useClipboard', () => ({
  useClipboard: () => ({
    copyText: vi.fn(),
  }),
}))

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    warning: vi.fn(),
  }),
}))

vi.mock('../../../src/composables/variable/useTemporaryVariables', () => ({
  useTemporaryVariables: () => ({
    temporaryVariables: [],
    setVariable: vi.fn(),
  }),
}))

vi.mock('../../../src/composables/variable/useVariableAwareInputBridge', () => ({
  useVariableAwareInputBridge: () => ({
    variableInputData: [],
    handleVariableExtracted: vi.fn(),
    handleAddMissingVariable: vi.fn(),
  }),
}))

vi.mock('../../../src/composables/prompt/useVariableManager', () => ({
  useVariableManager: () => ({
    isReady: true,
    customVariables: [],
    allVariables: [],
    addVariable: vi.fn(),
  }),
}))

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    template: '<div><slot /><slot name="header" /><slot name="icon" /></div>',
  })

const ThemedTooltipStub = defineComponent({
  name: 'ThemedTooltip',
  props: ['placement', 'showArrow', 'padding'],
  template: '<div class="themed-tooltip-stub"><slot /><slot name="content" /></div>',
})

const createStubs = () => ({
  NButton: defineComponent({
    name: 'NButton',
    props: { disabled: Boolean },
    template: '<button :disabled="disabled"><slot name="icon" /><slot /></button>',
  }),
  NDropdown: passthroughStub('NDropdown'),
  NButtonGroup: passthroughStub('NButtonGroup'),
  NCard: passthroughStub('NCard'),
  NFlex: passthroughStub('NFlex'),
  NIcon: passthroughStub('NIcon'),
  NCollapse: passthroughStub('NCollapse'),
  NCollapseItem: passthroughStub('NCollapseItem'),
  NScrollbar: passthroughStub('NScrollbar'),
  NText: passthroughStub('NText'),
  NSpace: passthroughStub('NSpace'),
  NEmpty: passthroughStub('NEmpty'),
  ThemedTooltip: ThemedTooltipStub,
  NInput: defineComponent({
    props: { value: String, readonly: Boolean },
    template: '<textarea :value="value" :readonly="readonly" />',
  }),
  NSpin: passthroughStub('NSpin'),
  MarkdownRenderer: defineComponent({
    name: 'MarkdownRenderer',
    props: ['content', 'htmlPreviews', 'suspended', 'streaming'],
    template: '<section />',
  }),
  XmlRenderer: passthroughStub('XmlRenderer'),
  TextDiffUI: passthroughStub('TextDiffUI'),
  VariableAwareInput: passthroughStub('VariableAwareInput'),
})

const mountCore = (props: {
  content?: string
  tokenUsage?: LLMTokenUsage | null
  streaming?: boolean
  loading?: boolean
  outputRecord?: OutputRecord
  testId?: string
}) =>
  mount(OutputDisplayCore, {
    props: {
      content: 'Test result',
      mode: 'readonly',
      enabledActions: ['copy'],
      ...props,
    },
    global: {
      provide: {
        services: ref(null),
      },
      stubs: createStubs(),
    },
  })

describe('OutputDisplayCore token usage footer', () => {
  it('renders compact total tokens and tooltip breakdown when usage is present', () => {
    const wrapper = mountCore({
      testId: 'test-output-a',
      tokenUsage: {
        inputTokens: 1200,
        outputTokens: 50,
        cachedInputTokens: 300,
        totalTokens: 1250,
      },
    })

    const footer = wrapper.find('[data-testid="test-output-a-token-usage"]')
    expect(footer.exists()).toBe(true)
    expect(footer.find('.output-token-usage-pill').text()).toBe('1,250 tokens')

    const tooltip = footer.findComponent(ThemedTooltipStub)
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.props('placement')).toBe('top-end')
    expect(tooltip.props('showArrow')).toBe(false)

    const rows = footer.findAll('.output-token-usage-row').map((row) => ({
      label: row.find('.output-token-usage-label').text(),
      value: row.find('.output-token-usage-value').text(),
    }))
    expect(rows).toEqual([
      { label: 'Input', value: '1,200' },
      { label: 'Cached', value: '300' },
      { label: 'Output', value: '50' },
      { label: 'Total', value: '1,250' },
    ])
  })

  it('omits zero cached tokens and computes summary when totalTokens is null', () => {
    const wrapper = mountCore({
      tokenUsage: {
        inputTokens: 100,
        outputTokens: 68,
        cachedInputTokens: 0,
        totalTokens: null,
      },
    })

    const footer = wrapper.find('[data-testid="output-token-usage"]')
    expect(footer.exists()).toBe(true)
    expect(footer.find('.output-token-usage-pill').text()).toBe('168 tokens')

    const labels = footer.findAll('.output-token-usage-label').map((node) => node.text())
    expect(labels).toEqual(['Input', 'Output'])
  })

  it('falls back to a single available field when total cannot be derived', () => {
    const wrapper = mountCore({
      tokenUsage: {
        inputTokens: 42,
        outputTokens: null,
        cachedInputTokens: null,
        totalTokens: null,
      },
    })

    expect(wrapper.get('[data-testid="output-token-usage"] .output-token-usage-pill').text()).toBe('Input: 42')
  })

  it('stays hidden when usage is missing, invalid, streaming, loading, or failed/cancelled', () => {
    const usage: LLMTokenUsage = {
      inputTokens: 10,
      outputTokens: 20,
      cachedInputTokens: null,
      totalTokens: 30,
    }

    expect(mountCore({}).find('[data-testid="output-token-usage"]').exists()).toBe(false)
    expect(mountCore({ tokenUsage: null }).find('[data-testid="output-token-usage"]').exists()).toBe(false)
    expect(
      mountCore({
        tokenUsage: { inputTokens: null, outputTokens: null, cachedInputTokens: null, totalTokens: null },
      }).find('[data-testid="output-token-usage"]').exists(),
    ).toBe(false)
    expect(
      mountCore({
        tokenUsage: { inputTokens: -1, outputTokens: 1.5, cachedInputTokens: null, totalTokens: null },
      }).find('[data-testid="output-token-usage"]').exists(),
    ).toBe(false)
    expect(mountCore({ tokenUsage: usage, streaming: true }).find('[data-testid="output-token-usage"]').exists()).toBe(false)
    expect(mountCore({ tokenUsage: usage, loading: true }).find('[data-testid="output-token-usage"]').exists()).toBe(false)
    expect(
      mountCore({ tokenUsage: usage, outputRecord: { result: 'Partial', reasoning: '', status: 'failed' } })
        .find('[data-testid="output-token-usage"]').exists(),
    ).toBe(false)
    expect(
      mountCore({ tokenUsage: usage, outputRecord: { result: 'Partial', reasoning: '', status: 'cancelled' } })
        .find('[data-testid="output-token-usage"]').exists(),
    ).toBe(false)
    expect(
      mountCore({ tokenUsage: usage, outputRecord: { result: 'Partial', reasoning: '', status: 'capacity' } })
        .find('[data-testid="output-token-usage"]').exists(),
    ).toBe(false)

    const liveOutput: OutputRecord = { result: '', reasoning: '' }
    const stream = beginOutputStream(liveOutput)
    try {
      expect(
        mountCore({ tokenUsage: usage, outputRecord: liveOutput }).find('[data-testid="output-token-usage"]').exists(),
      ).toBe(false)
    } finally {
      stream.finish()
    }
  })

  it('forwards tokenUsage through OutputDisplay without affecting non-test callers', () => {
    const wrapper = mount(OutputDisplay, {
      props: {
        content: 'Wrapped result',
        mode: 'readonly',
        enableCopy: true,
        tokenUsage: {
          inputTokens: 15,
          outputTokens: 25,
          cachedInputTokens: null,
          totalTokens: 40,
        },
      },
      global: {
        provide: {
          services: ref({ compareService: {} }),
        },
        stubs: {
          ...createStubs(),
          OutputDisplayFullscreen: true,
        },
      },
    })

    expect(wrapper.get('[data-testid="output-token-usage"] .output-token-usage-pill').text()).toBe('40 tokens')
  })

  it('tracks ephemeral token usage per reactive record without mutating the record', async () => {
    const recordA = reactive<OutputRecord>({ result: 'A', reasoning: '', status: 'complete' })
    const recordB = reactive<OutputRecord>({ result: 'B', reasoning: '', status: 'complete' })

    const Harness = defineComponent({
      components: { OutputDisplayCore },
      setup() {
        return { recordA, recordB, getOutputTokenUsage }
      },
      template: `
        <div>
          <OutputDisplayCore
            test-id="col-a"
            mode="readonly"
            :content="recordA.result"
            :output-record="recordA"
            :token-usage="getOutputTokenUsage(recordA)"
          />
          <OutputDisplayCore
            test-id="col-b"
            mode="readonly"
            :content="recordB.result"
            :output-record="recordB"
            :token-usage="getOutputTokenUsage(recordB)"
          />
        </div>
      `,
    })

    const wrapper = mount(Harness, {
      global: {
        provide: { services: ref(null) },
        stubs: createStubs(),
      },
    })

    expect(wrapper.find('[data-testid="col-a-token-usage"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="col-b-token-usage"]').exists()).toBe(false)

    setOutputTokenUsage(recordA, {
      inputTokens: 10,
      outputTokens: 22,
      cachedInputTokens: null,
      totalTokens: 32,
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="col-a-token-usage"] .output-token-usage-pill').text()).toBe('32 tokens')
    expect(wrapper.find('[data-testid="col-b-token-usage"]').exists()).toBe(false)
    expect(Object.keys(recordA)).toEqual(['result', 'reasoning', 'status'])

    clearOutputTokenUsage(recordA)
    await flushPromises()
    expect(wrapper.find('[data-testid="col-a-token-usage"]').exists()).toBe(false)
  })
})
