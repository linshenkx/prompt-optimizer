import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { NButton, NRadioButton, NRadioGroup } from 'naive-ui'
import TestWorkspaceToolbar from '../../../src/components/TestWorkspaceToolbar.vue'
import TestVariantConfig from '../../../src/components/TestVariantConfig.vue'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe('shared test workspace controls', () => {
  it('keeps the column limit, batch-run action and mode-specific evaluation controls', async () => {
    const wrapper = mount(TestWorkspaceToolbar, {
      props: { count: 2, canUseFourColumns: false, runTestId: 'run-all' },
      slots: { comparison: '<button>Compare settings</button>', evaluation: '<button>Evaluate</button>' },
    })
    wrappers.push(wrapper)
    expect(wrapper.findAllComponents(NRadioButton)[2].props('disabled')).toBe(true)
    wrapper.findComponent(NRadioGroup).vm.$emit('update:value', 3)
    expect(wrapper.emitted('update:count')).toEqual([[3]])
    await wrapper.get('[data-testid="run-all"]').trigger('click')
    expect(wrapper.emitted('run')).toHaveLength(1)
    expect(wrapper.text()).toContain('Compare settings')
    expect(wrapper.text()).toContain('Evaluate')
    await wrapper.setProps({ running: true })
    expect(wrapper.findComponent(NButton).props('disabled')).toBe(true)
    expect(wrapper.findComponent(NRadioGroup).props('disabled')).toBe(true)
    await wrapper.setProps({ compact: true })
    expect(wrapper.find('[data-testid="run-all"]').exists()).toBe(false)
    expect(wrapper.findComponent(NRadioGroup).exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Compare settings')
  })

  const props = {
    label: 'A', version: 'workspace', modelKey: 'config/model',
    versionOptions: [{ value: 'workspace', label: 'Workspace', fullLabel: 'Workspace (v1)' }],
    versionTestId: 'version', modelTestId: 'model', runTestId: 'run',
  }
  const stubs = { TextModelSelector: true, TestPanelVersionSelect: true }

  it('delegates selection and preview events without changing a shared model configuration', async () => {
    const wrapper = mount(TestVariantConfig, { props, global: { stubs } })
    wrappers.push(wrapper)
    const selector = wrapper.findComponent({ name: 'TextModelSelector' })
    expect(selector.attributes('scope')).toBe('column')
    selector.vm.$emit('update:model-value', 'config/another-model')
    expect(wrapper.emitted('update:modelKey')).toEqual([['config/another-model']])
    wrapper.findComponent({ name: 'TestPanelVersionSelect' }).vm.$emit('update:value', 0)
    expect(wrapper.emitted('update:version')).toEqual([[0]])
    expect(wrapper.find('.test-variant-config__icon').exists()).toBe(false)
    wrapper.findComponent({ name: 'TestPanelVersionSelect' }).vm.$emit('preview')
    expect(wrapper.emitted('preview')).toHaveLength(1)
    await wrapper.get('[data-testid="run"]').trigger('click')
    expect(wrapper.emitted('run')).toHaveLength(1)
  })

  it('allows image capability rules to disable running while the model remains selectable', async () => {
    const wrapper = mount(TestVariantConfig, {
      props: { ...props, runDisabled: true, runTooltip: 'This model needs multiple image support' },
      global: { stubs }, slots: { model: '<button class="image-model">Choose image model</button><span>Capability warning</span>' },
    })
    wrappers.push(wrapper)
    expect(wrapper.findComponent({ name: 'TextModelSelector' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'TestPanelVersionSelect' }).props('disabled')).toBe(false)
    expect(wrapper.get('[data-testid="run"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.test-variant-config__run-trigger').attributes('title')).toContain('multiple image support')
    expect(wrapper.text()).toContain('Capability warning')
    await wrapper.setProps({ runDisabled: false })
    await wrapper.get('[data-testid="run"]').trigger('click')
    expect(wrapper.emitted('run')).toHaveLength(1)
  })
})
