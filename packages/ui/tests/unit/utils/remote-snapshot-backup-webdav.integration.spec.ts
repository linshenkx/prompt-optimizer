import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AddressInfo } from 'node:net'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { FullImageData } from '@prompt-optimizer/core'

import { createRemoteObjectStore, type RemoteObjectStore } from '../../../src/utils/remote-backup'
import {
  analyzeRemoteSnapshotAssetCleanup,
  cleanupRemoteSnapshotAssets,
  createRemoteSnapshotBackup,
  listRemoteSnapshotBackups,
  restoreRemoteSnapshotBackup,
} from '../../../src/utils/remote-snapshot-backup'

const encode = (value: string): string => globalThis.btoa(value)

const createImage = (id: string, data: string): FullImageData => ({
  metadata: {
    id,
    mimeType: 'image/png',
    sizeBytes: data.length,
    createdAt: 1700000000000,
    accessedAt: 1700000000001,
    source: 'uploaded',
  },
  data: encode(data),
})

const createStorage = (images: FullImageData[]) => {
  const store = new Map(images.map((image) => [image.metadata.id, image]))
  return {
    store,
    listAllMetadata: vi.fn(async () => Array.from(store.values()).map((image) => image.metadata)),
    getImage: vi.fn(async (id: string) => store.get(id) ?? null),
    saveImage: vi.fn(async (image: FullImageData) => {
      store.set(image.metadata.id, image)
      return image.metadata.id
    }),
  }
}

type StoredWebDavFile = {
  bytes: Uint8Array
  contentType: string
  updatedAt: Date
}

type TestWebDavServer = {
  endpoint: string
  files: Map<string, StoredWebDavFile>
  setRemoteFile: (directory: string, remotePath: string, bytes: Uint8Array, updatedAt?: Date) => void
  close: () => Promise<void>
}

const normalizePathname = (path: string): string => {
  const normalized = decodeURIComponent(path.split('?')[0] || '/')
    .replace(/\/+/g, '/')
    .replace(/\/$/g, '')
  return normalized || '/'
}

const parentPathOf = (path: string): string => {
  const segments = normalizePathname(path).split('/').filter(Boolean)
  segments.pop()
  return segments.length ? `/${segments.join('/')}` : '/'
}

const pathSegments = (path: string): string[] =>
  normalizePathname(path).split('/').filter(Boolean)

const directChildrenOf = (
  directory: string,
  directories: Set<string>,
  files: Map<string, StoredWebDavFile>,
): Array<{ path: string; kind: 'directory' | 'file'; file?: StoredWebDavFile }> => {
  const base = normalizePathname(directory)
  const baseSegments = pathSegments(base)
  const children = new Map<string, { path: string; kind: 'directory' | 'file'; file?: StoredWebDavFile }>()

  for (const dir of directories) {
    if (dir === base) continue
    const segments = pathSegments(dir)
    if (segments.length !== baseSegments.length + 1) continue
    if (baseSegments.every((segment, index) => segment === segments[index])) {
      children.set(dir, { path: dir, kind: 'directory' })
    }
  }

  for (const [path, file] of files) {
    const segments = pathSegments(path)
    if (segments.length !== baseSegments.length + 1) continue
    if (baseSegments.every((segment, index) => segment === segments[index])) {
      children.set(path, { path, kind: 'file', file })
    }
  }

  return Array.from(children.values()).sort((a, b) => a.path.localeCompare(b.path))
}

const readRequestBody = async (request: IncomingMessage): Promise<Uint8Array> => {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return new Uint8Array(Buffer.concat(chunks))
}

const send = (
  response: ServerResponse,
  statusCode: number,
  body?: string | Uint8Array,
  headers?: Record<string, string>,
): void => {
  response.writeHead(statusCode, headers)
  response.end(body)
}

const createPropfindXml = (
  currentPath: string,
  children: Array<{ path: string; kind: 'directory' | 'file'; file?: StoredWebDavFile }>,
): string => {
  const responseFor = (path: string, kind: 'directory' | 'file', file?: StoredWebDavFile) => {
    const href = encodeURI(`${path}${kind === 'directory' ? '/' : ''}`)
    const props = kind === 'directory'
      ? '<D:resourcetype><D:collection/></D:resourcetype>'
      : [
          '<D:resourcetype/>',
          `<D:getcontentlength>${file?.bytes.byteLength ?? 0}</D:getcontentlength>`,
          `<D:getcontenttype>${file?.contentType ?? 'application/octet-stream'}</D:getcontenttype>`,
          `<D:getlastmodified>${(file?.updatedAt ?? new Date()).toUTCString()}</D:getlastmodified>`,
        ].join('')

    return [
      '<D:response>',
      `<D:href>${href}</D:href>`,
      '<D:propstat><D:prop>',
      props,
      '</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat>',
      '</D:response>',
    ].join('')
  }

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<D:multistatus xmlns:D="DAV:">',
    responseFor(currentPath, 'directory'),
    ...children.map((child) => responseFor(child.path, child.kind, child.file)),
    '</D:multistatus>',
  ].join('')
}

