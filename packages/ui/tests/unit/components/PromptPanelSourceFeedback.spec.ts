import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
const confirm = vi.hoisted(() => vi.fn(async () => false))
vi.mock('../../../src/composables/ui/useConfirmDialog', () => ({ useConfirmDialog: () => ({ warning: confirm }) }))

import { NSelect } from 'naive-ui'
import PromptPanel from '../../../src/components/PromptPanel.vue'
import OutputDisplay from '../../../src/components/OutputDisplay.vue'

const versions = [
  {
    id: 'record-v1',
    version: 1,
    originalPrompt: 'original prompt',
    optimizedPrompt: 'version one',
  },
  {
    id: 'record-v2',
    version: 2,
    originalPrompt: 'original prompt',
    optimizedPrompt: 'version two',
  },
]

const mountPromptPanel = (props: Record<string, unknown>) =>
  mount(PromptPanel, {
    props: {
      optimizedPrompt: 'version two',
      originalPrompt: 'original prompt',
      reasoning: '',
      optimizationMode: 'system',
      versions,
      currentVersionId: 'record-v2',
      ...props,
    },
    global: {
      stubs: {
        OutputDisplay: { props: ['placeholder'], template: '<div />', methods: { forceRefreshContent() {}, forceExitEditing() {} } },
        Modal: true,
        TemplateSelect: true,
        EvaluationScoreBadge: true,
        FocusAnalyzeButton: true,
        AnalyzeActionIcon: true,
      },
    },
  })

describe('PromptPanel source feedback', () => {
  beforeEach(() => { confirm.mockReset(); confirm.mockResolvedValue(false) })

  it('highlights the resolved saved version tag', () => {
    const wrapper = mountPromptPanel({
      sourceFeedbackKey: 4,
      sourceFeedbackTone: 'change',
      sourceFeedbackVersion: 1,
    })

    const versionTag = wrapper.get('[data-testid="prompt-panel-version-tag-v1"]')
    expect(versionTag.classes()).toContain('version-tag-clickable--source-change')
    expect(versionTag.attributes('data-source-feedback-tone')).toBe('change')
  })

  it('highlights the original version tag when the resolved version is v0', () => {
    const wrapper = mountPromptPanel({
      sourceFeedbackKey: 2,
      sourceFeedbackTone: 'error',
      sourceFeedbackVersion: 0,
    })

    const originalTag = wrapper.get('[data-testid="prompt-panel-version-tag-v0"]')
    expect(originalTag.classes()).toContain('version-tag-clickable--source-error')
    expect(originalTag.attributes('data-source-feedback-tone')).toBe('error')
  })
  it('preserves the existing desktop confirmation when changing a saved version', async () => {
    confirm.mockResolvedValueOnce(false)
    const wrapper = mountPromptPanel({ optimizedPrompt: 'unsaved desktop draft' })
    await wrapper.get('[data-testid="prompt-panel-version-tag-v1"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalled()
    expect(wrapper.emitted('switchToV0')).toBeUndefined()
    expect(wrapper.emitted('switchVersion')).toBeUndefined()
    expect(wrapper.emitted('update:optimizedPrompt')).toBeUndefined()
    wrapper.unmount()
  })

  it('preserves the desktop V0 action without adding the mobile draft confirmation', async () => {
    const wrapper = mountPromptPanel({ optimizedPrompt: 'unsaved desktop draft' })
    try {
      await wrapper.get('[data-testid="prompt-panel-version-tag-v0"]').trigger('click')
      await flushPromises()
      expect(confirm).not.toHaveBeenCalled()
      expect(wrapper.emitted('switchToV0')).toHaveLength(1)
      expect(wrapper.emitted('update:optimizedPrompt')).toEqual([['original prompt']])
    } finally { wrapper.unmount() }
  })

  it.each(['isOptimizing', 'isIterating'])('blocks mobile version changes during %s without changing desktop behavior', async (runningProp) => {
    const mobile = mountPromptPanel({ mobileLayout: true, [runningProp]: true })
    const desktop = mountPromptPanel({ [runningProp]: true })
    try {
      mobile.getComponent(NSelect).vm.$emit('update:value', 'record-v1')
      await desktop.get('[data-testid="prompt-panel-version-tag-v1"]').trigger('click')
      await flushPromises()
      expect(mobile.emitted('switchVersion')).toBeUndefined()
      expect(desktop.emitted('switchVersion')).toHaveLength(1)
      expect(confirm).not.toHaveBeenCalled()
    } finally { mobile.unmount(); desktop.unmount() }
  })

  it.each(['v0', 'record-v1'])('mobile version picker preserves dirty drafts and uses the existing confirmation for %s', async (id) => {
    const wrapper = mountPromptPanel({ mobileLayout: true, optimizedPrompt: 'unsaved draft' })
    try {
      expect(wrapper.find('.version-tags').exists()).toBe(false)
      confirm.mockResolvedValueOnce(false)
      wrapper.getComponent(NSelect).vm.$emit('update:value', id)
      await flushPromises()
      expect(wrapper.emitted('update:optimizedPrompt')).toBeUndefined()
      confirm.mockResolvedValueOnce(true)
      wrapper.getComponent(NSelect).vm.$emit('update:value', id)
      await flushPromises()
      expect(wrapper.emitted(id === 'v0' ? 'switchToV0' : 'switchVersion')).toBeTruthy()
    } finally { wrapper.unmount() }
  })

  it('keeps the mobile iteration status visible before the first response token', async () => {
    const wrapper = mountPromptPanel({ mobileLayout: true, isIterating: true, optimizedPrompt: '' })
    try {
      const pending = wrapper.get('[data-testid="prompt-panel-continue-optimize"]')
      expect(pending.attributes('disabled')).toBeDefined()
      expect(wrapper.getComponent(OutputDisplay).props('placeholder')).toBe(pending.text())
      await wrapper.setProps({ isIterating: false, optimizedPrompt: 'new version' })
      expect(wrapper.get('[data-testid="prompt-panel-continue-optimize"]').attributes('disabled')).toBeUndefined()
    } finally { wrapper.unmount() }
  })

  it('preserves the desktop empty iteration presentation', async () => {
    const wrapper = mountPromptPanel({ optimizedPrompt: '' })
    try {
      const placeholder = wrapper.getComponent(OutputDisplay).props('placeholder')
      await wrapper.setProps({ isIterating: true })
      expect(wrapper.find('[data-testid="prompt-panel-continue-optimize"]').exists()).toBe(false)
      expect(wrapper.getComponent(OutputDisplay).props('placeholder')).toBe(placeholder)
    } finally { wrapper.unmount() }
  })

})
