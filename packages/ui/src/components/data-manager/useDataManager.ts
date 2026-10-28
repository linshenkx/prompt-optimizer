import { completeSessionRestore } from '../../stores/session/sessionConcurrency'
import { ref, computed, inject, nextTick, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UploadFileInfo } from 'naive-ui'
import { isRunningInElectron } from '@prompt-optimizer/core'
import { useWorkspaceLayout } from '../../composables/ui/useWorkspaceLayout'
import { useToast } from '../../composables/ui/useToast'
import { useConfirmDialog } from '../../composables/ui/useConfirmDialog'
import type { AppServices } from '../../types/services'
import {
  DEFAULT_DATA_MANAGER_PACKAGE_SECTIONS,
  createDataManagerResourcePackage,
  getIncludedDataManagerPackageSections,
  importDataManagerResourcePackage,
  looksLikeDataManagerZipPackage,
  readDataManagerResourcePackage,
  type DataManagerFavoritesMergeStrategy,
  type DataManagerPackageSection,
  type DataManagerPackageSectionSelection,
  type DataManagerResourcePackageImportResult,
} from '../../utils/data-manager-resource-package'
import {
  resolveDataManagerStorageBreakdown,
  type StorageBreakdownItem,
  type StorageBreakdownItemKey,
  type StorageBreakdownSummary,
} from '../../utils/data-manager-storage'
import {
  CLOUDFLARE_R2_DEFAULT_BACKUP_PREFIX,
  createCloudflareR2CorsConfig,
  createRemoteObjectStore,
  createRemoteBackupFileName,
  GOOGLE_DRIVE_DEFAULT_BACKUP_FOLDER_NAME,
  getCloudflareR2DashboardLinks,
  getCloudflareR2Endpoint,
  getSupportedRemoteBackupProviders,
  isGoogleDriveRemoteBackupAuthorized,
  getGoogleDriveAuthorizationState,
  isGoogleDriveAuthorizationPersistent,
  GoogleDriveAuthorizationError,
  loadRemoteBackupSettings,
  rememberRemoteBackupProvider,
  saveRemoteBackupSettings,
  switchRemoteBackupProvider,
  type RemoteBackupProviderKind,
  type RemoteBackupProviderConfig,
  type RemoteBackupRuntime,
  type RemoteBackupSettings,
} from '../../utils/remote-backup'
import {
  analyzeRemoteSnapshotAssetCleanup,
  cleanupRemoteSnapshotAssets,
  createRemoteSnapshotBackup,
  listRemoteSnapshotBackups,
  UnreadableRemoteSnapshotsError,
  restoreRemoteSnapshotBackup,
  type RemoteSnapshotProgressEvent,
  type RemoteSnapshotEntry,
} from '../../utils/remote-snapshot-backup'
import { recordDataBackupCompleted } from '../../utils/data-backup-reminder'
import {
  BACKUP_IMPORT_QR_MAX_LENGTH,
  BackupImportCodeError,
  createRemoteBackupImportCode,
  createRemoteBackupImportUrl,
  parseRemoteBackupImportCode,
} from '../../utils/remote-backup-import-code'
import { openExternalUrl } from '../../utils/open-external-url'
import { formatErrorSummary } from '../../utils/error'
import { useSessionManager } from '../../stores/session/useSessionManager'

export interface DataManagerProps {
  show: boolean
  importCode?: string
  /** The app can defer import while model generation or mode switching is active. */
  prepareRestore?: () => Promise<(() => void) | null>
}

export interface DataManagerEmits {
  (e: 'close'): void
  (e: 'imported'): void
  (e: 'update:show', value: boolean): void
  (e: 'import-code-consumed'): void
}

