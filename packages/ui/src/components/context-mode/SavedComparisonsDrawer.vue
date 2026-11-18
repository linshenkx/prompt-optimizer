<template>
  <NDrawer
    :show="show"
    width="min(1040px, 100vw)"
    placement="right"
    data-testid="saved-comparisons-drawer"
    @update:show="emit('update:show', $event)"
  >
    <NDrawerContent :title="t('contextMode.savedComparisons.title')" closable>
      <form class="saved-comparison-actions" @submit.prevent="openComparison(comparisonId)">
        <NInput
          v-model:value="comparisonId"
          size="small"
          :maxlength="128"
          :input-props="{ 'aria-label': t('contextMode.savedComparisons.id') }"
          :placeholder="t('contextMode.savedComparisons.id')"
          data-testid="saved-comparison-id"
        />
        <NButton size="small" attr-type="submit" :disabled="!comparisonId.trim()" data-testid="saved-comparison-open">
          {{ t('contextMode.savedComparisons.open') }}
        </NButton>
        <NButton size="small" :loading="listLoading" data-testid="saved-comparisons-refresh" @click="loadList()">
          {{ t('contextMode.savedComparisons.refresh') }}
        </NButton>
      </form>

      <div class="saved-comparison-browser">
        <section :aria-label="t('contextMode.savedComparisons.title')">
          <NAlert v-if="listError" type="error" :show-icon="false">{{ t('contextMode.savedComparisons.listError') }}</NAlert>
          <NEmpty v-else-if="!listLoading && !items.length" :description="t('contextMode.savedComparisons.empty')" />
          <ul v-if="items.length" class="saved-comparison-list">
            <li v-for="item in items" :key="item.id">
              <NButton
                size="small"
                block
                :secondary="detail?.comparison.id === item.id"
                :aria-pressed="detail?.comparison.id === item.id"
                class="saved-comparison-list-item"
                data-testid="saved-comparison-list-item"
                @click="openComparison(item.id)"
              >
                <span class="saved-comparison-list-title">{{ item.title }}</span>
                <NTime :time="item.savedAt" />
              </NButton>
            </li>
          </ul>
          <NButton v-if="nextCursor && !listError" size="small" :loading="listLoading" @click="loadList(true)">
            {{ t('contextMode.savedComparisons.loadMore') }}
          </NButton>
        </section>

        <div v-if="detailLoading" role="status">{{ t('common.loading') }}</div>
        <NAlert v-else-if="detailError" type="error" data-testid="saved-comparison-open-error">
          {{ t('contextMode.savedComparisons.detailError') }}
        </NAlert>
        <article v-else-if="detail" class="saved-comparison-detail" data-testid="saved-comparison-detail">
          <header class="saved-comparison-heading">
            <div>
              <h3>{{ detail.comparison.source.title }}</h3>
              <NText depth="3"><code>{{ detail.comparison.id }}</code></NText>
              <NText depth="3" class="saved-comparison-meta">
                {{ t('contextMode.savedComparisons.version') }}
                <code>{{ detail.comparison.source.versionId }}</code>
                · <NTime :time="detail.comparison.savedAt" />
              </NText>
            </div>
            <NButton
              size="small"
              type="error"
              secondary
              :loading="deleting"
              data-testid="saved-comparison-delete"
              @click="deleteComparison"
            >
              {{ t('common.delete') }}
            </NButton>
          </header>
          <NAlert v-if="deleteError" type="error">{{ t('contextMode.savedComparisons.deleteError') }}</NAlert>

          <details class="saved-comparison-evidence" open>
            <summary>{{ t('contextMode.savedComparisons.input') }}</summary>
            <pre data-testid="saved-comparison-input">{{ detail.comparison.request.messages[0].content }}</pre>
            <template v-if="detail.comparison.request.rawPrompt !== detail.comparison.request.messages[0].content">
              <NText depth="3">{{ t('promptOptimizer.originalPrompt') }}</NText>
              <pre>{{ detail.comparison.request.rawPrompt }}</pre>
            </template>
            <template v-if="Object.keys(detail.comparison.request.variables).length">
              <NText depth="3">{{ t('contextMode.savedComparisons.variables') }}</NText>
              <pre>{{ formatObject(detail.comparison.request.variables) }}</pre>
            </template>
          </details>

          <div class="saved-comparison-runs">
            <NCard v-for="run in detail.comparison.runs" :key="run.runId" size="small" :data-testid="`saved-comparison-run-${run.id}`">
              <template #header>
                <span class="saved-comparison-model">{{ run.id.toUpperCase() }} · {{ run.model.name }}</span>
              </template>
              <template #header-extra>
                <NTag size="small" :type="statusTone[run.status]">
                  {{ t(`contextMode.savedComparisons.status.${run.status}`) }}
                </NTag>
              </template>
              <NText depth="3">{{ run.model.providerId }} / {{ run.model.modelId }}</NText>
              <details class="saved-comparison-evidence">
                <summary>{{ t('contextMode.savedComparisons.parameters') }}</summary>
                <NText depth="3">{{ t('contextMode.savedComparisons.declaredParameters') }}</NText>
                <pre>{{ formatObject(run.effective.parameters) }}</pre>
                <template v-if="run.effective.request">
                  <NText depth="3">{{ t('contextMode.savedComparisons.requestParameters') }} · {{ run.effective.request.api }}</NText>
                  <pre>{{ formatObject(run.effective.request.parameters) }}</pre>
                </template>
                <NText v-else depth="3">{{ t('contextMode.savedComparisons.requestUnavailable') }}</NText>
                <p v-if="hasOmittedParameters(run)">{{ t('contextMode.savedComparisons.omittedParameters') }}</p>
              </details>
              <p v-if="run.errorCode"><NText type="error">{{ run.errorCode }}</NText></p>
              <div v-if="run.output || run.reasoning" class="saved-comparison-output">
                <OutputDisplay
                  :key="run.runId"
                  mode="readonly"
                  :content="run.output"
                  :reasoning="run.reasoning"
                  :enable-diff="false"
                  :enable-edit="false"
                  :enable-favorite="false"
                  :enable-fullscreen="false"
                />
              </div>
              <NText v-else depth="3">{{ t('contextMode.savedComparisons.noOutput') }}</NText>
            </NCard>
          </div>
        </article>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { NAlert, NButton, NCard, NDrawer, NDrawerContent, NEmpty, NInput, NTag, NText, NTime } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type {
  ComparisonTerminalStatus,
  ComparisonViewer,
  SavedComparisonResult,
  SavedComparisonSummary,
  TextComparisonRun,
} from '@prompt-optimizer/core'
import { useConfirmDialog } from '../../composables/ui/useConfirmDialog'
import OutputDisplay from '../OutputDisplay.vue'

