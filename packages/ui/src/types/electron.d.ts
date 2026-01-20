/**
 * Electron API 类型定义
 *
 * 仅用于UI包，定义通过 contextBridge 暴露给渲染进程的 Electron API 类型
 * 保持与 desktop/preload.js 中的实际实现同步
 */

import type {
  ContextPackage,
  ContextListItem,
  ContextBundle,
  ImportMode,
  ImportResult,
  ContextMode
} from '@prompt-optimizer/core'

// 基础响应类型
interface ElectronErrorPayload {
  message: string
  code?: string
  params?: Record<string, unknown>
}

interface ElectronResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string | ElectronErrorPayload
}

// 应用相关API
interface AppAPI {
  getVersion(): Promise<string>
  getPath(name: string): Promise<string>
  quit(): Promise<void>
}

// 更新器相关API - 简单直接的类型定义
interface UpdaterAPI {
  checkUpdate(): Promise<unknown>
  checkAllVersions(): Promise<{
    currentVersion: string
    stable?: {
      remoteVersion?: string
      remoteReleaseUrl?: string
      error?: string
      noVersionFound?: boolean
      hasUpdate?: boolean
      message?: string
      versionType?: string
      releaseDate?: string
      releaseNotes?: string
    }
    prerelease?: {
      remoteVersion?: string
      remoteReleaseUrl?: string
      error?: string
      noVersionFound?: boolean
      hasUpdate?: boolean
      message?: string
      versionType?: string
      releaseDate?: string
      releaseNotes?: string
    }
  }>
  downloadSpecificVersion(versionType: 'stable' | 'prerelease'): Promise<{
    hasUpdate: boolean
    message: string
    version?: string
    reason?: 'ignored' | 'latest' | 'error'
  }>
  installUpdate(): Promise<void>
  ignoreVersion(version: string, versionType?: 'stable' | 'prerelease'): Promise<void>
  unignoreVersion(versionType: 'stable' | 'prerelease'): Promise<void>
  getIgnoredVersions(): Promise<{
    stable: string | null
    prerelease: string | null
  }>
}

// Shell相关API - 简化类型
interface ShellAPI {
  openExternal(url: string): Promise<void>
  showItemInFolder(path: string): Promise<void>
}

// 事件监听API
interface EventAPI {
  on<K extends keyof ElectronEventMap>(channel: K, listener: (...args: ElectronEventMap[K]) => void): void
  on(channel: string, listener: (...args: unknown[]) => void): void

  off<K extends keyof ElectronEventMap>(channel: K, listener: (...args: ElectronEventMap[K]) => void): void
  off(channel: string, listener: (...args: unknown[]) => void): void

  once<K extends keyof ElectronEventMap>(channel: K, listener: (...args: ElectronEventMap[K]) => void): void
  once(channel: string, listener: (...args: unknown[]) => void): void
}

interface ElectronEventMap {
  'update-available-info': [UpdateInfo]
  'update-not-available': [{ version?: string; reason?: string }]
  'update-download-progress': [DownloadProgress]
  'update-downloaded': [UpdateInfo]
  'update-error': [{ message?: string; code?: string; error?: string }]
  'updater-download-started': [{ versionType?: 'stable' | 'prerelease'; version?: string }]
}

type LlmStreamCallbacks = {
  onContent?: (content: string) => void
  onThinking?: (thinking: string) => void
  onToolCall?: (toolCall: unknown) => void
  onFinish?: () => void
  onError?: (error: Error) => void
}

interface LlmAPI {
  testConnection(provider: string): Promise<void>
  sendMessage(messages: unknown[], provider: string): Promise<string>
  sendMessageStructured(messages: unknown[], provider: string): Promise<unknown>
  sendMessageStream(messages: unknown[], provider: string, callbacks: LlmStreamCallbacks): Promise<void>
  sendMessageStreamWithTools(messages: unknown[], provider: string, tools: unknown[], callbacks: LlmStreamCallbacks): Promise<void>
  fetchModelList(provider: string, customConfig?: unknown): Promise<Array<{ value: string; label: string }>>
}

