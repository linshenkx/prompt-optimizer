import { CORE_SERVICE_KEYS } from '../../constants/storage-keys'
import { isPromptModeKey } from '../prompt-model/mode'
import type { PromptAsset } from '../prompt-model/types'
import type {
  AssetReadPage, AssetReadPagination, AssetReaderScope, AssetReadStorage, AssetSelection,
  IReadonlyAssetReader, PublicStoredAsset, PublicStoredModel,
} from './types'
import { AssetReadError, parseFavorites, parseModels, text } from './validation'
import { signText } from '../../utils/portable-crypto'

// Canonicalize parsed JSON without assigning arbitrary keys onto an object.
const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : v !== null && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`
    : JSON.stringify(v)

/** No manager, registry, defaults, environment, SDK, file path or provider opening. */
export interface AssetReaderRevisionKeys {
  revisionKey?: Promise<CryptoKey>
  portableRevisionKey?: Uint8Array
}

export function createReadonlyAssetReader(storage: AssetReadStorage, source: AssetReaderScope, options?: AssetReaderRevisionKeys): IReadonlyAssetReader {
  return createAssetReadAccess(storage, source, options).reader
}

/** Internal execution access. The asset-reader entry point exports only the public reader. */
export function createAssetReadAccess(storage: AssetReadStorage, source: AssetReaderScope, options?: AssetReaderRevisionKeys) {
  if (!text(source.sourceId) || !text(source.sourceEpoch)) throw new AssetReadError('INVALID_INPUT')
  const scope = Object.freeze({ sourceId: source.sourceId, sourceEpoch: source.sourceEpoch })
  const getItem = storage.getItem.bind(storage)
  // Per-reader keyed revisions are deterministic for the exact snapshot/scope,
  // but never publish an unkeyed digest of credentials or arbitrary metadata.
  let revisionKey: Promise<CryptoKey> | undefined = options?.revisionKey
  let portableKey = options?.portableRevisionKey
  async function revision(kind: string, snapshot: unknown): Promise<string> {
    try {
      if (!globalThis.crypto.subtle) {
        portableKey ??= globalThis.crypto.getRandomValues(new Uint8Array(32))
        return `read-v1:${signText(portableKey, canonical([scope, kind, snapshot]))}`
      }
      revisionKey ??= globalThis.crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const signature = await globalThis.crypto.subtle.sign('HMAC', await revisionKey,
        new TextEncoder().encode(canonical([scope, kind, snapshot])))
      return `read-v1:${Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('')}`
    } catch { throw new AssetReadError('REVISION_UNAVAILABLE') }
  }
  async function read(key: string): Promise<unknown> {
    let raw: string | null
    try { raw = await getItem(key) } catch { throw new AssetReadError('SOURCE_READ_FAILED') }
    if (raw === null) throw new AssetReadError('SOURCE_DATA_MISSING')
    try {
      return JSON.parse(raw, (_key, value: unknown) => {
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error()
        return value
      })
    } catch { throw new AssetReadError('SOURCE_DATA_INVALID') }
  }
  async function page<T>(items: T[], options: AssetReadPagination, signature: string): Promise<AssetReadPage<T>> {
    const limit = options.limit ?? 20
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new AssetReadError('INVALID_INPUT')
    let offset = 0
    if (options.cursor !== undefined) {
      if (typeof options.cursor !== 'string') throw new AssetReadError('INVALID_CURSOR')
      const match = /^(0|[1-9]\d*)\.(read-v1:[a-f0-9]{64})$/.exec(options.cursor)
      if (!match || match[2] !== signature) throw new AssetReadError('INVALID_CURSOR')
      offset = Number(match[1])
      if (!Number.isSafeInteger(offset) || offset >= items.length) throw new AssetReadError('INVALID_CURSOR')
    }
    return { ...scope, items: items.slice(offset, offset + limit),
      ...(offset + limit < items.length ? { nextCursor: `${offset + limit}.${signature}` } : {}) }
  }
  function validatePagination(options: AssetReadPagination) {
    const limit = options.limit ?? 20
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new AssetReadError('INVALID_INPUT')
    if (options.cursor !== undefined && (typeof options.cursor !== 'string' || !/^(0|[1-9]\d*)\.read-v1:[a-f0-9]{64}$/.test(options.cursor))) throw new AssetReadError('INVALID_CURSOR')
  }
  async function readAsset(selection: AssetSelection) {
    if (![selection.favoriteId, selection.assetId].every(text) ||
      (selection.expectedRevision !== undefined && !text(selection.expectedRevision))) throw new AssetReadError('INVALID_INPUT')
    const entry = parseFavorites(await read('favorites')).find(item => item.favoriteId === selection.favoriteId && item.asset.id === selection.assetId)
    if (!entry) throw new AssetReadError('ASSET_VERSION_NOT_FOUND')
    return entry
  }
  async function assetDescription(favoriteId: string, raw: unknown, asset: PromptAsset, expectedRevision?: string): Promise<PublicStoredAsset> {
    const assetRevision = await revision(`favorite:${favoriteId}`, raw)
    if (expectedRevision !== undefined && expectedRevision !== assetRevision) throw new AssetReadError('REVISION_CONFLICT')
    return { favoriteId, assetId: asset.id, title: asset.title, modeKey: asset.contract.modeKey,
      tags: [...asset.tags], currentVersionId: asset.currentVersionId, versionCount: asset.versions.length,
      updatedAt: asset.updatedAt, revision: assetRevision }
  }
  async function signedModel({ model, raw }: ReturnType<typeof parseModels>[number]) {
    const signed: PublicStoredModel = { ...model, revision: await revision(`model:${model.configKey}`, raw) }
    return { model: signed, raw }
  }
  async function readStoredModels(configKeys: string[]) {
    const entries = parseModels(await read(CORE_SERVICE_KEYS.MODELS))
    return Promise.all(entries.filter(({ model }) => configKeys.includes(model.configKey)).map(signedModel))
  }
  async function listModels<T>(options: AssetReadPagination, project: (entry: Awaited<ReturnType<typeof signedModel>>) => T) {
    validatePagination(options)
    const snapshot = await read(CORE_SERVICE_KEYS.MODELS)
    const entries = await Promise.all(parseModels(snapshot).map(signedModel))
    return page(entries.map(project), options, await revision('models-page', snapshot))
  }

  const reader: IReadonlyAssetReader = {
    listModels(options = {}) {
      return listModels(options, ({ model }) => model)
    },
    async listAssets(options = {}) {
      validatePagination(options)
      if (options.modeKey !== undefined && !isPromptModeKey(options.modeKey)) throw new AssetReadError('INVALID_INPUT')
      if (options.query !== undefined && typeof options.query !== 'string') throw new AssetReadError('INVALID_INPUT')
      const raw = await read('favorites')
      const query = (options.query ?? '').trim().toLowerCase()
      const assets = parseFavorites(raw).filter(({ asset }) => (!options.modeKey || options.modeKey === asset.contract.modeKey) &&
        (!query || [asset.title, ...asset.tags].some(value => value.toLowerCase().includes(query))))
      const items = await Promise.all(assets.map(({ favoriteId, raw, asset }) => assetDescription(favoriteId, raw, asset)))
      return page(items, options, await revision('favorites-page', [raw, options.modeKey ?? null, query]))
    },
    async listAssetVersions(selection, options = {}) {
      validatePagination(options)
      const { favoriteId, raw, asset } = await readAsset(selection)
      const description = await assetDescription(favoriteId, raw, asset, selection.expectedRevision)
      const versions = asset.versions
        .map(({ id, version, createdAt }) => ({ versionId: id, version, createdAt }))
        .sort((a, b) => b.version - a.version || b.createdAt - a.createdAt)
      return {
        ...await page(versions, options, description.revision),
        favoriteId,
        assetId: description.assetId,
        currentVersionId: description.currentVersionId,
        versionCount: description.versionCount,
        revision: description.revision,
      }
    },
    async getAssetVersion(selection) {
      if (!text(selection.versionId)) throw new AssetReadError('INVALID_INPUT')
      const entry = await readAsset(selection)
      const version = entry.asset.versions.find(item => item.id === selection.versionId)
      if (!version) throw new AssetReadError('ASSET_VERSION_NOT_FOUND')
      const description = await assetDescription(entry.favoriteId, entry.raw, entry.asset, selection.expectedRevision)
      if (version.content.kind !== 'text') throw new AssetReadError('ASSET_CONTENT_UNSUPPORTED')
      return { ...scope, ...description, versionId: version.id, version: version.version,
        content: { kind: 'text', text: version.content.text },
        variables: entry.asset.contract.variables.map(variable => ({ name: variable.name, required: variable.required,
          ...(variable.type !== undefined ? { type: variable.type } : {}),
          ...(variable.options !== undefined ? { options: [...variable.options] } : {}) })) }
    },
  }
  return { reader, readStoredModels, listModels }
}
