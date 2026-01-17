import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn()
}

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal()
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
import { useContextUserTester } from '../../src/composables/prompt/useContextUserTester'

describe('ContextUser tester (integration)', () => {
  it('runs compare mode and merges variables', async () => {
    toast.error.mockReset()

    const testCustomConversationStream = vi.fn(async (req: any, handlers: any) => {
      expect(req.modelKey).toBe('test-model-1')
      expect(req.variables).toMatchObject({
        base: '1',
        extra: '2'
      })
      handlers.onToken('A')
      handlers.onToken('B')
      handlers.onReasoningToken('R')
      handlers.onComplete()
    })

    const services = ref({
      promptService: { testCustomConversationStream }
    } as unknown as AppServices)

    const selectedTestModel = ref('test-model-1')
    const variableManager = {
      variableManager: ref({
        resolveAllVariables: () => ({ base: '1' })
      })
    } as any

    const tester = useContextUserTester(services, selectedTestModel, variableManager)

    await tester.executeTest('p0', 'p1', true, { extra: '2' })

    expect(testCustomConversationStream).toHaveBeenCalledTimes(2)
    expect(tester.testResults.originalResult).toBe('AB')
    expect(tester.testResults.optimizedResult).toBe('AB')
    expect(toast.error).not.toHaveBeenCalled()
  })
})

