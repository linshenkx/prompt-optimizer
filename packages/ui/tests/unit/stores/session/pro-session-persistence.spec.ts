import { describe, it, expect, vi } from 'vitest'
import { createTestPinia } from '../../../utils/pinia-test-helpers'
import { useProMultiMessageSession } from '../../../../src/stores/session/useProMultiMessageSession'
import { useProVariableSession } from '../../../../src/stores/session/useProVariableSession'
import { TEMPLATE_SELECTION_KEYS } from '@prompt-optimizer/core'

describe('Session stores (pro) persistence', () => {
  it('pro-multi saveSession writes snapshot to preferenceService', async () => {
    const set = vi.fn(async () => {})

    const { pinia } = createTestPinia({
      preferenceService: {
        get: async <T,>(_key: string, defaultValue: T) => defaultValue,
        set,
        delete: async () => {},
        keys: async () => [],
        clear: async () => {},
        getAll: async () => ({}),
        exportData: async () => ({}),
        importData: async () => {},
        getDataType: async () => 'preference',
        validateData: async () => true,
      } as any
    })

    const store = useProMultiMessageSession(pinia)
    store.updateConversationMessages([{ id: 'm1', role: 'user', content: 'c1' }] as any)
    store.selectMessage('m1')
    store.updateOptimizedResult({ optimizedPrompt: 'o', reasoning: 'r', chainId: 'c', versionId: 'v' })
    store.setMessageChainMap({ m1: 'c' })
    store.updateTemplate('tpl')
    store.updateIterateTemplate('tpl-iter')

    await store.saveSession()

    expect(set).toHaveBeenCalled()
    const lastCall = set.mock.calls.at(-1)
    expect(lastCall?.[0]).toBe('session/v1/pro-multi')

    const raw = lastCall?.[1]
    const saved =
      typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw as Record<string, unknown> | undefined) || {}
    expect(saved).toMatchObject({
      selectedMessageId: 'm1',
      optimizedPrompt: 'o',
      reasoning: 'r',
      chainId: 'c',
      versionId: 'v',
      messageChainMap: { m1: 'c' },
      selectedTemplateId: 'tpl',
      selectedIterateTemplateId: 'tpl-iter',
    })
  })

  it('pro-variable restoreSession migrates legacy optimize/iterate templates when missing', async () => {
    const get = vi.fn(async (key: string, defaultValue: any) => {
      if (key === 'session/v1/pro-variable') return null
      if (key === TEMPLATE_SELECTION_KEYS.CONTEXT_USER_OPTIMIZE_TEMPLATE) return 'legacy-opt'
      if (key === TEMPLATE_SELECTION_KEYS.CONTEXT_ITERATE_TEMPLATE) return 'legacy-iter'
      return defaultValue
    })

    const { pinia } = createTestPinia({
      preferenceService: {
        get,
        set: async () => {},
        delete: async () => {},
        keys: async () => [],
        clear: async () => {},
        getAll: async () => ({}),
        exportData: async () => ({}),
        importData: async () => {},
        getDataType: async () => 'preference',
        validateData: async () => true,
      } as any
    })

    const store = useProVariableSession(pinia)
    await store.restoreSession()

    expect(store.selectedTemplateId).toBe('legacy-opt')
    expect(store.selectedIterateTemplateId).toBe('legacy-iter')

    // restoreSession 会读取 3 个键：
    // 1. session/v1/pro-variable
    // 2. app:selected-context-user-optimize-template (迁移)
    // 3. app:selected-context-iterate-template (迁移)
    expect(get).toHaveBeenCalledTimes(3)
    expect(get).toHaveBeenCalledWith('session/v1/pro-variable', null)
  })
})