const props = defineProps<{ show: boolean; viewer: ComparisonViewer }>()
const emit = defineEmits<{ 'update:show': [show: boolean] }>()
const { t } = useI18n()
const confirmDialog = useConfirmDialog()

const comparisonId = ref('')
const items = shallowRef<SavedComparisonSummary[]>([])
const nextCursor = ref<string>()
const detail = shallowRef<SavedComparisonResult>()
const listLoading = ref(false)
const detailLoading = ref(false)
const deleting = ref(false)
const listError = ref(false)
const detailError = ref(false)
const deleteError = ref(false)
let viewGeneration = 0
let listGeneration = 0
let detailGeneration = 0

const statusTone = {
  success: 'success',
  error: 'error',
  cancelled: 'warning',
} as const satisfies Record<ComparisonTerminalStatus, string>

const formatObject = (value: Record<string, unknown>) => JSON.stringify(value, null, 2)
const hasOmittedParameters = ({ effective }: TextComparisonRun) =>
  effective.omittedParameterNames.length > 0 || !!effective.request?.omittedParameterNames.length

async function loadList(append = false) {
  const cursor = append ? nextCursor.value : undefined
  if (append && (!cursor || listLoading.value)) return
  const view = viewGeneration
  const generation = ++listGeneration
  const isCurrent = () => props.show && view === viewGeneration && generation === listGeneration
  listLoading.value = true
  listError.value = false
  try {
    const page = await props.viewer.list(cursor ? { cursor } : undefined)
    if (!isCurrent()) return
    const seen = new Set(append ? items.value.map(item => item.id) : [])
    items.value = [...(append ? items.value : []), ...page.items.filter(item => !seen.has(item.id))]
    nextCursor.value = page.nextCursor
  } catch {
    if (isCurrent()) listError.value = true
  } finally {
    if (isCurrent()) listLoading.value = false
  }
}

