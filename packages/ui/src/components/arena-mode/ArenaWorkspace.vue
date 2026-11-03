<template>
  <div class="arena-workspace" data-testid="arena-workspace">
    <NAlert v-if="session.saveError" type="error">{{ t('arena.saveFailed') + ': ' + translateError(session.saveError) }}</NAlert>

    <NCard size="small" class="arena-input" content-style="padding: 12px;">
      <TestInputSection v-model="session.state.prompt" :label="t('arena.prompt')" :show-header="false" :placeholder="t('arena.promptPlaceholder')" :min-rows="2" :max-rows="4" test-id="arena-prompt">
        <template #footer="{ openFullscreen }">
          <TestWorkspaceToolbar class="arena-toolbar" embedded :running="session.running" :run-disabled="!canRunAll" run-test-id="arena-run-all" @run="perform(session.runAll)">
            <template #leading>
              <PromptGardenInspirationPopover mode="arena" :label="t('arena.benchmarks')" :has-prompt="!!session.state.prompt.trim()" :disabled="session.running || uploading" test-id="arena-garden" @apply="importGarden" @open-import="showGardenImport = true" />
              <NButton size="small" data-testid="arena-add" @click="addColumn"><template #icon><Plus :size="16" /></template>{{ t('arena.addColumn') }}</NButton>
            </template>
            <template #actions>
              <NButton size="small" :loading="uploading" @click="fileInput?.click()"><template #icon><ImagePlus :size="16" /></template>{{ t('arena.addImages') }}</NButton>
              <NButton size="small" type="tertiary" ghost round :title="t('common.expand')" :aria-label="t('common.expand')" @click="openFullscreen"><template #icon><Maximize2 :size="16" /></template></NButton>
            </template>
          </TestWorkspaceToolbar>
        </template>
      </TestInputSection>
      <input ref="fileInput" class="file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple data-testid="arena-image-input" @change="upload" />
      <AppPreviewImageGroup v-if="session.state.images.length"><div class="input-images">
        <div v-for="(image, i) in session.state.images" :key="image.id + '-' + i" class="input-image">
          <ArenaImage :asset-id="image.id" :label="t('arena.inputImage') + ' ' + (i + 1)" :width="56" />
          <div class="image-actions">
            <NButton size="tiny" quaternary circle :disabled="i === 0" :aria-label="t('workspace.moveImageEarlier', { index: i + 1 })" :title="t('workspace.moveImageEarlier', { index: i + 1 })" @click="moveImage(i)"><template #icon><ArrowLeft :size="14" /></template></NButton>
            <NButton size="tiny" quaternary circle :aria-label="t('test.image.remove')" :title="t('test.image.remove')" @click="session.state.images.splice(i, 1)"><template #icon><X :size="14" /></template></NButton>
          </div>
        </div>
      </div></AppPreviewImageGroup>
    </NCard>

    <section class="arena-comparison" :aria-label="t('arena.columns')">
      <NScrollbar ref="columnsScrollbar" class="arena-scrollbar" container-class="arena-scroll-container" x-scrollable trigger="none" :theme-overrides="{ height: '8px' }" :container-style="{ overflowY: 'hidden' }" :content-style="{ width: '100%', height: '100%', minWidth: `calc(${session.state.contestants.length} * var(--arena-column-min-width) + ${(session.state.contestants.length - 1) * 12}px)`, paddingBottom: '14px', boxSizing: 'border-box' }">
      <div ref="deck" class="arena-deck" :class="{ 'arena-deck--compact': compactColumns }" :style="{ gridTemplateColumns: `repeat(${session.state.contestants.length}, minmax(0, 1fr))` }" data-testid="arena-deck" :aria-label="t('arena.columns')" tabindex="0">
        <article v-for="c in session.state.contestants" :key="c.id" class="arena-column" :data-column-id="c.id" :data-testid="'arena-column-' + c.id">
          <NCard size="small" class="arena-model-controls" content-style="padding: var(--arena-control-padding);">
            <div class="model-controls">
              <TextModelSelector :model-value="models.selection(c)" :options="models.textOptions.value" :additional-groups="models.imageGroups(imageCatalog)" :disabled="session.busy(c.id)" :placeholder="t('model.select.placeholder')" :aria-label="t('model.select.placeholder')" show-model-types size="small" @update:model-value="models.select(c, $event)" @update:show="show => { if (show) void loadImages() }" @config="id => configure(c, id)" />
              <NButton class="column-run" size="small" secondary :disabled="!canRun(c)" :loading="session.busy(c.id)" :aria-label="t('test.layout.runThisColumn')" :title="t('test.layout.runThisColumn')" :data-testid="'arena-run-' + c.id" @click="perform(() => session.run(c.id))"><template v-if="!compactColumns" #icon><Play :size="13" /></template>{{ t('test.title') }}</NButton>
              <NButton class="column-delete" size="small" quaternary circle :disabled="session.state.contestants.length <= 1 || session.busy(c.id)" :aria-label="t('arena.deleteColumn')" :title="t('arena.deleteColumn')" :data-testid="'arena-delete-' + c.id" @click="removeColumn(c.id)"><template #icon><Trash2 :size="16" /></template></NButton>
            </div>
            <NText v-if="c.modelId && !models.compatible(c)" class="model-warning" type="warning">{{ t('arena.incompatible') }}</NText>
          </NCard>
          <div class="arena-result-slot">
            <NCard size="small" class="arena-result-card" content-style="padding: 0; height: 100%; max-height: 100%; overflow: hidden; display: flex; flex-direction: column;">
              <p v-if="session.state.results[c.id]?.error" role="alert" class="compact-test-error">{{ translateError(session.state.results[c.id].error!) }}</p>
              <AppPreviewImageGroup v-if="session.state.results[c.id]?.images.length"><div class="result-images"><ArenaImage v-for="(image, i) in session.state.results[c.id].images" :key="image.id + '-' + i" :asset-id="image.id" :label="c.modelId + ' ' + (i + 1)" :width="280" /></div></AppPreviewImageGroup>
              <OutputDisplay v-if="!session.state.results[c.id]?.images.length || session.state.results[c.id]?.output.result || session.state.results[c.id]?.output.reasoning" :content="session.state.results[c.id]?.output.result || ''" :reasoning="session.state.results[c.id]?.output.reasoning" :output-record="session.state.results[c.id]?.output" :loading="session.busy(c.id)" :enable-stop="session.cancellable(c.id)" mode="readonly" reasoning-mode="hide" :enable-edit="false" :enable-favorite="false" :enable-diff="false" :streaming="session.state.results[c.id]?.status === 'running' && c.kind === 'text'" height="100%" />
            </NCard>
          </div>
        </article>
      </div>
      </NScrollbar>
    </section>

    <PromptGardenImportDialog v-model:show="showGardenImport" @confirm="importGarden" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { routerKey } from 'vue-router'
