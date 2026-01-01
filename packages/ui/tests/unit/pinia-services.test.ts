/**
 * Pinia 服务集成测试
 *
 * 测试 getPiniaServices() 与 session store 的集成
 */

import type { IPreferenceService } from '@prompt-optimizer/core'
import { useBasicUserSession } from '../../src/stores/session/useBasicUserSession'
import { createTestPinia, createPreferenceServiceStub } from '../utils/pinia-test-helpers'

describe('Pinia 服务集成', () => {
  it('session store 应该能通过 getPiniaServices 访问服务并持久化', async () => {
    // ✅ 使用 createTestPinia helper，代码更简洁
    const set = vi.fn<IPreferenceService['set']>().mockResolvedValue(undefined)

    const { pinia } = createTestPinia({
      preferenceService: createPreferenceServiceStub({ set })
    })

    const store = useBasicUserSession(pinia)
    store.updatePrompt('hello')

    await store.saveSession()

    expect(set).toHaveBeenCalledTimes(1)
    expect(set.mock.calls[0]?.[0]).toBe('session/v1/basic-user')
    expect(typeof set.mock.calls[0]?.[1]).toBe('string')
    // ✅ 清理由全局 afterEach 自动完成，无需手动 cleanup
  })
})
