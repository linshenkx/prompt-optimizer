import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { allowConsole } from '../../utils/error-detection'
import { UnreadableRemoteSnapshotsError } from '../../../src/utils/remote-snapshot-backup'

const remoteSnapshotMocks = vi.hoisted(() => ({
  listRemoteSnapshotBackups: vi.fn(),
  createRemoteSnapshotBackup: vi.fn(),
  restoreRemoteSnapshotBackup: vi.fn(),
}))

const sessionMocks = vi.hoisted(() => ({
  saveAllSessions: vi.fn(),
  beginSessionRestore: vi.fn(),
  releaseRestore: vi.fn(),
}))

const resourcePackageMocks = vi.hoisted(() => ({
  createDataManagerResourcePackage: vi.fn(),
  importDataManagerResourcePackage: vi.fn(),
}))

vi.mock('../../../src/stores/session/useSessionManager', () => ({
  useSessionManager: () => sessionMocks,
}))

vi.mock('../../../src/utils/data-manager-resource-package', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/utils/data-manager-resource-package')>()),
  ...resourcePackageMocks,
}))

vi.mock('../../../src/utils/remote-snapshot-backup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/remote-snapshot-backup')>()
  return {
    ...actual,
    createRemoteSnapshotBackup: remoteSnapshotMocks.createRemoteSnapshotBackup,
    listRemoteSnapshotBackups: remoteSnapshotMocks.listRemoteSnapshotBackups,
    restoreRemoteSnapshotBackup: remoteSnapshotMocks.restoreRemoteSnapshotBackup,
  }
})

const compactViewport = ref(false)
vi.mock('../../../src/composables/ui/useNaiveTheme', () => ({
  useNaiveTheme: () => ({ isCurrentThemeDark: ref(false) }),
}))
vi.mock('../../../src/composables/ui/useWorkspaceLayout', () => ({
  useWorkspaceLayout: () => ({ isCompact: compactViewport }),
}))

import DataManager from '../../../src/components/DataManager.vue'
import BackupRecords from '../../../src/components/data-manager/BackupRecords.vue'
import * as remoteBackup from '../../../src/utils/remote-backup'
import {
  createRemoteBackupImportCode,
  parseRemoteBackupImportCode,
} from '../../../src/utils/remote-backup-import-code'

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
    template:
      '<button :disabled="disabled" @click="$emit(\'click\')"><slot /><slot name="icon" /></button>',
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
    template:
      '<select :value="value" @change="$emit(\'update:value\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
    props: ['value', 'options', 'placeholder', 'filterable', 'disabled'],
    emits: ['update:value'],
  },
  NInput: {
    name: 'NInput',
    template:
      '<textarea v-if="type === \'textarea\'" :value="value" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)" /><input v-else :value="value" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)" />',
    props: [
      'value',
      'placeholder',
      'type',
      'clearable',
      'showPasswordOn',
      'disabled',
      'autosize',
      'readonly',
    ],
    emits: ['update:value'],
  },
  NInputNumber: {
    name: 'NInputNumber',
    template:
      '<input type="number" :value="value" @input="$emit(\'update:value\', Number($event.target.value))" />',
    props: ['value', 'min', 'max', 'disabled'],
    emits: ['update:value'],
  },
  NQrCode: {
    template: '<svg />',
    props: ['value', 'size', 'padding', 'type', 'errorCorrectionLevel'],
  },
  NSwitch: {
    name: 'NSwitch',
    template:
      '<input type="checkbox" :checked="value" @change="$emit(\'update:value\', $event.target.checked)" />',
    props: ['value'],
    emits: ['update:value'],
  },
}

