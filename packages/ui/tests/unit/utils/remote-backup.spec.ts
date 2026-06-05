import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

const awsS3Mocks = vi.hoisted(() => {
  const send = vi.fn()
  const clients: Array<{ config: Record<string, unknown> }> = []

  class S3Client {
    constructor(readonly config: Record<string, unknown>) {
      clients.push(this)
    }

    send(command: unknown) {
      return send(command)
    }
  }

  class HeadObjectCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }

  class PutObjectCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }

  class GetObjectCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }

  class ListObjectsV2Command {
    constructor(readonly input: Record<string, unknown>) {}
  }

  class DeleteObjectCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }

  return {
    clients,
    send,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
  }
})

vi.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand: awsS3Mocks.DeleteObjectCommand,
  GetObjectCommand: awsS3Mocks.GetObjectCommand,
  HeadObjectCommand: awsS3Mocks.HeadObjectCommand,
  ListObjectsV2Command: awsS3Mocks.ListObjectsV2Command,
  PutObjectCommand: awsS3Mocks.PutObjectCommand,
  S3Client: awsS3Mocks.S3Client,
}))

import {
  CLOUDFLARE_R2_DEFAULT_BACKUP_PREFIX,
  GOOGLE_DRIVE_DEFAULT_BACKUP_FOLDER_NAME,
  REMOTE_BACKUP_SETTINGS_KEY,
  createCloudflareR2CorsConfig,
  createRemoteObjectStore,
  createRemoteBackupFileName,
  createDefaultRemoteBackupProvider,
  createDefaultRemoteBackupSettings,
  getCloudflareR2DashboardLinks,
  getCloudflareR2Endpoint,
  getRecommendedRemoteBackupProvider,
  isGoogleDriveRemoteBackupAuthorized,
  loadRemoteBackupSettings,
  normalizeRemoteBackupSettings,
  resolveGoogleDriveClientId,
  saveRemoteBackupSettings,
  switchRemoteBackupProvider,
} from '../../../src/utils/remote-backup'

