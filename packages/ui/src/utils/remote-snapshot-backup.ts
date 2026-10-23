import type {
  FullImageData,
  IDataManager,
  IFavoriteManager,
  IImageStorageService,
  ImageMetadata,
} from '@prompt-optimizer/core'

import {
  DEFAULT_DATA_MANAGER_PACKAGE_SECTIONS,
  type DataManagerFavoritesMergeStrategy,
  type DataManagerImageStoreKey,
  type DataManagerPackageSection,
  type DataManagerPackageSectionSelection,
} from './data-manager-resource-package'
import {
  base64ToBytes,
  createFullImageDataFromResource,
  resolveResourceMimeType,
  safeImageResourceFileName,
  sha256Hex,
  validateImageResourceBytes,
  type ImageResourceRestoreReport,
} from './image-resource-backup'
import { joinRemotePath, type RemoteObjectEntry, type RemoteObjectStore } from './remote-backup'

export const REMOTE_SNAPSHOT_SCHEMA_VERSION = 'prompt-optimizer/remote-snapshot/v1' as const
export const REMOTE_SNAPSHOT_ROOT = 'v1'

const APP_DATA_FILE_NAME = 'app-data.json'
const FAVORITES_FILE_NAME = 'favorites.json'
const MANIFEST_FILE_NAME = 'manifest.json'
const REMOTE_SNAPSHOT_CLEANUP_MINIMUM_AGE_MS = 24 * 60 * 60 * 1000

export type RemoteSnapshotAsset = {
  kind: 'image'
  store: DataManagerImageStoreKey
  id: string
  path: string
  mimeType: string
  sizeBytes: number
  createdAt: number
  accessedAt?: number
  source: ImageMetadata['source']
  metadata?: ImageMetadata['metadata']
  sha256?: string
}

export type RemoteSnapshotManifest = {
  schemaVersion: typeof REMOTE_SNAPSHOT_SCHEMA_VERSION
  snapshotId: string
  createdAt: string
  appDataPath: string
  favoritesPath: string
  assets: RemoteSnapshotAsset[]
  missingAssets: Array<{ store: DataManagerImageStoreKey; id: string }>
  assetCounts: Record<DataManagerImageStoreKey, number>
  includedSections: DataManagerPackageSection[]
}

export type RemoteSnapshotEntry = {
  id: string
  name: string
  manifestPath: string
  updatedAt?: string
  sizeBytes?: number
  manifest?: RemoteSnapshotManifest
}

export type RemoteSnapshotBackupResult = {
  entry: RemoteSnapshotEntry
  manifest: RemoteSnapshotManifest
  uploadedAssets: number
  skippedAssets: number
  missingAssets: Array<{ store: DataManagerImageStoreKey; id: string }>
}

export type RemoteSnapshotRestoreReport = ImageResourceRestoreReport<{
  store: DataManagerImageStoreKey
  id: string
}> & {
  imported: {
    appData: boolean
    favorites: boolean
  }
}

export type RemoteSnapshotCleanupCandidate = {
  path: string
  sizeBytes?: number
  updatedAt?: string
}

export type RemoteSnapshotCleanupAnalysis = {
  candidates: RemoteSnapshotCleanupCandidate[]
  referencedAssetCount: number
  totalCandidateBytes: number
}

export type RemoteSnapshotCleanupResult = RemoteSnapshotCleanupAnalysis & {
  deleted: number
  failed: Array<{ path: string; message: string }>
}

export type RemoteSnapshotProgressPhase =
  | 'prepare'
  | 'scan'
  | 'asset-check'
  | 'asset-upload'
  | 'metadata-upload'
  | 'manifest-upload'
  | 'list'
  | 'restore-validate'
  | 'restore-write'
  | 'cleanup-analyze'
  | 'cleanup-delete'
  | 'done'

export type RemoteSnapshotProgressEvent = {
  phase: RemoteSnapshotProgressPhase
  current?: number
  total?: number
  item?: string
  uploaded?: number
  skipped?: number
  deleted?: number
}

export type RemoteSnapshotProgressReporter = (event: RemoteSnapshotProgressEvent) => void

type ExportRemoteSnapshotOptions = {
  objectStore: RemoteObjectStore
  dataManager: Pick<IDataManager, 'exportAllData'>
  favoriteManager: Pick<IFavoriteManager, 'exportFavorites'> | null | undefined
  imageStorageService?: Pick<IImageStorageService, 'listAllMetadata' | 'getImage'> | null
  favoriteImageStorageService?: Pick<IImageStorageService, 'listAllMetadata' | 'getImage'> | null
  sections?: Partial<DataManagerPackageSectionSelection>
  onProgress?: RemoteSnapshotProgressReporter
}

