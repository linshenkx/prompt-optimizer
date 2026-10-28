<template>
  <div class="task-stack" data-testid="remote-backup-list">
    <div
      v-if="filtered.length"
      class="backup-records"
      :aria-label="t('dataManager.tasks.cloudBackups')"
    >
      <NButton
        v-for="entry in pageEntries"
        :key="entry.id"
        :data-backup-id="entry.id"
        :disabled="disabled"
        :aria-pressed="selectedId === entry.id"
        :type="selectedId === entry.id ? 'primary' : 'default'"
        secondary
        class="backup-record"
        @click="$emit('select', entry.id)"
      >
        <span class="backup-record-copy">
          <strong>{{
            entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : entry.name
          }}</strong>
          <span v-if="entry.updatedAt">{{ entry.name }}</span>
          <span v-if="entry.manifest">{{ sectionLabels(entry) }}</span>
          <span v-if="entry.manifest?.assetCounts">{{
            t('dataManager.storage.imageCount', {
              count:
                (entry.manifest.assetCounts.imageCache ?? 0) +
                (entry.manifest.assetCounts.favoriteImages ?? 0),
            })
          }}</span>
          <span v-if="entry.manifest?.missingAssets?.length">{{
            t('dataManager.remote.restoreMissingAssetsHint', {
              count: entry.manifest.missingAssets.length,
            })
          }}</span>
        </span>
      </NButton>
    </div>
    <NText v-else-if="search" depth="3" role="status">{{ t('dataManager.tasks.noMatches') }}</NText>
    <NPagination
      v-if="filtered.length > pageSize"
      v-model:page="page"
      :page-size="pageSize"
      :item-count="filtered.length"
      :simple="true"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NText, NPagination } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { RemoteSnapshotEntry } from '../../utils/remote-snapshot-backup'
const props = defineProps<{
  entries: RemoteSnapshotEntry[]
  search: string
  selectedId: string | null
  disabled: boolean
}>()
defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
const page = ref(1)
const pageSize = 20
const filtered = computed(() => {
  const search = props.search.trim().toLocaleLowerCase()
  return props.entries
    .filter(
      (entry) =>
        !search ||
        `${entry.name} ${entry.updatedAt ?? ''} ${entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : ''}`
          .toLocaleLowerCase()
          .includes(search),
    )
    .slice()
    .sort((a, b) =>
      (b.manifest?.createdAt ?? b.updatedAt ?? b.id).localeCompare(
        a.manifest?.createdAt ?? a.updatedAt ?? a.id,
      ),
    )
})
const pageEntries = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize),
)
watch(
  () => props.search,
  () => {
    page.value = 1
  },
)
watch(
  () => props.selectedId,
  (id) => {
    const index = filtered.value.findIndex((entry) => entry.id === id)
    if (index >= 0) page.value = Math.floor(index / pageSize) + 1
  },
)
watch(
  () => filtered.value.length,
  (length) => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(length / pageSize)))
  },
)
const sectionLabels = (entry: RemoteSnapshotEntry) =>
  (entry.manifest?.includedSections ?? [])
    .map((section) =>
      t(
        `dataManager.sections.${({ appData: 'appData', imageCache: 'appDataImages', favorites: 'favoritesBundle', favoriteImages: 'favoriteImages' } as const)[section]}`,
      ),
    )
    .join(', ')
</script>

<style scoped>
.backup-records {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 340px;
  overflow-y: auto;
}
.backup-record {
  width: 100%;
  height: auto;
  min-height: 72px;
  padding: 12px;
  justify-content: flex-start;
  text-align: left;
}
.backup-record :deep(.n-button__content) {
  white-space: normal;
  width: 100%;
}
.backup-record-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
