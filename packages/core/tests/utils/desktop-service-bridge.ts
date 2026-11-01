import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { deserialize, serialize } from 'node:v8'
import { safeSerializeForIPC } from '../../src/utils/ipc-serialization'

const desktopFile = (name: string) => readFileSync(
  resolve(process.cwd(), '../desktop', name), 'utf8',
)

/** Execute the real preload and service handlers; only Electron's transport is simulated. */
export function createDesktopServiceBridge(services: Record<string, unknown>): unknown {
  const source = desktopFile('main.js')
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()
  const serializerStart = source.search(/function safeSerialize\(|const safeSerialize =/)
  const setupStart = source.indexOf('function setupIPC() {')
  const setupEnd = source.indexOf('// This method is called when Electron has finished initialization.')
  if (serializerStart < 0 || setupStart < 0 || setupEnd < 0) {
    throw new Error('Desktop service handler sections could not be located')
  }
  const errorResponse = (error: unknown) => ({ success: false, error })
  runInNewContext([
    source.slice(serializerStart, source.indexOf('let mainWindow;')),
    source.slice(setupStart, setupEnd),
    'setupIPC();',
  ].join('\n'), {
    ...services,
    safeSerializeForIPC,
    ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => handlers.set(channel, handler), on: () => {} },
    createSuccessResponse: (data: unknown) => ({ success: true, data }),
    createErrorResponse: errorResponse,
    createFavoriteErrorResponse: errorResponse,
    withModelNetwork: (handler: unknown) => handler,
    setupPreferenceHandlers: () => {},
    setupRemoteStorageHandlers: () => {},
    setupUpdateHandlers: () => {},
    console: { log: () => {}, warn: () => {}, error: () => {} },
  })

  let api: unknown
  runInNewContext(desktopFile('preload.js'), {
    require: (name: string) => {
      if (name !== 'electron') throw new Error(`Unexpected preload dependency: ${name}`)
      return {
        contextBridge: { exposeInMainWorld: (_name: string, value: unknown) => { api = value } },
        ipcRenderer: {
          invoke: async (channel: string, ...args: unknown[]) => {
            const handler = handlers.get(channel)
            if (!handler) throw new Error(`Desktop handler not registered: ${channel}`)
            // Electron IPC copies plain values with V8 structured-clone semantics, including undefined.
            const result = await handler(null, ...deserialize(serialize(args)))
            return deserialize(serialize(result))
          },
        },
      }
    },
    setTimeout,
    clearTimeout,
  })
  return api
}
