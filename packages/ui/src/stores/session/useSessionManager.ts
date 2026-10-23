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
import {
  hydratePromptSessionWithOptimizationChain,
  promptRecordChainToOptimizationChain,
  type BasicSubMode,
  type ProSubMode,
  type ImageSubMode,
  type PromptSession,
} from '@prompt-optimizer/core'
import type { FunctionMode } from '../../composables/mode/useFunctionMode'
import { getPiniaServices } from '../../plugins/pinia'
import { useBasicSystemSession } from './useBasicSystemSession'
import { useBasicUserSession } from './useBasicUserSession'
import { useProMultiMessageSession } from './useProMultiMessageSession'
import { useProVariableSession } from './useProVariableSession'
import { useImageText2ImageSession } from './useImageText2ImageSession'
import { useImageImage2ImageSession } from './useImageImage2ImageSession'
import { useImageMultiImageSession } from './useImageMultiImageSession'
import {
  buildPromptSessionFromStores,
  buildPromptSessionRegistryFromStores,
  buildPromptSessionsFromStores,
  type PromptSessionProjectionStoreMap,
} from './promptSessionProjection'
import { pauseImageStorageGc, queueImageStorageMaintenance } from './imageStorageMaintenance'
import { hasSessionConflict, pauseSessionWrites, withSessionRestoreCheckpoint, type SessionWritePermit } from './sessionPersistence'
import { acquireSessionRestoreLock, type SessionRestoreRelease } from './sessionConcurrency'
import { SESSION_STORAGE_KEYS, SESSION_SUB_MODE_KEYS, type SubModeKey } from './sessionKeys'
import type { SessionSaveResult } from './sessionSaveResult'

export type { SubModeKey } from './sessionKeys'

const getSessionCleanupKey = (key: SubModeKey, error: unknown): string | null => {
  if (!error || typeof error !== 'object') {
    return null
  }

  const maybeError = error as {
    code?: unknown
    params?: {
      reason?: unknown
      key?: unknown
    }
  }

  if (maybeError.code !== 'error.storage.read') {
    return null
  }

  if (
    maybeError.params?.reason !== 'session_snapshot_too_large' &&
    maybeError.params?.reason !== 'session_referenced_image_missing'
  ) {
    return null
  }

  if (typeof maybeError.params.key === 'string' && maybeError.params.key.trim()) {
    return maybeError.params.key === SESSION_STORAGE_KEYS[key] ? maybeError.params.key : null
  }

  return SESSION_STORAGE_KEYS[key]
}

const asTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

const readChainIdFromMetadata = (
  metadata: Record<string, unknown> | undefined,
): string | undefined =>
  asTrimmedString(metadata?.legacyChainId) ??
  asTrimmedString(metadata?.chainId)

