<template>
  <section class="task-stack device-overview" data-testid="device-storage-overview">
    <div class="device-summary-row">
      <span class="device-summary-icon" aria-hidden="true"><HardDrive :size="22" /></span>
      <div class="device-summary-copy">
        <div class="device-summary-value">
          <NText tag="h3" strong>{{ t('dataManager.overview.device') }}</NText>
          <span
            class="device-storage-total"
            data-testid="device-storage-total"
            role="status"
            aria-live="polite"
            :aria-label="
              storageSummary && !allUnavailable
                ? t('dataManager.overview.usedSize', { size: formatFileSize(storageSummary.totalBytes) })
                : undefined
            "
          >{{ totalLabel }}</span>
        </div>
        <NText depth="3" class="storage-note">{{ t('dataManager.overview.sizeNote') }}</NText>
      </div>
      <NButton
        quaternary
        size="small"
        :loading="isRefreshingStorage"
        :disabled="isRefreshingStorage || isRemoteDataOperationActive"
        data-testid="storage-refresh"
        @click="refreshStorageSummary"
      >
        <template #icon><RefreshCw :size="15" aria-hidden="true" /></template>
        {{ t('dataManager.storage.refresh') }}
      </NButton>
    </div>
    <NText v-if="incomplete" type="warning" role="status">{{
      t('dataManager.overview.partialSize')
    }}</NText>
    <NCollapse>
      <NCollapseItem :title="t('dataManager.overview.details')" name="storage">
        <div class="storage-cards-grid">
          <div
            v-for="item in storageSummary?.items ?? storageCardItems"
            :key="item.key"
            class="storage-stat-card"
          >
            <NText depth="3">{{ t(storageLabelKeys[item.key]) }}</NText>
            <strong class="storage-stat-value">{{ formatStorageItemBytes(item.bytes) }}</strong>
            <NText v-if="getStorageItemDetail(item)" depth="3" class="storage-note">{{
              getStorageItemDetail(item)
            }}</NText>
          </div>
        </div>
        <div v-if="isDesktopRuntime" class="desktop-storage-row">
          <NText class="storage-path-value">{{
            storageSummary?.desktopInfo?.userDataPath || '—'
          }}</NText>
          <NButton secondary :disabled="!canUseDesktopStorageTools" @click="openStorageDir">{{
            t('dataManager.storage.openDir')
          }}</NButton>
        </div>
      </NCollapseItem>
      <NCollapseItem
        :title="t('dataManager.overview.backupScope', { scope: backupScopeSummary })"
        name="scope"
      >
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
      </NCollapseItem>
    </NCollapse>
  </section>
</template>
<script setup lang="ts">
import { computed, toRefs } from 'vue'
import { HardDrive, RefreshCw } from '@lucide/vue'
import { NText, NButton, NCollapse, NCollapseItem, NCheckbox } from 'naive-ui'
import { useDataManagerContext } from './context'
const {
  t,
  storageSummary,
  storageCardItems,
  storageLabelKeys,
  isRefreshingStorage,
  isRemoteDataOperationActive,
  refreshStorageSummary,
  formatFileSize,
  formatStorageItemBytes,
  getStorageItemDetail,
  isDesktopRuntime,
  canUseDesktopStorageTools,
  openStorageDir,
  backupScopeSummary,
  exportAppData,
  exportAppDataImages,
  exportFavorites,
  isRemoteConnectionLocked,
} = toRefs(useDataManagerContext())
const incomplete = computed(() => storageSummary.value?.items.some((item) => item.bytes === null))
const allUnavailable = computed(() =>
  storageSummary.value?.items.every((item) => item.bytes === null),
)
const totalLabel = computed(() => {
  if (!storageSummary.value)
    return t.value(
      isRefreshingStorage.value
        ? 'dataManager.overview.calculating'
        : 'dataManager.overview.unavailable',
    )
  if (allUnavailable.value) return t.value('dataManager.overview.unavailable')
  return formatFileSize.value(storageSummary.value.totalBytes)
})
</script>
