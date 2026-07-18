import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** 读取桌面跨层契约测试需要检查的源码文本。 */
const readText = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

/** 从一组正则中收集去重后的 IPC channel 或事件常量。 */
const collectMatches = (text, patterns) => {
  const matches = new Set()
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      matches.add(match[1])
    }
  }
  return matches
}

test('desktop preload IPC channels have main-process handlers', () => {
  const preload = readText('packages/desktop/preload.js')
  const main = [
    readText('packages/desktop/main.js'),
    readText('packages/desktop/remote-storage.js'),
    readText('packages/desktop/config/ipc/llm-handlers.js'),
    readText('packages/desktop/config/ipc/prompt-stream-handlers.js'),
    readText('packages/desktop/config/ipc/prompt-sync-handlers.js'),
    readText('packages/desktop/config/ipc/model-handlers.js'),
    readText('packages/desktop/config/ipc/image-handlers.js'),
    readText('packages/desktop/config/ipc/template-handlers.js'),
    readText('packages/desktop/config/ipc/history-handlers.js'),
    readText('packages/desktop/config/ipc/favorite-handlers.js'),
    readText('packages/desktop/config/ipc/context-handlers.js'),
    readText('packages/desktop/config/ipc/data-handlers.js'),
    readText('packages/desktop/config/ipc/preference-handlers.js'),
    readText('packages/desktop/config/ipc/system-handlers.js'),
    readText('packages/desktop/config/ipc/update-handlers.js'),
  ].join('\n')

  const preloadChannels = collectMatches(preload, [
    /ipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/g,
    /invokeFavorite\(\s*['"]([^'"]+)['"]/g,
  ])
  for (const eventName of collectMatches(preload, [
    /ipcRenderer\.invoke\(\s*IPC_EVENTS\.([A-Z0-9_]+)/g,
  ])) {
    preloadChannels.add(`IPC_EVENTS.${eventName}`)
  }

  const mainHandlers = collectMatches(main, [
    /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g,
    /registerSensitiveIpc\(\s*['"]([^'"]+)['"]/g,
  ])
  for (const eventName of collectMatches(main, [
    /ipcMain\.handle\(\s*IPC_EVENTS\.([A-Z0-9_]+)/g,
  ])) {
    mainHandlers.add(`IPC_EVENTS.${eventName}`)
  }

  const missingHandlers = [...preloadChannels]
    .filter(channel => !mainHandlers.has(channel))
    .sort()

  assert.deepEqual(missingHandlers, [])
})

test('desktop streaming contract exposes an owner-bound cancellation channel', () => {
  const preload = readText('packages/desktop/preload.js')
  const llmModule = readText('packages/desktop/config/ipc/llm-handlers.js')

  assert.match(preload, /cancelStream:\s*async\s*\(streamId\)/)
  assert.match(preload, /ipcRenderer\.invoke\('stream-cancel', streamId\)/)
  assert.match(llmModule, /registerSensitiveIpc\(\s*'stream-cancel'/)
})

test('desktop composition root delegates domain handlers to backend modules', () => {
  const main = readText('packages/desktop/main.js')
  const llmModule = readText('packages/desktop/config/ipc/llm-handlers.js')
  const promptStreamModule = readText('packages/desktop/config/ipc/prompt-stream-handlers.js')
  const promptSyncModule = readText('packages/desktop/config/ipc/prompt-sync-handlers.js')
  const modelModule = readText('packages/desktop/config/ipc/model-handlers.js')
  const imageModule = readText('packages/desktop/config/ipc/image-handlers.js')
  const templateModule = readText('packages/desktop/config/ipc/template-handlers.js')
  const historyModule = readText('packages/desktop/config/ipc/history-handlers.js')
  const favoriteModule = readText('packages/desktop/config/ipc/favorite-handlers.js')
  const contextModule = readText('packages/desktop/config/ipc/context-handlers.js')
  const dataModule = readText('packages/desktop/config/ipc/data-handlers.js')
  const preferenceModule = readText('packages/desktop/config/ipc/preference-handlers.js')
  const systemModule = readText('packages/desktop/config/ipc/system-handlers.js')

  assert.match(main, /registerLlmIpcHandlers\(/)
  assert.match(main, /registerPromptStreamIpcHandlers\(/)
  assert.match(main, /registerPromptSyncIpcHandlers\(/)
  assert.match(main, /registerModelIpcHandlers\(/)
  assert.match(main, /registerImageIpcHandlers\(/)
  assert.match(main, /registerTemplateIpcHandlers\(/)
  assert.match(main, /registerHistoryIpcHandlers\(/)
  assert.match(main, /registerFavoriteIpcHandlers\(/)
  assert.match(main, /registerContextIpcHandlers\(/)
  assert.match(main, /registerDataIpcHandlers\(/)
  assert.match(main, /registerPreferenceIpcHandlers\(/)
  assert.match(main, /registerSystemIpcHandlers\(/)
  assert.match(main, /createUpdateHandlers\(/)
  assert.doesNotMatch(main, /registerSensitiveIpc\(\s*'llm-/)
  assert.doesNotMatch(main, /registerSensitiveIpc\(\s*'prompt-[^']*Stream'/)
  assert.doesNotMatch(main, /ipcMain\.handle\(\s*'model-/)
  assert.doesNotMatch(main, /ipcMain\.handle\(\s*'image-/)
  assert.doesNotMatch(main, /ipcMain\.handle\(\s*'template-/)
  assert.doesNotMatch(main, /ipcMain\.handle\(\s*'history-/)
  assert.doesNotMatch(main, /ipcMain\.handle\(\s*'favorite-/)
  assert.doesNotMatch(main, /ipcMain\.handle\(\s*'context-/)
  assert.doesNotMatch(main, /ipcMain\.handle\(\s*'data-/)
  assert.doesNotMatch(main, /ipcMain\.handle\(\s*'preference-/)
  assert.doesNotMatch(main, /ipcMain\.handle\(\s*'prompt-/)
  assert.doesNotMatch(main, /ipcMain\.handle\(\s*'app-/)
  assert.doesNotMatch(main, /ipcMain\.handle\(\s*'logs-/)
  assert.doesNotMatch(main, /async function setupUpdateHandlers/)
  assert.match(llmModule, /registerSensitiveIpc\(\s*'llm-sendMessage'/)
  assert.match(promptStreamModule, /registerSensitiveIpc\(\s*'prompt-optimizePromptStream'/)
  assert.match(promptSyncModule, /ipcMain\.handle\(\s*'prompt-optimizePrompt'/)
  assert.match(modelModule, /ipcMain\.handle\(\s*'model-getAllModels'/)
  assert.match(imageModule, /ipcMain\.handle\(\s*'image-generate'/)
  assert.match(templateModule, /ipcMain\.handle\(\s*'template-getTemplates'/)
  assert.match(historyModule, /ipcMain\.handle\(\s*'history-getHistory'/)
  assert.match(favoriteModule, /ipcMain\.handle\(\s*'favorite-addFavorite'/)
  assert.match(contextModule, /ipcMain\.handle\(\s*'context-list'/)
  assert.match(dataModule, /ipcMain\.handle\(\s*'data-exportAllData'/)
  assert.match(preferenceModule, /ipcMain\.handle\(\s*'preference-get'/)
  assert.match(systemModule, /registerSensitiveIpc\(\s*'config-getEnvironmentVariables'/)
  const updateModule = readText('packages/desktop/config/ipc/update-handlers.js')
  assert.match(updateModule, /function createUpdateHandlers/)
  assert.match(updateModule, /IPC_EVENTS\.UPDATE_CHECK|updater-check-update/)
})

test('desktop channel manifest covers registered domain invoke channels', () => {
  // channel-manifest 是 CommonJS；契约测试通过 createRequire 读取。
  const {
    ALL_DOMAIN_CHANNELS,
    MODEL_CHANNELS,
    IMAGE_CHANNELS,
    TEMPLATE_CHANNELS,
    HISTORY_CHANNELS,
    CONTEXT_CHANNELS,
    FAVORITE_CHANNELS,
    DATA_CHANNELS,
    PREFERENCE_CHANNELS,
    PROMPT_CHANNELS,
    LLM_CHANNELS,
    SYSTEM_CHANNELS,
    UPDATE_CHANNELS,
    IPC_PROTOCOL_VERSION,
    isKnownInvokeChannel,
    assertKnownInvokeChannel,
    getChannelMeta,
  } = require('../packages/desktop/config/ipc/channel-manifest.js')

  assert.equal(new Set(ALL_DOMAIN_CHANNELS).size, ALL_DOMAIN_CHANNELS.length)
  assert.ok(MODEL_CHANNELS.includes('model-getAllModels'))
  assert.ok(IMAGE_CHANNELS.includes('image-generate'))
  assert.ok(TEMPLATE_CHANNELS.includes('template-getTemplates'))
  assert.ok(HISTORY_CHANNELS.includes('history-getHistory'))
  assert.ok(CONTEXT_CHANNELS.includes('context-list'))
  assert.ok(FAVORITE_CHANNELS.includes('favorite-addFavorite'))
  assert.ok(DATA_CHANNELS.includes('data-exportAllData'))
  assert.ok(PREFERENCE_CHANNELS.includes('preference-get'))
  assert.ok(PROMPT_CHANNELS.includes('prompt-optimizePromptStream'))
  assert.ok(LLM_CHANNELS.includes('stream-cancel'))
  assert.ok(SYSTEM_CHANNELS.includes('shell-openExternal'))
  assert.ok(UPDATE_CHANNELS.includes('updater-check-update'))
  assert.match(String(IPC_PROTOCOL_VERSION), /^\d+\.\d+\.\d+$/)
  assert.equal(isKnownInvokeChannel('llm-sendMessage'), true)
  assert.equal(getChannelMeta('llm-sendMessageStream')?.kind, 'stream')
  assert.throws(() => assertKnownInvokeChannel('definitely-not-a-channel'), /Unknown IPC invoke channel/)

  const handlerSources = [
    readText('packages/desktop/config/ipc/llm-handlers.js'),
    readText('packages/desktop/config/ipc/prompt-stream-handlers.js'),
    readText('packages/desktop/config/ipc/prompt-sync-handlers.js'),
    readText('packages/desktop/config/ipc/model-handlers.js'),
    readText('packages/desktop/config/ipc/image-handlers.js'),
    readText('packages/desktop/config/ipc/template-handlers.js'),
    readText('packages/desktop/config/ipc/history-handlers.js'),
    readText('packages/desktop/config/ipc/favorite-handlers.js'),
    readText('packages/desktop/config/ipc/context-handlers.js'),
    readText('packages/desktop/config/ipc/data-handlers.js'),
    readText('packages/desktop/config/ipc/preference-handlers.js'),
    readText('packages/desktop/config/ipc/system-handlers.js'),
    readText('packages/desktop/config/ipc/update-handlers.js'),
  ].join('\n')

  const registered = collectMatches(handlerSources, [
    /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g,
    /registerSensitiveIpc\(\s*['"]([^'"]+)['"]/g,
    /ipcMain\.handle\(\s*IPC_EVENTS\.([A-Z0-9_]+)/g,
  ])
  // update handlers register via IPC_EVENTS.X; map those keys to string channels
  const { IPC_EVENTS } = require('../packages/desktop/config/constants.js')
  for (const [key, value] of Object.entries(IPC_EVENTS)) {
    if (registered.has(key)) registered.add(value)
  }

  const missingInHandlers = ALL_DOMAIN_CHANNELS.filter((channel) => !registered.has(channel)).sort()
  assert.deepEqual(missingInHandlers, [])
})

test('desktop remote storage handler routes S3-compatible operations through AWS SDK commands', async () => {
  const { handleRemoteStorageOperation } = await import('../packages/desktop/remote-storage.js')
  const sentCommands = []

  class S3Client {
    constructor(config) {
      this.config = config
    }

    async send(command) {
      sentCommands.push(command)
      return {}
    }
  }

  class PutObjectCommand {
    constructor(input) {
      this.input = input
    }
  }

  const result = await handleRemoteStorageOperation({
    operation: 'put',
    path: 'v1/manifest.json',
    body: new Uint8Array([104, 105]),
    contentType: 'application/json',
    provider: {
      kind: 'cloudflare-r2',
      accountId: 'account-id',
      bucket: 'po',
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
    },
  }, {
    S3Client,
    PutObjectCommand,
  })

  assert.equal(result.path, 'v1/manifest.json')
  assert.equal(result.sizeBytes, 2)
  assert.equal(sentCommands.length, 1)
  assert.deepEqual(sentCommands[0].input, {
    Bucket: 'po',
    Key: 'prompt-optimizer-backups/v1/manifest.json',
    Body: new Uint8Array([104, 105]),
    ContentType: 'application/json',
  })
})

test('desktop remote storage S3 list operation follows continuation tokens', async () => {
  const { handleRemoteStorageOperation } = await import('../packages/desktop/remote-storage.js')
  const sentCommands = []

  class S3Client {
    async send(command) {
      sentCommands.push(command)
      if (!command.input.ContinuationToken) {
        return {
          IsTruncated: true,
          NextContinuationToken: 'page-2',
          Contents: [{
            Key: 'root/v1/snapshots/a/manifest.json',
            Size: 10,
            LastModified: new Date('2026-05-07T00:00:00.000Z'),
          }],
        }
      }

      return {
        IsTruncated: false,
        Contents: [{
          Key: 'root/v1/snapshots/b/manifest.json',
          Size: 20,
          LastModified: new Date('2026-05-08T00:00:00.000Z'),
        }],
      }
    }
  }

  class ListObjectsV2Command {
    constructor(input) {
      this.input = input
    }
  }

  const entries = await handleRemoteStorageOperation({
    operation: 'list',
    path: 'v1/snapshots',
    provider: {
      kind: 's3-compatible',
      endpoint: 'https://s3.example.test',
      region: 'auto',
      bucket: 'po',
      accessKeyId: 'ak',
      secretAccessKey: 'sk',
      prefix: 'root',
      forcePathStyle: true,
    },
  }, {
    S3Client,
    ListObjectsV2Command,
  })

  assert.deepEqual(entries, [
    {
      path: 'v1/snapshots/a/manifest.json',
      sizeBytes: 10,
      updatedAt: '2026-05-07T00:00:00.000Z',
    },
    {
      path: 'v1/snapshots/b/manifest.json',
      sizeBytes: 20,
      updatedAt: '2026-05-08T00:00:00.000Z',
    },
  ])
  assert.equal(sentCommands.length, 2)
  assert.deepEqual(sentCommands.map((command) => command.input.ContinuationToken), [undefined, 'page-2'])
})

test('desktop remote storage handler routes WebDAV operations through the WebDAV client library adapter', async () => {
  const { handleRemoteStorageOperation } = await import('../packages/desktop/remote-storage.js')
  const calls = []
  const client = {
    async createDirectory(path, options) {
      calls.push(['createDirectory', path, options])
    },
    async putFileContents(path, body, options) {
      calls.push(['putFileContents', path, body, options])
      assert.equal(Buffer.isBuffer(body), true)
      assert.deepEqual([...body], [0, 1, 127, 128, 255])
    },
    async getDirectoryContents(path, options) {
      calls.push(['getDirectoryContents', path, options])
      return [
        {
          filename: '/prompt-optimizer-backups/v1/manifest.json',
          type: 'file',
          size: 12,
          lastmod: '2026-05-07T00:00:00.000Z',
          mime: 'application/json',
        },
      ]
    },
  }

  const dependencies = {
    createWebDavClient: async (endpoint, options) => {
      calls.push(['createWebDavClient', endpoint, options])
      return client
    },
  }

  await handleRemoteStorageOperation({
    operation: 'put',
    path: 'v1/assets/image.bin',
    body: new Uint8Array([0, 1, 127, 128, 255]),
    contentType: 'application/octet-stream',
    provider: {
      kind: 'webdav',
      endpoint: 'https://dav.example.test',
      username: 'user',
      password: 'pass',
      directory: 'prompt-optimizer-backups',
    },
  }, dependencies)

  const entries = await handleRemoteStorageOperation({
    operation: 'list',
    path: 'v1',
    provider: {
      kind: 'webdav',
      endpoint: 'https://dav.example.test',
      username: 'user',
      password: 'pass',
      directory: 'prompt-optimizer-backups',
    },
  }, dependencies)

  assert.equal(calls.some(([name]) => name === 'putFileContents'), true)
  assert.equal(calls.some(([name]) => name === 'getDirectoryContents'), true)
  assert.deepEqual(entries, [
    {
      path: 'v1/manifest.json',
      sizeBytes: 12,
      updatedAt: '2026-05-07T00:00:00.000Z',
      contentType: 'application/json',
    },
  ])
})

test('desktop remote storage rejects Google Drive provider', async () => {
  const { handleRemoteStorageOperation } = await import('../packages/desktop/remote-storage.js')

  await assert.rejects(
    () => handleRemoteStorageOperation({
      operation: 'authorize',
      provider: { kind: 'google-drive' },
    }),
    /Google Drive remote backup is only supported in the Web version/,
  )
})

test('desktop remote storage implementation avoids renderer fetch/WebDAV XML paths', () => {
  const remoteStorage = readText('packages/desktop/remote-storage.js')

  assert.match(remoteStorage, /require\('@aws-sdk\/client-s3'\)/)
  assert.match(remoteStorage, /require\('webdav'\)/)
  assert.doesNotMatch(remoteStorage, /\bfetch\s*\(/)
  assert.doesNotMatch(remoteStorage, /\bPROPFIND\b|\bMKCOL\b/)
})

test('desktop preference bridge exposes only registered preference handlers', () => {
  // preference 已拆到独立 module；契约仍要求完整 channel 集合可用。
  const preferenceModule = readText('packages/desktop/config/ipc/preference-handlers.js')
  const main = readText('packages/desktop/main.js')
  const preferenceHandlers = collectMatches(preferenceModule, [
    /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g,
  ])

  assert.match(main, /registerPreferenceIpcHandlers\(/)

  for (const channel of [
    'preference-get',
    'preference-set',
    'preference-delete',
    'preference-keys',
    'preference-clear',
    'preference-getAll',
    'preference-exportData',
    'preference-importData',
    'preference-getDataType',
    'preference-validateData',
  ]) {
    assert.equal(preferenceHandlers.has(channel), true, `Missing handler for ${channel}`)
  }
})
