import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type {
  IDataManager,
  FullImageData,
  IFavoriteManager,
  IImageStorageService,
  ImageMetadata,
} from '@prompt-optimizer/core'

import {
  assertImageResourceRestoreReportSafe,
  assertImageRestoreCapacity,
  base64ToBytes,
  bytesToArrayBuffer,
  copyBytes,
  createFullImageDataFromResource,
  hasMatchingImageResource,
  resolveResourceMimeType,
  safeImageResourceFileName,
  sha256Hex,
  validateImageResourceBytes,
  type ImageResourceRestoreReport,
  type ImageResourceStorage,
} from './image-resource-backup'
import { collectBackupImageReferences, findMissingBackupImageReferences } from './image-resource-references'

export const DATA_MANAGER_RESOURCE_PACKAGE_SCHEMA_VERSION = 'prompt-optimizer/app-backup/v1' as const

export type DataManagerImageStoreKey = 'imageCache' | 'favoriteImages'
export type DataManagerPackageSection =
  | 'appData'
  | 'favorites'
  | DataManagerImageStoreKey

export type DataManagerPackageSectionSelection = Record<DataManagerPackageSection, boolean>
export type DataManagerFavoritesMergeStrategy = 'skip' | 'overwrite' | 'merge'

export type DataManagerResourceManifestEntry = {
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

export type DataManagerResourcePackageManifest = {
  schemaVersion: typeof DATA_MANAGER_RESOURCE_PACKAGE_SCHEMA_VERSION
  createdAt: string
  appDataPath: 'app-data.json'
  favoritesPath: 'favorites.json'
  resources: DataManagerResourceManifestEntry[]
  missingResources: Array<{ store: DataManagerImageStoreKey; id: string }>
  resourceCounts: Record<DataManagerImageStoreKey, number>
  includedSections?: DataManagerPackageSection[]
}

export type DataManagerResourcePackageExportResult = {
  blob: Blob
  manifest: DataManagerResourcePackageManifest
  missingResources: Array<{ store: DataManagerImageStoreKey; id: string }>
}

export type DataManagerResourceRestoreReport = ImageResourceRestoreReport<{
  store: DataManagerImageStoreKey
  id: string
}>

export type DataManagerResourcePackageImportResult = {
  resources: DataManagerResourceRestoreReport
  imported: {
    appData: boolean
    favorites: boolean
  }
}

type ExportDataManagerResourcePackageOptions = {
  dataManager: Pick<IDataManager, 'exportAllData'>
  favoriteManager: Pick<IFavoriteManager, 'exportFavorites'> | null | undefined
  imageStorageService?: Pick<IImageStorageService, 'listAllMetadata' | 'getImage'> | null
  favoriteImageStorageService?: Pick<IImageStorageService, 'listAllMetadata' | 'getImage'> | null
  sections?: Partial<DataManagerPackageSectionSelection>
}

export type BackupImportDataManager = Pick<IDataManager, 'importAllData'> &
  Partial<Pick<IDataManager, 'validateImportData'>>
export type BackupImportFavoriteManager = Pick<IFavoriteManager, 'importFavorites' | 'validateImportData'>
export type BackupImageRestoreStorage = ImageResourceStorage & Partial<Pick<IImageStorageService, 'deleteImage'>>

type ImportDataManagerResourcePackageOptions = {
  dataManager: BackupImportDataManager
  favoriteManager: BackupImportFavoriteManager | null | undefined
  imageStorageService?: BackupImageRestoreStorage | null
  favoriteImageStorageService?: BackupImageRestoreStorage | null
  sections?: Partial<DataManagerPackageSectionSelection>
  favoriteMergeStrategy?: DataManagerFavoritesMergeStrategy
}

type ImageStoreExportConfig = {
  key: DataManagerImageStoreKey
  root: string
  service: ExportDataManagerResourcePackageOptions['imageStorageService']
}

const APP_DATA_JSON_PATH = 'app-data.json'
const FAVORITES_JSON_PATH = 'favorites.json'

const IMAGE_STORE_ROOTS: Record<DataManagerImageStoreKey, string> = {
  imageCache: 'resources/image-cache/',
  favoriteImages: 'resources/favorite-images/',
}

export const DEFAULT_DATA_MANAGER_PACKAGE_SECTIONS: DataManagerPackageSectionSelection = {
  appData: true,
  favorites: true,
  imageCache: true,
  favoriteImages: true,
}

const EMPTY_APP_DATA_JSON = JSON.stringify({ version: 1, data: {} }, null, 2)
const EMPTY_FAVORITES_JSON = JSON.stringify({ version: '1.0', favorites: [], categories: [], tags: [] }, null, 2)

const resolveSectionSelection = (
  sections?: Partial<DataManagerPackageSectionSelection>,
): DataManagerPackageSectionSelection => ({
  ...DEFAULT_DATA_MANAGER_PACKAGE_SECTIONS,
  ...(sections ?? {}),
})

export const getIncludedDataManagerPackageSections = (
  manifest: DataManagerResourcePackageManifest,
): DataManagerPackageSection[] => {
  if (Array.isArray(manifest.includedSections) && manifest.includedSections.length > 0) {
    return manifest.includedSections.filter((section): section is DataManagerPackageSection =>
      section === 'appData' ||
      section === 'favorites' ||
      section === 'imageCache' ||
      section === 'favoriteImages',
    )
  }

  return [
    'appData',
    'favorites',
    ...(manifest.resources.some(resource => resource.store === 'imageCache') || manifest.missingResources.some(resource => resource.store === 'imageCache') ? ['imageCache' as const] : []),
    // Old favorites could reference the session library; restore can copy those assets into the favorite library.
    ...(manifest.resources.length > 0 || manifest.missingResources.length > 0 ? ['favoriteImages' as const] : []),
  ]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const textToZipBytes = (text: string): Uint8Array => copyBytes(strToU8(text))

const parseManifest = (json: string): DataManagerResourcePackageManifest => {
  const parsed = JSON.parse(json) as unknown
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== DATA_MANAGER_RESOURCE_PACKAGE_SCHEMA_VERSION ||
    parsed.appDataPath !== APP_DATA_JSON_PATH ||
    parsed.favoritesPath !== FAVORITES_JSON_PATH ||
    !Array.isArray(parsed.resources) ||
    !Array.isArray(parsed.missingResources)
  ) {
    throw new Error('Invalid app backup package manifest')
  }
  const identities = new Set<string>()
  for (const resource of parsed.resources) {
    if (!isRecord(resource) || resource.kind !== 'image' ||
      (resource.store !== 'imageCache' && resource.store !== 'favoriteImages') ||
      typeof resource.id !== 'string' || !resource.id.trim() ||
      typeof resource.path !== 'string' || !resource.path.startsWith(IMAGE_STORE_ROOTS[resource.store])) {
      throw new Error('Invalid app backup image resource')
    }
    const identity = `${resource.store}:${resource.id}`
    if (identities.has(identity)) throw new Error(`Duplicate app backup image resource: ${identity}`)
    identities.add(identity)
  }
  for (const missing of parsed.missingResources) {
    if (!isRecord(missing) || (missing.store !== 'imageCache' && missing.store !== 'favoriteImages') ||
      typeof missing.id !== 'string' || !missing.id.trim()) throw new Error('Invalid missing image resource')
  }
  if (parsed.includedSections !== undefined && (!Array.isArray(parsed.includedSections) ||
    !parsed.includedSections.every(section => ['appData', 'favorites', 'imageCache', 'favoriteImages'].includes(section)))) {
    throw new Error('Invalid app backup included sections')
  }
  if (parsed.resourceCounts !== undefined) {
    const counts = parsed.resourceCounts
    const resources = parsed.resources
    if (!isRecord(counts) || ['imageCache', 'favoriteImages'].some(store =>
      counts[store] !== resources.filter(resource => resource.store === store).length)) {
      throw new Error('App backup resource counts do not match its manifest')
    }
  }
  return parsed as DataManagerResourcePackageManifest
}

const collectStoreResources = async (
  config: ImageStoreExportConfig,
  files: Record<string, Uint8Array>,
  requiredIds: Set<string>,
  legacyStorage?: ExportDataManagerResourcePackageOptions['imageStorageService'],
): Promise<{
  resources: DataManagerResourceManifestEntry[]
  missing: Array<{ store: DataManagerImageStoreKey; id: string }>
}> => {
  const metadataList = await config.service?.listAllMetadata() ?? []
  const metadataById = new Map(metadataList.map(metadata => [metadata.id, metadata]))
  const resources: DataManagerResourceManifestEntry[] = []
  const missing: Array<{ store: DataManagerImageStoreKey; id: string }> = []

  for (const id of new Set([...metadataById.keys(), ...requiredIds])) {
    const primaryImage = await config.service?.getImage(id)
    const image = primaryImage?.data ? primaryImage : await legacyStorage?.getImage(id)
    if (!image?.data) {
      missing.push({ store: config.key, id })
      continue
    }
    const metadata = metadataById.get(id) ?? image.metadata

    const bytes = base64ToBytes(image.data)
    const mimeType = resolveResourceMimeType(
      image.metadata.mimeType || metadata.mimeType,
      bytes,
    )
    const path = `${config.root}${safeImageResourceFileName(metadata.id, mimeType)}`
    files[path] = copyBytes(bytes)
    resources.push({
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
      sha256: await sha256Hex(bytes),
    })
  }

  return { resources, missing }
}

export const createDataManagerResourcePackage = async (
  options: ExportDataManagerResourcePackageOptions,
): Promise<DataManagerResourcePackageExportResult> => {
  const sections = resolveSectionSelection(options.sections)
  const appDataJson = sections.appData
    ? await options.dataManager.exportAllData()
    : EMPTY_APP_DATA_JSON
  const favoritesJson = sections.favorites && options.favoriteManager
    ? await options.favoriteManager.exportFavorites()
    : EMPTY_FAVORITES_JSON

  const files: Record<string, Uint8Array> = {
    [APP_DATA_JSON_PATH]: textToZipBytes(appDataJson),
    [FAVORITES_JSON_PATH]: textToZipBytes(favoritesJson),
    [`${IMAGE_STORE_ROOTS.imageCache}.keep`]: new globalThis.Uint8Array(),
    [`${IMAGE_STORE_ROOTS.favoriteImages}.keep`]: new globalThis.Uint8Array(),
  }
  const resources: DataManagerResourceManifestEntry[] = []
  const missingResources: Array<{ store: DataManagerImageStoreKey; id: string }> = []
  const references = collectBackupImageReferences(appDataJson, favoritesJson)

  const storeConfigs: ImageStoreExportConfig[] = [
    {
      key: 'imageCache',
      root: IMAGE_STORE_ROOTS.imageCache,
      service: sections.imageCache ? options.imageStorageService : null,
    },
    {
      key: 'favoriteImages',
      root: IMAGE_STORE_ROOTS.favoriteImages,
      service: sections.favoriteImages ? options.favoriteImageStorageService : null,
    },
  ]

  for (const config of storeConfigs) {
    if (!sections[config.key]) continue
    const result = await collectStoreResources(config, files, references[config.key],
      config.key === 'favoriteImages' ? options.imageStorageService : undefined)
    resources.push(...result.resources)
    missingResources.push(...result.missing)
  }
  for (const missing of findMissingBackupImageReferences(references, resources)) {
    if (sections[missing.store] && !missingResources.some(item => item.store === missing.store && item.id === missing.id)) {
      missingResources.push(missing)
    }
  }

  const manifest: DataManagerResourcePackageManifest = {
    schemaVersion: DATA_MANAGER_RESOURCE_PACKAGE_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    appDataPath: APP_DATA_JSON_PATH,
    favoritesPath: FAVORITES_JSON_PATH,
    resources,
    missingResources,
    resourceCounts: {
      imageCache: resources.filter((resource) => resource.store === 'imageCache').length,
      favoriteImages: resources.filter((resource) => resource.store === 'favoriteImages').length,
    },
    includedSections: (Object.keys(sections) as DataManagerPackageSection[])
      .filter((section) => sections[section]),
  }

  files['manifest.json'] = textToZipBytes(JSON.stringify(manifest, null, 2))
  const zipped = zipSync(files, { level: 6 })
  return {
    blob: new Blob([bytesToArrayBuffer(zipped)], { type: 'application/zip' }),
    manifest,
    missingResources,
  }
}

export const readDataManagerResourcePackage = (
  input: ArrayBuffer | Uint8Array,
): {
  manifest: DataManagerResourcePackageManifest
  appDataJson: string
  favoritesJson: string
  files: Record<string, Uint8Array>
} => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const files = unzipSync(bytes)
  const manifestBytes = files['manifest.json']
  const appDataBytes = files[APP_DATA_JSON_PATH]
  const favoritesBytes = files[FAVORITES_JSON_PATH]

  if (!manifestBytes) {
    throw new Error('app backup package is missing manifest.json')
  }
  if (!appDataBytes) {
    throw new Error('app backup package is missing app-data.json')
  }
  if (!favoritesBytes) {
    throw new Error('app backup package is missing favorites.json')
  }

  return {
    manifest: parseManifest(strFromU8(manifestBytes)),
    appDataJson: strFromU8(appDataBytes),
    favoritesJson: strFromU8(favoritesBytes),
    files,
  }
}