const createServices = () => ({
  dataManager: {
    exportAllData: vi.fn().mockResolvedValue('{}'),
    validateImportData: vi.fn(async (text: string) => {
      JSON.parse(text)
    }),
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
    compactViewport.value = false
    isRunningInElectronMock.mockReset()
    isRunningInElectronMock.mockReturnValue(false)
    getEnvVarMock.mockReset()
    getEnvVarMock.mockReturnValue('')
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockReset()
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockResolvedValue([])
    remoteSnapshotMocks.createRemoteSnapshotBackup.mockReset()
    remoteSnapshotMocks.createRemoteSnapshotBackup.mockResolvedValue({
      entry: { id: 'new-snapshot', name: 'new-snapshot' },
      missingAssets: [],
      uploadedAssets: 0,
      skippedAssets: 0,
    })
    sessionMocks.saveAllSessions.mockReset().mockResolvedValue(true)
    sessionMocks.beginSessionRestore.mockReset().mockResolvedValue(sessionMocks.releaseRestore)
    sessionMocks.releaseRestore.mockReset()
    resourcePackageMocks.createDataManagerResourcePackage.mockReset().mockResolvedValue({
      blob: new Blob(['backup']),
      filename: 'backup.po-backup.zip',
      missingResources: [],
    })
    resourcePackageMocks.importDataManagerResourcePackage.mockReset().mockResolvedValue({
      favorites: null,
      resources: { restored: 0, skipped: 0, missing: [], corrupt: [], errors: [] },
    })
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

  const savedWebDav = () => {
    localStorage.setItem(
      'prompt-optimizer:remote-backup-settings',
      JSON.stringify({
        provider: {
          kind: 'webdav',
          endpoint: 'https://dav.test',
          directory: 'backups',
          username: 'u',
          password: 'p',
        },
      }),
    )
  }
  const snapshot = (id: string) => ({
    id,
    name: id,
    manifestPath: `v1/snapshots/${id}/manifest.json`,
    manifest: { includedSections: ['appData', 'favorites'] },
  })
  const deferred = () => {
    let resolve!: (value: any) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<any>((yes, no) => {
      resolve = yes
      reject = no
    })
    return { promise, resolve, reject }
  }

  it('keeps unloaded, loading, failed and empty backup states distinct', async () => {
    const wrapper = mountComponent()
    const state = (wrapper.vm as any).$?.setupState.controller
    expect(state.remoteListState).toBe('idle')
    expect(wrapper.find('[data-testid="remote-list-status"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="manage-cloud-connection"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="connect-cloud-account"]').text()).toBe('Authorize connection')
    expect(wrapper.find('[data-testid="remote-backup-create"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="remote-backup-refresh"]').exists()).toBe(false)
    state.remoteSettings.provider = {
      kind: 'webdav',
      endpoint: 'https://dav.test',
      directory: 'backups',
      username: 'u',
      password: 'p',
    }
    const pending = deferred()
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockReturnValueOnce(pending.promise)
    const loading = state.refreshRemoteBackups()
    await flushPromises()
    expect(state.remoteListState).toBe('loading')
    expect(wrapper.get('[data-testid="remote-backup-refresh"]').attributes('disabled')).toBeDefined()
    pending.reject(new Error('offline'))
    await loading
    await flushPromises()
    expect(state.remoteListState).toBe('error')
    expect(wrapper.get('[data-testid="remote-list-status"]').text()).toContain('offline')
    expect(wrapper.get('[data-testid="remote-backup-refresh"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="remote-list-status"]').text()).not.toContain(
      'No remote backups',
    )
    await state.refreshRemoteBackups()
    await flushPromises()
    expect(state.remoteListState).toBe('success')
    expect(wrapper.get('[data-testid="remote-list-status"]').text()).toContain('No remote backups')
    wrapper.unmount()
  })

  it('explains unreadable backups in the selected UI language', async () => {
    savedWebDav()
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockRejectedValueOnce(
      new UnreadableRemoteSnapshotsError(),
    )
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.get('[data-testid="remote-list-status"]').text()).toContain(
      'Backups were found, but their metadata could not be read.',
    )
    wrapper.unmount()
  })

  it('keeps the last list after a refresh failure and clears it when configuration changes', async () => {
    savedWebDav()
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockResolvedValueOnce([snapshot('saved')])
    const wrapper = mountComponent()
    await flushPromises()
    const state = (wrapper.vm as any).$?.setupState.controller
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockRejectedValueOnce(new Error('offline'))
    await state.refreshRemoteBackups()
    expect(state.remoteBackups.map((item: any) => item.id)).toEqual(['saved'])
    expect(state.remoteListState).toBe('error')
    state.remoteSettings.provider.endpoint = 'https://other.test'
    state.markRemoteSettingsDirty()
    expect(state.remoteBackups).toEqual([])
    expect(state.remoteListState).toBe('idle')
    expect(localStorage.getItem('prompt-optimizer:remote-backup-settings')).toContain(
      'https://other.test',
    )
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('merges duplicate loads and ignores old responses after editing the connection', async () => {
    savedWebDav()
    const old = deferred()
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockReturnValueOnce(old.promise)
    const wrapper = mountComponent()
    await flushPromises()
    const state = (wrapper.vm as any).$?.setupState.controller
    const duplicate = state.refreshRemoteBackups()
    await flushPromises()
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(1)
    state.remoteSettings.provider.endpoint = 'https://new.test'
    state.markRemoteSettingsDirty()
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockResolvedValueOnce([snapshot('new')])
    await state.handleRemoteSaveAndConnect()
    old.resolve([snapshot('old')])
    await duplicate
    expect(state.remoteBackups.map((item: any) => item.id)).toEqual(['new'])
    expect(state.selectedRemoteBackupId).toBeNull()
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('loads on mobile entry once, skips focus/resize/task revisits, and reloads next opening', async () => {
    savedWebDav()
    compactViewport.value = true
    const wrapper = mountComponent()
    await flushPromises()
    const state = (wrapper.vm as any).$?.setupState.controller
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(1)
    state.restoreSource = 'cloud'
    await flushPromises()
    await flushPromises()
    state.restoreSource = 'cloud'
    compactViewport.value = false
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    await flushPromises()
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('loads a saved provider again when switching back to it', async () => {
    savedWebDav()
    const wrapper = mountComponent()
    await flushPromises()
    const state = (wrapper.vm as any).$?.setupState.controller
    await wrapper.get('[data-testid="cloud-provider-webdav"]').trigger('click')
    await flushPromises()
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(1)
    await wrapper.get('[data-testid="cloud-provider-s3-compatible"]').trigger('click')
    await flushPromises()
    expect(state.remoteSettings.provider.kind).toBe('s3-compatible')
    expect(state.remoteBackups).toEqual([])
    await wrapper.get('[data-testid="cloud-provider-webdav"]').trigger('click')
    await flushPromises()
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('does not let a closed dialog response replace the list from a new opening', async () => {
    savedWebDav()
    const old = deferred()
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockReturnValueOnce(old.promise)
    const wrapper = mountComponent()
    await flushPromises()
    await wrapper.setProps({ show: false })
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockResolvedValueOnce([snapshot('new')])
    await wrapper.setProps({ show: true })
    await flushPromises()
    old.reject(new Error('late failure'))
    await flushPromises()
    const state = (wrapper.vm as any).$?.setupState.controller
    expect(state.remoteListState).toBe('success')
    expect(state.remoteBackups.map((item: any) => item.id)).toEqual(['new'])
    wrapper.unmount()
  })

  const connectRemote = async (wrapper: ReturnType<typeof mountComponent>) => {
    const state = (wrapper.vm as any).$?.setupState.controller
    state.restoreSource = 'cloud'
    state.remoteSettings = {
      ...state.remoteSettings,
      provider: {
        kind: 'cloudflare-r2',
        accountId: 'account-123',
        bucket: 'prompt-optimizer-backups',
        accessKeyId: 'ak',
        secretAccessKey: 'sk',
      },
    }
    await flushPromises()
    state.remoteConnectionStates = {
      ...state.remoteConnectionStates,
      'cloudflare-r2': {
        ...state.remoteConnectionStates['cloudflare-r2'],
        status: 'connected',
      },
    }
    state.remoteBackups = [
      {
        id: 'snap-1',
        name: 'snap-1',
        manifestPath: 'v1/snapshots/snap-1/manifest.json',
        manifest: { includedSections: ['appData', 'favorites', 'imageCache', 'favoriteImages'] },
      },
    ]
    state.selectedRemoteBackupId = 'snap-1'
    await flushPromises()
    return state
  }

  it('exports and copies the selected backup and only its current connection', async () => {
    const wrapper = mountComponent()
    const state = await connectRemote(wrapper)
    state.remoteSettings.providers = { webdav: { kind: 'webdav', password: 'unrelated-secret' } }
    await wrapper.get('[data-testid="remote-import-code-export"]').trigger('click')
    const code = state.exportedRemoteImportCode
    expect(parseRemoteBackupImportCode(code)).toEqual({
      version: 1,
      provider: state.remoteSettings.provider,
      snapshotId: 'snap-1',
    })
    expect(wrapper.get('[data-testid="remote-import-code-qr"]').exists()).toBe(true)
    await wrapper.get('[data-testid="remote-import-code-copy"]').trigger('click')
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(code)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(state.showRemoteImportCode).toBe(false)
    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })

  it.each(['web', 'desktop', 'mobile'])(
    'reads the exact backup and only restores after confirmation on %s',
    async (runtime) => {
      isRunningInElectronMock.mockReturnValue(runtime === 'desktop')
      compactViewport.value = runtime === 'mobile'
      const store = { detect: vi.fn().mockResolvedValue({ ok: true, steps: [] }) }
      const storeSpy = vi
        .spyOn(remoteBackup, 'createRemoteObjectStore')
        .mockReturnValue(store as any)
      const provider = {
        kind: 'cloudflare-r2' as const,
        accountId: 'account',
        bucket: 'bucket',
        accessKeyId: 'ak',
        secretAccessKey: 'sk',
      }
      remoteSnapshotMocks.listRemoteSnapshotBackups.mockResolvedValue([
        { id: 'newer-other-backup', name: 'other' },
        {
          id: 'selected-backup',
          name: 'selected',
          manifest: { includedSections: ['appData', 'favorites', 'imageCache', 'favoriteImages'] },
        },
      ])
      const wrapper = mountComponent()
      const state = (wrapper.vm as any).$?.setupState.controller
      state.remoteSettings.providers = {
        webdav: {
          kind: 'webdav',
          endpoint: 'https://other.example',
          username: 'other',
          password: 'retained',
          directory: '',
        },
      }
      state.remoteImportCode = createRemoteBackupImportCode(provider, 'selected-backup')
      await state.handleRemoteCodeImport()
      expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).not.toHaveBeenCalled()
      await state.handleRemoteRestore()
      expect(storeSpy).toHaveBeenCalledWith(provider, runtime === 'desktop' ? 'desktop' : 'web')
      expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).toHaveBeenCalledTimes(1)
      expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshotId: 'selected-backup',
          favoriteMergeStrategy: 'overwrite',
          sections: { appData: true, favorites: true, imageCache: true, favoriteImages: true },
        }),
      )
      expect(sessionMocks.beginSessionRestore).toHaveBeenCalledTimes(1)
      expect(wrapper.emitted('imported')).toHaveLength(1)
      expect(remoteSnapshotMocks.createRemoteSnapshotBackup).not.toHaveBeenCalled()
      expect(
        JSON.parse(localStorage.getItem(remoteBackup.REMOTE_BACKUP_SETTINGS_KEY)!),
      ).toMatchObject({
        provider,
        providers: { webdav: { password: 'retained' } },
      })
      wrapper.unmount()
      storeSpy.mockRestore()
    },
  )

  it('never restores a different backup when the pinned backup has been deleted', async () => {
    const storeSpy = vi
      .spyOn(remoteBackup, 'createRemoteObjectStore')
      .mockReturnValue({ detect: vi.fn().mockResolvedValue({ ok: true }) } as any)
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockResolvedValue([
      { id: 'other', name: 'other' },
    ])
    const wrapper = mountComponent()
    const state = await connectRemote(wrapper)
    state.remoteImportCode = createRemoteBackupImportCode(state.remoteSettings.provider, 'deleted')
    await state.handleRemoteCodeImport()
    expect(state.selectedRemoteBackupId).toBeNull()
    expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).not.toHaveBeenCalled()
    expect(wrapper.emitted('imported')).toBeUndefined()
    wrapper.unmount()
    storeSpy.mockRestore()
  })

  it('rejects malformed codes without changing saved connections or making network calls', async () => {
    const wrapper = mountComponent()
    const state = await connectRemote(wrapper)
    await flushPromises()
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockClear()
    const previous = localStorage.getItem(remoteBackup.REMOTE_BACKUP_SETTINGS_KEY)
    state.remoteImportCode = 'not-a-backup-code'
    await state.handleRemoteCodeImport()
    expect(localStorage.getItem(remoteBackup.REMOTE_BACKUP_SETTINGS_KEY)).toBe(previous)
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).not.toHaveBeenCalled()
    expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('opens the mobile cloud task for a scanned code and waits for the import action', async () => {
    compactViewport.value = true
    const wrapper = mountComponent()
    await wrapper.setProps({ importCode: 'scanned-code' })
    await flushPromises()
    expect(wrapper.get('[data-testid="remote-import-code-input"]').isVisible()).toBe(true)
    expect(wrapper.emitted('import-code-consumed')).toHaveLength(1)
    expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each(['local', 'remote'])(
    'saves live workspace drafts before creating a %s backup',
    async (target) => {
      allowConsole(/^(Export failed:|\[DataManager\] Remote backup failed:)/)
      const wrapper = mountComponent()
      await flushPromises()
      const state = await connectRemote(wrapper)
      let finishSave!: (saved: boolean) => void
      sessionMocks.saveAllSessions.mockReturnValue(
        new Promise<boolean>((resolve) => {
          finishSave = resolve
        }),
      )
      const exportMock =
        target === 'local'
          ? resourcePackageMocks.createDataManagerResourcePackage
          : remoteSnapshotMocks.createRemoteSnapshotBackup
      // Avoid downloading a real file; this test checks the persisted snapshot barrier.
      exportMock.mockRejectedValue(new Error('stop after snapshot export'))
      const operation = target === 'local' ? state.handleExport() : state.handleRemoteUpload()
      await flushPromises()
      expect(sessionMocks.saveAllSessions).toHaveBeenCalledTimes(1)
      expect(exportMock).not.toHaveBeenCalled()
      finishSave(true)
      await operation
      expect(exportMock).toHaveBeenCalledTimes(1)
      wrapper.unmount()
    },
  )

  it.each(['local', 'remote'])(
    'aborts %s backup when workspace drafts cannot be saved',
    async (target) => {
      allowConsole(/^(Export failed:|\[DataManager\] Remote backup failed:)/)
      sessionMocks.saveAllSessions.mockResolvedValue(false)
      const wrapper = mountComponent()
      await flushPromises()
      const state = await connectRemote(wrapper)
      await (target === 'local' ? state.handleExport() : state.handleRemoteUpload())
      expect(sessionMocks.saveAllSessions).toHaveBeenCalledTimes(1)
      expect(resourcePackageMocks.createDataManagerResourcePackage).not.toHaveBeenCalled()
      expect(remoteSnapshotMocks.createRemoteSnapshotBackup).not.toHaveBeenCalled()
      expect(window.localStorage.getItem('prompt-optimizer:data-backup-status')).toBeNull()
      wrapper.unmount()
    },
  )

  it.each(['json', 'zip', 'remote'])(
    'holds the old session state paused through a successful %s restore and reload',
    async (source) => {
      const services = createServices()
      const wrapper = mountComponent(services)
      await flushPromises()
      const state = await connectRemote(wrapper)
      state.selectedFile = {
        id: 'backup',
        name: `backup.${source}`,
        file: new File(['{}'], `backup.${source}`),
      }
      state.importPreviewState = 'success'
      let finishPause!: (release: () => void) => void
      sessionMocks.beginSessionRestore.mockReturnValue(
        new Promise<() => void>((resolve) => {
          finishPause = resolve
        }),
      )
      const importMock =
        source === 'remote'
          ? remoteSnapshotMocks.restoreRemoteSnapshotBackup
          : source === 'zip'
            ? resourcePackageMocks.importDataManagerResourcePackage
            : services.dataManager.importAllData
      const operation = source === 'remote' ? state.handleRemoteRestore() : state.handleImport()
      await vi.waitFor(() => expect(sessionMocks.beginSessionRestore).toHaveBeenCalledTimes(1))
      expect(importMock).not.toHaveBeenCalled()
      finishPause(sessionMocks.releaseRestore)
      await operation
      expect(importMock).toHaveBeenCalledTimes(1)
      expect(wrapper.emitted('imported')).toHaveLength(1)
      expect(sessionMocks.releaseRestore).not.toHaveBeenCalled()
      wrapper.unmount()
      expect(sessionMocks.releaseRestore).not.toHaveBeenCalled()
    },
  )

  it.each(['json', 'zip', 'remote'])('resumes saving after a failed %s restore', async (source) => {
    allowConsole(/^(Import failed:|\[DataManager\] Remote restore failed:)/)
    const services = createServices()
    const wrapper = mountComponent(services)
    await flushPromises()
    const state = await connectRemote(wrapper)
    state.selectedFile = {
      id: 'backup',
      name: `backup.${source}`,
      file: new File(['{}'], `backup.${source}`),
    }
    state.importPreviewState = 'success'
    const importMock =
      source === 'remote'
        ? remoteSnapshotMocks.restoreRemoteSnapshotBackup
        : source === 'zip'
          ? resourcePackageMocks.importDataManagerResourcePackage
          : services.dataManager.importAllData
    importMock.mockRejectedValue(new Error('invalid backup'))
    await (source === 'remote' ? state.handleRemoteRestore() : state.handleImport())
    expect(sessionMocks.beginSessionRestore).toHaveBeenCalledTimes(1)
    expect(sessionMocks.releaseRestore).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('imported')).toBeUndefined()
    wrapper.unmount()
  })

  it.each(['json', 'zip', 'remote'])(
    'defers %s import when the app reports a running workspace operation',
    async (source) => {
      const services = createServices()
      const wrapper = mountComponent(services)
      const prepareRestore = vi.fn().mockResolvedValue(null)
      await wrapper.setProps({ prepareRestore })
      const state = await connectRemote(wrapper)
      state.selectedFile = {
        id: 'backup',
        name: `backup.${source}`,
        file: new File(['{}'], `backup.${source}`),
      }
      state.importPreviewState = 'success'
      await (source === 'remote' ? state.handleRemoteRestore() : state.handleImport())
      expect(prepareRestore).toHaveBeenCalledTimes(1)
      expect(sessionMocks.beginSessionRestore).not.toHaveBeenCalled()
      expect(services.dataManager.importAllData).not.toHaveBeenCalled()
      expect(resourcePackageMocks.importDataManagerResourcePackage).not.toHaveBeenCalled()
      expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).not.toHaveBeenCalled()
      expect(wrapper.emitted('imported')).toBeUndefined()
      expect(state.isImporting).toBe(false)
      expect(state.isRestoringRemote).toBe(false)
      wrapper.unmount()
    },
  )

  it('releases the app restore lease on failure and holds it on success', async () => {
    allowConsole(/^Import failed:/)
    const services = createServices()
    const wrapper = mountComponent(services)
    const release = vi.fn()
    const prepareRestore = vi.fn().mockResolvedValue(release)
    await wrapper.setProps({ prepareRestore })
    const state = (wrapper.vm as any).$?.setupState.controller
    state.selectedFile = {
      id: 'backup',
      name: 'backup.json',
      file: new File(['{}'], 'backup.json'),
    }
    state.importPreviewState = 'success'
    services.dataManager.importAllData.mockRejectedValueOnce(new Error('invalid backup'))
    await state.handleImport()
    expect(release).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('imported')).toBeUndefined()
    await state.handleImport()
    expect(release).toHaveBeenCalledTimes(1)
    expect(prepareRestore).toHaveBeenCalledTimes(2)
    expect(sessionMocks.beginSessionRestore).not.toHaveBeenCalled()
    expect(wrapper.emitted('imported')).toHaveLength(1)
    wrapper.unmount()
  })

  afterEach(() => {
    delete (window as any).electronAPI
    delete (window as any).google
  })

  it('shows storage usage on web and keeps cache/favorite items separate', async () => {
    const wrapper = mountComponent()

    await flushPromises()
    await wrapper.get('.n-collapse-item__header-main').trigger('click')
    await flushPromises()

    const modal = wrapper.find('.n-modal')
    const text = wrapper.text()
    expect(modal.attributes('style')).toContain('width: calc(100vw - 32px);')
    expect(modal.attributes('style')).toContain('max-width: 960px;')
    expect(modal.attributes('style')).toContain('max-height: 90vh;')
    expect(wrapper.findAll('.storage-stat-card')).toHaveLength(4)
    expect(wrapper.get('[data-testid="device-storage-total"]').attributes('aria-label')).toContain(
      'used',
    )
    expect(text).toContain('Authorize connection')
    expect(text).not.toContain('Detect')
    expect(text).toContain('App Main Data (Estimated)')
    expect(text).toContain('Session/Result Image Cache')
    expect(text).toContain('Favorite Images')
    expect(text).toContain('saved workspace drafts and test results')
    expect(text).not.toContain('current workspace sessions are not included')
    expect(text).toContain('2 images')
    expect(text).toContain('1 images')
    expect(text).not.toContain('上下文集合')
    expect(text).not.toContain('导出上下文集合')
    expect(text).not.toContain('导入上下文集合')
    expect(text).not.toContain('Backup Data')
    expect(text).not.toContain('Data directory')
    expect(text).not.toContain('Backup folder')
    expect(text).not.toContain('Scheduled backup')
  })

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
    await wrapper.get('[data-testid="manage-cloud-connection"]').trigger('click')

    await flushPromises()
    await wrapper.get('.n-collapse-item__header-main').trigger('click')
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('Backup Data')
    expect(text).not.toContain('Google Drive is not supported on Desktop yet')
    expect(text).not.toContain('Authorize connection')
    expect(text).toContain('C:/PromptOptimizer/data')
    expect(text).toContain('Open directory')
    expect(text).toContain('Refresh')
  })

  it('shows local usage immediately and keeps all three areas together without extra reads', async () => {
    const services = createServices()
    const wrapper = mountComponent(services)
    await flushPromises()
    const state = (wrapper.vm as any).$?.setupState.controller
    expect(wrapper.get('[data-testid="device-storage-total"]').attributes('aria-label')).toContain(
      'used',
    )
    expect(wrapper.get('[data-testid="local-files-panel"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="cloud-backups-panel"]').isVisible()).toBe(true)
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(0)
    expect(services.imageStorageService.getStorageStats).toHaveBeenCalledTimes(1)
    state.openConnectionSettings()
    state.closeConnectionSettings()
    state.showCodeImport = true
    await flushPromises()
    expect(services.imageStorageService.getStorageStats).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="restore-confirmation"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('shows Google Drive as authorized after the authorization flow returns a token', async () => {
    getEnvVarMock.mockImplementation((key: string) =>
      key === 'VITE_GOOGLE_DRIVE_CLIENT_ID'
        ? 'configured-client-id.apps.googleusercontent.com'
        : '',
    )
    ;(window as any).google = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn(
            (config: {
              callback: (response: { access_token: string; expires_in: number }) => void
            }) => ({
              requestAccessToken: vi.fn(() =>
                config.callback({ access_token: 'access-token', expires_in: 3600 }),
              ),
            }),
          ),
        },
      },
    }

    const wrapper = mountComponent()
    await flushPromises()

    await wrapper.get('[data-testid="connect-cloud-account"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="manage-cloud-connection"]').text()).toBe('Connection settings')
    expect(wrapper.get('[data-testid="remote-backup-create"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="remote-backup-refresh"]').isVisible()).toBe(true)
    await wrapper.get('[data-testid="manage-cloud-connection"]').trigger('click')
    expect(wrapper.get('[data-testid="data-storage-panel"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="remote-google-authorize"]').text()).toBe('Authorized')
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    const reloaded = mountComponent()
    await flushPromises()
    await reloaded.get('[data-testid="manage-cloud-connection"]').trigger('click')
    expect(reloaded.get('[data-testid="remote-google-authorize"]').text()).toBe('Authorized')
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(2)
    expect((window as any).google.accounts.oauth2.initTokenClient).toHaveBeenCalledTimes(1)
    reloaded.unmount()
  })

  it('replaces the empty-list placeholder with a failure when the cached token expires', async () => {
    getEnvVarMock.mockImplementation((key: string) =>
      key === 'VITE_GOOGLE_DRIVE_CLIENT_ID' ? 'expires-in-dialog' : '',
    )
    const key = 'prompt-optimizer:google-drive-token:expires-in-dialog'
    localStorage.setItem(
      key,
      JSON.stringify({ accessToken: 'test-token', expiresAt: Date.now() + 3600_000 }),
    )
    const wrapper = mountComponent()
    await flushPromises()
    const state = (wrapper.vm as any).$?.setupState.controller
    expect(state.remoteListState).toBe('success')
    const expired = JSON.stringify({ accessToken: 'test-token', expiresAt: 1 })
    localStorage.setItem(key, expired)
    await state.refreshRemoteBackups()
    expect(state.remoteListState).toBe('error')
    expect(state.remoteListPlaceholder).not.toBe('No remote backups')
    await flushPromises()
    expect(wrapper.get('[data-testid="remote-list-status"]').text()).toContain('Reauthorize')
    expect(wrapper.get('[data-testid="connect-cloud-account"]').text()).toBe('Reauthorize')
    expect(wrapper.find('[data-testid="remote-backup-create"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="remote-backup-refresh"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="remote-maintenance"]').exists()).toBe(false)
    expect(localStorage.getItem(key)).toBe(expired)
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('discards the old account list after explicit reauthorization succeeds', async () => {
    getEnvVarMock.mockImplementation((key: string) =>
      key === 'VITE_GOOGLE_DRIVE_CLIENT_ID' ? 'reauth-client' : '',
    )
    const key = 'prompt-optimizer:google-drive-token:reauth-client'
    localStorage.setItem(
      key,
      JSON.stringify({ accessToken: 'old-account', expiresAt: Date.now() + 3600_000 }),
    )
    ;(window as any).google = {
      accounts: {
        oauth2: {
          initTokenClient: ({ callback }: any) => ({
            requestAccessToken: () => callback({ access_token: 'new-account', expires_in: 3600 }),
          }),
        },
      },
    }
    const old = deferred()
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockReturnValueOnce(old.promise)
    const wrapper = mountComponent()
    await flushPromises()
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockResolvedValueOnce([snapshot('new-account')])
    await wrapper.get('[data-testid="remote-google-authorize"]').trigger('click')
    await flushPromises()
    old.resolve([snapshot('old-account')])
    await flushPromises()
    const state = (wrapper.vm as any).$?.setupState.controller
    expect(state.remoteBackups.map((item: any) => item.id)).toEqual(['new-account'])
    expect(JSON.parse(localStorage.getItem(key)!).accessToken).toBe('new-account')
    wrapper.unmount()
  })

  it('shows R2 credentials independently of its optional setup guide', async () => {
    localStorage.setItem(
      remoteBackup.REMOTE_BACKUP_SETTINGS_KEY,
      JSON.stringify({
        provider: {
          kind: 'cloudflare-r2',
          accountId: 'account',
          bucket: 'backups',
          accessKeyId: '',
          secretAccessKey: '',
        },
      }),
    )
    const wrapper = mountComponent()
    const panel = wrapper.get('[data-testid="data-storage-panel"]')
    expect(panel.isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="manage-cloud-connection"]').text()).toBe(
      'Connection settings',
    )
    expect(panel.text()).not.toContain('Google Drive is recommended for Web')
    expect(panel.findAll('input')).toHaveLength(4)
    expect(panel.text()).not.toContain('Use path-style S3 URLs')
    expect(wrapper.find('[data-testid="remote-backup-create"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="remote-backup-refresh"]').exists()).toBe(false)
    expect(panel.find('[data-testid="remote-maintenance"]').exists()).toBe(false)
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('opens saved connection fields with one toggle and keeps the same button label', async () => {
    savedWebDav()
    const wrapper = mountComponent()
    await flushPromises()
    const state = (wrapper.vm as any).$?.setupState.controller
    expect(wrapper.get('[data-testid="manage-cloud-connection"]').text()).toBe(
      'Connection settings',
    )
    state.openConnectionSettings()
    await flushPromises()
    expect(state.showConnectionSettings).toBe(true)
    expect(wrapper.get('[data-testid="manage-cloud-connection"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-testid="data-storage-panel"]').findAll('input')).toHaveLength(4)
    await wrapper.get('[data-testid="manage-cloud-connection"]').trigger('click')
    expect(state.showConnectionSettings).toBe(false)
    wrapper.unmount()
  })
  it('collapses configuration after connecting successfully but leaves failed attempts editable', async () => {
    savedWebDav()
    const wrapper = mountComponent()
    await flushPromises()
    const state = (wrapper.vm as any).$?.setupState.controller
    await wrapper.get('[data-testid="manage-cloud-connection"]').trigger('click')
    const panel = wrapper.get('[data-testid="data-storage-panel"]')
    const input = panel.findAll('input')[0]!.element
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockRejectedValueOnce(new Error('offline'))
    await state.handleRemoteSaveAndConnect()
    await flushPromises()
    expect(panel.isVisible()).toBe(true)
    expect(panel.text()).toContain('offline')
    await state.handleRemoteSaveAndConnect()
    await flushPromises()
    expect(state.showConnectionSettings).toBe(false)
    expect(wrapper.get('.connection-editor').attributes('style')).toContain('display: none')
    expect(wrapper.get('[data-testid="remote-list-status"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="manage-cloud-connection"]').attributes('aria-expanded')).toBe('false')
    await wrapper.get('[data-testid="manage-cloud-connection"]').trigger('click')
    expect(panel.findAll('input')[0]!.element).toBe(input)
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(3)
    wrapper.unmount()
  })

  it('does not collapse another provider configuration when an old connection completes', async () => {
    savedWebDav()
    const wrapper = mountComponent()
    await flushPromises()
    const state = (wrapper.vm as any).$?.setupState.controller
    state.openConnectionSettings()
    const pending = deferred()
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockReturnValueOnce(pending.promise)
    const connecting = state.handleRemoteSaveAndConnect()
    await flushPromises()
    state.handleRemoteProviderChange('s3-compatible')
    pending.resolve([snapshot('old')])
    await connecting
    await flushPromises()
    expect(state.showConnectionSettings).toBe(true)
    expect(state.remoteSettings.provider.kind).toBe('s3-compatible')
    expect(state.remoteBackups).toEqual([])
    wrapper.unmount()
  })

  it('allows collapsing non-Google configuration after a connection failure', async () => {
    window.localStorage.setItem(
      'prompt-optimizer:remote-backup-settings',
      JSON.stringify({
        provider: {
          kind: 'cloudflare-r2',
          accountId: 'account-123',
          bucket: 'prompt-optimizer-backups',
          accessKeyId: 'ak',
          secretAccessKey: 'sk',
        },
      }),
    )
    const wrapper = mountComponent()
    await flushPromises()

    const setupState = (wrapper.vm as any).$?.setupState.controller
    setupState.remoteConnectionStates = {
      ...setupState.remoteConnectionStates,
      'cloudflare-r2': {
        ...setupState.remoteConnectionStates['cloudflare-r2'],
        status: 'failed',
        message: 'boom',
      },
    }
    setupState.openConnectionSettings()
    await flushPromises()

    expect(wrapper.text()).toContain('boom')
    expect(wrapper.get('[data-testid="data-storage-panel"]').findAll('input')).toHaveLength(4)

    await wrapper.get('[data-testid="manage-cloud-connection"]').trigger('click')
    await flushPromises()
    expect(setupState.showConnectionSettings).toBe(false)
    expect(wrapper.get('.connection-editor').attributes('style')).toContain('display: none')
    expect(wrapper.text()).toContain('boom')
    expect(wrapper.text()).not.toContain('Cloudflare R2 is configured')
    expect(wrapper.get('[data-testid="remote-backup-refresh"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="remote-backup-create"]').attributes('disabled')).toBeUndefined()
  })

  it('auto-connects saved direct storage settings before refreshing remote backups', async () => {
    window.localStorage.setItem(
      'prompt-optimizer:remote-backup-settings',
      JSON.stringify({
        provider: {
          kind: 'webdav',
          endpoint: 'https://dav.example.test',
          username: '',
          password: '',
          directory: 'prompt-optimizer-backups',
        },
      }),
    )
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

      const refreshButton = wrapper
        .findAll('button')
        .find((button) => button.text().includes('Refresh Remote Backup List'))
      expect(refreshButton).toBeTruthy()
      await refreshButton!.trigger('click')
      await flushPromises()

      // The mocked list is the sole connection check; no synthetic write/delete probe.
      expect(fetchMock).not.toHaveBeenCalled()
      expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(2)
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
    window.localStorage.setItem(
      'prompt-optimizer:remote-backup-settings',
      JSON.stringify({
        provider: {
          kind: 'cloudflare-r2',
          accountId: 'account-123',
          bucket: 'prompt-optimizer-backups',
          accessKeyId: '',
          secretAccessKey: '',
        },
      }),
    )

    const wrapper = mountComponent()
    await flushPromises()

    const state = (wrapper.vm as any).$?.setupState.controller
    state.openCloudflareR2Link('buckets')
    await flushPromises()

    expect(openExternal).toHaveBeenCalledWith('https://dash.cloudflare.com/account-123/r2/overview')
    expect(openSpy).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })

  it('restores remote backups without reusing the selected local import file sections', async () => {
    window.localStorage.setItem(
      'prompt-optimizer:remote-backup-settings',
      JSON.stringify({
        provider: {
          kind: 'cloudflare-r2',
          accountId: 'account-123',
          bucket: 'prompt-optimizer-backups',
          accessKeyId: 'ak',
          secretAccessKey: 'sk',
        },
      }),
    )

    const wrapper = mountComponent()
    await flushPromises()

    const setupState = (wrapper.vm as any).$?.setupState.controller
    expect(setupState).toBeTruthy()
    setupState.remoteConnectionStates = {
      ...setupState.remoteConnectionStates,
      'cloudflare-r2': {
        ...setupState.remoteConnectionStates['cloudflare-r2'],
        status: 'connected',
      },
    }
    setupState.remoteBackups = [
      {
        id: 'snap-1',
        name: 'snap-1',
        manifestPath: 'v1/snapshots/snap-1/manifest.json',
        updatedAt: '2026-05-06T10:30:00.000Z',
        manifest: {
          includedSections: ['appData', 'favorites', 'imageCache', 'favoriteImages'],
        },
      },
    ]
    setupState.restoreSource = 'cloud'
    setupState.selectedRemoteBackupId = 'snap-1'
    setupState.availableImportSections = new Set(['appData'])
    setupState.importFavorites = false
    setupState.importAppDataImages = false
    await flushPromises()

    const restoreButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Confirm restore'))
    expect(restoreButton).toBeTruthy()
    await restoreButton!.trigger('click')
    await flushPromises()

    expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotId: 'snap-1',
        sections: {
          appData: true,
          favorites: true,
          imageCache: true,
          favoriteImages: true,
        },
      }),
    )
  })

  it('allows remote restore to skip image sections from a partial backup', async () => {
    window.localStorage.setItem(
      'prompt-optimizer:remote-backup-settings',
      JSON.stringify({
        provider: {
          kind: 'cloudflare-r2',
          accountId: 'account-123',
          bucket: 'prompt-optimizer-backups',
          accessKeyId: 'ak',
          secretAccessKey: 'sk',
        },
      }),
    )

    const wrapper = mountComponent()
    await flushPromises()

    const setupState = (wrapper.vm as any).$?.setupState.controller
    setupState.remoteConnectionStates = {
      ...setupState.remoteConnectionStates,
      'cloudflare-r2': {
        ...setupState.remoteConnectionStates['cloudflare-r2'],
        status: 'connected',
      },
    }
    setupState.remoteBackups = [
      {
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
      },
    ]
    setupState.restoreSource = 'cloud'
    setupState.selectedRemoteBackupId = 'snap-partial'
    await flushPromises()

    setupState.remoteRestoreAppData = true
    setupState.remoteRestoreFavorites = true
    setupState.remoteRestoreAppDataImages = false
    setupState.remoteRestoreFavoriteImages = false
    await flushPromises()

    const restoreButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Confirm restore'))
    expect(restoreButton).toBeTruthy()
    await restoreButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('missing image resources')
    expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotId: 'snap-partial',
        sections: {
          appData: true,
          favorites: true,
          imageCache: false,
          favoriteImages: false,
        },
      }),
    )
  })

  it('serializes two backup requests started in the same turn', async () => {
    const wrapper = mountComponent()
    const state = await connectRemote(wrapper)
    const pending = deferred()
    remoteSnapshotMocks.createRemoteSnapshotBackup.mockReturnValueOnce(pending.promise)
    const first = state.handleRemoteUpload()
    const second = state.handleRemoteUpload()
    await flushPromises()
    expect(remoteSnapshotMocks.createRemoteSnapshotBackup).toHaveBeenCalledTimes(1)
    pending.resolve({
      entry: snapshot('created'),
      missingAssets: [],
      uploadedAssets: 0,
      skippedAssets: 0,
    })
    await Promise.all([first, second])
    wrapper.unmount()
  })

  it('disables remote backup actions while a remote data operation is running', async () => {
    window.localStorage.setItem(
      'prompt-optimizer:remote-backup-settings',
      JSON.stringify({
        provider: {
          kind: 'cloudflare-r2',
          accountId: 'account-123',
          bucket: 'prompt-optimizer-backups',
          accessKeyId: 'ak',
          secretAccessKey: 'sk',
        },
      }),
    )
    const wrapper = mountComponent()
    await flushPromises()

    const setupState = (wrapper.vm as any).$?.setupState.controller
    setupState.remoteBackups = [
      {
        id: 'snap-1',
        name: 'snap-1',
        manifestPath: 'v1/snapshots/snap-1/manifest.json',
      },
    ]
    setupState.restoreSource = 'cloud'
    setupState.selectedRemoteBackupId = 'snap-1'
    await flushPromises()

    const remoteActionButton = (label: string) => {
      const button = wrapper.findAll('button').find((candidate) => candidate.text().includes(label))
      expect(button, label).toBeTruthy()
      return button!
    }

    const buttons = [
      remoteActionButton('Create cloud backup'),
      remoteActionButton('Refresh Remote Backup List'),
      remoteActionButton('Clean Unreferenced Images'),
      remoteActionButton('Confirm restore'),
    ]
    expect(buttons.every((button) => (button.element as HTMLButtonElement).disabled)).toBe(false)

    setupState.isLoadingRemoteList = true
    await flushPromises()

    expect(buttons.every((button) => (button.element as HTMLButtonElement).disabled)).toBe(true)
  })
  it('requires a new confirmation after editing an import code', async () => {
    const wrapper = mountComponent()
    const state = await connectRemote(wrapper)
    state.remoteImportCode = createRemoteBackupImportCode(state.remoteSettings.provider, 'target')
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockResolvedValue([snapshot('target')])
    await state.handleRemoteCodeImport()
    await flushPromises()
    expect(state.selectedRemoteBackupId).toBe('target')
    expect(state.canRestoreSelection).toBe(true)
    expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).not.toHaveBeenCalled()
    state.remoteImportCode = 'another-code'
    await flushPromises()
    expect(state.selectedRemoteBackupId).toBeNull()
    expect(state.canRestoreSelection).toBe(false)
    await state.handleRemoteRestore()
    expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('keeps sources independent while retaining the local file draft', async () => {
    const wrapper = mountComponent()
    const state = await connectRemote(wrapper)
    state.selectedFile = { id: 'local', name: 'local.json', file: new File(['{}'], 'local.json') }
    state.importPreviewState = 'success'
    state.restoreSource = 'local'
    await flushPromises()
    expect(wrapper.get('[data-testid="restore-confirmation"]').text()).toContain('local.json')
    state.restoreSource = 'code'
    await flushPromises()
    expect(wrapper.find('[data-testid="restore-confirmation"]').exists()).toBe(false)
    state.restoreSource = 'cloud'
    await flushPromises()
    expect(wrapper.get('[data-testid="restore-confirmation"]').text()).toContain('snap-1')
    expect(state.selectedFile.name).toBe('local.json')
    wrapper.unmount()
  })

  it('ignores stale file reads and rejects invalid files before confirmation', async () => {
    const readers: any[] = []
    const OriginalFileReader = globalThis.FileReader
    globalThis.FileReader = class {
      result: ArrayBuffer | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsArrayBuffer() {
        readers.push(this)
      }
    } as any
    const wrapper = mountComponent()
    try {
      const state = (wrapper.vm as any).$?.setupState.controller
      state.handleFileChange({
        fileList: [{ id: 'old', name: 'old.json', file: new File(['{}'], 'old.json') }],
      })
      state.handleFileChange({
        fileList: [
          state.selectedFile,
          { id: 'new', name: 'new.json', file: new File(['broken'], 'new.json') },
        ],
      })
      readers[1].result = new TextEncoder().encode('broken').buffer
      readers[1].onload()
      await flushPromises()
      expect(state.importPreviewState).toBe('error')
      readers[0].result = new TextEncoder().encode('{}').buffer
      readers[0].onload()
      await flushPromises()
      expect(state.importPreviewState).toBe('error')
      expect(state.selectedFile.name).toBe('new.json')
      expect(state.canRestoreSelection).toBe(false)
      expect(wrapper.find('[data-testid="restore-confirmation"]').exists()).toBe(false)
    } finally {
      wrapper.unmount()
      globalThis.FileReader = OriginalFileReader
    }
  })

  it('keeps the destination label consistent with the active cloud connection', async () => {
    savedWebDav()
    const wrapper = mountComponent()
    await flushPromises()
    const state = (wrapper.vm as any).$?.setupState.controller
    expect(state.currentProviderName).toBe('WebDAV')
    state.handleRemoteProviderChange('s3-compatible')
    await flushPromises()
    expect(state.remoteSettings.provider.kind).toBe('s3-compatible')
    expect(state.isCurrentRemoteProviderConfigured).toBe(false)
    expect(state.selectedRemoteBackupId).toBeNull()
    expect(wrapper.find('[data-testid="remote-backup-create"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="remote-backup-refresh"]').exists()).toBe(false)
    const calls = remoteSnapshotMocks.listRemoteSnapshotBackups.mock.calls.length
    Object.assign(state.remoteSettings.provider, {
      endpoint: 'https://s3.example.test',
      bucket: 'backups',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
    })
    state.markRemoteSettingsDirty()
    await flushPromises()
    expect(wrapper.get('[data-testid="remote-backup-create"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="remote-backup-refresh"]').isVisible()).toBe(true)
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).toHaveBeenCalledTimes(calls)
    state.remoteSettings.provider.secretAccessKey = ''
    state.markRemoteSettingsDirty()
    await flushPromises()
    expect(wrapper.find('[data-testid="remote-backup-create"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="remote-backup-refresh"]').exists()).toBe(false)
    state.handleRemoteProviderChange('webdav')
    await flushPromises()
    expect(wrapper.get('[data-testid="remote-backup-create"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="remote-backup-refresh"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="local-backup-create"]').isVisible()).toBe(true)
    wrapper.unmount()
  })

  it('keeps one upload running across tasks and blocks conflicting local operations', async () => {
    const wrapper = mountComponent()
    const state = await connectRemote(wrapper)
    const pending = deferred()
    remoteSnapshotMocks.createRemoteSnapshotBackup.mockReturnValueOnce(pending.promise)
    const uploading = state.handleRemoteUpload()
    await flushPromises()
    state.openConnectionSettings()
    await flushPromises()
    expect(wrapper.find('.task-global-progress').exists()).toBe(true)
    await state.handleExport()
    await state.handleRemoteCleanup()
    expect(resourcePackageMocks.createDataManagerResourcePackage).not.toHaveBeenCalled()
    expect(state.isUploadingRemote).toBe(true)
    pending.resolve({
      entry: snapshot('created'),
      missingAssets: [],
      uploadedAssets: 0,
      skippedAssets: 0,
    })
    await uploading
    state.viewCreatedBackup()
    await flushPromises()
    expect(state.restoreSource).toBeNull()
    expect(wrapper.find('[data-testid="restore-confirmation"]').exists()).toBe(false)
    expect(state.selectedRemoteBackupId).toBe('created')
    expect(remoteSnapshotMocks.createRemoteSnapshotBackup).toHaveBeenCalledTimes(1)
    expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('bounds the backup list, searches metadata and keeps explicit selection', async () => {
    const entries = Array.from({ length: 300 }, (_, index) => ({
      id: `snapshot-${index}`,
      name: `backup-${index}`,
      manifestPath: '',
      updatedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    }))
    const wrapper = mount(BackupRecords, {
      props: { entries, search: '', selectedId: null, disabled: false },
      global: { stubs: naiveStubs },
    })
    expect(wrapper.findAll('[data-backup-id]')).toHaveLength(20)
    expect(wrapper.findAll('[data-backup-id]')[0]!.attributes('data-backup-id')).toBe(
      'snapshot-299',
    )
    await wrapper.setProps({ search: 'backup-123' })
    expect(wrapper.findAll('[data-backup-id]')).toHaveLength(1)
    await wrapper
      .get('[data-backup-id="snapshot-123"] [data-testid="record-restore"]')
      .trigger('click')
    expect(wrapper.emitted('select')).toEqual([['snapshot-123']])
    await wrapper.setProps({ search: '', selectedId: 'snapshot-123' })
    await flushPromises()
    expect(wrapper.findAll('[data-backup-id]')).toHaveLength(20)
    expect(
      wrapper
        .get('[data-backup-id="snapshot-123"] [data-testid="record-restore"]')
        .attributes('aria-expanded'),
    ).toBe('true')
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('preserves a mobile draft while hiding connection settings and resizing', async () => {
    compactViewport.value = true
    const services = createServices()
    const wrapper = mountComponent(services)
    const state = (wrapper.vm as any).$?.setupState.controller
    state.handleRemoteProviderChange('webdav')
    await flushPromises()
    expect(wrapper.get('[data-testid="data-storage-panel"]').isVisible()).toBe(true)
    const endpoint = wrapper.get('[data-testid="data-storage-panel"]').findAll('input')[0]!
    await endpoint.setValue('https://mobile-draft.invalid/dav')
    const node = endpoint.element
    const loads = services.imageStorageService.getStorageStats.mock.calls.length
    await wrapper.get('[data-testid="manage-cloud-connection"]').trigger('click')
    compactViewport.value = false
    await flushPromises()
    await wrapper.get('[data-testid="manage-cloud-connection"]').trigger('click')
    expect(wrapper.get('[data-testid="data-storage-panel"]').findAll('input')[0]!.element).toBe(
      node,
    )
    expect((node as HTMLInputElement).value).toBe('https://mobile-draft.invalid/dav')
    expect(services.imageStorageService.getStorageStats.mock.calls.length).toBe(loads)
    expect(remoteSnapshotMocks.listRemoteSnapshotBackups).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('keeps failures visible in the storage total instead of presenting zero usage', async () => {
    const services = createServices()
    services.dataManager.exportAllData.mockRejectedValue(new Error('unavailable'))
    services.favoriteManager.exportFavorites.mockRejectedValue(new Error('unavailable'))
    services.imageStorageService.getStorageStats.mockRejectedValue(new Error('unavailable'))
    services.favoriteImageStorageService.getStorageStats.mockRejectedValue(new Error('unavailable'))
    const wrapper = mountComponent(services)
    await flushPromises()
    expect(wrapper.get('[data-testid="device-storage-total"]').text()).toBe(
      'Storage usage unavailable',
    )
    services.imageStorageService.getStorageStats.mockResolvedValue({
      count: 1,
      totalBytes: 2048,
      oldestAt: 1,
      newestAt: 1,
    })
    await wrapper.get('[data-testid="storage-refresh"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="device-storage-total"]').text()).toBe('2 KB')
    expect(wrapper.text()).toContain('Some items could not be read')
    wrapper.unmount()
  })
  it('browses a record without starting restore and lets explicit restore be cancelled', async () => {
    savedWebDav()
    remoteSnapshotMocks.listRemoteSnapshotBackups.mockResolvedValueOnce([snapshot('chosen')])
    const wrapper = mountComponent()
    await flushPromises()
    await wrapper.get('[data-backup-id="chosen"]').trigger('click')
    expect(wrapper.find('[data-testid="restore-confirmation"]').exists()).toBe(false)
    await wrapper.get('[data-testid="remote-import-code-export"]').trigger('click')
    expect(wrapper.find('[data-testid="restore-confirmation"]').exists()).toBe(false)
    await wrapper.get('[data-testid="record-restore"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="restore-confirmation"]').exists()).toBe(true)
    await wrapper.get('[data-testid="cancel-restore"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="restore-confirmation"]').exists()).toBe(false)
    expect(remoteSnapshotMocks.restoreRemoteSnapshotBackup).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