import { ArrowLeft, ImagePlus, Maximize2, Play, Plus, Trash2, X } from '@lucide/vue'
import { NAlert, NButton, NCard, NScrollbar, NText, type ScrollbarInst } from 'naive-ui'
import { type ArenaContestant, type ImageModel } from '@prompt-optimizer/core'
import { useArenaSession } from '../../stores/session/useArenaSession'
import { useImageInputPreparation } from '../../composables/image/useImageInputPreparation'
import { useArenaModels } from './useArenaModels'
import ArenaImage from './ArenaImage.vue'
import TextModelSelector from '../TextModelSelector.vue'
import OutputDisplay from '../OutputDisplay.vue'
import TestInputSection from '../TestInputSection.vue'
import TestWorkspaceToolbar from '../TestWorkspaceToolbar.vue'
import AppPreviewImageGroup from '../media/AppPreviewImageGroup.vue'
import PromptGardenInspirationPopover from '../common/PromptGardenInspirationPopover.vue'
import PromptGardenImportDialog from '../common/PromptGardenImportDialog.vue'
import type { PromptGardenImportRequest } from '../../utils/prompt-garden-import'
import { useToast } from '../../composables/ui/useToast'

const session = useArenaSession()
const models = useArenaModels()
const { t } = useI18n()
const toast = useToast()
const router = inject(routerKey, null)
const showGardenImport = ref(false)
const importGarden = (request: PromptGardenImportRequest) => {
  if (!router || session.running || uploading.value) return
  void router.push({ path: '/arena', query: { importCode: request.importCode, subModeKey: 'arena', ...(request.exampleId ? { exampleId: request.exampleId } : {}) } })
}
const openModelManager = inject<(kind: 'text' | 'image', id?: string) => void | Promise<void>>('openModelManager', () => {})
const uploading = ref(false)
const deck = ref<HTMLElement>()
const { width: deckWidth } = useElementSize(deck)
const compactColumns = computed(() => deckWidth.value > 0 && (deckWidth.value - 12 * (session.state.contestants.length - 1)) / session.state.contestants.length < 320)
const columnsScrollbar = ref<ScrollbarInst>()
const fileInput = ref<HTMLInputElement>()
const imageCatalog = ref<Record<string, ImageModel[]>>({})
const { prepareInputRefs } = useImageInputPreparation()
const canRun = (c: ArenaContestant) => !uploading.value && !session.busy(c.id) && !!session.state.prompt.trim() && models.compatible(c)
const canRunAll = computed(() => !session.running && session.state.contestants.every(canRun))
const translateError = (message: string) => message.startsWith('arena.') ? t(message) : message
const perform = async (fn: () => unknown) => { try { await fn() } catch (e) { toast.error(translateError(e instanceof Error ? e.message : String(e))) } }
const configure = (c: ArenaContestant, id?: string) => id?.startsWith('image:') ? openModelManager('image', id.slice(6)) : openModelManager(c.kind, c.configKey || undefined)
const focusColumn = (id: string) => deck.value?.querySelector<HTMLElement>(`[data-column-id="${id}"] .text-model-selector`)?.focus({ preventScroll: true })
const addColumn = async () => {
  const id = session.addContestant()
  await nextTick()
  const container = deck.value?.closest<HTMLElement>('.arena-scroll-container')
  const column = deck.value?.querySelector<HTMLElement>(`[data-column-id="${id}"]`)
  if (!container || !column) return
  columnsScrollbar.value?.scrollTo({ left: column.getBoundingClientRect().right - container.getBoundingClientRect().right + container.scrollLeft,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  focusColumn(id)
}
const removeColumn = async (id: string) => {
  const index = session.state.contestants.findIndex(c => c.id === id)
  session.removeContestant(id)
  await nextTick()
  const next = session.state.contestants[Math.min(index, session.state.contestants.length - 1)]
  if (next) focusColumn(next.id)
}
const moveImage = (i: number) => { const images = session.state.images; [images[i - 1], images[i]] = [images[i], images[i - 1]] }
const upload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  uploading.value = true
  await perform(async () => { const images = await prepareInputRefs(Array.from(input.files || [])); if (images) await session.addImages(images) })
  uploading.value = false; input.value = ''
}
let imageLoadVersion = 0
const loadImages = async () => {
  const version = ++imageLoadVersion
  await perform(async () => {
    const entries = await Promise.all(session.configurations.image.map(async config => [config.id, await models.loadImages(config)] as const))
    if (version === imageLoadVersion) imageCatalog.value = Object.fromEntries(entries)
  })
}
const refresh = () => { imageLoadVersion++; imageCatalog.value = {}; void perform(session.refreshConfigs) }
onMounted(() => { refresh(); window.addEventListener('basic-workspace-refresh-text-models', refresh); window.addEventListener('image-workspace-refresh-image-models', refresh) })
onUnmounted(() => { imageLoadVersion++; void session.saveSession(); window.removeEventListener('basic-workspace-refresh-text-models', refresh); window.removeEventListener('image-workspace-refresh-image-models', refresh) })

defineExpose({ isUpdateBusy: () => session.running || uploading.value })
</script>

<style scoped>
.arena-workspace { --arena-column-min-width: min(280px, 100%); --arena-control-padding: 12px; width: 100%; height: 100%; min-height: 0; min-width: 0; display: flex; flex: 1; flex-direction: column; gap: 12px; overflow: auto; }
.arena-input, .arena-toolbar, .arena-model-controls { flex-shrink: 0; }
.file-input { display: none; }
.input-images { display: flex; align-items: flex-start; gap: 8px; margin-top: 8px; overflow-x: auto; }
.input-image { flex-shrink: 0; }
.image-actions { display: flex; justify-content: space-between; }
.model-warning { font-size: 12px; line-height: 1.5; }
.arena-comparison { display: flex; flex: 1; min-height: 260px; min-width: 0; }
.arena-scrollbar { flex: 1; min-width: 0; min-height: 0; height: 100%; }
.arena-deck { display: grid; align-items: stretch; gap: 12px; width: 100%; height: 100%; min-height: 0; }
.arena-column { display: flex; flex-direction: column; min-width: 0; min-height: 0; gap: 12px; }
.model-controls { display: flex; gap: 8px; align-items: center; min-width: 0; }
.model-controls > :deep(.text-model-selector) { flex: 1; min-width: 0; }
.model-controls > .n-button { flex-shrink: 0; }
.arena-deck--compact .model-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
.arena-deck--compact .model-controls > :deep(.text-model-selector) { grid-column: 1 / -1; }
.arena-deck--compact .column-run { grid-column: 1; justify-self: end; }
.arena-deck--compact .column-delete { grid-column: 2; }
.model-warning { display: block; margin-top: 8px; }
.arena-result-slot { display: flex; flex: 1; flex-direction: column; min-height: 0; }
.arena-result-card { flex: 1; min-height: 0; overflow: hidden; }
.arena-result-card :deep(.compact-test-error) { flex-shrink: 0; }
.result-images { display: flex; flex-wrap: wrap; flex-shrink: 1; min-height: 0; max-height: 100%; box-sizing: border-box; gap: 8px; padding: 12px; overflow: auto; }
.result-images :deep(.n-image) { min-width: 0; max-width: 100%; }
.result-images :deep(img) { max-width: 100%; }
@media (max-width: 760px) {
  .arena-workspace { --arena-column-min-width: calc((100% - 12px) / 2); --arena-control-padding: 8px; box-sizing: border-box; padding: 12px; }
  .model-controls { gap: 4px; }
  .arena-toolbar :deep(.test-workspace-toolbar) { flex-wrap: wrap; }
  .arena-toolbar :deep(.test-global-actions) { flex-wrap: wrap; max-width: 100%; justify-content: flex-end; }
}
</style>
