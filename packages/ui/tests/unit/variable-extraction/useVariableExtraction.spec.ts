import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope, shallowRef } from 'vue'
import type { AppServices } from '../../../src/types/services'
import type { VariableExtractionResponse } from '@prompt-optimizer/core'
import { useVariableExtraction } from '../../../src/composables/prompt/useVariableExtraction'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
vi.mock('../../../src/composables/ui/useToast', () => ({ useToast: () => toast }))
vi.mock('vue-i18n', async importOriginal => ({
  ...await importOriginal<typeof import('vue-i18n')>(), useI18n: () => ({ t: (key: string) => key }),
}))

const result: VariableExtractionResponse = { summary: 'Reusable destination', variables: [{
  name: 'destination', value: 'Paris', reason: 'Travel destination',
  position: { originalText: 'Paris', occurrence: 2 },
}] }
function setup(extract = vi.fn().mockResolvedValue(result)) {
  const state = { prompt: 'Paris versus Paris', names: [] as string[] }
  const created = vi.fn()
  const replaced = vi.fn((prompt: string) => { state.prompt = prompt })
  const scope = effectScope()
  const api = scope.run(() => useVariableExtraction(
    shallowRef({ variableExtractionService: { extract } } as unknown as AppServices), created, replaced,
    { getCurrentPrompt: () => state.prompt, getExistingVariableNames: () => state.names },
  ))!
  return { api, state, created, replaced, extract, scope }
}
beforeEach(() => vi.clearAllMocks())

describe('variable extraction lifecycle', () => {
  it('uses the requested model and existing names, and only writes after confirmation', async () => {
    const { api, state, created, extract, scope } = setup()
    await api.extractVariables(state.prompt, 'selected-model', ['existing'])
    expect(extract).toHaveBeenCalledWith({ promptContent: state.prompt, extractionModelKey: 'selected-model', existingVariableNames: ['existing'] })
    expect(api.showResultDialog.value).toBe(true)
    expect(created).not.toHaveBeenCalled()
    api.confirmBatchCreate(result.variables)
    expect(created).toHaveBeenCalledWith('destination', 'Paris')
    expect(state.prompt).toBe('Paris versus {{destination}}')
    expect(api.showResultDialog.value).toBe(false)
    scope.stop()
  })

  it('cancellation leaves the prompt and variables unchanged', async () => {
    const { api, state, created, scope } = setup()
    await api.extractVariables(state.prompt, 'model')
    api.showResultDialog.value = false
    api.confirmBatchCreate(result.variables)
    expect(created).not.toHaveBeenCalled()
    expect(state.prompt).toBe('Paris versus Paris')
    scope.stop()
  })

  it('ignores duplicate requests and discards late results when the workspace is disposed', async () => {
    let resolve!: (value: VariableExtractionResponse) => void
    const { api, state, extract, created, scope } = setup(vi.fn(() => new Promise<VariableExtractionResponse>(done => { resolve = done })))
    const pending = api.extractVariables(state.prompt, 'model')
    await api.extractVariables(state.prompt, 'model')
    expect(api.isExtracting.value).toBe(true)
    expect(extract).toHaveBeenCalledTimes(1)
    scope.stop()
    resolve(result)
    await pending
    expect(api.isExtracting.value).toBe(false)
    expect(api.showResultDialog.value).toBe(false)
    expect(created).not.toHaveBeenCalled()
  })

  it.each(['prompt', 'variable'])('does not overwrite a %s changed before confirmation', async changed => {
    const { api, state, created, scope } = setup()
    await api.extractVariables(state.prompt, 'model')
    if (changed === 'prompt') state.prompt = 'New user edit'
    else state.names.push('DESTINATION')
    api.confirmBatchCreate(result.variables)
    expect(created).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledWith('evaluation.variableExtraction.staleResult')
    scope.stop()
  })

  it('discards a result if the source changed while the request was running', async () => {
    let resolve!: (value: VariableExtractionResponse) => void
    const { api, state, scope } = setup(vi.fn(() => new Promise<VariableExtractionResponse>(done => { resolve = done })))
    const pending = api.extractVariables(state.prompt, 'model')
    state.prompt = 'New edit'
    resolve(result)
    await pending
    expect(api.showResultDialog.value).toBe(false)
    expect(state.prompt).toBe('New edit')
    scope.stop()
  })

  it('clears busy state after failure and allows a successful retry', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { api, state, scope } = setup(vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(result))
    await api.extractVariables(state.prompt, 'model')
    expect(api.isExtracting.value).toBe(false)
    expect(toast.error).toHaveBeenCalledOnce()
    await api.extractVariables(state.prompt, 'model')
    expect(api.showResultDialog.value).toBe(true)
    scope.stop()
    log.mockRestore()
  })

  it('does not open a dialog or write state for an empty response', async () => {
    const { api, state, created, scope } = setup(vi.fn().mockResolvedValue({ summary: 'None', variables: [] }))
    await api.extractVariables(state.prompt, 'model')
    expect(api.showResultDialog.value).toBe(false)
    expect(created).not.toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith('evaluation.variableExtraction.noVariables')
    scope.stop()
  })
})
