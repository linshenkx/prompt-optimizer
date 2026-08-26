<template>
  <NModal
    :show="show"
    preset="card"
    :style="dataManagerModalStyle"
    class="data-manager-modal"
    :title="$t('dataManager.title')"
    size="large"
    :bordered="false"
    :segmented="true"
    @update:show="(value: boolean) => !value && close()"
  >
    <div class="data-manager-scroll-shell">
      <section class="data-manager-section data-manager-section--storage">
        <div class="section-heading">
          <div>
            <NText tag="h3" :depth="1" strong class="section-title">
              {{ $t('dataManager.storage.title') }}
            </NText>
            <NText depth="3" class="section-description">
              {{ $t('dataManager.storage.totalNote') }}
            </NText>
          </div>
          <NButton size="small" secondary :loading="isRefreshingStorage" @click="refreshStorageSummary">
            <template #icon>
              <NIcon><Refresh /></NIcon>
            </template>
            {{ $t('dataManager.storage.refresh') }}
          </NButton>
        </div>

        <div class="storage-cards-grid">
          <div class="storage-stat-card storage-stat-card--total">
            <NText strong>{{ $t('dataManager.storage.total') }}</NText>
            <div class="storage-stat-value">
              {{ storageSummary ? formatFileSize(storageSummary.totalBytes) : '—' }}
            </div>
            <NText depth="3" class="storage-note">
              {{ $t('dataManager.storage.totalNoteShort') }}
            </NText>
          </div>

          <div
            v-for="item in storageCardItems"
            :key="item.key"
            class="storage-stat-card"
          >
            <NText depth="3">{{ $t(storageLabelKeys[item.key]) }}</NText>
            <div class="storage-stat-value">
              {{ formatStorageItemBytes(item.bytes) }}
            </div>
            <NText
              v-if="getStorageItemDetail(item)"
              depth="3"
              class="storage-note"
            >
              {{ getStorageItemDetail(item) }}
            </NText>
          </div>
        </div>
      </section>

      <section class="data-manager-section">
        <div class="section-heading">
          <div>
            <NText tag="h3" :depth="1" strong class="section-title">
              {{ $t('dataManager.backupWorkspace.title') }}
            </NText>
            <NText depth="3" class="section-description">
              {{ $t('dataManager.backupWorkspace.description') }}
            </NText>
          </div>
        </div>

        <div class="local-transfer-panel">
          <div class="local-transfer-row">
            <div class="local-transfer-copy">
              <NText strong class="local-transfer-title">
                {{ $t('dataManager.backupWorkspace.exportTitle') }}
              </NText>
              <NText depth="3" class="local-transfer-description">
                {{ $t('dataManager.export.description') }}
              </NText>
            </div>
            <div class="local-scope-row" :aria-label="$t('dataManager.export.scopeTitle')">
              <label class="local-scope-pill">
                <NCheckbox v-model:checked="exportAppData">
                  {{ $t('dataManager.sections.appData') }}
                </NCheckbox>
              </label>
              <label class="local-scope-pill">
                <NCheckbox
                  v-model:checked="exportAppDataImages"
                  :disabled="!exportAppData"
                >
                  {{ $t('dataManager.sections.appDataImages') }}
                </NCheckbox>
              </label>
              <label class="local-scope-pill">
                <NCheckbox v-model:checked="exportFavorites">
                  {{ $t('dataManager.sections.favoritesBundle') }}
                </NCheckbox>
              </label>
            </div>
            <NButton
              @click="handleExport"
              :disabled="isExporting || (!exportAppData && !exportFavorites)"
              type="primary"
              :loading="isExporting"
              block
            >
              <template #icon>
                <NIcon><Download /></NIcon>
              </template>
              {{ isExporting ? $t('common.exporting') : $t('dataManager.export.button') }}
            </NButton>
          </div>

          <div class="local-transfer-divider" />

          <div class="local-transfer-row local-transfer-row--import">
            <div class="local-transfer-copy">
              <NText strong class="local-transfer-title">
                {{ $t('dataManager.backupWorkspace.importTitle') }}
              </NText>
              <NText depth="3" class="local-transfer-description">
                {{ $t('dataManager.import.description') }}
              </NText>
            </div>

            <NUpload
              class="local-file-picker"
              :file-list="selectedFile ? [selectedFile] : []"
              accept=".zip,.po-backup.zip,.json,application/zip,application/json"
              :show-file-list="false"
              @change="handleFileChange"
              :custom-request="() => {}"
            >
              <NUploadDragger>
                <div v-if="!selectedFile" class="local-import-dropzone">
                  <NIcon size="20" :depth="3"><Upload /></NIcon>
                  <div>
                    <NText>{{ $t('dataManager.import.selectFile') }}</NText>
                    <NText depth="3" class="local-file-note">
                      {{ $t('dataManager.import.supportFormat') }}
                    </NText>
                  </div>
                </div>

                <div v-else class="local-import-selected">
                  <div class="local-selected-file-copy">
                    <NText strong>{{ selectedFile.name }}</NText>
                    <NText :depth="3" class="local-file-note">
                      {{ formatFileSize(selectedFile.file?.size ?? 0) }}
                      <template v-if="importPreviewText">
                        · {{ importPreviewText }}
                      </template>
                    </NText>
                  </div>
                  <NButton size="small" text @click.stop="clearSelectedFile">
                    {{ $t('common.clear') }}
                  </NButton>
                </div>
              </NUploadDragger>
            </NUpload>

            <NButton
              @click="handleImport"
              :disabled="!selectedFile || isImporting || (!importAppData && !importFavorites)"
              type="success"
              :loading="isImporting"
              block
            >
              <template #icon>
                <NIcon><Upload /></NIcon>
              </template>
              {{ isImporting ? $t('common.importing') : $t('dataManager.import.button') }}
            </NButton>
          </div>

          <NCollapse v-if="selectedFile" class="local-import-settings" :default-expanded-names="['import-settings']">
            <NCollapseItem :title="$t('dataManager.import.settingsTitle')" name="import-settings">
              <div class="local-import-settings-body">
              <div class="local-settings-group">
                <NText depth="3" class="local-settings-title">
                  {{ $t('dataManager.import.scopeTitle') }}
                </NText>
                <div class="local-scope-row">
                  <label class="local-scope-pill">
                    <NCheckbox
                      v-model:checked="importAppData"
                      :disabled="selectedFile ? !availableImportSections.has('appData') : false"
                    >
                      {{ $t('dataManager.sections.appData') }}
                    </NCheckbox>
                  </label>
                  <label class="local-scope-pill">
                    <NCheckbox
                      v-model:checked="importAppDataImages"
                      :disabled="!importAppData || (selectedFile ? !availableImportSections.has('imageCache') : false)"
                    >
                      {{ $t('dataManager.sections.appDataImages') }}
                    </NCheckbox>
                  </label>
                  <label class="local-scope-pill">
                    <NCheckbox
                      v-model:checked="importFavorites"
                      :disabled="selectedFile ? !canImportFavoritesBundle : false"
                    >
                      {{ $t('dataManager.sections.favoritesBundle') }}
                    </NCheckbox>
                  </label>
                </div>
              </div>

              <div v-if="importFavorites" class="local-settings-group">
                <NText depth="3" class="local-settings-title">
                  {{ $t('dataManager.import.favoriteMergeStrategy') }}
                </NText>
                <NRadioGroup v-model:value="favoriteMergeStrategy">
                  <div class="local-strategy-row">
                    <label class="local-strategy-pill">
                      <NRadio value="skip">{{ $t('dataManager.import.skipDuplicate') }}</NRadio>
                    </label>
                    <label class="local-strategy-pill">
                      <NRadio value="overwrite">{{ $t('dataManager.import.overwriteDuplicate') }}</NRadio>
                    </label>
                    <label class="local-strategy-pill">
                      <NRadio value="merge">{{ $t('dataManager.import.createCopy') }}</NRadio>
                    </label>
                  </div>
                </NRadioGroup>
              </div>
              </div>
            </NCollapseItem>
          </NCollapse>

          <NText depth="3" class="local-import-warning">
            {{ $t('dataManager.warning') }}
          </NText>
        </div>
      </section>

      <section class="data-manager-section">
        <div class="section-heading">
          <div>
            <NText tag="h3" :depth="1" strong class="section-title">
              {{ $t('dataManager.remote.title') }}
            </NText>
            <NText depth="3" class="section-description">
              {{ $t(remoteRecommendationKey) }}
            </NText>
          </div>
        </div>

        <div class="remote-backup-grid">
          <article class="remote-config-panel">
            <div class="remote-field">
              <NText depth="3" class="remote-field-label">
                {{ $t('dataManager.remote.provider') }}
              </NText>
              <NSelect
                :value="remoteSettings.provider.kind"
                :options="remoteProviderOptions"
                @update:value="handleRemoteProviderChange"
              />
            </div>

            <div
              v-if="remoteSettings.provider.kind !== 'google-drive'"
              class="remote-connection-card"
              :class="`remote-connection-card--${currentRemoteConnection.status}`"
            >
              <div class="remote-connection-main">
                <div class="remote-provider-summary-copy">
                  <NText strong>{{ currentRemoteConnectionTitle }}</NText>
                  <NText depth="3" class="remote-field-help">
                    {{ currentRemoteConnectionMessage }}
                  </NText>
                  <NText v-if="currentRemoteConnection.lastCheckedAt" depth="3" class="remote-field-help">
                    {{ $t('dataManager.remote.lastCheckedAt', { time: new Date(currentRemoteConnection.lastCheckedAt).toLocaleString() }) }}
                  </NText>
                </div>
                <NTag size="small" :type="currentRemoteConnectionTagType">
                  {{ currentRemoteConnectionLabel }}
                </NTag>
              </div>
              <div class="remote-action-row remote-action-row--compact remote-connection-actions">
                <NButton
                  type="primary"
                  :loading="isConnectingRemote"
                  :disabled="!isCurrentRemoteProviderConfigured"
                  @click="handleRemoteSaveAndConnect"
                >
                  {{ $t('dataManager.remote.saveAndConnect') }}
                </NButton>
                <NButton
                  v-if="isCurrentRemoteProviderConfigured"
                  secondary
                  @click="isRemoteConfigExpanded = !isRemoteConfigExpanded"
                >
                  {{
                    isRemoteConfigExpanded
                      ? $t('dataManager.remote.hideConfiguration')
                      : $t('dataManager.remote.editConfiguration')
                  }}
                </NButton>
              </div>
            </div>

            <template v-if="remoteSettings.provider.kind === 'google-drive'">
              <div class="remote-action-row remote-action-row--auth">
                <NButton
                  secondary
                  :type="isGoogleDriveAuthorized ? 'success' : 'default'"
                  :loading="isAuthorizingRemote"
                  @click="handleRemoteAuthorize"
                >
                  {{ googleDriveAuthorizationLabel }}
                </NButton>
              </div>
              <div class="remote-field">
                <NText depth="3" class="remote-field-help">
                  {{ $t('dataManager.remote.googleDrivePath', { path: `/${GOOGLE_DRIVE_DEFAULT_BACKUP_FOLDER_NAME}` }) }}
                </NText>
              </div>
            </template>

            <template v-else-if="remoteSettings.provider.kind === 'cloudflare-r2'">
              <div v-if="showRemoteConfigForm" class="remote-provider-summary">
                <div class="remote-provider-summary-copy">
                  <NText strong>{{ $t('dataManager.remote.configuration') }}</NText>
                  <NText depth="3" class="remote-field-help">
                    {{
                      isCloudflareR2Configured
                        ? $t('dataManager.remote.cloudflareR2ConfiguredSummary', {
                            bucket: cloudflareR2BucketPreview,
                            prefix: `/${CLOUDFLARE_R2_DEFAULT_BACKUP_PREFIX}`,
                          })
                        : $t('dataManager.remote.cloudflareR2SetupSummary')
                    }}
                  </NText>
                </div>
                <div class="remote-provider-summary-actions">
                  <NTag size="small" :type="isCloudflareR2Configured ? 'success' : 'warning'">
                    {{
                      isCloudflareR2Configured
                        ? $t('dataManager.remote.configured')
                        : $t('dataManager.remote.setupRequired')
                    }}
                  </NTag>
                  <NButton
                    v-if="isCloudflareR2Configured"
                    size="small"
                    secondary
                    @click="isCloudflareR2SetupGuideExpanded = !isCloudflareR2SetupGuideExpanded"
                  >
                    {{
                      isCloudflareR2Configured
                        ? (
                            isCloudflareR2SetupGuideExpanded
                              ? $t('dataManager.remote.hideSetupGuide')
                              : $t('dataManager.remote.showSetupGuide')
                          )
                        : $t('dataManager.remote.showSetupGuide')
                    }}
                  </NButton>
                </div>
              </div>

              <div v-if="showRemoteConfigForm && shouldShowCloudflareR2SetupGuide" class="remote-steps">
                <section
                  class="remote-step"
                  :class="{
                    'remote-step--active': cloudflareR2CurrentSetupStep === 'account',
                    'remote-step--collapsed': !isCloudflareR2StepExpanded('account'),
                  }"
                >
                  <NButton
                    text
                    class="remote-step-header"
                    @click="toggleCloudflareR2Step('account')"
                  >
                    <span class="remote-step-number">1</span>
                    <div class="remote-step-copy">
                      <NText strong>{{ $t('dataManager.remote.cloudflareSteps.account.title') }}</NText>
                      <NText v-if="isCloudflareR2StepExpanded('account')" depth="3" class="remote-field-help">
                        {{ $t('dataManager.remote.cloudflareSteps.account.description') }}
                      </NText>
                    </div>
                    <span
                      class="remote-step-toggle"
                      :class="{ 'remote-step-toggle--open': isCloudflareR2StepExpanded('account') }"
                    >
                      <NIcon><ChevronDown /></NIcon>
                    </span>
                  </NButton>
                  <div v-if="isCloudflareR2StepExpanded('account')" class="remote-step-body">
                    <div class="remote-field">
                      <NText depth="3" class="remote-field-label">{{ $t('dataManager.remote.accountId') }}</NText>
                      <NInput v-model:value="remoteSettings.provider.accountId" clearable @update:value="markRemoteSettingsDirty" />
                    </div>
                    <div class="remote-link-row">
                      <NButton size="small" secondary @click="openCloudflareR2Link('dashboard')">
                        <template #icon>
                          <NIcon><ExternalLink /></NIcon>
                        </template>
                        {{ $t('dataManager.remote.cloudflareSteps.account.action') }}
                      </NButton>
                    </div>
                  </div>
                </section>

                <section
                  class="remote-step"
                  :class="{
                    'remote-step--active': cloudflareR2CurrentSetupStep === 'bucket',
                    'remote-step--collapsed': !isCloudflareR2StepExpanded('bucket'),
                  }"
                >
                  <NButton
                    text
                    class="remote-step-header"
                    @click="toggleCloudflareR2Step('bucket')"
                  >
                    <span class="remote-step-number">2</span>
                    <div class="remote-step-copy">
                      <NText strong>{{ $t('dataManager.remote.cloudflareSteps.bucket.title') }}</NText>
                      <NText v-if="isCloudflareR2StepExpanded('bucket')" depth="3" class="remote-field-help">
                        {{ $t('dataManager.remote.cloudflareSteps.bucket.description') }}
                      </NText>
                    </div>
                    <span
                      class="remote-step-toggle"
                      :class="{ 'remote-step-toggle--open': isCloudflareR2StepExpanded('bucket') }"
                    >
                      <NIcon><ChevronDown /></NIcon>
                    </span>
                  </NButton>
                  <div v-if="isCloudflareR2StepExpanded('bucket')" class="remote-step-body">
                    <div class="remote-field">
                      <NText depth="3" class="remote-field-label">{{ $t('dataManager.remote.bucket') }}</NText>
                      <NInput v-model:value="remoteSettings.provider.bucket" clearable @update:value="markRemoteSettingsDirty" />
                    </div>
                    <div class="remote-action-row remote-action-row--compact">
                      <NButton size="small" secondary @click="openCloudflareR2Link('buckets')">
                        <template #icon>
                          <NIcon><ExternalLink /></NIcon>
                        </template>
                        {{ $t('dataManager.remote.cloudflareSteps.bucket.action') }}
                      </NButton>
                      <NButton size="small" secondary @click="copyCloudflareR2CorsConfig">
                        <template #icon>
                          <NIcon><Clipboard /></NIcon>
                        </template>
                        {{ $t('dataManager.remote.cloudflareSteps.bucket.corsAction') }}
                      </NButton>
                    </div>
                    <div class="remote-field">
                      <NText depth="3" class="remote-field-help">
                        {{ $t('dataManager.remote.cloudflareEndpoint', { endpoint: cloudflareR2EndpointPreview || 'https://<account-id>.r2.cloudflarestorage.com' }) }}
                      </NText>
                      <NText depth="3" class="remote-field-help">
                        {{ $t('dataManager.remote.cloudflareBucketPreview', { bucket: cloudflareR2BucketPreview }) }}
                      </NText>
                      <NText depth="3" class="remote-field-help">
                        {{ $t('dataManager.remote.cloudflareObjectPrefix', { prefix: `/${CLOUDFLARE_R2_DEFAULT_BACKUP_PREFIX}` }) }}
                      </NText>
                    </div>
                  </div>
                </section>

                <section
                  class="remote-step"
                  :class="{
                    'remote-step--active': cloudflareR2CurrentSetupStep === 'credentials',
                    'remote-step--collapsed': !isCloudflareR2StepExpanded('credentials'),
                  }"
                >
                  <NButton
                    text
                    class="remote-step-header"
                    @click="toggleCloudflareR2Step('credentials')"
                  >
                    <span class="remote-step-number">3</span>
                    <div class="remote-step-copy">
                      <NText strong>{{ $t('dataManager.remote.cloudflareSteps.credentials.title') }}</NText>
                      <NText v-if="isCloudflareR2StepExpanded('credentials')" depth="3" class="remote-field-help">
                        {{ $t('dataManager.remote.cloudflareSteps.credentials.description') }}
                      </NText>
                    </div>
                    <span
                      class="remote-step-toggle"
                      :class="{ 'remote-step-toggle--open': isCloudflareR2StepExpanded('credentials') }"
                    >
                      <NIcon><ChevronDown /></NIcon>
                    </span>
                  </NButton>
                  <div v-if="isCloudflareR2StepExpanded('credentials')" class="remote-step-body">
                    <div class="remote-two-column">
                      <div class="remote-field">
                        <NText depth="3" class="remote-field-label">{{ $t('dataManager.remote.accessKey') }}</NText>
                        <NInput v-model:value="remoteSettings.provider.accessKeyId" clearable @update:value="markRemoteSettingsDirty" />
                      </div>
                      <div class="remote-field">
                        <NText depth="3" class="remote-field-label">{{ $t('dataManager.remote.secretKey') }}</NText>
                        <NInput v-model:value="remoteSettings.provider.secretAccessKey" type="password" show-password-on="click" clearable @update:value="markRemoteSettingsDirty" />
                      </div>
                    </div>
                    <div class="remote-action-row remote-action-row--compact">
                      <NButton size="small" secondary @click="openCloudflareR2Link('apiTokens')">
                        <template #icon>
                          <NIcon><ExternalLink /></NIcon>
                        </template>
                        {{ $t('dataManager.remote.cloudflareSteps.credentials.tokenAction') }}
                      </NButton>
                      <NButton size="small" secondary @click="openCloudflareR2Link('docs')">
                        <template #icon>
                          <NIcon><ExternalLink /></NIcon>
                        </template>
                        {{ $t('dataManager.remote.cloudflareSteps.credentials.docsAction') }}
                      </NButton>
                    </div>
                  </div>
                </section>
              </div>
            </template>

            <template v-else-if="remoteSettings.provider.kind === 's3-compatible'">
              <div v-if="showRemoteConfigForm" class="remote-provider-form">
                <div class="remote-two-column">
                  <div class="remote-field">
                    <NText depth="3" class="remote-field-label">{{ $t('dataManager.remote.endpoint') }}</NText>
                    <NInput v-model:value="remoteSettings.provider.endpoint" placeholder="https://..." clearable @update:value="markRemoteSettingsDirty" />
                  </div>
                  <div class="remote-field">
                    <NText depth="3" class="remote-field-label">{{ $t('dataManager.remote.bucket') }}</NText>
                    <NInput v-model:value="remoteSettings.provider.bucket" clearable @update:value="markRemoteSettingsDirty" />
                  </div>
                  <div class="remote-field">
                    <NText depth="3" class="remote-field-label">{{ $t('dataManager.remote.region') }}</NText>
                    <NInput v-model:value="remoteSettings.provider.region" placeholder="auto" clearable @update:value="markRemoteSettingsDirty" />
                  </div>
                  <div class="remote-field">
                    <NText depth="3" class="remote-field-label">{{ $t('dataManager.remote.prefix') }}</NText>
                    <NInput v-model:value="remoteSettings.provider.prefix" clearable @update:value="markRemoteSettingsDirty" />
                  </div>
                  <div class="remote-field">
                    <NText depth="3" class="remote-field-label">{{ $t('dataManager.remote.accessKey') }}</NText>
                    <NInput v-model:value="remoteSettings.provider.accessKeyId" clearable @update:value="markRemoteSettingsDirty" />
                  </div>
                  <div class="remote-field">
                    <NText depth="3" class="remote-field-label">{{ $t('dataManager.remote.secretKey') }}</NText>
                    <NInput v-model:value="remoteSettings.provider.secretAccessKey" type="password" show-password-on="click" clearable @update:value="markRemoteSettingsDirty" />
                  </div>
                </div>
                <NCheckbox v-model:checked="remoteSettings.provider.forcePathStyle" @update:checked="markRemoteSettingsDirty">
                  {{ $t('dataManager.remote.forcePathStyle') }}
                </NCheckbox>
                <NText depth="3" class="remote-field-help">
                  {{ isDesktopRuntime ? $t('dataManager.remote.s3DesktopHelp') : $t('dataManager.remote.s3WebHelp') }}
                </NText>
              </div>
            </template>

            <template v-else>
              <div v-if="showRemoteConfigForm" class="remote-provider-form">
                <div class="remote-field">
                  <NText depth="3" class="remote-field-label">{{ $t('dataManager.remote.endpoint') }}</NText>
                  <NInput v-model:value="remoteSettings.provider.endpoint" placeholder="https://..." clearable @update:value="markRemoteSettingsDirty" />
                </div>
                <div class="remote-two-column">
                  <div class="remote-field">
                    <NText depth="3" class="remote-field-label">{{ $t('dataManager.remote.username') }}</NText>
                    <NInput v-model:value="remoteSettings.provider.username" clearable @update:value="markRemoteSettingsDirty" />
                  </div>
                  <div class="remote-field">
                    <NText depth="3" class="remote-field-label">{{ $t('dataManager.remote.password') }}</NText>
                    <NInput v-model:value="remoteSettings.provider.password" type="password" show-password-on="click" clearable @update:value="markRemoteSettingsDirty" />
                  </div>
                </div>
                <div class="remote-field">
                  <NText depth="3" class="remote-field-label">{{ $t('dataManager.remote.directory') }}</NText>
                  <NInput v-model:value="remoteSettings.provider.directory" clearable @update:value="markRemoteSettingsDirty" />
                </div>
                <NText depth="3" class="remote-field-help">
                  {{ isDesktopRuntime ? $t('dataManager.remote.webdavDesktopHelp') : $t('dataManager.remote.webdavWebHelp') }}
                </NText>
              </div>
            </template>

          </article>

          <article class="remote-config-panel">
            <div class="remote-action-row">
              <NButton
                type="primary"
                :loading="isUploadingRemote"
                :disabled="!isCurrentRemoteProviderConfigured || isRemoteDataOperationActive"
                @click="handleRemoteUpload"
              >
                <template #icon>
                  <NIcon><Upload /></NIcon>
                </template>
                {{ $t('dataManager.remote.backupNow') }}
              </NButton>
              <NButton
                secondary
                :loading="isLoadingRemoteList"
                :disabled="!isCurrentRemoteProviderConfigured || isRemoteDataOperationActive"
                @click="handleRemoteRefresh"
              >
                <template #icon>
                  <NIcon><Refresh /></NIcon>
                </template>
                {{ $t('dataManager.remote.refreshList') }}
              </NButton>
              <NButton
                secondary
                :loading="isCleaningRemoteAssets"
                :disabled="!isCurrentRemoteProviderConfigured || isRemoteDataOperationActive"
                @click="handleRemoteCleanup"
              >
                <template #icon>
                  <NIcon><Trash /></NIcon>
                </template>
                {{ $t('dataManager.remote.cleanupAssets') }}
              </NButton>
            </div>
            <div v-if="remoteProgress.active" class="remote-progress">
              <NProgress
                type="line"
                :percentage="remoteProgress.percent"
                :height="8"
                :border-radius="4"
                :fill-border-radius="4"
                :show-indicator="false"
              />
              <NText depth="3" class="remote-progress-text">
                {{ remoteProgress.message }}
              </NText>
            </div>

            <div class="remote-field">
              <NText depth="3" class="remote-field-label">
                {{ $t('dataManager.remote.restoreFrom') }}
              </NText>
              <NSelect
                v-model:value="selectedRemoteBackupId"
                :options="remoteBackupOptions"
                :placeholder="$t('dataManager.remote.noBackups')"
                filterable
              />
            </div>

            <div v-if="selectedRemoteBackup" class="remote-field remote-restore-scope">
              <NText depth="3" class="remote-field-label">
                {{ $t('dataManager.remote.restoreScope') }}
              </NText>
              <NText
                v-if="selectedRemoteBackupMissingAssetsCount > 0"
                depth="3"
                class="storage-note"
              >
                {{ $t('dataManager.remote.restoreMissingAssetsHint', { count: selectedRemoteBackupMissingAssetsCount }) }}
              </NText>
              <div class="local-scope-row">
                <label class="local-scope-pill">
                  <NCheckbox
                    v-model:checked="remoteRestoreAppData"
                    :disabled="!availableRemoteRestoreSections.has('appData')"
                  >
                    {{ $t('dataManager.sections.appData') }}
                  </NCheckbox>
                </label>
                <label class="local-scope-pill">
                  <NCheckbox
                    v-model:checked="remoteRestoreAppDataImages"
                    :disabled="!remoteRestoreAppData || !availableRemoteRestoreSections.has('imageCache')"
                  >
                    {{ $t('dataManager.sections.appDataImages') }}
                  </NCheckbox>
                </label>
                <label class="local-scope-pill">
                  <NCheckbox
                    v-model:checked="remoteRestoreFavorites"
                    :disabled="!availableRemoteRestoreSections.has('favorites')"
                  >
                    {{ $t('dataManager.sections.favoritesBundle') }}
                  </NCheckbox>
                </label>
                <label class="local-scope-pill">
                  <NCheckbox
                    v-model:checked="remoteRestoreFavoriteImages"
                    :disabled="!remoteRestoreFavorites || !availableRemoteRestoreSections.has('favoriteImages')"
                  >
                    {{ $t('dataManager.sections.favoriteImages') }}
                  </NCheckbox>
                </label>
              </div>
            </div>

            <div v-if="remoteRestoreFavorites" class="remote-field remote-restore-strategy">
              <NText depth="3" class="remote-field-label">
                {{ $t('dataManager.import.favoriteMergeStrategy') }}
              </NText>
              <NRadioGroup v-model:value="favoriteMergeStrategy">
                <div class="local-strategy-row">
                  <label class="local-strategy-pill">
                    <NRadio value="skip">{{ $t('dataManager.import.skipDuplicate') }}</NRadio>
                  </label>
                  <label class="local-strategy-pill">
                    <NRadio value="overwrite">{{ $t('dataManager.import.overwriteDuplicate') }}</NRadio>
                  </label>
                  <label class="local-strategy-pill">
                    <NRadio value="merge">{{ $t('dataManager.import.createCopy') }}</NRadio>
                  </label>
                </div>
              </NRadioGroup>
            </div>

            <NButton
              type="success"
              block
              :loading="isRestoringRemote"
              :disabled="!selectedRemoteBackup || isRemoteDataOperationActive || !hasSelectedRemoteRestoreSection"
              @click="handleRemoteRestore"
            >
              <template #icon>
                <NIcon><Download /></NIcon>
              </template>
              {{ $t('dataManager.remote.restoreSelected') }}
            </NButton>

          </article>
        </div>
      </section>

      <section v-if="isDesktopRuntime" class="data-manager-section data-manager-section--desktop">
        <div class="desktop-storage-row">
          <div class="storage-path-block">
            <NText depth="3" class="storage-path-label">{{ $t('dataManager.storage.path') }}</NText>
            <div class="storage-path-value">
              {{ storageSummary?.desktopInfo?.userDataPath || '—' }}
            </div>
          </div>

          <div v-if="desktopBackupItem" class="storage-desktop-stat">
            <NText depth="3">{{ $t('dataManager.storage.backupData') }}</NText>
            <div class="storage-desktop-stat-value">
              {{ formatStorageItemBytes(desktopBackupItem.bytes) }}
            </div>
          </div>

          <NButton size="small" @click="openStorageDir" :disabled="!canUseDesktopStorageTools">
            <template #icon>
              <NIcon><Folder /></NIcon>
            </template>
            {{ $t('dataManager.storage.openDir') }}
          </NButton>
        </div>
      </section>
    </div>
  </NModal>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal, NText, NButton, NUpload, NUploadDragger,
  NIcon, NCheckbox, NRadio, NRadioGroup, NSelect, NInput, NProgress, NTag,
  NCollapse, NCollapseItem,
  type UploadFileInfo,
} from 'naive-ui'
import { isRunningInElectron } from '@prompt-optimizer/core'
import { ChevronDown, Clipboard, Download, ExternalLink, Folder, Refresh, Trash, Upload } from '@vicons/tabler'
import { useToast } from '../composables/ui/useToast'
import { useConfirmDialog } from '../composables/ui/useConfirmDialog'
import type { AppServices } from '../types/services'
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
} from '../utils/data-manager-resource-package'
import {
  resolveDataManagerStorageBreakdown,
  type StorageBreakdownItem,
  type StorageBreakdownItemKey,
  type StorageBreakdownSummary,
} from '../utils/data-manager-storage'
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
  loadRemoteBackupSettings,
  rememberRemoteBackupProvider,
  saveRemoteBackupSettings,
  switchRemoteBackupProvider,
  type RemoteBackupProviderKind,
  type RemoteBackupProviderConfig,
  type RemoteBackupRuntime,
  type RemoteBackupSettings,
} from '../utils/remote-backup'
import {
  analyzeRemoteSnapshotAssetCleanup,
  cleanupRemoteSnapshotAssets,
  createRemoteSnapshotBackup,
  listRemoteSnapshotBackups,
  restoreRemoteSnapshotBackup,
  type RemoteSnapshotProgressEvent,
  type RemoteSnapshotEntry,
} from '../utils/remote-snapshot-backup'
import { recordDataBackupCompleted } from '../utils/data-backup-reminder'
import { openExternalUrl } from '../utils/open-external-url'
import { formatErrorSummary } from '../utils/error'