describe('remote backup settings', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    delete (window as unknown as { runtime_config?: Record<string, unknown> }).runtime_config
    delete (window as unknown as { electronAPI?: unknown }).electronAPI
    delete (globalThis as unknown as { google?: unknown }).google
    globalThis.fetch = originalFetch
    window.localStorage.clear()
    awsS3Mocks.clients.length = 0
    awsS3Mocks.send.mockReset()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('recommends Google Drive for web and initializes a default provider', () => {
    const settings = createDefaultRemoteBackupSettings('web')

    expect(getRecommendedRemoteBackupProvider('web')).toBe('google-drive')
    expect(settings.provider.kind).toBe('google-drive')
  })

  it('disables Google Drive for desktop remote backup defaults', () => {
    const settings = createDefaultRemoteBackupSettings('desktop')

    expect(getRecommendedRemoteBackupProvider('desktop')).toBe('cloudflare-r2')
    expect(settings.provider.kind).toBe('cloudflare-r2')
    expect(normalizeRemoteBackupSettings({
      provider: { kind: 'google-drive' },
    }, 'desktop').provider.kind).toBe('cloudflare-r2')
  })

  it('creates timestamp-only ZIP backup file names', () => {
    expect(createRemoteBackupFileName()).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.po-backup\.zip$/,
    )
  })

  it('normalizes S3-compatible settings', () => {
    const settings = normalizeRemoteBackupSettings({
      provider: {
        kind: 's3-compatible',
        endpoint: 'https://r2.example.test',
        region: '',
        bucket: 'po',
        accessKeyId: 'ak',
        secretAccessKey: 'sk',
        prefix: '',
        forcePathStyle: false,
      },
    }, 'web')

    expect(settings.provider).toMatchObject({
      kind: 's3-compatible',
      endpoint: 'https://r2.example.test',
      region: 'auto',
      bucket: 'po',
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
      prefix: 'prompt-optimizer-backups/',
      forcePathStyle: false,
    })
  })

  it('switches provider defaults without carrying incompatible credentials', () => {
    expect(createDefaultRemoteBackupProvider('google-drive')).toEqual({
      kind: 'google-drive',
    })

    expect(createDefaultRemoteBackupProvider('webdav')).toEqual({
      kind: 'webdav',
      endpoint: '',
      username: '',
      password: '',
      directory: 'prompt-optimizer-backups',
    })

    expect(createDefaultRemoteBackupProvider('cloudflare-r2')).toEqual({
      kind: 'cloudflare-r2',
      accountId: '',
      bucket: 'prompt-optimizer-backups',
      accessKeyId: '',
      secretAccessKey: '',
    })
  })

  it('normalizes Cloudflare R2 settings and derives its S3-compatible endpoint', () => {
    const settings = normalizeRemoteBackupSettings({
      provider: {
        kind: 'cloudflare-r2',
        accountId: 'account-123',
        bucket: '',
        accessKeyId: 'ak',
        secretAccessKey: 'sk',
        endpoint: 'ignored',
      },
    }, 'web')

    expect(settings.provider).toEqual({
      kind: 'cloudflare-r2',
      accountId: 'account-123',
      bucket: 'prompt-optimizer-backups',
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
    })
    expect(getCloudflareR2Endpoint('account-123')).toBe('https://account-123.r2.cloudflarestorage.com')
    expect(CLOUDFLARE_R2_DEFAULT_BACKUP_PREFIX).toBe('prompt-optimizer-backups/')
    expect(createRemoteObjectStore(settings.provider).provider).toBe('cloudflare-r2')
  })

  it('remembers provider-specific settings when switching backup providers', () => {
    const r2Settings = normalizeRemoteBackupSettings({
      provider: {
        kind: 'cloudflare-r2',
        accountId: 'account-123',
        bucket: 'po-r2',
        accessKeyId: 'r2-ak',
        secretAccessKey: 'r2-sk',
      },
    }, 'web')

    const s3Settings = switchRemoteBackupProvider(r2Settings, 's3-compatible')
    s3Settings.provider = {
      kind: 's3-compatible',
      endpoint: 'https://s3.example.test',
      region: 'auto',
      bucket: 'po-s3',
      accessKeyId: 's3-ak',
      secretAccessKey: 's3-sk',
      prefix: 'root/',
      forcePathStyle: true,
    }

    const switchedBackToR2 = switchRemoteBackupProvider(s3Settings, 'cloudflare-r2')

    expect(switchedBackToR2.provider).toMatchObject({
      kind: 'cloudflare-r2',
      accountId: 'account-123',
      bucket: 'po-r2',
      accessKeyId: 'r2-ak',
      secretAccessKey: 'r2-sk',
    })
    expect(switchedBackToR2.providers?.['s3-compatible']).toMatchObject({
      kind: 's3-compatible',
      endpoint: 'https://s3.example.test',
      secretAccessKey: 's3-sk',
    })
  })

  it('builds Cloudflare R2 dashboard links and browser CORS config', () => {
    expect(getCloudflareR2DashboardLinks('account-123')).toMatchObject({
      dashboard: 'https://dash.cloudflare.com/account-123/home/overview',
      buckets: 'https://dash.cloudflare.com/account-123/r2/overview',
      apiTokens: 'https://dash.cloudflare.com/account-123/r2/api-tokens',
    })
    expect(getCloudflareR2DashboardLinks('').buckets).toContain('/:account/r2/overview')

    const cors = JSON.parse(createCloudflareR2CorsConfig('https://app.example.com'))
    expect(cors[0].AllowedOrigins).toEqual([
      'http://localhost:18181',
      'http://127.0.0.1:18181',
      'https://prompt.always200.com',
      'https://app.example.com',
    ])
    expect(cors[0].AllowedMethods).toEqual(['GET', 'PUT', 'HEAD', 'DELETE'])
    expect(cors[0].ExposeHeaders).toEqual(['ETag'])
  })

  it('resolves Google Drive OAuth client id from app config only', () => {
    ;(window as unknown as { runtime_config: Record<string, unknown> }).runtime_config = {
      GOOGLE_DRIVE_CLIENT_ID: 'configured-client-id.apps.googleusercontent.com',
    }

    expect(resolveGoogleDriveClientId()).toBe('configured-client-id.apps.googleusercontent.com')
  })

  it('falls back to the bundled Google Drive Web OAuth client id', () => {
    expect(resolveGoogleDriveClientId()).toBe(
      '1056948847608-0gshmh967ei478h0ood6c8q2korb1ku8.apps.googleusercontent.com',
    )
  })

  it('normalizes legacy Google Drive folder settings to the fixed provider config', () => {
    const settings = normalizeRemoteBackupSettings({
      provider: {
        kind: 'google-drive',
        folderName: 'GlobalCloud XiaoC Backups',
      },
    }, 'web')

    expect(settings.provider).toEqual({ kind: 'google-drive' })
  })

  it('persists direct-provider credentials so backups keep working after refresh', () => {
    saveRemoteBackupSettings({
      provider: {
        kind: 'cloudflare-r2',
        accountId: 'account-id',
        bucket: 'po',
        accessKeyId: 'ak',
        secretAccessKey: 'r2-secret',
      },
    })
    expect(JSON.parse(window.localStorage.getItem(REMOTE_BACKUP_SETTINGS_KEY) || '{}')).toMatchObject({
      provider: {
        kind: 'cloudflare-r2',
        accountId: 'account-id',
        bucket: 'po',
        accessKeyId: 'ak',
        secretAccessKey: 'r2-secret',
      },
      providers: {
        'cloudflare-r2': {
          kind: 'cloudflare-r2',
          secretAccessKey: 'r2-secret',
        },
      },
    })

    saveRemoteBackupSettings({
      provider: {
        kind: 's3-compatible',
        endpoint: 'https://s3.example.test',
        region: 'auto',
        bucket: 'po',
        accessKeyId: 'ak',
        secretAccessKey: 's3-secret',
        prefix: 'root/',
        forcePathStyle: true,
      },
    })
    expect(JSON.parse(window.localStorage.getItem(REMOTE_BACKUP_SETTINGS_KEY) || '{}').provider)
      .toMatchObject({
        kind: 's3-compatible',
        secretAccessKey: 's3-secret',
      })

    saveRemoteBackupSettings({
      provider: {
        kind: 'webdav',
        endpoint: 'https://dav.example.test',
        username: 'user',
        password: 'dav-password',
        directory: 'prompt-optimizer-backups',
      },
    })
    expect(JSON.parse(window.localStorage.getItem(REMOTE_BACKUP_SETTINGS_KEY) || '{}').provider)
      .toMatchObject({
        kind: 'webdav',
        password: 'dav-password',
      })
  })

  it('loads legacy persisted provider secrets without clearing them', () => {
    window.localStorage.setItem(REMOTE_BACKUP_SETTINGS_KEY, JSON.stringify({
      provider: {
        kind: 's3-compatible',
        endpoint: 'https://s3.example.test',
        region: 'auto',
        bucket: 'po',
        accessKeyId: 'ak',
        secretAccessKey: 'legacy-secret',
        prefix: 'root/',
        forcePathStyle: true,
      },
    }))

    const settings = loadRemoteBackupSettings('web')

    expect(settings.provider).toMatchObject({
      kind: 's3-compatible',
      secretAccessKey: 'legacy-secret',
    })
    expect(JSON.parse(window.localStorage.getItem(REMOTE_BACKUP_SETTINGS_KEY) || '{}').provider)
      .toMatchObject({
        kind: 's3-compatible',
        secretAccessKey: 'legacy-secret',
      })
  })

  it('uses the AWS SDK S3 client for S3-compatible object operations', async () => {
    awsS3Mocks.send.mockImplementation(async (command: unknown) => {
      if (command instanceof awsS3Mocks.HeadObjectCommand) return {}
      if (command instanceof awsS3Mocks.PutObjectCommand) return {}
      if (command instanceof awsS3Mocks.GetObjectCommand) {
        return {
          Body: {
            transformToByteArray: async () => new Uint8Array([104, 105]),
          },
        }
      }
      if (command instanceof awsS3Mocks.ListObjectsV2Command) {
        return {
          Contents: [
            {
              Key: 'root/v1/manifest.json',
              LastModified: new Date('2026-05-07T00:00:00.000Z'),
              Size: 12,
            },
          ],
          IsTruncated: false,
        }
      }
      if (command instanceof awsS3Mocks.DeleteObjectCommand) return {}
      throw new Error('unexpected S3 command')
    })

    const objectStore = createRemoteObjectStore({
      kind: 's3-compatible',
      endpoint: 'https://r2.example.test',
      region: 'auto',
      bucket: 'po',
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
      prefix: 'root/',
      forcePathStyle: true,
    })

    await expect(objectStore.exists('v1/manifest.json')).resolves.toBe(true)
    await expect(objectStore.put('v1/manifest.json', '{"ok":true}', {
      contentType: 'application/json',
    })).resolves.toMatchObject({
      path: 'v1/manifest.json',
      sizeBytes: 11,
      contentType: 'application/json',
    })
    await expect(objectStore.getText('v1/manifest.json')).resolves.toBe('hi')
    await expect(objectStore.list('v1')).resolves.toEqual([
      {
        path: 'v1/manifest.json',
        sizeBytes: 12,
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
    ])
    await expect(objectStore.delete?.('v1/manifest.json')).resolves.toBeUndefined()

    expect(awsS3Mocks.clients[0].config).toMatchObject({
      endpoint: 'https://r2.example.test',
      region: 'auto',
      forcePathStyle: true,
      credentials: {
        accessKeyId: 'ak',
        secretAccessKey: 'sk',
      },
    })
    expect(awsS3Mocks.send.mock.calls.map(([command]) => command.constructor.name)).toEqual([
      'HeadObjectCommand',
      'PutObjectCommand',
      'GetObjectCommand',
      'ListObjectsV2Command',
      'DeleteObjectCommand',
    ])

    const [headCommand] = awsS3Mocks.send.mock.calls[0]
    expect((headCommand as InstanceType<typeof awsS3Mocks.HeadObjectCommand>).input).toMatchObject({
      Bucket: 'po',
      Key: 'root/v1/manifest.json',
    })

    const [putCommand] = awsS3Mocks.send.mock.calls[1]
    const putInput = (putCommand as InstanceType<typeof awsS3Mocks.PutObjectCommand>).input
    expect(putInput.Body).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(putInput.Body as Uint8Array)).toBe('{"ok":true}')
    expect(putInput.ContentType).toBe('application/json')

    const [listCommand] = awsS3Mocks.send.mock.calls[3]
    expect((listCommand as InstanceType<typeof awsS3Mocks.ListObjectsV2Command>).input).toMatchObject({
      Bucket: 'po',
      Prefix: 'root/v1/',
    })
  })

  it('uses desktop remote storage IPC for Desktop S3-compatible object operations', async () => {
    const requests: unknown[] = []
    const binaryBody = new Uint8Array([0, 1, 127, 128, 255])
    const invoke = vi.fn(async (request: {
      operation: string
      path?: string
      body?: unknown
      contentType?: string
      provider?: { kind?: string }
    }) => {
      requests.push(request)
      if (request.operation === 'put') {
        expect(ArrayBuffer.isView(request.body)).toBe(true)
        const body = request.body as Uint8Array
        expect(Array.from(body)).toEqual(Array.from(binaryBody))
        return {
          path: request.path,
          sizeBytes: body.byteLength,
          contentType: request.contentType,
        }
      }
      if (request.operation === 'get') {
        return new Uint8Array([111, 107]).buffer
      }
      if (request.operation === 'getText') return 'ok'
      if (request.operation === 'head') return { path: request.path, sizeBytes: 2 }
      if (request.operation === 'list') return [{ path: 'v1/manifest.json', sizeBytes: 2 }]
      if (request.operation === 'delete') return null
      return true
    })
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        remoteStorage: { invoke },
      },
    })

    const objectStore = createRemoteObjectStore({
      kind: 's3-compatible',
      endpoint: 'https://s3.example.test',
      region: 'auto',
      bucket: 'po',
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
      prefix: 'root/',
      forcePathStyle: true,
    }, 'desktop')

    await expect(objectStore.put('v1/assets/image.bin', binaryBody, {
      contentType: 'application/octet-stream',
    })).resolves.toMatchObject({
      path: 'v1/assets/image.bin',
      sizeBytes: binaryBody.byteLength,
      contentType: 'application/octet-stream',
    })
    await expect(objectStore.get('v1/manifest.json').then((buffer) => new TextDecoder().decode(buffer))).resolves.toBe('ok')
    await expect(objectStore.getText('v1/manifest.json')).resolves.toBe('ok')
    await expect(objectStore.head?.('v1/manifest.json')).resolves.toEqual({
      path: 'v1/manifest.json',
      sizeBytes: 2,
    })
    await expect(objectStore.list('v1')).resolves.toEqual([{ path: 'v1/manifest.json', sizeBytes: 2 }])
    await expect(objectStore.delete?.('v1/manifest.json')).resolves.toBeUndefined()

    expect(awsS3Mocks.clients).toHaveLength(0)
    expect(requests).toMatchObject([
      { operation: 'put', path: 'v1/assets/image.bin', provider: { kind: 's3-compatible' } },
      { operation: 'get', path: 'v1/manifest.json', provider: { kind: 's3-compatible' } },
      { operation: 'getText', path: 'v1/manifest.json', provider: { kind: 's3-compatible' } },
      { operation: 'head', path: 'v1/manifest.json', provider: { kind: 's3-compatible' } },
      { operation: 'list', path: 'v1', provider: { kind: 's3-compatible' } },
      { operation: 'delete', path: 'v1/manifest.json', provider: { kind: 's3-compatible' } },
    ])
  })

  it('uses desktop remote storage IPC for Desktop WebDAV and rejects Desktop Google Drive', async () => {
    const invoke = vi.fn(async (request: { operation: string }) => {
      if (request.operation === 'list') return []
      return null
    })
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        remoteStorage: { invoke },
      },
    })

    const webDavStore = createRemoteObjectStore({
      kind: 'webdav',
      endpoint: 'https://dav.example.test',
      username: 'user',
      password: 'pass',
      directory: 'prompt-optimizer-backups',
    }, 'desktop')

    await expect(webDavStore.list('v1')).resolves.toEqual([])
    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'list',
      path: 'v1',
      provider: expect.objectContaining({ kind: 'webdav' }),
    }))

    expect(() => createRemoteObjectStore({ kind: 'google-drive' }, 'desktop')).toThrow(
      'Google Drive remote backup is only supported in the Web version',
    )
  })

  it('sends plain provider config objects over desktop IPC when Vue state is reactive', async () => {
    const invoke = vi.fn(async (request: unknown) => {
      expect(() => structuredClone(request)).not.toThrow()
      return []
    })
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        remoteStorage: { invoke },
      },
    })

    const provider = reactive({
      kind: 'webdav' as const,
      endpoint: 'https://dav.example.test',
      username: 'user',
      password: 'pass',
      directory: 'prompt-optimizer-backups',
    })
    const objectStore = createRemoteObjectStore(provider, 'desktop')
    await expect(objectStore.list('v1')).resolves.toEqual([])

    const request = invoke.mock.calls[0]?.[0] as { provider: unknown }
    expect(request.provider).not.toBe(provider)
    expect(request.provider).toEqual({
      kind: 'webdav',
      endpoint: 'https://dav.example.test',
      username: 'user',
      password: 'pass',
      directory: 'prompt-optimizer-backups',
    })
  })

  it('maps Cloudflare R2 settings onto the AWS SDK S3 client', async () => {
    awsS3Mocks.send.mockResolvedValue({})

    const objectStore = createRemoteObjectStore({
      kind: 'cloudflare-r2',
      accountId: 'account-id',
      bucket: 'po',
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
    })

    await expect(objectStore.exists('v1/manifest.json')).resolves.toBe(true)

    expect(objectStore.provider).toBe('cloudflare-r2')
    expect(awsS3Mocks.clients[0].config).toMatchObject({
      endpoint: 'https://account-id.r2.cloudflarestorage.com',
      region: 'auto',
      forcePathStyle: true,
    })
    const [headCommand] = awsS3Mocks.send.mock.calls[0]
    expect((headCommand as InstanceType<typeof awsS3Mocks.HeadObjectCommand>).input).toMatchObject({
      Bucket: 'po',
      Key: 'prompt-optimizer-backups/v1/manifest.json',
    })
  })

  it('retries transient S3-compatible download body failures', async () => {
    let attempts = 0
    awsS3Mocks.send.mockImplementation(async (command: unknown) => {
      if (command instanceof awsS3Mocks.GetObjectCommand) {
        attempts += 1
        if (attempts === 1) {
          throw new TypeError('net::ERR_CONTENT_LENGTH_MISMATCH 200 (OK)')
        }
        return {
          Body: {
            transformToByteArray: async () => new Uint8Array([111, 107]),
          },
        }
      }
      return {}
    })

    const objectStore = createRemoteObjectStore({
      kind: 'cloudflare-r2',
      accountId: 'account-id',
      bucket: 'po',
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
    })

    await expect(objectStore.getText('v1/assets/image.png')).resolves.toBe('ok')
    expect(attempts).toBe(2)
  })

  it('returns Google Drive object metadata through the common head contract', async () => {
    const folderMimeType = 'application/vnd.google-apps.folder'
    ;(window as unknown as { runtime_config: Record<string, unknown> }).runtime_config = {
      GOOGLE_DRIVE_CLIENT_ID: 'metadata-client-id.apps.googleusercontent.com',
    }
    ;(globalThis as unknown as { google: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient: ({ callback }: { callback: (response: { access_token: string }) => void }) => ({
            requestAccessToken: () => callback({ access_token: 'access-token' }),
          }),
        },
      },
    }

    const lookupResponses = [
      [{ id: 'root-folder', name: GOOGLE_DRIVE_DEFAULT_BACKUP_FOLDER_NAME }],
      [{ id: 'v1-folder', mimeType: folderMimeType }],
      [{ id: 'assets-folder', mimeType: folderMimeType }],
      [{ id: 'image-cache-folder', mimeType: folderMimeType }],
      [{
        id: 'image-file',
        mimeType: 'image/png',
        size: '1234',
        modifiedTime: '2026-05-07T00:00:00.000Z',
      }],
    ]
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ files: lookupResponses.shift() ?? [] }), {
        headers: { 'Content-Type': 'application/json' },
      }))
    globalThis.fetch = fetchMock as typeof fetch

    const objectStore = createRemoteObjectStore({ kind: 'google-drive' })

    await expect(objectStore.head?.('v1/assets/imageCache/test.png')).resolves.toEqual({
      path: 'v1/assets/imageCache/test.png',
      sizeBytes: 1234,
      updatedAt: '2026-05-07T00:00:00.000Z',
      contentType: 'image/png',
    })
  })

  it('lists every Google Drive page before returning recursive entries', async () => {
    const folderMimeType = 'application/vnd.google-apps.folder'
    ;(window as unknown as { runtime_config: Record<string, unknown> }).runtime_config = {
      GOOGLE_DRIVE_CLIENT_ID: 'pagination-client-id.apps.googleusercontent.com',
    }
    ;(globalThis as unknown as { google: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient: ({ callback }: { callback: (response: { access_token: string }) => void }) => ({
            requestAccessToken: () => callback({ access_token: 'access-token' }),
          }),
        },
      },
    }

    const requestedSnapshotPageTokens: Array<string | null> = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const query = url.searchParams.get('q') || ''

      if (query.includes(`name='${GOOGLE_DRIVE_DEFAULT_BACKUP_FOLDER_NAME}'`)) {
        return new Response(JSON.stringify({
          files: [{ id: 'root-folder', name: GOOGLE_DRIVE_DEFAULT_BACKUP_FOLDER_NAME }],
        }), { headers: { 'Content-Type': 'application/json' } })
      }

      if (query.includes("'root-folder' in parents") && query.includes("name='v1'")) {
        return new Response(JSON.stringify({
          files: [{ id: 'v1-folder', mimeType: folderMimeType }],
        }), { headers: { 'Content-Type': 'application/json' } })
      }

      if (query.includes("'v1-folder' in parents") && query.includes("name='snapshots'")) {
        return new Response(JSON.stringify({
          files: [{ id: 'snapshots-folder', mimeType: folderMimeType }],
        }), { headers: { 'Content-Type': 'application/json' } })
      }

      if (query.includes("'snapshots-folder' in parents")) {
        const pageToken = url.searchParams.get('pageToken')
        requestedSnapshotPageTokens.push(pageToken)
        return new Response(JSON.stringify(pageToken === 'page-2'
          ? {
              files: [{ id: 'snap-b-folder', name: 'snap-b', mimeType: folderMimeType }],
            }
          : {
              files: [{ id: 'snap-a-folder', name: 'snap-a', mimeType: folderMimeType }],
              nextPageToken: 'page-2',
            }), { headers: { 'Content-Type': 'application/json' } })
      }

      if (query.includes("'snap-a-folder' in parents")) {
        return new Response(JSON.stringify({
          files: [{
            id: 'manifest-a',
            name: 'manifest.json',
            mimeType: 'application/json',
            size: '10',
            modifiedTime: '2026-05-07T00:00:00.000Z',
          }],
        }), { headers: { 'Content-Type': 'application/json' } })
      }

      if (query.includes("'snap-b-folder' in parents")) {
        return new Response(JSON.stringify({
          files: [{
            id: 'manifest-b',
            name: 'manifest.json',
            mimeType: 'application/json',
            size: '20',
            modifiedTime: '2026-05-08T00:00:00.000Z',
          }],
        }), { headers: { 'Content-Type': 'application/json' } })
      }

      return new Response(JSON.stringify({ files: [] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    })
    globalThis.fetch = fetchMock as typeof fetch

    const objectStore = createRemoteObjectStore({ kind: 'google-drive' })

    await expect(objectStore.list('v1/snapshots')).resolves.toEqual([
      {
        path: 'v1/snapshots/snap-a/manifest.json',
        sizeBytes: 10,
        updatedAt: '2026-05-07T00:00:00.000Z',
        contentType: 'application/json',
      },
      {
        path: 'v1/snapshots/snap-b/manifest.json',
        sizeBytes: 20,
        updatedAt: '2026-05-08T00:00:00.000Z',
        contentType: 'application/json',
      },
    ])
    expect(requestedSnapshotPageTokens).toEqual([null, 'page-2'])
  })

  it('retries transient Google Drive media download failures', async () => {
    const folderMimeType = 'application/vnd.google-apps.folder'
    ;(window as unknown as { runtime_config: Record<string, unknown> }).runtime_config = {
      GOOGLE_DRIVE_CLIENT_ID: 'retry-client-id.apps.googleusercontent.com',
    }
    ;(globalThis as unknown as { google: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient: ({ callback }: { callback: (response: { access_token: string }) => void }) => ({
            requestAccessToken: () => callback({ access_token: 'access-token' }),
          }),
        },
      },
    }

    const lookupResponses = [
      [{ id: 'root-folder', name: GOOGLE_DRIVE_DEFAULT_BACKUP_FOLDER_NAME }],
      [{ id: 'v1-folder', mimeType: folderMimeType }],
      [{ id: 'assets-folder', mimeType: folderMimeType }],
      [{ id: 'image-cache-folder', mimeType: folderMimeType }],
      [{ id: 'image-file', mimeType: 'image/png' }],
    ]
    let mediaAttempts = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('alt=media')) {
        mediaAttempts += 1
        if (mediaAttempts === 1) {
          throw new TypeError('Failed to fetch')
        }
        return new Response(new Uint8Array([1, 2, 3]))
      }

      return new Response(JSON.stringify({ files: lookupResponses.shift() ?? [] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    })
    globalThis.fetch = fetchMock as typeof fetch

    const objectStore = createRemoteObjectStore({ kind: 'google-drive' })
    const bytes = new Uint8Array(await objectStore.get('v1/assets/imageCache/test.png'))

    expect(Array.from(bytes)).toEqual([1, 2, 3])
    expect(mediaAttempts).toBe(2)
  })

  it('refreshes expired Google Drive access tokens before reuse', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T00:00:00.000Z'))

    ;(window as unknown as { runtime_config: Record<string, unknown> }).runtime_config = {
      GOOGLE_DRIVE_CLIENT_ID: 'expiry-client-id.apps.googleusercontent.com',
    }
    const requestAccessToken = vi.fn()
    const tokenResponses = ['first-token', 'second-token']
    ;(globalThis as unknown as { google: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient: ({ callback }: {
            callback: (response: { access_token: string; expires_in: number }) => void
          }) => ({
            requestAccessToken: () => {
              requestAccessToken()
              callback({
                access_token: tokenResponses.shift() || 'fallback-token',
                expires_in: 120,
              })
            },
          }),
        },
      },
    }

    const objectStore = createRemoteObjectStore({ kind: 'google-drive' })

    await objectStore.authorize?.()
    expect(isGoogleDriveRemoteBackupAuthorized()).toBe(true)

    vi.setSystemTime(new Date('2026-05-07T00:01:01.000Z'))
    expect(isGoogleDriveRemoteBackupAuthorized()).toBe(false)

    await objectStore.authorize?.()

    expect(requestAccessToken).toHaveBeenCalledTimes(2)
    expect(isGoogleDriveRemoteBackupAuthorized()).toBe(true)
  })

  it('clears stale Google Drive tokens and retries authorization failures once', async () => {
    const folderMimeType = 'application/vnd.google-apps.folder'
    ;(window as unknown as { runtime_config: Record<string, unknown> }).runtime_config = {
      GOOGLE_DRIVE_CLIENT_ID: 'auth-retry-client-id.apps.googleusercontent.com',
    }
    const requestAccessToken = vi.fn()
    const tokenResponses = ['first-token', 'second-token']
    ;(globalThis as unknown as { google: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient: ({ callback }: {
            callback: (response: { access_token: string; expires_in: number }) => void
          }) => ({
            requestAccessToken: () => {
              requestAccessToken()
              callback({
                access_token: tokenResponses.shift() || 'fallback-token',
                expires_in: 3600,
              })
            },
          }),
        },
      },
    }

    const lookupResponses = [
      [{ id: 'root-folder', name: GOOGLE_DRIVE_DEFAULT_BACKUP_FOLDER_NAME }],
      [{ id: 'v1-folder', mimeType: folderMimeType }],
      [{ id: 'assets-folder', mimeType: folderMimeType }],
      [{ id: 'image-cache-folder', mimeType: folderMimeType }],
      [{ id: 'image-file', mimeType: 'image/png' }],
    ]
    const mediaAuthorizations: string[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('alt=media')) {
        const authorization = new Headers(init?.headers).get('Authorization') || ''
        mediaAuthorizations.push(authorization)
        if (authorization === 'Bearer first-token') {
          return new Response('expired', { status: 401, statusText: 'Unauthorized' })
        }
        return new Response(new Uint8Array([4, 5, 6]))
      }

      return new Response(JSON.stringify({ files: lookupResponses.shift() ?? [] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    })
    globalThis.fetch = fetchMock as typeof fetch

    const objectStore = createRemoteObjectStore({ kind: 'google-drive' })
    const bytes = new Uint8Array(await objectStore.get('v1/assets/imageCache/test.png'))

    expect(Array.from(bytes)).toEqual([4, 5, 6])
    expect(requestAccessToken).toHaveBeenCalledTimes(2)
    expect(mediaAuthorizations).toEqual(['Bearer first-token', 'Bearer second-token'])
  })
})
