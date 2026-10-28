import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@prompt-optimizer/core', () => ({ getEnvVar: () => '' }))
import { createRemoteObjectStore } from '../../../src/utils/remote-backup'
import { listRemoteSnapshotBackups, REMOTE_SNAPSHOT_SCHEMA_VERSION } from '../../../src/utils/remote-snapshot-backup'
import type { RemoteObjectStore } from '../../../src/utils/remote-backup'

const directory = '<?xml version="1.0"?><D:multistatus xmlns:D="DAV:"><D:response><D:href>/dav/</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response></D:multistatus>'
const dav = () => createRemoteObjectStore({ kind: 'webdav', endpoint: 'https://dav.test/dav', directory: 'backups', username: 'u', password: 'p' })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('read-only remote listings', () => {
  it('checks a missing DAV folder using only PROPFIND', async () => {
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      expect(init.method).toBe('PROPFIND')
      return url === 'https://dav.test/dav/' ? new Response(directory, { status: 207 }) : new Response('', { status: 404 })
    })
    vi.stubGlobal('fetch', fetch)
    expect(await dav().list('v1/snapshots')).toEqual([])
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it.each([401, 403, 500])('does not mistake DAV HTTP %s for an empty backup', async status => {
    const fetch = vi.fn().mockResolvedValue(new Response('error', { status }))
    vi.stubGlobal('fetch', fetch)
    await expect(dav().list('')).rejects.toThrow()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('rejects a missing DAV endpoint or an HTML login page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response('', { status: 404 }))))
    await expect(dav().list('')).rejects.toThrow('endpoint lookup failed')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Login</html>')))
    await expect(dav().list('')).rejects.toThrow('directory listing')
  })
  it('propagates permission failures inside a DAV multistatus response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(directory.replace('200 OK', '403 Forbidden'), { status: 207 })))
    await expect(dav().list('')).rejects.toThrow('403 Forbidden')
  })
  it('propagates manifest transport errors without returning an empty backup', async () => {
    const store = { list: vi.fn().mockResolvedValue([{ path: 'v1/snapshots/a/manifest.json' }]),
      getText: vi.fn().mockRejectedValue(new Error('network failure')) } as unknown as RemoteObjectStore
    await expect(listRemoteSnapshotBackups(store)).rejects.toThrow('network failure')
  })
  it('reports unreadable manifests instead of pretending no backups exist', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = { list: vi.fn().mockResolvedValue([{ path: 'v1/snapshots/a/manifest.json' }]),
      getText: vi.fn().mockResolvedValue('invalid json') } as unknown as RemoteObjectStore
    await expect(listRemoteSnapshotBackups(store)).rejects.toThrow('No readable backup manifests')
  })
  it('keeps valid snapshots when only one manifest is malformed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = { list: vi.fn().mockResolvedValue([
      { path: 'v1/snapshots/a/manifest.json' }, { path: 'v1/snapshots/b/manifest.json' },
    ]), getText: vi.fn().mockResolvedValueOnce('bad').mockResolvedValueOnce(JSON.stringify({
      schemaVersion: REMOTE_SNAPSHOT_SCHEMA_VERSION, snapshotId: 'b', createdAt: '2026-10-28T00:00:00Z',
      appDataPath: 'v1/snapshots/b/data.json', favoritesPath: 'v1/snapshots/b/favorites.json', assets: [], missingAssets: [],
    })) } as unknown as RemoteObjectStore
    expect((await listRemoteSnapshotBackups(store)).map(entry => entry.id)).toEqual(['b'])
  })
})
