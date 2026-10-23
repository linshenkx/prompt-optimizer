import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { CompareService } from '@prompt-optimizer/core'
import OutputDisplayCore from '../../../src/components/OutputDisplayCore.vue'

const { copyTextMock, errorMock, currentRoute } = vi.hoisted(() => ({
  copyTextMock: vi.fn(),
  errorMock: vi.fn(),
  currentRoute: {
    value: {
      path: '/basic/system',
    },
  },
}))

vi.mock('../../../src/router', () => ({
  router: {
    currentRoute,
  },
}))

vi.mock('../../../src/composables/ui/useClipboard', () => ({
  useClipboard: () => ({
    copyText: copyTextMock,
  }),
}))

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => ({
    error: errorMock,
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

const NButtonStub = defineComponent({
  name: 'NButton',
  props: {
    disabled: Boolean,
  },
  emits: ['click'],
  template: `
    <button v-bind="$attrs" :disabled="disabled" @click="$emit('click', $event)">
      <slot name="icon" />
      <slot />
    </button>
  `,
})

const NDropdownStub = defineComponent({
  name: 'NDropdown',
  props: {
    options: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['select'],
  template: `
    <div>
      <slot />
      <button
        v-for="option in options"
        :key="option.key"
        :data-testid="'copy-action-option-' + option.key"
        @click="$emit('select', option.key)"
      >
        {{ option.label }}
      </button>
    </div>
  `,
})

const passthroughStub = (name: string) => defineComponent({
  name,
  template: '<div><slot /><slot name="header" /><slot name="icon" /></div>',
})

const mountOutputDisplayCore = (content = 'Optimized prompt') =>
  mount(OutputDisplayCore, {
    props: {
      content,
      mode: 'readonly',
      enabledActions: ['copy'],
    },
    global: {
      provide: {
        services: ref(null),
      },
      stubs: {
        NButton: NButtonStub,
        NDropdown: NDropdownStub,
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
        NInput: defineComponent({
          props: { value: String, readonly: Boolean },
          template: '<textarea :value="value" :readonly="readonly" />',
        }),
        NSpin: passthroughStub('NSpin'),
        MarkdownRenderer: passthroughStub('MarkdownRenderer'),
        XmlRenderer: passthroughStub('XmlRenderer'),
        TextDiffUI: passthroughStub('TextDiffUI'),
        VariableAwareInput: passthroughStub('VariableAwareInput'),
      },
    },
  })

const selectCopyAction = async (
  wrapper: ReturnType<typeof mountOutputDisplayCore>,
  actionId: string,
) => {
  const dropdownCandidates = [
    ...wrapper.findAllComponents(NDropdownStub),
    ...wrapper.findAllComponents({ name: 'NDropdown' }),
    ...wrapper.findAllComponents({ name: 'Dropdown' }),
  ]
  const dropdown = dropdownCandidates
    .find((component) => {
      const options = component.props('options') as Array<{ key: string }>
      return options.some((option) => option.key === actionId)
    })

  expect(dropdown, wrapper.html()).toBeTruthy()
  dropdown?.vm.$emit('select', actionId)
  await flushPromises()
}

describe('OutputDisplayCore copy and open action', () => {
  let openSpy: ReturnType<typeof vi.spyOn>
  let originalElectronAPI: unknown

  beforeEach(() => {
    copyTextMock.mockResolvedValue(undefined)
    errorMock.mockClear()
    window.sessionStorage.clear()
    currentRoute.value = { path: '/basic/system' }
    originalElectronAPI = window.electronAPI
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: originalElectronAPI,
    })
    vi.restoreAllMocks()
  })

  it('copies content by default without opening an AI platform', async () => {
    const wrapper = mountOutputDisplayCore('Hello platform')

    await wrapper.find('[data-testid="output-copy-action"]').trigger('click')
    await flushPromises()

    expect(copyTextMock).toHaveBeenCalledWith('Hello platform')
    expect(openSpy).not.toHaveBeenCalled()
    expect(wrapper.emitted('copy')).toEqual([[expect.any(String), 'content']])
  })

  it('shows the complete mobile read-only text as selectable page content, preserving literal markup', async () => {
    const content = `${'A long answer line\n'.repeat(100)}<b>Last line</b>`
    const wrapper = mountOutputDisplayCore(content)
    await wrapper.setProps({ fitContent: true })
    await selectCopyAction(wrapper, 'source')

    expect(wrapper.get('pre').element.textContent).toBe(content)
    expect(wrapper.find('pre b').exists()).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(false)
    await selectCopyAction(wrapper, 'copy')
    expect(copyTextMock).toHaveBeenLastCalledWith(content)

    await wrapper.setProps({ mode: 'editable' })
    expect(wrapper.find('pre').exists()).toBe(false)
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe(content)
    wrapper.unmount()
  })

  it('emits diff changes from the compact display menu without adding a tab row', async () => {
    const wrapper = mountOutputDisplayCore('new prompt')
    try {
      await wrapper.setProps({
        fitContent: true,
        originalContent: 'old prompt',
        enabledActions: ['copy', 'diff'],
        compareService: new CompareService(),
      })
      expect(wrapper.find('.output-view-modes').exists()).toBe(false)
      await selectCopyAction(wrapper, 'diff')
      expect(wrapper.emitted('view-change')?.at(-1)).toEqual(['diff'])
      await selectCopyAction(wrapper, 'source')
      expect(wrapper.emitted('view-change')?.at(-1)).toEqual(['base'])
    } finally { wrapper.unmount() }
  })

  it('retains copy and favorite actions in the mobile menu and restores desktop buttons', async () => {
    const wrapper = mountOutputDisplayCore('Useful answer')
    try {
      await wrapper.setProps({ fitContent: true, enabledActions: ['copy', 'favorite'] })
      expect(wrapper.find('[data-testid="output-compact-actions"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="output-copy-action"]').exists()).toBe(false)
      await selectCopyAction(wrapper, 'copy')
      expect(copyTextMock).toHaveBeenLastCalledWith('Useful answer')
      await selectCopyAction(wrapper, 'favorite')
      expect(wrapper.emitted('save-favorite')?.at(-1)?.[0]).toMatchObject({ content: 'Useful answer' })
      await wrapper.setProps({ fitContent: false })
      expect(wrapper.find('[data-testid="output-compact-actions"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="output-copy-action"]').exists()).toBe(true)
    } finally { wrapper.unmount() }
  })

  it('stores Claude selection and immediately opens Claude after copying', async () => {
    const wrapper = mountOutputDisplayCore('Ask with this')

    await selectCopyAction(wrapper, 'claude')
    await flushPromises()

    expect(window.sessionStorage.getItem('prompt-optimizer:copy-action:/basic/system')).toBe('claude')
    expect(copyTextMock).toHaveBeenCalledWith('Ask with this')
    expect(openSpy).toHaveBeenCalledWith(
      'https://claude.ai/new',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('stores copy selection and immediately copies without opening a platform', async () => {
    window.sessionStorage.setItem('prompt-optimizer:copy-action:/basic/system', 'claude')
    const wrapper = mountOutputDisplayCore('Copy only now')

    await selectCopyAction(wrapper, 'copy')
    await flushPromises()

    expect(window.sessionStorage.getItem('prompt-optimizer:copy-action:/basic/system')).toBe('copy')
    expect(copyTextMock).toHaveBeenCalledWith('Copy only now')
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('uses the desktop shell bridge instead of window.open when available', async () => {
    const openExternalMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: {
        shell: {
          openExternal: openExternalMock,
        },
      },
    })
    const wrapper = mountOutputDisplayCore('Desktop route')

    await selectCopyAction(wrapper, 'chatgpt')
    await flushPromises()

    expect(openExternalMock).toHaveBeenCalledWith('https://chatgpt.com/')
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('shows an error when the desktop shell bridge cannot open the selected platform', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const openExternalMock = vi.fn().mockRejectedValue(new Error('shell failed'))
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: {
        shell: {
          openExternal: openExternalMock,
        },
      },
    })
    const wrapper = mountOutputDisplayCore('Desktop failure')

    await selectCopyAction(wrapper, 'chatgpt')
    await flushPromises()

    expect(copyTextMock).toHaveBeenCalledWith('Desktop failure')
    expect(openExternalMock).toHaveBeenCalledWith('https://chatgpt.com/')
    expect(openSpy).not.toHaveBeenCalled()
    expect(errorMock).toHaveBeenCalledWith(expect.any(String))
    consoleErrorSpy.mockRestore()
  })

  it('keeps copy action selections isolated by workspace path', async () => {
    const firstWrapper = mountOutputDisplayCore('Workspace one')

    await selectCopyAction(firstWrapper, 'claude')
    firstWrapper.unmount()
    openSpy.mockClear()

    currentRoute.value = { path: '/pro/multi' }
    const secondWrapper = mountOutputDisplayCore('Workspace two')

    await secondWrapper.find('[data-testid="output-copy-action"]').trigger('click')
    await flushPromises()

    expect(window.sessionStorage.getItem('prompt-optimizer:copy-action:/basic/system')).toBe('claude')
    expect(window.sessionStorage.getItem('prompt-optimizer:copy-action:/pro/multi')).toBeNull()
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('falls back to copy when session storage contains an invalid action', async () => {
    window.sessionStorage.setItem('prompt-optimizer:copy-action:/basic/system', 'unknown-platform')
    const wrapper = mountOutputDisplayCore('Invalid storage')

    await wrapper.find('[data-testid="output-copy-action"]').trigger('click')
    await flushPromises()

    expect(copyTextMock).toHaveBeenCalledWith('Invalid storage')
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('disables the primary copy action when there is no content', () => {
    const wrapper = mountOutputDisplayCore('')

    expect(wrapper.find('[data-testid="output-copy-action"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="output-copy-action-menu"]').attributes('disabled')).toBeDefined()
  })
})