const resolveHydratableHistoryChainId = (session: PromptSession): string | undefined => {
  const explicitChainId =
    asTrimmedString(session.optimization.legacyPromptRecordChainId) ??
    readChainIdFromMetadata(session.optimization.metadata) ??
    readChainIdFromMetadata(session.metadata)
  if (explicitChainId) return explicitChainId

  const optimizationId = asTrimmedString(session.optimization.id)
  if (!optimizationId || optimizationId === `${session.id}:chain`) {
    return undefined
  }

  return optimizationId
}

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
  const isRestoring = ref(false)

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
      console.warn('[SessionManager] Sub-mode readers have not been injected; falling back to basic-system')
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

  const getProjectionStoreMap = (): PromptSessionProjectionStoreMap => ({
    'basic-system': useBasicSystemSession(),
    'basic-user': useBasicUserSession(),
    'pro-multi': useProMultiMessageSession(),
    'pro-variable': useProVariableSession(),
    'image-text2image': useImageText2ImageSession(),
    'image-image2image': useImageImage2ImageSession(),
    'image-multiimage': useImageMultiImageSession(),
  })

  const getPromptSession = (key: SubModeKey = getActiveSubModeKey()) =>
    buildPromptSessionFromStores(key, getProjectionStoreMap())

  const getHydratedPromptSession = async (key: SubModeKey = getActiveSubModeKey()) => {
    const session = getPromptSession(key)
    const chainId = resolveHydratableHistoryChainId(session)
    if (!chainId) {
      return session
    }

    const $services = getPiniaServices()
    const historyManager = $services?.historyManager
    if (!historyManager) {
      return session
    }

    try {
      const chain = await historyManager.getChain(chainId)
      return hydratePromptSessionWithOptimizationChain(
        session,
        promptRecordChainToOptimizationChain(chain),
      )
    } catch (error) {
      console.warn('[SessionManager] Failed to hydrate prompt session history chain; using synchronous projection:', error)
      return session
    }
  }

  const getAllPromptSessions = () =>
    buildPromptSessionsFromStores(getProjectionStoreMap())

  const getPromptSessionRegistry = () =>
    buildPromptSessionRegistryFromStores(
      getProjectionStoreMap(),
      getActiveSubModeKey(),
    )

  /**
   * 切换功能模式（响应外部 functionMode 变化）
   * @param fromKey 旧模式的 key（由 watch 传入）
   * @param toKey 新模式的 key（由 watch 传入）
   */
  const switchMode = async (fromKey: SubModeKey, toKey: SubModeKey) => {
    if (isSwitching.value || isRestoring.value) {
      return
    }

    isSwitching.value = true
    try {
      // 1. 保存旧模式会话
      await saveSubModeSession(fromKey)

      // 2. 恢复新模式会话
      await restoreSubModeSession(toKey)
    } catch (error) {
      console.error('[SessionManager] Failed to switch mode:', error)
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
    if (isSwitching.value || isRestoring.value) {
      return
    }

    isSwitching.value = true
    try {
      // 1. 保存旧子模式会话
      await saveSubModeSession(fromKey)

      // 2. 恢复新子模式会话
      await restoreSubModeSession(toKey)
    } catch (error) {
      console.error('[SessionManager] Failed to switch sub-mode:', error)
    } finally {
      isSwitching.value = false
    }
  }

  /**
   * 内部方法:保存指定子模式会话（不加锁）
   * 仅供 saveSubModeSession 和 saveAllSessions 调用
   */
  const _saveSubModeSessionUnsafe = async (key: SubModeKey, permit?: SessionWritePermit) => {
    try {
      // Text stores report handled failures; image stores reject on storage errors.
      return (await getProjectionStoreMap()[key].saveSession(permit)) !== false
    } catch (error) {
      console.error(`[SessionManager] Failed to save ${key} session:`, error)
      return false
    }
  }

  /**
   * 保存指定子模式会话（带全局锁保护）
   * 🔧 加强防护：未恢复前不允许保存，避免覆盖持久化数据
   */
  const saveSubModeSession = async (key: SubModeKey) => {
    if (isRestoring.value) return false
    // ✅ 强制检查：必须先恢复才能保存
    if (!hasRestoredAllSessions.value) {
      console.warn(`[SessionManager] Attempted to save ${key} before global restore completed; skipping to avoid overwriting persisted data`)
      return false
    }

    // ⚠️ 并发保护：如果上一次保存还在进行中，跳过本次
    if (saveInFlight.value) {
      console.warn(`[SessionManager] A save operation is already in progress; skipping ${key} session save`)
      return false
    }

    try {
      saveInFlight.value = true
      return await _saveSubModeSessionUnsafe(key)
    } finally {
      saveInFlight.value = false
    }
  }

  /** Mobile scheduling needs to distinguish temporary contention from a refused write. */
  const saveSubModeSessionWithStatus = async (key: SubModeKey): Promise<SessionSaveResult> => {
    const isBlocked = () => isRestoring.value || !hasRestoredAllSessions.value ||
      hasSessionConflict(getPiniaServices()?.preferenceService, SESSION_STORAGE_KEYS[key])
    if (isBlocked()) return 'blocked'
    if (isSwitching.value || saveInFlight.value) return 'deferred'
    const saved = await saveSubModeSession(key)
    if (saved) return 'saved'
    return isBlocked() ? 'blocked' : 'failed'
  }

  /**
   * 恢复指定子模式会话
   */
  const restoreSubModeSession = async (key: SubModeKey) => {
    // A route round-trip must not discard a losing window's unsaved draft.
    // Keep it available for copying; a page reload establishes a fresh baseline.
    if (hasSessionConflict(getPiniaServices()?.preferenceService, SESSION_STORAGE_KEYS[key])) return
    return withSessionRestoreCheckpoint(getPiniaServices()?.preferenceService, SESSION_STORAGE_KEYS[key], async cleanup => {
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
          case 'image-multiimage':
            await useImageMultiImageSession().restoreSession()
            break
        }
      } catch (error) {
        const cleanupKey = getSessionCleanupKey(key, error)
        if (cleanupKey) {
          console.info(`[SessionManager] Detected a corrupted session snapshot; preparing cleanup: ${cleanupKey}`)
        } else {
          console.error(`[SessionManager] Failed to restore ${key} session:`, error)
        }

        if (!cleanupKey) {
          return
        }

        try {
          if (await cleanup()) {
            console.info(`[SessionManager] Removed corrupted session snapshot: ${cleanupKey}`)
          } else {
            console.info(`[SessionManager] Preserved session snapshot changed or protected during recovery: ${cleanupKey}`)
          }
        } catch (cleanupError) {
          console.error(`[SessionManager] Failed to remove corrupted session snapshot (${cleanupKey}):`, cleanupError)
        }
      }
    })
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
      for (const key of SESSION_SUB_MODE_KEYS) {
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
    if (isRestoring.value) return false
    // ⚠️ 等待当前保存完成（最多等待 5 秒）
    const startTime = Date.now()
    const MAX_WAIT = 5000 // 5 秒超时

    await restoreAllSessions()
    if (!hasRestoredAllSessions.value || isRestoring.value) return false

    while (saveInFlight.value) {
      if (isRestoring.value) return false
      if (Date.now() - startTime > MAX_WAIT) {
        // ⚠️ 超时时直接返回，不要强制执行（避免误解锁）
        console.warn('[SessionManager] Timed out while waiting for the current save to finish; aborting this save request')
        return false
      }
      // 等待 50ms 后重试
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    if (isRestoring.value) return false

    // ⚠️ 记录是否是我获得的锁（防御性编程）
    let acquired = false

    try {
      saveInFlight.value = true
      acquired = true // ✅ 标记：我获得了锁

      // IMPORTANT:
      // Save sequentially to reduce peak memory usage for very large sessions.
      // (Parallel JSON.stringify across 6 stores can spike memory and crash the browser on pagehide/unmount.)
      // Save the active workspace first: a mobile browser may suspend this page
      // before the remaining background workspace snapshots finish.
      const activeKey = readers ? getActiveSubModeKey() : SESSION_SUB_MODE_KEYS[0]
      const orderedKeys = [activeKey, ...SESSION_SUB_MODE_KEYS.filter(key => key !== activeKey)]
      let saved = true
      for (const key of orderedKeys) {
        if (!await _saveSubModeSessionUnsafe(key)) saved = false
        await new Promise(resolve => setTimeout(resolve, 0))
      }
      return saved
    } catch (error) {
      console.error('[SessionManager] Failed to save all sessions:', error)
      return false
    } finally {
      // ✅ 只有我获得的锁，我才释放
      if (acquired) {
        saveInFlight.value = false
      }
    }
  }

  /**
   * Freeze automatic writes before importing workspace snapshots. On failure the
   * caller releases the lease; after a successful import it stays held until reload.
   */
  const beginSessionRestore = async (): Promise<SessionRestoreRelease> => {
    if (isRestoring.value) throw new Error('Session restore is already in progress')
    if (isSwitching.value) throw new Error('Cannot restore sessions while switching workspaces')
    const service = getPiniaServices()?.preferenceService
    if (!service) throw new Error('Session storage is unavailable')
    // Freeze at the store boundary: model/template setters and result callbacks
    // call saveSession directly, independently of this manager's autosave lock.
    const writes = pauseSessionWrites(service)
    const resumeGc = pauseImageStorageGc()
    isRestoring.value = true
    let timeout: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    let released = false
    const controller = new AbortController()
    let releaseAccess: (() => void) | undefined
    const complete = () => { releaseAccess?.(); releaseAccess = undefined }
    const resume = () => {
      if (released) return
      released = true
      complete()
      writes.release()
      resumeGc()
      isRestoring.value = false
    }
    try {
      await Promise.race([
        (async () => {
          await restoreAllSessions()
          if (!hasRestoredAllSessions.value) throw new Error('Session hydration did not complete')
          while (saveInFlight.value && !cancelled) await new Promise(resolve => setTimeout(resolve, 50))
          if (cancelled) return
          await writes.ready
          if (cancelled) return
          // Drain a GC that was already executing before pauseImageStorageGc.
          // New/timer/queued GCs remain paused through import and reload.
          await queueImageStorageMaintenance(async () => {})
          releaseAccess = await acquireSessionRestoreLock(controller.signal)
          if (cancelled) { complete(); return }

          // Old backups and favorites-only imports have no workspace snapshots.
          // Preserve all current drafts before any import can request a reload.
          // Only this checkpoint's permit may write while the stores are frozen.
          let saved = true
          for (const key of SESSION_SUB_MODE_KEYS) {
            if (cancelled) return
            if (!await _saveSubModeSessionUnsafe(key, writes.permit)) saved = false
          }
          if (!saved) throw new Error('Failed to save current workspaces before import')
        })(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Timed out while waiting for session writes')), 5000)
        }),
      ])
      return Object.assign(resume, { complete })
    } catch (error) {
      resume()
      throw error
    } finally {
      cancelled = true
      controller.abort()
      clearTimeout(timeout)
    }
  }

  /** Subscribe to mutations without copying or serializing the session state. */
  const subscribeToSessionChanges = (onChange: (key: SubModeKey) => void) => {
    const stores = getProjectionStoreMap()
    const unsubscribe = SESSION_SUB_MODE_KEYS.map(key =>
      stores[key].$subscribe(() => onChange(key), { detached: true, flush: 'post' }),
    )
    return () => unsubscribe.forEach(stop => stop())
  }


  return {
    // 状态
    isSwitching,
    isRestoring,
    isSaving: saveInFlight,

    // 方法
    injectSubModeReaders,
    getActiveSubModeKey,
    computeSubModeKey,
    getPromptSession,
    getHydratedPromptSession,
    getAllPromptSessions,
    getPromptSessionRegistry,
    switchMode,
    switchSubMode,
    saveSubModeSession,
    saveSubModeSessionWithStatus,
    restoreSubModeSession,
    restoreAllSessions,
    saveAllSessions,
    beginSessionRestore,
    subscribeToSessionChanges,
  }
})

export type SessionManagerApi = ReturnType<typeof useSessionManager>
