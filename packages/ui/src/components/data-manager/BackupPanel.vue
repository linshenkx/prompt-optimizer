<template>
  <section class="task-stack" data-testid="data-backup-panel">
    <div class="task-intro">
      <NText tag="h3" strong>{{ t('dataManager.tasks.backupTitle') }}</NText
      ><NText depth="3">{{ t('dataManager.tasks.backupHelp') }}</NText>
    </div>
    <div class="remote-field">
      <NText>{{ t('dataManager.tasks.destination') }}</NText>
      <NSelect
        :value="backupDestination"
        :options="backupDestinationOptions"
        :disabled="isRemoteConnectionLocked"
        :aria-label="t('dataManager.tasks.destination')"
        data-testid="backup-destination"
        @update:value="changeBackupDestination"
      />
    </div>
    <ConnectionSummary
      status-test-id="backup-connection-status"
      v-if="backupDestination !== 'local'"
    />
    <div class="task-card task-stack">
      <NText strong>{{ t('dataManager.tasks.backupContents') }}</NText
      ><NText>{{ backupScopeSummary }}</NText>
      <NCollapse
        ><NCollapseItem :title="t('dataManager.tasks.adjustContents')" name="scope">
          <div class="local-scope-row">
            <NCheckbox v-model:checked="exportAppData" :disabled="isRemoteConnectionLocked">{{
              t('dataManager.sections.appData')
            }}</NCheckbox>
            <NCheckbox
              v-model:checked="exportAppDataImages"
              :disabled="!exportAppData || isRemoteConnectionLocked"
              >{{ t('dataManager.sections.appDataImages') }}</NCheckbox
            >
            <NCheckbox v-model:checked="exportFavorites" :disabled="isRemoteConnectionLocked">{{
              t('dataManager.sections.favoritesBundle')
            }}</NCheckbox>
          </div>
        </NCollapseItem></NCollapse
      >
    </div>
    <NButton
      v-if="backupDestination === 'local'"
      type="primary"
      :disabled="isRemoteDataOperationActive || (!exportAppData && !exportFavorites)"
      :loading="isExporting"
      data-testid="local-backup-create"
      @click="handleExport"
      >{{ t('dataManager.tasks.downloadBackup') }}</NButton
    >
    <NButton
      v-else
      type="primary"
      :disabled="
        !isCurrentRemoteProviderConfigured ||
        isRemoteDataOperationActive ||
        (!exportAppData && !exportFavorites)
      "
      :loading="isUploadingRemote"
      data-testid="remote-backup-create"
      @click="handleRemoteUpload"
      >{{ t('dataManager.tasks.backupTo', { provider: currentProviderName }) }}</NButton
    >
    <div v-if="backupResult" class="task-card task-stack" role="status" data-testid="backup-result">
      <NText :type="backupResult.type">{{ backupResult.message }}</NText>
      <NButton
        v-if="backupResult.snapshotId"
        data-testid="backup-result-view"
        secondary
        :disabled="isRemoteDataOperationActive"
        @click="viewCreatedBackup"
        >{{ t('dataManager.tasks.viewBackup') }}</NButton
      >
    </div>
  </section>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useDataManagerContext } from './context'
import { NText, NButton, NCheckbox, NSelect, NCollapse, NCollapseItem } from 'naive-ui'
import ConnectionSummary from './ConnectionSummary.vue'
const {
  t,
  backupDestination,
  backupResult,
  isExporting,
  exportAppData,
  exportAppDataImages,
  exportFavorites,
  isUploadingRemote,
  isRemoteDataOperationActive,
  isRemoteConnectionLocked,
  isCurrentRemoteProviderConfigured,
  handleRemoteUpload,
  currentProviderName,
  backupDestinationOptions,
  backupScopeSummary,
  changeBackupDestination,
  viewCreatedBackup,
  handleExport,
} = toRefs(useDataManagerContext())
</script>
