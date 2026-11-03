/**
 * App-level Prompt Garden import.
 *
 * The optimizer receives an import payload via route query, fetches prompt content
 * from the Garden site, and writes it into the correct session store.
 *
 * Notes:
 * - Uses isLoadingExternalData to prevent route-driven session restore from
 *   overwriting imported content.
 * - Clears import-related query params after successful import.
 */

import { watch, nextTick, type Ref } from 'vue'
import type { LocationQuery, Router } from 'vue-router'
import type {
  ConversationMessage,
  FavoritePrompt,
  IFavoriteManager,
  IImageStorageService,
  PromptRecordChain,
} from '@prompt-optimizer/core'

import { useToast } from '../ui/useToast'
import { isValidVariableName } from '../../types/variable'
import { i18n } from '../../plugins/i18n'
import type { BasicSystemSessionApi } from '../../stores/session/useBasicSystemSession'
import type { BasicUserSessionApi } from '../../stores/session/useBasicUserSession'
import type { ProMultiMessageSessionApi } from '../../stores/session/useProMultiMessageSession'
import type { ProVariableSessionApi } from '../../stores/session/useProVariableSession'
import type { ImageText2ImageSessionApi } from '../../stores/session/useImageText2ImageSession'
import type { ImageImage2ImageSessionApi } from '../../stores/session/useImageImage2ImageSession'
import type { ImageMultiImageSessionApi } from '../../stores/session/useImageMultiImageSession'
import type { useArenaSession } from '../../stores/session/useArenaSession'
import { buildPromptExecutionContext } from '../../utils/prompt-variables'
import {
  persistImageSourceAsAssetId,
} from '../../utils/image-asset-storage'
import { buildFavoriteMediaMetadata } from '../../utils/favorite-media'
import {
  WORKSPACE_APPLY_TARGET_KEYS,
  applyWorkspaceTemporaryVariables,
  buildWorkspaceConversationFromPromptText,
  clearWorkspaceContentForExternalApply,
  generateWorkspaceApplyMessageId,
  getWorkspaceTemporaryVariablesSession,
  type WorkspaceApplyTargetKey,
} from '../../utils/workspace-external-apply'
import {
  deriveFavoriteCategoryPathFromGardenMeta,
  ensureFavoriteCategoryPath,
  loadFavoriteCategoryPathLeafId,
} from '../../utils/favorite-category-path'

type SupportedSubModeKey = WorkspaceApplyTargetKey | 'arena'

const SUPPORTED_KEYS = [...WORKSPACE_APPLY_TARGET_KEYS, 'arena'] as const

const isSupportedKey = (value: string | null | undefined): value is SupportedSubModeKey => {
  if (!value) return false
  return (SUPPORTED_KEYS as readonly string[]).includes(value)
}

const getQueryString = (query: LocationQuery, key: string): string | null => {
  const value = query[key]
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return null
}

const parseImportCodeSelector = (value: string): { importCode: string; exampleId: string | null } => {
  const trimmed = value.trim()
  const separatorIndex = trimmed.lastIndexOf('@')
  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    return {
      importCode: trimmed,
      exampleId: null,
    }
  }

  const importCode = trimmed.slice(0, separatorIndex).trim()
  const exampleId = trimmed.slice(separatorIndex + 1).trim()
  if (!importCode || !exampleId) {
    return {
      importCode: trimmed,
      exampleId: null,
    }
  }

  return {
    importCode,
    exampleId,
  }
}

const omitKeys = (query: LocationQuery, keys: string[]): LocationQuery => {
  const next: Record<string, unknown> = { ...query }
  for (const k of keys) {
    delete next[k]
  }
  return next as LocationQuery
}

