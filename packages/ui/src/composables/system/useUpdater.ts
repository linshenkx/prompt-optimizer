import { reactive, onMounted, onUnmounted, nextTick, inject, type Ref } from 'vue'

import { isRunningInElectron } from '@prompt-optimizer/core'
import { usePreferences } from '../storage/usePreferenceManager'
import { useI18n } from 'vue-i18n'
import { asExtendedError } from '../../utils/error'
// 移除过度抽象的 Hook，直接使用 window.electronAPI
import type { DownloadProgress, UpdateInfo } from '@/types/electron'
import type { AppServices } from '../../types/services'

// 类型定义现在从 @/types/electron 导入，保持统一

export interface UpdaterState {
  hasUpdate: boolean
  updateInfo: UpdateInfo | null
  downloadProgress: DownloadProgress | null
  isDownloading: boolean
  isDownloaded: boolean
  isCheckingUpdate: boolean
  lastCheckResult: 'none' | 'available' | 'not-available' | 'error' | 'dev-disabled'
  lastCheckMessage: string
  stableVersion: string | null
  stableReleaseUrl: string | null
  prereleaseVersion: string | null
  prereleaseReleaseUrl: string | null
  hasStableUpdate: boolean
  hasPrereleaseUpdate: boolean
  currentVersion: string | null
  isDownloadingStable: boolean
  isDownloadingPrerelease: boolean
  downloadMessage: { type: 'error' | 'warning' | 'info', content: string } | null
  lastDownloadAttempt: 'stable' | 'prerelease' | null
  // 忽略状态
  isStableVersionIgnored: boolean
  isPrereleaseVersionIgnored: boolean
}

// 更新器实例类型
interface UpdaterInstance {
  state: UpdaterState
  checkUpdate: () => Promise<void>
  startDownload: () => Promise<void>
  installUpdate: () => Promise<void>
  ignoreUpdate: (version?: string, versionType?: 'stable' | 'prerelease') => Promise<void>
  unignoreUpdate: (versionType: 'stable' | 'prerelease') => Promise<void>
  openReleaseUrl: () => Promise<void>
  downloadStableVersion: () => Promise<void>
  downloadPrereleaseVersion: () => Promise<void>
}

// 全局单例状态，确保所有组件共享同一个状态
let globalUpdaterInstance: UpdaterInstance | null = null

