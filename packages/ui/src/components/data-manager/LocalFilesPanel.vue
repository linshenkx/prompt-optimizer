<template>
  <section class="data-manager-section task-stack" data-testid="local-files-panel">
    <div class="task-intro">
      <NText tag="h3" strong class="section-title">{{ t('dataManager.tasks.localFile') }}</NText>
      <NText depth="3">{{ t('dataManager.overview.localHelp') }}</NText>
    </div>
    <div class="local-file-actions">
      <NButton
        ghost
        class="local-action-trigger"
        :disabled="isRemoteDataOperationActive || (!exportAppData && !exportFavorites)"
        :loading="isExporting"
        data-testid="local-backup-create"
        @click="handleExport"
      >
        <Download :size="22" aria-hidden="true" />
        <span class="local-action-copy">
          <strong>{{ t('dataManager.overview.exportFile') }}</strong>
          <NText depth="3" class="local-action-caption">{{ t('dataManager.overview.exportHint') }}</NText>
        </span>
      </NButton>
      <NUpload
        class="local-file-picker"
        :disabled="isRemoteConnectionLocked"
        :file-list="selectedFile ? [selectedFile] : []"
        accept=".zip,.po-backup.zip,.json,application/zip,application/json"
        :show-file-list="false"
        :default-upload="false"
        @change="handleFileChange"
      >
        <NUploadDragger>
          <NButton quaternary class="local-action-trigger" :disabled="isRemoteConnectionLocked">
            <Upload :size="22" aria-hidden="true" />
            <span class="local-action-copy">
              <strong>{{ t('dataManager.overview.restoreFile') }}</strong>
              <NText depth="3" class="local-action-caption">{{ t('dataManager.overview.dropFile') }}</NText>
            </span>
          </NButton>
        </NUploadDragger>
      </NUpload>
    </div>
    <div
      v-if="localBackupResult"
      :class="['task-result', localBackupResult.type]"
      role="status"
      data-testid="local-backup-result"
    >
      <NText :type="localBackupResult.type">{{ localBackupResult.message }}</NText>
    </div>
    <div v-if="selectedFile" class="selected-file-row">
      <NText class="selected-file-name"
        >{{ selectedFile.name }} · {{ formatFileSize(selectedFile.file?.size ?? 0) }}</NText
      >
      <NButton
        v-if="importPreviewState === 'success' && restoreSource !== 'local'"
        secondary
        size="small"
        :disabled="isRemoteDataOperationActive"
        @click="restoreSource = 'local'"
        >{{ t('dataManager.tasks.reviewRestore') }}</NButton
      >
      <NButton text :disabled="isRemoteConnectionLocked" @click="clearSelectedFile">{{
        t('common.clear')
      }}</NButton>
    </div>
    <NText v-if="importPreviewState === 'loading'" role="status">{{
      t('dataManager.tasks.readingBackup')
    }}</NText>
    <NText v-if="importPreviewState === 'error'" role="alert" type="error">{{
      importPreviewError
    }}</NText>
    <RestoreConfirmation v-if="restoreSource === 'local'" />
    <NText v-if="restoreSource === 'local' && restoreError" role="alert" type="error">{{
      restoreError
    }}</NText>
  </section>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { Download, Upload } from '@lucide/vue'
import { NText, NButton, NUpload, NUploadDragger } from 'naive-ui'
import { useDataManagerContext } from './context'
import RestoreConfirmation from './RestoreConfirmation.vue'
const {
  t,
  isRemoteDataOperationActive,
  isRemoteConnectionLocked,
  exportAppData,
  exportFavorites,
  isExporting,
  handleExport,
  selectedFile,
  handleFileChange,
  localBackupResult,
  formatFileSize,
  importPreviewState,
  importPreviewError,
  restoreSource,
  clearSelectedFile,
  restoreError,
} = toRefs(useDataManagerContext())
</script>