const normalizeBaseUrl = (value: string): string | null => {
  try {
    const u = new URL(value)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    // Keep pathname to support subpath deployments; just trim trailing slash.
    return u.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

const keyToPath = (key: SupportedSubModeKey): string => {
  if (key === 'arena') return '/arena'
  const [mode, subMode] = key.split('-')
  return `/${mode}/${subMode}`
}

const parseKeyFromCurrentPath = (path: string): SupportedSubModeKey | null => {
  if (path === '/arena') return 'arena'
  const match = path.match(/^\/(basic|pro|image)\/([^/]+)$/)
  if (!match) return null
  const key = `${match[1]}-${match[2]}`
  return isSupportedKey(key) ? key : null
}

const resolveTargetKey = (
  query: LocationQuery,
  fallbackPath: string,
  suggestedKey?: string | null,
): SupportedSubModeKey => {
  const explicitKey = getQueryString(query, 'subModeKey')
  if (isSupportedKey(explicitKey)) return explicitKey

  if (isSupportedKey(suggestedKey)) return suggestedKey

  return parseKeyFromCurrentPath(fallbackPath) ?? 'basic-system'
}

type FetchedPrompt = {
  importCode: string
  optimizerTargetKey: string
  promptFormat: 'text' | 'messages'
  promptText?: string
  promptMessages?: ConversationMessage[]
  variables: Array<{ name: string; defaultValue?: string }>
  examples: Array<{
    id?: string
    parameters?: Record<string, string>
    inputImages?: string[]
  }>
  gardenSnapshot: GardenSnapshot
}

type FavoriteManagerLike = Pick<
  IFavoriteManager,
  'getFavorites' | 'addFavorite' | 'updateFavorite' | 'getCategories' | 'addCategory'
>

type GardenSnapshotVariable = {
  name: string
  description?: string
  type?: 'string' | 'number' | 'boolean' | 'enum'
  required?: boolean
  defaultValue?: string
  options?: string[]
  source?: string
}

type GardenSnapshotAssetItem = {
  id?: string
  url?: string
  imageAssetIds?: string[]
  images?: string[]
  inputImageAssetIds?: string[]
  inputImages?: string[]
  text?: string
  description?: string
  parameters?: Record<string, string>
  [key: string]: unknown
}

type GardenSnapshot = {
  schema: 'prompt-garden.prompt.v1'
  schemaVersion: 1
  importCode: string
  gardenBaseUrl: string | null
  id?: string
  optimizerTarget: {
    subModeKey: string
  }
  prompt: {
    format: 'text' | 'messages'
    text?: string
    messages?: ConversationMessage[]
  }
  variables: GardenSnapshotVariable[]
  assets: {
    cover?: {
      assetId?: string
      url?: string
      [key: string]: unknown
    }
    showcases?: GardenSnapshotAssetItem[]
    examples?: GardenSnapshotAssetItem[]
  }
  meta?: Record<string, unknown>
  importedAt: string
}

type FavoriteModeMapping =
  | { functionMode: 'basic'; optimizationMode: 'system' | 'user'; imageSubMode?: never }
  | { functionMode: 'context'; optimizationMode: 'system' | 'user'; imageSubMode?: never }
  | { functionMode: 'image'; imageSubMode: 'text2image' | 'image2image' | 'multiimage'; optimizationMode?: never }

type SaveToFavoritesMode = 'none' | 'auto' | 'confirm'

const parseSaveToFavoritesMode = (value: string | null): SaveToFavoritesMode => {
  if (!value) return 'none'
  const normalized = value.trim().toLowerCase()
  if (normalized === '1' || normalized === 'true' || normalized === 'auto') {
    return 'auto'
  }
  if (normalized === 'confirm' || normalized === 'dialog' || normalized === 'manual') {
    return 'confirm'
  }
  return 'none'
}

const extractStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

const toFavoriteModeMapping = (targetKey: SupportedSubModeKey, meta?: Record<string, unknown>): FavoriteModeMapping => {
  switch (targetKey) {
    case 'arena':
      return meta?.type === 'image'
        ? { functionMode: 'image', imageSubMode: meta.generationType === 'image-to-image' ? 'image2image' : 'text2image' }
        : { functionMode: 'basic', optimizationMode: 'user' }
    case 'basic-user':
      return { functionMode: 'basic', optimizationMode: 'user' }
    case 'pro-multi':
      return { functionMode: 'context', optimizationMode: 'system' }
    case 'pro-variable':
      return { functionMode: 'context', optimizationMode: 'user' }
    case 'image-text2image':
      return { functionMode: 'image', imageSubMode: 'text2image' }
    case 'image-image2image':
      return { functionMode: 'image', imageSubMode: 'image2image' }
    case 'image-multiimage':
      return { functionMode: 'image', imageSubMode: 'multiimage' }
    case 'basic-system':
    default:
      return { functionMode: 'basic', optimizationMode: 'system' }
  }
}

const buildFavoriteContentFromFetchedPrompt = (fetched: FetchedPrompt): string => {
  if (fetched.promptFormat === 'text') {
    return String(fetched.promptText || '').trim()
  }

  const rows = (fetched.promptMessages || [])
    .map((msg) => {
      const role = String(msg.role || '').trim() || 'system'
      const content = String(msg.content || '').trim()
      if (!content) return ''
      return `[${role}] ${content}`
    })
    .filter(Boolean)

  return rows.join('\n\n').trim()
}

const deriveFavoriteTitle = (fetched: FetchedPrompt): string => {
  const snapshotMeta = fetched.gardenSnapshot.meta
  const metaTitle = snapshotMeta && typeof snapshotMeta.title === 'string'
    ? snapshotMeta.title.trim()
    : ''
  if (metaTitle) return metaTitle

  const content = buildFavoriteContentFromFetchedPrompt(fetched)
  if (!content) return `Prompt Garden ${fetched.importCode}`

  const firstLine = content.replace(/\r?\n/g, ' ').trim()
  if (firstLine.length <= 60) return firstLine
  return `${firstLine.slice(0, 60)}...`
}

const deriveFavoriteDescription = (fetched: FetchedPrompt): string | undefined => {
  const snapshotMeta = fetched.gardenSnapshot.meta
  const metaDescription = snapshotMeta && typeof snapshotMeta.description === 'string'
    ? snapshotMeta.description.trim()
    : ''
  return metaDescription || undefined
}

const deriveFavoriteTags = (fetched: FetchedPrompt): string[] => {
  const snapshotMeta = fetched.gardenSnapshot.meta
  if (!snapshotMeta) return []
  return extractStringArray(snapshotMeta.tags)
}

const deriveFavoriteCategoryPath = (fetched: FetchedPrompt): string[] => {
  return deriveFavoriteCategoryPathFromGardenMeta(fetched.gardenSnapshot.meta)
}

const deriveFavoriteCategory = (fetched: FetchedPrompt): string | undefined => {
  const snapshotMeta = fetched.gardenSnapshot.meta
  if (!snapshotMeta) return undefined

  const categoryKey = typeof snapshotMeta.categoryKey === 'string'
    ? snapshotMeta.categoryKey.trim()
    : ''
  if (categoryKey) return categoryKey

  const category = typeof snapshotMeta.category === 'string'
    ? snapshotMeta.category.trim()
    : ''
  return category || undefined
}

const isSameGardenSnapshotFavorite = (favorite: FavoritePrompt, snapshot: GardenSnapshot): boolean => {
  const metadata = favorite.metadata
  if (!isPlainObject(metadata)) return false
  const gardenSnapshot = isPlainObject(metadata.gardenSnapshot) ? metadata.gardenSnapshot : null
  if (!gardenSnapshot) return false

  const importCode = typeof gardenSnapshot.importCode === 'string' ? gardenSnapshot.importCode.trim() : ''
  const gardenBaseUrl = typeof gardenSnapshot.gardenBaseUrl === 'string' ? gardenSnapshot.gardenBaseUrl.trim() : ''

  return importCode === snapshot.importCode && gardenBaseUrl === (snapshot.gardenBaseUrl || '')
}

const saveImportedPromptToFavorites = async (opts: {
  manager: FavoriteManagerLike
  imageStorageService?: IImageStorageService | null
  fetched: FetchedPrompt
  targetKey: SupportedSubModeKey
}): Promise<void> => {
  const { manager, imageStorageService, fetched, targetKey } = opts
  const content = buildFavoriteContentFromFetchedPrompt(fetched)
  if (!content) {
    throw new Error('Cannot save imported prompt with empty content')
  }

  const modeMapping = toFavoriteModeMapping(targetKey, fetched.gardenSnapshot.meta)
  const snapshot = await buildStorableGardenSnapshot(
    fetched.gardenSnapshot,
    imageStorageService,
    { allowImageFallback: true },
  )
  const media = buildFavoriteMediaFromSnapshot(snapshot)
  const categoryPath = deriveFavoriteCategoryPath(fetched)
  const categoryId = await ensureFavoriteCategoryPath(manager, categoryPath)
  const favorites = await manager.getFavorites()
  const existing = favorites.find((favorite) => isSameGardenSnapshotFavorite(favorite, snapshot))

  if (existing) {
    const metadataBase = isPlainObject(existing.metadata) ? existing.metadata : {}
    await manager.updateFavorite(existing.id, {
      content,
      ...(existing.category ? {} : categoryId ? { category: categoryId } : {}),
      functionMode: modeMapping.functionMode,
      optimizationMode: modeMapping.optimizationMode,
      imageSubMode: modeMapping.imageSubMode,
      metadata: {
        ...metadataBase,
        gardenSnapshot: snapshot,
        ...(media ? { media } : {}),
      },
    })
    return
  }

  await manager.addFavorite({
    title: deriveFavoriteTitle(fetched),
    description: deriveFavoriteDescription(fetched),
    content,
    ...(categoryId ? { category: categoryId } : {}),
    tags: deriveFavoriteTags(fetched),
    functionMode: modeMapping.functionMode,
    optimizationMode: modeMapping.optimizationMode,
    imageSubMode: modeMapping.imageSubMode,
    metadata: {
      gardenSnapshot: snapshot,
      ...(media ? { media } : {}),
    },
  })
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const generateImportedMessageId = (): string => {
  return generateWorkspaceApplyMessageId('imported')
}

const normalizeImportedConversationMessages = (input: unknown): ConversationMessage[] => {
  if (!Array.isArray(input)) return []
  const out: ConversationMessage[] = []

  for (const item of input) {
    if (!isPlainObject(item)) continue
    const role = item.role
    if (role !== 'system' && role !== 'user' && role !== 'assistant' && role !== 'tool') continue
    const content = typeof item.content === 'string' ? item.content : ''
    if (!content) continue

    const id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim()
        : generateImportedMessageId()

    const originalContent = typeof item.originalContent === 'string' ? item.originalContent : content

    out.push({
      id,
      role,
      content,
      originalContent,
    })
  }

  return out
}

const normalizeSnapshotUrl = (opts: {
  gardenBaseUrl: string | null
  rawUrl: string
}): string => {
  const raw = String(opts.rawUrl || '').trim()
  if (!raw) return ''
  const resolved = resolveGardenUrl({ gardenBaseUrl: opts.gardenBaseUrl, url: raw })
  return resolved || raw
}

const normalizeSnapshotUrlList = (opts: {
  gardenBaseUrl: string | null
  urls: unknown
}): string[] => {
  if (!Array.isArray(opts.urls)) return []
  return opts.urls
    .map((item) => (typeof item === 'string' ? normalizeSnapshotUrl({ gardenBaseUrl: opts.gardenBaseUrl, rawUrl: item }) : ''))
    .filter(Boolean)
}

const normalizeSnapshotParameters = (value: unknown): Record<string, string> | undefined => {
  if (!isPlainObject(value)) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) {
    const key = String(k || '').trim()
    if (!key) continue
    if (v === undefined || v === null) continue
    out[key] = String(v)
  }
  return Object.keys(out).length ? out : undefined
}

const normalizeSnapshotAssetItem = (opts: {
  gardenBaseUrl: string | null
  item: unknown
}): GardenSnapshotAssetItem | null => {
  if (!isPlainObject(opts.item)) return null
  const raw = { ...opts.item } as GardenSnapshotAssetItem

  if (typeof raw.url === 'string') {
    const next = normalizeSnapshotUrl({ gardenBaseUrl: opts.gardenBaseUrl, rawUrl: raw.url })
    raw.url = next || undefined
  }

  const images = normalizeSnapshotUrlList({ gardenBaseUrl: opts.gardenBaseUrl, urls: raw.images })
  if (images.length) {
    raw.images = images
  } else if (Array.isArray(raw.images)) {
    raw.images = []
  }

  const inputImages = normalizeSnapshotUrlList({
    gardenBaseUrl: opts.gardenBaseUrl,
    urls: raw.inputImages,
  })
  if (inputImages.length) {
    raw.inputImages = inputImages
  } else if (Array.isArray(raw.inputImages)) {
    raw.inputImages = []
  }

  const parameters = normalizeSnapshotParameters(raw.parameters)
  if (parameters) {
    raw.parameters = parameters
  } else {
    delete raw.parameters
  }

  return raw
}

const fetchPromptFromGarden = async (opts: {
  gardenBaseUrl: string | null
  importCode: string
}): Promise<FetchedPrompt> => {
  const { gardenBaseUrl, importCode } = opts

  const normalizedGardenBaseUrl = gardenBaseUrl ? normalizeBaseUrl(gardenBaseUrl) : null

  const url = (() => {
    if (!normalizedGardenBaseUrl) return null
    return `${normalizedGardenBaseUrl}/api/public/prompt-source/${encodeURIComponent(importCode)}`
  })()

  if (!url) {
    throw new Error('Missing VITE_PROMPT_GARDEN_BASE_URL')
  }

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  })

  if (!resp.ok) {
    throw new Error(`Garden request failed: ${resp.status}`)
  }
  const text = await resp.text()

  const parseV1 = (data: unknown): FetchedPrompt => {
    if (!isPlainObject(data)) {
      throw new Error('Garden response must be a JSON object')
    }
    if (data.schema !== 'prompt-garden.prompt.v1') {
      throw new Error('Unsupported Garden response schema')
    }
    if (data.schemaVersion !== 1) {
      throw new Error('Unsupported Garden response schemaVersion')
    }

    const optimizerTarget = isPlainObject(data.optimizerTarget) ? data.optimizerTarget : null
    const optimizerTargetKey =
      optimizerTarget && typeof optimizerTarget.subModeKey === 'string'
        ? optimizerTarget.subModeKey.trim()
        : ''
    if (!optimizerTargetKey) {
      throw new Error('Missing optimizerTarget.subModeKey')
    }

    const prompt = isPlainObject(data.prompt) ? data.prompt : null
    const format = prompt && (prompt.format === 'text' || prompt.format === 'messages')
      ? (prompt.format as 'text' | 'messages')
      : null
    if (!format) {
      throw new Error('Missing prompt.format')
    }

    let promptText: string | undefined
    let promptMessages: ConversationMessage[] | undefined
    if (format === 'text') {
      const t = prompt && typeof prompt.text === 'string' ? prompt.text : ''
      if (!t.trim()) {
        throw new Error('Empty prompt.text')
      }
      promptText = t
    } else {
      const msgs = normalizeImportedConversationMessages(prompt?.messages)
      if (!msgs.length) {
        throw new Error('Empty prompt.messages')
      }
      promptMessages = msgs
    }

    if (!Array.isArray(data.variables)) {
      throw new Error('Missing variables')
    }
    const variablesForImport = data.variables
      .map((v): { name: string; defaultValue?: string } => {
        if (!isPlainObject(v)) return { name: '' }
        const name = typeof v.name === 'string' ? v.name.trim() : ''
        const defaultValue = typeof v.defaultValue === 'string' ? v.defaultValue : undefined
        return { name, defaultValue }
      })
      .filter((v) => isValidVariableName(v.name))

    const snapshotVariables = data.variables
      .map((v): GardenSnapshotVariable | null => {
        if (!isPlainObject(v)) return null
        const name = typeof v.name === 'string' ? v.name.trim() : ''
        if (!isValidVariableName(name)) return null

        const type =
          v.type === 'string' || v.type === 'number' || v.type === 'boolean' || v.type === 'enum'
            ? v.type
            : undefined

        const options = extractStringArray(v.options)
        const source = typeof v.source === 'string' && v.source.trim() ? v.source.trim() : undefined

        return {
          name,
          description: typeof v.description === 'string' ? v.description : undefined,
          type,
          required: typeof v.required === 'boolean' ? v.required : undefined,
          defaultValue: typeof v.defaultValue === 'string' ? v.defaultValue : undefined,
          options: options.length ? options : undefined,
          source,
        }
      })
      .filter((v): v is GardenSnapshotVariable => Boolean(v))

    const assets = isPlainObject(data.assets) ? data.assets : null

    const cover = (() => {
      if (!assets || !isPlainObject(assets.cover)) return undefined
      const out = { ...assets.cover } as { url?: string; [key: string]: unknown }
      if (typeof out.url === 'string') {
        out.url = normalizeSnapshotUrl({
          gardenBaseUrl: normalizedGardenBaseUrl,
          rawUrl: out.url,
        }) || undefined
      }
      return out
    })()

    const showcases = assets && Array.isArray(assets.showcases)
      ? assets.showcases
          .map((item) => normalizeSnapshotAssetItem({
            gardenBaseUrl: normalizedGardenBaseUrl,
            item,
          }))
          .filter((item): item is GardenSnapshotAssetItem => Boolean(item))
      : []

    const snapshotExamples = assets && Array.isArray(assets.examples)
      ? assets.examples
          .map((item) => normalizeSnapshotAssetItem({
            gardenBaseUrl: normalizedGardenBaseUrl,
            item,
          }))
          .filter((item): item is GardenSnapshotAssetItem => Boolean(item))
      : []

    const examples = snapshotExamples
      .map((ex): { id?: string; parameters?: Record<string, string>; inputImages?: string[] } => {
        const id = typeof ex.id === 'string' ? ex.id.trim() : undefined

        const parameters = normalizeSnapshotParameters(ex.parameters)

        const inputImages = Array.isArray(ex.inputImages)
          ? ex.inputImages
              .map((u) => (typeof u === 'string' ? u.trim() : ''))
              .filter(Boolean)
          : undefined

        return {
          id,
          parameters,
          inputImages,
        }
      })
      .filter((ex) => Boolean(ex.parameters) || (Array.isArray(ex.inputImages) && ex.inputImages.length > 0))

    const meta = isPlainObject(data.meta) ? { ...data.meta } : undefined

    const snapshot: GardenSnapshot = {
      schema: 'prompt-garden.prompt.v1',
      schemaVersion: 1,
      importCode:
        typeof data.importCode === 'string' && data.importCode.trim()
          ? data.importCode.trim()
          : importCode,
      gardenBaseUrl: normalizedGardenBaseUrl,
      id: typeof data.id === 'string' ? data.id : undefined,
      optimizerTarget: {
        subModeKey: optimizerTargetKey,
      },
      prompt:
        format === 'text'
          ? {
              format,
              text: promptText,
            }
          : {
              format,
              messages: promptMessages,
            },
      variables: snapshotVariables,
      assets: {
        cover,
        showcases: showcases.length ? showcases : undefined,
        examples: snapshotExamples.length ? snapshotExamples : undefined,
      },
      meta,
      importedAt: new Date().toISOString(),
    }

    return {
      importCode: snapshot.importCode,
      optimizerTargetKey,
      promptFormat: format,
      promptText,
      promptMessages,
      variables: variablesForImport,
      examples,
      gardenSnapshot: snapshot,
    }
  }

  let data: unknown
  try {
    data = JSON.parse(text) as unknown
  } catch {
    throw new Error('Garden response is not valid JSON')
  }

  return parseV1(data)
}