interface Props {
  show: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'imported'): void
  (e: 'update:show', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const toast = useToast()
const confirmDialog = useConfirmDialog()
const isDesktopRuntime = isRunningInElectron()
const remoteRuntime: RemoteBackupRuntime = isDesktopRuntime ? 'desktop' : 'web'
const DATA_MANAGER_MODAL_MAX_WIDTH = '1200px'
const dataManagerModalStyle = {
  width: 'calc(100vw - 32px)',
  maxWidth: DATA_MANAGER_MODAL_MAX_WIDTH,
  maxHeight: '90vh',
  overflow: 'hidden',
}

const services = inject<Ref<AppServices | null>>('services')
if (!services) {
  throw new Error('[DataManager] Services were not injected correctly. Make sure App provides the services instance.')
}

const getDataManager = computed(() => {
  const servicesValue = services.value
  if (!servicesValue) {
    throw new Error('[DataManager] Services are not initialized. Make sure the application has started correctly.')
  }

  const manager = servicesValue.dataManager
  if (!manager) {
    throw new Error('[DataManager] DataManager is not initialized. Make sure the service is configured correctly.')
  }

  return manager
})

const isExporting = ref(false)
const isImporting = ref(false)
const selectedFile = ref<UploadFileInfo | null>(null)
const importPreviewText = ref('')
const allPackageSections = Object.keys(DEFAULT_DATA_MANAGER_PACKAGE_SECTIONS) as DataManagerPackageSection[]
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
type CloudflareR2SetupStep = 'account' | 'bucket' | 'credentials'
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

const isCloudflareR2ProviderConfigured = (
  provider: RemoteBackupProviderConfig,
): boolean =>
  provider.kind === 'cloudflare-r2' &&
  Boolean(
    provider.accountId.trim() &&
    provider.bucket.trim() &&
    provider.accessKeyId.trim() &&
    provider.secretAccessKey.trim(),
  )
const isCloudflareR2SetupGuideExpanded = ref(
  remoteSettings.value.provider.kind === 'cloudflare-r2'
    ? false
    : false,
)
const cloudflareR2ExpandedSteps = ref(new Set<CloudflareR2SetupStep>())
const isAuthorizingRemote = ref(false)
const isGoogleDriveAuthorized = ref(isGoogleDriveRemoteBackupAuthorized())
const isConnectingRemote = ref(false)
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
const isRemoteDataOperationActive = computed(() =>
  isUploadingRemote.value ||
  isLoadingRemoteList.value ||
  isRestoringRemote.value ||
  isCleaningRemoteAssets.value,
)
const remoteBackups = ref<RemoteSnapshotEntry[]>([])
const selectedRemoteBackupId = ref<string | null>(null)
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

const storageCardItemKeys: StorageBreakdownItemKey[] = ['appMainData', 'imageCache', 'favoriteImages']

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
  }))
)

