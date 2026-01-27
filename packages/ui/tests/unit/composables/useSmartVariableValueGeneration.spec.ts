import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Keep these mocks in-module so we can assert calls.
const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}

const mockGenerateValues = vi.fn(async () => {})
const mockInitialize = vi.fn(async () => {})

vi.mock('vue-i18n', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('../../../src/composables/ui/useToast', () => ({
  useToast: () => toast,
}))

vi.mock('../../../src/composables/model/useFunctionModelManager', () => ({
  useFunctionModelManager: () => ({
    initialize: mockInitialize,
    evaluationModel: ref('test-eval-model'),
    effectiveEvaluationModel: ref(''),
  }),
}))

vi.mock('../../../src/composables/variable/useVariableValueGeneration', () => ({
  useVariableValueGeneration: () => ({
    isGenerating: ref(false),
    generationResult: ref(null),
    showPreviewDialog: ref(false),
    generateValues: mockGenerateValues,
    confirmBatchApply: vi.fn(),
  }),
}))

import { useSmartVariableValueGeneration } from '../../../src/composables/variable/useSmartVariableValueGeneration'

describe('useSmartVariableValueGeneration (single variable inference)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('batch mode only generates missing variables (empty/whitespace)', async () => {
    const promptContent = ref('Hello {{foo}} {{bar}}')
    const variableNames = ref(['foo', 'bar'])
    const values: Record<string, string> = { foo: 'X', bar: '' }

    const { handleGenerateValues } = useSmartVariableValueGeneration({
      services: ref(null as any),
      promptContent,
      variableNames,
      getVariableValue: (name) => values[name] ?? '',
      getVariableSource: () => 'test' as any,
      applyValue: vi.fn(),
    })

    await handleGenerateValues()

    expect(mockInitialize).toHaveBeenCalledTimes(1)
    expect(mockGenerateValues).toHaveBeenCalledTimes(1)

    const call = (mockGenerateValues.mock.calls[0] || []) as any[]
    const variables = call[1]
    const modelKey = call[2]
    expect(modelKey).toBe('test-eval-model')
    expect(variables).toEqual([
      {
        name: 'bar',
        source: 'test',
      },
    ])
  })

  it('single mode generates one variable even when it already has value (passes currentValue)', async () => {
    const promptContent = ref('Hello {{foo}}')
    const variableNames = ref(['foo'])
    const values: Record<string, string> = { foo: 'Existing' }

    const { handleGenerateValues } = useSmartVariableValueGeneration({
      services: ref(null as any),
      promptContent,
      variableNames,
      getVariableValue: (name) => values[name] ?? '',
      getVariableSource: () => 'test' as any,
      applyValue: vi.fn(),
    })

    await handleGenerateValues('foo')

    expect(mockInitialize).toHaveBeenCalledTimes(1)
    expect(mockGenerateValues).toHaveBeenCalledTimes(1)

    expect(mockGenerateValues).toHaveBeenCalledWith(
      'Hello {{foo}}',
      [
        {
          name: 'foo',
          source: 'test',
          currentValue: 'Existing',
        },
      ],
      'test-eval-model',
    )
  })
})