const resolveGardenUrl = (opts: { gardenBaseUrl: string | null; url: string }): string | null => {
  const raw = String(opts.url || '').trim()
  if (!raw) return null
  if (/^https?:\/\//u.test(raw)) return raw

  const base = opts.gardenBaseUrl ? normalizeBaseUrl(opts.gardenBaseUrl) : null
  if (!base) return null

  try {
    return new URL(raw, `${base}/`).toString()
  } catch {
    return null
  }
}

const fetchImageAsBase64 = async (absoluteUrl: string): Promise<{ b64: string; mimeType: string } | null> => {
  const resp = await fetch(absoluteUrl, { method: 'GET' })
  if (!resp.ok) {
    throw new Error(`Example image request failed: ${resp.status}`)
  }

  const headerType = resp.headers.get('content-type')
  const mimeType = typeof headerType === 'string' ? headerType.split(';')[0].trim() : ''

  type BufferLike = {
    from: (data: ArrayBuffer) => { toString: (encoding: 'base64') => string }
  }

  const maybeBuffer = (globalThis as unknown as { Buffer?: BufferLike }).Buffer
  if (maybeBuffer && typeof maybeBuffer.from === 'function') {
    const ab = await resp.arrayBuffer()
    const b64 = maybeBuffer.from(ab).toString('base64')
    return { b64, mimeType: mimeType || 'application/octet-stream' }
  }

  if (typeof FileReader === 'undefined') {
    throw new Error('FileReader is not available to decode images')
  }

  const blob = await resp.blob()
  const actualMime = blob.type || mimeType
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image blob'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(blob)
  })

  const match = dataUrl.match(/^data:.*?;base64,(.*)$/u)
  const b64 = match ? match[1] : ''
  if (!b64) {
    throw new Error('Failed to decode image data URL')
  }
  return { b64, mimeType: actualMime || 'application/octet-stream' }
}