const getImportStorageService = (
  store: DataManagerImageStoreKey,
  options: ImportDataManagerResourcePackageOptions,
): BackupImageRestoreStorage | null | undefined =>
  store === 'favoriteImages'
    ? options.favoriteImageStorageService
    : options.imageStorageService

type PreparedPackageImage = {
  store: DataManagerImageStoreKey
  image: FullImageData
}
type PreparedPackageImageCheck = { store: DataManagerImageStoreKey; id: string; bytes: Uint8Array }

/** Older full backups could keep favorite assets in the session image library. */
export const includeLegacyFavoriteImageResources = <T extends { store: DataManagerImageStoreKey; id: string }>(
  resources: T[],
  favoriteImageIds: Set<string>,
  restoreFavoriteImages: boolean,
): T[] => {
  if (!restoreFavoriteImages) return resources
  const favoriteIds = new Set(resources.filter(item => item.store === 'favoriteImages').map(item => item.id))
  return [...resources, ...resources.filter(item => item.store === 'imageCache' && favoriteImageIds.has(item.id) && !favoriteIds.has(item.id))
    .map(item => ({ ...item, store: 'favoriteImages' as const }))]
}

export const preflightBackupData = async (
  appDataJson: string | null,
  favoritesJson: string | null,
  dataManager: BackupImportDataManager,
  favoriteManager: BackupImportFavoriteManager | null | undefined,
  favoriteMergeStrategy: DataManagerFavoritesMergeStrategy = 'overwrite',
): Promise<void> => {
  if (appDataJson !== null) {
    JSON.parse(appDataJson)
    await dataManager.validateImportData?.(appDataJson)
  }
  if (favoritesJson !== null) {
    const favorites = JSON.parse(favoritesJson)
    if (!isRecord(favorites) || !Array.isArray(favorites.favorites)) throw new Error('Invalid favorites JSON payload')
    if (!favoriteManager && favorites.favorites.length) throw new Error('Favorite manager is unavailable')
    await favoriteManager?.validateImportData?.(favoritesJson, { mergeStrategy: favoriteMergeStrategy, matchBy: 'id' })
  }
}

