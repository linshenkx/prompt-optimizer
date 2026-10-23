import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const precache = vi.hoisted(() => ({
  addToCacheList: vi.fn(), install: vi.fn(), activate: vi.fn(), matchPrecache: vi.fn(),
}))
vi.mock('workbox-precaching', () => ({ PrecacheController: class {
  addToCacheList = precache.addToCacheList
  install = precache.install
  activate = precache.activate
  matchPrecache = precache.matchPrecache
} }))

describe('production worker lifecycle', () => {
  const scope = 'https://example.test/optimizer/'
  let listeners: Record<string, (event: any) => void>
  let worker: { skipWaiting: ReturnType<typeof vi.fn>; clients: { matchAll: ReturnType<typeof vi.fn>; claim: ReturnType<typeof vi.fn> } }

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    listeners = {}
    worker = {
      skipWaiting: vi.fn().mockResolvedValue(undefined),
      clients: { matchAll: vi.fn().mockResolvedValue([{ id: 'current', url: `${scope}#/basic/system` }]), claim: vi.fn().mockResolvedValue(undefined) },
    }
    vi.stubGlobal('self', {
      ...worker,
      registration: { scope },
      __WB_MANIFEST: [{ url: 'index.html', revision: 'fixture' }, { url: 'assets/app-abc.js', revision: null }],
      addEventListener: (type: string, handler: (event: any) => void) => { listeners[type] = handler },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('online')))
    await import('../../src/pwa/sw')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('installs the app shell without activating an update automatically', async () => {
    const waitUntil = vi.fn()
    listeners.install({ waitUntil })
    await waitUntil.mock.calls[0][0]
    expect(precache.install).toHaveBeenCalledOnce()
    expect(worker.skipWaiting).not.toHaveBeenCalled()
    expect(worker.clients.claim).not.toHaveBeenCalled()
  })
  it('opens the cached entry document after a navigation network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('offline fixture'))
    const document = new Response('<div id="app"></div>')
    precache.matchPrecache.mockResolvedValue(document)
    const respondWith = vi.fn()
    listeners.fetch({ request: { method: 'GET', url: scope, mode: 'navigate', headers: new Headers() }, respondWith })
    expect(await respondWith.mock.calls[0][0]).toBe(document)
    expect(precache.matchPrecache).toHaveBeenCalledWith(`${scope}index.html`)
  })
  it('preserves an online auth rejection rather than bypassing it with the cached shell', async () => {
    const denied = new Response('authentication required', { status: 401 })
    vi.mocked(fetch).mockResolvedValue(denied)
    const respondWith = vi.fn()
    listeners.fetch({ request: { method: 'GET', url: scope, mode: 'navigate', headers: new Headers() }, respondWith })
    expect(await respondWith.mock.calls[0][0]).toBe(denied)
    expect(precache.matchPrecache).not.toHaveBeenCalled()
  })
  it.each(['config.js', '__local_magpie/v1/chat/completions', 'api/export'])('never handles %s', path => {
    const respondWith = vi.fn()
    listeners.fetch({ request: { method: 'GET', url: `${scope}${path}`, mode: 'cors', headers: new Headers() }, respondWith })
    expect(respondWith).not.toHaveBeenCalled()
    expect(precache.matchPrecache).not.toHaveBeenCalled()
  })
  it('activates only in response to the explicit saved-workspace handshake', async () => {
    const waitUntil = vi.fn()
    const postMessage = vi.fn()
    listeners.message({ data: { type: 'PROMPT_OPTIMIZER_APPLY_UPDATE' }, source: { id: 'current' }, ports: [{ postMessage }], waitUntil })
    await waitUntil.mock.calls[0][0]
    expect(postMessage).toHaveBeenCalledWith({ accepted: true })
    expect(worker.skipWaiting).toHaveBeenCalledOnce()
  })
  it('does not activate while another application window may contain unsaved work', async () => {
    worker.clients.matchAll.mockResolvedValue([{ id: 'current', url: scope }, { id: 'editing', url: `${scope}#/favorites` }])
    const waitUntil = vi.fn()
    const postMessage = vi.fn()
    listeners.message({ data: { type: 'PROMPT_OPTIMIZER_APPLY_UPDATE' }, source: { id: 'current' }, ports: [{ postMessage }], waitUntil })
    await waitUntil.mock.calls[0][0]
    expect(postMessage).toHaveBeenCalledWith({ accepted: false, reason: 'other-tabs' })
    expect(worker.skipWaiting).not.toHaveBeenCalled()
  })
})