const dedupeStrings = (items: string[]): string[] => {
  return Array.from(new Set(items.filter(Boolean)))
}

const buildAssetSourceMetadata = (snapshot: GardenSnapshot): { prompt?: string } => {
  if (snapshot.prompt.format !== 'text') {
    return {}
  }

  const prompt = typeof snapshot.prompt.text === 'string' ? snapshot.prompt.text.trim() : ''
  if (!prompt) return {}
  return { prompt }
}

const persistSourcesToAssetIdsWithFallback = async (opts: {
  sources: string[]
  storageService: IImageStorageService | null | undefined
  metadata?: { prompt?: string }
  allowSourceFallback?: boolean
}): Promise<{ assetIds: string[]; fallbackSources: string[] }> => {
  const { storageService, metadata, allowSourceFallback = true } = opts
  const normalizedSources = dedupeStrings(opts.sources.map((item) => String(item || '').trim()).filter(Boolean))

  if (normalizedSources.length === 0) {
    return {
      assetIds: [],
      fallbackSources: normalizedSources,
    }
  }

  if (!storageService) {
    if (!allowSourceFallback) {
      throw new Error('Favorite image storage service unavailable')
    }
    return {
      assetIds: [],
      fallbackSources: normalizedSources,
    }
  }

  const assetIds: string[] = []
  const fallbackSources: string[] = []

  for (const source of normalizedSources) {
    try {
      const assetId = await persistImageSourceAsAssetId({
        source,
        storageService,
        sourceType: 'uploaded',
        metadata,
      })

      if (assetId) {
        assetIds.push(assetId)
      } else if (!allowSourceFallback) {
        throw new Error(`Failed to persist snapshot image source: ${source}`)
      } else {
        fallbackSources.push(source)
      }
    } catch (error) {
      const log = allowSourceFallback ? console.info : console.warn
      log('[PromptGardenImport] Failed to persist snapshot image source:', source, error)
      if (!allowSourceFallback) {
        throw error
      }
      fallbackSources.push(source)
    }
  }

  return {
    assetIds: dedupeStrings(assetIds),
    fallbackSources,
  }
}