export function useDataManager(props: DataManagerProps, emit: DataManagerEmits) {
  const { t: translate } = useI18n()
  const t = (key: string, values?: Record<string, unknown>): string => translate(key, values ?? {})
  const sessionManager = useSessionManager()
  const { isCompact } = useWorkspaceLayout()
  type DataTask = 'backup' | 'restore' | 'settings'
  const activeTab = ref<DataTask>('backup')
  const restoreSource = ref<'local' | 'cloud' | 'code'>('local')
  const backupDestination = ref<'local' | RemoteBackupProviderKind>('local')
  const returnTask = ref<'backup' | 'restore' | null>(null)
  const backupSearch = ref('')
  const scrollShell = ref<HTMLElement | null>(null)
  const tabScrollPositions = new Map<DataTask, number>()
  const backupResult = ref<{
    type: 'success' | 'warning' | 'error'
    message: string
    snapshotId?: string
  } | null>(null)
  const restoreError = ref('')
  const codeError = ref('')
  const importPreviewState = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
  const importPreviewError = ref('')
  let importPreviewRequest = 0
  let storageLoadedThisOpen = false
  watch(activeTab, async (tab, previous) => {
    tabScrollPositions.set(previous, scrollShell.value?.scrollTop ?? 0)
    await nextTick()
    if (activeTab.value === tab && scrollShell.value)
      scrollShell.value.scrollTop = tabScrollPositions.get(tab) ?? 0
  })
  const toast = useToast()
  const confirmDialog = useConfirmDialog()
  const isDesktopRuntime = isRunningInElectron()
  const remoteRuntime: RemoteBackupRuntime = isDesktopRuntime ? 'desktop' : 'web'
  const DATA_MANAGER_MODAL_MAX_WIDTH = '960px'
  const dataManagerModalStyle = {
    width: 'calc(100vw - 32px)',
    maxWidth: DATA_MANAGER_MODAL_MAX_WIDTH,
    maxHeight: '90vh',
    overflow: 'hidden',
  }

  const services = inject<Ref<AppServices | null>>('services')
  if (!services) {
    throw new Error(
      '[DataManager] Services were not injected correctly. Make sure App provides the services instance.',
    )
  }

  const getDataManager = computed(() => {
    const servicesValue = services.value
    if (!servicesValue) {
      throw new Error(
        '[DataManager] Services are not initialized. Make sure the application has started correctly.',
      )
    }

    const manager = servicesValue.dataManager
    if (!manager) {
      throw new Error(
        '[DataManager] DataManager is not initialized. Make sure the service is configured correctly.',
      )
    }

    return manager
  })

  const isExporting = ref(false)
  const isImporting = ref(false)
  const selectedFile = ref<UploadFileInfo | null>(null)
  const importPreviewText = ref('')
  const allPackageSections = Object.keys(
    DEFAULT_DATA_MANAGER_PACKAGE_SECTIONS,
  ) as DataManagerPackageSection[]
  const availableImportSections = ref(new Set<DataManagerPackageSection>(allPackageSections))
  const exportAppData = ref(true)
  const exportAppDataImages = ref(true)
  const exportFavorites = ref(true)
  const importAppData = ref(true)
  const importAppDataImages = ref(true)
  const importFavorites = ref(true)
  const remoteRestoreAppData = ref(true)
  const remoteRestoreAppDataImages = ref(true)
  const remoteRestoreFavorites = ref(true)
  const remoteRestoreFavoriteImages = ref(true)
  const favoriteMergeStrategy = ref<DataManagerFavoritesMergeStrategy>('overwrite')

  const storageSummary = ref<StorageBreakdownSummary | null>(null)
  const isRefreshingStorage = ref(false)
  const remoteSettings = ref<RemoteBackupSettings>(loadRemoteBackupSettings(remoteRuntime))

  type RemoteConnectionStatus = 'unconfigured' | 'unverified' | 'checking' | 'connected' | 'failed'

  type RemoteConnectionState = {
    status: RemoteConnectionStatus
    lastCheckedAt: number | null
    message: string
  }

  const createRemoteConnectionState = (): RemoteConnectionState => ({
    status: 'unconfigured',
    lastCheckedAt: null,
    message: '',
  })

  const isCloudflareR2ProviderConfigured = (provider: RemoteBackupProviderConfig): boolean =>
    provider.kind === 'cloudflare-r2' &&
    Boolean(
      provider.accountId.trim() &&
        provider.bucket.trim() &&
        provider.accessKeyId.trim() &&
        provider.secretAccessKey.trim(),
    )
  const isAuthorizingRemote = ref(false)
  const isGoogleDriveAuthorized = ref(isGoogleDriveRemoteBackupAuthorized())
  const googleAuthorizationState = ref<'missing' | 'expired' | 'ready' | 'rejected'>(
    getGoogleDriveAuthorizationState(),
  )
  const isConnectingRemote = computed(() => isAuthorizingRemote.value || isLoadingRemoteList.value)
  const isRemoteConfigExpanded = ref(false)
  const remoteConnectionStates = ref<Record<RemoteBackupProviderKind, RemoteConnectionState>>({
    'google-drive': createRemoteConnectionState(),
    'cloudflare-r2': createRemoteConnectionState(),
    's3-compatible': createRemoteConnectionState(),
    webdav: createRemoteConnectionState(),
  })
  const isUploadingRemote = ref(false)
  const isLoadingRemoteList = ref(false)
  const isRestoringRemote = ref(false)
  const isCleaningRemoteAssets = ref(false)
  const isImportingRemoteCode = ref(false)
  const remoteImportCode = ref('')
  const showRemoteImportCode = ref(false)
  const exportedRemoteImportCode = ref('')
  const remoteImportWebAddress = ref(
    ['https:', 'http:'].includes(window.location.protocol)
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://prompt.always200.com/',
  )
  const remoteImportQrUrl = computed(() => {
    if (!exportedRemoteImportCode.value) return ''
    try {
      const url = createRemoteBackupImportUrl(
        exportedRemoteImportCode.value,
        remoteImportWebAddress.value,
      )
      return new TextEncoder().encode(url).length <= BACKUP_IMPORT_QR_MAX_LENGTH ? url : ''
    } catch {
      return ''
    }
  })
  const isRemoteDataOperationActive = computed(
    () =>
      isExporting.value ||
      isImporting.value ||
      isAuthorizingRemote.value ||
      isImportingRemoteCode.value ||
      isUploadingRemote.value ||
      isLoadingRemoteList.value ||
      isRestoringRemote.value ||
      isCleaningRemoteAssets.value,
  )
  const isRemoteConnectionLocked = computed(
    () =>
      isExporting.value ||
      isImporting.value ||
      isAuthorizingRemote.value ||
      isImportingRemoteCode.value ||
      isUploadingRemote.value ||
      isRestoringRemote.value ||
      isCleaningRemoteAssets.value,
  )
  const remoteBackups = ref<RemoteSnapshotEntry[]>([])
  const remoteListState = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
  const remoteListError = ref('')
  const dirtyRemoteProviders = new Set<RemoteBackupProviderKind>()
  const autoLoadedProviders = new Set<RemoteBackupProviderKind>()
  let remoteConfigRevision = 0
  let remoteListRequestId = 0
  let pendingRemoteList: { revision: number; promise: Promise<boolean> } | null = null
  const cloudBackupId = ref<string | null>(null)
  const codeBackupId = ref<string | null>(null)
  const selectedRemoteBackupId = computed({
    get: () => (restoreSource.value === 'code' ? codeBackupId.value : cloudBackupId.value),
    set: (value) => {
      if (restoreSource.value === 'code') codeBackupId.value = value
      else cloudBackupId.value = value
    },
  })
  const remoteProgress = ref({
    active: false,
    percent: 0,
    message: '',
  })

  const storageLabelKeys: Record<StorageBreakdownItemKey, string> = {
    appMainData: 'dataManager.storage.appMainData',
    imageCache: 'dataManager.storage.imageCache',
    favoriteImages: 'dataManager.storage.favoriteImages',
    backupData: 'dataManager.storage.backupData',
  }

  const storageCardItemKeys: StorageBreakdownItemKey[] = [
    'appMainData',
    'imageCache',
    'favoriteImages',
  ]

  const providerLabelKeys: Record<RemoteBackupProviderKind, string> = {
    'google-drive': 'dataManager.remote.providers.googleDrive',
    'cloudflare-r2': 'dataManager.remote.providers.cloudflareR2',
    's3-compatible': 'dataManager.remote.providers.s3Compatible',
    webdav: 'dataManager.remote.providers.webdav',
  }

  const remoteProviderOptions = computed(() =>
    getSupportedRemoteBackupProviders(remoteRuntime).map((provider) => ({
      label: t(providerLabelKeys[provider]),
      value: provider,
    })),
  )

  const remoteRecommendationKey = computed(() =>
    isDesktopRuntime
      ? 'dataManager.remote.desktopRecommendation'
      : 'dataManager.remote.webRecommendation',
  )

  const googleDriveAuthorizationLabel = computed(() =>
    isGoogleDriveAuthorized.value
      ? t('dataManager.remote.authorizedGoogleDrive')
      : t(
          googleAuthorizationState.value === 'missing'
            ? 'dataManager.remote.authorizeGoogleDrive'
            : 'dataManager.remote.reauthorizeGoogleDrive',
        ),
  )

  const remoteListPlaceholder = computed(() => {
    if (remoteListState.value === 'loading') return t('dataManager.remote.listLoading')
    if (remoteListState.value === 'error') return t('dataManager.remote.listError')
    if (remoteListState.value === 'success' && !remoteBackups.value.length)
      return t('dataManager.remote.noBackups')
    return t(
      remoteListState.value === 'idle'
        ? 'dataManager.remote.listNotLoaded'
        : 'dataManager.remote.selectBackup',
    )
  })
  const remoteListMessage = computed(() => {
    if (remoteListState.value === 'error')
      return t('dataManager.remote.listFailed', { message: remoteListError.value })
    if (remoteSettings.value.provider.kind === 'google-drive' && !isGoogleDriveAuthorized.value) {
      return t(
        googleAuthorizationState.value === 'missing'
          ? 'dataManager.remote.authorizationRequired'
          : 'dataManager.remote.authorizationExpired',
      )
    }
    return remoteListState.value === 'success' && remoteBackups.value.length
      ? t('dataManager.remote.listLoaded', { count: remoteBackups.value.length })
      : remoteListPlaceholder.value
  })

  const selectedRemoteBackup = computed(
    () => remoteBackups.value.find((entry) => entry.id === selectedRemoteBackupId.value) ?? null,
  )
  const getRemoteBackupIncludedSectionSet = (
    entry: RemoteSnapshotEntry | null,
  ): Set<DataManagerPackageSection> => {
    const included = entry?.manifest?.includedSections
    if (!Array.isArray(included) || included.length === 0) {
      return new Set(allPackageSections)
    }

    const filtered = included.filter((section): section is DataManagerPackageSection =>
      allPackageSections.includes(section as DataManagerPackageSection),
    )
    return new Set(filtered.length > 0 ? filtered : allPackageSections)
  }
  const availableRemoteRestoreSections = computed(() =>
    getRemoteBackupIncludedSectionSet(selectedRemoteBackup.value),
  )
  const selectedRemoteBackupMissingAssetsCount = computed(() => {
    const missingAssets = selectedRemoteBackup.value?.manifest?.missingAssets
    return Array.isArray(missingAssets) ? missingAssets.length : 0
  })
  const resetRemoteRestoreSelection = () => {
    const available = availableRemoteRestoreSections.value
    remoteRestoreAppData.value = available.has('appData')
    remoteRestoreAppDataImages.value = available.has('imageCache')
    remoteRestoreFavorites.value = available.has('favorites')
    remoteRestoreFavoriteImages.value = available.has('favoriteImages')
  }
  const hasSelectedRemoteRestoreSection = computed(
    () =>
      (remoteRestoreAppData.value && availableRemoteRestoreSections.value.has('appData')) ||
      (remoteRestoreAppData.value &&
        remoteRestoreAppDataImages.value &&
        availableRemoteRestoreSections.value.has('imageCache')) ||
      (remoteRestoreFavorites.value && availableRemoteRestoreSections.value.has('favorites')) ||
      (remoteRestoreFavorites.value &&
        remoteRestoreFavoriteImages.value &&
        availableRemoteRestoreSections.value.has('favoriteImages')),
  )

  watch(selectedRemoteBackup, () => {
    resetRemoteRestoreSelection()
  })

  const cloudflareR2Provider = computed(() =>
    remoteSettings.value.provider.kind === 'cloudflare-r2' ? remoteSettings.value.provider : null,
  )

  const cloudflareR2Links = computed(() =>
    getCloudflareR2DashboardLinks(cloudflareR2Provider.value?.accountId ?? ''),
  )

  const cloudflareR2BucketPreview = computed(
    () => cloudflareR2Provider.value?.bucket.trim() || 'prompt-optimizer-backups',
  )

  const isRemoteProviderConfigured = (provider: RemoteBackupProviderConfig): boolean => {
    if (provider.kind === 'google-drive') return isGoogleDriveAuthorized.value
    if (provider.kind === 'cloudflare-r2') return isCloudflareR2ProviderConfigured(provider)
    if (provider.kind === 's3-compatible') {
      return Boolean(
        provider.endpoint.trim() &&
          provider.bucket.trim() &&
          provider.accessKeyId.trim() &&
          provider.secretAccessKey.trim(),
      )
    }
    return Boolean(provider.endpoint.trim() && provider.directory.trim())
  }

  if (
    remoteSettings.value.provider.kind !== 'google-drive' &&
    isRemoteProviderConfigured(remoteSettings.value.provider)
  ) {
    remoteConnectionStates.value[remoteSettings.value.provider.kind].status = 'unverified'
  }

  const currentRemoteConnection = computed(
    () => remoteConnectionStates.value[remoteSettings.value.provider.kind],
  )

  const isCurrentRemoteProviderConfigured = computed(() =>
    isRemoteProviderConfigured(remoteSettings.value.provider),
  )

  const isCurrentRemoteProviderConnected = computed(
    () =>
      remoteSettings.value.provider.kind !== 'google-drive' &&
      currentRemoteConnection.value.status === 'connected',
  )

  const showRemoteConfigForm = computed(
    () =>
      remoteSettings.value.provider.kind !== 'google-drive' &&
      (!isCurrentRemoteProviderConfigured.value || isRemoteConfigExpanded.value),
  )

  const currentRemoteConnectionLabel = computed(() =>
    t(`dataManager.remote.connectionStatus.${currentRemoteConnection.value.status}`),
  )

  const currentRemoteConnectionTitle = computed(() =>
    isCurrentRemoteProviderConnected.value
      ? t('dataManager.remote.connectionReadyTitle')
      : t('dataManager.remote.connectionSetupTitle'),
  )

  const currentRemoteConnectionMessage = computed(() => {
    const state = currentRemoteConnection.value
    if (state.message) return state.message
    if (!isCurrentRemoteProviderConfigured.value)
      return t('dataManager.remote.connectionMissingConfig')
    if (state.status === 'connected') return remoteConnectionSummary.value
    if (state.status === 'checking') return t('dataManager.remote.connectionChecking')
    return t('dataManager.remote.connectionNeedsCheck')
  })

  const currentRemoteConnectionTagType = computed<
    'default' | 'success' | 'warning' | 'error' | 'info'
  >(() => {
    const status = currentRemoteConnection.value.status
    if (status === 'connected') return 'success'
    if (status === 'failed') return 'error'
    if (status === 'checking') return 'info'
    return isCurrentRemoteProviderConfigured.value ? 'warning' : 'default'
  })

  const remoteConnectionSummary = computed(() => {
    const provider = remoteSettings.value.provider
    if (provider.kind === 'cloudflare-r2') {
      return t('dataManager.remote.connectionSummary.r2', {
        bucket: provider.bucket || cloudflareR2BucketPreview.value,
        path: `/${CLOUDFLARE_R2_DEFAULT_BACKUP_PREFIX}`,
      })
    }
    if (provider.kind === 's3-compatible') {
      return t('dataManager.remote.connectionSummary.s3', {
        bucket: provider.bucket || '-',
        path: provider.prefix || 'prompt-optimizer-backups/',
      })
    }
    if (provider.kind === 'webdav') {
      return t('dataManager.remote.connectionSummary.webdav', {
        path: provider.directory || 'prompt-optimizer-backups',
      })
    }
    return ''
  })

  const canImportFavoritesBundle = computed(() => availableImportSections.value.has('favorites'))

  const getBusinessSectionLabels = (sections: DataManagerPackageSection[]): string[] => {
    const set = new Set(sections)
    const labels: string[] = []
    if (set.has('appData')) {
      labels.push(t('dataManager.sections.appData'))
    }
    if (set.has('imageCache')) {
      labels.push(t('dataManager.sections.appDataImages'))
    }
    if (set.has('favorites')) {
      labels.push(t('dataManager.sections.favoritesBundle'))
    }
    return labels
  }

  const storageCardItems = computed<StorageBreakdownItem[]>(() =>
    storageCardItemKeys.map(
      (key) =>
        storageSummary.value?.items.find((item) => item.key === key) ?? {
          key,
          bytes: null,
          count: null,
          estimated: key === 'appMainData',
        },
    ),
  )

  const desktopBackupItem = computed<StorageBreakdownItem | null>(
    () => storageSummary.value?.items.find((item) => item.key === 'backupData') ?? null,
  )

  const canUseDesktopStorageTools = computed(
    () => isDesktopRuntime && Boolean(window.electronAPI?.data),
  )

  const refreshStorageSummary = async () => {
    try {
      isRefreshingStorage.value = true
      const servicesValue = services.value
      if (!servicesValue) {
        throw new Error(
          '[DataManager] Services are not initialized. Make sure the application has started correctly.',
        )
      }

      storageSummary.value = await resolveDataManagerStorageBreakdown({
        services: servicesValue,
        includeBackupData: isDesktopRuntime,
        electronDataApi: window.electronAPI?.data ?? null,
      })
    } catch (error) {
      console.error('Failed to get storage info:', error)
      toast.error(t('dataManager.storage.refreshFailed'))
    } finally {
      isRefreshingStorage.value = false
    }
  }

  const persistRemoteSettings = (markDirty = true) => {
    remoteSettings.value = rememberRemoteBackupProvider(remoteSettings.value)
    try {
      saveRemoteBackupSettings(remoteSettings.value)
    } catch {
      toast.warning(t('dataManager.remote.settingsNotSaved'))
    }
    const provider = remoteSettings.value.provider
    if (markDirty && provider.kind !== 'google-drive') {
      remoteConnectionStates.value = {
        ...remoteConnectionStates.value,
        [provider.kind]: {
          ...remoteConnectionStates.value[provider.kind],
          status: isRemoteProviderConfigured(provider) ? 'unverified' : 'unconfigured',
          lastCheckedAt: null,
          message: '',
        },
      }
      isRemoteConfigExpanded.value = true
    }
  }

  const invalidateRemoteList = () => {
    remoteConfigRevision += 1
    remoteListRequestId += 1
    pendingRemoteList = null
    isLoadingRemoteList.value = false
    remoteListState.value = 'idle'
    remoteListError.value = ''
    remoteBackups.value = []
    cloudBackupId.value = null
    codeBackupId.value = null
    if (backupResult.value?.snapshotId) backupResult.value = null
    finishRemoteProgress()
  }

  const markRemoteSettingsDirty = () => {
    dirtyRemoteProviders.add(remoteSettings.value.provider.kind)
    invalidateRemoteList()
    persistRemoteSettings()
  }

  const syncGoogleDriveAuthorizationState = () => {
    if (isDesktopRuntime && remoteSettings.value.provider.kind === 'google-drive') return
    isGoogleDriveAuthorized.value = isGoogleDriveRemoteBackupAuthorized()
    googleAuthorizationState.value = getGoogleDriveAuthorizationState()
  }

  const markGoogleDriveAuthorizationSuccess = () => {
    if (isDesktopRuntime && remoteSettings.value.provider.kind === 'google-drive') {
      isGoogleDriveAuthorized.value = true
      return
    }
    syncGoogleDriveAuthorizationState()
  }

  const handleRemoteProviderChange = (value: string) => {
    invalidateRemoteList()
    const kind = value as RemoteBackupProviderKind
    autoLoadedProviders.delete(kind)
    remoteSettings.value = switchRemoteBackupProvider(remoteSettings.value, kind)

    isRemoteConfigExpanded.value = false
    syncGoogleDriveAuthorizationState()
    persistRemoteSettings()
    void maybeAutoLoadRemoteBackups()
  }

  const getRemoteStore = () => createRemoteObjectStore(remoteSettings.value.provider, remoteRuntime)

  const phaseBasePercent: Record<RemoteSnapshotProgressEvent['phase'], number> = {
    prepare: 5,
    scan: 12,
    'asset-check': 20,
    'asset-upload': 28,
    'metadata-upload': 82,
    'manifest-upload': 92,
    list: 20,
    'restore-validate': 15,
    'restore-write': 78,
    'cleanup-analyze': 20,
    'cleanup-delete': 45,
    done: 100,
  }

  const phaseSpanPercent: Partial<Record<RemoteSnapshotProgressEvent['phase'], number>> = {
    scan: 8,
    'asset-check': 45,
    'asset-upload': 45,
    'metadata-upload': 8,
    'restore-validate': 55,
    'restore-write': 18,
    'cleanup-delete': 45,
  }

  const progressPercentFor = (event: RemoteSnapshotProgressEvent): number => {
    if (event.phase === 'done') return 100
    const base = phaseBasePercent[event.phase] ?? 5
    const span = phaseSpanPercent[event.phase] ?? 0
    if (!event.total || event.total <= 0 || !event.current) return base
    return Math.min(99, Math.max(0, Math.round(base + span * (event.current / event.total))))
  }

  const buildRemoteProgressMessage = (
    operation: 'backup' | 'list' | 'restore' | 'cleanup',
    event: RemoteSnapshotProgressEvent,
  ): string => {
    const count = event.current && event.total ? `${event.current}/${event.total}` : ''
    const params = {
      count,
      item: event.item || '',
      uploaded: event.uploaded ?? 0,
      skipped: event.skipped ?? 0,
      deleted: event.deleted ?? 0,
    }

    const key = `dataManager.remote.progress.${operation}.${event.phase}`
    const message = t(key, params)
    return message === key ? t('dataManager.remote.progress.working') : message
  }

  const startRemoteProgress = (
    operation: 'backup' | 'list' | 'restore' | 'cleanup',
    messageKey: string,
  ) => {
    remoteProgress.value = {
      active: true,
      percent: 3,
      message: t(messageKey),
    }
  }

  const updateRemoteProgress = (
    operation: 'backup' | 'list' | 'restore' | 'cleanup',
    event: RemoteSnapshotProgressEvent,
  ) => {
    remoteProgress.value = {
      active: true,
      percent: progressPercentFor(event),
      message: buildRemoteProgressMessage(operation, event),
    }
  }

  const finishRemoteProgress = (messageKey?: string) => {
    remoteProgress.value = {
      active: false,
      percent: 100,
      message: messageKey ? t(messageKey) : '',
    }
  }

  const openCloudflareR2Link = (key: 'dashboard' | 'buckets' | 'apiTokens' | 'docs') => {
    void openExternalUrl(cloudflareR2Links.value[key], { logPrefix: 'DataManager' })
  }

  const writeClipboardText = async (text: string): Promise<void> => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    try {
      document.execCommand('copy')
    } finally {
      document.body.removeChild(textarea)
    }
  }

  const copyCloudflareR2CorsConfig = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      await writeClipboardText(createCloudflareR2CorsConfig(origin))
      toast.success(t('dataManager.remote.copyCorsSuccess'))
    } catch (error) {
      console.error('[DataManager] Failed to copy Cloudflare R2 CORS config:', error)
      toast.error(t('dataManager.remote.copyCorsFailed'))
    }
  }

  const handleRemoteAuthorize = async () => {
    if (isRemoteConnectionLocked.value) return
    let authorized = false
    const revision = remoteConfigRevision
    try {
      persistRemoteSettings(false)
      isAuthorizingRemote.value = true
      const objectStore = getRemoteStore()
      if (!objectStore.authorize) {
        toast.warning(t('dataManager.remote.authorizeUnavailable'))
        return
      }
      await objectStore.authorize()
      if (revision !== remoteConfigRevision) return
      invalidateRemoteList()
      markGoogleDriveAuthorizationSuccess()
      authorized = true
      toast.success(t('dataManager.remote.authorizeSuccess'))
      if (!isGoogleDriveAuthorizationPersistent())
        toast.warning(t('dataManager.remote.authorizationNotSaved'))
    } catch (error) {
      console.error('[DataManager] Remote authorization failed:', error)
      toast.error(t('dataManager.remote.authorizeFailed', { message: (error as Error).message }))
    } finally {
      isAuthorizingRemote.value = false
    }
    if (authorized && props.show) await refreshRemoteBackups()
  }

  const setRemoteConnectionState = (
    provider: RemoteBackupProviderKind,
    state: Partial<RemoteConnectionState>,
  ) => {
    remoteConnectionStates.value = {
      ...remoteConnectionStates.value,
      [provider]: {
        ...remoteConnectionStates.value[provider],
        ...state,
      },
    }
  }

  const handleRemoteSaveAndConnect = async () => {
    if (isRemoteDataOperationActive.value || isAuthorizingRemote.value) return
    dirtyRemoteProviders.delete(remoteSettings.value.provider.kind)
    persistRemoteSettings(false)
    await refreshRemoteBackups()
  }

  const remoteOperationErrorMessage = (error: unknown): string => {
    if (error instanceof UnreadableRemoteSnapshotsError)
      return t('dataManager.remote.unreadableBackups')
    if (error instanceof GoogleDriveAuthorizationError) {
      isGoogleDriveAuthorized.value = false
      googleAuthorizationState.value = error.reason
      return t(
        error.reason === 'missing'
          ? 'dataManager.remote.authorizationRequired'
          : 'dataManager.remote.authorizationExpired',
      )
    }
    return error instanceof Error ? error.message : String(error)
  }

  // Permission checks belong to the requested operation, never a synthetic write/delete probe.
  const ensureRemoteConnectionReady = async (): Promise<boolean> => {
    const provider = remoteSettings.value.provider
    if (provider.kind === 'google-drive') {
      if (googleAuthorizationState.value !== 'rejected') syncGoogleDriveAuthorizationState()
      if (!isGoogleDriveAuthorized.value) {
        toast.warning(
          t(
            googleAuthorizationState.value === 'missing'
              ? 'dataManager.remote.authorizationRequired'
              : 'dataManager.remote.authorizationExpired',
          ),
        )
        return false
      }
    }
    if (isRemoteProviderConfigured(provider)) return true
    toast.warning(t('dataManager.remote.connectionMissingConfig'))
    isRemoteConfigExpanded.value = true
    return false
  }

  const refreshRemoteBackups = (): Promise<boolean> => {
    const revision = remoteConfigRevision
    if (pendingRemoteList?.revision === revision) return pendingRemoteList.promise
    const requestId = ++remoteListRequestId
    const kind = remoteSettings.value.provider.kind
    const current = () => revision === remoteConfigRevision && requestId === remoteListRequestId
    const promise = (async () => {
      const ready = await ensureRemoteConnectionReady()
      if (!current()) return false
      if (!ready) {
        remoteListState.value = 'error'
        remoteListError.value = t(
          kind === 'google-drive'
            ? googleAuthorizationState.value === 'missing'
              ? 'dataManager.remote.authorizationRequired'
              : 'dataManager.remote.authorizationExpired'
            : 'dataManager.remote.connectionMissingConfig',
        )
        return false
      }
      try {
        isLoadingRemoteList.value = true
        remoteListState.value = 'loading'
        remoteListError.value = ''
        setRemoteConnectionState(kind, { status: 'checking', message: '' })
        startRemoteProgress('list', 'dataManager.remote.progress.list.start')
        const entries = await listRemoteSnapshotBackups(getRemoteStore(), (event) => {
          if (current()) updateRemoteProgress('list', event)
        })
        if (!current()) return false
        remoteBackups.value = entries
        remoteListState.value = 'success'
        markGoogleDriveAuthorizationSuccess()
        setRemoteConnectionState(kind, {
          status: 'connected',
          lastCheckedAt: Date.now(),
          message: '',
        })
        isRemoteConfigExpanded.value = false
        if (!entries.some((entry) => entry.id === selectedRemoteBackupId.value)) {
          selectedRemoteBackupId.value = null
        }
        return true
      } catch (error) {
        if (!current()) return false
        const message = remoteOperationErrorMessage(error)
        remoteListError.value = message
        remoteListState.value = 'error'
        setRemoteConnectionState(kind, { status: 'failed', message })
        return false
      } finally {
        if (current()) {
          isLoadingRemoteList.value = false
          pendingRemoteList = null
          finishRemoteProgress()
        }
      }
    })()
    pendingRemoteList = { revision, promise }
    // Also release requests rejected before the loading state was entered.
    void promise.then(() => {
      if (current()) pendingRemoteList = null
    })
    autoLoadedProviders.add(kind)
    return promise
  }

  const maybeAutoLoadRemoteBackups = async () => {
    const kind = remoteSettings.value.provider.kind
    if (
      !props.show ||
      (isCompact.value && !isCloudTaskVisible.value) ||
      props.importCode ||
      (activeTab.value === 'restore' && restoreSource.value === 'code') ||
      isImportingRemoteCode.value ||
      isAuthorizingRemote.value ||
      isRemoteDataOperationActive.value ||
      dirtyRemoteProviders.has(kind) ||
      autoLoadedProviders.has(kind)
    )
      return
    if (kind === 'google-drive') syncGoogleDriveAuthorizationState()
    if (!isRemoteProviderConfigured(remoteSettings.value.provider)) return
    await refreshRemoteBackups()
  }

  const handleRemoteRefresh = () => {
    if (isRemoteDataOperationActive.value) return
    refreshRemoteBackups()
  }

  const handleRemoteUpload = async () => {
    if (isRemoteDataOperationActive.value) return
    if (!(await ensureRemoteConnectionReady()) || isRemoteDataOperationActive.value) return

    try {
      persistRemoteSettings(false)
      backupResult.value = null
      isUploadingRemote.value = true
      startRemoteProgress('backup', 'dataManager.remote.progress.backup.start')
      const servicesValue = services.value
      if (!servicesValue) {
        throw new Error(
          '[DataManager] Services are not initialized. Make sure the application has started correctly.',
        )
      }
      await flushWorkspaceSnapshots()
      const result = await createRemoteSnapshotBackup({
        objectStore: getRemoteStore(),
        dataManager: getDataManager.value,
        favoriteManager: servicesValue.favoriteManager,
        imageStorageService: servicesValue.imageStorageService,
        favoriteImageStorageService: servicesValue.favoriteImageStorageService,
        sections: toExportSectionSelection(),
        onProgress: (event) => updateRemoteProgress('backup', event),
      })
      const entry = result.entry
      remoteBackups.value = [entry, ...remoteBackups.value.filter((item) => item.id !== entry.id)]
      remoteListState.value = 'success'
      remoteListError.value = ''
      markGoogleDriveAuthorizationSuccess()
      cloudBackupId.value = entry.id
      backupResult.value = {
        snapshotId: entry.id,
        type: result.missingAssets.length ? 'warning' : 'success',
        message: result.missingAssets.length
          ? t('dataManager.export.partialSuccess', { count: result.missingAssets.length })
          : t('dataManager.tasks.cloudBackupCreated'),
      }
      recordDataBackupCompleted()
      if (result.missingAssets.length > 0) {
        toast.warning(
          t('dataManager.export.partialSuccess', {
            count: result.missingAssets.length,
          }),
        )
      } else {
        toast.success(
          t('dataManager.remote.backupSuccess', {
            uploaded: result.uploadedAssets,
            skipped: result.skippedAssets,
          }),
        )
      }
    } catch (error) {
      backupResult.value = { type: 'error', message: remoteOperationErrorMessage(error) }
      console.error('[DataManager] Remote backup failed:', error)
      toast.error(
        t('dataManager.remote.backupFailed', { message: remoteOperationErrorMessage(error) }),
      )
    } finally {
      isUploadingRemote.value = false
      finishRemoteProgress()
    }
  }

  const handleRemoteRestore = async () => {
    restoreError.value = ''
    if (isRemoteDataOperationActive.value) return
    await restoreSelectedRemoteBackup()
  }

  const restoreSelectedRemoteBackup = async () => {
    const entry = selectedRemoteBackup.value
    const revision = remoteConfigRevision
    if (!entry || !hasSelectedRemoteRestoreSection.value) return
    if (!(await ensureRemoteConnectionReady())) return
    if (
      revision !== remoteConfigRevision ||
      isExporting.value ||
      isImporting.value ||
      isImportingRemoteCode.value ||
      isAuthorizingRemote.value ||
      isUploadingRemote.value ||
      isRestoringRemote.value ||
      isCleaningRemoteAssets.value ||
      isLoadingRemoteList.value
    )
      return

    let releaseSessionRestore: (() => void) | undefined
    try {
      isRestoringRemote.value = true
      startRemoteProgress('restore', 'dataManager.remote.progress.restore.start')
      const servicesValue = services.value
      if (!servicesValue) {
        throw new Error(
          '[DataManager] Services are not initialized. Make sure the application has started correctly.',
        )
      }
      releaseSessionRestore = (await prepareSessionRestore()) ?? undefined
      if (!releaseSessionRestore) return
      const result = await restoreRemoteSnapshotBackup({
        objectStore: getRemoteStore(),
        snapshotId: entry.id,
        dataManager: getDataManager.value,
        favoriteManager: servicesValue.favoriteManager,
        imageStorageService: servicesValue.imageStorageService,
        favoriteImageStorageService: servicesValue.favoriteImageStorageService,
        sections: toRemoteRestoreSectionSelection(),
        favoriteMergeStrategy: favoriteMergeStrategy.value,
        onProgress: (event) => updateRemoteProgress('restore', event),
      })
      markGoogleDriveAuthorizationSuccess()
      toast.success(
        t('dataManager.import.packageSuccess', {
          restored: result.restored,
          skipped: result.skipped,
        }),
      )
      const warning = buildRemoteSnapshotRestoreWarning(result)
      if (warning) {
        toast.warning(warning)
      }
      // Imported snapshots must survive the App's existing reload. Its pagehide
      // handler and autosave must not write the pre-import in-memory sessions.
      completeSessionRestore(releaseSessionRestore)
      releaseSessionRestore = undefined
      emit('imported')
      emit('close')
    } catch (error) {
      releaseSessionRestore?.()
      restoreError.value = remoteOperationErrorMessage(error)
      console.error('[DataManager] Remote restore failed:', error)
      toast.error(
        t('dataManager.remote.restoreFailed', { message: remoteOperationErrorMessage(error) }),
      )
    } finally {
      isRestoringRemote.value = false
      finishRemoteProgress()
    }
  }

  const handleRemoteCodeExport = () => {
    if (!selectedRemoteBackup.value || isRemoteDataOperationActive.value) return
    try {
      exportedRemoteImportCode.value = createRemoteBackupImportCode(
        remoteSettings.value.provider,
        selectedRemoteBackup.value.id,
      )
      showRemoteImportCode.value = true
    } catch (error) {
      toast.error(
        t(
          `dataManager.remote.importCode.${error instanceof BackupImportCodeError ? error.kind : 'invalid'}`,
        ),
      )
    }
  }

  const copyRemoteImportCode = async () => {
    try {
      await writeClipboardText(exportedRemoteImportCode.value)
      toast.success(t('dataManager.remote.importCode.copied'))
    } catch {
      toast.error(t('dataManager.remote.importCode.copyFailed'))
    }
  }

  const handleRemoteCodeImport = async () => {
    if (isRemoteDataOperationActive.value || isConnectingRemote.value) return
    codeError.value = ''
    codeBackupId.value = null
    const input = remoteImportCode.value
    try {
      // Validate the entire code before changing or persisting any settings.
      const decoded = parseRemoteBackupImportCode(remoteImportCode.value)
      isImportingRemoteCode.value = true
      activeTab.value = 'restore'
      restoreSource.value = 'code'
      remoteSettings.value = {
        ...rememberRemoteBackupProvider(remoteSettings.value),
        provider: decoded.provider,
      }
      invalidateRemoteList()
      persistRemoteSettings()
      const revision = remoteConfigRevision
      if (!(await refreshRemoteBackups())) {
        codeError.value = remoteListMessage.value
        return
      }
      if (!props.show || revision !== remoteConfigRevision || input !== remoteImportCode.value)
        return
      const entry = remoteBackups.value.find((backup) => backup.id === decoded.snapshotId)
      if (!entry) {
        // Never let refreshRemoteBackups' normal "select first" behavior turn a
        // stale import code into a restore of some other snapshot.
        selectedRemoteBackupId.value = null
        codeError.value = t('dataManager.remote.importCode.backupNotFound', {
          id: decoded.snapshotId,
        })
        toast.error(codeError.value)
        return
      }
      codeBackupId.value = entry.id
      await nextTick()
      focusRestoreConfirmation()
    } catch (error) {
      codeError.value = t(
        `dataManager.remote.importCode.${error instanceof BackupImportCodeError ? error.kind : 'invalid'}`,
      )
      // Codes contain credentials: do not log the input or the parser exception.
      toast.error(
        t(
          `dataManager.remote.importCode.${error instanceof BackupImportCodeError ? error.kind : 'invalid'}`,
        ),
      )
    } finally {
      isImportingRemoteCode.value = false
    }
  }

  const handleRemoteCleanup = async () => {
    if (isRemoteDataOperationActive.value) return
    if (!(await ensureRemoteConnectionReady()) || isRemoteDataOperationActive.value) return

    try {
      persistRemoteSettings(false)
      isCleaningRemoteAssets.value = true
      startRemoteProgress('cleanup', 'dataManager.remote.progress.cleanup.start')
      const objectStore = getRemoteStore()
      const analysis = await analyzeRemoteSnapshotAssetCleanup(objectStore, (event) =>
        updateRemoteProgress('cleanup', event),
      )
      markGoogleDriveAuthorizationSuccess()

      if (analysis.candidates.length === 0) {
        toast.success(t('dataManager.remote.cleanupNothing'))
        return
      }

      const confirmed = await confirmDialog.warning({
        title: t('common.warning'),
        content: t('dataManager.remote.cleanupConfirm', {
          count: analysis.candidates.length,
          size: formatFileSize(analysis.totalCandidateBytes),
        }),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
      })
      if (!confirmed) return

      const cleanup = await cleanupRemoteSnapshotAssets(objectStore, (event) =>
        updateRemoteProgress('cleanup', event),
      )
      if (cleanup.failed.length > 0) {
        toast.warning(
          t('dataManager.remote.cleanupPartial', {
            deleted: cleanup.deleted,
            failed: cleanup.failed.length,
          }),
        )
      } else {
        toast.success(
          t('dataManager.remote.cleanupSuccess', {
            count: cleanup.deleted,
            size: formatFileSize(cleanup.totalCandidateBytes),
          }),
        )
      }
    } catch (error) {
      console.error('[DataManager] Remote asset cleanup failed:', error)
      toast.error(
        t('dataManager.remote.cleanupFailed', { message: remoteOperationErrorMessage(error) }),
      )
    } finally {
      isCleaningRemoteAssets.value = false
      finishRemoteProgress()
    }
  }

  const openStorageDir = () => {
    if (!isDesktopRuntime || !window.electronAPI?.data) return
    window.electronAPI.data.openStorageDirectory()
  }

  const toExportSectionSelection = (): DataManagerPackageSectionSelection => ({
    appData: exportAppData.value,
    favorites: exportFavorites.value,
    imageCache: exportAppData.value && exportAppDataImages.value,
    favoriteImages: exportFavorites.value,
  })

  const toImportSectionSelection = (): DataManagerPackageSectionSelection => ({
    appData: importAppData.value && availableImportSections.value.has('appData'),
    favorites: importFavorites.value && availableImportSections.value.has('favorites'),
    imageCache:
      importAppData.value &&
      importAppDataImages.value &&
      availableImportSections.value.has('imageCache'),
    favoriteImages: importFavorites.value && availableImportSections.value.has('favoriteImages'),
  })

  const toRemoteRestoreSectionSelection = (): DataManagerPackageSectionSelection => ({
    appData: remoteRestoreAppData.value && availableRemoteRestoreSections.value.has('appData'),
    favorites:
      remoteRestoreFavorites.value && availableRemoteRestoreSections.value.has('favorites'),
    imageCache:
      remoteRestoreAppData.value &&
      remoteRestoreAppDataImages.value &&
      availableRemoteRestoreSections.value.has('imageCache'),
    favoriteImages:
      remoteRestoreFavorites.value &&
      remoteRestoreFavoriteImages.value &&
      availableRemoteRestoreSections.value.has('favoriteImages'),
  })

  const resetImportSelection = () => {
    importPreviewText.value = ''
    availableImportSections.value = new Set(allPackageSections)
    importAppData.value = true
    importAppDataImages.value = true
    importFavorites.value = true
  }

  const updateImportPreviewFromFile = async (uploadFile: UploadFileInfo | null) => {
    const request = ++importPreviewRequest
    resetImportSelection()
    availableImportSections.value = new Set()
    importPreviewState.value = 'idle'
    importPreviewError.value = ''
    const file = uploadFile?.file ?? null
    if (!file) return
    importPreviewState.value = 'loading'
    try {
      const buffer = await readFileAsArrayBuffer(file)
      if (request !== importPreviewRequest) return
      const bytes = new Uint8Array(buffer)
      if (!looksLikeDataManagerZipPackage(file.name, bytes)) {
        await getDataManager.value.validateImportData(new TextDecoder().decode(bytes))
        if (request !== importPreviewRequest) return
        availableImportSections.value = new Set(['appData'])
        importAppData.value = true
        importAppDataImages.value = false
        importFavorites.value = false
        importPreviewText.value = t('dataManager.import.legacyJsonPreview')
      } else {
        const packageContent = readDataManagerResourcePackage(buffer)
        const includedSections = getIncludedDataManagerPackageSections(packageContent.manifest)
        availableImportSections.value = new Set(includedSections)
        importAppData.value = availableImportSections.value.has('appData')
        importAppDataImages.value =
          importAppData.value && availableImportSections.value.has('imageCache')
        importFavorites.value = canImportFavoritesBundle.value
        importPreviewText.value = t('dataManager.import.packagePreview', {
          sections: getBusinessSectionLabels(includedSections).join(', '),
        })
      }
      importPreviewState.value = 'success'
    } catch {
      if (request !== importPreviewRequest) return
      importPreviewState.value = 'error'
      importPreviewError.value = t('dataManager.import.readFileFailed')
    }
  }
  const handleFileChange = (options: { fileList: UploadFileInfo[] }) => {
    if (isRemoteConnectionLocked.value) return
    // NUpload appends a replacement to its current list; this picker retains only the latest file.
    selectedFile.value = options.fileList[options.fileList.length - 1] ?? null
    restoreError.value = ''
    void updateImportPreviewFromFile(selectedFile.value)
  }

  const readFileAsArrayBuffer = (file: File) =>
    new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result)
        } else {
          reject(new Error(t('dataManager.import.readFileFailed')))
        }
      }
      reader.onerror = () => reject(new Error(t('dataManager.import.readFileFailed')))
      reader.readAsArrayBuffer(file)
    })

  const close = () => {
    emit('update:show', false)
    emit('close')
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && showRemoteImportCode.value) {
      showRemoteImportCode.value = false
      exportedRemoteImportCode.value = ''
      return
    }
    if (event.key === 'Escape' && props.show) {
      close()
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    importPreviewRequest += 1
    invalidateRemoteList()
    document.removeEventListener('keydown', handleKeyDown)
  })

  const currentProviderName = computed(() =>
    t(providerLabelKeys[remoteSettings.value.provider.kind]),
  )
  const backupDestinationOptions = computed(() => [
    { value: 'local', label: t('dataManager.tasks.localFile') },
    ...remoteProviderOptions.value,
  ])
  const backupScopeSummary = computed(
    () =>
      getBusinessSectionLabels(
        Object.entries(toExportSectionSelection())
          .filter(([, included]) => included)
          .map(([key]) => key as DataManagerPackageSection),
      ).join(', ') || t('dataManager.import.noSelectedContent'),
  )
  const isCloudTaskVisible = computed(
    () =>
      activeTab.value === 'settings' ||
      (activeTab.value === 'backup' && backupDestination.value !== 'local') ||
      (activeTab.value === 'restore' && restoreSource.value === 'cloud'),
  )
  const changeBackupDestination = (destination: 'local' | RemoteBackupProviderKind) => {
    if (isRemoteConnectionLocked.value) return
    backupDestination.value = destination
    if (destination !== 'local') handleRemoteProviderChange(destination)
  }
  watch(
    () => remoteSettings.value.provider.kind,
    (kind) => {
      if (backupDestination.value !== 'local') backupDestination.value = kind
    },
  )
  watch(remoteImportCode, () => {
    codeBackupId.value = null
    codeError.value = ''
  })
  watch(restoreSource, () => {
    restoreError.value = ''
  })
  const openConnectionSettings = () => {
    if (activeTab.value !== 'settings') returnTask.value = activeTab.value
    activeTab.value = 'settings'
  }
  const returnFromSettings = async () => {
    activeTab.value = returnTask.value ?? 'backup'
    returnTask.value = null
    await nextTick()
    scrollShell.value?.querySelector<HTMLElement>(`#data-panel-${activeTab.value}`)?.focus()
  }
  const focusRestoreConfirmation = () => {
    void nextTick(() =>
      scrollShell.value
        ?.querySelector<HTMLElement>('[data-testid="restore-confirmation"]')
        ?.focus(),
    )
  }
  const selectRestoreBackup = (id: string) => {
    if (!isRemoteDataOperationActive.value) {
      cloudBackupId.value = id
      restoreError.value = ''
      focusRestoreConfirmation()
    }
  }
  const viewCreatedBackup = () => {
    if (!backupResult.value?.snapshotId) return
    restoreSource.value = 'cloud'
    cloudBackupId.value = backupResult.value.snapshotId
    activeTab.value = 'restore'
    focusRestoreConfirmation()
  }
  const restoreSectionOptions = computed(() => {
    const local = restoreSource.value === 'local'
    const available = local ? availableImportSections.value : availableRemoteRestoreSections.value
    const appData = local ? importAppData.value : remoteRestoreAppData.value
    const favorites = local ? importFavorites.value : remoteRestoreFavorites.value
    return [
      {
        key: 'appData',
        label: t('dataManager.sections.appData'),
        checked: appData,
        disabled: !available.has('appData'),
      },
      {
        key: 'imageCache',
        label: t('dataManager.sections.appDataImages'),
        checked: local ? importAppDataImages.value : remoteRestoreAppDataImages.value,
        disabled: !appData || !available.has('imageCache'),
      },
      {
        key: 'favorites',
        label: t('dataManager.sections.favoritesBundle'),
        checked: favorites,
        disabled: !available.has('favorites'),
      },
      ...(!local
        ? [
            {
              key: 'favoriteImages',
              label: t('dataManager.sections.favoriteImages'),
              checked: remoteRestoreFavoriteImages.value,
              disabled: !favorites || !available.has('favoriteImages'),
            },
          ]
        : []),
    ]
  })
  const updateRestoreSection = (key: string, checked: boolean) => {
    if (isRemoteDataOperationActive.value) return
    const local = restoreSource.value === 'local'
    const target = (
      {
        appData: local ? importAppData : remoteRestoreAppData,
        imageCache: local ? importAppDataImages : remoteRestoreAppDataImages,
        favorites: local ? importFavorites : remoteRestoreFavorites,
        favoriteImages: remoteRestoreFavoriteImages,
      } as Record<string, Ref<boolean>>
    )[key]
    if (target) target.value = checked
  }
  const canRestoreSelection = computed(() =>
    restoreSource.value === 'local'
      ? importPreviewState.value === 'success' && (importAppData.value || importFavorites.value)
      : !!selectedRemoteBackup.value && hasSelectedRemoteRestoreSection.value,
  )
  const confirmSelectedRestore = () => {
    if (restoreSource.value === 'local') void handleImport()
    else void handleRemoteRestore()
  }

  watch(
    () => props.show,
    (show) => {
      if (show) {
        autoLoadedProviders.clear()
        void maybeAutoLoadRemoteBackups()
        storageLoadedThisOpen = false
        activeTab.value = 'backup'
        backupDestination.value = isCurrentRemoteProviderConfigured.value
          ? remoteSettings.value.provider.kind
          : 'local'
      } else {
        const wasLoadingList = isLoadingRemoteList.value
        remoteListRequestId += 1
        pendingRemoteList = null
        isLoadingRemoteList.value = false
        if (remoteListState.value === 'loading') remoteListState.value = 'idle'
        if (wasLoadingList) finishRemoteProgress()
        remoteImportCode.value = ''
        exportedRemoteImportCode.value = ''
        showRemoteImportCode.value = false
      }
    },
    { immediate: true },
  )

  watch([activeTab, restoreSource, backupDestination], () => {
    if (!props.show) return
    if (activeTab.value === 'settings' && !storageLoadedThisOpen) {
      storageLoadedThisOpen = true
      void refreshStorageSummary()
    }
    void maybeAutoLoadRemoteBackups()
  })

  watch(
    () => [props.show, props.importCode] as const,
    ([show, code]) => {
      if (!show || !code) return
      activeTab.value = 'restore'
      restoreSource.value = 'code'
      remoteImportCode.value = code
      emit('import-code-consumed')
    },
    { immediate: true },
  )

  const flushWorkspaceSnapshots = async () => {
    if (!(await sessionManager.saveAllSessions())) {
      throw new Error(t('dataManager.export.failed'))
    }
  }

  const prepareSessionRestore = async () => {
    const resume = await (props.prepareRestore
      ? props.prepareRestore()
      : sessionManager.beginSessionRestore())
    if (!resume) toast.warning(t('dataManager.import.workspaceBusy'))
    return resume
  }

  const handleExport = async () => {
    if (isRemoteDataOperationActive.value) return
    backupResult.value = null
    try {
      const servicesValue = services.value
      if (!servicesValue) {
        throw new Error(
          '[DataManager] Services are not initialized. Make sure the application has started correctly.',
        )
      }
      isExporting.value = true

      await flushWorkspaceSnapshots()
      const exportPackage = await createDataManagerResourcePackage({
        dataManager: getDataManager.value,
        favoriteManager: servicesValue.favoriteManager,
        imageStorageService: servicesValue.imageStorageService,
        favoriteImageStorageService: servicesValue.favoriteImageStorageService,
        sections: toExportSectionSelection(),
      })
      const url = URL.createObjectURL(exportPackage.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = createRemoteBackupFileName()
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      recordDataBackupCompleted()

      backupResult.value = {
        type: exportPackage.missingResources.length ? 'warning' : 'success',
        message: exportPackage.missingResources.length
          ? t('dataManager.export.partialSuccess', { count: exportPackage.missingResources.length })
          : t('dataManager.tasks.downloadStarted'),
      }
      if (exportPackage.missingResources.length > 0) {
        toast.warning(
          t('dataManager.export.partialSuccess', {
            count: exportPackage.missingResources.length,
          }),
        )
      } else {
        toast.success(t('dataManager.export.success'))
      }
    } catch (error) {
      backupResult.value = { type: 'error', message: t('dataManager.export.failed') }
      console.error('Export failed:', error)
      toast.error(t('dataManager.export.failed'))
    } finally {
      isExporting.value = false
    }
  }

  const clearSelectedFile = () => {
    selectedFile.value = null
    importPreviewRequest += 1
    importPreviewState.value = 'idle'
    importPreviewError.value = ''
    resetImportSelection()
  }

  const buildPackageImportWarning = (result: DataManagerResourcePackageImportResult): string => {
    const warnings: string[] = []
    if (result.resources.missing.length > 0) {
      warnings.push(
        t('dataManager.import.resourcesMissing', {
          count: result.resources.missing.length,
        }),
      )
    }
    if (result.resources.corrupt.length > 0) {
      warnings.push(
        t('dataManager.import.resourcesCorrupt', {
          count: result.resources.corrupt.length,
        }),
      )
    }
    if (result.resources.errors.length > 0) {
      warnings.push(
        t('dataManager.import.resourcesFailed', {
          count: result.resources.errors.length,
        }),
      )
    }
    return warnings.join('\n')
  }

  const buildRemoteSnapshotRestoreWarning = (result: {
    missing: Array<unknown>
    corrupt: Array<unknown>
    errors: string[]
  }): string => {
    const warnings: string[] = []
    if (result.missing.length > 0) {
      warnings.push(
        t('dataManager.import.resourcesMissing', {
          count: result.missing.length,
        }),
      )
    }
    if (result.corrupt.length > 0) {
      warnings.push(
        t('dataManager.import.resourcesCorrupt', {
          count: result.corrupt.length,
        }),
      )
    }
    if (result.errors.length > 0) {
      warnings.push(
        t('dataManager.import.resourcesFailed', {
          count: result.errors.length,
        }),
      )
    }
    return warnings.join('\n')
  }

  const handleImport = async () => {
    if (
      !selectedFile.value ||
      importPreviewState.value !== 'success' ||
      isRemoteDataOperationActive.value
    )
      return
    restoreError.value = ''

    let releaseSessionRestore: (() => void) | undefined
    try {
      isImporting.value = true

      const file = selectedFile.value.file ?? null
      if (!file) {
        toast.error(t('dataManager.import.failed'))
        return
      }

      const buffer = await readFileAsArrayBuffer(file)
      const bytes = new Uint8Array(buffer)
      const isResourcePackage = looksLikeDataManagerZipPackage(file.name, bytes)
      if (!isResourcePackage && !importAppData.value) {
        toast.warning(t('dataManager.import.noSelectedContent'))
        return
      }

      releaseSessionRestore = (await prepareSessionRestore()) ?? undefined
      if (!releaseSessionRestore) return
      if (isResourcePackage) {
        const servicesValue = services.value
        if (!servicesValue) {
          throw new Error(
            '[DataManager] Services are not initialized. Make sure the application has started correctly.',
          )
        }

        const result = await importDataManagerResourcePackage(buffer, {
          dataManager: getDataManager.value,
          favoriteManager: servicesValue.favoriteManager,
          imageStorageService: servicesValue.imageStorageService,
          favoriteImageStorageService: servicesValue.favoriteImageStorageService,
          sections: toImportSectionSelection(),
          favoriteMergeStrategy: favoriteMergeStrategy.value,
        })

        toast.success(
          t('dataManager.import.packageSuccess', {
            restored: result.resources.restored,
            skipped: result.resources.skipped,
          }),
        )

        const warning = buildPackageImportWarning(result)
        if (warning) {
          toast.warning(warning)
        }
      } else {
        const content = new TextDecoder().decode(bytes)
        const dataManager = getDataManager.value
        await dataManager.importAllData(content)
        toast.success(t('dataManager.import.success'))
      }

      // Keep saving paused until App reloads; release only failed attempts below.
      completeSessionRestore(releaseSessionRestore)
      releaseSessionRestore = undefined
      emit('imported')
      emit('close')
      clearSelectedFile()
    } catch (error) {
      releaseSessionRestore?.()
      restoreError.value = formatErrorSummary(t('dataManager.import.failed'), error)
      console.error('Import failed:', error)
      toast.error(formatErrorSummary(t('dataManager.import.failed'), error))
    } finally {
      isImporting.value = false
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const formatStorageItemBytes = (bytes: number | null): string => {
    if (bytes === null) {
      return '—'
    }
    return formatFileSize(bytes)
  }

  const getStorageItemDetail = (
    item: Pick<StorageBreakdownItem, 'key' | 'count'>,
  ): string | null => {
    if (item.key === 'appMainData') {
      return t('dataManager.storage.appMainDataNote')
    }

    if ((item.key === 'imageCache' || item.key === 'favoriteImages') && item.count !== null) {
      return t('dataManager.storage.imageCount', { count: item.count })
    }

    return null
  }

  return {
    t,
    activeTab,
    restoreSource,
    backupDestination,
    returnTask,
    backupSearch,
    scrollShell,
    backupResult,
    restoreError,
    codeError,
    importPreviewState,
    importPreviewError,
    isDesktopRuntime,
    dataManagerModalStyle,
    isExporting,
    isImporting,
    selectedFile,
    importPreviewText,
    availableImportSections,
    exportAppData,
    exportAppDataImages,
    exportFavorites,
    importAppDataImages,
    importFavorites,
    remoteRestoreAppData,
    remoteRestoreAppDataImages,
    remoteRestoreFavorites,
    remoteRestoreFavoriteImages,
    favoriteMergeStrategy,
    storageSummary,
    isRefreshingStorage,
    remoteSettings,
    isAuthorizingRemote,
    isGoogleDriveAuthorized,
    isRemoteConfigExpanded,
    remoteConnectionStates,
    isUploadingRemote,
    isLoadingRemoteList,
    isRestoringRemote,
    isCleaningRemoteAssets,
    isImportingRemoteCode,
    remoteImportCode,
    showRemoteImportCode,
    exportedRemoteImportCode,
    remoteImportWebAddress,
    remoteImportQrUrl,
    isRemoteDataOperationActive,
    isRemoteConnectionLocked,
    remoteBackups,
    remoteListState,
    selectedRemoteBackupId,
    remoteProgress,
    storageLabelKeys,
    remoteProviderOptions,
    remoteRecommendationKey,
    googleDriveAuthorizationLabel,
    remoteListPlaceholder,
    remoteListMessage,
    selectedRemoteBackup,
    selectedRemoteBackupMissingAssetsCount,
    currentRemoteConnection,
    isCurrentRemoteProviderConfigured,
    showRemoteConfigForm,
    currentRemoteConnectionLabel,
    currentRemoteConnectionTitle,
    currentRemoteConnectionMessage,
    currentRemoteConnectionTagType,
    storageCardItems,
    desktopBackupItem,
    canUseDesktopStorageTools,
    refreshStorageSummary,
    markRemoteSettingsDirty,
    handleRemoteProviderChange,
    openCloudflareR2Link,
    copyCloudflareR2CorsConfig,
    handleRemoteAuthorize,
    handleRemoteSaveAndConnect,
    refreshRemoteBackups,
    handleRemoteRefresh,
    handleRemoteUpload,
    handleRemoteRestore,
    handleRemoteCodeExport,
    copyRemoteImportCode,
    handleRemoteCodeImport,
    handleRemoteCleanup,
    openStorageDir,
    handleFileChange,
    close,
    currentProviderName,
    backupDestinationOptions,
    backupScopeSummary,
    changeBackupDestination,
    openConnectionSettings,
    returnFromSettings,
    selectRestoreBackup,
    viewCreatedBackup,
    restoreSectionOptions,
    updateRestoreSection,
    canRestoreSelection,
    confirmSelectedRestore,
    handleExport,
    clearSelectedFile,
    handleImport,
    formatFileSize,
    formatStorageItemBytes,
    getStorageItemDetail,
    CLOUDFLARE_R2_DEFAULT_BACKUP_PREFIX,
    GOOGLE_DRIVE_DEFAULT_BACKUP_FOLDER_NAME,
  }
}
