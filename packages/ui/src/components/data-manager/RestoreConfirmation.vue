<template>
  <div
    v-if="restoreSource === 'local' ? importPreviewState === 'success' : !!selectedRemoteBackup"
    class="task-card task-stack"
    data-testid="restore-confirmation"
    tabindex="-1"
  >
    <NText tag="h3" strong>{{ t('dataManager.tasks.reviewRestore') }}</NText>
    <NText>{{ restoreSource === 'local' ? selectedFile?.name : selectedRemoteBackup?.name }}</NText>
    <NText v-if="restoreSource === 'local'">{{ importPreviewText }}</NText>
    <NText v-else>{{
      selectedRemoteBackup?.updatedAt
        ? new Date(selectedRemoteBackup.updatedAt).toLocaleString()
        : ''
    }}</NText>
    <NText
      v-if="restoreSource !== 'local' && selectedRemoteBackupMissingAssetsCount"
      type="warning"
      >{{
        t('dataManager.remote.restoreMissingAssetsHint', {
          count: selectedRemoteBackupMissingAssetsCount,
        })
      }}</NText
    >
    <div class="local-scope-row">
      <NCheckbox
        v-for="option in restoreSectionOptions"
        :key="option.key"
        :checked="option.checked"
        :disabled="option.disabled || isRemoteDataOperationActive"
        @update:checked="(value) => updateRestoreSection(option.key, value)"
        >{{ option.label }}</NCheckbox
      >
    </div>
    <div
      v-if="restoreSource === 'local' ? importFavorites : remoteRestoreFavorites"
      class="task-stack"
    >
      <NText>{{ t('dataManager.import.favoriteMergeStrategy') }}</NText>
      <NRadioGroup v-model:value="favoriteMergeStrategy" :disabled="isRemoteDataOperationActive"
        ><div class="local-strategy-row">
          <NRadio value="skip">{{ t('dataManager.import.skipDuplicate') }}</NRadio
          ><NRadio value="overwrite">{{ t('dataManager.import.overwriteDuplicate') }}</NRadio>
        </div></NRadioGroup
      >
      <NText depth="3">{{ t('dataManager.import.favoriteIdentityHint') }}</NText>
    </div>
    <NText>{{ t('dataManager.warning') }}</NText>
    <NButton
      type="primary"
      :loading="isImporting || isRestoringRemote"
      :disabled="isRemoteDataOperationActive || !canRestoreSelection"
      data-testid="backup-restore-confirm"
      @click="confirmSelectedRestore"
      >{{ t('dataManager.tasks.confirmRestore') }}</NButton
    >
    <NButton
      v-if="restoreSource !== 'local' && remoteSettings.provider.kind !== 'google-drive'"
      secondary
      :disabled="isRemoteDataOperationActive"
      data-testid="remote-import-code-export"
      @click="handleRemoteCodeExport"
      >{{ t('dataManager.remote.importCode.exportAction') }}</NButton
    >
  </div>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useDataManagerContext } from './context'
import { NText, NButton, NCheckbox, NRadio, NRadioGroup } from 'naive-ui'
const {
  t,
  restoreSource,
  importPreviewState,
  isImporting,
  selectedFile,
  importPreviewText,
  importFavorites,
  remoteRestoreFavorites,
  favoriteMergeStrategy,
  remoteSettings,
  isRestoringRemote,
  isRemoteDataOperationActive,
  selectedRemoteBackup,
  selectedRemoteBackupMissingAssetsCount,
  handleRemoteCodeExport,
  restoreSectionOptions,
  updateRestoreSection,
  canRestoreSelection,
  confirmSelectedRestore,
} = toRefs(useDataManagerContext())
</script>
