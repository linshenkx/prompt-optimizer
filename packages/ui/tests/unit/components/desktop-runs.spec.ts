import { describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DesktopRunsDrawer from '../../../src/components/desktop/DesktopRunsDrawer.vue'
import type { DesktopRun } from '@prompt-optimizer/core'

describe('saved MCP results drawer', () => {
  it('reopens a saved evaluation by ID without rendering model text as HTML', async () => {
    const run = { id: 'saved-run-fixture', kind: 'evaluate', status: 'succeeded', saved: true, createdAt: 1700000000000,
      updatedAt: 1700000000001, input: { request: { userPrompt: 'Synthetic input' } }, output: { score: { overall: 88 }, summary: '<img src=x onerror=alert(1)>' } } as DesktopRun
    const wrapper = mount(DesktopRunsDrawer, { props: { show: true, viewer: { list: async () => [run], get: async () => run, delete: async () => {} } } })
    await flushPromises()
    await wrapper.get('[data-testid="desktop-run-item"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="desktop-run-detail"]').text()).toContain('88')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain(run.id)
    wrapper.unmount()
  })
})
