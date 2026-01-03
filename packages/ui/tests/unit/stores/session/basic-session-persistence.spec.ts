import { describe, it, expect, vi } from 'vitest'
import { useBasicSystemSession } from '../../../../src/stores/session/useBasicSystemSession'
import { useBasicUserSession } from '../../../../src/stores/session/useBasicUserSession'
import { createTestPinia } from '../../../utils/pinia-test-helpers'
import { TEMPLATE_SELECTION_KEYS } from '@prompt-optimizer/core'

describe('Session stores (basic) persistence', () => {
  it('basic-system saveSession writes snapshot to preferenceService', async () => {
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

    const store = useBasicSystemSession(pinia)
    store.updatePrompt('p')
    store.updateOptimizedResult({ optimizedPrompt: 'o', reasoning: 'r', chainId: 'c', versionId: 'v' })
    store.updateTestContent('t')
    store.updateTemplate('tpl')
    store.updateIterateTemplate('tpl-iter')

    await store.saveSession()

    expect(set).toHaveBeenCalledTimes(1)
    expect(set.mock.calls[0]?.[0]).toBe('session/v1/basic-system')

    const saved = JSON.parse(String(set.mock.calls[0]?.[1] || '{}'))
    expect(saved).toMatchObject({
      prompt: 'p',
      optimizedPrompt: 'o',
      reasoning: 'r',
      chainId: 'c',
      versionId: 'v',
      testContent: 't',
      selectedTemplateId: 'tpl',
      selectedIterateTemplateId: 'tpl-iter',
    })
  })

  it('basic-user restoreSession migrates legacy template selection when missing', async () => {
    const get = vi.fn(async (key: string, defaultValue: any) => {
      if (key === 'session/v1/basic-user') return ''
      if (key === TEMPLATE_SELECTION_KEYS.USER_OPTIMIZE_TEMPLATE) return 'legacy-template'
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

    const store = useBasicUserSession(pinia)
    await store.restoreSession()

    expect(store.selectedTemplateId).toBe('legacy-template')
    expect(get).toHaveBeenCalledWith('session/v1/basic-user', '')
  })
})

