import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'

const remoteSnapshotMocks = vi.hoisted(() => ({
  listRemoteSnapshotBackups: vi.fn(),
  restoreRemoteSnapshotBackup: vi.fn(),
}))

vi.mock('../../../src/utils/remote-snapshot-backup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/remote-snapshot-backup')>()
  return {
    ...actual,
    listRemoteSnapshotBackups: remoteSnapshotMocks.listRemoteSnapshotBackups,
    restoreRemoteSnapshotBackup: remoteSnapshotMocks.restoreRemoteSnapshotBackup,
  }
})

import DataManager from '../../../src/components/DataManager.vue'

const isRunningInElectronMock = vi.fn(() => false)
const getEnvVarMock = vi.fn(() => '')

vi.mock('@prompt-optimizer/core', () => ({
  isRunningInElectron: () => isRunningInElectronMock(),
  getEnvVar: (key: string) => getEnvVarMock(key),
}))

const naiveStubs = {
  NModal: {
    name: 'NModal',
    template: '<div v-if="show" class="n-modal" :style="style"><slot /></div>',
    props: ['show', 'title', 'preset', 'style', 'size', 'bordered', 'segmented'],
    emits: ['update:show'],
  },
  NSpace: {
    name: 'NSpace',
    template: '<div class="n-space"><slot /></div>',
    props: ['vertical', 'size', 'align', 'justify'],
  },
  NText: {
    name: 'NText',
    template: '<span><slot /></span>',
    props: ['tag', 'depth', 'strong', 'type'],
  },
  NButton: {
    name: 'NButton',
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /><slot name="icon" /></button>',
    props: ['disabled', 'loading', 'type', 'block', 'size'],
    emits: ['click'],
  },
  NUpload: defineComponent({
    name: 'NUpload',
    props: ['fileList', 'accept', 'showFileList', 'customRequest', 'disabled'],
    emits: ['change'],
    setup(_, { slots }) {
      return () => h('div', { class: 'n-upload' }, slots.default?.())
    },
  }),
  NUploadDragger: {
    name: 'NUploadDragger',
    template: '<div class="n-upload-dragger"><slot /></div>',
  },
  NIcon: {
    name: 'NIcon',
    template: '<i><slot /></i>',
    props: ['size', 'depth'],
  },
  NAlert: {
    name: 'NAlert',
    template: '<div class="n-alert"><slot /></div>',
    props: ['type', 'showIcon'],
  },
  NCard: {
    name: 'NCard',
    template: '<section class="n-card"><slot /></section>',
    props: ['size', 'bordered'],
  },
  NStatistic: {
    name: 'NStatistic',
    template: '<div class="n-statistic"><div>{{ label }}</div><div>{{ value }}</div><slot /></div>',
    props: ['label', 'value'],
  },
  NProgress: {
    name: 'NProgress',
    template: '<div class="n-progress" :data-percentage="percentage"></div>',
    props: ['type', 'percentage', 'height', 'borderRadius', 'fillBorderRadius', 'showIndicator'],
  },
  NGrid: {
    name: 'NGrid',
    template: '<div class="n-grid"><slot /></div>',
    props: ['cols', 'xGap', 'yGap'],
  },
  NGridItem: {
    name: 'NGridItem',
    template: '<div class="n-grid-item"><slot /></div>',
    props: ['span'],
  },
  NSelect: {
    name: 'NSelect',
    template: '<select :value="value" @change="$emit(\'update:value\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
    props: ['value', 'options', 'placeholder', 'filterable', 'disabled'],
    emits: ['update:value'],
  },
  NInput: {
    name: 'NInput',
    template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
    props: ['value', 'placeholder', 'type', 'clearable', 'showPasswordOn'],
    emits: ['update:value'],
  },
  NInputNumber: {
    name: 'NInputNumber',
    template: '<input type="number" :value="value" @input="$emit(\'update:value\', Number($event.target.value))" />',
    props: ['value', 'min', 'max', 'disabled'],
    emits: ['update:value'],
  },
  NSwitch: {
    name: 'NSwitch',
    template: '<input type="checkbox" :checked="value" @change="$emit(\'update:value\', $event.target.checked)" />',
    props: ['value'],
    emits: ['update:value'],
  },
}