export function useUpdater() {
  // 如果已有实例，直接返回
  if (globalUpdaterInstance) {
    return globalUpdaterInstance
  }

  // 环境检测 - 仅在Electron环境中启用功能
  const isElectronEnvironment = isRunningInElectron()
  
  if (!isElectronEnvironment) {
    // 非Electron环境返回空实现，保持API一致性
    return {
      state: reactive({
        hasUpdate: false,
        updateInfo: null,
        downloadProgress: null,
        isDownloading: false,
        isDownloaded: false,
        isCheckingUpdate: false,
        lastCheckResult: 'none',
        lastCheckMessage: '',
        stableVersion: null,
        stableReleaseUrl: null,
        prereleaseVersion: null,
        prereleaseReleaseUrl: null,
        hasStableUpdate: false,
        hasPrereleaseUpdate: false,
        currentVersion: null,
        isDownloadingStable: false,
        isDownloadingPrerelease: false,
        downloadMessage: null,
        lastDownloadAttempt: null,
        isStableVersionIgnored: false,
        isPrereleaseVersionIgnored: false
      } as UpdaterState),
      checkUpdate: () => Promise.resolve(),
      startDownload: () => Promise.resolve(),
      installUpdate: () => Promise.resolve(),
      ignoreUpdate: () => Promise.resolve(),
      unignoreUpdate: () => Promise.resolve(),
      openReleaseUrl: () => Promise.resolve(),
      downloadStableVersion: () => Promise.resolve(),
      downloadPrereleaseVersion: () => Promise.resolve()
    }
  }

  // Electron环境的实际实现
  const services = inject<Ref<AppServices | null>>('services')
  if (!services) {
    throw new Error('[useUpdater] services injection missing')
  }
  const { setPreference } = usePreferences(services)
  const { t } = useI18n()

  // 直接使用 window.electronAPI，简单直接

  const state = reactive<UpdaterState>({
    hasUpdate: false,
    updateInfo: null,
    downloadProgress: null,
    isDownloading: false,
    isDownloaded: false,
    isCheckingUpdate: false,
    lastCheckResult: 'none',
    lastCheckMessage: '',
    stableVersion: null,
    stableReleaseUrl: null,
    prereleaseVersion: null,
    prereleaseReleaseUrl: null,
    hasStableUpdate: false,
    hasPrereleaseUpdate: false,
    currentVersion: null,
    isDownloadingStable: false,
    isDownloadingPrerelease: false,
    downloadMessage: null,
    lastDownloadAttempt: null,
    isStableVersionIgnored: false,
    isPrereleaseVersionIgnored: false
  })



  // IPC事件监听器引用，用于清理
  let updateAvailableListener: ((info: UpdateInfo) => void) | null = null
  let updateNotAvailableListener: ((info: { version?: string; reason?: string }) => void) | null = null
  let downloadProgressListener: ((progress: DownloadProgress) => void) | null = null
  let updateDownloadedListener: ((info: UpdateInfo) => void) | null = null
  let updateErrorListener: ((error: { message?: string; code?: string; error?: string }) => void) | null = null
  let downloadStartedListener: ((info: { versionType?: 'stable' | 'prerelease'; version?: string }) => void) | null = null

  // 检查两种版本的内部函数
  const checkBothVersions = async () => {
    try {
      // 获取当前版本
      state.currentVersion = await getCurrentVersion()

      // 使用新的统一检查API，避免并发冲突
      console.log('[useUpdater] Checking all versions using unified API...')
      const results = await window.electronAPI!.updater.checkAllVersions()

      console.log('[useUpdater] Processing unified check results...', results)

      // 确保 results 存在
      if (!results) {
        throw new Error('No results returned from version check')
      }

      // 保存正式版信息
      if (results.stable && !results.stable.error && !results.stable.noVersionFound) {
        const newStableVersion = results.stable.remoteVersion || null
        // 如果版本发生变化，重置忽略状态
        if (state.stableVersion !== newStableVersion) {
          state.isStableVersionIgnored = false
        }
        state.stableVersion = newStableVersion
        state.stableReleaseUrl = results.stable.remoteReleaseUrl || null
        state.hasStableUpdate = hasUpdate(state.currentVersion || '0.0.0', state.stableVersion || '0.0.0')
        console.log(`[useUpdater] Stable version: current=${state.currentVersion}, remote=${state.stableVersion}, hasUpdate=${state.hasStableUpdate}`)
      } else {
        state.stableVersion = null
        state.stableReleaseUrl = null
        state.hasStableUpdate = false
        state.isStableVersionIgnored = false
        if (results.stable?.noVersionFound) {
          console.log('[useUpdater] No stable version found - this is normal if no stable releases exist yet')
        } else if (results.stable?.error) {
          console.log('[useUpdater] Stable version check failed:', results.stable.error)
        }
      }

      // 保存预览版信息
      if (results.prerelease && !results.prerelease.error && !results.prerelease.noVersionFound) {
        const newPrereleaseVersion = results.prerelease.remoteVersion || null
        // 如果版本发生变化，重置忽略状态
        if (state.prereleaseVersion !== newPrereleaseVersion) {
          state.isPrereleaseVersionIgnored = false
        }
        state.prereleaseVersion = newPrereleaseVersion || null
        state.prereleaseReleaseUrl = results.prerelease.remoteReleaseUrl || null
        state.hasPrereleaseUpdate = hasUpdate(state.currentVersion || '0.0.0', state.prereleaseVersion || '0.0.0')
        console.log(`[useUpdater] Prerelease version: current=${state.currentVersion}, remote=${state.prereleaseVersion}, hasUpdate=${state.hasPrereleaseUpdate}`)
      } else {
        state.prereleaseVersion = null
        state.prereleaseReleaseUrl = null
        state.hasPrereleaseUpdate = false
        state.isPrereleaseVersionIgnored = false
        if (results.prerelease?.noVersionFound) {
          console.log('[useUpdater] No prerelease version found - this is normal if no prerelease releases exist yet')
        } else if (results.prerelease?.error) {
          console.log('[useUpdater] Prerelease version check failed:', results.prerelease.error)
        }
      }

      // 更新总体状态 - 根据用户偏好计算
      state.hasUpdate = calculateHasUpdate()

      // 设置检查结果消息
      if (state.hasStableUpdate || state.hasPrereleaseUpdate) {
        const updates = []
        if (state.hasStableUpdate) updates.push(`stable v${state.stableVersion}`)
        if (state.hasPrereleaseUpdate) updates.push(`prerelease v${state.prereleaseVersion}`)
        state.lastCheckResult = 'available'
        state.lastCheckMessage = `New versions available: ${updates.join(', ')}`
      } else if (state.stableVersion || state.prereleaseVersion) {
        state.lastCheckResult = 'not-available'
        state.lastCheckMessage = 'You are using the latest versions'
      } else {
        // 检查是否是因为没有发布版本或检查失败
        const hasStableError = results.stable?.error
        const hasPrereleaseError = results.prerelease?.error
        const hasStableNoVersionFound = results.stable?.noVersionFound
        const hasPrereleaseNoVersionFound = results.prerelease?.noVersionFound

        if (hasStableError || hasPrereleaseError) {
          state.lastCheckResult = 'error'
          const errors = []
          if (hasStableError && results.stable?.error) errors.push(`stable: ${results.stable.error}`)
          if (hasPrereleaseError && results.prerelease?.error) errors.push(`prerelease: ${results.prerelease.error}`)
          state.lastCheckMessage = `Update check failed: ${errors.join(', ')}`
        } else if (hasStableNoVersionFound && hasPrereleaseNoVersionFound) {
          state.lastCheckResult = 'not-available'
          state.lastCheckMessage = 'No releases found. This project may not have published any versions yet.'
        } else if (hasStableNoVersionFound) {
          state.lastCheckResult = 'not-available'
          state.lastCheckMessage = 'No stable releases found. Only prerelease versions may be available.'
        } else {
          state.lastCheckResult = 'error'
          state.lastCheckMessage = 'Unable to check for updates'
        }
      }

    } catch (error) {
      console.error('[useUpdater] Error checking all versions:', error)
      state.lastCheckResult = 'error'
      state.lastCheckMessage = error instanceof Error ? error.message : String(error)
    } finally {
      // 无论成功还是失败，都保存检测状态
      state.isCheckingUpdate = false

      // 同步后端的忽略状态
      await syncIgnoredStates()

      await saveUpdateState()

      console.log('[useUpdater] Both versions checked. Final state:', {
        hasStableUpdate: state.hasStableUpdate,
        hasPrereleaseUpdate: state.hasPrereleaseUpdate,
        hasUpdate: state.hasUpdate,
        lastCheckResult: state.lastCheckResult,
        isStableVersionIgnored: state.isStableVersionIgnored,
        isPrereleaseVersionIgnored: state.isPrereleaseVersionIgnored
      })
    }
  }



  // 获取当前应用版本
  const getCurrentVersion = async (): Promise<string | null> => {
    if (isRunningInElectron() && window.electronAPI?.app) {
      try {
        return await window.electronAPI.app.getVersion()
      } catch (error) {
        console.error('[useUpdater] Failed to get app version:', error)
        return null
      }
    }
    console.warn('[useUpdater] Not running in Electron environment')
    return null
  }

  // 语义化版本比较函数
  const compareVersions = (version1: string, version2: string): number => {
    // 移除 'v' 前缀（如果存在）
    const v1 = version1.replace(/^v/, '')
    const v2 = version2.replace(/^v/, '')

    // 解析版本号
    const parseVersion = (version: string) => {
      const parts = version.split('-')
      const mainVersion = parts[0]
      const prerelease = parts[1] || null

      const [major, minor, patch] = mainVersion.split('.').map(num => parseInt(num) || 0)

      return {
        major,
        minor,
        patch,
        prerelease,
        original: version
      }
    }

    const parsed1 = parseVersion(v1)
    const parsed2 = parseVersion(v2)

    // 比较主版本号
    if (parsed1.major !== parsed2.major) {
      return parsed1.major - parsed2.major
    }

    // 比较次版本号
    if (parsed1.minor !== parsed2.minor) {
      return parsed1.minor - parsed2.minor
    }

    // 比较修订版本号
    if (parsed1.patch !== parsed2.patch) {
      return parsed1.patch - parsed2.patch
    }

    // 如果主版本号相同，比较预发布版本
    if (parsed1.prerelease && parsed2.prerelease) {
      // 两个都是预发布版本，按字符串比较
      return parsed1.prerelease.localeCompare(parsed2.prerelease)
    } else if (parsed1.prerelease && !parsed2.prerelease) {
      // v1是预发布版本，v2是正式版本，v1 < v2
      return -1
    } else if (!parsed1.prerelease && parsed2.prerelease) {
      // v1是正式版本，v2是预发布版本，v1 > v2
      return 1
    }

    // 版本完全相同
    return 0
  }

  // 检查是否有更新（新版本大于当前版本）
  const hasUpdate = (currentVersion: string, remoteVersion: string): boolean => {
    if (!currentVersion || !remoteVersion) return false
    return compareVersions(remoteVersion, currentVersion) > 0
  }

  // 根据当前版本类型计算是否有更新
  const calculateHasUpdate = (): boolean => {
    // 检查当前版本是否为预览版
    const isCurrentVersionPrerelease = state.currentVersion?.includes('-') || false

    let result: boolean
    if (isCurrentVersionPrerelease) {
      // 当前是预览版：正式版或预览版有更新都提示（且未被忽略）
      const stableUpdateAvailable = state.hasStableUpdate && !state.isStableVersionIgnored
      const prereleaseUpdateAvailable = state.hasPrereleaseUpdate && !state.isPrereleaseVersionIgnored
      result = stableUpdateAvailable || prereleaseUpdateAvailable

      console.log('[calculateHasUpdate] Prerelease user:', {
        hasStableUpdate: state.hasStableUpdate,
        isStableVersionIgnored: state.isStableVersionIgnored,
        stableUpdateAvailable,
        hasPrereleaseUpdate: state.hasPrereleaseUpdate,
        isPrereleaseVersionIgnored: state.isPrereleaseVersionIgnored,
        prereleaseUpdateAvailable,
        result
      })
    } else {
      // 当前是正式版：只有正式版更新才提示（且未被忽略）
      result = state.hasStableUpdate && !state.isStableVersionIgnored

      console.log('[calculateHasUpdate] Stable user:', {
        hasStableUpdate: state.hasStableUpdate,
        isStableVersionIgnored: state.isStableVersionIgnored,
        result
      })
    }

    return result
  }

  // 保存检测状态到持久化存储（不包括忽略状态，忽略状态由后端管理）
  const saveUpdateState = async () => {
    try {
      await setPreference('updater.lastCheckTime', Date.now())
      await setPreference('updater.hasStableUpdate', state.hasStableUpdate)
      await setPreference('updater.hasPrereleaseUpdate', state.hasPrereleaseUpdate)
      await setPreference('updater.stableVersion', state.stableVersion)
      await setPreference('updater.prereleaseVersion', state.prereleaseVersion)
      await setPreference('updater.stableReleaseUrl', state.stableReleaseUrl)
      await setPreference('updater.prereleaseReleaseUrl', state.prereleaseReleaseUrl)
      await setPreference('updater.lastCheckResult', state.lastCheckResult)
      // 注意：忽略状态不再保存到前端偏好设置，完全由后端管理
      console.log('[useUpdater] Update state saved to preferences (excluding ignore states)')
    } catch (error) {
      console.warn('[useUpdater] Failed to save update state:', error)
    }
  }

  // 清理旧的检测状态缓存（简化逻辑，每次启动都重新检测）
  const clearUpdateStateCache = async () => {
    try {
      // 清理可能过时的缓存数据
      await setPreference('updater.lastCheckTime', 0)
      await setPreference('updater.hasStableUpdate', false)
      await setPreference('updater.hasPrereleaseUpdate', false)
      await setPreference('updater.stableVersion', null)
      await setPreference('updater.prereleaseVersion', null)
      await setPreference('updater.stableReleaseUrl', null)
      await setPreference('updater.prereleaseReleaseUrl', null)
      await setPreference('updater.lastCheckResult', 'none')
      console.log('[useUpdater] Update state cache cleared')
    } catch (error) {
      console.warn('[useUpdater] Failed to clear update state cache:', error)
    }
  }

  // 检查更新 - 增强版本，支持双重检查
  const checkUpdate = async () => {
    if (!window.electronAPI?.updater) {
      console.warn('[useUpdater] Electron updater API not available')
      return
    }

    // 防止重复检查
    if (state.isCheckingUpdate) {
      console.log('[useUpdater] Update check already in progress')
      return
    }

    try {
      state.isCheckingUpdate = true
      // 清除之前的下载消息，因为这是一个新的检查操作
      state.downloadMessage = null

      // 智能状态重置：只在没有下载进行时才重置下载相关状态
      if (!state.isDownloading) {
        state.isDownloaded = false
        state.downloadProgress = null
        state.hasUpdate = false
        state.updateInfo = null
        state.lastCheckResult = 'none'
        state.lastCheckMessage = ''
        // 重置版本更新状态，确保每次检测都能正确更新
        state.hasStableUpdate = false
        state.hasPrereleaseUpdate = false
        state.stableVersion = null
        state.stableReleaseUrl = null
        state.prereleaseVersion = null
        state.prereleaseReleaseUrl = null
        // 注意：不重置忽略状态，让用户的忽略选择在新检查中保持有效
        // state.isStableVersionIgnored 和 state.isPrereleaseVersionIgnored 保持不变
        // 清除持久化的检测状态
        await saveUpdateState()
        console.log('[useUpdater] Reset states for new update check (keeping ignore states)')
      } else {
        console.log('[useUpdater] Download in progress, preserving download states')
      }

      // 检查两种版本：正式版和预览版
      await checkBothVersions()
    } catch (error) {
      console.error('[useUpdater] Check update error:', error)
      const extendedError = asExtendedError(error)
      if (extendedError) {
        console.error('[DEBUG] Error properties:', {
          message: extendedError.message,
          detailedMessage: extendedError.detailedMessage,
          originalError: extendedError.originalError,
          stack: extendedError.stack
        })
      }

      state.lastCheckResult = 'error'
      if (extendedError) {
        if (extendedError.detailedMessage) {
          // 检查是否是开发环境的配置文件缺失错误
          if (extendedError.detailedMessage.includes('dev-app-update.yml') && extendedError.detailedMessage.includes('ENOENT')) {
            state.lastCheckMessage = 'Development environment: Update checking is disabled (no dev-app-update.yml configured)'
          } else {
            state.lastCheckMessage = extendedError.detailedMessage
          }
        } else if (extendedError.originalError !== undefined) {
          state.lastCheckMessage = String(extendedError.originalError)
        } else {
          let detailedMessage = `Client Error: ${extendedError.message}`
          if (extendedError.stack) {
            detailedMessage += `\n\nStack Trace:\n${extendedError.stack}`
          }
          state.lastCheckMessage = detailedMessage
        }
      } else {
        state.lastCheckMessage = String(error ?? 'Update check failed')
      }
    } finally {
      state.isCheckingUpdate = false
    }
  }

  // 开始下载 - 已弃用，请使用 downloadStableVersion 或 downloadPrereleaseVersion
  const startDownload = async () => {
    console.warn('[useUpdater] startDownload is deprecated, use downloadStableVersion or downloadPrereleaseVersion instead')

    // 为了向后兼容，如果有可用更新，尝试下载对应类型的版本
    if (state.hasStableUpdate) {
      await downloadStableVersion()
    } else if (state.hasPrereleaseUpdate) {
      await downloadPrereleaseVersion()
    } else {
      console.warn('[useUpdater] No update available for download')
    }
  }

  // 安装更新
  const installUpdate = async () => {
    if (!window.electronAPI?.updater) {
      console.warn('[useUpdater] Electron updater API not available')
      return
    }

    try {
      await window.electronAPI.updater.installUpdate()
      console.log('[useUpdater] Update installation initiated successfully')
    } catch (error) {
      console.error('[useUpdater] Install update error:', error)
    }
  }

  // 从后端同步忽略状态
  const syncIgnoredStates = async () => {
    if (!window.electronAPI?.updater?.getIgnoredVersions) {
      console.warn('[useUpdater] getIgnoredVersions API not available')
      return
    }

    try {
      const ignoredVersions = await window.electronAPI.updater.getIgnoredVersions()
      console.log('[useUpdater] Retrieved ignored versions from backend:', ignoredVersions)

      // 根据当前版本和后端忽略状态计算前端忽略状态
      state.isStableVersionIgnored = !!(ignoredVersions.stable && state.stableVersion && ignoredVersions.stable === state.stableVersion)
      state.isPrereleaseVersionIgnored = !!(ignoredVersions.prerelease && state.prereleaseVersion && ignoredVersions.prerelease === state.prereleaseVersion)

      console.log('[useUpdater] Synced ignore states:', {
        stableVersion: state.stableVersion,
        ignoredStableVersion: ignoredVersions.stable,
        isStableVersionIgnored: state.isStableVersionIgnored,
        prereleaseVersion: state.prereleaseVersion,
        ignoredPrereleaseVersion: ignoredVersions.prerelease,
        isPrereleaseVersionIgnored: state.isPrereleaseVersionIgnored
      })

      // 重新计算总体更新状态
      state.hasUpdate = calculateHasUpdate()
      console.log('[useUpdater] hasUpdate after sync:', state.hasUpdate)
    } catch (error) {
      console.error('[useUpdater] Failed to sync ignored states:', error)
    }
  }

  // 忽略版本
  const ignoreUpdate = async (version?: string, versionType?: 'stable' | 'prerelease') => {
    if (!window.electronAPI?.updater) {
      console.warn('[useUpdater] Electron updater API not available')
      return
    }

    try {
      const versionToIgnore = version || state.updateInfo?.version
      if (!versionToIgnore) return

      // 如果没有指定类型，根据版本号自动判断
      const actualVersionType = versionType || (versionToIgnore.includes('-') ? 'prerelease' : 'stable')

      console.log('[useUpdater] Before ignore - hasUpdate:', state.hasUpdate, 'isStableVersionIgnored:', state.isStableVersionIgnored, 'isPrereleaseVersionIgnored:', state.isPrereleaseVersionIgnored)

      // ignoreVersion 成功时返回 null (data)，失败时抛出异常
      await window.electronAPI.updater.ignoreVersion(versionToIgnore, actualVersionType)

      // 立即更新前端状态，确保UI立即响应
      if (actualVersionType === 'stable') {
        state.isStableVersionIgnored = true
        console.log('[useUpdater] Immediately set isStableVersionIgnored = true')
      } else if (actualVersionType === 'prerelease') {
        state.isPrereleaseVersionIgnored = true
        console.log('[useUpdater] Immediately set isPrereleaseVersionIgnored = true')
      }

      // 立即重新计算hasUpdate状态
      const oldHasUpdate = state.hasUpdate
      state.hasUpdate = calculateHasUpdate()
      console.log('[useUpdater] Immediately updated hasUpdate from', oldHasUpdate, 'to', state.hasUpdate)

      // 如果忽略的是当前的updateInfo，清理它
      if (state.updateInfo?.version === versionToIgnore) {
        state.updateInfo = null
        console.log('[useUpdater] Cleared updateInfo for ignored version')
      }

      // 等待下一个tick确保状态更新完成
      await nextTick()

      // 异步同步后端状态（用于验证一致性）
      syncIgnoredStates().catch(error => {
        console.error('[useUpdater] Failed to sync ignored states after ignore:', error)
      })

      console.log('[useUpdater] Version ignored successfully:', versionToIgnore, 'type:', actualVersionType, 'final hasUpdate:', state.hasUpdate)
    } catch (error) {
      console.error('[useUpdater] Ignore version error:', error)
    }
  }

  // 取消忽略版本
  const unignoreUpdate = async (versionType: 'stable' | 'prerelease') => {
    if (!window.electronAPI?.updater?.unignoreVersion) {
      console.warn('[useUpdater] unignoreVersion API not available')
      return
    }

    try {
      console.log('[useUpdater] Before unignore - hasUpdate:', state.hasUpdate, 'isStableVersionIgnored:', state.isStableVersionIgnored, 'isPrereleaseVersionIgnored:', state.isPrereleaseVersionIgnored)

      // 调用后端API取消忽略
      await window.electronAPI.updater.unignoreVersion(versionType)

      // 立即更新前端状态，确保UI立即响应
      if (versionType === 'stable') {
        state.isStableVersionIgnored = false
        console.log('[useUpdater] Immediately set isStableVersionIgnored = false')
      } else if (versionType === 'prerelease') {
        state.isPrereleaseVersionIgnored = false
        console.log('[useUpdater] Immediately set isPrereleaseVersionIgnored = false')
      }

      // 立即重新计算hasUpdate状态
      const oldHasUpdate = state.hasUpdate
      state.hasUpdate = calculateHasUpdate()
      console.log('[useUpdater] Immediately updated hasUpdate from', oldHasUpdate, 'to', state.hasUpdate)

      // 等待下一个tick确保状态更新完成
      await nextTick()

      // 异步同步后端状态（用于验证一致性）
      syncIgnoredStates().catch(error => {
        console.error('[useUpdater] Failed to sync ignored states after unignore:', error)
      })

      console.log('[useUpdater] Version unignored successfully:', versionType, 'final hasUpdate:', state.hasUpdate)
    } catch (error) {
      console.error('[useUpdater] Unignore version error:', error)
    }
  }



  // 下载正式版（使用原子操作）
  const downloadStableVersion = async () => {
    if (!state.stableVersion) {
      console.warn('[useUpdater] No stable version available for download')
      state.downloadMessage = { type: 'warning', content: t('updater.noStableVersionAvailable') }
      state.lastDownloadAttempt = 'stable'
      return
    }

    // 防止重复点击 - 检查所有下载状态
    if (state.isDownloadingStable || state.isDownloadingPrerelease || state.isDownloading) {
      console.log('[useUpdater] Download already in progress')
      return
    }

    try {
      console.log('[useUpdater] Starting atomic stable version download...')
      state.isDownloadingStable = true
      state.downloadMessage = null
      state.lastDownloadAttempt = 'stable'

      // 使用新的原子操作API
      if (!window.electronAPI?.updater?.downloadSpecificVersion) {
        throw new Error('electronAPI not available')
      }
      const result = await window.electronAPI.updater.downloadSpecificVersion('stable')

      if (!result) {
        throw new Error('No result data returned from download request')
      }

      if (result.hasUpdate) {
        console.log('[useUpdater] Stable download started:', result.message)
        // 立即设置下载状态，确保UI正确显示
        state.isDownloading = true
        state.downloadProgress = null
      } else {
        console.log('[useUpdater] No stable update available:', result.message)
        // 根据不同的原因显示不同的消息
        let content: string
        if (result.reason === 'ignored' && result.version) {
          content = t('updater.versionIgnored', { version: result.version })
        } else if (result.version) {
          content = t('updater.alreadyLatestStable', { version: result.version })
        } else {
          content = t('updater.noStableVersionAvailable')
        }

        state.downloadMessage = {
          type: 'info',
          content
        }
      }

    } catch (error) {
      console.error('[useUpdater] Atomic stable download error:', error)

      // 提取完整的错误信息
      let errorMessage = t('updater.unknownError')
      if (error instanceof Error) {
        errorMessage = error.message
      }

      state.downloadMessage = {
        type: 'error',
        content: t('updater.stableDownloadFailed', { error: errorMessage })
      }
      // 确保下载状态被重置
      state.isDownloading = false
      state.downloadProgress = null
    } finally {
      state.isDownloadingStable = false
    }
  }

  // 下载预览版（使用原子操作）
  const downloadPrereleaseVersion = async () => {
    if (!state.prereleaseVersion) {
      console.warn('[useUpdater] No prerelease version available for download')
      state.downloadMessage = { type: 'warning', content: t('updater.noPrereleaseVersionAvailable') }
      state.lastDownloadAttempt = 'prerelease'
      return
    }

    // 防止重复点击 - 检查所有下载状态
    if (state.isDownloadingStable || state.isDownloadingPrerelease || state.isDownloading) {
      console.log('[useUpdater] Download already in progress')
      return
    }

    try {
      console.log('[useUpdater] Starting atomic prerelease version download...')
      state.isDownloadingPrerelease = true
      state.downloadMessage = null
      state.lastDownloadAttempt = 'prerelease'

      // 使用新的原子操作API
      if (!window.electronAPI?.updater?.downloadSpecificVersion) {
        throw new Error('electronAPI not available')
      }
      const result = await window.electronAPI.updater.downloadSpecificVersion('prerelease')

      if (!result) {
        throw new Error('No result data returned from download request')
      }

      if (result.hasUpdate) {
        console.log('[useUpdater] Prerelease download started:', result.message)
        // 立即设置下载状态，确保UI正确显示
        state.isDownloading = true
        state.downloadProgress = null
      } else {
        console.log('[useUpdater] No prerelease update available:', result.message)
        // 根据不同的原因显示不同的消息
        let content: string
        if (result.reason === 'ignored' && result.version) {
          content = t('updater.versionIgnored', { version: result.version })
        } else if (result.version) {
          content = t('updater.alreadyLatestPrerelease', { version: result.version })
        } else {
          content = t('updater.noPrereleaseVersionAvailable')
        }

        state.downloadMessage = {
          type: 'info',
          content
        }
      }

    } catch (error) {
      console.error('[useUpdater] Atomic prerelease download error:', error)

      // 提取完整的错误信息
      let errorMessage = t('updater.unknownError')
      if (error instanceof Error) {
        errorMessage = error.message
      }

      state.downloadMessage = {
        type: 'error',
        content: t('updater.prereleaseDownloadFailed', { error: errorMessage })
      }
      // 确保下载状态被重置
      state.isDownloading = false
      state.downloadProgress = null
    } finally {
      state.isDownloadingPrerelease = false
    }
  }

  // 打开发布页面
  const openReleaseUrl = async () => {
    if (!state.updateInfo?.releaseUrl || !window.electronAPI?.shell) {
      console.warn('[useUpdater] Release URL or shell API not available')
      return
    }

    try {
      await window.electronAPI.shell.openExternal(state.updateInfo.releaseUrl)
      console.log('[useUpdater] Release URL opened successfully')
    } catch (error) {
      console.error('[useUpdater] Open release URL error:', error)
    }
  }

  // 设置IPC事件监听器 - 现在主要用于下载相关事件
  const setupEventListeners = () => {
    if (!window.electronAPI?.on) {
      console.warn('[useUpdater] Event API not available')
      return
    }

    // 更新可用 - 保留用于自动检查等场景
    updateAvailableListener = (info: UpdateInfo) => {
      console.log('[useUpdater] Update available (from auto-check):', info)
      state.updateInfo = info
      state.lastCheckResult = 'available'
      state.lastCheckMessage = `New version ${info.version} is available`
      // 不直接设置 hasUpdate，而是通过 calculateHasUpdate 计算
      state.hasUpdate = calculateHasUpdate()
      console.log('[useUpdater] Update available event processed, hasUpdate:', state.hasUpdate)
    }
    window.electronAPI.on('update-available-info', updateAvailableListener)

    // 无更新可用 - 现在主要用于日志，实际逻辑在请求-响应中处理
    updateNotAvailableListener = (info: { version?: string; reason?: string }) => {
      console.log('[useUpdater] No update available (from auto-check):', info)
      // 注意：不再在这里更新UI状态，避免与请求-响应模式冲突
    }
    window.electronAPI.on('update-not-available', updateNotAvailableListener)

    // 下载进度
    downloadProgressListener = (progress: DownloadProgress) => {
      console.log('[useUpdater] Download progress:', progress)
      state.downloadProgress = progress
    }
    window.electronAPI.on('update-download-progress', downloadProgressListener)

    // 下载完成
    updateDownloadedListener = (info: UpdateInfo) => {
      console.log('[useUpdater] Update downloaded:', info)
      state.isDownloading = false
      state.isDownloaded = true
      // 重置特定下载状态
      state.isDownloadingStable = false
      state.isDownloadingPrerelease = false
      // 清除下载消息
      state.downloadMessage = null
    }
    window.electronAPI.on('update-downloaded', updateDownloadedListener)

    // 更新错误（包括下载错误）
    updateErrorListener = (error: { message?: string; code?: string; error?: string }) => {
      console.error('[useUpdater] Update error:', error)

      // 简单处理：重置下载状态，保持更新信息让用户重试
      state.isDownloading = false
      state.downloadProgress = null
      state.lastCheckResult = 'error'
      // 重置特定下载状态
      state.isDownloadingStable = false
      state.isDownloadingPrerelease = false

      // 设置用户可见的下载错误信息
      const errorMessage = error.message || error.error || 'Update check failed'

      if (state.lastDownloadAttempt) {
        const versionType = state.lastDownloadAttempt === 'stable' ? t('updater.stable') : t('updater.prerelease')
        state.downloadMessage = {
          type: 'error',
          content: t('updater.downloadFailedGeneric', { type: versionType, error: errorMessage })
        }
      }

      // 使用详细的错误信息，优先使用 message 字段（包含详细信息）
      state.lastCheckMessage = errorMessage
      // 保持 hasUpdate 和 updateInfo，让用户可以重新下载
    }
    window.electronAPI.on('update-error', updateErrorListener)

    // 下载开始事件 - 立即同步UI状态
    downloadStartedListener = (info: { versionType?: 'stable' | 'prerelease'; version?: string }) => {
      console.log('[useUpdater] Download started:', info)
      // 立即设置下载状态，确保UI响应
      state.isDownloading = true
      state.downloadProgress = null
      // 根据版本类型设置对应的下载状态
      if (info.versionType === 'stable') {
        state.isDownloadingStable = true
      } else if (info.versionType === 'prerelease') {
        state.isDownloadingPrerelease = true
      }
      // 清除之前的消息
      state.downloadMessage = null
    }
    window.electronAPI.on('updater-download-started', downloadStartedListener)
  }

  // 清理事件监听器
  const cleanupEventListeners = () => {
    if (!window.electronAPI?.off) return

    if (updateAvailableListener) {
      window.electronAPI.off('update-available-info', updateAvailableListener)
    }
    if (updateNotAvailableListener) {
      window.electronAPI.off('update-not-available', updateNotAvailableListener)
    }
    if (downloadProgressListener) {
      window.electronAPI.off('update-download-progress', downloadProgressListener)
    }
    if (updateDownloadedListener) {
      window.electronAPI.off('update-downloaded', updateDownloadedListener)
    }
    if (updateErrorListener) {
      window.electronAPI.off('update-error', updateErrorListener)
    }
    if (downloadStartedListener) {
      window.electronAPI.off('updater-download-started', downloadStartedListener)
    }
  }

  // 初始化
  onMounted(async () => {
    try {
      // 获取当前版本
      state.currentVersion = await getCurrentVersion()
      console.log('[useUpdater] Current version loaded:', state.currentVersion)

      // 设置事件监听器
      setupEventListeners()

      // 清理旧的缓存数据
      await clearUpdateStateCache()

      // 同步后端的忽略状态，确保前后端一致
      await syncIgnoredStates()

      // 每次启动都自动检查更新，确保状态最新
      console.log('[useUpdater] Performing automatic update check on startup')
      // 延迟3秒后自动检测，避免影响应用启动速度
      setTimeout(() => {
        checkUpdate().catch(error => {
          console.warn('[useUpdater] Automatic update check failed:', error)
        })
      }, 3000)

      console.log('[useUpdater] Updater initialized')
    } catch (error) {
      console.error('[useUpdater] Initialization error:', error)
    }
  })

  // 清理
  onUnmounted(() => {
    cleanupEventListeners()
  })

  const instance = {
    state,
    checkUpdate,
    startDownload,
    installUpdate,
    ignoreUpdate,
    unignoreUpdate,
    openReleaseUrl,
    downloadStableVersion,
    downloadPrereleaseVersion
  }

  // 缓存实例，确保单例
  globalUpdaterInstance = instance
  return instance
}
