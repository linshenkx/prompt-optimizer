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
import type { Template, ConversationMessage } from '@prompt-optimizer/core'
import { useProMultiMessageSession } from '../../src/stores/session/useProMultiMessageSession'
import { createTestPinia } from '../utils/pinia-test-helpers'
import { useConversationOptimization } from '../../src/composables/prompt/useConversationOptimization'

describe('Conversation optimization (integration)', () => {
  it('optimizes selected message, applies to conversation, and persists mapping in pro-system session', async () => {
    toast.success.mockReset()
    toast.error.mockReset()
    toast.warning.mockReset()

    const promptService = {
      optimizeMessageStream: vi.fn(async (_req: any, handlers: any) => {
        handlers.onToken('opt ')
        handlers.onToken('msg')
        handlers.onReasoningToken('why')
        await handlers.onComplete()
      }),
      iteratePromptStream: vi.fn()
    }

    const historyManager = {
      createNewChain: vi.fn(async (recordData: any) => ({
        chainId: 'chain-pro-1',
        versions: [recordData],
        currentRecord: { id: 'v1', optimizedPrompt: recordData.optimizedPrompt }
      })),
      addIteration: vi.fn(),
      getChain: vi.fn()
    }

    const { pinia } = createTestPinia({
      promptService: promptService as any,
      historyManager: historyManager as any
    } as Partial<AppServices>)
    void pinia

    const proSession = useProMultiMessageSession()
    proSession.reset()

    const services = ref({
      promptService,
      historyManager
    } as unknown as AppServices)

    const conversationMessages = ref<ConversationMessage[]>([
      { id: 'm1', role: 'user', content: 'hello', originalContent: 'hello' } as any
    ])

    const optimizationMode = ref<'system' | 'user'>('system')
    const selectedOptimizeModelKey = ref('model-1')
    const selectedTemplate = ref<Template | null>({ id: 'tpl-1' } as any)
    const selectedIterateTemplate = ref<Template | null>({ id: 'tpl-iter' } as any)

    const optimizer = useConversationOptimization(
      services,
      conversationMessages as any,
      optimizationMode as any,
      selectedOptimizeModelKey,
      selectedTemplate,
      selectedIterateTemplate
    )

    await optimizer.selectMessage(conversationMessages.value[0]!)
    await optimizer.optimizeMessage()

    expect(promptService.optimizeMessageStream).toHaveBeenCalledTimes(1)
    expect(historyManager.createNewChain).toHaveBeenCalledTimes(1)

    expect(conversationMessages.value[0]!.content).toBe('opt msg')
    expect(optimizer.optimizedPrompt.value).toBe('opt msg')
    expect(optimizer.currentChainId.value).toBe('chain-pro-1')
    expect(optimizer.currentRecordId.value).toBe('v1')
    expect(optimizer.messageChainMap.value.get('m1')).toBe('chain-pro-1')

    expect(proSession.chainId).toBe('chain-pro-1')
    expect(proSession.versionId).toBe('v1')
    expect(proSession.messageChainMap).toEqual({ m1: 'chain-pro-1' })
  })
})

