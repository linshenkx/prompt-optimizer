import { v4 as randomUUID } from 'uuid'
import type { IStorageProvider } from '../storage/types'
import type { IFavoriteManager } from '../favorite/types'
import type { IPromptService } from '../prompt/types'
import { decodeTextModelSelection } from '../model/selection'
import { CORE_SERVICE_KEYS } from '../../constants/storage-keys'
import { createBrowserTextRuns } from './text-runs'
import type { AssetVersionSelection } from '../asset-reader/types'
import type { PromptModeKey } from '../prompt-model/types'
import type { ComparisonExecutionSource } from '../text-comparison/types'
import { type ComparisonStorage } from '../text-comparison/repository'
import { createReadonlyAssetReader } from '../asset-reader/reader'
import { canonical } from '../text-comparison/validation'
import { hashText, signText } from '../../utils/portable-crypto'
import { assertBridgeJson, BrowserBridgeError, browserFavoriteOperations, type BrowserAccess } from './protocol'
import { createProductBusiness } from '../mcp-business/session'

type BrowserStorage = IStorageProvider & ComparisonStorage & {
  getAllEntries(): Promise<Array<[string, string]>>
  withProductTransaction<Value>(action: () => Promise<Value>): Promise<Value>
}

export interface BrowserProductOperations {
  mutate<T>(domain: string, action: () => Promise<T>): Promise<T>
  resource(input: Record<string, unknown>): Promise<unknown>
}

export interface BrowserBridgeHost {
  setProductOperations(operations: BrowserProductOperations | undefined): void
  contextId(): Promise<string>
  open(source: ComparisonExecutionSource, access: BrowserAccess, contextId: string): BrowserSourceSession
}

export interface BrowserSourceSession {
  call(name: string, input: Record<string, unknown>): Promise<unknown>
  dispose(): void
}

const CONTEXT_KEY = 'mcp:browser-context/v1'
const RECEIPT_PREFIX = 'mcp:browser-write/v1/'

function browserStorage(storage: IStorageProvider): BrowserStorage {
  const candidate = storage as Partial<BrowserStorage>
  if (!candidate.getAllEntries || !candidate.getEntriesByPrefix || !candidate.withProductTransaction || !candidate.withWriteTransaction || !candidate.compareAndSetItem) {
    throw new BrowserBridgeError('SOURCE_NOT_READY')
  }
  return storage as BrowserStorage
}