const remoteRecommendationKey = computed(() =>
  isDesktopRuntime
    ? 'dataManager.remote.desktopRecommendation'
    : 'dataManager.remote.webRecommendation'
)

const remoteBackupOptions = computed(() =>
  remoteBackups.value.map((entry) => ({
    label: `${entry.name}${entry.updatedAt ? ` · ${new Date(entry.updatedAt).toLocaleString()}` : ''}`,
    value: entry.id,
  }))
)

const googleDriveAuthorizationLabel = computed(() =>
  isGoogleDriveAuthorized.value
    ? t('dataManager.remote.authorizedGoogleDrive')
    : t('dataManager.remote.authorizeGoogleDrive')
)

const selectedRemoteBackup = computed(() =>
  remoteBackups.value.find((entry) => entry.id === selectedRemoteBackupId.value) ?? null
)
const getRemoteBackupIncludedSectionSet = (entry: RemoteSnapshotEntry | null): Set<DataManagerPackageSection> => {
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
  getRemoteBackupIncludedSectionSet(selectedRemoteBackup.value)
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
const hasSelectedRemoteRestoreSection = computed(() =>
  (remoteRestoreAppData.value && availableRemoteRestoreSections.value.has('appData')) ||
  (remoteRestoreAppData.value && remoteRestoreAppDataImages.value && availableRemoteRestoreSections.value.has('imageCache')) ||
  (remoteRestoreFavorites.value && availableRemoteRestoreSections.value.has('favorites')) ||
  (remoteRestoreFavorites.value && remoteRestoreFavoriteImages.value && availableRemoteRestoreSections.value.has('favoriteImages'))
)

watch(selectedRemoteBackup, () => {
  resetRemoteRestoreSelection()
})

const cloudflareR2Provider = computed(() =>
  remoteSettings.value.provider.kind === 'cloudflare-r2'
    ? remoteSettings.value.provider
    : null
)

const cloudflareR2Links = computed(() =>
  getCloudflareR2DashboardLinks(cloudflareR2Provider.value?.accountId ?? '')
)

const cloudflareR2EndpointPreview = computed(() =>
  getCloudflareR2Endpoint(cloudflareR2Provider.value?.accountId ?? '')
)

const cloudflareR2BucketPreview = computed(() =>
  cloudflareR2Provider.value?.bucket.trim() || 'prompt-optimizer-backups'
)

const isCloudflareR2Configured = computed(() =>
  remoteSettings.value.provider.kind === 'cloudflare-r2' &&
  isCloudflareR2ProviderConfigured(remoteSettings.value.provider)
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

const currentRemoteConnection = computed(() =>
  remoteConnectionStates.value[remoteSettings.value.provider.kind]
)

const isCurrentRemoteProviderConfigured = computed(() =>
  isRemoteProviderConfigured(remoteSettings.value.provider)
)

const isCurrentRemoteProviderConnected = computed(() =>
  remoteSettings.value.provider.kind !== 'google-drive' &&
  currentRemoteConnection.value.status === 'connected'
)

const showRemoteConfigForm = computed(() =>
  remoteSettings.value.provider.kind !== 'google-drive' &&
  (
    !isCurrentRemoteProviderConfigured.value ||
    isRemoteConfigExpanded.value
  )
)

const currentRemoteConnectionLabel = computed(() =>
  t(`dataManager.remote.connectionStatus.${currentRemoteConnection.value.status}`)
)

const currentRemoteConnectionTitle = computed(() =>
  isCurrentRemoteProviderConnected.value
    ? t('dataManager.remote.connectionReadyTitle')
    : t('dataManager.remote.connectionSetupTitle')
)

const currentRemoteConnectionMessage = computed(() => {
  const state = currentRemoteConnection.value
  if (state.message) return state.message
  if (!isCurrentRemoteProviderConfigured.value) return t('dataManager.remote.connectionMissingConfig')
  if (state.status === 'connected') return remoteConnectionSummary.value
  if (state.status === 'checking') return t('dataManager.remote.connectionChecking')
  return t('dataManager.remote.connectionNeedsCheck')
})

const currentRemoteConnectionTagType = computed<'default' | 'success' | 'warning' | 'error' | 'info'>(() => {
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

const cloudflareR2CurrentSetupStep = computed<CloudflareR2SetupStep | null>(() => {
  const provider = cloudflareR2Provider.value
  if (!provider) return null
  if (!provider.accountId.trim()) return 'account'
  if (!provider.bucket.trim()) return 'bucket'
  if (!provider.accessKeyId.trim() || !provider.secretAccessKey.trim()) return 'credentials'
  return null
})

const shouldShowCloudflareR2SetupGuide = computed(() =>
  remoteSettings.value.provider.kind === 'cloudflare-r2' &&
  (!isCloudflareR2Configured.value || isCloudflareR2SetupGuideExpanded.value)
)

const isCloudflareR2StepExpanded = (step: CloudflareR2SetupStep): boolean =>
  cloudflareR2ExpandedSteps.value.has(step)

const toggleCloudflareR2Step = (step: CloudflareR2SetupStep) => {
  const next = new Set(cloudflareR2ExpandedSteps.value)
  if (next.has(step)) {
    next.delete(step)
  } else {
    next.add(step)
  }
  cloudflareR2ExpandedSteps.value = next
}

const canImportFavoritesBundle = computed(() =>
  availableImportSections.value.has('favorites')
)

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
  storageCardItemKeys.map(key =>
    storageSummary.value?.items.find(item => item.key === key)
    ?? {
      key,
      bytes: null,
      count: null,
      estimated: key === 'appMainData',
    }
  )
)

const desktopBackupItem = computed<StorageBreakdownItem | null>(() =>
  storageSummary.value?.items.find(item => item.key === 'backupData') ?? null
)

const canUseDesktopStorageTools = computed(() =>
  isDesktopRuntime && Boolean(window.electronAPI?.data)
)

const refreshStorageSummary = async () => {
  try {
    isRefreshingStorage.value = true
    const servicesValue = services.value
    if (!servicesValue) {
      throw new Error('[DataManager] Services are not initialized. Make sure the application has started correctly.')
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
  saveRemoteBackupSettings(remoteSettings.value)
  const provider = remoteSettings.value.provider
  if (markDirty && provider.kind !== 'google-drive' && currentRemoteConnection.value.status !== 'checking') {
    remoteConnectionStates.value = {
      ...remoteConnectionStates.value,
      [provider.kind]: {
        ...remoteConnectionStates.value[provider.kind],
        status: isRemoteProviderConfigured(provider) ? 'unverified' : 'unconfigured',
        message: '',
      },
    }
    isRemoteConfigExpanded.value = true
  }
}

const markRemoteSettingsDirty = () => persistRemoteSettings()

const syncGoogleDriveAuthorizationState = () => {
  if (isDesktopRuntime && remoteSettings.value.provider.kind === 'google-drive') return
  isGoogleDriveAuthorized.value = isGoogleDriveRemoteBackupAuthorized()
}

const markGoogleDriveAuthorizationSuccess = () => {
  if (isDesktopRuntime && remoteSettings.value.provider.kind === 'google-drive') {
    isGoogleDriveAuthorized.value = true
    return
  }
  syncGoogleDriveAuthorizationState()
}

const handleRemoteProviderChange = (value: string) => {
  const kind = value as RemoteBackupProviderKind
  remoteSettings.value = switchRemoteBackupProvider(remoteSettings.value, kind)
  isCloudflareR2SetupGuideExpanded.value = false
  cloudflareR2ExpandedSteps.value = new Set()
  isRemoteConfigExpanded.value = false
  remoteBackups.value = []
  selectedRemoteBackupId.value = null
  isGoogleDriveAuthorized.value = isDesktopRuntime && kind === 'google-drive'
    ? false
    : isGoogleDriveRemoteBackupAuthorized()
  persistRemoteSettings()
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
    active: Boolean(messageKey),
    percent: 100,
    message: messageKey ? t(messageKey) : '',
  }
}

const openCloudflareR2Link = (
  key: 'dashboard' | 'buckets' | 'apiTokens' | 'docs',
) => {
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
  try {
    persistRemoteSettings(false)
    isAuthorizingRemote.value = true
    const objectStore = getRemoteStore()
    if (!objectStore.authorize) {
      toast.warning(t('dataManager.remote.authorizeUnavailable'))
      return
    }
    await objectStore.authorize()
    markGoogleDriveAuthorizationSuccess()
    toast.success(t('dataManager.remote.authorizeSuccess'))
  } catch (error) {
    console.error('[DataManager] Remote authorization failed:', error)
    toast.error(t('dataManager.remote.authorizeFailed', { message: (error as Error).message }))
  } finally {
    isAuthorizingRemote.value = false
  }
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
  const provider = remoteSettings.value.provider
  if (provider.kind === 'google-drive') return

  persistRemoteSettings()
  try {
    isConnectingRemote.value = true
    const connected = await ensureRemoteConnectionReady({
      showMissingToast: true,
      showFailureToast: true,
      showSuccessToast: true,
    })
    if (connected) {
      await refreshRemoteBackups({ skipConnectionCheck: true })
    }
  } finally {
    isConnectingRemote.value = false
  }
}

const ensureRemoteConnectionReady = async (options?: {
  showMissingToast?: boolean
  showFailureToast?: boolean
  showSuccessToast?: boolean
}): Promise<boolean> => {
  const provider = remoteSettings.value.provider
  if (provider.kind === 'google-drive') return true
  if (currentRemoteConnection.value.status === 'connected') return true

  if (!isRemoteProviderConfigured(provider)) {
    setRemoteConnectionState(provider.kind, {
      status: 'unconfigured',
      message: t('dataManager.remote.connectionMissingConfig'),
    })
    if (options?.showMissingToast !== false) {
      toast.warning(t('dataManager.remote.connectionMissingConfig'))
    }
    isRemoteConfigExpanded.value = true
    return false
  }

  try {
    setRemoteConnectionState(provider.kind, {
      status: 'checking',
      message: t('dataManager.remote.connectionChecking'),
    })
    const result = await getRemoteStore().detect()
    if (!result.ok) {
      const failedStep = result.steps.find((step) => !step.ok)
      throw new Error(failedStep?.message || t('dataManager.remote.connectionFailedGeneric'))
    }
    setRemoteConnectionState(provider.kind, {
      status: 'connected',
      lastCheckedAt: Date.now(),
      message: '',
    })
    isRemoteConfigExpanded.value = false
    if (options?.showSuccessToast) {
      toast.success(t('dataManager.remote.connectionSuccess'))
    }
    return true
  } catch (error) {
    console.error('[DataManager] Remote connection failed:', error)
    setRemoteConnectionState(provider.kind, {
      status: 'failed',
      message: (error as Error).message,
    })
    isRemoteConfigExpanded.value = true
    if (options?.showFailureToast !== false) {
      toast.error(t('dataManager.remote.connectionFailed', { message: (error as Error).message }))
    }
    return false
  }
}

const refreshRemoteBackups = async (options?: { skipConnectionCheck?: boolean }) => {
  if (!options?.skipConnectionCheck && !(await ensureRemoteConnectionReady())) return

  try {
    persistRemoteSettings(false)
    isLoadingRemoteList.value = true
    startRemoteProgress('list', 'dataManager.remote.progress.list.start')
    remoteBackups.value = await listRemoteSnapshotBackups(getRemoteStore(), (event) =>
      updateRemoteProgress('list', event),
    )
    markGoogleDriveAuthorizationSuccess()
    if (!remoteBackups.value.some((entry) => entry.id === selectedRemoteBackupId.value)) {
      selectedRemoteBackupId.value = remoteBackups.value[0]?.id ?? null
    }
  } catch (error) {
    console.error('[DataManager] Failed to list remote backups:', error)
    toast.error(t('dataManager.remote.listFailed', { message: (error as Error).message }))
  } finally {
    isLoadingRemoteList.value = false
    finishRemoteProgress()
  }
}

const handleRemoteRefresh = () => {
  if (isRemoteDataOperationActive.value) return
  refreshRemoteBackups()
}

const handleRemoteUpload = async () => {
  if (isRemoteDataOperationActive.value) return
  if (!(await ensureRemoteConnectionReady())) return

  try {
    persistRemoteSettings(false)
    isUploadingRemote.value = true
    startRemoteProgress('backup', 'dataManager.remote.progress.backup.start')
    const servicesValue = services.value
    if (!servicesValue) {
      throw new Error('[DataManager] Services are not initialized. Make sure the application has started correctly.')
    }
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
    markGoogleDriveAuthorizationSuccess()
    selectedRemoteBackupId.value = entry.id
    recordDataBackupCompleted()
    if (result.missingAssets.length > 0) {
      toast.warning(t('dataManager.export.partialSuccess', {
        count: result.missingAssets.length,
      }))
    } else {
      toast.success(t('dataManager.remote.backupSuccess', {
        uploaded: result.uploadedAssets,
        skipped: result.skippedAssets,
      }))
    }
  } catch (error) {
    console.error('[DataManager] Remote backup failed:', error)
    toast.error(t('dataManager.remote.backupFailed', { message: (error as Error).message }))
  } finally {
    isUploadingRemote.value = false
    finishRemoteProgress()
  }
}

const handleRemoteRestore = async () => {
  if (isRemoteDataOperationActive.value) return
  const entry = selectedRemoteBackup.value
  if (!entry) return
  if (!(await ensureRemoteConnectionReady())) return

  try {
    isRestoringRemote.value = true
    startRemoteProgress('restore', 'dataManager.remote.progress.restore.start')
    const servicesValue = services.value
    if (!servicesValue) {
      throw new Error('[DataManager] Services are not initialized. Make sure the application has started correctly.')
    }
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
    toast.success(t('dataManager.import.packageSuccess', {
      restored: result.restored,
      skipped: result.skipped,
    }))
    const warning = buildRemoteSnapshotRestoreWarning(result)
    if (warning) {
      toast.warning(warning)
    }
    emit('imported')
    emit('close')
  } catch (error) {
    console.error('[DataManager] Remote restore failed:', error)
    toast.error(t('dataManager.remote.restoreFailed', { message: (error as Error).message }))
  } finally {
    isRestoringRemote.value = false
    finishRemoteProgress()
  }
}

const handleRemoteCleanup = async () => {
  if (isRemoteDataOperationActive.value) return
  if (!(await ensureRemoteConnectionReady())) return

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
      toast.warning(t('dataManager.remote.cleanupPartial', {
        deleted: cleanup.deleted,
        failed: cleanup.failed.length,
      }))
    } else {
      toast.success(t('dataManager.remote.cleanupSuccess', {
        count: cleanup.deleted,
        size: formatFileSize(cleanup.totalCandidateBytes),
      }))
    }
  } catch (error) {
    console.error('[DataManager] Remote asset cleanup failed:', error)
    toast.error(t('dataManager.remote.cleanupFailed', { message: (error as Error).message }))
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
  favoriteImages:
    importFavorites.value &&
    availableImportSections.value.has('favoriteImages'),
})

const toRemoteRestoreSectionSelection = (): DataManagerPackageSectionSelection => ({
  appData: remoteRestoreAppData.value && availableRemoteRestoreSections.value.has('appData'),
  favorites: remoteRestoreFavorites.value && availableRemoteRestoreSections.value.has('favorites'),
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
  resetImportSelection()

  const file = uploadFile?.file ?? null
  if (!file) return

  try {
    const buffer = await readFileAsArrayBuffer(file)
    const bytes = new Uint8Array(buffer)
    if (!looksLikeDataManagerZipPackage(file.name, bytes)) {
      availableImportSections.value = new Set(['appData'])
      importAppData.value = true
      importAppDataImages.value = false
      importFavorites.value = false
      importPreviewText.value = t('dataManager.import.legacyJsonPreview')
      return
    }

    const packageContent = readDataManagerResourcePackage(buffer)
    const includedSections = getIncludedDataManagerPackageSections(packageContent.manifest)
    availableImportSections.value = new Set(includedSections)
    importAppData.value = availableImportSections.value.has('appData')
    importAppDataImages.value = importAppData.value && availableImportSections.value.has('imageCache')
    importFavorites.value = canImportFavoritesBundle.value
    importPreviewText.value = t('dataManager.import.packagePreview', {
      sections: getBusinessSectionLabels(includedSections).join('、'),
    })
  } catch (error) {
    console.warn('[DataManager] Failed to preview import package:', error)
  }
}

const handleFileChange = (options: { fileList: UploadFileInfo[] }) => {
  selectedFile.value = options.fileList[0] ?? null
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
  if (event.key === 'Escape' && props.show) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

watch(
  () => props.show,
  (show) => {
    if (show) {
      void refreshStorageSummary()
    }
  },
  { immediate: true },
)

const handleExport = async () => {
  try {
    const servicesValue = services.value
    if (!servicesValue) {
      throw new Error('[DataManager] Services are not initialized. Make sure the application has started correctly.')
    }
    isExporting.value = true

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

    if (exportPackage.missingResources.length > 0) {
      toast.warning(t('dataManager.export.partialSuccess', {
        count: exportPackage.missingResources.length,
      }))
    } else {
      toast.success(t('dataManager.export.success'))
    }
  } catch (error) {
    console.error('Export failed:', error)
    toast.error(t('dataManager.export.failed'))
  } finally {
    isExporting.value = false
  }
}

const clearSelectedFile = () => {
  selectedFile.value = null
  resetImportSelection()
}

const buildPackageImportWarning = (result: DataManagerResourcePackageImportResult): string => {
  const warnings: string[] = []
  if (result.resources.missing.length > 0) {
    warnings.push(t('dataManager.import.resourcesMissing', {
      count: result.resources.missing.length,
    }))
  }
  if (result.resources.corrupt.length > 0) {
    warnings.push(t('dataManager.import.resourcesCorrupt', {
      count: result.resources.corrupt.length,
    }))
  }
  if (result.resources.errors.length > 0) {
    warnings.push(t('dataManager.import.resourcesFailed', {
      count: result.resources.errors.length,
    }))
  }
  return warnings.join('\n')
}

const buildRemoteSnapshotRestoreWarning = (
  result: {
    missing: Array<unknown>
    corrupt: Array<unknown>
    errors: string[]
  },
): string => {
  const warnings: string[] = []
  if (result.missing.length > 0) {
    warnings.push(t('dataManager.import.resourcesMissing', {
      count: result.missing.length,
    }))
  }
  if (result.corrupt.length > 0) {
    warnings.push(t('dataManager.import.resourcesCorrupt', {
      count: result.corrupt.length,
    }))
  }
  if (result.errors.length > 0) {
    warnings.push(t('dataManager.import.resourcesFailed', {
      count: result.errors.length,
    }))
  }
  return warnings.join('\n')
}

const handleImport = async () => {
  if (!selectedFile.value) return

  try {
    isImporting.value = true

    const file = selectedFile.value.file ?? null
    if (!file) {
      toast.error(t('dataManager.import.failed'))
      return
    }

    const buffer = await readFileAsArrayBuffer(file)
    const bytes = new Uint8Array(buffer)

    if (looksLikeDataManagerZipPackage(file.name, bytes)) {
      const servicesValue = services.value
      if (!servicesValue) {
        throw new Error('[DataManager] Services are not initialized. Make sure the application has started correctly.')
      }

      const result = await importDataManagerResourcePackage(buffer, {
        dataManager: getDataManager.value,
        favoriteManager: servicesValue.favoriteManager,
        imageStorageService: servicesValue.imageStorageService,
        favoriteImageStorageService: servicesValue.favoriteImageStorageService,
        sections: toImportSectionSelection(),
        favoriteMergeStrategy: favoriteMergeStrategy.value,
      })

      toast.success(t('dataManager.import.packageSuccess', {
        restored: result.resources.restored,
        skipped: result.resources.skipped,
      }))

      const warning = buildPackageImportWarning(result)
      if (warning) {
        toast.warning(warning)
      }
    } else {
      if (!importAppData.value) {
        toast.warning(t('dataManager.import.noSelectedContent'))
        return
      }
      const content = new TextDecoder().decode(bytes)
      const dataManager = getDataManager.value
      await dataManager.importAllData(content)
      toast.success(t('dataManager.import.success'))
    }

    emit('imported')
    emit('close')
    clearSelectedFile()
  } catch (error) {
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

const getStorageItemDetail = (item: Pick<StorageBreakdownItem, 'key' | 'count'>): string | null => {
  if (item.key === 'appMainData') {
    return t('dataManager.storage.appMainDataNote')
  }

  if ((item.key === 'imageCache' || item.key === 'favoriteImages') && item.count !== null) {
    return t('dataManager.storage.imageCount', { count: item.count })
  }

  return null
}
</script>

<style scoped>
:global(.data-manager-modal.n-card) {
  display: flex;
  flex-direction: column;
  max-height: min(90vh, 900px);
  overflow: hidden;
}

:global(.data-manager-modal.n-card > .n-card__content) {
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.data-manager-scroll-shell {
  width: 100%;
  max-height: calc(90vh - 112px);
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 2px 2px;
  box-sizing: border-box;
}

.data-manager-section {
  padding: 14px 0 16px;
  border-bottom: 1px solid var(--n-border-color);
  min-width: 0;
}

.data-manager-section:first-child {
  padding-top: 0;
}

.data-manager-section:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
  min-width: 0;
}

.section-heading > div {
  min-width: 0;
}

.section-title {
  display: block;
  font-size: 17px;
  line-height: 1.3;
}

.section-description {
  display: block;
  margin-top: 4px;
  line-height: 1.5;
}

.storage-cards-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.storage-stat-card {
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px;
  background: var(--n-color-embedded);
  min-width: 0;
  box-sizing: border-box;
}

.storage-stat-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 86px;
}

.storage-stat-card--total {
  background: var(--n-primary-color-suppl);
}

.storage-stat-value {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.1;
  margin-top: 4px;
}

.storage-note {
  display: block;
  font-size: 12px;
  margin-top: 6px;
}

.desktop-storage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.storage-path-block {
  min-width: 0;
  flex: 1;
}

.storage-path-label {
  font-size: 12px;
}

.storage-path-value {
  word-break: break-all;
  font-family: monospace;
  font-size: 12px;
  margin-top: 4px;
}

.storage-desktop-stat {
  min-width: 140px;
  padding: 10px 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color-embedded);
}

.storage-desktop-stat-value {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 600;
}

.remote-backup-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(260px, 0.92fr);
  gap: 12px;
  align-items: start;
  min-width: 0;
}

.remote-config-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px;
  background: var(--n-color-embedded);
  box-sizing: border-box;
}

.remote-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.remote-field > :deep(.n-input),
.remote-field > :deep(.n-select) {
  min-width: 0;
  max-width: 100%;
}

.remote-field-label {
  font-size: 12px;
}

.remote-field-help {
  display: block;
  font-size: 12px;
  line-height: 1.45;
}

.remote-two-column {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.remote-provider-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color);
}

.remote-provider-summary-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.remote-provider-summary-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.remote-connection-card,
.remote-provider-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.remote-connection-card {
  padding: 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color);
}

