import { describe, expect, it } from 'vitest'
import { canServeAppShell, hasOtherAppWindows, isPublicShellResponse, supportsPwa } from '../../src/pwa/policy'

describe('PWA platform boundaries', () => {
  const web = { production: true, secure: true, protocol: 'https:', electron: false, serviceWorker: true }
  it('allows secure production web and localhost, without intercepting development or native clients', () => {
    expect(supportsPwa(web)).toBe(true)
    expect(supportsPwa({ ...web, protocol: 'http:' })).toBe(true)
    for (const override of [{ production: false }, { secure: false }, { electron: true }, { protocol: 'file:' }, { protocol: 'chrome-extension:' }, { serviceWorker: false }]) {
      expect(supportsPwa({ ...web, ...override })).toBe(false)
    }
  })
})

describe('PWA shell cache boundaries', () => {
  const scope = 'https://example.test/optimizer/'
  const assets = new Set([`${scope}index.html`, `${scope}assets/app-abc.js`, `${scope}pwa/icon-192.png`])
  const request = (path: string, extra: Partial<Pick<Request, 'method' | 'headers' | 'mode'>> = {}) => ({
    url: new URL(path, scope).href, method: 'GET', headers: new Headers(), mode: 'cors' as RequestMode, ...extra,
  })
  it('serves exact build assets and the hash router entry', () => {
    expect(canServeAppShell(request('assets/app-abc.js'), scope, assets)).toBe(true)
    expect(canServeAppShell(request('./', { mode: 'navigate' }), scope, assets)).toBe(true)
    expect(canServeAppShell(request('index.html', { mode: 'navigate' }), scope, assets)).toBe(true)
  })
  it.each([
    'config.js', '__local_magpie/v1/chat/completions', 'v1/images/generations',
    'api/user', 'api/chat', 'assets/unknown.js', 'assets/app-abc.js?token=secret',
    'https://other.test/optimizer/assets/app-abc.js', '../',
  ])('does not intercept runtime, API or non-build resource %s', path => {
    expect(canServeAppShell(request(path, { mode: 'navigate' }), scope, assets)).toBe(false)
  })
  it('bypasses authorization, range, mutations and unexpected query strings even for a known asset', () => {
    for (const extra of [{ method: 'POST' }, { headers: new Headers({ Authorization: 'Bearer fixture' }) }, { headers: new Headers({ Range: 'bytes=0-2' }) }]) {
      expect(canServeAppShell(request('assets/app-abc.js', extra), scope, assets)).toBe(false)
    }
    expect(canServeAppShell(request('config.js'), scope, new Set([`${scope}config.js`]))).toBe(false)
    expect(canServeAppShell(request('./?token=fixture', { mode: 'navigate' }), scope, assets)).toBe(false)
  })
  it('refuses private, no-store, redirected, opaque and authentication responses', () => {
    const response = { ok: true, redirected: false, type: 'basic' as ResponseType, headers: new Headers() }
    expect(isPublicShellResponse(response)).toBe(true)
    for (const override of [
      { ok: false }, { redirected: true }, { type: 'opaque' as ResponseType },
      { headers: new Headers({ 'Cache-Control': 'private, max-age=60' }) },
      { headers: new Headers({ 'Cache-Control': 'no-store' }) },
      { headers: new Headers({ 'WWW-Authenticate': 'Basic realm=private' }) },
    ]) expect(isPublicShellResponse({ ...response, ...override })).toBe(false)
  })
  it('only blocks updates for other windows in this app scope', () => {
    const own = { id: 'current', url: `${scope}#/basic/system` }
    expect(hasOtherAppWindows([own], own.id, scope)).toBe(false)
    expect(hasOtherAppWindows([own, { id: 'other', url: `${scope}#/favorites` }], own.id, scope)).toBe(true)
    expect(hasOtherAppWindows([own, { id: 'other-app', url: 'https://example.test/another-app/' }], own.id, scope)).toBe(false)
  })
})