export function createBrowserBridgeHost({ storage: inputStorage, favoriteManager, promptService }: {
  storage: IStorageProvider
  favoriteManager: IFavoriteManager
  promptService: Pick<IPromptService, 'optimizePromptStream' | 'testPromptStream'>
}): BrowserBridgeHost {
  const storage = browserStorage(inputStorage)
  const key = globalThis.crypto.getRandomValues(new Uint8Array(32))
  const snapshot = async () => (await storage.getAllEntries()).filter(([entry]) => !entry.startsWith('mcp:'))
    .sort(([left], [right]) => left.localeCompare(right))
  const revision = async () => signText(key, canonical(await snapshot()))

  let operations: BrowserProductOperations | undefined
  return {
    setProductOperations(value) { operations = value },
    async contextId() {
      let identity = await storage.getItem(CONTEXT_KEY)
      if (!identity) {
        await storage.compareAndSetItem!(CONTEXT_KEY, null, randomUUID())
        identity = await storage.getItem(CONTEXT_KEY)
      }
      if (!identity || !/^[a-f0-9-]{36}$/.test(identity)) throw new BrowserBridgeError('SOURCE_DATA_INVALID')
      return identity
    },
    open(source, access, contextId) {
      const reader = createReadonlyAssetReader(storage, source)
      let disposed = false
      const assertActive = () => { if (disposed) throw new BrowserBridgeError('CONNECTION_CLOSED') }
      const business = createProductBusiness(storage, source.sourceId, {
        owner: { id: source.connectionGeneration, isGone: () => false },
        assertActive,
        guardedStorageKeys: [CONTEXT_KEY],
      })
      const write = () => { if (access === 'read') throw new BrowserBridgeError('COMPARISON_ACCESS_REQUIRED') }
      const textRuns = createBrowserTextRuns(promptService, (expectedRevision, modelKey) => storage.withProductTransaction(async () => {
        assertActive()
        if (await revision() !== expectedRevision) throw new BrowserBridgeError('REVISION_CONFLICT')
        const configs = JSON.parse(await storage.getItem(CORE_SERVICE_KEYS.MODELS) ?? '{}')
        const key = decodeTextModelSelection(modelKey)?.configId ?? modelKey
        if (!configs || !Object.prototype.hasOwnProperty.call(configs, key) || configs[key]?.enabled !== true) {
          throw new BrowserBridgeError('MODEL_NOT_CONFIGURED')
        }
      }))

      async function favoriteCall(name: string, input: Record<string, unknown>) {
        const operation = browserFavoriteOperations.find(item => item.operation === input.operation)
        const args = input.arguments ?? []
        if (input.domain !== 'favorites' || !operation || !Array.isArray(args) || args.length < operation.minimum ||
          args.length > operation.arguments.length || (name === 'po_desktop_query') !== (operation.access === 'read')) {
          throw new BrowserBridgeError('INVALID_INPUT')
        }
        const method = favoriteManager[operation.operation] as (...parameters: unknown[]) => Promise<unknown>
        if (operation.access === 'read') return storage.withProductTransaction(async () => ({
          result: (await method.apply(favoriteManager, args)) ?? null,
          revision: await revision(),
        }))
        write()
        const requestKey = input.requestKey
        if (typeof requestKey !== 'string' || !/^[a-zA-Z0-9._:-]{1,128}$/.test(requestKey) || typeof input.expectedRevision !== 'string') {
          throw new BrowserBridgeError('INVALID_INPUT')
        }
        const intentKey = RECEIPT_PREFIX + hashText(requestKey)
        const signature = hashText(canonical([input.domain, input.operation, args, input.expectedRevision]))
        return storage.withProductTransaction(async () => {
          assertActive()
          const raw = await storage.getItem(intentKey)
          if (raw) {
            const saved = JSON.parse(raw) as { signature: string; result: unknown }
            if (saved.signature !== signature) throw new BrowserBridgeError('IDEMPOTENCY_CONFLICT')
            return saved.result
          }
          if (await revision() !== input.expectedRevision) throw new BrowserBridgeError('REVISION_CONFLICT')
          const result = { result: (await method.apply(favoriteManager, args)) ?? null, revision: await revision(), refresh: 'reload-required' }
          assertActive()
          await storage.setItem(intentKey, JSON.stringify({ signature, result }))
          return result
        })
      }

      return {
        async call(name, input) {
          assertActive()
          assertBridgeJson(input)
          if (await storage.getItem(CONTEXT_KEY) !== contextId) throw new BrowserBridgeError('SOURCE_CONTEXT_CHANGED')
          const pagination = { limit: input.limit as number | undefined, cursor: input.cursor as string | undefined }
          let result: unknown
          switch (name) {
            case 'product': {
              const { name: method, args } = input
              if (typeof method !== 'string' || !args || typeof args !== 'object' || Array.isArray(args)) {
                throw new BrowserBridgeError('INVALID_INPUT')
              }
              const fields = args as Record<string, unknown>
              if (!['po_desktop_query', 'po_runs_get', 'po_runs_list'].includes(method) && access !== 'business') {
                throw new BrowserBridgeError('BUSINESS_ACCESS_REQUIRED')
              }
              if (method === 'po_resources') {
                if (['package.import', 'package.export'].includes(String(fields.operation)) && fields.includeCredentials !== true) {
                  throw new BrowserBridgeError('CREDENTIAL_TRANSFER_CONFIRMATION_REQUIRED')
                }
                if (!operations) throw new BrowserBridgeError('SOURCE_NOT_READY')
                const handler = operations.resource
                const resource = String(fields.operation)
                if (!['images.save', 'images.delete', 'package.import'].includes(resource)) {
                  result = await handler(fields)
                  break
                }
                if (typeof fields.requestKey !== 'string' || !fields.requestKey || fields.requestKey.length > 512) {
                  throw new BrowserBridgeError('INVALID_INPUT')
                }
                const resourceKey = 'mcp:resource-receipt:' + hashText(fields.requestKey)
                const signature = hashText(canonical(fields))
                const pending = JSON.stringify({ signature })
                if (!await storage.compareAndSetItem!(resourceKey, null, pending)) {
                  const saved = JSON.parse((await storage.getItem(resourceKey)) ?? '{}') as { signature?: string; result?: unknown }
                  if (saved.signature !== signature) throw new BrowserBridgeError('REQUEST_KEY_REUSED')
                  if (!Object.prototype.hasOwnProperty.call(saved, 'result')) throw new BrowserBridgeError('RESOURCE_RESULT_UNKNOWN')
                  result = saved.result
                  break
                }
                try {
                  result = await handler(fields)
                } catch (error) {
                  const code = error instanceof Error && 'code' in error ? error.code : undefined
                  if (['WORKSPACE_BUSY', 'IMAGE_NOT_FOUND', 'IMAGE_REVISION_CONFLICT', 'IMAGE_REFERENCED'].includes(String(code))) {
                    await storage.compareAndSetItem!(resourceKey, pending, null)
                    throw error
                  }
                  throw new BrowserBridgeError('RESOURCE_RESULT_UNKNOWN')
                }
                if (!await storage.compareAndSetItem!(resourceKey, pending, JSON.stringify({ signature, result }))) {
                  throw new BrowserBridgeError('RESOURCE_RESULT_UNKNOWN')
                }
              } else if (method === 'po_desktop_mutate' && operations) {
                result = await operations.mutate(String(fields.domain), () => business.call(method, fields))
              } else {
                result = await business.call(method, fields, access === 'read')
              }
              break
            }
            case 'po_assets_list': result = await reader.listAssets({ ...pagination, modeKey: input.modeKey as PromptModeKey | undefined, query: input.query as string | undefined }); break
            case 'po_assets_list_versions':
              result = await reader.listAssetVersions({
                favoriteId: input.favoriteId as string, assetId: input.assetId as string, expectedRevision: input.expectedRevision as string,
              }, pagination)
              break
            case 'po_runs_start': write(); result = await textRuns.start(input); break
            case 'po_runs_get': write(); result = textRuns.get(input.runId as string); break
            case 'po_runs_cancel': write(); result = textRuns.cancel(input.runId as string); break
            case 'po_assets_get_version': result = await reader.getAssetVersion(input as unknown as AssetVersionSelection); break
            case 'po_desktop_query':
            case 'po_desktop_mutate': result = await favoriteCall(name, input); break
            default: throw new BrowserBridgeError('UNKNOWN_TOOL')
          }
          assertActive()
          return result
        },
        dispose() { disposed = true; textRuns.dispose(); void business.close().catch(() => {}) },
      }
    },
  }
}
