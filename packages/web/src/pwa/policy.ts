export interface PwaEnvironment {
  production: boolean
  secure: boolean
  protocol: string
  electron: boolean
  serviceWorker: boolean
}

export function supportsPwa(environment: PwaEnvironment): boolean {
  return environment.production && environment.secure && !environment.electron &&
    environment.serviceWorker && ['https:', 'http:'].includes(environment.protocol)
}

/** Only exact, build-listed static assets and the hash router's entry document. */
export function canServeAppShell(
  request: Pick<Request, 'url' | 'method' | 'headers' | 'mode'>,
  scope: string,
  assets: ReadonlySet<string>,
): boolean {
  if (request.method !== 'GET' || request.headers.has('authorization') || request.headers.has('range')) return false
  const url = new URL(request.url)
  const base = new URL(scope)
  if (url.origin !== base.origin || url.search || url.username || url.password) return false
  if (!url.pathname.startsWith(base.pathname)) return false
  // This exclusion remains explicit even if the build configuration changes.
  if (url.pathname === new URL('config.js', base).pathname) return false
  if (assets.has(url.href)) return true
  return request.mode === 'navigate' && url.pathname === base.pathname
}

/** Do not let a static-host auth response or personalized page enter the shell cache. */
export function isPublicShellResponse(response: Pick<Response, 'ok' | 'redirected' | 'headers' | 'type'>): boolean {
  return response.ok && !response.redirected && response.type !== 'opaque' &&
    !/\b(private|no-store)\b/i.test(response.headers.get('cache-control') || '') &&
    !response.headers.has('www-authenticate')
}

export function hasOtherAppWindows(clients: ReadonlyArray<{ id: string; url: string }>, sourceId: string, scope: string): boolean {
  const base = new URL(scope)
  return clients.some(client => {
    const url = new URL(client.url)
    return client.id !== sourceId && url.origin === base.origin && url.pathname.startsWith(base.pathname)
  })
}