/** Best-effort cleanup before publishing references; preserve different bytes written concurrently. */
export const rollbackAddedBackupImages = async (
  written: Array<{ storage: BackupImageRestoreStorage; image: FullImageData }>,
): Promise<void> => {
  const failures: string[] = []
  for (const { storage, image } of [...written].reverse()) {
    if (!storage.deleteImage) { failures.push(image.metadata.id); continue }
    try {
      if (await hasMatchingImageResource(image.metadata, base64ToBytes(image.data), storage)) {
        await storage.deleteImage(image.metadata.id)
      }
    } catch { failures.push(image.metadata.id) }
  }
  if (failures.length) throw new Error(`Image restore rollback incomplete: ${failures.join(', ')}`)
}

const preparePackageResources = async (
  manifest: DataManagerResourcePackageManifest,
  files: Record<string, Uint8Array>,
  options: ImportDataManagerResourcePackageOptions,
  appDataJson: string,
  favoritesJson: string,
): Promise<{ report: DataManagerResourceRestoreReport; images: PreparedPackageImage[]; checks: PreparedPackageImageCheck[] }> => {
  const report: DataManagerResourceRestoreReport = {
    restored: 0,
    skipped: 0,
    missing: [],
    corrupt: [],
    errors: [],
  }

  const sections = resolveSectionSelection(options.sections)
  const images: PreparedPackageImage[] = []
  const checks: PreparedPackageImageCheck[] = []
  const selectedStores = new Set<DataManagerImageStoreKey>([
    ...(sections.imageCache ? ['imageCache' as const] : []),
    ...(sections.favoriteImages ? ['favoriteImages' as const] : []),
  ])
  report.missing.push(...manifest.missingResources.filter((resource) => selectedStores.has(resource.store)))
  const references = collectBackupImageReferences(sections.appData ? appDataJson : null, sections.favorites ? favoritesJson : null)
  const restoreResources = includeLegacyFavoriteImageResources(manifest.resources, references.favoriteImages, sections.favoriteImages)
  for (const missing of findMissingBackupImageReferences(references, restoreResources)) {
    if (selectedStores.has(missing.store) && !report.missing.some(item => item.store === missing.store && item.id === missing.id)) {
      report.missing.push(missing)
    }
  }

  for (const resource of restoreResources) {
    if (!selectedStores.has(resource.store)) {
      report.skipped += 1
      continue
    }

    const storageService = getImportStorageService(resource.store, options)
    if (!storageService) {
      report.skipped += 1
      report.errors.push(`${resource.store}:${resource.id}: image storage service is unavailable`)
      continue
    }

    const bytes = files[resource.path]
    if (!bytes) {
      report.missing.push({ store: resource.store, id: resource.id })
      continue
    }
    try {
      const validation = await validateImageResourceBytes(resource, bytes)
      if (validation !== 'ok') {
        report.corrupt.push({ store: resource.store, id: resource.id })
        continue
      }
      checks.push({ store: resource.store, id: resource.id, bytes })

      if (await hasMatchingImageResource(resource, bytes, storageService)) {
        report.skipped += 1
      } else {
        images.push({ store: resource.store, image: createFullImageDataFromResource(resource, bytes) })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      report.errors.push(`${resource.store}:${resource.id}: ${message}`)
    }
  }

  assertImageResourceRestoreReportSafe(report, 'App backup package')
  for (const store of selectedStores) {
    const storage = getImportStorageService(store, options)
    if (storage) await assertImageRestoreCapacity(images.filter(item => item.store === store).map(item => item.image), storage)
  }
  return { report, images, checks }
}

export const importDataManagerResourcePackage = async (
  input: ArrayBuffer | Uint8Array,
  options: ImportDataManagerResourcePackageOptions,
): Promise<DataManagerResourcePackageImportResult> => {
  const { manifest, appDataJson, favoritesJson, files } = readDataManagerResourcePackage(input)
  const included = new Set(getIncludedDataManagerPackageSections(manifest))
  const requested = resolveSectionSelection(options.sections)
  const sections = Object.fromEntries(Object.entries(requested).map(([key, value]) => [key, value && included.has(key as DataManagerPackageSection)])) as DataManagerPackageSectionSelection
  const effectiveOptions = { ...options, sections }
  await preflightBackupData(sections.appData ? appDataJson : null, sections.favorites ? favoritesJson : null,
    options.dataManager, options.favoriteManager, options.favoriteMergeStrategy)
  const { report: resources, images, checks } = await preparePackageResources(manifest, files, effectiveOptions, appDataJson, favoritesJson)
  const written: Array<{ storage: BackupImageRestoreStorage; image: FullImageData }> = []
  let publishingReferences = false
  try {
    for (const item of images) {
      const storage = getImportStorageService(item.store, options)!
      written.push({ storage, image: item.image })
      await storage.saveImage(item.image, { preventEviction: true })
      resources.restored += 1
    }
    // Check durable images before publishing any new business references.
    for (const check of checks) {
      const storage = getImportStorageService(check.store, options)!
      if (!await hasMatchingImageResource(check, check.bytes, storage)) throw new Error(`Restored image is missing: ${check.id}`)
    }
    if (sections.favorites && options.favoriteManager) {
      publishingReferences = true
      const result = await options.favoriteManager.importFavorites(favoritesJson, {
        mergeStrategy: options.favoriteMergeStrategy ?? 'overwrite', matchBy: 'id',
      })
      if (result.errors.length > 0) throw new Error(`Favorites import failed: ${result.errors.join('; ')}`)
    }
    // Workspace snapshots remain the final commit; no fallible post-check may resume old autosaves.
    if (sections.appData) {
      publishingReferences = true
      await options.dataManager.importAllData(appDataJson)
    }
  } catch (error) {
    // A service may have published references before a storage error. Keep their images alive.
    try { if (!publishingReferences) await rollbackAddedBackupImages(written) } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], `${error instanceof Error ? error.message : String(error)}; ${(rollbackError as Error).message}`, { cause: rollbackError })
    }
    throw error
  }

  return {
    resources,
    imported: {
      appData: sections.appData,
      favorites: Boolean(sections.favorites && options.favoriteManager),
    },
  }
}

export const looksLikeDataManagerZipPackage = (
  fileName: string | undefined,
  bytes: Uint8Array,
): boolean => {
  const normalizedName = String(fileName || '').toLowerCase()
  if (normalizedName.endsWith('.zip') || normalizedName.endsWith('.po-backup.zip')) {
    return true
  }

  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  )
}
