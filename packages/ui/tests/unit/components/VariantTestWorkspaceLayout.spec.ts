import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import VariantTestWorkspaceLayout from '../../../src/components/common/VariantTestWorkspaceLayout.vue'

const variants = [
  { id: 'a' as const, sourceLabel: 'Original', modelLabel: 'Model A', running: false, promptContent: 'Original prompt', hasPromptSnapshot: true },
  { id: 'b' as const, sourceLabel: 'Workspace', modelLabel: 'Model B', running: false, promptContent: 'Original prompt', hasPromptSnapshot: true },
]

describe('shared mobile variant workspace', () => {
  it('keeps simultaneous results and drafts mounted without a group tab', async () => {
    const wrapper = mount(VariantTestWorkspaceLayout, {
      props: { compact: true, configExpanded: true, variants },
      slots: { results: '<article>saved image or text</article>', input: '<textarea />' },
    })
    try {
      const result = wrapper.get('article').element
      await wrapper.get('textarea').setValue('unfinished draft')
      await wrapper.get('[data-testid="mobile-config-run-all"]').trigger('click')
      expect(wrapper.emitted('run-all')).toHaveLength(1)
      await wrapper.setProps({ configExpanded: false })
      expect(wrapper.find('.compact-test-tabs').exists()).toBe(false)
      expect(wrapper.find('[data-testid="mobile-config-run-current"]').exists()).toBe(false)
      await wrapper.setProps({ configExpanded: true })
      expect(wrapper.get('article').element).toBe(result)
      expect(wrapper.get('textarea').element.value).toBe('unfinished draft')
      await wrapper.setProps({ variants: [variants[0]] })
      expect(wrapper.get('article').element).toBe(result)
    } finally { wrapper.unmount() }
  })

  it('disables run-all while a group runs and preserves the desktop controls', async () => {
    const wrapper = mount(VariantTestWorkspaceLayout, {
      props: { compact: true, configExpanded: false, variants: [{ ...variants[0], running: true }, variants[1]] },
    })
    try {
      expect(wrapper.get('[data-testid="mobile-config-run-all"]').attributes('disabled')).toBeDefined()
      await wrapper.setProps({ variants })
      expect(wrapper.get('[data-testid="mobile-config-run-all"]').attributes('disabled')).toBeUndefined()
      await wrapper.setProps({ compact: false, variants })
      expect(wrapper.find('.compact-test-tabs').exists()).toBe(false)
      expect(wrapper.find('[data-testid="mobile-config-run-all"]').exists()).toBe(false)
    } finally { wrapper.unmount() }
  })
})
