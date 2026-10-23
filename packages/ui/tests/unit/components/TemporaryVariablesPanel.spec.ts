import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

// Capture dialog options without relying on DOM rendering.
const dialogWarningSpy = vi.hoisted(() => vi.fn())

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  const { defineComponent, h } = await import('vue')

  // Component stubs for deterministic unit tests.
  const NInputStub = defineComponent({
    name: 'NInput',
    inheritAttrs: false,
    props: {
      value: { type: String, default: '' },
      type: { type: String, default: 'text' },
      disabled: { type: Boolean, default: false },
      placeholder: { type: String, default: '' },
      // Consume Naive-UI specific props so they don't become invalid DOM props.
      size: { type: String, default: '' },
      autosize: { type: [Boolean, Object], default: undefined },
      showCount: { type: Boolean, default: false },
    },
    emits: ['update:value', 'blur', 'keydown'],
    setup(props, { emit, attrs }) {
      const isTextarea = props.type === 'textarea'
      const onInput = (e: Event) => {
        emit('update:value', (e.target as HTMLInputElement).value)
      }
      const onBlur = () => emit('blur')
      const onKeydown = (e: KeyboardEvent) => emit('keydown', e)
      const commonProps = {
        ...attrs,
        'data-testid': 'ninput',
        value: props.value,
        disabled: props.disabled,
        placeholder: props.placeholder,
        onInput,
        onBlur,
        onKeydown,
      }
      return () => (isTextarea
        ? h('textarea', commonProps)
        : h('input', { ...commonProps, type: 'text' }))
    },
  })

  const NDropdownStub = defineComponent({
    name: 'NDropdown',
    props: {
      options: { type: Array, default: () => [] },
    },
    emits: ['select'],
    setup(props, { emit, slots }) {
      return () => h('div', {
        'data-testid': 'ndropdown',
      }, [
        slots.default?.(),
        ...(props.options as any[]).map((opt) => {
          const label = typeof opt?.label === 'string' ? opt.label : String(opt?.label ?? '')
          return h('button', {
            type: 'button',
            disabled: Boolean(opt?.disabled),
            'data-key': String(opt?.key),
            onClick: () => emit('select', opt?.key),
          }, label)
        }),
      ])
    },
  })

  const NTextStub = defineComponent({
    name: 'NText',
    setup(_props, { slots, attrs }) {
      return () => h('span', attrs, slots.default?.())
    },
  })

  const NCardStub = defineComponent({
    name: 'NCard',
    props: {
      title: { type: String, default: '' },
    },
    setup(props, { slots }) {
      return () => h('section', { 'data-testid': 'ncard' }, [
        props.title ? h('div', { 'data-testid': 'ncard-title' }, props.title) : null,
        slots['header-extra'] ? h('div', { 'data-testid': 'ncard-header-extra' }, slots['header-extra']()) : null,
        slots.default?.(),
      ])
    },
  })

  const NSpaceStub = defineComponent({
    name: 'NSpace',
    setup(_props, { slots, attrs }) {
      return () => h('div', attrs, slots.default?.())
    },
  })

  const NButtonStub = defineComponent({
    name: 'NButton',
    props: {
      disabled: { type: Boolean, default: false },
      loading: { type: Boolean, default: false },
    },
    setup(props, { slots, attrs }) {
      return () => h('button', {
        type: 'button',
        ...attrs,
        disabled: props.disabled,
        'data-loading': props.loading ? '1' : '0',
      }, slots.default?.())
    },
  })

  const NTagStub = defineComponent({
    name: 'NTag',
    setup(_props, { slots, attrs }) {
      return () => h('span', attrs, slots.default?.())
    },
  })

  const NIconStub = defineComponent({
    name: 'NIcon',
    setup(_props, { slots, attrs }) {
      return () => h('span', attrs, slots.default?.())
    },
  })

  const NFormItemStub = defineComponent({
    name: 'NFormItem',
    setup(_props, { slots, attrs }) {
      return () => h('div', attrs, slots.default?.())
    },
  })

  const NModalStub = defineComponent({
    name: 'NModal',
    props: {
      show: { type: Boolean, default: false },
    },
    emits: ['update:show'],
    setup(props, { slots, attrs }) {
      return () => h('div', attrs, props.show ? slots.default?.() : undefined)
    },
  })

  return {
    ...actual,
    NCard: NCardStub,
    NSpace: NSpaceStub,
    NButton: NButtonStub,
    NInput: NInputStub,
    NText: NTextStub,
    NTag: NTagStub,
    NDropdown: NDropdownStub,
    NModal: NModalStub,
    NFormItem: NFormItemStub,
    NIcon: NIconStub,
    useDialog: () => ({
      warning: dialogWarningSpy,
    }),
  }
})