.remote-connection-card--connected {
  border-color: var(--n-success-color);
}

.remote-connection-card--failed {
  border-color: var(--n-error-color);
}

.remote-connection-card--checking {
  border-color: var(--n-info-color);
}

.remote-connection-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  min-width: 0;
}

.remote-connection-actions {
  padding-top: 2px;
}

.remote-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.remote-step {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color);
}

.remote-step--active {
  border-color: var(--n-primary-color);
}

.remote-step--collapsed {
  padding-block: 8px;
}

.remote-step + .remote-step {
  padding-top: 10px;
}

.remote-step-header {
  min-width: 0;
  width: 100%;
  padding: 0;
  color: inherit;
  text-align: left;
}

.remote-step-header :deep(.n-button__content) {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 18px;
  gap: 8px;
  align-items: start;
  width: 100%;
  min-width: 0;
  text-align: left;
}

.remote-step-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 22px;
  color: var(--n-text-color-3);
  transition: transform 0.16s ease;
}

.remote-step-toggle--open {
  transform: rotate(180deg);
}

.remote-step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--n-border-color);
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: var(--n-text-color);
  background: var(--n-color);
}

.remote-step-copy,
.remote-step-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.remote-action-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.remote-action-row > :deep(.n-button) {
  flex: 1 1 150px;
  min-width: 0;
  max-width: 100%;
}

