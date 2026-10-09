import { describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useWorkspaceModelSelection } from '../../../src/composables/workspaces/useWorkspaceModelSelection'
import { useWorkspaceTextModelSelection } from '../../../src/composables/workspaces/useWorkspaceTextModelSelection'
import type { AppServices } from '../../../src/types/services'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
const model = { id: 'selected', name: 'Selected', enabled: true }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const createSelection = (mode: string) => {
  const getEnabledModels = vi.fn().mockResolvedValue([model])
  const services = ref<AppServices | null>({ modelManager: { getEnabledModels } } as unknown as AppServices)
  const session = reactive({
    selectedOptimizeModelKey: 'selected', selectedTestModelKey: 'selected', selectedTextModelKey: 'selected',
    updateOptimizeModel(key: string) { this.selectedOptimizeModelKey = key },
    updateTestModel(key: string) { this.selectedTestModelKey = key },
    updateTextModel(key: string) { this.selectedTextModelKey = key },
  })
  const selection = mode === 'pro' ? useWorkspaceModelSelection(services, session) : useWorkspaceTextModelSelection(services, session)
  return { getEnabledModels, services, session, selection }
}

describe.each(['pro', 'image'])('%s workspace model refresh', (mode) => {
  it('clears invalid selections when all models are removed and restores defaults when a model is added', async () => {
    const { selection, getEnabledModels, session } = createSelection(mode)
    await flushPromises()
    getEnabledModels.mockResolvedValue([])
    await selection.refreshTextModels()
    if (mode === 'image') expect(session.selectedTextModelKey).toBe('')
    else {
      expect(session.selectedOptimizeModelKey).toBe('')
      expect(session.selectedTestModelKey).toBe('')
    }
    getEnabledModels.mockResolvedValue([{ ...model, id: 'replacement' }])
    await selection.refreshTextModels()
    if (mode === 'image') expect(session.selectedTextModelKey).toBe('replacement')
    else {
      expect(session.selectedOptimizeModelKey).toBe('replacement')
      expect(session.selectedTestModelKey).toBe('replacement')
    }
  })

  it.each(['success', 'failure'])('ignores an older %s after the latest refresh succeeded', async (outcome) => {
    const { selection, getEnabledModels } = createSelection(mode)
    await flushPromises()
    const older = deferred<any[]>()
    getEnabledModels.mockReturnValueOnce(older.promise).mockResolvedValueOnce([model])
    const staleRefresh = selection.refreshTextModels()
    await flushPromises()
    await selection.refreshTextModels()
    if (outcome === 'success') older.resolve([{ ...model, id: 'obsolete' }])
    else older.reject(new Error('stale failure'))
    await staleRefresh
    expect(selection.textModelOptions.value.map(option => option.value)).toEqual(['selected'])
  })

  it('does not restore options from a pending request after services become unavailable', async () => {
    const { selection, getEnabledModels, services } = createSelection(mode)
    await flushPromises()
    const older = deferred<any[]>()
    getEnabledModels.mockReturnValueOnce(older.promise)
    const staleRefresh = selection.refreshTextModels()
    await flushPromises()
    services.value = null
    await flushPromises()
    older.resolve([model])
    await staleRefresh
    expect(selection.textModelOptions.value).toEqual([])
  })
})
