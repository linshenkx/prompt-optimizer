import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type {
  FavoritePrompt,
  FullImageData,
  IFavoriteManager,
  IImageStorageService,
  ImageMetadata,
} from '@prompt-optimizer/core'

import { collectFavoritesAssetIds } from './favorite-asset-refs'
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
} from './image-resource-backup'
import { rollbackAddedBackupImages, type BackupImageRestoreStorage } from './data-manager-resource-package'

export const FAVORITE_RESOURCE_PACKAGE_SCHEMA_VERSION = 'prompt-optimizer/favorites-package/v1' as const

export type FavoriteExportJson = {
  version?: string
  exportDate?: string
  favorites: FavoritePrompt[]
  categories?: unknown[]
  tags?: unknown[]
}

export type FavoriteResourceManifestEntry = {
  kind: 'image'
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

export type FavoriteResourcePackageManifest = {
  schemaVersion: typeof FAVORITE_RESOURCE_PACKAGE_SCHEMA_VERSION
  createdAt: string
  favoriteCount: number
  resourceCount: number
  resources: FavoriteResourceManifestEntry[]
  missingResourceIds: string[]
}

export type FavoriteResourcePackageExportResult = {
  blob: Blob
  manifest: FavoriteResourcePackageManifest
  missingResourceIds: string[]
}

export type FavoriteResourceRestoreReport = ImageResourceRestoreReport<string>

export type FavoriteResourcePackageImportResult = {
  resources: FavoriteResourceRestoreReport
  favorites: {
    imported: number
    skipped: number
    errors: string[]
  }
}

type ExportFavoriteResourcePackageOptions = {
  favoriteManager: Pick<IFavoriteManager, 'exportFavorites'>
  imageStorageService?: Pick<IImageStorageService, 'getImage'> | null
  imageStorageServices?: Array<Pick<IImageStorageService, 'getImage'> | null | undefined>
}

type CreateFavoriteResourcePackageFromJsonOptions = {
  favoritesJson: string
  imageStorageService?: Pick<IImageStorageService, 'getImage'> | null
  imageStorageServices?: Array<Pick<IImageStorageService, 'getImage'> | null | undefined>
}

type ImportFavoriteResourcePackageOptions = {
  favoriteManager: Pick<IFavoriteManager, 'importFavorites' | 'validateImportData'>
  imageStorageService?: BackupImageRestoreStorage | null
  mergeStrategy?: 'skip' | 'overwrite' | 'merge'
}

const FAVORITES_JSON_PATH = 'favorites.json'
const MANIFEST_JSON_PATH = 'manifest.json'
const IMAGE_RESOURCE_ROOT = 'resources/images/'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const textToZipBytes = (text: string): Uint8Array => copyBytes(strToU8(text))

const parseFavoriteExportJson = (json: string): FavoriteExportJson => {
  const parsed = JSON.parse(json) as unknown
  if (!isRecord(parsed) || !Array.isArray(parsed.favorites)) {
    throw new Error('Invalid favorites JSON payload')
  }
  return parsed as FavoriteExportJson
}

const parseManifest = (json: string): FavoriteResourcePackageManifest => {
  const parsed = JSON.parse(json) as unknown
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== FAVORITE_RESOURCE_PACKAGE_SCHEMA_VERSION ||
    !Array.isArray(parsed.resources) ||
    !Array.isArray(parsed.missingResourceIds)
  ) {
    throw new Error('Invalid favorites package manifest')
  }
  const identities = new Set<string>()
  for (const resource of parsed.resources) {
    if (!isRecord(resource) || resource.kind !== 'image' || typeof resource.id !== 'string' || !resource.id.trim() ||
      typeof resource.path !== 'string' || !resource.path.startsWith(IMAGE_RESOURCE_ROOT)) {
      throw new Error('Invalid favorite image resource')
    }
    if (identities.has(resource.id)) throw new Error(`Duplicate favorite image resource: ${resource.id}`)
    identities.add(resource.id)
  }
  if (!parsed.missingResourceIds.every(id => typeof id === 'string' && id.trim())) throw new Error('Invalid missing favorite image resource')
  return parsed as FavoriteResourcePackageManifest
}

