import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { PromptRecord, PromptRecordChain } from '@prompt-optimizer/core'
import { useImageWorkspaceHistory } from '../../../src/composables/workspaces/useImageWorkspaceHistory'

const makeRecord = (fields: Partial<PromptRecord> = {}): PromptRecord => ({
  id: 'version', chainId: 'chain', version: 1, type: 'text2imageOptimize',
  originalPrompt: 'original', optimizedPrompt: 'edited', modelKey: 'old-model', templateId: 'old-template',
  timestamp: 1, ...fields,
})
const makeChain = (): PromptRecordChain => {
  const currentRecord = makeRecord()
  return { chainId: 'chain', currentRecord, rootRecord: currentRecord, versions: [currentRecord] }
}
const setup = () => {
  const history = ref({
    createNewChain: vi.fn(async (_record: unknown) => makeChain()),
    addIteration: vi.fn(async (_record: unknown) => makeChain()),
  })
  const currentChainId = ref('')
  const currentVersions = ref<PromptRecord[]>([])
  const currentVersionId = ref('')
  const edit = ref({ originalPrompt: 'original', optimizedPrompt: 'edited', modelKey: '', iterateTemplateId: '', optimizeTemplateId: '', metadata: undefined })
  const session = { chainId: '', updateOptimizedResult: vi.fn(), saveSession: vi.fn(async () => true) }
  const toast = { success: vi.fn(), warning: vi.fn(), error: vi.fn() }
  const notifyHistoryRefresh = vi.fn()
  const createRecordId = vi.fn(() => 'page-generated-id')
  const getLocalEdit = vi.fn(() => edit.value)
  const controller = useImageWorkspaceHistory({
    workspaceName: 'ImageText2ImageWorkspace', historyManager: () => history.value,
    currentChainId, currentVersions, currentVersionId, session,
    recordType: 'text2imageOptimize', createRecordId,
    getOptimizedPrompt: () => edit.value.optimizedPrompt, getLocalEdit,
    toast, t: key => key, notifyHistoryRefresh,
  })
  return { controller, history, currentChainId, currentVersions, currentVersionId, edit, session, toast, notifyHistoryRefresh, createRecordId, getLocalEdit }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

describe('useImageWorkspaceHistory', () => {
  it('uses current fallback selections without retaining an old session snapshot', async () => {
    const state = setup()
    await state.controller.handleSaveLocalEdit({})
    expect(state.history.value.createNewChain).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'page-generated-id', modelKey: 'local-edit', templateId: 'local-edit',
    }))
    state.currentChainId.value = ''
    state.currentVersions.value = []
    state.currentVersionId.value = ''
    state.edit.value = { ...state.edit.value, modelKey: 'fresh-model', optimizeTemplateId: 'fresh-optimize' }
    await state.controller.handleSaveLocalEdit({})
    expect(state.history.value.createNewChain).toHaveBeenLastCalledWith(expect.objectContaining({ modelKey: 'fresh-model', templateId: 'fresh-optimize' }))
    state.currentVersions.value = []
    state.edit.value.iterateTemplateId = 'fresh-iterate'
    await state.controller.handleSaveLocalEdit({})
    expect(state.history.value.addIteration).toHaveBeenLastCalledWith(expect.objectContaining({ modelKey: 'fresh-model', templateId: 'fresh-iterate' }))
    state.currentVersions.value = [makeRecord()]
    await state.controller.handleSaveLocalEdit({ note: 'keep me' })
    expect(state.history.value.addIteration).toHaveBeenLastCalledWith(expect.objectContaining({ modelKey: 'old-model', templateId: 'old-template', iterationNote: 'keep me' }))
    expect(state.createRecordId).toHaveBeenCalledTimes(2)
  })

  it('does not write empty text or invent a missing history service', async () => {
    const state = setup()
    state.edit.value.optimizedPrompt = ' \n '
    await state.controller.handleSaveLocalEdit({})
    expect(state.history.value.createNewChain).not.toHaveBeenCalled()
    expect(state.session.saveSession).not.toHaveBeenCalled()
    expect(state.getLocalEdit).not.toHaveBeenCalled()
    state.history.value = undefined as never
    await state.controller.handleSaveLocalEdit({})
    expect(state.toast.error).toHaveBeenCalledExactlyOnceWith('toast.error.historyUnavailable')
    expect(state.notifyHistoryRefresh).not.toHaveBeenCalled()
  })

  it('contains metadata preparation failures within the local-edit warning policy', async () => {
    const state = setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    state.getLocalEdit.mockImplementationOnce(() => { throw new Error('metadata preparation failed') })
    await expect(state.controller.handleSaveLocalEdit({})).resolves.toBeUndefined()
    expect(state.toast.warning).toHaveBeenCalledExactlyOnceWith('toast.warning.saveHistoryFailed')
    expect(state.history.value.createNewChain).not.toHaveBeenCalled()
    expect(state.session.saveSession).not.toHaveBeenCalled()
    expect(state.notifyHistoryRefresh).not.toHaveBeenCalled()
  })

  it('retains the local edit captured before an asynchronous history commit', async () => {
    const state = setup()
    let finish!: (value: PromptRecordChain) => void
    state.history.value.createNewChain.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const action = state.controller.handleSaveLocalEdit({})
    // A replacement object represents a restore or a subsequent edit while the
    // history write is outstanding. The committed record must be the saved edit.
    state.edit.value = { ...state.edit.value, optimizedPrompt: 'later edit' }
    expect(state.currentVersionId.value).toBe('')
    finish(makeChain())
    await action
    expect(state.session.updateOptimizedResult).toHaveBeenCalledWith({
      optimizedPrompt: 'edited', reasoning: '', chainId: 'chain', versionId: 'version',
    })
  })

  it('applies a committed version before saving and leaves caller-owned chain selection untouched', async () => {
    const state = setup()
    const order: string[] = []
    state.session.updateOptimizedResult.mockImplementation(() => {
      order.push('apply')
      expect(state.currentVersionId.value).toBe('version')
      expect(state.currentVersions.value).toHaveLength(1)
    })
    state.session.saveSession.mockImplementation(async () => { order.push('save'); return true })
    state.currentChainId.value = 'selected-chain'
    await state.controller.applyCommittedChain(makeChain(), { optimizedPrompt: 'complete', reasoning: 'thought' }, 'iteration commit')
    expect(order).toEqual(['apply', 'save'])
    expect(state.currentChainId.value).toBe('selected-chain')
    expect(state.toast.success).not.toHaveBeenCalled()
    expect(state.notifyHistoryRefresh).not.toHaveBeenCalled()
  })
})
