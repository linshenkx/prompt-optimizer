/**
 * Session Manager - 会话管理协调器
 *
 * 职责：
 * - 监听模式和子模式切换
 * - 自动保存当前会话，恢复目标会话
 * - 协调6个子模式 Session Store
 * - 提供切换事务锁，避免竞态条件
 *
 * 设计原则（基于 Codex 审查）：
 * - 不另存 subModePreferences（避免双真源）
 * - 通过 injectSubModeReaders 消费现有状态
 * - 使用 isSwitching 锁防止切换期间的竞态
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { BasicSubMode, ProSubMode, ImageSubMode } from '@prompt-optimizer/core'
import type { FunctionMode } from '../../composables/mode/useFunctionMode'
import { getPiniaServices } from '../../plugins/pinia'
import { useBasicSystemSession } from './useBasicSystemSession'
import { useBasicUserSession } from './useBasicUserSession'
import { useProMultiMessageSession } from './useProMultiMessageSession'
import { useProVariableSession } from './useProVariableSession'
import { useImageText2ImageSession } from './useImageText2ImageSession'
import { useImageImage2ImageSession } from './useImageImage2ImageSession'

/**
 * 子模式 key 映射表
 * 格式：{functionMode}-{subMode}
 */
export type SubModeKey =
  | 'basic-system'
  | 'basic-user'
  | 'pro-multi'       // Pro-多消息模式
  | 'pro-variable'    // Pro-变量模式
  | 'image-text2image'  // 文生图
  | 'image-image2image' // 图生图

/**
 * 子模式读取器接口（从外部注入）
 */
export interface SubModeReaders {
  getFunctionMode: () => FunctionMode
  getBasicSubMode: () => BasicSubMode
  getProSubMode: () => ProSubMode
  getImageSubMode: () => ImageSubMode
}

