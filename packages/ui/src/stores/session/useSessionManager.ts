import { useArenaSession } from './useArenaSession'
import { defineStore, getActivePinia } from 'pinia'
import { computed, onScopeDispose, ref, shallowReactive, watch } from 'vue'
import { getOutputVersion } from '../../utils/output-document'
import {
  hydratePromptSessionWithOptimizationChain,
  promptRecordChainToOptimizationChain,
  type BasicSubMode,
  type ProSubMode,
  type ImageSubMode,
  type IPreferenceService,
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
import { useVideoCreateSession } from './useVideoCreateSession'
import {
  buildPromptSessionFromStores,
  buildPromptSessionRegistryFromStores,
  buildPromptSessionsFromStores,
  type PromptSessionProjectionStoreMap,
} from './promptSessionProjection'
import { pauseImageStorageGc, queueImageStorageMaintenance } from './imageStorageMaintenance'
import { hasSessionConflict, observeSessionSaves, pauseSessionWrites, withSessionRestoreCheckpoint, type SessionWritePermit } from './sessionPersistence'
import { acquireSessionRestoreLock, type SessionRestoreRelease } from './sessionConcurrency'
import { SESSION_STORAGE_KEYS, SESSION_SUB_MODE_KEYS, type SubModeKey } from './sessionKeys'
import type { SessionSaveResult } from './sessionSaveResult'

export type { SubModeKey } from './sessionKeys'

const getSessionCleanupKey = (key: SubModeKey, error: unknown): string | null => {
  // A video snapshot may contain paid task IDs even when storage cannot decode it.
  if (key === 'video-create' || !error || typeof error !== 'object') {
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
  getVideoSubMode?: () => 'create'
}

export const useSessionManager = defineStore('sessionManager', () => {
  const pinia = getActivePinia()
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
      case 'arena': return 'arena'
      case 'basic':
        subMode = readers.getBasicSubMode()
        break
      case 'pro':
        subMode = readers.getProSubMode()
        break
      case 'image':
        subMode = readers.getImageSubMode()
        break
      case 'video':
        subMode = readers.getVideoSubMode?.() ?? 'create'
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
      case 'arena': return 'arena'
      case 'basic':
        subMode = basicSubMode
        break
      case 'pro':
        subMode = proSubMode
        break
      case 'image':
        subMode = imageSubMode
        break
      case 'video':
        subMode = 'create'
        break
      default:
        subMode = 'system'
    }

    return `${mode}-${subMode}` as SubModeKey
  }

  let projectionStores: PromptSessionProjectionStoreMap | undefined
  const getProjectionStoreMap = () => (projectionStores ??= {
    arena: useArenaSession(pinia),
    'basic-system': useBasicSystemSession(pinia),
    'basic-user': useBasicUserSession(pinia),
    'pro-multi': useProMultiMessageSession(pinia),
    'pro-variable': useProVariableSession(pinia),
    'image-text2image': useImageText2ImageSession(pinia),
    'image-image2image': useImageImage2ImageSession(pinia),
    'image-multiimage': useImageMultiImageSession(pinia),
    'video-create': useVideoCreateSession(pinia),
  })

  const stateVersions = shallowReactive(new Map<SubModeKey, number>())
  const savedVersions = shallowReactive(new Map<SubModeKey, string>())
  const saveFailures = shallowReactive(new Map<SubModeKey, 'failed' | 'conflict'>())
  const dirtyStops: Array<() => void> = []
  onScopeDispose(() => dirtyStops.splice(0).forEach(stop => stop()))

  const sessionRevision = (key: SubModeKey) => `${stateVersions.get(key) ?? 0}:${getOutputVersion(getProjectionStoreMap()[key])}`
  const isSessionDirty = (key: SubModeKey) => savedVersions.get(key) !== sessionRevision(key)
  const needsSessionSave = (key: SubModeKey) => saveFailures.has(key) || isSessionDirty(key)
  const hasUnsavedSessions = computed(() => hasRestoredAllSessions.value &&
    SESSION_SUB_MODE_KEYS.some(needsSessionSave))
  const sessionHasConflict = (key: SubModeKey) =>
    hasSessionConflict(getPiniaServices()?.preferenceService, SESSION_STORAGE_KEYS[key])

  const trackSessionChanges = (onChange: (key: SubModeKey) => void, flush: 'post' | 'sync') => {
    const stores = getProjectionStoreMap()
    const stops = SESSION_SUB_MODE_KEYS.map(key => key === 'arena'
      ? watch(() => stores.arena.state, () => onChange(key), { deep: true, flush })
      : stores[key].$subscribe?.(() => onChange(key), { detached: true, flush }))
    return () => stops.forEach(stop => stop?.())
  }

  const trackSessionSaves = (service: IPreferenceService) => {
    for (const key of SESSION_SUB_MODE_KEYS) savedVersions.set(key, sessionRevision(key))
    dirtyStops.push(trackSessionChanges(key => stateVersions.set(key, (stateVersions.get(key) ?? 0) + 1), 'sync'))
    dirtyStops.push(observeSessionSaves(service, key => {
      const revision = sessionRevision(key)
      return saved => {
        if (saved) {
          savedVersions.set(key, revision)
          saveFailures.delete(key)
        } else {
          saveFailures.set(key, hasSessionConflict(service, SESSION_STORAGE_KEYS[key]) ? 'conflict' : 'failed')
        }
      }
    }))
  }

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

  const persistSession = async (key: SubModeKey, permit?: SessionWritePermit) => {
    try {
      // Text stores report handled failures; image stores reject on storage errors.
      return (await getProjectionStoreMap()[key].saveSession(permit)) !== false
    } catch (error) {
      console.error(`[SessionManager] Failed to save ${key} session:`, error)
      return false
    }
  }

  const withManagerSave = async (save: () => Promise<boolean>, wait = false) => {
    const deadline = Date.now() + 5000
    while (saveInFlight.value) {
      if (!wait || isRestoring.value || Date.now() >= deadline) return false
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    if (!hasRestoredAllSessions.value || isRestoring.value) return false

    saveInFlight.value = true
    try {
      return await save()
    } finally {
      saveInFlight.value = false
    }
  }

  const saveSubModeSession = (key: SubModeKey) => withManagerSave(() => persistSession(key))
  const flushSession = (key: SubModeKey) => {
    if (sessionHasConflict(key)) return Promise.resolve(false)
    return needsSessionSave(key) ? persistSession(key) : Promise.resolve(true)
  }
  const flushSubModeSession = (key: SubModeKey) =>
    withManagerSave(() => flushSession(key), true)

  const saveSubModeSessionWithStatus = async (key: SubModeKey): Promise<SessionSaveResult> => {
    const isBlocked = () => isRestoring.value || !hasRestoredAllSessions.value || sessionHasConflict(key)
    if (isBlocked()) return 'blocked'
    if (!isSessionDirty(key)) return 'saved'
    if (saveInFlight.value) return 'deferred'
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
          case 'arena':
            await useArenaSession().restoreSession()
            break
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
          case 'video-create':
            await useVideoCreateSession(pinia).restoreSession()
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

    const service = getPiniaServices()?.preferenceService
    if (!service) return

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
      trackSessionSaves(service)
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
    await restoreAllSessions()
    return withManagerSave(async () => {
      const activeKey = readers ? getActiveSubModeKey() : SESSION_SUB_MODE_KEYS[0]
      const keys = [activeKey, ...SESSION_SUB_MODE_KEYS.filter(key => key !== activeKey)]
      let saved = true
      for (const key of keys) {
        if (isRestoring.value) return false
        if (!needsSessionSave(key)) continue
        if (!await flushSession(key)) saved = false
        await new Promise(resolve => setTimeout(resolve, 0))
      }
      return saved
    }, true)
  }

  /**
   * Freeze automatic writes before importing workspace snapshots. On failure the
   * caller releases the lease; after a successful import it stays held until reload.
   */
  const beginSessionRestore = async (): Promise<SessionRestoreRelease> => {
    if (isRestoring.value) throw new Error('Session restore is already in progress')
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
            if (!await persistSession(key, writes.permit)) saved = false
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
    const stop = trackSessionChanges(onChange, 'post')
    const stores = getProjectionStoreMap()
    const outputStops = SESSION_SUB_MODE_KEYS.map(key =>
      watch(() => getOutputVersion(stores[key]), () => onChange(key), { flush: 'post' }),
    )
    return () => { stop(); outputStops.forEach(stopOutput => stopOutput()) }
  }

  return {
    // 状态
    hasUnsavedSessions,
    saveFailures,
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
    flushSubModeSession,
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
