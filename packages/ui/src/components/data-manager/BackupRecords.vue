<template>
  <div class="task-stack" data-testid="remote-backup-list">
    <div
      v-if="filtered.length"
      class="backup-records"
      :aria-label="t('dataManager.tasks.cloudBackups')"
    >
      <article
        v-for="entry in pageEntries"
        :key="entry.id"
        :data-backup-id="entry.id"
        tabindex="-1"
        :class="{
          'backup-record--highlighted': selectedId === entry.id || highlightId === entry.id,
        }"
        class="backup-record"
      >
        <span class="backup-record-copy">
          <strong>{{
            entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : entry.name
          }}</strong>
          <NText v-if="entry.updatedAt" depth="3">{{ entry.name }}</NText>
          <NText v-if="entry.manifest" depth="3">{{ sectionLabels(entry) }}</NText>
          <NText v-if="entry.manifest?.assetCounts" depth="3">{{
            t('dataManager.storage.imageCount', {
              count:
                (entry.manifest.assetCounts.imageCache ?? 0) +
                (entry.manifest.assetCounts.favoriteImages ?? 0),
            })
          }}</NText>
          <NText v-if="entry.manifest?.missingAssets?.length" depth="3">{{
            t('dataManager.remote.restoreMissingAssetsHint', {
              count: entry.manifest.missingAssets.length,
            })
          }}</NText>
        </span>
        <div class="backup-record-actions">
          <NButton
            secondary
            :disabled="disabled"
            :aria-expanded="selectedId === entry.id"
            data-testid="record-restore"
            @click="$emit('select', entry.id)"
            >{{ t('dataManager.overview.restoreRecord') }}</NButton
          >
          <NButton
            v-if="canShare"
            text
            :disabled="disabled"
            data-testid="remote-import-code-export"
            @click="$emit('share', entry.id)"
            >{{ t('dataManager.overview.shareRecord') }}</NButton
          >
        </div>
      </article>
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
  highlightId?: string | null
  canShare?: boolean
}>()
defineEmits<{ select: [id: string]; share: [id: string] }>()
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
  () => [props.selectedId, props.highlightId],
  ([selectedId, highlightId]) => {
    const id = selectedId ?? highlightId
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
  gap: 0;
  max-height: 340px;
  overflow-y: auto;
}
.backup-record {
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid var(--n-border-color);
  border-inline-start: 3px solid transparent;
  box-sizing: border-box;
  width: 100%;
  height: auto;
  min-height: 72px;
  padding: 16px 12px;
  justify-content: flex-start;
  text-align: left;
}
.backup-record-copy {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.backup-record--highlighted {
  border-inline-start-color: var(--n-text-color);
  background: var(--n-color-embedded);
}
.backup-record:focus {
  outline: none;
}
.backup-record:focus-visible {
  outline: 2px solid var(--n-border-color);
  outline-offset: -2px;
}
.backup-record-copy > span {
  font-size: 13px;
  line-height: 1.5;
}
.backup-record-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
@media (max-width: 600px) {
  .backup-record {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
