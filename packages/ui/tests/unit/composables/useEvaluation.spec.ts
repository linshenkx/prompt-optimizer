import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useEvaluation } from '../../../src/composables/prompt/useEvaluation'
import { resetFunctionModelManagerSingleton, useFunctionModelManager } from '../../../src/composables/model/useFunctionModelManager'
import { FUNCTION_MODEL_KEYS } from '@prompt-optimizer/core'
import type { AppServices } from '../../../src/types/services'

const toast = {
  error: vi.fn(),
}

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => toast,
}))

const createServices = (evaluateStream: ReturnType<typeof vi.fn>, savedEvaluationModel = '') => ref({
  evaluationService: { evaluateStream },
  modelManager: {
    getAllModels: vi.fn().mockResolvedValue([{ id: 'first-enabled-model', enabled: true }]),
  },
  preferenceService: {
    get: vi.fn(async (key, defaultValue) =>
      key === FUNCTION_MODEL_KEYS.EVALUATION_MODEL ? savedEvaluationModel : defaultValue),
    set: vi.fn().mockResolvedValue(undefined),
  },
} as unknown as AppServices)

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
      locale: ref('zh-CN'),
    }),
  }
})

describe('useEvaluation model selection', () => {
  beforeEach(() => {
    resetFunctionModelManagerSingleton()
    toast.error.mockReset()
  })

  afterEach(() => {
    resetFunctionModelManagerSingleton()
  })

  it('can resolve evaluation models per evaluation type', async () => {
    const evaluateStream = vi.fn(async (_request, handlers) => {
      handlers.onToken('{"score":{"overall":92,"dimensions":[{"key":"overall","label":"Overall","score":92}]},"summary":"done","improvements":[],"patchPlan":[]}')
      handlers.onComplete({
        type: 'result',
        score: {
          overall: 92,
          dimensions: [{ key: 'overall', label: 'Overall', score: 92 }],
        },
        summary: 'done',
        improvements: [],
        patchPlan: [],
      })
    })

    const services = createServices(evaluateStream)

    const evaluation = useEvaluation(services, {
      evaluationModelKey: ref('fallback-eval-model'),
      functionMode: ref('image'),
      subMode: ref('text2image'),
      resolveEvaluationModelKey: async (type) =>
        type === 'result' || type === 'compare'
          ? 'image-recognition-model'
          : 'text-evaluation-model',
    })

    await evaluation.evaluatePromptOnly({
      target: {
        workspacePrompt: 'prompt only target',
      },
    })

    await evaluation.evaluateResult({
      variantId: 'a',
      target: {
        workspacePrompt: 'workspace prompt',
      },
      testCase: {
        id: 'tc-1',
        input: {
          kind: 'text',
          label: '生成意图',
          content: 'A corgi on the beach',
        },
      },
      snapshot: {
        id: 'snap-a',
        label: 'A',
        testCaseId: 'tc-1',
        promptRef: { kind: 'workspace' },
        promptText: 'prompt a',
        output: 'result a',
      },
    })

    await evaluation.evaluateCompare({
      target: {
        workspacePrompt: 'workspace prompt',
      },
      testCases: [
        {
          id: 'tc-1',
          input: {
            kind: 'text',
            label: '生成意图',
            content: 'A corgi on the beach',
          },
        },
      ],
      snapshots: [
        {
          id: 'snap-a',
          label: 'A',
          testCaseId: 'tc-1',
          promptRef: { kind: 'workspace' },
          promptText: 'prompt a',
          output: 'result a',
        },
        {
          id: 'snap-b',
          label: 'B',
          testCaseId: 'tc-1',
          promptRef: { kind: 'version', version: 1 },
          promptText: 'prompt b',
          output: 'result b',
        },
      ],
    })

    expect(evaluateStream.mock.calls[0][0].evaluationModelKey).toBe('text-evaluation-model')
    expect(evaluateStream.mock.calls[1][0].evaluationModelKey).toBe('image-recognition-model')
    expect(evaluateStream.mock.calls[2][0].evaluationModelKey).toBe('image-recognition-model')
  })

  it('merges custom prompt-analysis variables with language', async () => {
    const evaluateStream = vi.fn(async (_request, handlers) => {
      handlers.onComplete({
        type: 'prompt-only',
        score: {
          overall: 90,
          dimensions: [{ key: 'overall', label: 'Overall', score: 90 }],
        },
        summary: 'done',
        improvements: [],
        patchPlan: [],
      })
    })

    const services = createServices(evaluateStream)

    const evaluation = useEvaluation(services, {
      evaluationModelKey: ref('eval-model'),
      functionMode: ref('image'),
      subMode: ref('text2image'),
    })

    await evaluation.evaluatePromptOnly({
      target: {
        workspacePrompt: 'prompt only target',
      },
      variables: {
        analysisStage: 'original-input',
      },
    })

    await evaluation.evaluatePromptIterate({
      target: {
        workspacePrompt: 'prompt iterate target',
      },
      iterateRequirement: 'make it more cinematic',
      variables: {
        analysisStage: 'workspace',
      },
    })

    expect(evaluateStream.mock.calls[0][0].variables).toEqual({
      language: 'zh',
      analysisStage: 'original-input',
    })
    expect(evaluateStream.mock.calls[1][0].variables).toEqual({
      language: 'zh',
      analysisStage: 'workspace',
    })
  })

  it.each([
    ['explicit-evaluation', 'global-optimizer', 'test-model', 'explicit-evaluation'],
    ['', 'global-optimizer', 'test-model', 'global-optimizer'],
    ['', '', 'test-model', 'test-model'],
    ['', '', '', 'first-enabled-model'],
  ])('selects %s / %s / %s as %s for prompt analysis', async (explicit, global, test, expected) => {
    const evaluateStream = vi.fn(async (_request, handlers) => {
      handlers.onComplete({ type: 'prompt-only', summary: 'done', improvements: [] })
    })
    const services = createServices(evaluateStream, explicit)
    useFunctionModelManager(services, ref(global))
    const evaluation = useEvaluation(services, {
      evaluationModelKey: ref(test),
      functionMode: ref('basic'),
      subMode: ref('system'),
    })

    await evaluation.evaluatePromptOnly({ target: { workspacePrompt: 'Analyze this prompt' } })

    expect(evaluateStream).toHaveBeenCalledTimes(1)
    expect(evaluateStream.mock.calls[0][0].evaluationModelKey).toBe(expected)
  })

  it('follows changes to the global optimizer and falls back to the test model when cleared', async () => {
    const evaluateStream = vi.fn(async (_request, handlers) => {
      handlers.onComplete({ type: 'prompt-only', summary: 'done', improvements: [] })
    })
    const services = createServices(evaluateStream)
    const globalModel = ref('optimizer-a')
    useFunctionModelManager(services, globalModel)
    const evaluation = useEvaluation(services, {
      evaluationModelKey: ref('test-model'),
      functionMode: ref('basic'),
      subMode: ref('user'),
    })

    for (const model of ['optimizer-a', 'optimizer-b', '']) {
      globalModel.value = model
      await evaluation.evaluatePromptOnly({ target: { workspacePrompt: 'Analyze this prompt' } })
    }

    expect(evaluateStream.mock.calls.map(([request]) => request.evaluationModelKey))
      .toEqual(['optimizer-a', 'optimizer-b', 'test-model'])
  })
})
