<template>
  <section class="task-stack" data-testid="data-restore-panel">
    <div class="task-intro">
      <NText tag="h3" strong>{{ t('dataManager.tasks.restoreTitle') }}</NText
      ><NText depth="3">{{ t('dataManager.tasks.restoreHelp') }}</NText>
    </div>
    <NRadioGroup
      v-model:value="restoreSource"
      :disabled="isRemoteConnectionLocked"
      :aria-label="t('dataManager.tasks.restoreSource')"
      data-testid="restore-source"
      ><div class="local-strategy-row">
        <NRadioButton data-testid="restore-source-local" value="local">{{
          t('dataManager.tasks.localFile')
        }}</NRadioButton
        ><NRadioButton data-testid="restore-source-cloud" value="cloud">{{
          t('dataManager.tasks.cloudBackups')
        }}</NRadioButton
        ><NRadioButton data-testid="restore-source-code" value="code">{{
          t('dataManager.tasks.importCode')
        }}</NRadioButton>
      </div></NRadioGroup
    >
    <div v-show="restoreSource === 'local'" class="task-stack">
      <NUpload
        class="local-file-picker"
        :disabled="isRemoteConnectionLocked"
        :file-list="selectedFile ? [selectedFile] : []"
        accept=".zip,.po-backup.zip,.json,application/zip,application/json"
        :show-file-list="false"
        @change="handleFileChange"
        :default-upload="false"
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
                <template v-if="importPreviewText"> · {{ importPreviewText }} </template>
              </NText>
            </div>
            <NButton
              size="small"
              text
              :disabled="isRemoteConnectionLocked"
              @click.stop="clearSelectedFile"
            >
              {{ $t('common.clear') }}
            </NButton>
          </div>
        </NUploadDragger>
      </NUpload>

      <NText v-if="importPreviewState === 'loading'" role="status">{{
        t('dataManager.tasks.readingBackup')
      }}</NText>
      <NText v-if="importPreviewState === 'error'" type="error" role="alert">{{
        importPreviewError
      }}</NText>
    </div>
    <div v-show="restoreSource === 'cloud'" class="task-stack">
      <NSelect
        :value="remoteSettings.provider.kind"
        :options="remoteProviderOptions"
        :disabled="isRemoteConnectionLocked"
        :aria-label="t('dataManager.remote.provider')"
        data-testid="restore-provider"
        @update:value="handleRemoteProviderChange"
      />
      <ConnectionSummary status-test-id="remote-list-status" />
      <div class="remote-action-row">
        <NInput
          v-model:value="backupSearch"
          clearable
          :placeholder="t('dataManager.tasks.searchBackups')"
          :aria-label="t('dataManager.tasks.searchBackups')"
        />
        <NButton
          secondary
          :loading="isLoadingRemoteList"
          :disabled="!isCurrentRemoteProviderConfigured || isRemoteDataOperationActive"
          data-testid="remote-backup-refresh"
          @click="handleRemoteRefresh"
          >{{ t('dataManager.remote.refreshList') }}</NButton
        >
      </div>
      <BackupRecords
        :entries="remoteBackups"
        :search="backupSearch"
        :selected-id="selectedRemoteBackupId"
        :disabled="isRemoteDataOperationActive"
        @select="selectRestoreBackup"
      />
      <NButton
        v-if="remoteListState === 'success' && !remoteBackups.length"
        secondary
        @click="activeTab = 'backup'"
        >{{ t('dataManager.tasks.goBackup') }}</NButton
      >
    </div>
    <div v-show="restoreSource === 'code'" class="task-stack">
      <NInput
        v-model:value="remoteImportCode"
        type="textarea"
        :autosize="{ minRows: 3, maxRows: 6 }"
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
    <RestoreConfirmation />
    <NText v-if="restoreError" role="alert" type="error">{{ restoreError }}</NText>
  </section>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useDataManagerContext } from './context'
import {
  NText,
  NButton,
  NUpload,
  NUploadDragger,
  NIcon,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NInput,
} from 'naive-ui'
import { Upload } from '@lucide/vue'
import ConnectionSummary from './ConnectionSummary.vue'
import RestoreConfirmation from './RestoreConfirmation.vue'
import BackupRecords from './BackupRecords.vue'
const {
  t,
  activeTab,
  restoreSource,
  backupSearch,
  restoreError,
  codeError,
  importPreviewState,
  importPreviewError,
  selectedFile,
  importPreviewText,
  remoteSettings,
  isLoadingRemoteList,
  isImportingRemoteCode,
  remoteImportCode,
  isRemoteDataOperationActive,
  isRemoteConnectionLocked,
  remoteBackups,
  remoteListState,
  selectedRemoteBackupId,
  remoteProviderOptions,
  isCurrentRemoteProviderConfigured,
  handleRemoteProviderChange,
  handleRemoteRefresh,
  handleRemoteCodeImport,
  handleFileChange,
  selectRestoreBackup,
  clearSelectedFile,
  formatFileSize,
} = toRefs(useDataManagerContext())
</script>