const createServices = () => ({
  dataManager: {
    exportAllData: vi.fn().mockResolvedValue('{}'),
    importAllData: vi.fn().mockResolvedValue(undefined),
  },
  modelManager: {
    exportData: vi.fn().mockResolvedValue([{ id: 'model-1' }]),
  },
  templateManager: {
    exportData: vi.fn().mockResolvedValue([{ id: 'template-1' }]),
  },
  historyManager: {
    exportData: vi.fn().mockResolvedValue([{ id: 'history-1' }]),
  },
  contextRepo: {
    exportData: vi.fn().mockResolvedValue({
      type: 'context-bundle',
      version: '1.0.0',
      currentId: 'ctx-1',
      contexts: [],
    }),
    exportAll: vi.fn().mockResolvedValue({
      type: 'context-bundle',
      version: '1.0.0',
      currentId: 'ctx-1',
      contexts: [],
    }),
    importAll: vi.fn().mockResolvedValue({
      imported: 0,
      skipped: 0,
      predefinedVariablesRemoved: 0,
    }),
  },
  favoriteManager: {
    exportFavorites: vi.fn().mockResolvedValue(JSON.stringify({ version: '1.0', favorites: [] })),
    importFavorites: vi.fn().mockResolvedValue({ imported: 0, skipped: 0, errors: [] }),
  },
  preferenceService: {
    exportData: vi.fn().mockResolvedValue({ theme: 'light' }),
  },
  imageStorageService: {
    getStorageStats: vi.fn().mockResolvedValue({
      count: 2,
      totalBytes: 2048,
      oldestAt: 1,
      newestAt: 2,
    }),
  },
  favoriteImageStorageService: {
    getStorageStats: vi.fn().mockResolvedValue({
      count: 1,
      totalBytes: 1024,
      oldestAt: 3,
      newestAt: 4,
    }),
  },
})

const mountComponent = (services = createServices()) =>
  mount(DataManager, {
    props: {
      show: true,
    },
    global: {
      stubs: naiveStubs,
      provide: {
        services: ref(services as any),
      },
    },
  })

