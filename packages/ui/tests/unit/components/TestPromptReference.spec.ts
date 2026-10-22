import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import TestPromptReference from '../../../src/components/common/TestPromptReference.vue'

describe('prompt reference', () => {
  it('expands the complete snapshot without losing content and retains each variant expansion', async () => {
    const content = 'First line\n'.repeat(60) + 'FINAL LINE'
    const wrapper = mount(TestPromptReference, { props: { content, snapshot: true, variant: 'a' } })
    try {
      expect(wrapper.get('pre').text()).toContain('FINAL LINE')
      expect(wrapper.get('button').attributes('aria-expanded')).toBe('false')
      await wrapper.get('button').trigger('click')
      expect(wrapper.get('pre').classes()).not.toContain('test-prompt-reference-excerpt')
      await wrapper.setProps({ content: 'B input', variant: 'b' })
      expect(wrapper.get('button').attributes('aria-expanded')).toBe('false')
      expect(wrapper.get('pre').text()).toBe('B input')
      await wrapper.setProps({ content, variant: 'a' })
      expect(wrapper.get('button').attributes('aria-expanded')).toBe('true')
    } finally { wrapper.unmount() }
  })
})