// 图像生成API
interface ImageAPI {
  generate(request: unknown): Promise<unknown>
  generateText2Image(request: unknown): Promise<unknown>
  generateImage2Image(request: unknown): Promise<unknown>

  validateRequest(request: unknown): Promise<unknown>
  validateText2ImageRequest(request: unknown): Promise<unknown>
  validateImage2ImageRequest(request: unknown): Promise<unknown>

  testConnection(config: unknown): Promise<unknown>
  getDynamicModels(providerId: string, connectionConfig: unknown): Promise<unknown[]>
}

// 图像模型管理API
interface ImageModelAPI {
  ensureInitialized(): Promise<void>
  isInitialized(): Promise<boolean>
  getAllConfigs(): Promise<unknown[]>
  getConfig(id: string): Promise<unknown>
  addConfig(config: unknown): Promise<void>
  updateConfig(id: string, updates: unknown): Promise<void>
  deleteConfig(id: string): Promise<void>
  getEnabledConfigs(): Promise<unknown[]>
  exportData(): Promise<unknown>
  importData(data: unknown): Promise<void>
  getDataType(): Promise<string>
  validateData(data: unknown): Promise<boolean>
}

// 上下文管理API
interface ContextAPI {
  list(): Promise<ContextListItem[]>
  getCurrentId(): Promise<string>
  setCurrentId(id: string): Promise<void>
  get(id: string): Promise<ContextPackage>
  create(meta?: { title?: string; mode?: ContextMode }): Promise<string>
  duplicate(id: string, options?: { mode?: ContextMode }): Promise<string>
  rename(id: string, title: string): Promise<void>
  save(ctx: ContextPackage): Promise<void>
  update(id: string, patch: Partial<ContextPackage>): Promise<void>
  remove(id: string): Promise<void>
  exportAll(): Promise<ContextBundle>
  importAll(bundle: ContextBundle, mode: ImportMode): Promise<ImportResult>
  exportData(): Promise<ContextBundle>
  importData(data: unknown): Promise<void>
  getDataType(): Promise<string>
  validateData(data: unknown): Promise<boolean>
}

// 数据管理API
interface DataStorageInfo {
  userDataPath: string
  mainFilePath: string
  mainSizeBytes: number
  backupFilePath: string
  backupSizeBytes: number
  totalBytes: number
}

interface DataAPI {
  // Export/import all app data as JSON string
  exportAllData(): Promise<string>
  importAllData(dataString: string): Promise<void>

  // Desktop-only helpers
  getStorageInfo(): Promise<DataStorageInfo>
  openStorageDirectory(): Promise<boolean>
}

// 完整的ElectronAPI接口
interface ElectronAPI {
  app: AppAPI
  updater: UpdaterAPI
  shell: ShellAPI
  llm: LlmAPI
  image: ImageAPI
  imageModel: ImageModelAPI
  context: ContextAPI
  data: DataAPI
  on: EventAPI['on']
  off: EventAPI['off']
  once: EventAPI['once']
}

// 全局Window类型扩展
declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }

  // 扩展Error接口，支持自定义属性
  interface Error {
    detailedMessage?: string
    originalError?: unknown
    code?: string
    params?: Record<string, unknown>
  }
}

// 下载进度类型
interface DownloadProgress {
  percent: number
  bytesPerSecond: number
  total: number
  transferred: number
}

// 更新信息类型
interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseUrl?: string
  releaseNotes?: string
}

// 版本检查结果类型
interface VersionCheckResult {
  remoteVersion?: string
  remoteReleaseUrl?: string
  error?: string
  noVersionFound?: boolean
}

// 下载结果类型
interface DownloadResult {
  hasUpdate: boolean
  message: string
  version?: string
  reason?: 'ignored' | 'latest' | 'error'
}

// 导出类型（可选，用于其他文件引用）
export type {
  ElectronResponse,
  AppAPI,
  UpdaterAPI,
  ShellAPI,
  EventAPI,
  ImageAPI,
  ImageModelAPI,
  ContextAPI,
  DataAPI,
  DataStorageInfo,
  ElectronAPI,
  DownloadProgress,
  UpdateInfo,
  VersionCheckResult,
  DownloadResult
}
