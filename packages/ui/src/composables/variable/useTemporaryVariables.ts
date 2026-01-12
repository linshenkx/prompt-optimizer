/**
 * 临时变量管理 Composable
 *
 * 特性：
 * - 仅内存存储（刷新丢失）
 * - 对外接口保持不变（兼容旧调用方）
 * - 底层由 Pinia store 承载状态
 */

import { readonly, type Ref } from 'vue'
import { storeToRefs, getActivePinia } from 'pinia'
import { useTemporaryVariablesStore } from '../../stores/temporaryVariables'

/**
 * 临时变量管理器接口
 */
export interface TemporaryVariablesManager {
  /** 临时变量存储（只读） */
  readonly temporaryVariables: Readonly<Ref<Record<string, string>>>

  /** 设置临时变量 */
  setVariable: (name: string, value: string) => void

  /** 获取临时变量值 */
  getVariable: (name: string) => string | undefined

  /** 删除临时变量 */
  deleteVariable: (name: string) => void

  /** 清空所有临时变量 */
  clearAll: () => void

  /** 检查变量是否存在 */
  hasVariable: (name: string) => boolean

  /** 列出所有临时变量 */
  listVariables: () => Record<string, string>

  /** 批量设置变量 */
  batchSet: (variables: Record<string, string>) => void

  /** 批量删除变量 */
  batchDelete: (names: string[]) => void
}

/**
 * 使用临时变量管理器
 *
 * ⚠️ 使用前提：
 * 必须在应用入口已执行 `installPinia(app)` 后再调用。
 * 如果在非组件上下文（如纯函数/服务层）使用，会抛出错误。
 *
 * @throws {Error} 如果 Pinia 未安装或无 active pinia instance
 *
 * @example
 * ```typescript
 * // ✅ 正确：在组件或 setup 函数中使用
 * export default defineComponent({
 *   setup() {
 *     const tempVars = useTemporaryVariables()
 *     tempVars.setVariable('name', 'value')
 *   }
 * })
 *
 * // ❌ 错误：在模块顶层或纯函数中使用
 * const tempVars = useTemporaryVariables()  // 会抛出错误
 * ```
 */
export function useTemporaryVariables(): TemporaryVariablesManager {
  // ✅ Codex 建议：显式检测 active pinia
  // 避免 try-catch 吞掉配置错误，导致"静默不生效"
  const activePinia = getActivePinia()
  if (!activePinia) {
    throw new Error(
      '[useTemporaryVariables] Pinia not installed or no active pinia instance. ' +
      'Make sure you have called installPinia(app) before using this composable, ' +
      'and you are calling it within a component setup or after app is mounted.'
    )
  }

  const store = useTemporaryVariablesStore()
  const { temporaryVariables } = storeToRefs(store)

  return {
    temporaryVariables: readonly(temporaryVariables) as Readonly<
      Ref<Record<string, string>>
    >,
    setVariable: store.setVariable,
    getVariable: store.getVariable,
    deleteVariable: store.deleteVariable,
    clearAll: store.clearAll,
    hasVariable: store.hasVariable,
    listVariables: store.listVariables,
    batchSet: store.batchSet,
    batchDelete: store.batchDelete,
  }
}
