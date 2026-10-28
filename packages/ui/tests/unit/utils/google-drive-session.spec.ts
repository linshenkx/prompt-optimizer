import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const config = vi.hoisted(() => ({ clientId: '' }))
vi.mock('@prompt-optimizer/core', () => ({ getEnvVar: () => config.clientId }))
import {
  createRemoteObjectStore, GOOGLE_DRIVE_TOKEN_STORAGE_PREFIX,
  getGoogleDriveAuthorizationState, isGoogleDriveAuthorizationPersistent,
  saveRemoteBackupSettings,
} from '../../../src/utils/remote-backup'

const key = () => GOOGLE_DRIVE_TOKEN_STORAGE_PREFIX + config.clientId
const store = () => createRemoteObjectStore({ kind: 'google-drive' })
const seed = (expiresAt = Date.now() + 3600_000) => {
  const raw = JSON.stringify({ accessToken: 'private-test-token', expiresAt })
  localStorage.setItem(key(), raw)
  return raw
}
const google = (response: Record<string, unknown> = { access_token: 'new-test-token', expires_in: 3600 }) => {
  const request = vi.fn()
  vi.stubGlobal('google', { accounts: { oauth2: { initTokenClient: ({ callback }: any) => ({
    requestAccessToken() { request(); callback(response) },
  }) } } })
  return request
}

describe('Google Drive local authorization', () => {
  beforeEach(() => { config.clientId = `client-${crypto.randomUUID()}`; localStorage.clear() })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); localStorage.clear() })

  it('persists explicit authorization and reuses it in new stores without opening OAuth', async () => {
    const request = google()
    await store().authorize!()
    expect(JSON.parse(localStorage.getItem(key())!)).toMatchObject({ accessToken: 'new-test-token' })
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ files: [] })))
    vi.stubGlobal('fetch', fetch)
    await expect(store().list('v1/snapshots')).resolves.toEqual([])
    expect(request).toHaveBeenCalledTimes(1)
    expect(new Headers(fetch.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer new-test-token')
    expect(fetch.mock.calls.every(([, init]) => !init.method || init.method === 'GET')).toBe(true)
  })

  it('honors actual expiry without deleting the token or starting OAuth', async () => {
    vi.useFakeTimers(); vi.setSystemTime(100_000)
    const raw = seed(110_000)
    const request = google()
    expect(getGoogleDriveAuthorizationState()).toBe('ready')
    vi.setSystemTime(110_000)
    expect(getGoogleDriveAuthorizationState()).toBe('expired')
    await expect(store().list('')).rejects.toMatchObject({ reason: 'expired' })
    expect(localStorage.getItem(key())).toBe(raw)
    expect(request).not.toHaveBeenCalled()
  })

  it.each(['not-json', '{}', '{"accessToken":3,"expiresAt":9999999999999}'])('ignores malformed cache without removing it: %s', async raw => {
    localStorage.setItem(key(), raw)
    const request = google()
    expect(getGoogleDriveAuthorizationState()).toBe('missing')
    await expect(store().get('file')).rejects.toMatchObject({ reason: 'missing' })
    expect(localStorage.getItem(key())).toBe(raw)
    expect(request).not.toHaveBeenCalled()
  })

  it.each([401, 403])('preserves credentials and makes no authorization retry on HTTP %s', async status => {
    const raw = seed()
    const request = google()
    const fetch = vi.fn().mockResolvedValue(new Response('permission or quota error', { status }))
    vi.stubGlobal('fetch', fetch)
    const result = store().list('')
    if (status === 401) await expect(result).rejects.toMatchObject({ reason: 'rejected' })
    else await expect(result).rejects.toThrow('permission or quota error')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(request).not.toHaveBeenCalled()
    expect(localStorage.getItem(key())).toBe(raw)
  })

  it('preserves the old token when explicit authorization is cancelled', async () => {
    const raw = seed()
    google({ error: 'access_denied' })
    await expect(store().authorize!()).rejects.toThrow('access_denied')
    expect(localStorage.getItem(key())).toBe(raw)
  })

  it('keeps a page-only token if persistence is blocked', async () => {
    google()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    await store().authorize!()
    expect(getGoogleDriveAuthorizationState()).toBe('ready')
    expect(isGoogleDriveAuthorizationPersistent()).toBe(false)
    expect(localStorage.getItem(key())).toBeNull()
  })

  it('separates OAuth clients and excludes the token from connection settings', async () => {
    const raw = seed()
    saveRemoteBackupSettings({ provider: { kind: 'google-drive' } })
    expect(localStorage.getItem('prompt-optimizer:remote-backup-settings')).not.toContain('private-test-token')
    config.clientId += '-other'
    expect(getGoogleDriveAuthorizationState()).toBe('missing')
    expect(localStorage.getItem(key().replace('-other', ''))).toBe(raw)
  })

  it('detects access using only reads and never authorizes implicitly', async () => {
    const request = google()
    expect((await store().detect()).ok).toBe(false)
    expect(request).not.toHaveBeenCalled()
    seed()
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ files: [] })))
    vi.stubGlobal('fetch', fetch)
    expect(await store().detect()).toEqual({ ok: true, provider: 'google-drive', steps: [{ key: 'list', ok: true }] })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][1].method).toBeUndefined()
  })
})
