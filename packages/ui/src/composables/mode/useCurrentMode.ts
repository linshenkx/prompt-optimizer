import { computed, ref, type Ref, type ComputedRef } from 'vue'

import { useFunctionMode, type FunctionMode } from './useFunctionMode'
import { useProSubMode } from './useProSubMode'
import type { ProSubMode } from '@prompt-optimizer/core'

/**
 * 只读模式访问 composable 的返回类型
 */
export interface UseCurrentModeReturn {
  /** 当前功能模式（一级模式） */
  functionMode: ComputedRef<FunctionMode>
  /** 当前 Pro 子模式（二级模式，仅在 Pro 模式下有效） */
  proSubMode: ComputedRef<ProSubMode>
  /** 是否为基础模式 */
  isBasicMode: ComputedRef<boolean>
  /** 是否为上下文模式（Pro 模式） */
  isProMode: ComputedRef<boolean>
  /** 是否为图像模式 */
  isImageMode: ComputedRef<boolean>
  /** 是否为多消息模式（Pro 模式 + multi 子模式） */
  isMultiMode: ComputedRef<boolean>
  /** 是否为变量模式（Pro 模式 + variable 子模式） */
  isVariableMode: ComputedRef<boolean>
}

/**
 * 只读模式访问 composable
 *
 * **使用场景**:
 * 用于 UI 组件中只需要读取当前模式状态，而不需要修改模式的场景。
 * 例如：根据模式显示/隐藏某些 UI 元素，或者根据模式调整组件行为。
 *
 * **核心特性**:
 * - ✅ 无需传递 services 参数，使用更简洁
 * - ✅ 访问全局单例模式状态，保证数据一致性
 * - ✅ 只读访问，不提供修改能力，避免误操作
 * - ✅ 提供便捷的布尔判断计算属性
 *
 * **为什么不需要 services**:
 * - `useFunctionMode` 和 `useProSubMode` 使用单例模式管理状态
 * - 单例在 App.vue 初始化时已完成数据加载（从 preferenceService）
 * - 组件只需读取内存中的单例状态，无需访问 preferenceService
 * - 传入 `null` services 不会影响读取，只会在尝试写入时报错（符合只读设计）
 *
 * **与 useFunctionMode/useProSubMode 的关系**:
 * - 复用现有 composables 的单例模式，避免重复实现
 * - 提供更友好的只读接口，隐藏写入能力
 * - 添加便捷的布尔判断，减少组件中的重复代码
 *
 * **架构说明**:
 * ```
 * App.vue (有 services)
 *   └─> useFunctionMode(services)  <── 负责初始化和持久化
 *         └─> Singleton (内存状态)
 *
 * UI Component (无 services)
 *   └─> useCurrentMode()  <── 只读访问
 *         └─> useFunctionMode(null)
 *               └─> Singleton (内存状态，相同引用)
 * ```
 *
 * @example
 * ```typescript
 * // 在 UI 组件中使用
 * const { isBasicMode, isProMode, functionMode } = useCurrentMode()
 *
 * // 根据模式条件渲染
 * const showVariableForm = computed(() => {
 *   if (isBasicMode.value) return false  // 基础模式不显示变量功能
 *   return true
 * })
 *
 * // 根据模式调整行为
 * watch(functionMode, (mode) => {
 *   console.log('当前模式:', mode)
 * })
 * ```
 *
 * @returns 包含只读模式状态的响应式对象
 */
export function useCurrentMode(): UseCurrentModeReturn {
  // 使用 null services 访问单例状态（只读模式）
  const nullServices = ref(null) as Ref<null>

  // 获取功能模式和 Pro 子模式的只读引用
  const { functionMode: _functionMode } = useFunctionMode(nullServices)
  const { proSubMode: _proSubMode } = useProSubMode(nullServices)

  return {
    // 基础状态（计算属性包装，提供类型安全）
    functionMode: computed(() => _functionMode.value),
    proSubMode: computed(() => _proSubMode.value),

    // 便捷布尔判断（一级模式）
    isBasicMode: computed(() => _functionMode.value === 'basic'),
    isProMode: computed(() => _functionMode.value === 'pro'),
    isImageMode: computed(() => _functionMode.value === 'image'),

    // 便捷布尔判断（二级模式，仅 Pro 模式有效）
    isMultiMode: computed(() =>
      _functionMode.value === 'pro' && _proSubMode.value === 'multi'
    ),
    isVariableMode: computed(() =>
      _functionMode.value === 'pro' && _proSubMode.value === 'variable'
    ),
  }
}