const startWebDavServer = async (): Promise<TestWebDavServer> => {
  const directories = new Set<string>(['/dav'])
  const files = new Map<string, StoredWebDavFile>()

  const server = createServer(async (request, response) => {
    try {
      const path = normalizePathname(new URL(request.url || '/', 'http://127.0.0.1').pathname)
      const method = request.method || 'GET'

      if (method === 'MKCOL') {
        if (directories.has(path)) {
          send(response, 405)
          return
        }
        directories.add(path)
        send(response, 201)
        return
      }

      if (method === 'PUT') {
        const bytes = await readRequestBody(request)
        directories.add(parentPathOf(path))
        files.set(path, {
          bytes,
          contentType: request.headers['content-type'] || 'application/octet-stream',
          updatedAt: new Date(),
        })
        send(response, 201)
        return
      }

      if (method === 'HEAD') {
        const file = files.get(path)
        if (!file) {
          send(response, 404)
          return
        }
        send(response, 200, undefined, {
          'Content-Length': String(file.bytes.byteLength),
          'Content-Type': file.contentType,
          'Last-Modified': file.updatedAt.toUTCString(),
        })
        return
      }

      if (method === 'GET') {
        const file = files.get(path)
        if (!file) {
          send(response, 404)
          return
        }
        send(response, 200, file.bytes, {
          'Content-Length': String(file.bytes.byteLength),
          'Content-Type': file.contentType,
          'Last-Modified': file.updatedAt.toUTCString(),
        })
        return
      }

      if (method === 'PROPFIND') {
        if (!directories.has(path)) {
          send(response, 404)
          return
        }
        send(response, 207, createPropfindXml(path, directChildrenOf(path, directories, files)), {
          'Content-Type': 'application/xml',
        })
        return
      }

      if (method === 'DELETE') {
        files.delete(path)
        for (const filePath of Array.from(files.keys())) {
          if (filePath.startsWith(`${path}/`)) files.delete(filePath)
        }
        for (const dir of Array.from(directories)) {
          if (dir === path || dir.startsWith(`${path}/`)) directories.delete(dir)
        }
        send(response, 204)
        return
      }

      send(response, 405)
    } catch (error) {
      send(response, 500, String((error as Error).message || error))
    }
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  const port = (server.address() as AddressInfo).port
  return {
    endpoint: `http://127.0.0.1:${port}/dav`,
    files,
    setRemoteFile: (directory, remotePath, bytes, updatedAt = new Date(0)) => {
      const fullPath = normalizePathname(`/dav/${directory}/${remotePath}`)
      files.set(fullPath, {
        bytes,
        contentType: 'image/png',
        updatedAt,
      })
    },
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => error ? reject(error) : resolve())
    }),
  }
}

