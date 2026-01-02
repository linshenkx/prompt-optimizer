/**
 * Pinia 测试辅助工具
 *
 * 提供标准化的 Pinia 测试设置和清理机制
 *
 * 设计原则（基于 Codex 建议）：
 * - 全局 afterEach 兜底清理（在 tests/setup.ts 中配置）
 * - Helper 提供标准测试入口（更短、更一致）
 * - 两者结合使用，即使 helper 忘了清理也不怕
 */

import { createPinia, type Pinia } from 'pinia'
import { createApp } from 'vue'
import { setPiniaServices, getPiniaServices } from '../../src/plugins/pinia'
import type { AppServices } from '../../src/types/services'
import type { IPreferenceService } from '@prompt-optimizer/core'

/**
 * 创建 PreferenceService stub（可复用的默认实现）
 *
 * @param overrides - 可选的方法覆盖
 * @returns PreferenceService stub
 *
 * @example
 * ```typescript
 * const preferenceService = createPreferenceServiceStub({
 *   get: vi.fn().mockResolvedValue('saved-data'),
 *   set: vi.fn().mockResolvedValue(undefined)
 * })
 * ```
 */
export function createPreferenceServiceStub(
  overrides: Partial<IPreferenceService> = {}
): IPreferenceService {
  return {
    get: async <T,>(_key: string, defaultValue: T) => defaultValue,
    set: async () => {},
    delete: async () => {},
    keys: async () => [],
    clear: async () => {},
    getAll: async () => ({}),
    exportData: async () => ({}),
    importData: async () => {},
    getDataType: async () => 'preference',
    validateData: async () => true,
    ...overrides,
  }
}

/**
 * 创建用于测试的 Pinia 实例和服务
 *
 * 这是 Codex 建议的标准测试入口，提供：
 * - 预配置的 Pinia 实例
 * - 默认的服务 stub（可覆盖）
 * - 清理函数（可选调用，全局 afterEach 会兜底）
 *
 * @param servicesOverrides - 可选的服务覆盖配置
 * @returns { pinia, services, cleanup }
 *
 * @example
 * ```typescript
 * it('should save session', async () => {
 *   const { pinia, services } = createTestPinia({
 *     preferenceService: createPreferenceServiceStub({
 *       set: vi.fn().mockResolvedValue(undefined)
 *     })
 *   })
 *
 *   const store = useBasicUserSession(pinia)
 *   await store.saveSession()
 *
 *   expect(services.preferenceService.set).toHaveBeenCalled()
 *   // 清理由全局 afterEach 自动完成，无需手动 cleanup
 * })
 * ```
 */
export function createTestPinia(
  servicesOverrides: Partial<AppServices> = {}
): {
  pinia: Pinia
  services: AppServices
  cleanup: () => void
} {
  // 创建默认服务 stub
  const defaultServices: AppServices = {
    preferenceService: createPreferenceServiceStub(),
    // 其他服务可以按需添加默认 stub
    ...servicesOverrides,
  } as AppServices

  // 创建 Pinia 实例
  const pinia = createPinia()

  // 创建 Vue 应用（Pinia 需要）
  const app = createApp({ render: () => null })
  app.use(pinia)

  // 设置全局服务（供 getPiniaServices() 使用）
  setPiniaServices(defaultServices)

  // 提供清理函数（可选调用，全局 afterEach 会兜底）
  const cleanup = () => {
    setPiniaServices(null)
  }

  return {
    pinia,
    services: defaultServices,
    cleanup,
  }
}

/**
 * 使用 mock 服务运行测试函数（自动清理/恢复）
 *
 * 这是更简洁的测试入口，适合需要自动清理的场景。
 *
 * ✅ Codex 建议：支持嵌套调用和可恢复
 * - 结束时恢复到调用前的 services，而不是一律置 null
 * - 避免嵌套 helper 或同用例多次切换服务时出现问题
 *
 * @param servicesOverrides - 服务覆盖配置
 * @param testFn - 测试函数
 *
 * @example
 * ```typescript
 * it('should work with services', async () => {
 *   await withMockPiniaServices(
 *     {
 *       preferenceService: createPreferenceServiceStub({
 *         get: vi.fn().mockResolvedValue('saved-data')
 *       })
 *     },
 *     async ({ pinia, services }) => {
 *       const store = useBasicUserSession(pinia)
 *       await store.restoreSession()
 *       expect(store.prompt).toBe('saved-data')
 *     }
 *   )
 *   // 自动恢复到调用前的状态
 * })
 *
 * // ✅ 支持嵌套调用
 * it('supports nested calls', async () => {
 *   await withMockPiniaServices({ service1 }, async () => {
 *     // 外层服务
 *     await withMockPiniaServices({ service2 }, async () => {
 *       // 内层服务
 *     })
 *     // 自动恢复到外层服务
 *   })
 * })
 * ```
 */
export async function withMockPiniaServices(
  servicesOverrides: Partial<AppServices>,
  testFn: (ctx: { pinia: Pinia; services: AppServices }) => void | Promise<void>
): Promise<void> {
  // ✅ Codex 建议：保存调用前的 services，结束时恢复
  const previousServices = getPiniaServices()

  const { pinia, services, cleanup } = createTestPinia(servicesOverrides)

  try {
    await testFn({ pinia, services })
  } finally {
    cleanup()
    // ✅ 恢复到调用前的状态（而非一律置 null）
    setPiniaServices(previousServices)
  }
}
