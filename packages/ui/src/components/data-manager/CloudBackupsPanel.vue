<template>
  <section class="data-manager-section task-stack" data-testid="cloud-backups-panel">
    <div class="section-heading with-description">
      <div class="task-intro">
        <NText tag="h3" strong class="section-title">{{
          t('dataManager.tasks.cloudBackups')
        }}</NText
        ><NText depth="3">{{ t('dataManager.overview.cloudHelp') }}</NText>
      </div>
      <NButton
        text
        :disabled="isRemoteConnectionLocked"
        :aria-expanded="showCodeImport"
        data-testid="open-import-code"
        @click="showCodeImport = !showCodeImport"
        >{{ t('dataManager.overview.useCode') }}</NButton
      >
    </div>
    <div
      class="cloud-provider-options"
      role="group"
      :aria-label="t('dataManager.remote.provider')"
      data-testid="cloud-provider-options"
    >
      <NButton
        v-for="option in remoteProviderOptions"
        :key="option.value"
        class="cloud-provider-option"
        :type="remoteSettings.provider.kind === option.value ? 'primary' : 'default'"
        :aria-pressed="remoteSettings.provider.kind === option.value"
        :data-testid="`cloud-provider-${option.value}`"
        :disabled="isRemoteConnectionLocked"
        @click="
          remoteSettings.provider.kind !== option.value && handleRemoteProviderChange(option.value)
        "
      >
        <Check :size="15" aria-hidden="true" :style="{ visibility: remoteSettings.provider.kind === option.value ? 'visible' : 'hidden' }" />
        <span>{{ option.label }}</span>
      </NButton>
    </div>
    <ConnectionSummary status-test-id="remote-list-status" />
    <div v-show="showConnectionSettings" class="connection-editor task-stack">
      <StorageSettingsPanel />
    </div>
    <div v-if="isCurrentRemoteProviderConfigured" class="remote-action-row">
      <NButton
        type="primary"
        :disabled="
          isRemoteDataOperationActive ||
          (!exportAppData && !exportFavorites)
        "
        :loading="isUploadingRemote"
        data-testid="remote-backup-create"
        @click="handleRemoteUpload"
      >
        <template #icon><CloudUpload :size="18" aria-hidden="true" /></template>
        {{ t('dataManager.overview.createCloud') }}
      </NButton>
      <NButton
        quaternary
        :disabled="isRemoteDataOperationActive"
        :loading="isLoadingRemoteList"
        data-testid="remote-backup-refresh"
        @click="handleRemoteRefresh"
      >
        <template #icon><RefreshCw :size="16" aria-hidden="true" /></template>
        {{ t('dataManager.remote.refreshList') }}
      </NButton>
    </div>
    <div v-if="backupResult" class="task-result" role="status" data-testid="backup-result">
      <NText :type="backupResult.type">{{ backupResult.message }}</NText>
      <NButton
        v-if="backupResult.snapshotId"
        text
        data-testid="backup-result-view"
        @click="viewCreatedBackup"
        >{{ t('dataManager.tasks.viewBackup') }}</NButton
      >
    </div>
    <div v-show="showCodeImport" class="task-card task-stack" data-testid="code-import-panel">
      <NText strong>{{ t('dataManager.tasks.importCode') }}</NText>
      <NInput
        v-model:value="remoteImportCode"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 5 }"
        :placeholder="t('dataManager.remote.importCode.placeholder')"
        :aria-label="t('dataManager.tasks.importCode')"
        :disabled="isRemoteConnectionLocked"
        data-testid="remote-import-code-input"
      />
      <NText depth="3">{{ t('dataManager.tasks.codeHelp') }}</NText>
      <NButton
        secondary
        :loading="isImportingRemoteCode"
        :disabled="!remoteImportCode.trim() || isRemoteDataOperationActive"
        data-testid="remote-import-code-submit"
        @click="handleRemoteCodeImport"
        >{{ t('dataManager.tasks.readBackup') }}</NButton
      >
      <NText v-if="codeError" role="alert" type="error">{{ codeError }}</NText>
    </div>
    <div v-if="remoteBackups.length" class="section-heading backup-list-heading">
      <NText strong>{{ t('dataManager.overview.records', { count: remoteBackups.length }) }}</NText>
      <NInput
        v-if="remoteBackups.length > 5"
        v-model:value="backupSearch"
        clearable
        :placeholder="t('dataManager.tasks.searchBackups')"
        :aria-label="t('dataManager.tasks.searchBackups')"
      />
    </div>
    <BackupRecords
      :entries="remoteBackups"
      :search="backupSearch"
      :selected-id="restoreSource === 'cloud' ? cloudBackupId : null"
      :highlight-id="backupResult?.snapshotId"
      :disabled="isRemoteDataOperationActive"
      :can-share="remoteSettings.provider.kind !== 'google-drive'"
      @select="selectRestoreBackup"
      @share="handleRemoteCodeExport"
    />
    <RestoreConfirmation v-if="restoreSource === 'cloud' || restoreSource === 'code'" />
    <NText v-if="restoreSource !== 'local' && restoreError" role="alert" type="error">{{
      restoreError
    }}</NText>
  </section>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { Check, CloudUpload, RefreshCw } from '@lucide/vue'
import { NText, NButton, NInput } from 'naive-ui'
import { useDataManagerContext } from './context'
import ConnectionSummary from './ConnectionSummary.vue'
import StorageSettingsPanel from './StorageSettingsPanel.vue'
import BackupRecords from './BackupRecords.vue'
import RestoreConfirmation from './RestoreConfirmation.vue'
const {
  t,
  showConnectionSettings,
  showCodeImport,
  isRemoteConnectionLocked,
  isRemoteDataOperationActive,
  isCurrentRemoteProviderConfigured,
  exportAppData,
  exportFavorites,
  isUploadingRemote,
  isLoadingRemoteList,
  handleRemoteUpload,
  handleRemoteRefresh,
  backupResult,
  viewCreatedBackup,
  remoteImportCode,
  isImportingRemoteCode,
  handleRemoteCodeImport,
  codeError,
  remoteBackups,
  backupSearch,
  restoreSource,
  cloudBackupId,
  remoteSettings,
  remoteProviderOptions,
  handleRemoteProviderChange,
  selectRestoreBackup,
  handleRemoteCodeExport,
  restoreError,
} = toRefs(useDataManagerContext())
</script>