describe('DataManager storage breakdown', () => {
  beforeEach(() => {
    isRunningInElectronMock.mockReset()
    isRunningInElectronMock.mockReturnValue(false)
    getEnvVarMock.mockReset()
    getEnvVarMock.mockReturnValue('')
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockReset()
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockResolvedValue([])
    remoteSnapshotMocks.restoreRemoteSnapshotBackup.mockReset()
    remoteSnapshotMocks.restoreRemoteSnapshotBackup.mockResolvedValue({
      restored: 0,
      skipped: 0,
      missing: [],
      corrupt: [],
      errors: [],
      imported: {
        appData: true,
        favorites: true,
      },
    })
    delete (window as any).electronAPI
    window.localStorage.clear()
  })

  afterEach(() => {
    delete (window as any).electronAPI
    delete (window as any).google
  })

  it('shows storage usage on web and keeps cache/favorite items separate', async () => {
    const wrapper = mountComponent()

    await flushPromises()

    const modal = wrapper.find('.n-modal')
    const text = wrapper.text()
    expect(modal.attributes('style')).toContain('width: calc(100vw - 32px);')
    expect(modal.attributes('style')).toContain('max-width: 1200px;')
    expect(modal.attributes('style')).toContain('max-height: 90vh;')
    expect(wrapper.findAll('.storage-stat-card')).toHaveLength(4)
    expect(text).toContain('Total (Includes Estimate)')
    expect(text).toContain('Local Import/Export')
    expect(text).toContain('Remote Backup')
    expect(text).toContain('Google Drive is recommended for Web')
    expect(text).toContain('Authorize Google Drive')
    expect(text).toContain('Google Drive backup path: /prompt-optimizer-backups')
    expect(text).toContain('Create Backup')
    expect(text).not.toContain('Detect')
    expect(text).toContain('App Main Data (Estimated)')
    expect(text).toContain('Session/Result Image Cache')
    expect(text).toContain('Favorite Images')
    expect(text).toContain('Includes models, templates, history, contexts and settings')
    expect(text).toContain('2 images')
    expect(text).toContain('1 images')
    expect(text).not.toContain('上下文集合')
    expect(text).not.toContain('导出上下文集合')
    expect(text).not.toContain('导入上下文集合')
    expect(text).not.toContain('Backup Data')
    expect(text).not.toContain('Data directory')
    expect(text).not.toContain('Backup folder')
    expect(text).not.toContain('Scheduled backup')
  }, 15000)

  it('shows desktop backup and storage directory actions in electron', async () => {
    isRunningInElectronMock.mockReturnValue(true)
    ;(window as any).electronAPI = {
      data: {
        getStorageInfo: vi.fn().mockResolvedValue({
          userDataPath: 'C:/PromptOptimizer/data',
          mainFilePath: 'C:/PromptOptimizer/data.json',
          mainSizeBytes: 4096,
          backupFilePath: 'C:/PromptOptimizer/data.backup.json',
          backupSizeBytes: 512,
          totalBytes: 4608,
        }),
        openStorageDirectory: vi.fn().mockResolvedValue(true),
      },
    }

    const wrapper = mountComponent()

    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('Backup Data')
    expect(text).toContain('Data directory')
    expect(text).toContain('Google Drive is not supported on Desktop yet')
    expect(text).not.toContain('Authorize Google Drive')
    expect(text).toContain('C:/PromptOptimizer/data')
    expect(text).toContain('Open directory')
    expect(text).toContain('Refresh')
  })

  it('renders backup export and import as a compact action layout', async () => {
    const wrapper = mountComponent()

    await flushPromises()

    const text = wrapper.text()
    expect(wrapper.find('.local-transfer-panel').exists()).toBe(true)
    expect(wrapper.findAll('.local-transfer-row')).toHaveLength(2)
    expect(wrapper.findAll('.local-scope-pill').length).toBeGreaterThanOrEqual(3)
    expect(wrapper.findAll('.remote-config-panel')).toHaveLength(2)
    expect(wrapper.find('.local-file-picker').exists()).toBe(true)
    expect(wrapper.find('.local-import-settings').exists()).toBe(false)
    expect(text).toContain('Export Current Data')
    expect(text).toContain('Import Local Data')
    expect(text).not.toContain('导出上下文集合')
    expect(text).not.toContain('导入上下文集合')
  })

  it('shows Google Drive as authorized after the authorization flow returns a token', async () => {
    getEnvVarMock.mockImplementation((key: string) =>
      key === 'VITE_GOOGLE_DRIVE_CLIENT_ID'
        ? 'configured-client-id.apps.googleusercontent.com'
        : ''
    )
    ;(window as any).google = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((config: { callback: (response: { access_token: string; expires_in: number }) => void }) => ({
            requestAccessToken: vi.fn(() => config.callback({ access_token: 'access-token', expires_in: 3600 })),
          })),
        },
      },
    }

    const wrapper = mountComponent()
    await flushPromises()

    const authorizeButton = wrapper.findAll('button').find((button) =>
      button.text().includes('Authorize Google Drive')
    )
    expect(authorizeButton).toBeTruthy()
    await authorizeButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Google Drive Authorized')
  })

  it('renders Cloudflare R2 as a simplified S3-compatible preset', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    window.localStorage.setItem('prompt-optimizer:remote-backup-settings', JSON.stringify({
      provider: {
        kind: 'cloudflare-r2',
        accountId: 'account-123',
        bucket: 'prompt-optimizer-backups',
        accessKeyId: '',
        secretAccessKey: '',
      },
    }))
    const wrapper = mountComponent()

    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('Setup Needed')
    expect(text).toContain('Set up R2 in 3 steps')
    expect(text).toContain('Enter Account ID')
    expect(text).toContain('Create a dedicated bucket and configure CORS')
    expect(text).toContain('Create an account API token')
    expect(text).not.toContain('Show All Steps')
    expect(text).not.toContain('Open R2 API Tokens')
    expect(text).not.toContain('Open Cloudflare Dashboard')
    expect(text).not.toContain('Open R2 Overview, create a bucket with the name below')
    expect(text).not.toContain('Region')
    expect(text).not.toContain('Use path-style S3 URLs')

    const tokenStepButton = wrapper.findAll('button').find((button) =>
      button.text().includes('Create an account API token')
    )
    expect(tokenStepButton).toBeTruthy()
    await tokenStepButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Open R2 API Tokens')

    const bucketStepButton = wrapper.findAll('button').find((button) =>
      button.text().includes('Create a dedicated bucket and configure CORS')
    )
    expect(bucketStepButton).toBeTruthy()
    await bucketStepButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Open R2 Overview')
    expect(wrapper.text()).toContain('Open R2 Overview, create a bucket with the name below')
    expect(wrapper.text()).toContain('R2 endpoint will be: https://account-123.r2.cloudflarestorage.com')
    expect(wrapper.text()).toContain('R2 bucket: prompt-optimizer-backups')
    expect(wrapper.text()).toContain('Object prefix: /prompt-optimizer-backups/')
    expect(wrapper.text()).toContain('Copy CORS Config')
    expect(wrapper.text()).toContain('Open R2 API Tokens')

    const bucketsButton = wrapper.findAll('button').find((button) =>
      button.text().trim() === 'Open R2 Overview'
    )
    expect(bucketsButton).toBeTruthy()
    await bucketsButton!.trigger('click')
    expect(openSpy).toHaveBeenCalledWith(
      'https://dash.cloudflare.com/account-123/r2/overview',
      '_blank',
      'noopener,noreferrer',
    )
    openSpy.mockRestore()
  })

  it('keeps configured Cloudflare R2 setup collapsed until requested', async () => {
    window.localStorage.setItem('prompt-optimizer:remote-backup-settings', JSON.stringify({
      provider: {
        kind: 'cloudflare-r2',
        accountId: 'account-123',
        bucket: 'prompt-optimizer-backups',
        accessKeyId: 'ak',
        secretAccessKey: 'sk',
      },
    }))
    const wrapper = mountComponent()

    await flushPromises()

    expect(wrapper.text()).toContain('Not Verified')
    expect(wrapper.text()).toContain('Configuration is saved. Click “Save and Connect” to verify it.')
    expect(wrapper.text()).toContain('Save and Connect')
    expect(wrapper.text()).toContain('Edit Configuration')
    expect(wrapper.text()).not.toContain('Cloudflare R2 is configured')
    expect(wrapper.text()).not.toContain('Enter Account ID')

    const editConfigurationButton = wrapper.findAll('button').find((button) =>
      button.text().includes('Edit Configuration')
    )
    expect(editConfigurationButton).toBeTruthy()
    await editConfigurationButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Cloudflare R2 is configured')
    expect(wrapper.text()).not.toContain('Enter Account ID')

    const showSetupButton = wrapper.findAll('button').find((button) =>
      button.text().includes('Show Setup')
    )
    expect(showSetupButton).toBeTruthy()
    await showSetupButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Enter Account ID')
  })

  it('allows collapsing non-Google configuration after a connection failure', async () => {
    window.localStorage.setItem('prompt-optimizer:remote-backup-settings', JSON.stringify({
      provider: {
        kind: 'cloudflare-r2',
        accountId: 'account-123',
        bucket: 'prompt-optimizer-backups',
        accessKeyId: 'ak',
        secretAccessKey: 'sk',
      },
    }))
    const wrapper = mountComponent()
    await flushPromises()

    const setupState = (wrapper.vm as any).$?.setupState
    setupState.remoteConnectionStates = {
      ...setupState.remoteConnectionStates,
      'cloudflare-r2': {
        ...setupState.remoteConnectionStates['cloudflare-r2'],
        status: 'failed',
        message: 'boom',
      },
    }
    setupState.isRemoteConfigExpanded = true
    await flushPromises()

    expect(wrapper.text()).toContain('boom')
    expect(wrapper.text()).toContain('Cloudflare R2 is configured')

    const hideButton = wrapper.findAll('button').find((button) =>
      button.text().includes('Hide Configuration')
    )
    expect(hideButton).toBeTruthy()
    await hideButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('boom')
    expect(wrapper.text()).not.toContain('Cloudflare R2 is configured')
  })

  it('auto-connects saved direct storage settings before refreshing remote backups', async () => {
    window.localStorage.setItem('prompt-optimizer:remote-backup-settings', JSON.stringify({
      provider: {
        kind: 'webdav',
        endpoint: 'https://dav.example.test',
        username: '',
        password: '',
        directory: 'prompt-optimizer-backups',
      },
    }))
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method || 'GET'
      if (method === 'PROPFIND') {
        return new Response(
          '<?xml version="1.0"?><D:multistatus xmlns:D="DAV:"><D:response><D:href>/prompt-optimizer-backups/</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response></D:multistatus>',
          { status: 207, headers: { 'Content-Type': 'application/xml' } },
        )
      }
      if (method === 'PUT') return new Response('', { status: 201 })
      if (method === 'DELETE') return new Response(null, { status: 204 })
      if (method === 'MKCOL') return new Response('', { status: 405 })
      return new Response('ok')
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as typeof fetch

    try {
      const wrapper = mountComponent()
      await flushPromises()

      const refreshButton = wrapper.findAll('button').find((button) =>
        button.text().includes('Refresh Remote Backup List')
      )
      expect(refreshButton).toBeTruthy()
      await refreshButton!.trigger('click')
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledWith(
        'https://dav.example.test/prompt-optimizer-backups/',
        expect.objectContaining({ method: 'PROPFIND' }),
      )
      expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(1)
      expect(wrapper.text()).toContain('This backup provider is connected')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('opens Cloudflare R2 links in the system browser on desktop', async () => {
    isRunningInElectronMock.mockReturnValue(true)
    const openExternal = vi.fn().mockResolvedValue(undefined)
    ;(window as any).electronAPI = {
      shell: {
        openExternal,
      },
    }
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    window.localStorage.setItem('prompt-optimizer:remote-backup-settings', JSON.stringify({
      provider: {
        kind: 'cloudflare-r2',
        accountId: 'account-123',
        bucket: 'prompt-optimizer-backups',
        accessKeyId: '',
        secretAccessKey: '',
      },
    }))

    const wrapper = mountComponent()
    await flushPromises()

    const bucketStepButton = wrapper.findAll('button').find((button) =>
      button.text().includes('Create a dedicated bucket and configure CORS')
    )
    expect(bucketStepButton).toBeTruthy()
    await bucketStepButton!.trigger('click')
    await flushPromises()

    const bucketsButton = wrapper.findAll('button').find((button) =>
      button.text().trim() === 'Open R2 Overview'
    )
    expect(bucketsButton).toBeTruthy()
    await bucketsButton!.trigger('click')
    await flushPromises()

    expect(openExternal).toHaveBeenCalledWith('https://dash.cloudflare.com/account-123/r2/overview')
    expect(openSpy).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })

  it('restores remote backups without reusing the selected local import file sections', async () => {
    window.localStorage.setItem('prompt-optimizer:remote-backup-settings', JSON.stringify({
      provider: {
        kind: 'cloudflare-r2',
        accountId: 'account-123',
        bucket: 'prompt-optimizer-backups',
        accessKeyId: 'ak',
        secretAccessKey: 'sk',
      },
    }))

    const wrapper = mountComponent()
    await flushPromises()

    const setupState = (wrapper.vm as any).$?.setupState
    expect(setupState).toBeTruthy()
    setupState.remoteConnectionStates = {
      ...setupState.remoteConnectionStates,
      'cloudflare-r2': {
        ...setupState.remoteConnectionStates['cloudflare-r2'],
        status: 'connected',
      },
    }
    setupState.remoteBackups = [{
      id: 'snap-1',
      name: 'snap-1',
      manifestPath: 'v1/snapshots/snap-1/manifest.json',
      updatedAt: '2026-05-06T10:30:00.000Z',
      manifest: {
        includedSections: ['appData', 'favorites', 'imageCache', 'favoriteImages'],
      },
    }]
    setupState.selectedRemoteBackupId = 'snap-1'
    setupState.availableImportSections = new Set(['appData'])
    setupState.importFavorites = false
    setupState.importAppDataImages = false
    await flushPromises()

    const restoreButton = wrapper.findAll('button').find((button) =>
      button.text().includes('Restore Selected Backup')
    )
    expect(restoreButton).toBeTruthy()
    await restoreButton!.trigger('click')
    await flushPromises()

    expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).toHaveBeenCalledWith(expect.objectContaining({
      snapshotId: 'snap-1',
      sections: {
        appData: true,
        favorites: true,
        imageCache: true,
        favoriteImages: true,
      },
    }))
  })

  it('allows remote restore to skip image sections from a partial backup', async () => {
    window.localStorage.setItem('prompt-optimizer:remote-backup-settings', JSON.stringify({
      provider: {
        kind: 'cloudflare-r2',
        accountId: 'account-123',
        bucket: 'prompt-optimizer-backups',
        accessKeyId: 'ak',
        secretAccessKey: 'sk',
      },
    }))

    const wrapper = mountComponent()
    await flushPromises()

    const setupState = (wrapper.vm as any).$?.setupState
    setupState.remoteConnectionStates = {
      ...setupState.remoteConnectionStates,
      'cloudflare-r2': {
        ...setupState.remoteConnectionStates['cloudflare-r2'],
        status: 'connected',
      },
    }
    setupState.remoteBackups = [{
      id: 'snap-partial',
      name: 'snap-partial',
      manifestPath: 'v1/snapshots/snap-partial/manifest.json',
      updatedAt: '2026-05-06T10:30:00.000Z',
      manifest: {
        includedSections: ['appData', 'favorites', 'imageCache', 'favoriteImages'],
        missingAssets: [
          { store: 'imageCache', id: 'missing-image' },
          { store: 'favoriteImages', id: 'missing-favorite-image' },
        ],
      },
    }]
    setupState.selectedRemoteBackupId = 'snap-partial'
    await flushPromises()

    setupState.remoteRestoreAppData = true
    setupState.remoteRestoreFavorites = true
    setupState.remoteRestoreAppDataImages = false
    setupState.remoteRestoreFavoriteImages = false
    await flushPromises()

    const restoreButton = wrapper.findAll('button').find((button) =>
      button.text().includes('Restore Selected Backup')
    )
    expect(restoreButton).toBeTruthy()
    await restoreButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('missing image resources')
    expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).toHaveBeenCalledWith(expect.objectContaining({
      snapshotId: 'snap-partial',
      sections: {
        appData: true,
        favorites: true,
        imageCache: false,
        favoriteImages: false,
      },
    }))
  })

  it('disables remote backup actions while a remote data operation is running', async () => {
    window.localStorage.setItem('prompt-optimizer:remote-backup-settings', JSON.stringify({
      provider: {
        kind: 'cloudflare-r2',
        accountId: 'account-123',
        bucket: 'prompt-optimizer-backups',
        accessKeyId: 'ak',
        secretAccessKey: 'sk',
      },
    }))
    const wrapper = mountComponent()
    await flushPromises()

    const setupState = (wrapper.vm as any).$?.setupState
    setupState.remoteBackups = [{
      id: 'snap-1',
      name: 'snap-1',
      manifestPath: 'v1/snapshots/snap-1/manifest.json',
    }]
    setupState.selectedRemoteBackupId = 'snap-1'
    await flushPromises()

    const remoteActionButton = (label: string) => {
      const button = wrapper.findAll('button').find((candidate) =>
        candidate.text().includes(label)
      )
      expect(button, label).toBeTruthy()
      return button!
    }

    const buttons = [
      remoteActionButton('Create Backup'),
      remoteActionButton('Refresh Remote Backup List'),
      remoteActionButton('Clean Unreferenced Images'),
      remoteActionButton('Restore Selected Backup'),
    ]
    expect(buttons.every((button) => (button.element as HTMLButtonElement).disabled)).toBe(false)

    setupState.isLoadingRemoteList = true
    await flushPromises()

    expect(buttons.every((button) => (button.element as HTMLButtonElement).disabled)).toBe(true)
  })
})