async function openComparison(value: string) {
  const id = value.trim()
  if (!id || !props.show) return
  comparisonId.value = id
  const view = viewGeneration
  const generation = ++detailGeneration
  const isCurrent = () => props.show && view === viewGeneration && generation === detailGeneration
  detail.value = undefined
  detailLoading.value = true
  detailError.value = false
  deleteError.value = false
  try {
    const result = await props.viewer.get(id)
    if (isCurrent()) detail.value = result
  } catch {
    if (isCurrent()) detailError.value = true
  } finally {
    if (isCurrent()) detailLoading.value = false
  }
}

async function deleteComparison() {
  const target = detail.value
  if (!target || deleting.value) return
  const view = viewGeneration
  const isCurrent = () => props.show && view === viewGeneration
  deleting.value = true
  deleteError.value = false
  try {
    const confirmed = await confirmDialog.warning({
      title: t('contextMode.savedComparisons.deleteTitle'),
      content: t('contextMode.savedComparisons.deleteConfirm', { title: target.comparison.source.title }),
      positiveText: t('common.delete'),
      negativeText: t('common.cancel'),
    })
    if (!confirmed || !isCurrent() || detail.value !== target) return
    const result = await props.viewer.delete(target.comparison.id, target.revision)
    if (!isCurrent()) return
    if (!result.deleted && !result.alreadyDeleted) throw new Error('Saved comparison was not deleted')
    if (detail.value === target) detail.value = undefined
    await loadList()
  } catch {
    if (isCurrent() && detail.value === target) deleteError.value = true
  } finally {
    if (isCurrent()) deleting.value = false
  }
}

watch([() => props.show, () => props.viewer], ([show]) => {
  viewGeneration++
  comparisonId.value = ''
  items.value = []
  nextCursor.value = undefined
  detail.value = undefined
  listLoading.value = detailLoading.value = deleting.value = false
  listError.value = detailError.value = deleteError.value = false
  if (show) void loadList()
}, { immediate: true, flush: 'sync' })

onBeforeUnmount(() => { viewGeneration++ })
</script>

<style scoped>
.saved-comparison-actions {
  display: flex;
  gap: 8px;
  margin-block-end: 16px;
}
.saved-comparison-actions > :first-child {
  min-width: 0;
  flex: 1;
}
.saved-comparison-browser {
  display: grid;
  grid-template-columns: minmax(0, 13rem) minmax(0, 1fr);
  gap: 16px;
}
.saved-comparison-list {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
  display: grid;
  gap: 6px;
}
.saved-comparison-list-item {
  height: auto;
  padding-block: 6px;
  justify-content: flex-start;
  text-align: start;
}
.saved-comparison-list-item :deep(.n-button__content) {
  width: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  white-space: normal;
}
.saved-comparison-list-title {
  white-space: normal;
  overflow-wrap: anywhere;
  font-weight: 500;
}
.saved-comparison-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  overflow-wrap: anywhere;
}
.saved-comparison-meta {
  display: block;
}
.saved-comparison-heading h3 {
  margin: 0;
}
.saved-comparison-detail, .saved-comparison-evidence {
  min-width: 0;
}
.saved-comparison-evidence {
  margin-block: 12px;
}
.saved-comparison-evidence summary {
  cursor: pointer;
  font-weight: 500;
}
.saved-comparison-evidence pre {
  max-height: min(22rem, 48vh);
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 8px 0 12px;
  padding: 8px;
  border-radius: 4px;
  background: color-mix(in srgb, currentColor 5%, transparent);
}
.saved-comparison-runs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: 12px;
}
.saved-comparison-runs > * {
  min-width: 0;
  overflow-wrap: anywhere;
}
.saved-comparison-model {
  white-space: normal;
  overflow-wrap: anywhere;
}
.saved-comparison-output {
  height: clamp(12rem, 34vh, 24rem);
}
@media (max-width: 760px) {
  .saved-comparison-browser {
    display: flex;
    flex-direction: column;
  }
  .saved-comparison-list {
    max-height: 11rem;
    overflow: auto;
  }
}
</style>