export const useSessionManager = defineStore('sessionManager', () => {
  /**
   * 切换事务锁（Codex 要求）
   * 切换期间禁用自动保存，避免竞态条件
   */
  const isSwitching = ref(false)

  /**
   * 全局保存锁（Codex 建议）
   * 防止所有保存入口（定时器、pagehide、visibilitychange、切换）并发写入
   */
  const saveInFlight = ref(false)

  /**
   * 全量 hydrate 标志（防止“未恢复的默认空 state”在 saveAllSessions 时覆盖持久化内容）
   */
  const hasRestoredAllSessions = ref(false)
  const restoreAllInFlight = ref<Promise<void> | null>(null)

  /**
   * 子模式读取器（从外部注入，避免双真源）
   */
  let readers: SubModeReaders | null = null

  /**
   * 注入子模式读取器
   * 必须在应用启动时调用（PromptOptimizerApp.vue）
   */
  const injectSubModeReaders = (injectedReaders: SubModeReaders) => {
    readers = injectedReaders
  }

  /**
   * 获取当前活动的子模式 key
   */
  const getActiveSubModeKey = (): SubModeKey => {
    if (!readers) {
      console.warn('[SessionManager] 子模式读取器未注入，返回默认值 basic-system')
      return 'basic-system'
    }

    const mode = readers.getFunctionMode()
    let subMode: string

    switch (mode) {
      case 'basic':
        subMode = readers.getBasicSubMode()
        break
      case 'pro':
        subMode = readers.getProSubMode()
        break
      case 'image':
        subMode = readers.getImageSubMode()
        break
      default:
        subMode = 'system'
    }

    return `${mode}-${subMode}` as SubModeKey
  }

  /**
   * 根据指定的 mode 和 subMode 计算子模式 key
   * 用于在 watch 中计算 oldKey
   */
  const computeSubModeKey = (
    mode: FunctionMode,
    basicSubMode: string,
    proSubMode: string,
    imageSubMode: string
  ): SubModeKey => {
    let subMode: string

    switch (mode) {
      case 'basic':
        subMode = basicSubMode
        break
      case 'pro':
        subMode = proSubMode
        break
      case 'image':
        subMode = imageSubMode
        break
      default:
        subMode = 'system'
    }

    return `${mode}-${subMode}` as SubModeKey
  }

  /**
   * 切换功能模式（响应外部 functionMode 变化）
   * @param fromKey 旧模式的 key（由 watch 传入）
   * @param toKey 新模式的 key（由 watch 传入）
   */
  const switchMode = async (fromKey: SubModeKey, toKey: SubModeKey) => {
    if (isSwitching.value) {
      return
    }

    isSwitching.value = true
    try {
      // 1. 保存旧模式会话
      await saveSubModeSession(fromKey)

      // 2. 恢复新模式会话
      await restoreSubModeSession(toKey)
    } catch (error) {
      console.error('[SessionManager] 模式切换失败:', error)
    } finally {
      isSwitching.value = false
    }
  }

  /**
   * 切换子模式（响应外部 subMode 变化）
   * @param fromKey 旧子模式的 key（由 watch 传入）
   * @param toKey 新子模式的 key（由 watch 传入）
   */
  const switchSubMode = async (fromKey: SubModeKey, toKey: SubModeKey) => {
    if (isSwitching.value) {
      return
    }

    isSwitching.value = true
    try {
      // 1. 保存旧子模式会话
      await saveSubModeSession(fromKey)

      // 2. 恢复新子模式会话
      await restoreSubModeSession(toKey)
    } catch (error) {
      console.error('[SessionManager] 子模式切换失败:', error)
    } finally {
      isSwitching.value = false
    }
  }

  /**
   * 内部方法:保存指定子模式会话（不加锁）
   * 仅供 saveSubModeSession 和 saveAllSessions 调用
   */
  const _saveSubModeSessionUnsafe = async (key: SubModeKey) => {
    try {
      switch (key) {
        case 'basic-system':
          await useBasicSystemSession().saveSession()
          break
        case 'basic-user':
          await useBasicUserSession().saveSession()
          break
        case 'pro-multi':
          await useProMultiMessageSession().saveSession()
          break
        case 'pro-variable':
          await useProVariableSession().saveSession()
          break
        case 'image-text2image':
          await useImageText2ImageSession().saveSession()
          break
        case 'image-image2image':
          await useImageImage2ImageSession().saveSession()
          break
      }
    } catch (error) {
      console.error(`[SessionManager] 保存 ${key} 会话失败:`, error)
    }
  }

  /**
   * 保存指定子模式会话（带全局锁保护）
   * 🔧 加强防护：未恢复前不允许保存，避免覆盖持久化数据
   */
  const saveSubModeSession = async (key: SubModeKey) => {
    // ✅ 强制检查：必须先恢复才能保存
    if (!hasRestoredAllSessions.value) {
      console.warn(`[SessionManager] 尝试保存 ${key} 但未完成全局恢复，跳过以避免覆盖持久化数据`)
      return
    }

    // ⚠️ 并发保护：如果上一次保存还在进行中，跳过本次
    if (saveInFlight.value) {
      console.warn(`[SessionManager] 保存操作进行中，跳过 ${key} 会话保存`)
      return
    }

    try {
      saveInFlight.value = true
      await _saveSubModeSessionUnsafe(key)
    } finally {
      saveInFlight.value = false
    }
  }

  /**
   * 恢复指定子模式会话
   */
  const restoreSubModeSession = async (key: SubModeKey) => {
    try {
      switch (key) {
        case 'basic-system':
          await useBasicSystemSession().restoreSession()
          break
        case 'basic-user':
          await useBasicUserSession().restoreSession()
          break
        case 'pro-multi':
          await useProMultiMessageSession().restoreSession()
          break
        case 'pro-variable':
          await useProVariableSession().restoreSession()
          break
        case 'image-text2image':
          await useImageText2ImageSession().restoreSession()
          break
        case 'image-image2image':
          await useImageImage2ImageSession().restoreSession()
          break
      }
    } catch (error) {
      console.error(`[SessionManager] 恢复 ${key} 会话失败:`, error)
    }
  }

  /**
   * 保存所有会话（用于应用退出前，带全局锁保护）
   * ⚠️ 关键修复：等待当前保存完成，而非直接跳过（避免退出时丢失数据）
   * ⚠️ Codex 修复：使用 acquired 标记防止误解锁
   */
  /**
   * 恢复所有子模式会话到内存（hydrate all）
   *
   * 目的：避免只恢复当前子模式时，其它子模式仍保持默认空值，
   * 在 pagehide/onBeforeUnmount 的 saveAllSessions 中被写回持久化，从而覆盖历史数据。
   */
  const restoreAllSessions = async () => {
    if (hasRestoredAllSessions.value) {
      return
    }

    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      return
    }

    if (restoreAllInFlight.value) {
      await restoreAllInFlight.value
      return
    }

    const task = (async () => {
      // IMPORTANT:
      // Do NOT restore all sessions in parallel.
      // Some users may have very large persisted snapshots (e.g. long prompts / test outputs / image metadata).
      // Parallel JSON.parse + reactive assignment across 6 stores can spike memory and crash the browser process.
      // Restore sequentially to reduce peak memory usage and avoid "browser crash" reports.
      const keys: SubModeKey[] = [
        'basic-system',
        'basic-user',
        'pro-multi',
        'pro-variable',
        'image-text2image',
        'image-image2image',
      ]

      for (const key of keys) {
        await restoreSubModeSession(key)
        // Yield to the event loop to keep the UI responsive and reduce long-task pressure.
        await new Promise(resolve => setTimeout(resolve, 0))
      }
      hasRestoredAllSessions.value = true
    })()

    restoreAllInFlight.value = task
    try {
      await task
    } finally {
      restoreAllInFlight.value = null
    }
  }

  const saveAllSessions = async () => {
    // ⚠️ 等待当前保存完成（最多等待 5 秒）
    const startTime = Date.now()
    const MAX_WAIT = 5000 // 5 秒超时

    await restoreAllSessions()

    while (saveInFlight.value) {
      if (Date.now() - startTime > MAX_WAIT) {
        // ⚠️ 超时时直接返回，不要强制执行（避免误解锁）
        console.warn('[SessionManager] 等待保存完成超时，放弃本次保存')
        return
      }
      // 等待 50ms 后重试
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // ⚠️ 记录是否是我获得的锁（防御性编程）
    let acquired = false

    try {
      saveInFlight.value = true
      acquired = true // ✅ 标记：我获得了锁

      // IMPORTANT:
      // Save sequentially to reduce peak memory usage for very large sessions.
      // (Parallel JSON.stringify across 6 stores can spike memory and crash the browser on pagehide/unmount.)
      const keys: SubModeKey[] = [
        'basic-system',
        'basic-user',
        'pro-multi',
        'pro-variable',
        'image-text2image',
        'image-image2image',
      ]
      for (const key of keys) {
        await _saveSubModeSessionUnsafe(key)
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    } catch (error) {
      console.error('[SessionManager] 保存所有会话失败:', error)
    } finally {
      // ✅ 只有我获得的锁，我才释放
      if (acquired) {
        saveInFlight.value = false
      }
    }
  }

  return {
    // 状态
    isSwitching,

    // 方法
    injectSubModeReaders,
    getActiveSubModeKey,
    computeSubModeKey,
    switchMode,
    switchSubMode,
    saveSubModeSession,
    restoreSubModeSession,
    restoreAllSessions,
    saveAllSessions,
  }
})

export type SessionManagerApi = ReturnType<typeof useSessionManager>
