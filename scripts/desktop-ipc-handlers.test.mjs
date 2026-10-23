import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const readText = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

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

test('desktop prompt test IPC preserves optional image payloads without transforming or logging them', () => {
  const proxy = readText('packages/core/src/services/prompt/electron-proxy.ts')
  const preload = readText('packages/desktop/preload.js')
  const main = readText('packages/desktop/main.js')

  assert.match(
    proxy,
    /const safeInputImages = inputImages \? safeSerializeForIPC\(inputImages\) : undefined;/,
  )
  assert.match(
    proxy,
    /this\.api\.testPrompt\(systemPrompt, userPrompt, modelKey, safeInputImages\)/,
  )
  assert.match(
    proxy,
    /this\.api\.testPromptStream\(systemPrompt, userPrompt, modelKey, callbacks, safeInputImages\)/,
  )

  assert.match(
    preload,
    /ipcRenderer\.invoke\('prompt-testPrompt', systemPrompt, userPrompt, modelKey, inputImages\)/,
  )
  assert.match(
    preload,
    /ipcRenderer\.invoke\('prompt-testPromptStream', systemPrompt, userPrompt, modelKey, streamId, inputImages\)/,
  )
  assert.match(
    main,
    /promptService\.testPrompt\(systemPrompt, userPrompt, modelKey, inputImages\)/,
  )
  assert.match(
    main,
    /promptService\.testPromptStream\(systemPrompt, userPrompt, modelKey, streamHandlers, inputImages\)/,
  )

  for (const bridgeSource of [proxy, preload]) {
    assert.doesNotMatch(bridgeSource, /console\.(?:log|info|warn|error)\([^\n]*inputImages/)
    assert.doesNotMatch(bridgeSource, /data:image\/[^;]+;base64,[^'"`\s]+/)
  }
})

test('desktop multimodal evaluation routes image understanding through the main process', () => {
  const proxy = readText('packages/core/src/services/image-understanding/electron-proxy.ts')
  const initializer = readText('packages/ui/src/composables/system/useAppInitializer.ts')
  const preload = readText('packages/desktop/preload.js')
  const main = readText('packages/desktop/main.js')

  assert.match(proxy, /this\.api\.understand\(safeSerializeForIPC\(request\)\)/)
  assert.match(initializer, /imageUnderstandingService: new ElectronImageUnderstandingServiceProxy\(\)/)
  assert.match(
    preload,
    /ipcRenderer\.invoke\('image-understanding-understand', request\)/,
  )
  assert.match(
    main,
    /imageUnderstandingService = createImageUnderstandingService\(\{[\s\S]*?imageInputConverter: convertImageInputWithElectronNativeImage/,
  )
  assert.match(
    main,
    /imageUnderstandingService\.understand\(safeSerialize\(request\)\)/,
  )
})

test('macOS manual-update policy guards every mutating updater entry point first', () => {
  const main = readText('packages/desktop/main.js')

  for (const [eventName, signature] of [
    ['UPDATE_START_DOWNLOAD', 'async \\(\\)'],
    ['UPDATE_INSTALL', 'async \\(\\)'],
    ['UPDATE_DOWNLOAD_SPECIFIC_VERSION', 'async \\(event, versionType\\)'],
  ]) {
    const handlerStartsWithGuard = new RegExp(
      `ipcMain\\.handle\\(IPC_EVENTS\\.${eventName}, ${signature} => \\{\\s*` +
      'if \\(isManualReleaseDelivery\\(updateDelivery\\)\\)',
    )
    assert.match(main, handlerStartsWithGuard, `${eventName} must fail before mutating updater state`)
  }
})

test('global updater errors do not release handler-owned operation locks', () => {
  const main = readText('packages/desktop/main.js')
  const errorHandlerStart = main.indexOf("autoUpdater.on('error'")
  const errorHandlerEnd = main.indexOf("autoUpdater.on('download-progress'", errorHandlerStart)

  assert.notEqual(errorHandlerStart, -1)
  assert.notEqual(errorHandlerEnd, -1)

  const errorHandler = main.slice(errorHandlerStart, errorHandlerEnd)
  for (const lock of ['isCheckingForUpdate', 'isDownloadingUpdate', 'isInstallingUpdate']) {
    assert.doesNotMatch(errorHandler, new RegExp(`${lock}\\s*=\\s*false`))
  }

  for (const [startMarker, endMarker] of [
    ['ipcMain.handle(IPC_EVENTS.UPDATE_CHECK,', '// 统一检查所有版本'],
    ['ipcMain.handle(IPC_EVENTS.UPDATE_CHECK_ALL_VERSIONS', '// Open only a main-process'],
  ]) {
    const handlerStart = main.indexOf(startMarker)
    const handlerEnd = main.indexOf(endMarker, handlerStart)
    assert.notEqual(handlerStart, -1)
    assert.notEqual(handlerEnd, -1)

    const handler = main.slice(handlerStart, handlerEnd)
    assert.match(handler, /finally\s*\{[\s\S]*isCheckingForUpdate\s*=\s*false/)
  }
})

test('concurrent unified update checks keep the delivery-policy response contract', () => {
  const main = readText('packages/desktop/main.js')
  const handlerStart = main.indexOf('ipcMain.handle(IPC_EVENTS.UPDATE_CHECK_ALL_VERSIONS')
  const lockStart = main.indexOf('// 设置检查状态锁', handlerStart)

  assert.notEqual(handlerStart, -1)
  assert.notEqual(lockStart, -1)

  const inProgressBranch = main.slice(handlerStart, lockStart)
  assert.match(inProgressBranch, /const currentVersion = require\('\.\/package\.json'\)\.version/)
  assert.match(inProgressBranch, /currentVersion/)
  assert.match(inProgressBranch, /updateDelivery/)
  assert.match(inProgressBranch, /stable:\s*null/)
  assert.match(inProgressBranch, /prerelease:\s*null/)
  assert.match(inProgressBranch, /inProgress:\s*true/)
})

test('renderer preserves updater state while a unified check is already in progress', () => {
  const updater = readText('packages/ui/src/composables/system/useUpdater.ts')
  const inProgressStart = updater.indexOf('if (results.inProgress)')
  const completedResultStart = updater.indexOf('// Unknown/missing capability', inProgressStart)

  assert.notEqual(inProgressStart, -1)
  assert.notEqual(completedResultStart, -1)

  const inProgressBranch = updater.slice(inProgressStart, completedResultStart)
  assert.match(inProgressBranch, /return/)
  assert.doesNotMatch(inProgressBranch, /state\.isDownloading\s*=\s*false/)

  const checkUpdateStart = updater.indexOf('const checkUpdate = async')
  const checkBothVersionsCall = updater.indexOf('await checkBothVersions()', checkUpdateStart)
  assert.notEqual(checkUpdateStart, -1)
  assert.notEqual(checkBothVersionsCall, -1)

  const preRequestState = updater.slice(checkUpdateStart, checkBothVersionsCall)
  assert.doesNotMatch(preRequestState, /state\.stableVersion\s*=\s*null/)
  assert.doesNotMatch(preRequestState, /state\.updateDelivery\s*=\s*null/)
  assert.doesNotMatch(preRequestState, /state\.downloadMessage\s*=\s*null/)
})

test('renderer invalidates actionable version state after a terminal unified-check failure', () => {
  const updater = readText('packages/ui/src/composables/system/useUpdater.ts')
  const checkStart = updater.indexOf('const checkBothVersions = async')
  const catchStart = updater.indexOf("console.error('[useUpdater] Error checking all versions:'", checkStart)
  const finallyStart = updater.indexOf('} finally {', catchStart)

  assert.notEqual(checkStart, -1)
  assert.notEqual(catchStart, -1)
  assert.notEqual(finallyStart, -1)

  const terminalErrorBranch = updater.slice(catchStart, finallyStart)
  assert.match(terminalErrorBranch, /invalidateActionableCheckState\(state\)/)
  assert.match(terminalErrorBranch, /state\.lastCheckResult\s*=\s*'error'/)
})

test('updater feed, delivery policy, and release URLs share one repository snapshot', () => {
  const main = readText('packages/desktop/main.js')
  const setupStart = main.indexOf('async function setupUpdateHandlers()')
  const eventHandlersStart = main.indexOf('// 设置更新事件处理', setupStart)

  assert.notEqual(setupStart, -1)
  assert.notEqual(eventHandlersStart, -1)

  const repositorySetup = main.slice(setupStart, eventHandlersStart)
  assert.match(repositorySetup, /resolveUpdateRepositoryConfig\(\)/)
  assert.match(repositorySetup, /shouldOverrideFeed/)
  assert.match(repositorySetup, /getUpdateDeliveryPolicy\(\{ repositoryInfo \}\)/)
  assert.match(repositorySetup, /const \{ owner, repo \} = repositoryInfo/)
  assert.match(repositorySetup, /repositoryInfo = packagedRepositoryInfo/)
  assert.doesNotMatch(repositorySetup, /process\.env\.DEV_REPO_/)
})

test('updater release navigation is constructed and opened in the main process', () => {
  const main = readText('packages/desktop/main.js')
  const handlerStart = main.indexOf('ipcMain.handle(IPC_EVENTS.UPDATE_OPEN_RELEASE_PAGE')
  const handlerEnd = main.indexOf('ipcMain.handle(IPC_EVENTS.UPDATE_START_DOWNLOAD', handlerStart)

  assert.notEqual(handlerStart, -1)
  assert.notEqual(handlerEnd, -1)

  const handler = main.slice(handlerStart, handlerEnd)
  assert.match(handler, /buildReleaseUrl\(version, repositoryInfo\)/)
  assert.match(handler, /updateDelivery\.fallbackReleaseUrl/)
  assert.match(handler, /shell\.openExternal\(releaseUrl\)/)
  assert.doesNotMatch(handler, /shell\.openExternal\(version\)/)
})

test('manual release workflow normalizes tags used by release-page navigation', () => {
  const workflow = readText('.github/workflows/release.yml')
  assert.match(workflow, /RELEASE_VERSION: \$\{\{ inputs\.version \|\| github\.ref_name \}\}/)
  assert.match(workflow, /run: node scripts\/release-channel\.js/)
  assert.match(workflow, /gh release create "\$VERSION"/)
  assert.match(workflow, /--verify-tag/)
})

test('desktop release jobs keep repository metadata and updater publish config aligned', () => {
  const workflow = readText('.github/workflows/release.yml')
  const jobBlock = (jobName, nextJobName) => {
    const start = workflow.indexOf(`  ${jobName}:`)
    const end = workflow.indexOf(`  ${nextJobName}:`, start)
    assert.notEqual(start, -1, `${jobName} job must exist`)
    assert.notEqual(end, -1, `${nextJobName} job must follow ${jobName}`)
    return workflow.slice(start, end)
  }

  const windowsJob = jobBlock('build-windows', 'build-macos')
  const macosJob = jobBlock('build-macos', 'build-linux')
  const linuxJob = jobBlock('build-linux', 'build-extension')

  assert.match(windowsJob, /\$pkgJson\.repository\.url\s*=\s*\$repoUrl/)
  assert.match(windowsJob, /\$pkgJson\.build\.publish\.owner\s*=\s*\$repoOwner/)
  assert.match(windowsJob, /\$pkgJson\.build\.publish\.repo\s*=\s*\$repoName/)

  for (const [name, job] of [['build-macos', macosJob], ['build-linux', linuxJob]]) {
    assert.match(job, /\.repository\.url\s*=\s*\$repo_url/, `${name} must update repository.url`)
    assert.match(job, /\.build\.publish\.owner\s*=\s*\$repo_owner/, `${name} must update publish owner`)
    assert.match(job, /\.build\.publish\.repo\s*=\s*\$repo_name/, `${name} must update publish repo`)
  }
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
  const main = readText('packages/desktop/main.js')
  const mainHandlers = collectMatches(main, [
    /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g,
  ])

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
    assert.equal(mainHandlers.has(channel), true, `Missing handler for ${channel}`)
  }
})