import TemporaryVariablesPanel from '../../../src/components/variable/TemporaryVariablesPanel.vue'

const globalStubs = {
  FullscreenDialog: true,
}

function createPanelManagerFixture() {
  const showAddVariableDialog = ref(false)
  const newVariableName = ref('')
  const newVariableValue = ref('')
  const newVariableNameError = ref('')

  const tempVars = ref<Record<string, string>>({
    rules: 'abc',
  })

  const onSaveToGlobal = vi.fn()

  const sortedVariables = computed(() => Object.keys(tempVars.value))

  const getVariableSource = (name: string) => {
    if (name === 'rules') return 'test' as const
    return 'test' as const
  }

  const getVariableDisplayValue = (name: string) => tempVars.value[name] ?? ''
  const getVariablePlaceholder = (_name: string) => 'placeholder'
  const validateNewVariableName = () => true

  const handleVariableValueChange = (name: string, value: string) => {
    tempVars.value = { ...tempVars.value, [name]: value }
  }

  const renameVariable = vi.fn((oldName: string, nextName: string) => {
    if (!tempVars.value[oldName]) return false
    const value = tempVars.value[oldName]
    const next = nextName.trim()
    if (!next) return false

    const { [oldName]: _removed, ...rest } = tempVars.value
    tempVars.value = { ...rest, [next]: value }
    return true
  })

  const handleAddVariable = () => true

  const handleDeleteVariable = vi.fn((name: string) => {
    const { [name]: _removed, ...rest } = tempVars.value
    tempVars.value = rest
  })

  const handleClearAllVariables = vi.fn(() => {
    tempVars.value = {}
  })

  const handleSaveToGlobal = vi.fn((name: string) => {
    onSaveToGlobal(name)
  })

  return {
    manager: {
      showAddVariableDialog,
      newVariableName,
      newVariableValue,
      newVariableNameError,
      sortedVariables,
      getVariableSource,
      getVariableDisplayValue,
      getVariablePlaceholder,
      validateNewVariableName,
      handleVariableValueChange,
      renameVariable,
      handleAddVariable,
      handleDeleteVariable,
      handleClearAllVariables,
      handleSaveToGlobal,
    },
    tempVars,
    renameVariable,
    handleDeleteVariable,
    handleClearAllVariables,
    handleSaveToGlobal,
  }
}

