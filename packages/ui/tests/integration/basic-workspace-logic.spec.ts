import { describe, it, expect, vi } from 'vitest'

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn()
}

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('../../src/composables/ui/useToast', () => ({
  useToast: () => toast
}))

import { ref, reactive } from 'vue'
import { useBasicWorkspaceLogic } from '../../src/composables/workspaces/useBasicWorkspaceLogic'
import type { AppServices } from '../../src/types/services'

describe('Basic workspace logic (smoke)', () => {
  it('iterates prompt and appends new version in history', async () => {
    toast.success.mockReset()
    toast.error.mockReset()
    toast.warning.mockReset()

    const sessionStore = reactive({
      prompt: 'original',
      optimizedPrompt: 'last',
      reasoning: '',
      chainId: 'chain-1',
      versionId: 'ver-1',
      testContent: 'input',
      selectedOptimizeModelKey: 'model-1',
      selectedTestModelKey: 'model-1',
      selectedTemplateId: 'template-1',
      selectedIterateTemplateId: 'iterate-1',
      isCompareMode: false,
      updatePrompt: (prompt: string) => {
        sessionStore.prompt = prompt
      },
      updateOptimizedResult: (payload: {
        optimizedPrompt: string
        reasoning?: string
        chainId: string
        versionId: string
      }) => {
        sessionStore.optimizedPrompt = payload.optimizedPrompt
        sessionStore.reasoning = payload.reasoning || ''
        sessionStore.chainId = payload.chainId
        sessionStore.versionId = payload.versionId
      },
      updateTestContent: (content: string) => {
        sessionStore.testContent = content
      },
      updateOptimizeModel: (key: string) => {
        sessionStore.selectedOptimizeModelKey = key
      },
      updateTestModel: (key: string) => {
        sessionStore.selectedTestModelKey = key
      },
      updateTemplate: (id: string | null) => {
        sessionStore.selectedTemplateId = id
      },
      updateIterateTemplate: (id: string | null) => {
        sessionStore.selectedIterateTemplateId = id
      },
      saveSession: vi.fn(async () => {})
    }) as any

    const saveSession = sessionStore.saveSession
    const promptService = {
      iteratePromptStream: vi.fn(async (_orig: any, _last: any, _note: any, _modelKey: any, handlers: any) => {
        handlers.onToken('new ')
        expect(saveSession).not.toHaveBeenCalled()
        handlers.onToken('prompt')
        handlers.onReasoningToken('why')
        await handlers.onComplete()
      })
    }

    const historyManager = {
      addIteration: vi.fn(async (_payload: any) => ({
        chainId: 'chain-1',
        versions: [{ id: 'v0' }, { id: 'v1' }],
        currentRecord: { id: 'v1' }
      }))
    }

    const services = ref({
      promptService,
      historyManager
    } as unknown as AppServices)

    const logic = useBasicWorkspaceLogic({
      services,
      sessionStore,
      optimizationMode: 'system',
      promptRecordType: 'optimize'
    })

    await logic.handleIterate({ iterateInput: 'more', originalPrompt: 'original', optimizedPrompt: 'last' } as any)

    expect(promptService.iteratePromptStream).toHaveBeenCalledTimes(1)
    expect(historyManager.addIteration).toHaveBeenCalledTimes(1)
    expect(sessionStore.optimizedPrompt).toBe('new prompt')
    expect(sessionStore.reasoning).toBe('why')
    expect(sessionStore.chainId).toBe('chain-1')
    expect(sessionStore.versionId).toBe('v1')
    expect(saveSession).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('toast.success.iterateComplete')
  })

  it('optimizes prompt and persists result to session store', async () => {
    toast.success.mockReset()
    toast.error.mockReset()

    const sessionStore = reactive({
      prompt: 'hello',
      optimizedPrompt: '',
      reasoning: '',
      chainId: '',
      versionId: '',
      testContent: '',
      selectedOptimizeModelKey: 'model-1',
      selectedTestModelKey: 'model-1',
      selectedTemplateId: 'template-1',
      selectedIterateTemplateId: null,
      isCompareMode: false,
      assetBinding: { assetId: 'asset-linked', versionId: 'version-linked', status: 'linked' },
      origin: { kind: 'favorite', id: 'favorite-linked' },
      updatePrompt: (prompt: string) => {
        sessionStore.prompt = prompt
      },
      updateOptimizedResult: (payload: {
        optimizedPrompt: string
        reasoning?: string
        chainId: string
        versionId: string
      }) => {
        sessionStore.optimizedPrompt = payload.optimizedPrompt
        sessionStore.reasoning = payload.reasoning || ''
        sessionStore.chainId = payload.chainId
        sessionStore.versionId = payload.versionId
      },
      updateTestContent: (content: string) => {
        sessionStore.testContent = content
      },
      updateOptimizeModel: (key: string) => {
        sessionStore.selectedOptimizeModelKey = key
      },
      updateTestModel: (key: string) => {
        sessionStore.selectedTestModelKey = key
      },
      updateTemplate: (id: string | null) => {
        sessionStore.selectedTemplateId = id
      },
      updateIterateTemplate: (id: string | null) => {
        sessionStore.selectedIterateTemplateId = id
      },
      clearAssetBinding: vi.fn(),
      saveSession: vi.fn(async () => {})
    }) as any

    const saveSession = sessionStore.saveSession
    const promptService = {
      optimizePromptStream: vi.fn(async (_request: any, handlers: any) => {
        handlers.onToken('optimized ')
        expect(saveSession).not.toHaveBeenCalled()
        handlers.onToken('prompt')
        handlers.onReasoningToken('reason')
        await handlers.onComplete()
      })
    }

    const historyManager = {
      createNewChain: vi.fn(async (recordData: any) => ({
        chainId: 'chain-1',
        versions: [recordData],
        currentRecord: recordData
      }))
    }

    const services = ref({
      promptService,
      historyManager
    } as unknown as AppServices)

    const logic = useBasicWorkspaceLogic({
      services,
      sessionStore,
      optimizationMode: 'system',
      promptRecordType: 'optimize'
    })

    await logic.handleOptimize()

    expect(promptService.optimizePromptStream).toHaveBeenCalledTimes(1)
    expect(sessionStore.clearAssetBinding).not.toHaveBeenCalled()
    expect(historyManager.createNewChain).toHaveBeenCalledTimes(1)
    expect(historyManager.createNewChain.mock.calls[0][0].metadata).toMatchObject({
      optimizationMode: 'system',
      functionMode: 'basic',
      assetBinding: {
        assetId: 'asset-linked',
        versionId: 'version-linked',
        status: 'linked',
      },
      origin: {
        kind: 'favorite',
        id: 'favorite-linked',
      },
    })
    expect(sessionStore.optimizedPrompt).toBe('optimized prompt')
    expect(sessionStore.reasoning).toBe('reason')
    expect(sessionStore.chainId).toBe('chain-1')
    expect(sessionStore.versionId).toBeTruthy()
    expect(saveSession).toHaveBeenCalledTimes(1)
  })

  it('saves the session after persisting a local edit version', async () => {
    toast.success.mockReset()
    toast.warning.mockReset()

    const sessionStore = reactive({
      prompt: 'original',
      optimizedPrompt: 'edited prompt',
      reasoning: 'old reason',
      chainId: 'chain-1',
      versionId: 'ver-1',
      testContent: 'input',
      selectedOptimizeModelKey: 'model-1',
      selectedTestModelKey: 'model-1',
      selectedTemplateId: 'template-1',
      selectedIterateTemplateId: 'iterate-1',
      isCompareMode: false,
      updatePrompt: (prompt: string) => {
        sessionStore.prompt = prompt
      },
      updateOptimizedResult: (payload: {
        optimizedPrompt: string
        reasoning?: string
        chainId: string
        versionId: string
      }) => {
        sessionStore.optimizedPrompt = payload.optimizedPrompt
        sessionStore.reasoning = payload.reasoning || ''
        sessionStore.chainId = payload.chainId
        sessionStore.versionId = payload.versionId
      },
      updateTestContent: (content: string) => {
        sessionStore.testContent = content
      },
      updateOptimizeModel: (key: string) => {
        sessionStore.selectedOptimizeModelKey = key
      },
      updateTestModel: (key: string) => {
        sessionStore.selectedTestModelKey = key
      },
      updateTemplate: (id: string | null) => {
        sessionStore.selectedTemplateId = id
      },
      updateIterateTemplate: (id: string | null) => {
        sessionStore.selectedIterateTemplateId = id
      },
      saveSession: vi.fn(async () => {})
    }) as any

    const historyManager = {
      addIteration: vi.fn(async (_payload: any) => ({
        chainId: 'chain-1',
        versions: [{ id: 'ver-1' }, { id: 'ver-2' }],
        currentRecord: { id: 'ver-2', modelKey: 'model-1', templateId: 'template-1' }
      }))
    }

    const services = ref({
      historyManager
    } as unknown as AppServices)

    const logic = useBasicWorkspaceLogic({
      services,
      sessionStore,
      optimizationMode: 'system',
      promptRecordType: 'optimize'
    })

    await logic.handleSaveLocalEdit({ optimizedPrompt: 'edited prompt', note: 'manual edit' })

    expect(historyManager.addIteration).toHaveBeenCalledTimes(1)
    expect(sessionStore.optimizedPrompt).toBe('edited prompt')
    expect(sessionStore.reasoning).toBe('')
    expect(sessionStore.chainId).toBe('chain-1')
    expect(sessionStore.versionId).toBe('ver-2')
    expect(sessionStore.saveSession).toHaveBeenCalledTimes(1)
    expect(toast.warning).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('toast.success.localEditSaved')
  })

  it('resets the current chain and creates an in-memory v0 when analyzing', () => {
    const sessionStore = reactive({
      prompt: 'analyze me',
      optimizedPrompt: 'old optimized',
      reasoning: 'old reasoning',
      chainId: 'old-chain',
      versionId: 'old-version',
      testContent: 'input',
      selectedOptimizeModelKey: 'model-1',
      selectedTestModelKey: 'model-1',
      selectedTemplateId: 'template-1',
      selectedIterateTemplateId: null,
      isCompareMode: false,
      updatePrompt: (prompt: string) => {
        sessionStore.prompt = prompt
      },
      updateOptimizedResult: (payload: {
        optimizedPrompt: string
        reasoning?: string
        chainId: string
        versionId: string
      }) => {
        sessionStore.optimizedPrompt = payload.optimizedPrompt
        sessionStore.reasoning = payload.reasoning || ''
        sessionStore.chainId = payload.chainId
        sessionStore.versionId = payload.versionId
      },
      updateTestContent: (content: string) => {
        sessionStore.testContent = content
      },
      updateOptimizeModel: (key: string) => {
        sessionStore.selectedOptimizeModelKey = key
      },
      updateTestModel: (key: string) => {
        sessionStore.selectedTestModelKey = key
      },
      updateTemplate: (id: string | null) => {
        sessionStore.selectedTemplateId = id
      },
      updateIterateTemplate: (id: string | null) => {
        sessionStore.selectedIterateTemplateId = id
      },
      clearAssetBinding: vi.fn()
    }) as any

    const services = ref({} as unknown as AppServices)

    const logic = useBasicWorkspaceLogic({
      services,
      sessionStore,
      optimizationMode: 'system',
      promptRecordType: 'optimize'
    })

    logic.handleAnalyze()

    expect(sessionStore.clearAssetBinding).not.toHaveBeenCalled()
    expect(logic.currentChainId.value).toBe('')
    expect(logic.currentVersions.value).toHaveLength(1)
    expect(logic.currentVersions.value[0]?.version).toBe(0)
    expect(logic.currentVersions.value[0]?.optimizedPrompt).toBe('analyze me')
    expect(logic.currentVersionId.value).toBeTruthy()

    expect(sessionStore.optimizedPrompt).toBe('analyze me')
    expect(sessionStore.reasoning).toBe('')
    expect(sessionStore.chainId).toBe('')
    expect(sessionStore.versionId).toBe('')
  })

  it('clears stale chain metadata when loading versions for a missing history chain', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sessionStore = reactive({
      prompt: 'original',
      optimizedPrompt: 'optimized',
      reasoning: 'reasoning',
      chainId: 'missing-chain',
      versionId: 'missing-version',
      testContent: 'input',
      selectedOptimizeModelKey: 'model-1',
      selectedTestModelKey: 'model-1',
      selectedTemplateId: 'template-1',
      selectedIterateTemplateId: null,
      isCompareMode: false,
      updatePrompt: (prompt: string) => {
        sessionStore.prompt = prompt
      },
      updateOptimizedResult: (payload: {
        optimizedPrompt: string
        reasoning?: string
        chainId: string
        versionId: string
      }) => {
        sessionStore.optimizedPrompt = payload.optimizedPrompt
        sessionStore.reasoning = payload.reasoning || ''
        sessionStore.chainId = payload.chainId
        sessionStore.versionId = payload.versionId
      },
      updateTestContent: (content: string) => {
        sessionStore.testContent = content
      },
      updateOptimizeModel: (key: string) => {
        sessionStore.selectedOptimizeModelKey = key
      },
      updateTestModel: (key: string) => {
        sessionStore.selectedTestModelKey = key
      },
      updateTemplate: (id: string | null) => {
        sessionStore.selectedTemplateId = id
      },
      updateIterateTemplate: (id: string | null) => {
        sessionStore.selectedIterateTemplateId = id
      }
    }) as any

    const historyManager = {
      getChain: vi.fn(async () => {
        throw {
          code: 'error.history.record_not_found',
          message: 'Chain with ID missing-chain not found',
        }
      }),
    }
    const services = ref({
      historyManager,
    } as unknown as AppServices)

    const logic = useBasicWorkspaceLogic({
      services,
      sessionStore,
      optimizationMode: 'system',
      promptRecordType: 'optimize'
    })

    await logic.loadVersions()

    expect(historyManager.getChain).toHaveBeenCalledWith('missing-chain')
    expect(sessionStore.optimizedPrompt).toBe('optimized')
    expect(sessionStore.reasoning).toBe('reasoning')
    expect(sessionStore.chainId).toBe('')
    expect(sessionStore.versionId).toBe('')
    expect(logic.currentChainId.value).toBe('')
    expect(logic.currentVersions.value).toEqual([])
    expect(logic.currentVersionId.value).toBe('')

    consoleErrorSpy.mockRestore()
  })
  it('restores the exact workspace and reasoning after a failed iteration so it can be retried', async () => {
    const sessionStore = reactive({
      prompt: 'original', optimizedPrompt: 'edited draft', reasoning: 'previous reasoning',
      chainId: 'chain-1', versionId: 'ver-1', testContent: 'test',
      selectedOptimizeModelKey: 'model-1', selectedTestModelKey: 'model-1',
      selectedTemplateId: 'template-1', selectedIterateTemplateId: 'iterate-1', isCompareMode: false,
      updatePrompt: vi.fn(), updateOptimizedResult: vi.fn(), updateTestContent: vi.fn(),
      updateOptimizeModel: vi.fn(), updateTestModel: vi.fn(), updateTemplate: vi.fn(),
      updateIterateTemplate: vi.fn(), saveSession: vi.fn(),
    })
    const services = ref({
      promptService: { iteratePromptStream: vi.fn(async (_original, previous, _note, _model, callbacks) => {
        expect(previous).toBe('edited draft')
        callbacks.onToken('partial response')
        callbacks.onReasoningToken('partial reasoning')
        throw new Error('network interrupted')
      }) },
      historyManager: { addIteration: vi.fn() },
    } as unknown as AppServices)
    const logic = useBasicWorkspaceLogic({ services, sessionStore, optimizationMode: 'system', promptRecordType: 'optimize' })
    await logic.handleIterate({ originalPrompt: 'original', optimizedPrompt: 'edited draft', iterateInput: 'shorter' })
    expect(sessionStore.optimizedPrompt).toBe('edited draft')
    expect(sessionStore.reasoning).toBe('previous reasoning')
    expect(sessionStore.versionId).toBe('ver-1')
    expect(sessionStore.saveSession).not.toHaveBeenCalled()
    expect(services.value.historyManager.addIteration).not.toHaveBeenCalled()
    expect(logic.isIterating.value).toBe(false)
  })

})
