import { v4 as randomUUID } from 'uuid'
import type { IStorageProvider } from '../storage/types'
import type { ComparisonExecutionSource } from '../text-comparison/types'
import type { BusinessStorage } from '../mcp-business/services'
import { canonical } from '../text-comparison/validation'
import { hashText } from '../../utils/portable-crypto'
import { assertBridgeJson, BrowserBridgeError, type BrowserAccess } from './protocol'
import { createProductBusiness } from '../mcp-business/session'

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

function browserStorage(storage: IStorageProvider): BusinessStorage {
  const candidate = storage as Partial<BusinessStorage>
  if (!candidate.getAllEntries || !candidate.getEntriesByPrefix || !candidate.withWriteTransaction || !candidate.compareAndSetItem) {
    throw new BrowserBridgeError('SOURCE_NOT_READY')
  }
  return storage as BusinessStorage
}

// A database connection also acts as an origin-wide lifetime marker on HTTP pages
// where Web Locks are unavailable. The browser closes it when the page crashes.
function runOwner(id: string) {
  const name = (generation: string) => 'po:browser-run-owner:' + generation
  const locks = globalThis.navigator?.locks
  let release: (() => void) | undefined
  let ready: Promise<void> | undefined

  function acquire() {
    return ready ??= new Promise<void>((resolve, reject) => {
      if (locks) {
        const lifetime = new Promise<void>(done => { release = done })
        void locks.request(name(id), () => { resolve(); return lifetime }).catch(reject)
      } else {
        const request = indexedDB.open(name(id))
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          release = () => { request.result.close(); indexedDB.deleteDatabase(name(id)) }
          resolve()
        }
      }
    })
  }

  // Concurrent delete requests queue behind the first blocked probe. An
  // unresolved probe is treated as live until IndexedDB confirms deletion.
  const probes = new Map<string, Promise<boolean>>()
  async function isGone(generation: string) {
    if (locks) return !(await locks.query()).held?.some(lock => lock.name === name(generation))
    const pending = probes.get(generation)
    if (pending) return pending
    const probe = new Promise<boolean>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name(generation))
      const timer = setTimeout(() => resolve(false), 250)
      request.onblocked = () => { clearTimeout(timer); resolve(false) }
      request.onerror = () => { clearTimeout(timer); probes.delete(generation); reject(request.error) }
      request.onsuccess = () => { clearTimeout(timer); probes.set(generation, Promise.resolve(true)); resolve(true) }
    })
    probes.set(generation, probe)
    return probe
  }

  return { id, acquire, isGone, async release() { await ready; release?.() } }
}

export function createBrowserBridgeHost({ storage: inputStorage }: { storage: IStorageProvider }): BrowserBridgeHost {
  const storage = browserStorage(inputStorage)
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
      const owner = runOwner(source.connectionGeneration)
      let disposed = false
      const assertActive = () => { if (disposed) throw new BrowserBridgeError('CONNECTION_CLOSED') }
      const business = createProductBusiness(storage, source.sourceId, {
        owner,
        assertActive,
        guardedStorageKeys: [CONTEXT_KEY],
      })
      return {
        async call(name, input) {
          assertActive()
          if (access === 'business') await owner.acquire()
          assertActive()
          assertBridgeJson(input)
          if (await storage.getItem(CONTEXT_KEY) !== contextId) throw new BrowserBridgeError('SOURCE_CONTEXT_CHANGED')
          if (name !== 'product') throw new BrowserBridgeError('UNKNOWN_TOOL')
          let result: unknown
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
              assertActive()
              return result
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
              assertActive()
              return result
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
            result = await business.call(method, fields, access !== 'business')
          }
          assertActive()
          return result
        },
        dispose() {
          if (disposed) return
          disposed = true
          void business.close().finally(owner.release).catch(() => {})
        },
      }
    },
  }
}