const persistSnapshotAssetItem = async (opts: {
  item: GardenSnapshotAssetItem
  storageService: IImageStorageService | null | undefined
  metadata?: { prompt?: string }
  allowSourceFallback?: boolean
}): Promise<GardenSnapshotAssetItem> => {
  const { storageService, metadata, allowSourceFallback = true } = opts
  const next: GardenSnapshotAssetItem = { ...opts.item }

  const imageSources = dedupeStrings([
    ...(typeof next.url === 'string' ? [next.url] : []),
    ...extractStringArray(next.images),
  ])

  const imagePersisted = await persistSourcesToAssetIdsWithFallback({
    sources: imageSources,
    storageService,
    metadata,
    allowSourceFallback,
  })

  const existingImageAssetIds = extractStringArray(next.imageAssetIds)
  next.imageAssetIds = dedupeStrings([...existingImageAssetIds, ...imagePersisted.assetIds])

  if (imagePersisted.fallbackSources.length > 0) {
    next.url = imagePersisted.fallbackSources[0]
    next.images = imagePersisted.fallbackSources
  } else {
    delete next.url
    next.images = []
  }

  const inputSources = extractStringArray(next.inputImages)
  const inputPersisted = await persistSourcesToAssetIdsWithFallback({
    sources: inputSources,
    storageService,
    metadata,
    allowSourceFallback,
  })

  const existingInputAssetIds = extractStringArray(next.inputImageAssetIds)
  next.inputImageAssetIds = dedupeStrings([...existingInputAssetIds, ...inputPersisted.assetIds])
  next.inputImages = inputPersisted.fallbackSources

  return next
}

async function buildStorableGardenSnapshot(
  snapshot: GardenSnapshot,
  imageStorageService?: IImageStorageService | null,
  options?: {
    allowImageFallback?: boolean
  },
): Promise<GardenSnapshot> {
  const assets = snapshot.assets || {}
  const sourceMetadata = buildAssetSourceMetadata(snapshot)
  const allowImageFallback = options?.allowImageFallback ?? true

  const cover = assets.cover ? { ...assets.cover } : undefined
  if (cover && typeof cover.url === 'string') {
    try {
      const coverAssetId = await persistImageSourceAsAssetId({
        source: cover.url,
        storageService: imageStorageService,
        sourceType: 'uploaded',
        metadata: sourceMetadata,
      })
      if (coverAssetId) {
        cover.assetId = coverAssetId
        delete cover.url
      } else if (!allowImageFallback) {
        throw new Error(`Failed to persist cover image source: ${cover.url}`)
      }
    } catch (error) {
      console.info('[PromptGardenImport] Failed to persist cover image source:', cover.url, error)
      if (!allowImageFallback) {
        throw error
      }
    }
  }

  const showcases = Array.isArray(assets.showcases)
    ? await Promise.all(
        assets.showcases.map((item) =>
          persistSnapshotAssetItem({
            item,
            storageService: imageStorageService,
            metadata: sourceMetadata,
            allowSourceFallback: allowImageFallback,
          }),
        ),
      )
    : undefined

  const examples = Array.isArray(assets.examples)
    ? await Promise.all(
        assets.examples.map((item) =>
          persistSnapshotAssetItem({
            item,
            storageService: imageStorageService,
            metadata: sourceMetadata,
            allowSourceFallback: allowImageFallback,
          }),
        ),
      )
    : undefined

  return {
    ...snapshot,
    assets: {
      ...assets,
      cover,
      showcases,
      examples,
    },
  }
}