describe('TemporaryVariablesPanel', () => {
  beforeEach(() => {
    dialogWarningSpy.mockReset()
  })

  it('双击变量名进入编辑态，Enter 提交会调用 renameVariable 并更新展示', async () => {
    const fixture = createPanelManagerFixture()
    const wrapper = mount(TemporaryVariablesPanel, {
      props: {
        manager: fixture.manager as any,
        disabled: false,
        showGenerateValues: false,
        isGenerating: false,
      },
      global: {
        stubs: globalStubs,
      },
    })

    expect(wrapper.text()).toContain('rules')

    // Double click the variable name text.
    const nameText = wrapper.findAll('span').find((n) => n.text() === 'rules')
    expect(nameText).toBeTruthy()
    await nameText!.trigger('dblclick')

    const input = wrapper.find('input[data-testid="ninput"]')
    expect(input.exists()).toBe(true)
    await input.setValue('renamed_var')
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()

    expect(fixture.renameVariable).toHaveBeenCalledWith('rules', 'renamed_var')
    expect(wrapper.text()).toContain('renamed_var')
  })

  it('Esc 取消变量名编辑，不触发 renameVariable', async () => {
    const fixture = createPanelManagerFixture()
    const wrapper = mount(TemporaryVariablesPanel, {
      props: {
        manager: fixture.manager as any,
        disabled: false,
      },
      global: {
        stubs: globalStubs,
      },
    })

    const nameText = wrapper.findAll('span').find((n) => n.text() === 'rules')
    expect(nameText).toBeTruthy()
    await nameText!.trigger('dblclick')

    const input = wrapper.find('input[data-testid="ninput"]')
    await input.setValue('x')
    await input.trigger('keydown', { key: 'Escape' })
    await nextTick()

    expect(fixture.renameVariable).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('rules')
  })

  it('失焦会提交变量名编辑（renameVariable 返回 true 时）', async () => {
    const fixture = createPanelManagerFixture()
    const wrapper = mount(TemporaryVariablesPanel, {
      props: {
        manager: fixture.manager as any,
        disabled: false,
      },
      global: {
        stubs: globalStubs,
      },
    })

    const nameText = wrapper.findAll('span').find((n) => n.text() === 'rules')
    expect(nameText).toBeTruthy()
    await nameText!.trigger('dblclick')

    const input = wrapper.find('input[data-testid="ninput"]')
    await input.setValue('blur_name')
    await input.trigger('blur')
    await nextTick()

    expect(fixture.renameVariable).toHaveBeenCalledWith('rules', 'blur_name')
    expect(wrapper.text()).toContain('blur_name')
  })

  it('头部“操作”选择清空会弹出确认对话框，并在确认后清空变量', async () => {
    const fixture = createPanelManagerFixture()
    const wrapper = mount(TemporaryVariablesPanel, {
      props: {
        manager: fixture.manager as any,
        disabled: false,
      },
      global: {
        stubs: globalStubs,
      },
    })

    const clearButton = wrapper.find('button[data-key="clear-all"]')
    expect(clearButton.exists()).toBe(true)
    await clearButton.trigger('click')
    await nextTick()

    expect(dialogWarningSpy).toHaveBeenCalledTimes(1)
    const opts = dialogWarningSpy.mock.calls[0]?.[0]
    expect(String(opts?.content)).toContain('temporary variables')
    expect(String(opts?.content)).toContain('1') // includes count
    expect(fixture.handleClearAllVariables).not.toHaveBeenCalled()

    // Simulate user confirming.
    opts?.onPositiveClick?.()
    await nextTick()

    expect(fixture.handleClearAllVariables).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).not.toContain('rules')
  })

  it('空态时只显示一次 No variables detected，不重复显示 0 个临时变量', () => {
    const fixture = createPanelManagerFixture()
    fixture.tempVars.value = {}

    const wrapper = mount(TemporaryVariablesPanel, {
      props: {
        manager: fixture.manager as any,
        disabled: false,
      },
      global: {
        stubs: globalStubs,
      },
    })

    expect(wrapper.text()).toContain('No variables detected')
    expect(wrapper.text()).not.toContain('0 temporary variables')
  })

  it('行内“更多”选择删除会调用 handleDeleteVariable', async () => {
    const fixture = createPanelManagerFixture()
    const wrapper = mount(TemporaryVariablesPanel, {
      props: {
        manager: fixture.manager as any,
        disabled: false,
      },
      global: {
        stubs: globalStubs,
      },
    })

    const deleteButtons = wrapper.findAll('button[data-key="delete"]')
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1)
    await deleteButtons[0].trigger('click')
    await nextTick()

    expect(fixture.handleDeleteVariable).toHaveBeenCalledWith('rules')
    expect(wrapper.text()).not.toContain('rules')
  })

  it('移动端空变量区保留添加入口，并沿用原有添加对话框', async () => {
    const fixture = createPanelManagerFixture()
    fixture.tempVars.value = {}
    const wrapper = mount(TemporaryVariablesPanel, {
      props: { manager: fixture.manager as any, compact: true },
      global: { stubs: globalStubs },
    })

    expect(wrapper.find('[data-testid="ncard"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('No variables detected')
    await wrapper.get('.compact-empty-variables button').trigger('click')
    expect(fixture.manager.showAddVariableDialog.value).toBe(true)

    fixture.manager.showAddVariableDialog.value = false
    fixture.tempVars.value = { rules: 'restored' }
    await nextTick()
    expect(wrapper.find('[data-testid="ncard"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('rules')
  })

  it('智能填充仅在移动端移入操作菜单，禁用状态仍阻止触发', async () => {
    const fixture = createPanelManagerFixture()
    const wrapper = mount(TemporaryVariablesPanel, {
      props: { manager: fixture.manager as any, showGenerateValues: true },
      global: { stubs: globalStubs },
    })

    // Desktop keeps the original direct action, with no duplicate menu item.
    expect(wrapper.find('button[data-key="generate-values"]').exists()).toBe(false)
    const desktopGenerate = wrapper.findAll('button').find(button => button.text() === 'Smart Fill Variable Values')
    expect(desktopGenerate).toBeTruthy()
    await desktopGenerate!.trigger('click')
    expect(wrapper.emitted('generate-values')).toHaveLength(1)

    await wrapper.setProps({ compact: true })
    const menuAction = wrapper.get('button[data-key="generate-values"]')
    await menuAction.trigger('click')
    expect(wrapper.emitted('generate-values')).toHaveLength(2)
    await wrapper.setProps({ isGenerating: true })
    expect(menuAction.attributes('disabled')).toBeDefined()
    await menuAction.trigger('click')
    expect(wrapper.emitted('generate-values')).toHaveLength(2)
  })
})
