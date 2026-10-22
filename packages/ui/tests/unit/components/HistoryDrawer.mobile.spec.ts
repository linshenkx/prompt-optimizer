import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import type { PromptRecord, PromptRecordChain } from '@prompt-optimizer/core'
import HistoryDrawer from '../../../src/components/HistoryDrawer.vue'
import { mobileManagementStubs } from './mobile-management-stubs'

const compact = ref(true)
vi.mock('../../../src/composables/ui/useWorkspaceLayout', () => ({
  useWorkspaceLayout: () => ({ isCompact: compact }),
}))
vi.mock('../../../src/composables/ui/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ warning: vi.fn().mockResolvedValue(true) }),
}))

const chain = (id: string, type: PromptRecord['type'] = 'optimize'): PromptRecordChain => {
  const root: PromptRecord = {
    id: `${id}-v1`, chainId: id, type, version: 1,
    originalPrompt: `${id} original`, optimizedPrompt: `${id} first answer`,
    modelKey: 'preview', templateId: 'template', timestamp: 100,
  }
  const current: PromptRecord = { ...root, id: `${id}-v2`, type: 'iterate', version: 2, timestamp: 200, optimizedPrompt: `${id} latest answer` }
  return { chainId: id, rootRecord: root, currentRecord: current, versions: [root, current] }
}
const mountHistory = (history: PromptRecordChain[]) => mount(HistoryDrawer, {
  props: { show: true, history }, global: { stubs: mobileManagementStubs },
})
beforeEach(() => { compact.value = true })

describe('HistoryDrawer mobile flow', () => {
  it('keeps the chain list mounted and restores the explicitly selected version with the original payload', async () => {
    const history = chain('poetry', 'contextUserOptimize')
    const wrapper = mountHistory([history])
    const list = wrapper.get('[data-testid="mobile-history-list"]').element
    await wrapper.get('.mobile-history-filters input').setValue('poetry')
    await wrapper.get('.mobile-history-open').trigger('click')
    expect(wrapper.emitted('reuse')).toBeUndefined()
    expect(wrapper.get('.mobile-history-body').text()).toBe('poetry latest answer')
    expect(wrapper.get('.mobile-history-restore').text()).toContain('Variable')

    await wrapper.get('.test-modal .test-modal select').setValue('poetry-v1')
    expect(wrapper.get('.mobile-history-body').text()).toBe('poetry first answer')
    await wrapper.get('.mobile-history-restore button').trigger('click')
    expect(wrapper.emitted('reuse')).toEqual([[{
      record: history.rootRecord, chainId: history.chainId,
      rootPrompt: history.rootRecord.originalPrompt, chain: history,
    }]])
    expect(wrapper.get('[data-testid="mobile-history-list"]').element).toBe(list)
    expect((wrapper.get('.mobile-history-filters input').element as HTMLInputElement).value).toBe('poetry')
    expect(wrapper.emitted('update:show')).toEqual([[false]])
    wrapper.unmount()
  })

  it('filters by all seven destinations and returns to the same list without applying a version', async () => {
    const wrapper = mountHistory([chain('poetry'), chain('pictures', 'multiimageOptimize')])
    const filter = wrapper.get('.mobile-history-filters select')
    expect(filter.findAll('option')).toHaveLength(8)
    await filter.setValue('multiimage')
    expect(wrapper.findAll('.mobile-history-open')).toHaveLength(1)
    await wrapper.get('.mobile-history-open').trigger('click')
    await wrapper.get('.test-modal .test-modal header button').trigger('click')
    expect(wrapper.find('[data-testid="mobile-history-detail"]').exists()).toBe(false)
    expect(wrapper.get('.mobile-history-open').text()).toContain('pictures')
    expect(wrapper.emitted('reuse')).toBeUndefined()
    wrapper.unmount()
  })

  it('keeps desktop version actions and emits the same reuse contract', async () => {
    compact.value = false
    const history = chain('desktop')
    const wrapper = mountHistory([history])
    expect(wrapper.find('[data-testid="mobile-history-list"]').exists()).toBe(false)
    const use = wrapper.findAll('button').find(button => button.text() === 'Use')!
    await use.trigger('click')
    expect(wrapper.emitted('reuse')?.[0]?.[0]).toMatchObject({ chainId: 'desktop', record: history.currentRecord })
    wrapper.unmount()
  })
})