const getExportStorageCandidates = (
  options: Pick<ExportFavoriteResourcePackageOptions, 'imageStorageService' | 'imageStorageServices'>,
): Array<Pick<IImageStorageService, 'getImage'>> => {
  const candidates = options.imageStorageServices?.length
    ? options.imageStorageServices
    : [options.imageStorageService]

  return candidates.filter((service): service is Pick<IImageStorageService, 'getImage'> => !!service)
}

const getImageFromCandidates = async (
  candidates: Array<Pick<IImageStorageService, 'getImage'>>,
  assetId: string,
): Promise<FullImageData | null> => {
  for (const storage of candidates) {
    const image = await storage.getImage(assetId)
    if (image?.data) {
      return image
    }
  }

  return null
}

export const createFavoriteResourcePackage = async (
  options: ExportFavoriteResourcePackageOptions,
): Promise<FavoriteResourcePackageExportResult> => {
  const favoritesJson = await options.favoriteManager.exportFavorites()
  return createFavoriteResourcePackageFromJson({
    favoritesJson,
    imageStorageService: options.imageStorageService,
    imageStorageServices: options.imageStorageServices,
  })
}

export const createFavoriteResourcePackageFromJson = async (
  options: CreateFavoriteResourcePackageFromJsonOptions,
): Promise<FavoriteResourcePackageExportResult> => {
  const { favoritesJson } = options
  const exportData = parseFavoriteExportJson(favoritesJson)
  const assetIds = collectFavoritesAssetIds(exportData.favorites)
  const storageCandidates = getExportStorageCandidates(options)
  const files: Record<string, Uint8Array> = {
    [FAVORITES_JSON_PATH]: textToZipBytes(favoritesJson),
    [`${IMAGE_RESOURCE_ROOT}.keep`]: new globalThis.Uint8Array(),
  }
  const resources: FavoriteResourceManifestEntry[] = []
  const missingResourceIds: string[] = []

  for (const assetId of assetIds) {
    const image = await getImageFromCandidates(storageCandidates, assetId)
    if (!image?.data) {
      missingResourceIds.push(assetId)
      continue
    }

    const bytes = base64ToBytes(image.data)
    const mimeType = resolveResourceMimeType(image.metadata.mimeType, bytes)
    const path = `${IMAGE_RESOURCE_ROOT}${safeImageResourceFileName(assetId, mimeType)}`
    files[path] = copyBytes(bytes)
    resources.push({
      kind: 'image',
      id: assetId,
      path,
      mimeType,
      sizeBytes: bytes.byteLength,
      createdAt: image.metadata.createdAt || Date.now(),
      accessedAt: image.metadata.accessedAt,
      source: image.metadata.source || 'uploaded',
      metadata: image.metadata.metadata,
      sha256: await sha256Hex(bytes),
    })
  }

  const manifest: FavoriteResourcePackageManifest = {
    schemaVersion: FAVORITE_RESOURCE_PACKAGE_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    favoriteCount: exportData.favorites.length,
    resourceCount: resources.length,
    resources,
    missingResourceIds,
  }
  files[MANIFEST_JSON_PATH] = textToZipBytes(JSON.stringify(manifest, null, 2))

  const zipped = zipSync(files, { level: 6 })
  return {
    blob: new Blob([bytesToArrayBuffer(zipped)], { type: 'application/zip' }),
    manifest,
    missingResourceIds,
  }
}

export const readFavoriteResourcePackage = (
  input: ArrayBuffer | Uint8Array,
): {
  manifest: FavoriteResourcePackageManifest
  favoritesJson: string
  files: Record<string, Uint8Array>
} => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const files = unzipSync(bytes)
  const manifestBytes = files[MANIFEST_JSON_PATH]
  const favoritesBytes = files[FAVORITES_JSON_PATH]

  if (!manifestBytes) {
    throw new Error('favorites package is missing manifest.json')
  }
  if (!favoritesBytes) {
    throw new Error('favorites package is missing favorites.json')
  }

  return {
    manifest: parseManifest(strFromU8(manifestBytes)),
    favoritesJson: strFromU8(favoritesBytes),
    files,
  }
}