type RestoreRemoteSnapshotOptions = {
  objectStore: RemoteObjectStore
  snapshotId: string
  dataManager: Pick<IDataManager, 'importAllData'>
  favoriteManager: Pick<IFavoriteManager, 'importFavorites'> | null | undefined
  imageStorageService?: Pick<IImageStorageService, 'getImage' | 'saveImage'> | null
  favoriteImageStorageService?: Pick<IImageStorageService, 'getImage' | 'saveImage'> | null
  sections?: Partial<DataManagerPackageSectionSelection>
  favoriteMergeStrategy?: DataManagerFavoritesMergeStrategy
  onProgress?: RemoteSnapshotProgressReporter
}

type ImageStoreExportConfig = {
  key: DataManagerImageStoreKey
  service: ExportRemoteSnapshotOptions['imageStorageService']
}

type PreparedImageRestore = {
  store: DataManagerImageStoreKey
  image: FullImageData
}

const EMPTY_APP_DATA_JSON = JSON.stringify({ version: 1, data: {} }, null, 2)
const EMPTY_FAVORITES_JSON = JSON.stringify({ version: '1.0', favorites: [], categories: [], tags: [] }, null, 2)
const ALL_DATA_MANAGER_PACKAGE_SECTIONS = Object.keys(
  DEFAULT_DATA_MANAGER_PACKAGE_SECTIONS,
) as DataManagerPackageSection[]

const resolveSectionSelection = (
  sections?: Partial<DataManagerPackageSectionSelection>,
): DataManagerPackageSectionSelection => ({
  ...DEFAULT_DATA_MANAGER_PACKAGE_SECTIONS,
  ...(sections ?? {}),
})

const getManifestIncludedSectionSet = (
  manifest: RemoteSnapshotManifest,
): Set<DataManagerPackageSection> => {
  const included = Array.isArray(manifest.includedSections)
    ? manifest.includedSections.filter((section): section is DataManagerPackageSection =>
      ALL_DATA_MANAGER_PACKAGE_SECTIONS.includes(section as DataManagerPackageSection),
    )
    : []

  if (included.length > 0) {
    return new Set(included)
  }

  return new Set([
    'appData',
    'favorites',
    ...manifest.assets.map((asset) => asset.store),
  ])
}

const resolveRestoreSectionSelection = (
  manifest: RemoteSnapshotManifest,
  requested?: Partial<DataManagerPackageSectionSelection>,
): DataManagerPackageSectionSelection => {
  const requestedSections = resolveSectionSelection(requested)
  const includedSections = getManifestIncludedSectionSet(manifest)

  return ALL_DATA_MANAGER_PACKAGE_SECTIONS.reduce((selection, section) => {
    selection[section] = requestedSections[section] && includedSections.has(section)
    return selection
  }, {} as DataManagerPackageSectionSelection)
}

const snapshotDirectory = (snapshotId: string): string =>
  joinRemotePath(REMOTE_SNAPSHOT_ROOT, 'snapshots', snapshotId)

const snapshotManifestPath = (snapshotId: string): string =>
  joinRemotePath(snapshotDirectory(snapshotId), MANIFEST_FILE_NAME)

const snapshotAppDataPath = (snapshotId: string): string =>
  joinRemotePath(snapshotDirectory(snapshotId), APP_DATA_FILE_NAME)

const snapshotFavoritesPath = (snapshotId: string): string =>
  joinRemotePath(snapshotDirectory(snapshotId), FAVORITES_FILE_NAME)

export const createRemoteSnapshotId = (date = new Date()): string =>
  date.toISOString().replace(/[:.]/g, '-')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const textEncoder = new TextEncoder()

const remoteAssetPath = (
  store: DataManagerImageStoreKey,
  id: string,
  mimeType: string,
  contentHash?: string,
): string =>
  joinRemotePath(REMOTE_SNAPSHOT_ROOT, 'assets', store, safeImageResourceFileName(id, mimeType, contentHash))

const parseManifest = (json: string): RemoteSnapshotManifest => {
  const parsed = JSON.parse(json) as unknown
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== REMOTE_SNAPSHOT_SCHEMA_VERSION ||
    typeof parsed.snapshotId !== 'string' ||
    typeof parsed.appDataPath !== 'string' ||
    typeof parsed.favoritesPath !== 'string' ||
    !Array.isArray(parsed.assets) ||
    !Array.isArray(parsed.missingAssets)
  ) {
    throw new Error('Invalid remote snapshot manifest')
  }
  return parsed as RemoteSnapshotManifest
}