describe('remote snapshot backup with real WebDAV object store', () => {
  let webdav: TestWebDavServer
  let objectStore: RemoteObjectStore

  beforeEach(async () => {
    webdav = await startWebDavServer()
    objectStore = createRemoteObjectStore({
      kind: 'webdav',
      endpoint: webdav.endpoint,
      username: '',
      password: '',
      directory: 'prompt-optimizer-backups',
    })
  })

  afterEach(async () => {
    await webdav.close()
  })

  it('round-trips app data, favorites, and image assets through WebDAV', async () => {
    const exported = await createRemoteSnapshotBackup({
      objectStore,
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { history: ['remote'] } })),
      },
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({ version: '1.0', favorites: [{ id: 'fav-1' }] })),
      },
      imageStorageService: createStorage([createImage('session-1', 'session-image')]),
      favoriteImageStorageService: createStorage([createImage('favorite-1', 'favorite-image')]),
    })

    await expect(listRemoteSnapshotBackups(objectStore)).resolves.toMatchObject([
      { id: exported.entry.id },
    ])

    const sessionTarget = createStorage([])
    const favoriteTarget = createStorage([])
    const importAllData = vi.fn(async () => {})
    const importFavorites = vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] }))

    const restoreReport = await restoreRemoteSnapshotBackup({
      objectStore,
      snapshotId: exported.entry.id,
      dataManager: { importAllData },
      favoriteManager: { importFavorites },
      imageStorageService: sessionTarget,
      favoriteImageStorageService: favoriteTarget,
      favoriteMergeStrategy: 'merge',
    })

    expect(restoreReport).toMatchObject({
      restored: 2,
      skipped: 0,
      missing: [],
      corrupt: [],
      errors: [],
      imported: {
        appData: true,
        favorites: true,
      },
    })
    expect(importAllData).toHaveBeenCalledWith(JSON.stringify({ version: 1, data: { history: ['remote'] } }))
    expect(importFavorites).toHaveBeenCalledWith(
      JSON.stringify({ version: '1.0', favorites: [{ id: 'fav-1' }] }),
      { mergeStrategy: 'merge', matchBy: 'id' },
    )
    expect(sessionTarget.store.get('session-1')?.data).toBe(encode('session-image'))
    expect(favoriteTarget.store.get('favorite-1')?.data).toBe(encode('favorite-image'))
  })

  it('does not write any local data when a WebDAV asset is corrupt', async () => {
    const exported = await createRemoteSnapshotBackup({
      objectStore,
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { models: ['safe'] } })),
      },
      favoriteManager: {
        exportFavorites: vi.fn(async () => JSON.stringify({ version: '1.0', favorites: [{ id: 'fav-1' }] })),
      },
      imageStorageService: createStorage([createImage('session-1', 'session-image')]),
      favoriteImageStorageService: createStorage([]),
    })
    webdav.setRemoteFile(
      'prompt-optimizer-backups',
      exported.manifest.assets[0].path,
      new TextEncoder().encode('corrupted-image-bytes'),
    )

    const importAllData = vi.fn(async () => {})
    const importFavorites = vi.fn(async () => ({ imported: 1, skipped: 0, errors: [] }))
    const target = createStorage([])

    await expect(restoreRemoteSnapshotBackup({
      objectStore,
      snapshotId: exported.entry.id,
      dataManager: { importAllData },
      favoriteManager: { importFavorites },
      imageStorageService: target,
      favoriteImageStorageService: createStorage([]),
    })).rejects.toThrow('Remote snapshot restore validation failed: corrupt=1')

    expect(target.saveImage).not.toHaveBeenCalled()
    expect(importAllData).not.toHaveBeenCalled()
    expect(importFavorites).not.toHaveBeenCalled()
  })

  it('cleans only old WebDAV assets that are not referenced by committed snapshots', async () => {
    const exported = await createRemoteSnapshotBackup({
      objectStore,
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: {} })),
      },
      favoriteManager: null,
      imageStorageService: createStorage([createImage('kept-image', 'kept-by-manifest')]),
      favoriteImageStorageService: createStorage([]),
      sections: {
        appData: false,
        favorites: false,
        imageCache: true,
        favoriteImages: false,
      },
    })
    const orphanPath = 'v1/assets/imageCache/orphan.png'
    webdav.setRemoteFile(
      'prompt-optimizer-backups',
      orphanPath,
      new Uint8Array([1, 2, 3]),
      new Date('2026-05-01T00:00:00.000Z'),
    )

    const analysis = await analyzeRemoteSnapshotAssetCleanup(objectStore, undefined, {
      now: new Date('2026-05-10T00:00:00.000Z'),
    })
    expect(analysis.candidates.map((candidate) => candidate.path)).toEqual([orphanPath])

    const cleanup = await cleanupRemoteSnapshotAssets(objectStore, undefined, {
      now: new Date('2026-05-10T00:00:00.000Z'),
    })
    expect(cleanup.deleted).toBe(1)
    expect(await objectStore.exists(orphanPath)).toBe(false)
    expect(await objectStore.exists(exported.manifest.assets[0].path)).toBe(true)
  })

  it('preserves assets referenced by any committed WebDAV snapshot during cleanup', async () => {
    const first = await createRemoteSnapshotBackup({
      objectStore,
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { snapshot: 1 } })),
      },
      favoriteManager: null,
      imageStorageService: createStorage([createImage('first-image', 'first-snapshot-image')]),
      favoriteImageStorageService: createStorage([]),
      sections: {
        appData: false,
        favorites: false,
        imageCache: true,
        favoriteImages: false,
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await createRemoteSnapshotBackup({
      objectStore,
      dataManager: {
        exportAllData: vi.fn(async () => JSON.stringify({ version: 1, data: { snapshot: 2 } })),
      },
      favoriteManager: null,
      imageStorageService: createStorage([createImage('second-image', 'second-snapshot-image')]),
      favoriteImageStorageService: createStorage([]),
      sections: {
        appData: false,
        favorites: false,
        imageCache: true,
        favoriteImages: false,
      },
    })
    const orphanPath = 'v1/assets/imageCache/old-orphan.png'
    webdav.setRemoteFile(
      'prompt-optimizer-backups',
      orphanPath,
      new Uint8Array([9, 9, 9]),
      new Date('2026-05-01T00:00:00.000Z'),
    )

    const cleanup = await cleanupRemoteSnapshotAssets(objectStore, undefined, {
      now: new Date('2026-05-10T00:00:00.000Z'),
    })

    expect(cleanup.deleted).toBe(1)
    expect(await objectStore.exists(orphanPath)).toBe(false)
    expect(await objectStore.exists(first.manifest.assets[0].path)).toBe(true)
    expect(await objectStore.exists(second.manifest.assets[0].path)).toBe(true)
  })
})