const prepareFavoritePackageResources = async (
  manifest: FavoriteResourcePackageManifest,
  files: Record<string, Uint8Array>,
  imageStorageService: ImportFavoriteResourcePackageOptions['imageStorageService'],
  favorites: FavoritePrompt[],
): Promise<{ report: FavoriteResourceRestoreReport; images: FullImageData[]; checks: Array<{ id: string; bytes: Uint8Array }> }> => {
  const report: FavoriteResourceRestoreReport = {
    restored: 0,
    skipped: 0,
    missing: [...manifest.missingResourceIds],
    corrupt: [],
    errors: [],
  }
  const images: FullImageData[] = []
  const checks: Array<{ id: string; bytes: Uint8Array }> = []
  const providedIds = new Set(manifest.resources.map(resource => resource.id))
  for (const id of collectFavoritesAssetIds(favorites)) {
    if (!providedIds.has(id) && !report.missing.includes(id)) report.missing.push(id)
  }

  if (!imageStorageService) {
    report.skipped += manifest.resources.length
    if (manifest.resources.length > 0) {
      report.errors.push('Image storage service is unavailable; package resources were not restored')
    }
    return { report, images, checks }
  }

  for (const resource of manifest.resources) {
    const bytes = files[resource.path]
    if (!bytes) {
      report.missing.push(resource.id)
      continue
    }

    try {
      const validation = await validateImageResourceBytes(resource, bytes)
      if (validation !== 'ok') {
        report.corrupt.push(resource.id)
        continue
      }
      checks.push({ id: resource.id, bytes })

      if (await hasMatchingImageResource(resource, bytes, imageStorageService)) {
        report.skipped += 1
      } else {
        images.push(createFullImageDataFromResource(resource, bytes))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      report.errors.push(`${resource.id}: ${message}`)
    }
  }

  assertImageResourceRestoreReportSafe(report, 'Favorite package')
  await assertImageRestoreCapacity(images, imageStorageService)
  return { report, images, checks }
}

export const importFavoriteResourcePackage = async (
  input: ArrayBuffer | Uint8Array,
  options: ImportFavoriteResourcePackageOptions,
): Promise<FavoriteResourcePackageImportResult> => {
  const { manifest, favoritesJson, files } = readFavoriteResourcePackage(input)
  const payload = parseFavoriteExportJson(favoritesJson)
  await options.favoriteManager.validateImportData?.(favoritesJson, { mergeStrategy: options.mergeStrategy })
  const { report: resources, images, checks } = await prepareFavoritePackageResources(
    manifest,
    files,
    options.imageStorageService,
    payload.favorites,
  )
  assertImageResourceRestoreReportSafe(resources, 'Favorite package')
  const written: Array<{ storage: BackupImageRestoreStorage; image: FullImageData }> = []
  let publishingReferences = false
  try {
    for (const image of images) {
      const storage = options.imageStorageService!
      written.push({ storage, image })
      await storage.saveImage(image, { preventEviction: true })
      resources.restored += 1
    }
    for (const check of checks) {
      if (!await hasMatchingImageResource(check, check.bytes, options.imageStorageService!)) throw new Error(`Restored image is missing: ${check.id}`)
    }
    publishingReferences = true
    const favorites = await options.favoriteManager.importFavorites(favoritesJson, {
      mergeStrategy: options.mergeStrategy,
    })
    return { resources, favorites }
  } catch (error) {
    try { if (!publishingReferences) await rollbackAddedBackupImages(written) } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], `${error instanceof Error ? error.message : String(error)}; ${(rollbackError as Error).message}`, { cause: rollbackError })
    }
    throw error
  }
}

export const looksLikeFavoriteZipPackage = (
  fileName: string | undefined,
  bytes: Uint8Array,
): boolean => {
  const normalizedName = String(fileName || '').toLowerCase()
  if (normalizedName.endsWith('.zip') || normalizedName.endsWith('.po-favorites.zip')) {
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
