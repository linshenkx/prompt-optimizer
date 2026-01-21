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
      testResults: null,
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
      updateTestResults: (results: any) => {
        sessionStore.testResults = results
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

    const promptService = {
      iteratePromptStream: vi.fn(async (_orig: any, _last: any, _note: any, _modelKey: any, handlers: any) => {
        handlers.onToken('new ')
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
    expect(toast.success).toHaveBeenCalledWith('toast.success.iterateComplete')
  })

  it('tests optimized prompt and persists test results (non-compare)', async () => {
    toast.success.mockReset()
    toast.error.mockReset()

    const sessionStore = reactive({
      prompt: 'hello',
      optimizedPrompt: 'optimized',
      reasoning: '',
      chainId: 'chain-1',
      versionId: 'ver-1',
      testContent: 'input',
      testResults: null,
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
      updateTestResults: (results: any) => {
        sessionStore.testResults = results
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

    const promptService = {
      testPromptStream: vi.fn(async (_system: any, _user: any, _modelKey: any, handlers: any) => {
        handlers.onToken('A')
        handlers.onToken('B')
        handlers.onReasoningToken('R')
        handlers.onComplete()
      })
    }

    const services = ref({
      promptService
    } as unknown as AppServices)

    const logic = useBasicWorkspaceLogic({
      services,
      sessionStore,
      optimizationMode: 'system',
      promptRecordType: 'optimize'
    })

    await logic.handleTest()

    expect(promptService.testPromptStream).toHaveBeenCalledTimes(1)
    expect(sessionStore.testResults?.optimizedResult).toBe('AB')
    expect(sessionStore.testResults?.optimizedReasoning).toBe('R')
    expect(toast.success).toHaveBeenCalledWith('toast.success.testComplete')
  })

  it('tests original + optimized in compare mode (system)', async () => {
    toast.success.mockReset()
    toast.error.mockReset()

    const sessionStore = reactive({
      prompt: 'sys',
      optimizedPrompt: 'sys2',
      reasoning: '',
      chainId: 'chain-1',
      versionId: 'ver-1',
      testContent: 'user',
      testResults: null,
      selectedOptimizeModelKey: 'model-1',
      selectedTestModelKey: 'model-1',
      selectedTemplateId: 'template-1',
      selectedIterateTemplateId: null,
      isCompareMode: true,
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
      updateTestResults: (results: any) => {
        sessionStore.testResults = results
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

    const promptService = {
      testPromptStream: vi.fn(async (_system: any, _user: any, _modelKey: any, handlers: any) => {
        // 第一次调用：original；第二次：optimized
        const isOriginal = promptService.testPromptStream.mock.calls.length === 1
        handlers.onToken(isOriginal ? 'O' : 'N')
        handlers.onToken(isOriginal ? '1' : '2')
        handlers.onComplete()
      })
    }

    const services = ref({
      promptService
    } as unknown as AppServices)

    const logic = useBasicWorkspaceLogic({
      services,
      sessionStore,
      optimizationMode: 'system',
      promptRecordType: 'optimize'
    })

    await logic.handleTest()

    expect(promptService.testPromptStream).toHaveBeenCalledTimes(2)
    expect(sessionStore.testResults?.originalResult).toBe('O1')
    expect(sessionStore.testResults?.optimizedResult).toBe('N2')
    expect(toast.success).toHaveBeenCalledWith('toast.success.testComplete')
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
      testResults: null,
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
      updateTestResults: (results: any) => {
        sessionStore.testResults = results
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

    const promptService = {
      optimizePromptStream: vi.fn(async (_request: any, handlers: any) => {
        handlers.onToken('optimized ')
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
    expect(historyManager.createNewChain).toHaveBeenCalledTimes(1)
    expect(sessionStore.optimizedPrompt).toBe('optimized prompt')
    expect(sessionStore.reasoning).toBe('reason')
    expect(sessionStore.chainId).toBe('chain-1')
    expect(sessionStore.versionId).toBeTruthy()
  })
})
