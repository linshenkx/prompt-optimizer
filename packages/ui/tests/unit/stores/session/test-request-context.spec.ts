import { describe, it, expect } from 'vitest'
import { useBasicUserSession } from '../../../../src/stores/session/useBasicUserSession'
import { useBasicSystemSession } from '../../../../src/stores/session/useBasicSystemSession'
import { useProVariableSession } from '../../../../src/stores/session/useProVariableSession'
import { useProMultiMessageSession } from '../../../../src/stores/session/useProMultiMessageSession'
import { createPreferenceServiceStub, createTestPinia } from '../../../utils/pinia-test-helpers'

describe('test answer prompt provenance', () => {
  for (const createStore of [useBasicUserSession, useBasicSystemSession, useProVariableSession, useProMultiMessageSession]) {
    it(`${createStore.$id} keeps the submitted prompt after edits and session restore`, async () => {
      const data = new Map<string, unknown>()
      const { pinia } = createTestPinia({ preferenceService: createPreferenceServiceStub({
        get: async <T,>(key: string, fallback: T) => (data.get(key) ?? fallback) as T,
        set: async (key, value) => { data.set(key, JSON.parse(JSON.stringify(value))) },
      }) })
      const session = createStore(pinia)
      session.testVariantResults.a = { result: 'old answer', reasoning: '', requestPrompt: 'exact resolved input' }
      session.optimizedPrompt = 'subsequent edit'
      await session.saveSession()
      session.testVariantResults.a = { result: '', reasoning: '' }
      await session.restoreSession()
      expect(session.testVariantResults.a).toEqual({ result: 'old answer', reasoning: '', requestPrompt: 'exact resolved input' })
      expect(session.optimizedPrompt).toBe('subsequent edit')
    })
  }
})
