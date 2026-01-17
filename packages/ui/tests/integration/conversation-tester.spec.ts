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
import type { ConversationMessage } from '@prompt-optimizer/core'
import { useConversationTester } from '../../src/composables/prompt/useConversationTester'

describe('Conversation tester (integration)', () => {
  it('runs compare mode and uses originalContent for selected message in original run', async () => {
    toast.error.mockReset()

    const optimizationContext = ref<ConversationMessage[]>([
      { id: 'm1', role: 'user', content: 'c1', originalContent: 'c0' } as any
    ])

    const selectedMessageId = ref('m1')
    const optimizationTools = ref<any[]>([])

    const seenContents: string[] = []

    const testCustomConversationStream = vi.fn(async (req: any, handlers: any) => {
      seenContents.push(req.messages?.[0]?.content)
      handlers.onToken('X')
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

    const testPanelRef = {
      clearToolCalls: vi.fn(),
      handleToolCall: vi.fn()
    } as any

    const tester = useConversationTester(
      services,
      selectedTestModel,
      optimizationContext,
      optimizationTools as any,
      variableManager,
      selectedMessageId
    )

    await tester.executeTest(true, { extra: '2' }, testPanelRef)

    expect(testCustomConversationStream).toHaveBeenCalledTimes(2)
    expect(new Set(seenContents)).toEqual(new Set(['c0', 'c1']))
    expect(tester.testResults.originalResult).toBe('X')
    expect(tester.testResults.optimizedResult).toBe('X')
    expect(toast.error).not.toHaveBeenCalled()
  })
})

