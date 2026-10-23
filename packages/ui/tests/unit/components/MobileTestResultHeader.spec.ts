import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MobileTestResultHeader from '../../../src/components/common/MobileTestResultHeader.vue'
import TestSourcePreview from '../../../src/components/common/TestSourcePreview.vue'

vi.mock('../../../src/components/common/TestSourcePreview.vue', () => ({
  default: { name: 'TestSourcePreview', props: ['show', 'title', 'content', 'editable'], template: '<div />' },
}))

const variant = { id: 'b', sourceLabel: 'Workspace', running: false,
  promptContent: 'Request captured before editing\n'.repeat(50) + 'FINAL REQUEST LINE', hasPromptSnapshot: true }
const options = { props: { variant, busy: false }, global: { stubs: { TestSourcePreview: true } } }

describe('mobile comparison result header', () => {
  it('opens the complete prompt belonging to this result and runs only its own group', async () => {
    const wrapper = mount(MobileTestResultHeader, options)
    try {
      await wrapper.get('.mobile-result-prompt').trigger('click')
      const preview = wrapper.getComponent(TestSourcePreview)
      expect(preview.props('show')).toBe(true)
      expect(preview.props('content')).toBe(variant.promptContent)
      expect(preview.props('title')).toContain('B · Prompt used for this answer')
      expect(preview.props('editable')).toBe(false)
      preview.vm.$emit('update:show', false)
      await wrapper.vm.$nextTick()
      expect(preview.props('show')).toBe(false)
      await wrapper.get('[data-testid="mobile-result-run-b"]').trigger('click')
      expect(wrapper.emitted('run')).toHaveLength(1)
    } finally { wrapper.unmount() }
  })

  it('guards runs during other requests and for unsupported models', async () => {
    const wrapper = mount(MobileTestResultHeader, options)
    try {
      await wrapper.setProps({ busy: true })
      expect(wrapper.get('[data-testid="mobile-result-run-b"]').attributes('disabled')).toBeDefined()
      await wrapper.setProps({ busy: false, variant: { ...variant, disabled: true } })
      expect(wrapper.get('[data-testid="mobile-result-run-b"]').attributes('disabled')).toBeDefined()
      await wrapper.setProps({ variant: { ...variant, promptContent: '', hasPromptSnapshot: false } })
      expect(wrapper.get('.mobile-result-prompt').attributes('disabled')).toBeDefined()
      expect(wrapper.getComponent(TestSourcePreview).props('title')).toContain('Current prompt reference')
    } finally { wrapper.unmount() }
  })
})