.remote-action-row--auth > :deep(.n-button) {
  flex-basis: 100%;
}

.remote-action-row--compact > :deep(.n-button) {
  flex: 0 1 auto;
}

.remote-link-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.remote-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color);
}

.remote-progress-text {
  display: block;
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.local-transfer-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color-embedded);
  box-sizing: border-box;
}

.local-transfer-row {
  display: grid;
  grid-template-columns: minmax(180px, 0.72fr) minmax(260px, 1fr) minmax(132px, auto);
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.local-transfer-copy {
  min-width: 0;
}

.local-transfer-title {
  display: block;
  font-size: 14px;
  line-height: 1.35;
}

.local-transfer-description,
.local-import-warning,
.local-file-note {
  display: block;
  font-size: 12px;
  line-height: 1.45;
}

.local-transfer-description {
  margin-top: 3px;
}

.local-scope-row,
.local-strategy-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.local-scope-pill,
.local-strategy-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  max-width: 100%;
  padding: 0 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color);
  box-sizing: border-box;
}

.local-file-picker {
  min-width: 0;
}

.local-file-picker :deep(.n-upload-dragger) {
  padding: 0;
  background: var(--n-color);
}

.local-import-dropzone,
.local-import-selected {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 8px 10px;
  text-align: left;
}