const buildFavoriteMediaFromSnapshot = (snapshot: GardenSnapshot) => {
  const assets = snapshot.assets || {}
  const cover = assets.cover || {}

  const collectAssetIdsFromItems = (items: GardenSnapshotAssetItem[] | undefined, key: 'imageAssetIds' | 'inputImageAssetIds') => {
    if (!Array.isArray(items)) return [] as string[]
    return dedupeStrings(
      items.flatMap((item) => extractStringArray(item[key]))
    )
  }

  const collectUrlsFromItems = (items: GardenSnapshotAssetItem[] | undefined, key: 'images' | 'inputImages') => {
    if (!Array.isArray(items)) return [] as string[]
    return dedupeStrings(
      items.flatMap((item) => extractStringArray(item[key]))
    )
  }

  const coverAssetId = typeof cover.assetId === 'string' ? cover.assetId.trim() : undefined
  const coverUrl = typeof cover.url === 'string' ? cover.url.trim() : undefined

  const assetIds = dedupeStrings([
    ...collectAssetIdsFromItems(assets.showcases, 'imageAssetIds'),
    ...collectAssetIdsFromItems(assets.examples, 'imageAssetIds'),
    ...collectAssetIdsFromItems(assets.examples, 'inputImageAssetIds'),
  ])

  const urls = dedupeStrings([
    ...collectUrlsFromItems(assets.showcases, 'images'),
    ...collectUrlsFromItems(assets.examples, 'images'),
    ...collectUrlsFromItems(assets.examples, 'inputImages'),
  ])

  return buildFavoriteMediaMetadata({
    coverAssetId,
    coverUrl,
    assetIds,
    urls,
  })
}

const pickImportedExample = (
  examples: FetchedPrompt['examples'],
  exampleId: string | null,
): FetchedPrompt['examples'][number] | null => {
  if (!Array.isArray(examples) || examples.length === 0) return null
  const id = (exampleId || '').trim()
  if (id) {
    const found = examples.find((ex) => (ex.id || '').trim() === id)
    if (found) return found
  }
  return examples[0] || null
}

type SaveFavoriteDialogPayload = {
  content: string
  originalContent?: string
  prefill?: {
    title?: string
    description?: string
    category?: string
    tags?: string[]
    functionMode?: 'basic' | 'context' | 'image'
    optimizationMode?: 'system' | 'user'
    imageSubMode?: 'text2image' | 'image2image' | 'multiimage'
    metadata?: Record<string, unknown>
  }
}

export interface AppPromptGardenImportOptions {
  router: Pick<Router, 'currentRoute' | 'push' | 'replace'>
  hasRestoredInitialState: Ref<boolean>
  isLoadingExternalData: Ref<boolean>

  /** Fixed integration base URL (no per-link overrides). */
  gardenBaseUrl: string | null
  arenaSession?: Pick<ReturnType<typeof useArenaSession>, 'running' | 'replaceInput'>

  basicSystemSession: BasicSystemSessionApi
  basicUserSession: BasicUserSessionApi
  proMultiMessageSession: ProMultiMessageSessionApi
  proVariableSession: ProVariableSessionApi
  imageText2ImageSession: ImageText2ImageSessionApi
  imageImage2ImageSession: ImageImage2ImageSessionApi
  imageMultiImageSession: ImageMultiImageSessionApi

  /** Optional getter for auto-save-to-favorites flow. */
  getFavoriteManager?: () => FavoriteManagerLike | null
  /** Optional getter for favorite image storage service (asset refs). */
  getFavoriteImageStorageService?: () => IImageStorageService | null
  /** @deprecated Use getFavoriteImageStorageService instead. */
  getImageStorageService?: () => IImageStorageService | null
  /** Optional callback for confirmation-style favorite flow. */
  openSaveFavoriteDialog?: (payload: SaveFavoriteDialogPayload) => void

  /** UI-only current versions list for history drawer; safe to clear for basic imports */
  optimizerCurrentVersions: Ref<PromptRecordChain['versions']>
}

