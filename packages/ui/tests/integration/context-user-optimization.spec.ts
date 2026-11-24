import { describe, it, expect, vi } from 'vitest'
import { effectScope, nextTick, ref, type Ref } from 'vue'

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
      t: (key: string) => key
    })
  }
})

vi.mock('../../src/composables/ui/useToast', () => ({
  useToast: () => toast
}))

import type { AppServices } from '../../src/types/services'
import type { PromptChain, Template } from '@prompt-optimizer/core'
import { useContextUserOptimization } from '../../src/composables/prompt/useContextUserOptimization'

describe('ContextUser optimization (integration)', () => {
  it('keeps the selected history when an older restored chain arrives late', async () => {
    let resolveOld!: (chain: PromptChain) => void
    const getChain = vi.fn(() => new Promise<PromptChain>(resolve => { resolveOld = resolve }))
    const services = ref({ historyManager: { getChain } } as unknown as AppServices)
    const scope = effectScope()
    try {
      const optimizer = scope.run(() => useContextUserOptimization(
        services, ref(''), ref(null), ref(null), { currentChainId: ref('older'), currentVersionId: ref('older-v1') },
      ))!
      expect(getChain).toHaveBeenCalledExactlyOnceWith('older')
      const record = { id: 'current-v1', optimizedPrompt: 'current prompt' } as PromptChain['versions'][number]
      optimizer.loadFromHistory({ record, chain: { chainId: 'current', versions: [record], currentRecord: record } })
      resolveOld({ chainId: 'older', versions: [], currentRecord: record })
      await nextTick()
      expect(optimizer.currentChainId).toBe('current')
      expect(optimizer.currentVersions).toEqual([record])
    } finally {
      scope.stop()
    }
  })

  it('optimizes via stream and creates a new history chain', async () => {
    toast.success.mockReset()
    toast.error.mockReset()

    const saveSession = vi.fn(async () => {})
    const promptService = {
      optimizePromptStream: vi.fn(async (_req: any, handlers: any) => {
        handlers.onToken('opt ')
        expect(saveSession).not.toHaveBeenCalled()
        handlers.onToken('ok')
        handlers.onReasoningToken('why')
        await handlers.onComplete()
      })
    }

    const historyManager = {
      createNewChain: vi.fn(async (recordData: any) => ({
        chainId: 'chain-ctx-user',
        versions: [recordData],
        currentRecord: recordData
      })),
      addIteration: vi.fn()
    }

    const services: Ref<AppServices | null> = ref({
      promptService,
      historyManager,
      // Unused by this test but required by the AppServices type
      contextMode: ref('user' as any)
    } as any)

    const selectedOptimizeModel = ref('text-model-1')
    const selectedTemplate = ref<Template | null>({ id: 'tpl-1' } as any)
    const selectedIterateTemplate = ref<Template | null>({ id: 'tpl-iter' } as any)

    const optimizer = useContextUserOptimization(
      services,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate,
      {
        getSourceBindingSession: () => ({ saveSession })
      }
    )

    ;(optimizer as any).prompt = 'hello'

    await optimizer.optimize()

    expect(promptService.optimizePromptStream).toHaveBeenCalledTimes(1)
    expect(historyManager.createNewChain).toHaveBeenCalledTimes(1)
    expect(optimizer.optimizedPrompt).toBe('opt ok')
    expect(optimizer.optimizedReasoning).toBe('why')
    expect(optimizer.currentChainId).toBe('chain-ctx-user')
    expect(optimizer.currentVersionId).toBeTruthy()
    expect(saveSession).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('toast.success.optimizeSuccess')
  })

  it('writes the latest source binding to history when the binding changes after setup', async () => {
    toast.success.mockReset()
    toast.error.mockReset()

    const promptService = {
      optimizePromptStream: vi.fn(async (_req: any, handlers: any) => {
        handlers.onToken('bound result')
        await handlers.onComplete()
      })
    }

    const historyManager = {
      createNewChain: vi.fn(async (recordData: any) => ({
        chainId: 'chain-live-binding',
        versions: [recordData],
        currentRecord: recordData
      })),
      addIteration: vi.fn()
    }

    const services: Ref<AppServices | null> = ref({
      promptService,
      historyManager,
      contextMode: ref('user' as any)
    } as any)

    const sourceBindingState: any = {}
    const optimizer = useContextUserOptimization(
      services,
      ref('text-model-1'),
      ref<Template | null>({ id: 'tpl-1' } as any),
      ref<Template | null>({ id: 'tpl-iter' } as any),
      {
        getSourceBindingSession: () => sourceBindingState
      }
    )

    sourceBindingState.assetBinding = {
      assetId: 'asset-after-setup',
      versionId: 'version-after-setup',
      status: 'linked'
    }
    sourceBindingState.origin = {
      kind: 'favorite',
      id: 'favorite-after-setup'
    }
    ;(optimizer as any).prompt = 'hello'

    await optimizer.optimize()

    expect(historyManager.createNewChain).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          assetBinding: {
            assetId: 'asset-after-setup',
            versionId: 'version-after-setup',
            status: 'linked'
          },
          origin: {
            kind: 'favorite',
            id: 'favorite-after-setup'
          }
        })
      })
    )
  })

  it('iterates via stream and appends a new version', async () => {
    toast.success.mockReset()
    toast.error.mockReset()

    const saveSession = vi.fn(async () => {})
    const promptService = {
      iteratePromptStream: vi.fn(async (_orig: any, _last: any, _note: any, _model: any, handlers: any) => {
        handlers.onToken('next ')
        expect(saveSession).not.toHaveBeenCalled()
        handlers.onToken('v')
        handlers.onReasoningToken('r')
        await handlers.onComplete()
      })
    }

    const historyManager = {
      createNewChain: vi.fn(),
      addIteration: vi.fn(async (_payload: any) => ({
        chainId: 'chain-ctx-user',
        versions: [{ id: 'v0' }, { id: 'v1' }],
        currentRecord: { id: 'v1' }
      }))
    }

    const services: Ref<AppServices | null> = ref({
      promptService,
      historyManager,
      // Unused by this test but required by the AppServices type
      contextMode: ref('user' as any)
    } as any)

    const selectedOptimizeModel = ref('text-model-1')
    const selectedTemplate = ref<Template | null>({ id: 'tpl-1' } as any)
    const selectedIterateTemplate = ref<Template | null>({ id: 'tpl-iter' } as any)

    const optimizer = useContextUserOptimization(
      services,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate,
      {
        getSourceBindingSession: () => ({ saveSession })
      }
    )

    ;(optimizer as any).prompt = 'orig'
    ;(optimizer as any).currentChainId = 'chain-ctx-user'

    await optimizer.iterate({ originalPrompt: 'orig', optimizedPrompt: 'last', iterateInput: 'note' })

    expect(promptService.iteratePromptStream).toHaveBeenCalledTimes(1)
    expect(historyManager.addIteration).toHaveBeenCalledTimes(1)
    expect(optimizer.optimizedPrompt).toBe('next v')
    expect(optimizer.optimizedReasoning).toBe('r')
    expect(optimizer.currentVersionId).toBe('v1')
    expect(saveSession).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('toast.success.iterateComplete')
  })

  it('saves the session after persisting a local edit version', async () => {
    toast.success.mockReset()
    toast.warning.mockReset()

    const saveSession = vi.fn(async () => {})
    const historyManager = {
      createNewChain: vi.fn(),
      addIteration: vi.fn(async (_payload: any) => ({
        chainId: 'chain-ctx-user',
        versions: [{ id: 'v0' }, { id: 'v1' }],
        currentRecord: { id: 'v1' }
      }))
    }

    const services: Ref<AppServices | null> = ref({
      historyManager,
      contextMode: ref('user' as any)
    } as any)

    const optimizer = useContextUserOptimization(
      services,
      ref('text-model-1'),
      ref<Template | null>({ id: 'tpl-1' } as any),
      ref<Template | null>({ id: 'tpl-iter' } as any),
      {
        getSourceBindingSession: () => ({ saveSession })
      }
    )

    ;(optimizer as any).prompt = 'orig'
    ;(optimizer as any).currentChainId = 'chain-ctx-user'
    ;(optimizer as any).currentVersions = [{ id: 'v0', modelKey: 'model-1', templateId: 'tpl-1' }]
    ;(optimizer as any).currentVersionId = 'v0'

    await optimizer.saveLocalEdit({ optimizedPrompt: 'edited', note: 'manual edit' })

    expect(historyManager.addIteration).toHaveBeenCalledTimes(1)
    expect(optimizer.currentVersionId).toBe('v1')
    expect(saveSession).toHaveBeenCalledTimes(1)
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('creates a new history chain when iterating after analyze reset cleared the chain id', async () => {
    toast.success.mockReset()
    toast.error.mockReset()
    toast.warning.mockReset()

    const promptService = {
      iteratePromptStream: vi.fn(async (_orig: any, _last: any, _note: any, _model: any, handlers: any) => {
        handlers.onToken('fresh ')
        handlers.onToken('chain')
        handlers.onReasoningToken('reason')
        await handlers.onComplete()
      })
    }

    const historyManager = {
      createNewChain: vi.fn(async (recordData: any) => ({
        chainId: 'chain-from-v0',
        versions: [{ ...recordData, chainId: 'chain-from-v0', version: 1 }],
        currentRecord: { ...recordData, chainId: 'chain-from-v0', version: 1 }
      })),
      addIteration: vi.fn()
    }

    const services: Ref<AppServices | null> = ref({
      promptService,
      historyManager,
      contextMode: ref('user' as any)
    } as any)

    const selectedOptimizeModel = ref('text-model-1')
    const selectedTemplate = ref<Template | null>({ id: 'tpl-1' } as any)
    const selectedIterateTemplate = ref<Template | null>({ id: 'tpl-iter' } as any)

    const optimizer = useContextUserOptimization(
      services,
      selectedOptimizeModel,
      selectedTemplate,
      selectedIterateTemplate
    )

    ;(optimizer as any).prompt = 'orig from analyze'
    optimizer.handleAnalyze()

    expect(optimizer.currentChainId).toBe('')
    expect(optimizer.currentVersions).toHaveLength(1)
    expect(optimizer.currentVersions[0]?.version).toBe(0)

    await optimizer.iterate({
      originalPrompt: 'orig from analyze',
      optimizedPrompt: 'orig from analyze',
      iterateInput: 'make it clearer'
    })

    expect(promptService.iteratePromptStream).toHaveBeenCalledTimes(1)
    expect(historyManager.createNewChain).toHaveBeenCalledTimes(1)
    expect(historyManager.addIteration).not.toHaveBeenCalled()
    expect(historyManager.createNewChain).toHaveBeenCalledWith(
      expect.objectContaining({
        originalPrompt: 'orig from analyze',
        optimizedPrompt: 'fresh chain',
        type: 'contextUserOptimize',
        iterationNote: 'make it clearer',
        templateId: 'tpl-iter'
      })
    )
    expect(optimizer.currentChainId).toBe('chain-from-v0')
    expect(optimizer.currentVersionId).toBeTruthy()
    expect(optimizer.optimizedPrompt).toBe('fresh chain')
    expect(optimizer.optimizedReasoning).toBe('reason')
    expect(toast.warning).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('toast.success.iterateComplete')
  })
})