.local-import-selected {
  justify-content: space-between;
}

.local-selected-file-copy {
  min-width: 0;
  overflow-wrap: anywhere;
}

.local-transfer-divider {
  height: 1px;
  background: var(--n-border-color);
}

.local-import-settings {
  padding: 0 2px;
  border-radius: 8px;
  background: var(--n-color);
}

.local-import-settings :deep(.n-collapse-item__header) {
  padding: 8px 10px;
  font-size: 12px;
}

.local-import-settings :deep(.n-collapse-item__content-inner) {
  padding: 0 10px 10px;
}

.local-import-settings-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.local-settings-title {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
}

.local-import-warning {
  padding-left: 2px;
}

@media (max-width: 1040px) {
  .remote-backup-grid {
    grid-template-columns: 1fr;
  }

  .local-transfer-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .storage-cards-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .remote-two-column {
    grid-template-columns: 1fr;
  }

  .remote-provider-summary {
    grid-template-columns: 1fr;
  }

  .remote-connection-main {
    grid-template-columns: 1fr;
  }

  .remote-provider-summary-actions {
    justify-content: flex-start;
  }

  .desktop-storage-row {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 640px) {
  :global(.data-manager-modal.n-card) {
    max-height: calc(100vh - 24px);
  }

  .data-manager-scroll-shell {
    max-height: calc(100vh - 132px);
  }

  .storage-cards-grid {
    grid-template-columns: 1fr;
  }

  .section-heading,
  .remote-action-row {
    align-items: stretch;
    flex-direction: column;
  }

  .local-transfer-panel {
    padding: 10px;
  }

  .local-scope-row,
  .local-strategy-row {
    align-items: stretch;
    flex-direction: column;
  }

  .local-scope-pill,
  .local-strategy-pill {
    width: 100%;
  }

  .remote-action-row > :deep(.n-button) {
    flex-basis: auto;
    width: 100%;
  }

  .remote-link-row > :deep(.n-button),
  .remote-action-row--compact > :deep(.n-button) {
    width: 100%;
  }
}
</style>
