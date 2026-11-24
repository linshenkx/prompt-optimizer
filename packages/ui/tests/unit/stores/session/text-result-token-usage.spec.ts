import { describe, expect, it } from 'vitest'
import { createPreferenceServiceStub, createTestPinia } from '../../../utils/pinia-test-helpers'
import { useBasicSystemSession } from '../../../../src/stores/session/useBasicSystemSession'
import { useBasicUserSession } from '../../../../src/stores/session/useBasicUserSession'
import { useProMultiMessageSession } from '../../../../src/stores/session/useProMultiMessageSession'
import { useProVariableSession } from '../../../../src/stores/session/useProVariableSession'
import { setOutputTokenUsage } from '../../../../src/utils/token-usage'

describe.each([useBasicSystemSession, useBasicUserSession, useProMultiMessageSession, useProVariableSession])(
  '$id test result usage',
  useSession => {
    it('restores reported counts with their column and accepts results without counts', async () => {
      const snapshots = new Map<string, string>()
      const preferenceService = createPreferenceServiceStub({
        set: async (key, value) => { snapshots.set(key, JSON.stringify(value)) },
        get: async (key, fallback) => {
          const snapshot = snapshots.get(key)
          return snapshot === undefined ? fallback : JSON.parse(snapshot)
        },
      })
      const session = useSession(createTestPinia({ preferenceService }).pinia)
      session.testVariantResults.a = { result: 'first', reasoning: '' }
      session.testVariantResults.b = { result: 'legacy answer', reasoning: '' }
      setOutputTokenUsage(session.testVariantResults.a, { inputTokens: 0, outputTokens: 14 })
      expect(await session.saveSession()).toBe(true)

      const restored = useSession(createTestPinia({ preferenceService }).pinia)
      await restored.restoreSession()
      expect(restored.testVariantResults.a).toMatchObject({
        result: 'first',
        tokenUsage: { inputTokens: 0, outputTokens: 14, totalTokens: null, cachedInputTokens: null },
      })
      expect(restored.testVariantResults.b).toMatchObject({ result: 'legacy answer' })
      expect(restored.testVariantResults.b).not.toHaveProperty('tokenUsage')
    })
  },
)
