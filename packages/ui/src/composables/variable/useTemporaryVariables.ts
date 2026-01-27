/**
 * 临时变量管理 Composable
 *
 * 特性：
 * - Pro/Image：按子模式 session store 持久化（刷新不丢；子模式之间隔离）
 * - Basic：维持旧行为，仅内存存储（刷新丢失）
 * - 对外接口保持不变（兼容旧调用方）
 * - 底层由 Pinia store 承载状态
 */
 
import { readonly, computed, type Ref } from 'vue'
import { storeToRefs, getActivePinia } from 'pinia'
import { useTemporaryVariablesStore } from '../../stores/temporaryVariables'
import { useSessionManager } from '../../stores/session/useSessionManager'
import { useProVariableSession } from '../../stores/session/useProVariableSession'
import { useProMultiMessageSession } from '../../stores/session/useProMultiMessageSession'
import { useImageText2ImageSession } from '../../stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../stores/session/useImageImage2ImageSession'

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

  const globalStore = useTemporaryVariablesStore()
  const { temporaryVariables: globalTempVars } = storeToRefs(globalStore)

  const sessionManager = useSessionManager()
  const proVariableSession = useProVariableSession()
  const proMultiSession = useProMultiMessageSession()
  const imageText2ImageSession = useImageText2ImageSession()
  const imageImage2ImageSession = useImageImage2ImageSession()

  const { temporaryVariables: proVariableTempVars } = storeToRefs(proVariableSession)
  const { temporaryVariables: proMultiTempVars } = storeToRefs(proMultiSession)
  const { temporaryVariables: imageText2ImageTempVars } = storeToRefs(imageText2ImageSession)
  const { temporaryVariables: imageImage2ImageTempVars } = storeToRefs(imageImage2ImageSession)

  const activeSubModeKey = computed(() => sessionManager.getActiveSubModeKey())

  const getActiveSessionTempRef = () => {
    switch (activeSubModeKey.value) {
      case 'pro-variable':
        return proVariableTempVars
      case 'pro-multi':
        return proMultiTempVars
      case 'image-text2image':
        return imageText2ImageTempVars
      case 'image-image2image':
        return imageImage2ImageTempVars
      default:
        return null
    }
  }

  const temporaryVariables = computed<Record<string, string>>(() => {
    const sessionRef = getActiveSessionTempRef()
    return sessionRef ? sessionRef.value : globalTempVars.value
  })

  const hasOwn = (obj: Record<string, unknown>, key: string) =>
    Object.prototype.hasOwnProperty.call(obj, key)

  const setVariable = (name: string, value: string) => {
    switch (activeSubModeKey.value) {
      case 'pro-variable':
        proVariableSession.setTemporaryVariable(name, value)
        return
      case 'pro-multi':
        proMultiSession.setTemporaryVariable(name, value)
        return
      case 'image-text2image':
        imageText2ImageSession.setTemporaryVariable(name, value)
        return
      case 'image-image2image':
        imageImage2ImageSession.setTemporaryVariable(name, value)
        return
      default:
        globalStore.setVariable(name, value)
    }
  }

  const getVariable = (name: string): string | undefined => {
    switch (activeSubModeKey.value) {
      case 'pro-variable':
        return proVariableSession.getTemporaryVariable(name)
      case 'pro-multi':
        return proMultiSession.getTemporaryVariable(name)
      case 'image-text2image':
        return imageText2ImageSession.getTemporaryVariable(name)
      case 'image-image2image':
        return imageImage2ImageSession.getTemporaryVariable(name)
      default:
        return globalStore.getVariable(name)
    }
  }

  const deleteVariable = (name: string) => {
    switch (activeSubModeKey.value) {
      case 'pro-variable':
        proVariableSession.deleteTemporaryVariable(name)
        return
      case 'pro-multi':
        proMultiSession.deleteTemporaryVariable(name)
        return
      case 'image-text2image':
        imageText2ImageSession.deleteTemporaryVariable(name)
        return
      case 'image-image2image':
        imageImage2ImageSession.deleteTemporaryVariable(name)
        return
      default:
        globalStore.deleteVariable(name)
    }
  }

  const clearAll = () => {
    switch (activeSubModeKey.value) {
      case 'pro-variable':
        proVariableSession.clearTemporaryVariables()
        return
      case 'pro-multi':
        proMultiSession.clearTemporaryVariables()
        return
      case 'image-text2image':
        imageText2ImageSession.clearTemporaryVariables()
        return
      case 'image-image2image':
        imageImage2ImageSession.clearTemporaryVariables()
        return
      default:
        globalStore.clearAll()
    }
  }

  const hasVariable = (name: string) => {
    return hasOwn(temporaryVariables.value, name)
  }

  const listVariables = () => {
    return { ...temporaryVariables.value }
  }

  const batchSet = (variables: Record<string, string>) => {
    for (const [name, value] of Object.entries(variables)) {
      setVariable(name, value)
    }
  }

  const batchDelete = (names: string[]) => {
    for (const name of names) {
      deleteVariable(name)
    }
  }

  return {
    temporaryVariables: readonly(temporaryVariables) as Readonly<Ref<Record<string, string>>>,
    setVariable,
    getVariable,
    deleteVariable,
    clearAll,
    hasVariable,
    listVariables,
    batchSet,
    batchDelete,
  }
}
