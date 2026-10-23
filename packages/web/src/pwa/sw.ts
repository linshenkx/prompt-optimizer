/// <reference lib="WebWorker" />
import { PrecacheController } from 'workbox-precaching'
import { canServeAppShell, hasOtherAppWindows, isPublicShellResponse } from './policy'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

const manifest = self.__WB_MANIFEST
const scope = self.registration.scope
const assets = new Set(manifest.map(entry => new URL(typeof entry === 'string' ? entry : entry.url, scope).href))
const entryUrl = new URL('index.html', scope).href
const precache = new PrecacheController({
  // A separate namespace per base path, without touching user data or other apps.
  cacheName: `prompt-optimizer-shell-${new URL(scope).pathname}`,
  plugins: [{
    cacheWillUpdate: async ({ response }) => isPublicShellResponse(response) ? response : null,
    // Build assets are public resources; installation never sends a session cookie.
    requestWillFetch: async ({ request }) => new Request(request, { credentials: 'omit', redirect: 'error' }),
  }],
})
precache.addToCacheList(manifest)

self.addEventListener('install', event => {
  // Never skip waiting on installation: updates are explicitly accepted in the UI.
  event.waitUntil(precache.install(event))
})
self.addEventListener('activate', event => {
  // Workbox only removes obsolete entries from this application's shell cache.
  event.waitUntil((async () => {
    await precache.activate(event)
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', event => {
  if (!canServeAppShell(event.request, scope, assets)) return
  if (event.request.mode === 'navigate') {
    // Preserve server access checks online. A network failure can open the local app shell.
    event.respondWith(fetch(event.request).catch(async () => {
      const cached = await precache.matchPrecache(entryUrl)
      return cached ?? Response.error()
    }))
    return
  }
  event.respondWith((async () => {
    const cached = await precache.matchPrecache(event.request.url)
    return cached ?? fetch(event.request)
  })())
})
self.addEventListener('message', event => {
  if (event.data?.type !== 'PROMPT_OPTIMIZER_APPLY_UPDATE' || !event.source || !('id' in event.source)) return
  const sourceId = event.source.id
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Another open tab could be generating or editing. Never take control behind its back.
    if (hasOtherAppWindows(clients, sourceId, scope)) {
      event.ports[0]?.postMessage({ accepted: false, reason: 'other-tabs' })
      return
    }
    event.ports[0]?.postMessage({ accepted: true })
    await self.skipWaiting()
  })())
})
