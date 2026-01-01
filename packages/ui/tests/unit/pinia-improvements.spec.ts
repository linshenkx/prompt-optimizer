/**
 * Pinia 改进功能测试
 *
 * 基于 Codex 建议添加的回归测试：
 * 1. useTemporaryVariables() 无 active pinia 时抛错
 * 2. withMockPiniaServices() 的清理/恢复行为
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setPiniaServices, getPiniaServices } from '../../src/plugins/pinia'
import { useTemporaryVariables } from '../../src/composables/variable/useTemporaryVariables'
import { createTestPinia, withMockPiniaServices, createPreferenceServiceStub } from '../utils/pinia-test-helpers'

describe('Pinia 改进功能测试', () => {
  // 每个测试前清理全局服务
  beforeEach(() => {
    setPiniaServices(null)
  })

  describe('useTemporaryVariables 错误处理', () => {
    it('应该在无 active pinia 时抛出清晰错误', () => {
      // ✅ Codex 建议：测试无 active pinia 时的错误抛出
      expect(() => {
        useTemporaryVariables()
      }).toThrow('[useTemporaryVariables] Pinia not installed or no active pinia instance')
    })

    it('错误信息应包含 installPinia 指引', () => {
      // ✅ Codex 建议：确保错误信息包含如何修复的指引
      try {
        useTemporaryVariables()
        expect.fail('应该抛出错误')
      } catch (error: any) {
        expect(error.message).toContain('installPinia(app)')
        expect(error.message).toContain('component setup')
      }
    })

    it('应该在有 active pinia 时正常工作', () => {
      // 创建测试环境
      const { pinia } = createTestPinia()

      // 应该不抛错
      expect(() => {
        useTemporaryVariables()
      }).not.toThrow()
    })
  })

  describe('withMockPiniaServices 清理/恢复行为', () => {
    it('应该在测试后恢复到调用前的服务状态', async () => {
      // ✅ Codex 建议：测试"设置→还原"行为

      // 1. 设置初始服务
      const initialService = { test: 'initial' } as any
      setPiniaServices(initialService)
      expect(getPiniaServices()).toBe(initialService)

      // 2. 在 withMockPiniaServices 内使用新服务
      await withMockPiniaServices(
        { preferenceService: createPreferenceServiceStub() },
        async ({ services }) => {
          // 内部应该是新服务
          expect(getPiniaServices()).not.toBe(initialService)
          expect(services.preferenceService).toBeDefined()
        }
      )

      // 3. 退出后应该恢复到初始服务
      expect(getPiniaServices()).toBe(initialService)
    })

    it('应该支持嵌套调用', async () => {
      // ✅ Codex 建议：支持嵌套 helper

      const outerService = { test: 'outer' } as any
      const innerService = { test: 'inner' } as any

      setPiniaServices(outerService)

      await withMockPiniaServices(
        { preferenceService: createPreferenceServiceStub() },
        async () => {
          const currentOuter = getPiniaServices()
          expect(currentOuter).not.toBe(outerService)

          // 嵌套调用
          await withMockPiniaServices(
            { preferenceService: createPreferenceServiceStub() },
            async () => {
              const currentInner = getPiniaServices()
              expect(currentInner).not.toBe(currentOuter)
            }
          )

          // 退出内层后应该恢复到外层
          expect(getPiniaServices()).toBe(currentOuter)
        }
      )

      // 退出外层后应该恢复到最初
      expect(getPiniaServices()).toBe(outerService)
    })

    it('应该在测试函数抛错时仍然恢复状态', async () => {
      // ✅ 测试错误处理场景

      const initialService = { test: 'initial' } as any
      setPiniaServices(initialService)

      try {
        await withMockPiniaServices(
          { preferenceService: createPreferenceServiceStub() },
          async () => {
            throw new Error('测试错误')
          }
        )
        expect.fail('应该抛出错误')
      } catch (error: any) {
        expect(error.message).toBe('测试错误')
      }

      // 即使测试函数抛错，也应该恢复状态
      expect(getPiniaServices()).toBe(initialService)
    })

    it('应该在 null 状态下也能正常恢复', async () => {
      // 初始状态为 null
      setPiniaServices(null)
      expect(getPiniaServices()).toBeNull()

      await withMockPiniaServices(
        { preferenceService: createPreferenceServiceStub() },
        async () => {
          expect(getPiniaServices()).not.toBeNull()
        }
      )

      // 应该恢复到 null
      expect(getPiniaServices()).toBeNull()
    })
  })

  describe('createTestPinia 基础功能', () => {
    it('应该创建预配置的 Pinia 实例', () => {
      const { pinia, services, cleanup } = createTestPinia()

      expect(pinia).toBeDefined()
      expect(services).toBeDefined()
      expect(services.preferenceService).toBeDefined()
      expect(cleanup).toBeInstanceOf(Function)
    })

    it('应该支持服务覆盖', () => {
      const customGet = vi.fn()
      const { services } = createTestPinia({
        preferenceService: createPreferenceServiceStub({
          get: customGet
        })
      })

      expect(services.preferenceService.get).toBe(customGet)
    })

    it('cleanup 应该清理全局服务', () => {
      const { cleanup } = createTestPinia()

      expect(getPiniaServices()).not.toBeNull()

      cleanup()

      expect(getPiniaServices()).toBeNull()
    })
  })
})