export function useAppPromptGardenImport(options: AppPromptGardenImportOptions) {
  const toast = useToast()
  const {
    router,
    hasRestoredInitialState,
    isLoadingExternalData,
    gardenBaseUrl,
    arenaSession,
    basicSystemSession,
    basicUserSession,
    proMultiMessageSession,
    proVariableSession,
    imageText2ImageSession,
    imageImage2ImageSession,
    imageMultiImageSession,
    getFavoriteManager,
    getFavoriteImageStorageService,
    getImageStorageService,
    openSaveFavoriteDialog,
    optimizerCurrentVersions,
  } = options

  const inFlight = { value: false }

  // Watch both route changes and the "initial restore" gate.
  // If the app loads directly on an import URL, the route may never change after restore;
  // we still need to run the import once restore completes.
  watch(
    () => [router.currentRoute.value.fullPath, hasRestoredInitialState.value] as const,
    async ([, restored]) => {
      if (!restored) return
      if (inFlight.value) return

      const currentRoute = router.currentRoute.value
      const query = currentRoute.query

      const rawImportCode = getQueryString(query, 'importCode')
      const parsedImportCode = rawImportCode ? parseImportCodeSelector(rawImportCode) : null
      const importCode = parsedImportCode?.importCode
      if (!importCode) return

      const explicitExampleId = getQueryString(query, 'exampleId')?.trim() || null
      const exampleId = explicitExampleId ?? parsedImportCode.exampleId
      const saveToFavoritesMode = parseSaveToFavoritesMode(getQueryString(query, 'saveToFavorites'))

      inFlight.value = true
      isLoadingExternalData.value = true
      let importingToast = toast.info(String(i18n.global.t('common.promptGarden.importingStatus')), {
        duration: 0,
        closable: false,
      })
      const closeImportingToast = () => {
        toast.remove(importingToast)
        importingToast = undefined
      }
      try {
        const fetched = await fetchPromptFromGarden({
          gardenBaseUrl,
          importCode,
        })

        const importedExample = pickImportedExample(fetched.examples, exampleId)

        const targetKey = resolveTargetKey(query, currentRoute.path, fetched.optimizerTargetKey)

        if (saveToFavoritesMode !== 'none') {
          if (saveToFavoritesMode === 'auto') {
            const favoriteManager = getFavoriteManager?.() || null
            const imageStorageService =
              getFavoriteImageStorageService?.() || getImageStorageService?.() || null
            if (favoriteManager) {
              try {
                await saveImportedPromptToFavorites({
                  manager: favoriteManager,
                  imageStorageService,
                  fetched,
                  targetKey,
                })
              } catch (error) {
                toast.warning(String(i18n.global.t('toast.warning.promptGardenFavoriteSaveFailed')))
              }
            } else {
              console.warn('[PromptGardenImport] Favorite manager unavailable, skip auto-save')
            }
          } else {
            const content = buildFavoriteContentFromFetchedPrompt(fetched)
            if (!content) {
              console.warn('[PromptGardenImport] Skip favorite dialog: imported content is empty')
            } else if (!openSaveFavoriteDialog) {
              console.warn('[PromptGardenImport] Favorite dialog callback unavailable, skip confirm flow')
            } else {
              const modeMapping = toFavoriteModeMapping(targetKey, fetched.gardenSnapshot.meta)
              const imageStorageService =
                getFavoriteImageStorageService?.() || getImageStorageService?.() || null

              let snapshot = fetched.gardenSnapshot
              try {
                snapshot = await buildStorableGardenSnapshot(snapshot, imageStorageService, {
                  allowImageFallback: true,
                })
              } catch (error) {
                console.info('[PromptGardenImport] Failed to persist snapshot assets for favorite dialog:', error)
              }

              const media = buildFavoriteMediaFromSnapshot(snapshot)
              const metadata: Record<string, unknown> = {
                gardenSnapshot: snapshot,
                ...(media ? { media } : {}),
              }
              const favoriteManager = getFavoriteManager?.() || null
              const categoryPath = deriveFavoriteCategoryPath(fetched)
              const resolvedCategoryFromPath = favoriteManager
                ? await loadFavoriteCategoryPathLeafId(favoriteManager, categoryPath)
                : undefined

              openSaveFavoriteDialog({
                content,
                originalContent: content,
                prefill: {
                  title: deriveFavoriteTitle(fetched),
                  description: deriveFavoriteDescription(fetched),
                  category: resolvedCategoryFromPath || deriveFavoriteCategory(fetched),
                  tags: deriveFavoriteTags(fetched),
                  functionMode: modeMapping.functionMode,
                  optimizationMode: modeMapping.optimizationMode,
                  imageSubMode: modeMapping.imageSubMode,
                  metadata,
                },
              })
            }
          }

          const cleanedQuery = omitKeys(query, ['importCode', 'subModeKey', 'exampleId', 'saveToFavorites'])
          await router.replace({ path: router.currentRoute.value.path, query: cleanedQuery })
          await nextTick()

          closeImportingToast()
          toast.success(String(i18n.global.t('toast.success.promptGardenImportSuccess')))
          return
        }

        // If caller opened the wrong workspace, navigate first.
        const targetPath = keyToPath(targetKey)
        if (router.currentRoute.value.path !== targetPath) {
          // Preserve existing query during navigation; we'll strip import params after import.
          await router.push({ path: targetPath, query })
          await nextTick()
        }

        if (targetKey === 'arena') {
          if (!arenaSession || arenaSession.running) throw new Error('Arena input is unavailable while requests are running')
          if (fetched.promptFormat !== 'text' || !fetched.promptText) throw new Error('Arena requires a text prompt')
          const values: Record<string, string> = Object.create(null)
          for (const variable of fetched.variables) {
            if (!isValidVariableName(variable.name)) continue
            const value = importedExample?.parameters?.[variable.name] ?? variable.defaultValue
            if (value !== undefined) values[variable.name] = String(value)
          }
          const execution = buildPromptExecutionContext(fetched.promptText, values)
          if (execution.missingVariables.length) throw new Error('Missing Garden example variables: ' + execution.missingVariables.join(', '))
          const images = await Promise.all((importedExample?.inputImages || []).map(async source => {
            const url = resolveGardenUrl({ gardenBaseUrl, url: source })
            if (!url) throw new Error('Invalid Garden input image URL')
            const image = await fetchImageAsBase64(url)
            if (!image?.b64) throw new Error('Failed to load Garden input image')
            return image
          }))
          if (!await arenaSession.replaceInput(execution.renderedContent, images)) throw new Error('Failed to save Arena input')
          const cleanedQuery = omitKeys(query, ['importCode', 'subModeKey', 'exampleId', 'saveToFavorites'])
          await router.replace({ path: '/arena', query: cleanedQuery })
          closeImportingToast()
          toast.success(String(i18n.global.t('toast.success.promptGardenImportSuccess')))
          return
        }

        if (targetKey === 'pro-multi') {
          const messages =
            fetched.promptFormat === 'messages'
              ? (fetched.promptMessages as ConversationMessage[])
              : buildWorkspaceConversationFromPromptText(fetched.promptText ?? '', 'imported')

          if (!messages.length) {
            throw new Error('Empty conversation content')
          }

          clearWorkspaceContentForExternalApply(targetKey, {
            basicSystemSession,
            basicUserSession,
            proMultiMessageSession,
            proVariableSession,
            imageText2ImageSession,
            imageImage2ImageSession,
            imageMultiImageSession,
            optimizerCurrentVersions,
          })
          proMultiMessageSession.updateConversationMessages(messages)

          // Auto-select latest system/user message for convenience.
          let selectedId = ''
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i]
            if (!msg) continue
            if ((msg.role === 'system' || msg.role === 'user') && msg.id) {
              selectedId = msg.id
              break
            }
          }
          proMultiMessageSession.selectMessage(selectedId)
        } else {
          const content = fetched.promptText ?? ''
          if (!content) {
            throw new Error('Empty prompt content')
          }

          clearWorkspaceContentForExternalApply(
            targetKey,
            {
              basicSystemSession,
              basicUserSession,
              proMultiMessageSession,
              proVariableSession,
              imageText2ImageSession,
              imageImage2ImageSession,
              imageMultiImageSession,
              optimizerCurrentVersions,
            }
          )

          if (targetKey === 'basic-system') {
            basicSystemSession.updatePrompt(content)
          } else if (targetKey === 'basic-user') {
            basicUserSession.updatePrompt(content)
          } else if (targetKey === 'pro-variable') {
            proVariableSession.updatePrompt(content)
          } else if (targetKey === 'image-text2image') {
            imageText2ImageSession.updatePrompt(content)
          } else if (targetKey === 'image-multiimage') {
            imageMultiImageSession.updatePrompt(content)
          } else {
            imageImage2ImageSession.updatePrompt(content)
          }
        }

        // Import variables into submode-scoped temporary variables.
        applyWorkspaceTemporaryVariables(
          targetKey,
          {
            proMultiMessageSession,
            proVariableSession,
            imageText2ImageSession,
            imageImage2ImageSession,
            imageMultiImageSession,
          },
          {
            variables: fetched.variables,
            preserveExistingValues: true,
          }
        )

        // If the imported prompt provides a full example, apply the example's parameter values
        // (and input image for image2image) so the user can reproduce the result directly.
        if (importedExample) {
          const session = getWorkspaceTemporaryVariablesSession(targetKey, {
            proMultiMessageSession,
            proVariableSession,
            imageText2ImageSession,
            imageImage2ImageSession,
            imageMultiImageSession,
          })

          const importedVariableNames = new Set(
            fetched.variables
              .map((v) => String(v?.name || '').trim())
              .filter((name) => isValidVariableName(name))
          )

          if (session && importedExample.parameters) {
            for (const [key, value] of Object.entries(importedExample.parameters)) {
              if (!importedVariableNames.has(key)) continue
              session.setTemporaryVariable(key, String(value))
            }
          }

          if (targetKey === 'image-image2image' && Array.isArray(importedExample.inputImages) && importedExample.inputImages.length > 0) {
            const inputUrl = resolveGardenUrl({
              gardenBaseUrl,
              url: importedExample.inputImages[0],
            })
            if (inputUrl) {
              try {
                const img = await fetchImageAsBase64(inputUrl)
                if (img?.b64) {
                  imageImage2ImageSession.updateInputImage(img.b64, img.mimeType)
                }
              } catch (e) {
                console.warn('[PromptGardenImport] Failed to load example input image:', e)
                toast.warning(String(i18n.global.t('toast.warning.promptGardenExampleInputImageLoadFailed')))
              }
            }
          }

          if (targetKey === 'image-multiimage' && Array.isArray(importedExample.inputImages) && importedExample.inputImages.length > 0) {
            const inputUrls = importedExample.inputImages
              .map((url) => resolveGardenUrl({ gardenBaseUrl, url }))
              .filter((url): url is string => Boolean(url))

            if (inputUrls.length > 0) {
              const settled = await Promise.allSettled(
                inputUrls.map(async (url) => {
                  const img = await fetchImageAsBase64(url)
                  if (!img?.b64) {
                    throw new Error(`Missing base64 payload for ${url}`)
                  }
                  return {
                    b64: img.b64,
                    mimeType: img.mimeType,
                  }
                }),
              )

              const loadedImages = settled.flatMap((result) =>
                result.status === 'fulfilled' ? [result.value] : [],
              )

              if (loadedImages.length > 0) {
                imageMultiImageSession.replaceInputImages(loadedImages)
              }

              if (loadedImages.length !== inputUrls.length) {
                console.warn('[PromptGardenImport] Failed to load one or more multi-image example inputs')
                toast.warning(String(i18n.global.t('toast.warning.promptGardenExampleInputImagesPartialLoadFailed')))
              }
            }
          }
        }

        // Best-effort persist.
        try {
          if (targetKey === 'basic-system') await basicSystemSession.saveSession()
          else if (targetKey === 'basic-user') await basicUserSession.saveSession()
          else if (targetKey === 'pro-multi') await proMultiMessageSession.saveSession()
          else if (targetKey === 'pro-variable') await proVariableSession.saveSession()
          else if (targetKey === 'image-text2image') await imageText2ImageSession.saveSession()
          else if (targetKey === 'image-multiimage') await imageMultiImageSession.saveSession()
          else await imageImage2ImageSession.saveSession()
        } catch (e) {
          console.warn('[PromptGardenImport] saveSession failed:', e)
        }

        // Remove import params to avoid re-import on refresh.
        const cleanedQuery = omitKeys(query, ['importCode', 'subModeKey', 'exampleId', 'saveToFavorites'])
        await router.replace({ path: router.currentRoute.value.path, query: cleanedQuery })
        await nextTick()

        closeImportingToast()
        toast.success(String(i18n.global.t('toast.success.promptGardenImportSuccess')))
      } catch (error) {
        console.error('[PromptGardenImport] Failed:', error)
        closeImportingToast()
        toast.error(String(i18n.global.t('toast.error.promptGardenImportFailed')))
      } finally {
        closeImportingToast()
        isLoadingExternalData.value = false
        inFlight.value = false
      }
    },
    { immediate: true }
  )

  return {
    // For potential future manual triggers.
  }
}
