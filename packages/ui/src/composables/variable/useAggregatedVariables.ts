/**
 * 聚合变量管理 Composable
 *
 * 功能说明：
 * - 聚合三种类型的变量：预定义变量、全局变量、临时变量
 * - 自动处理变量优先级：临时 > 全局 > 预定义
 * - 提供统一的变量访问接口
 * - 响应式更新，任何一层变量变化都会自动反映
 *
 * 变量优先级（从高到低）：
 * 1. 临时变量（temporary）- 会话级别，不持久化
 * 2. 全局变量（global）- 持久化存储，跨会话保留
 * 3. 预定义变量（predefined）- 系统内置，不可修改
 *
 * 使用场景：
 * - 预览功能：需要展示所有可用变量的替换结果
 * - 变量检测：检查哪些变量缺失、来源是什么
 * - 统一变量访问：不需要关心变量来源，直接获取最终值
 */

import { computed, type ComputedRef, type Ref } from 'vue'
import { useTemporaryVariables } from './useTemporaryVariables'
import type { VariableManagerHooks } from '../prompt/useVariableManager'
import { PREDEFINED_VARIABLES } from '../../types/variable'

/**
 * 变量来源类型
 */
export type AggregatedVariableSource = 'predefined' | 'global' | 'temporary'

/**
 * 按来源分组的变量
 */
export interface VariablesBySource {
  /** 预定义变量（系统内置） */
  predefined: Record<string, string>
  /** 全局变量（持久化） */
  global: Record<string, string>
  /** 临时变量（会话级别） */
  temporary: Record<string, string>
}

/**
 * 聚合变量管理器接口
 */
export interface AggregatedVariablesManager {
  /** 聚合后的所有变量（按优先级合并） */
  readonly allVariables: ComputedRef<Record<string, string>>

  /** 按来源分组的变量 */
  readonly variablesBySource: ComputedRef<VariablesBySource>

  /** 查询变量来源 */
  getVariableSource: (name: string) => AggregatedVariableSource | null

  /** 获取变量值（按优先级） */
  getVariable: (name: string) => string | undefined

  /** 检查变量是否存在于任何来源 */
  hasVariable: (name: string) => boolean

  /** 列出所有变量名 */
  listVariableNames: () => string[]
}

/**
 * 使用聚合变量管理器
 *
 * 特性：
 * - 自动聚合三层变量
 * - 优先级自动处理
 * - 响应式更新
 * - 提供来源查询
 *
 * @param variableManager 全局变量管理器（来自 useVariableManager）
 * @param predefinedVariables 预定义变量（可选，默认使用系统内置）
 * @returns 聚合变量管理器
 *
 * @example
 * ```typescript
 * // 在组件中使用
 * const variableManager = useVariableManager(services)
 * const aggregatedVars = useAggregatedVariables(variableManager)
 *
 * // 获取所有变量（自动聚合）
 * const allVars = aggregatedVars.allVariables.value
 *
 * // 查询变量来源
 * const source = aggregatedVars.getVariableSource('userName')
 * // 返回: 'temporary' | 'global' | 'predefined' | null
 *
 * // 检查变量是否存在
 * if (aggregatedVars.hasVariable('userName')) {
 *   console.log('变量存在')
 * }
 * ```
 */
export function useAggregatedVariables(
  variableManager?: VariableManagerHooks,
  predefinedVariables?: Record<string, string>
): AggregatedVariablesManager {

  // 获取临时变量管理器
  const tempVars = useTemporaryVariables()

  // 预定义变量（使用系统内置或自定义）
  const predefinedVarsMap = computed<Record<string, string>>(() => {
    if (predefinedVariables) {
      return predefinedVariables
    }

    const map: Record<string, string> = {}

    // 优先从 variableManager 的 allVariables 中取值，以保留动态上下文
    const resolved = variableManager?.allVariables?.value || {}
    PREDEFINED_VARIABLES.forEach(varName => {
      if (resolved[varName] !== undefined) {
        map[varName] = resolved[varName]
      } else {
        map[varName] = ''
      }
    })

    return map
  })

  // 全局变量
  const globalVarsMap = computed<Record<string, string>>(() => {
    if (!variableManager) return {}
    return variableManager.customVariables?.value || {}
  })

  // 临时变量
  const temporaryVarsMap = computed<Record<string, string>>(() => {
    return tempVars.listVariables()
  })

  /**
   * 按来源分组的变量
   */
  const variablesBySource = computed<VariablesBySource>(() => ({
    predefined: predefinedVarsMap.value,
    global: globalVarsMap.value,
    temporary: temporaryVarsMap.value
  }))

  /**
   * 聚合所有变量（按优先级合并）
   *
   * 优先级：temporary > global > predefined
   * 后面的会覆盖前面的同名变量
   */
  const allVariables = computed<Record<string, string>>(() => {
    return {
      ...predefinedVarsMap.value,  // 最低优先级
      ...globalVarsMap.value,       // 中等优先级
      ...temporaryVarsMap.value     // 最高优先级
    }
  })

  /**
   * 查询变量来源
   * @param name 变量名
   * @returns 变量来源，如果不存在返回 null
   */
  const getVariableSource = (name: string): AggregatedVariableSource | null => {
    // 按优先级从高到低检查
    if (name in temporaryVarsMap.value) {
      return 'temporary'
    }
    if (name in globalVarsMap.value) {
      return 'global'
    }
    if (name in predefinedVarsMap.value) {
      return 'predefined'
    }
    return null
  }

  /**
   * 获取变量值（按优先级）
   * @param name 变量名
   * @returns 变量值，如果不存在返回 undefined
   */
  const getVariable = (name: string): string | undefined => {
    return allVariables.value[name]
  }

  /**
   * 检查变量是否存在于任何来源
   * @param name 变量名
   * @returns 是否存在
   */
  const hasVariable = (name: string): boolean => {
    return name in allVariables.value
  }

  /**
   * 列出所有变量名
   * @returns 所有变量名数组
   */
  const listVariableNames = (): string[] => {
    return Object.keys(allVariables.value)
  }

  return {
    allVariables,
    variablesBySource,
    getVariableSource,
    getVariable,
    hasVariable,
    listVariableNames
  }
}
