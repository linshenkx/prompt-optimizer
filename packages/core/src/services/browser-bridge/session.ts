import { v4 as randomUUID } from 'uuid'
import type { IStorageProvider } from '../storage/types'
import type { IFavoriteManager } from '../favorite/types'
import type { ILLMService, ITextAdapterRegistry } from '../llm/types'
import type { IPromptService } from '../prompt/types'
import { decodeTextModelSelection } from '../model/selection'
import { CORE_SERVICE_KEYS } from '../../constants/storage-keys'
import { createBrowserTextRuns } from './text-runs'
import type { AssetVersionSelection } from '../asset-reader/types'
import type { PromptModeKey } from '../prompt-model/types'
import type { ComparisonExecutionSource, PrepareTextComparison } from '../text-comparison/types'
import { createComparisonRepository, type ComparisonStorage } from '../text-comparison/repository'
import { createTextComparisonService } from '../text-comparison/runner'
import { canonical } from '../text-comparison/validation'
import { hashText, signText } from '../../utils/portable-crypto'
import { assertBridgeJson, BrowserBridgeError, browserFavoriteOperations, type BrowserAccess } from './protocol'

type BrowserStorage = IStorageProvider & ComparisonStorage & {
  getAllEntries(): Promise<Array<[string, string]>>
  withProductTransaction<Value>(action: () => Promise<Value>): Promise<Value>
}

export interface BrowserBridgeHost {
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

export function createBrowserBridgeHost({ storage: inputStorage, favoriteManager, registry, llmService, promptService }: {
  storage: IStorageProvider
  favoriteManager: IFavoriteManager
  registry: ITextAdapterRegistry
  llmService: ILLMService
  promptService: Pick<IPromptService, 'optimizePromptStream' | 'testPromptStream'>
}): BrowserBridgeHost {
  const storage = browserStorage(inputStorage)
  const describe = llmService.describeStreamRequest
  if (!describe) throw new BrowserBridgeError('SOURCE_NOT_READY')
  const llm = { sendMessageStream: llmService.sendMessageStream.bind(llmService), describeStreamRequest: describe.bind(llmService) }
  const key = globalThis.crypto.getRandomValues(new Uint8Array(32))
  const snapshot = async () => (await storage.getAllEntries()).filter(([entry]) => !entry.startsWith('mcp:'))
    .sort(([left], [right]) => left.localeCompare(right))
  const revision = async () => signText(key, canonical(await snapshot()))

  return {
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
      const runner = createTextComparisonService({ storage, executionSource: source, registry, llm })
      const repository = createComparisonRepository(storage)
      let disposed = false
      const assertActive = () => { if (disposed) throw new BrowserBridgeError('CONNECTION_CLOSED') }
      const write = () => { if (access !== 'compare') throw new BrowserBridgeError('COMPARISON_ACCESS_REQUIRED') }
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
            case 'po_models_list': result = access === 'compare' ? await runner.listModels(pagination) : await runner.reader.listModels(pagination); break
            case 'po_assets_list': result = await runner.reader.listAssets({ ...pagination, modeKey: input.modeKey as PromptModeKey | undefined, query: input.query as string | undefined }); break
            case 'po_assets_list_versions':
              result = await runner.reader.listAssetVersions({
                favoriteId: input.favoriteId as string, assetId: input.assetId as string, expectedRevision: input.expectedRevision as string,
              }, pagination)
              break
            case 'po_runs_start': write(); result = await textRuns.start(input); break
            case 'po_runs_get': write(); result = textRuns.get(input.runId as string); break
            case 'po_runs_cancel': write(); result = textRuns.cancel(input.runId as string); break
            case 'po_assets_get_version': result = await runner.reader.getAssetVersion(input as unknown as AssetVersionSelection); break
            case 'po_tests_prepare': write(); result = await runner.prepare(input as unknown as PrepareTextComparison); break
            case 'po_tests_execute': write(); result = await runner.execute(input.preparedId as string, input.previewRevision as string); break
            case 'po_tests_get': write(); result = runner.get(input.preparedId as string); break
            case 'po_tests_cancel': write(); result = runner.cancel(input.preparedId as string, input.runId as string | undefined); break
            case 'po_comparisons_save': {
              write()
              const saved = await repository.save(runner.completed(input.preparedId as string), input.saveKey as string)
              result = { ...saved, comparisonId: saved.comparison.id, viewTarget: { sourceId: source.sourceId, comparisonId: saved.comparison.id, workspace: 'pro-variable', visibility: 'reload-required' } }
              break
            }
            case 'po_comparisons_list': result = await repository.list({ ...pagination, favoriteId: input.favoriteId as string | undefined }); break
            case 'po_comparisons_get': result = await repository.get(input.comparisonId as string); break
            case 'po_comparisons_delete': write(); result = await repository.delete(input.comparisonId as string, input.expectedRevision as string); break
            case 'po_desktop_query':
            case 'po_desktop_mutate': result = await favoriteCall(name, input); break
            default: throw new BrowserBridgeError('UNKNOWN_TOOL')
          }
          assertActive()
          return result
        },
        dispose() { disposed = true; runner.dispose(); textRuns.dispose() },
      }
    },
  }
}