const validateJsonText = (text: string, label: string): void => {
  try {
    JSON.parse(text)
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${(error as Error).message}`, {
      cause: error,
    })
  }
}

const getImportStorageService = (
  store: DataManagerImageStoreKey,
  options: RestoreRemoteSnapshotOptions,
): Pick<IImageStorageService, 'getImage' | 'saveImage'> | null | undefined =>
  store === 'favoriteImages'
    ? options.favoriteImageStorageService
    : options.imageStorageService

const getRemoteObjectEntry = async (
  objectStore: RemoteObjectStore,
  path: string,
): Promise<Pick<RemoteObjectEntry, 'path' | 'sizeBytes'> | null> => {
  if (typeof objectStore.head === 'function') {
    return objectStore.head(path)
  }
  return await objectStore.exists(path) ? { path } : null
}

const remoteObjectCanReuseContentAddressedBytes = (
  remoteEntry: Pick<RemoteObjectEntry, 'sizeBytes'> | null,
  localSizeBytes: number,
  contentHash: string | undefined,
): boolean => {
  if (!remoteEntry) return false
  if (!contentHash) return false
  if (typeof remoteEntry.sizeBytes !== 'number') return false
  return remoteEntry.sizeBytes === localSizeBytes
}

const collectStoreAssets = async (
  objectStore: RemoteObjectStore,
  config: ImageStoreExportConfig,
  onProgress: RemoteSnapshotProgressReporter | undefined,
): Promise<{
  assets: RemoteSnapshotAsset[]
  missing: Array<{ store: DataManagerImageStoreKey; id: string }>
  uploaded: number
  skipped: number
}> => {
  if (!config.service) {
    return { assets: [], missing: [], uploaded: 0, skipped: 0 }
  }

  const metadataList = await config.service.listAllMetadata()
  onProgress?.({
    phase: 'scan',
    current: 0,
    total: metadataList.length,
    item: config.key,
  })
  const assets: RemoteSnapshotAsset[] = []
  const missing: Array<{ store: DataManagerImageStoreKey; id: string }> = []
  let uploaded = 0
  let skipped = 0

  for (const [index, metadata] of metadataList.entries()) {
    const image: FullImageData | null = await config.service.getImage(metadata.id)
    if (!image?.data) {
      missing.push({ store: config.key, id: metadata.id })
      continue
    }

    const bytes = base64ToBytes(image.data)
    const mimeType = resolveResourceMimeType(image.metadata.mimeType || metadata.mimeType, bytes)
    const sha256 = await sha256Hex(bytes)
    const path = remoteAssetPath(config.key, metadata.id, mimeType, sha256)

    onProgress?.({
      phase: 'asset-check',
      current: index + 1,
      total: metadataList.length,
      item: metadata.id,
      uploaded,
      skipped,
    })
    const remoteEntry = await getRemoteObjectEntry(objectStore, path)
    if (remoteObjectCanReuseContentAddressedBytes(remoteEntry, bytes.byteLength, sha256)) {
      skipped += 1
    } else {
      onProgress?.({
        phase: 'asset-upload',
        current: index + 1,
        total: metadataList.length,
        item: metadata.id,
        uploaded,
        skipped,
      })
      await objectStore.put(path, bytes, { contentType: mimeType })
      uploaded += 1
    }

    assets.push({
      kind: 'image',
      store: config.key,
      id: metadata.id,
      path,
      mimeType,
      sizeBytes: bytes.byteLength,
      createdAt: image.metadata.createdAt || metadata.createdAt || Date.now(),
      accessedAt: image.metadata.accessedAt || metadata.accessedAt,
      source: image.metadata.source || metadata.source || 'uploaded',
      metadata: image.metadata.metadata || metadata.metadata,
      sha256,
    })
  }

  return { assets, missing, uploaded, skipped }
}

export const createRemoteSnapshotBackup = async (
  options: ExportRemoteSnapshotOptions,
): Promise<RemoteSnapshotBackupResult> => {
  const sections = resolveSectionSelection(options.sections)
  const snapshotId = createRemoteSnapshotId()
  options.onProgress?.({ phase: 'prepare' })
  const appDataJson = sections.appData
    ? await options.dataManager.exportAllData()
    : EMPTY_APP_DATA_JSON
  const favoritesJson = sections.favorites && options.favoriteManager
    ? await options.favoriteManager.exportFavorites()
    : EMPTY_FAVORITES_JSON

  validateJsonText(appDataJson, 'app-data.json')
  validateJsonText(favoritesJson, 'favorites.json')

  const storeConfigs: ImageStoreExportConfig[] = [
    {
      key: 'imageCache',
      service: sections.imageCache ? options.imageStorageService : null,
    },
    {
      key: 'favoriteImages',
      service: sections.favoriteImages ? options.favoriteImageStorageService : null,
    },
  ]

  const assets: RemoteSnapshotAsset[] = []
  const missingAssets: Array<{ store: DataManagerImageStoreKey; id: string }> = []
  let uploadedAssets = 0
  let skippedAssets = 0

  for (const config of storeConfigs) {
    const result = await collectStoreAssets(options.objectStore, config, options.onProgress)
    assets.push(...result.assets)
    missingAssets.push(...result.missing)
    uploadedAssets += result.uploaded
    skippedAssets += result.skipped
  }

  const manifest: RemoteSnapshotManifest = {
    schemaVersion: REMOTE_SNAPSHOT_SCHEMA_VERSION,
    snapshotId,
    createdAt: new Date().toISOString(),
    appDataPath: snapshotAppDataPath(snapshotId),
    favoritesPath: snapshotFavoritesPath(snapshotId),
    assets,
    missingAssets,
    assetCounts: {
      imageCache: assets.filter((asset) => asset.store === 'imageCache').length,
      favoriteImages: assets.filter((asset) => asset.store === 'favoriteImages').length,
    },
    includedSections: (Object.keys(sections) as DataManagerPackageSection[])
      .filter((section) => sections[section]),
  }

  options.onProgress?.({ phase: 'metadata-upload', current: 1, total: 2, item: APP_DATA_FILE_NAME })
  await options.objectStore.put(manifest.appDataPath, appDataJson, { contentType: 'application/json' })
  options.onProgress?.({ phase: 'metadata-upload', current: 2, total: 2, item: FAVORITES_FILE_NAME })
  await options.objectStore.put(manifest.favoritesPath, favoritesJson, { contentType: 'application/json' })
  const manifestText = JSON.stringify(manifest, null, 2)
  options.onProgress?.({ phase: 'manifest-upload', item: MANIFEST_FILE_NAME })
  await options.objectStore.put(snapshotManifestPath(snapshotId), manifestText, { contentType: 'application/json' })
  options.onProgress?.({
    phase: 'done',
    uploaded: uploadedAssets,
    skipped: skippedAssets,
  })

  return {
    entry: {
      id: snapshotId,
      name: snapshotId,
      manifestPath: snapshotManifestPath(snapshotId),
      updatedAt: manifest.createdAt,
      sizeBytes: textEncoder.encode(manifestText).byteLength,
      manifest,
    },
    manifest,
    uploadedAssets,
    skippedAssets,
    missingAssets,
  }
}

export const listRemoteSnapshotBackups = async (
  objectStore: RemoteObjectStore,
  onProgress?: RemoteSnapshotProgressReporter,
): Promise<RemoteSnapshotEntry[]> => {
  onProgress?.({ phase: 'list' })
  const entries = await objectStore.list(joinRemotePath(REMOTE_SNAPSHOT_ROOT, 'snapshots'))
  const manifests = entries.filter((entry) => entry.path.endsWith(`/${MANIFEST_FILE_NAME}`))
  const snapshots: RemoteSnapshotEntry[] = []

  for (const entry of manifests) {
    try {
      const manifest = parseManifest(await objectStore.getText(entry.path))
      snapshots.push({
        id: manifest.snapshotId,
        name: manifest.snapshotId,
        manifestPath: entry.path,
        updatedAt: manifest.createdAt || entry.updatedAt,
        sizeBytes: entry.sizeBytes,
        manifest,
      })
    } catch (error) {
      console.warn('[RemoteSnapshotBackup] Ignoring invalid remote snapshot manifest:', error)
    }
  }

  return snapshots.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
}

const prepareRemoteSnapshotRestore = async (
  manifest: RemoteSnapshotManifest,
  options: RestoreRemoteSnapshotOptions,
): Promise<{
  appDataJson: string | null
  favoritesJson: string | null
  images: PreparedImageRestore[]
  report: RemoteSnapshotRestoreReport
}> => {
  const sections = resolveRestoreSectionSelection(manifest, options.sections)
  const report: RemoteSnapshotRestoreReport = {
    restored: 0,
    skipped: 0,
    missing: [],
    corrupt: [],
    errors: [],
    imported: {
      appData: sections.appData,
      favorites: Boolean(sections.favorites && options.favoriteManager),
    },
  }

  const selectedStores = new Set<DataManagerImageStoreKey>([
    ...(sections.imageCache ? ['imageCache' as const] : []),
    ...(sections.favoriteImages ? ['favoriteImages' as const] : []),
  ])

  const appDataJson = sections.appData
    ? await options.objectStore.getText(manifest.appDataPath)
    : null
  const favoritesJson = sections.favorites && options.favoriteManager
    ? await options.objectStore.getText(manifest.favoritesPath)
    : null

  if (appDataJson !== null) validateJsonText(appDataJson, 'app-data.json')
  if (favoritesJson !== null) validateJsonText(favoritesJson, 'favorites.json')

  const images: PreparedImageRestore[] = []
  for (const [index, asset] of manifest.assets.entries()) {
    if (
      asset.kind !== 'image' ||
      !asset.id ||
      !asset.path ||
      !selectedStores.has(asset.store)
    ) {
      report.skipped += 1
      continue
    }

    const storageService = getImportStorageService(asset.store, options)
    if (!storageService) {
      report.errors.push(`${asset.store}:${asset.id}: image storage service is unavailable`)
      continue
    }

    try {
      options.onProgress?.({
        phase: 'restore-validate',
        current: index + 1,
        total: manifest.assets.length,
        item: asset.id,
      })
      const bytes = new Uint8Array(await options.objectStore.get(asset.path))
      const validation = await validateImageResourceBytes(asset, bytes)
      if (validation !== 'ok') {
        report.corrupt.push({ store: asset.store, id: asset.id })
        continue
      }

      const existing = await storageService.getImage(asset.id)
      if (existing?.data) {
        report.skipped += 1
        continue
      }

      images.push({
        store: asset.store,
        image: createFullImageDataFromResource(asset, bytes),
      })
    } catch (error) {
      if (String((error as Error).message || error).includes('not found')) {
        report.missing.push({ store: asset.store, id: asset.id })
      } else {
        report.errors.push(`${asset.store}:${asset.id}: ${(error as Error).message}`)
      }
    }
  }

  report.missing.push(...manifest.missingAssets.filter((asset) => selectedStores.has(asset.store)))

  if (report.missing.length > 0 || report.corrupt.length > 0 || report.errors.length > 0) {
    const details = [
      report.missing.length ? `missing=${report.missing.length}` : '',
      report.corrupt.length ? `corrupt=${report.corrupt.length}` : '',
      report.errors.length ? `errors=${report.errors.length}` : '',
    ].filter(Boolean).join(', ')
    throw new Error(`Remote snapshot restore validation failed: ${details}`)
  }

  return {
    appDataJson,
    favoritesJson,
    images,
    report,
  }
}

export const restoreRemoteSnapshotBackup = async (
  options: RestoreRemoteSnapshotOptions,
): Promise<RemoteSnapshotRestoreReport> => {
  options.onProgress?.({ phase: 'restore-validate', current: 0, total: 1, item: MANIFEST_FILE_NAME })
  const manifest = parseManifest(await options.objectStore.getText(snapshotManifestPath(options.snapshotId)))
  const prepared = await prepareRemoteSnapshotRestore(manifest, options)

  for (const [index, item] of prepared.images.entries()) {
    const storageService = getImportStorageService(item.store, options)
    if (!storageService) {
      throw new Error(`${item.store}:${item.image.metadata.id}: image storage service is unavailable`)
    }
    options.onProgress?.({
      phase: 'restore-write',
      current: index + 1,
      total: prepared.images.length,
      item: item.image.metadata.id,
    })
    await storageService.saveImage(item.image)
    prepared.report.restored += 1
  }

  if (prepared.favoritesJson !== null && options.favoriteManager) {
    options.onProgress?.({ phase: 'restore-write', item: FAVORITES_FILE_NAME })
    const result = await options.favoriteManager.importFavorites(prepared.favoritesJson, {
      mergeStrategy: options.favoriteMergeStrategy ?? 'overwrite',
    })
    if (result.errors.length > 0) {
      throw new Error(`Favorites import failed: ${result.errors.join('; ')}`)
    }
  }

  // Keep workspace snapshots as the last durable commit, matching local ZIP
  // restore. A preceding failure must leave the old workspace safe to resume.
  if (prepared.appDataJson !== null) {
    options.onProgress?.({ phase: 'restore-write', item: APP_DATA_FILE_NAME })
    await options.dataManager.importAllData(prepared.appDataJson)
  }

  options.onProgress?.({
    phase: 'done',
    current: prepared.report.restored,
    total: prepared.images.length,
  })
  return prepared.report
}

const readCommittedSnapshotManifests = async (
  objectStore: RemoteObjectStore,
): Promise<RemoteSnapshotManifest[]> => {
  const entries = await objectStore.list(joinRemotePath(REMOTE_SNAPSHOT_ROOT, 'snapshots'))
  const manifestEntries = entries.filter((entry) => entry.path.endsWith(`/${MANIFEST_FILE_NAME}`))
  const manifests: RemoteSnapshotManifest[] = []
  const failures: Array<{ path: string; message: string }> = []

  for (const entry of manifestEntries) {
    try {
      manifests.push(parseManifest(await objectStore.getText(entry.path)))
    } catch (error) {
      failures.push({
        path: entry.path,
        message: (error as Error).message || String(error),
      })
    }
  }

  if (failures.length > 0) {
    const firstFailure = failures[0]
    throw new Error(
      `Unable to safely analyze remote snapshot assets because ${failures.length} snapshot manifest(s) could not be read. First failure: ${firstFailure.path}: ${firstFailure.message}`,
    )
  }

  return manifests
}

const isCleanupCandidateOldEnough = (
  entry: Pick<RemoteObjectEntry, 'updatedAt'>,
  nowMs: number,
  minimumAgeMs: number,
): boolean => {
  if (minimumAgeMs <= 0) return true
  if (!entry.updatedAt) return false
  const updatedAtMs = Date.parse(entry.updatedAt)
  return Number.isFinite(updatedAtMs) && nowMs - updatedAtMs >= minimumAgeMs
}

export const analyzeRemoteSnapshotAssetCleanup = async (
  objectStore: RemoteObjectStore,
  onProgress?: RemoteSnapshotProgressReporter,
  options?: {
    minimumAgeMs?: number
    now?: Date
  },
): Promise<RemoteSnapshotCleanupAnalysis> => {
  onProgress?.({ phase: 'cleanup-analyze' })
  const nowMs = options?.now?.getTime() ?? Date.now()
  const minimumAgeMs = options?.minimumAgeMs ?? REMOTE_SNAPSHOT_CLEANUP_MINIMUM_AGE_MS
  const manifests = await readCommittedSnapshotManifests(objectStore)
  const referenced = new Set(manifests.flatMap((manifest) => manifest.assets.map((asset) => asset.path)))
  const remoteAssets = await objectStore.list(joinRemotePath(REMOTE_SNAPSHOT_ROOT, 'assets'))
  const candidates = remoteAssets
    .filter((entry) => !referenced.has(entry.path))
    .filter((entry) => isCleanupCandidateOldEnough(entry, nowMs, minimumAgeMs))
    .map((entry) => ({
      path: entry.path,
      sizeBytes: entry.sizeBytes,
      updatedAt: entry.updatedAt,
    }))

  return {
    candidates,
    referencedAssetCount: referenced.size,
    totalCandidateBytes: candidates.reduce((sum, candidate) => sum + (candidate.sizeBytes ?? 0), 0),
  }
}

export const cleanupRemoteSnapshotAssets = async (
  objectStore: RemoteObjectStore,
  onProgress?: RemoteSnapshotProgressReporter,
  options?: {
    minimumAgeMs?: number
    now?: Date
  },
): Promise<RemoteSnapshotCleanupResult> => {
  if (!objectStore.delete) {
    throw new Error('Remote asset cleanup is not supported by this provider')
  }
  const analysis = await analyzeRemoteSnapshotAssetCleanup(objectStore, onProgress, options)
  const failed: Array<{ path: string; message: string }> = []
  let deleted = 0

  for (const [index, candidate] of analysis.candidates.entries()) {
    try {
      onProgress?.({
        phase: 'cleanup-delete',
        current: index + 1,
        total: analysis.candidates.length,
        item: candidate.path,
        deleted,
      })
      await objectStore.delete(candidate.path)
      deleted += 1
    } catch (error) {
      failed.push({ path: candidate.path, message: (error as Error).message })
    }
  }

  return {
    ...analysis,
    deleted,
    failed,
  }
}
