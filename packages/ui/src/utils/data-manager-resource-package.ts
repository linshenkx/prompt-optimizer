import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type {
  IDataManager,
  IFavoriteManager,
  IImageStorageService,
  ImageMetadata,
} from '@prompt-optimizer/core'

import {
  assertImageResourceRestoreReportSafe,
  base64ToBytes,
  bytesToArrayBuffer,
  copyBytes,
  resolveResourceMimeType,
  restoreImageResource,
  safeImageResourceFileName,
  sha256Hex,
  validateImageResourceBytes,
  type ImageResourceRestoreReport,
} from './image-resource-backup'

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

type ImportDataManagerResourcePackageOptions = {
  dataManager: Pick<IDataManager, 'importAllData'>
  favoriteManager: Pick<IFavoriteManager, 'importFavorites'> | null | undefined
  imageStorageService?: Pick<IImageStorageService, 'getImage' | 'saveImage'> | null
  favoriteImageStorageService?: Pick<IImageStorageService, 'getImage' | 'saveImage'> | null
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
    ...(manifest.resourceCounts?.imageCache ? ['imageCache' as const] : []),
    ...(manifest.resourceCounts?.favoriteImages ? ['favoriteImages' as const] : []),
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
  return parsed as DataManagerResourcePackageManifest
}

const collectStoreResources = async (
  config: ImageStoreExportConfig,
  files: Record<string, Uint8Array>,
): Promise<{
  resources: DataManagerResourceManifestEntry[]
  missing: Array<{ store: DataManagerImageStoreKey; id: string }>
}> => {
  if (!config.service) {
    return { resources: [], missing: [] }
  }

  const metadataList = await config.service.listAllMetadata()
  const resources: DataManagerResourceManifestEntry[] = []
  const missing: Array<{ store: DataManagerImageStoreKey; id: string }> = []

  for (const metadata of metadataList) {
    const image = await config.service.getImage(metadata.id)
    if (!image?.data) {
      missing.push({ store: config.key, id: metadata.id })
      continue
    }

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
    const result = await collectStoreResources(config, files)
    resources.push(...result.resources)
    missingResources.push(...result.missing)
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
): Pick<IImageStorageService, 'getImage' | 'saveImage'> | null | undefined =>
  store === 'favoriteImages'
    ? options.favoriteImageStorageService
    : options.imageStorageService

const restorePackageResources = async (
  manifest: DataManagerResourcePackageManifest,
  files: Record<string, Uint8Array>,
  options: ImportDataManagerResourcePackageOptions,
): Promise<DataManagerResourceRestoreReport> => {
  const report: DataManagerResourceRestoreReport = {
    restored: 0,
    skipped: 0,
    missing: [],
    corrupt: [],
    errors: [],
  }

  const sections = resolveSectionSelection(options.sections)
  const selectedStores = new Set<DataManagerImageStoreKey>([
    ...(sections.imageCache ? ['imageCache' as const] : []),
    ...(sections.favoriteImages ? ['favoriteImages' as const] : []),
  ])
  report.missing.push(...manifest.missingResources.filter((resource) => selectedStores.has(resource.store)))

  for (const resource of manifest.resources) {
    if (
      resource.kind !== 'image' ||
      !resource.id ||
      !resource.path.startsWith(IMAGE_STORE_ROOTS[resource.store])
    ) {
      report.skipped += 1
      continue
    }
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

      const restoreResult = await restoreImageResource(resource, bytes, storageService)
      if (restoreResult === 'skipped') {
        report.skipped += 1
      } else {
        report.restored += 1
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      report.errors.push(`${resource.store}:${resource.id}: ${message}`)
    }
  }

  return report
}

export const importDataManagerResourcePackage = async (
  input: ArrayBuffer | Uint8Array,
  options: ImportDataManagerResourcePackageOptions,
): Promise<DataManagerResourcePackageImportResult> => {
  const { manifest, appDataJson, favoritesJson, files } = readDataManagerResourcePackage(input)
  const sections = resolveSectionSelection(options.sections)
  const resources = await restorePackageResources(manifest, files, options)
  assertImageResourceRestoreReportSafe(resources, 'App backup package')

  if (sections.favorites && options.favoriteManager) {
    const result = await options.favoriteManager.importFavorites(favoritesJson, {
      mergeStrategy: options.favoriteMergeStrategy ?? 'overwrite',
    })
    if (result.errors.length > 0) {
      throw new Error(`Favorites import failed: ${result.errors.join('; ')}`)
    }
  }
  // DataManager commits workspace snapshots last. Nothing that can fail during
  // this package import may run after that commit and resume old session saves.
  if (sections.appData) {
    await options.dataManager.importAllData(appDataJson)
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
