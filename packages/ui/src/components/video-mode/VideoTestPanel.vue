<template>
  <TestWorkspaceLayout ref="layout" v-model:config-expanded="configExpanded" :compact="compact" :has-results="!!state.runs.length"
    :running="session.submitting || session.activeRuns.some(run => run.status === 'queued' || run.status === 'running')"
    data-testid="video-test" @scroll="emit('scroll', $event)">
    <template v-if="!extension" #config-actions>
      <NButton type="primary" size="small" :disabled="allDisabled" :loading="session.submitting"
        data-testid="video-run-all" @click="confirmRuns(visibleIds)">{{ t('test.layout.runAll') }}</NButton>
    </template>
    <template #input>
      <NAlert v-if="extension" type="info" :show-icon="false">{{ t('video.extension') }}</NAlert>
      <NCard v-else size="small">
        <div class="parameter-heading">
          <div>
            <NText strong>{{ t('video.test') }}</NText>
            <NText v-if="models.length === 1" class="parameter-model" depth="2">{{ models[0].name }}</NText>
          </div>
          <NButton text size="small" data-testid="video-manage-models" @click="openModels('video')">
            <template #icon><Settings2 /></template>{{ t('video.configure') }}
          </NButton>
        </div>
        <div class="parameters">
          <div><NText depth="2">{{ t('video.duration') }}</NText>
            <NSelect v-model:value="state.params.duration" :aria-label="t('video.duration')" :options="durations" size="small" /></div>
          <div><NText depth="2">{{ t('video.ratio') }}</NText>
            <NSelect v-model:value="state.params.ratio" :aria-label="t('video.ratio')" :options="ratios" size="small" /></div>
          <div><NText depth="2">{{ t('video.resolution') }}</NText>
            <NSelect v-model:value="state.params.resolution" :aria-label="t('video.resolution')" :options="resolutions" size="small" /></div>
        </div>
        <NText v-if="!notice && models.length && !visibleIds.some(modelUnavailable)" depth="3" class="notice">{{ allPublicRates
          ? t('video.estimate', { price: estimateVideoCost(state.params).toFixed(2) }) : t('video.customEstimate') }}</NText>
        <NText v-if="notice" class="notice" depth="2">{{ notice }}</NText>
      </NCard>
    </template>
    <template v-if="!extension" #global-controls>
      <TestWorkspaceToolbar :count="visibleIds.length" :compact="compact" :embedded="compact" :can-use-four-columns="canUseFour"
        run-test-id="video-run-all" column-test-id-prefix="video-columns" :running="session.submitting" :run-disabled="allDisabled"
        @update:count="setCount" @run="confirmRuns(visibleIds)" />
    </template>
    <template v-if="!extension" #variant-controls>
      <NCard size="small" content-style="padding: 12px;">
        <div ref="deck" class="variant-grid" :style="{ gridTemplateColumns: compact ? 'minmax(0, 1fr)' : grid }">
          <TestVariantConfig v-for="id in visibleIds" :key="id" :label="id.toUpperCase()" :version="versionValue(state.columns[id].source)"
            :version-options="optionsFor(id)" :model-key="modelFor(id)?.id || ''" :disabled="confirming"
            :run-disabled="disabled(id)" :running="isRunning(id)" :hide-run="compact"
            :hide-model="!models.length || (models.length === 1 && !modelUnavailable(id))"
            :preview-source="() => readSource(id)" :version-test-id="'video-source-' + id"
            :model-test-id="'video-model-' + id" :run-test-id="'video-run-' + id"
            @preview="previewSource(id)" @update:version="setSource(id, $event)" @run="confirmRuns([id])">
            <template #model>
              <ModelSelector :data-testid="'video-model-' + id" :model-value="modelFor(id)?.id" :selected-label="modelFor(id)?.name"
                :aria-label="id.toUpperCase() + ' ' + t('video.models')" :groups="modelGroups" :placeholder="t('modelManager.selectModel')"
                size="small" show-config-action :disabled="saving.has(id) || confirming" @update:model-value="setModel(id, $event)"
                @focus="refreshModels" @config="configId => openModels('video', configId)" />
              <NText v-if="modelUnavailable(id)" depth="2" class="notice">{{ t('video.selectedModelUnavailable') }}</NText>
            </template>
          </TestVariantConfig>
        </div>
      </NCard>
    </template>
    <template v-if="!extension" #config-summary>{{ specs(state) }} · {{ visibleIds.map(id => id.toUpperCase()).join(' / ') }}</template>
    <template #results>
      <div class="result-grid" :class="{ 'result-grid--compact': compact }" :style="{ gridTemplateColumns: compact ? 'minmax(0, 1fr)' : grid }">
        <VideoResultCard v-for="{id, run} in results" :key="id" :group="id" :run="run" :options="runOptions" :compact="compact"
          :extension="extension" :running="isRunning(id)" :run-disabled="disabled(id)"
          :status="run ? session.displayStatus(run) : ''" :now="now" :querying="!!run && session.isQuerying(run)"
          :poll-error="run && pollErrors[videoRunKey(run)]" :source-label="sourceLabel(run ? run.source || 'workspace' : state.columns[id].source, run?.sourceVersion)"
          :planned-prompt="promptFor(id)" :specs="specs(run || state)" @select="setResult(id, $event)" @run="confirmRuns([id])"
          @refresh="check" @cancel="cancel" @acknowledge="acknowledge" />
      </div>
    </template>
  </TestWorkspaceLayout>
  <TestSourcePreview v-model:show="showPreview" :title="t('workspace.viewPrompt')" :content="previewContent"
    :editable="previewEditable" @edit="editPreview" />
</template>

<script setup lang="ts">
import { computed, h, inject, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useElementSize } from '@vueuse/core'
import { NAlert, NButton, NCard, NSelect, NText } from 'naive-ui'
import { Settings2 } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { estimateVideoCost, VIDEO_RATIOS, VIDEO_RESOLUTIONS, VIDEO_VARIANT_IDS, videoReferenceError,
  videoRunKey, videoRunVariant, videoTokenRate, type VideoModelSummary, type VideoRun, type VideoVariantId } from '@prompt-optimizer/core'
import { useVideoCreateSession, getVideoService, isVideoExtension } from '../../stores/session/useVideoCreateSession'
import { useSessionManager } from '../../stores/session/useSessionManager'
import {
  buildTestPanelVersionOptions, formatPreviousVersionLabel, resolveTestPanelVersionSelection,
  type DynamicTestPanelVersionValue, type TestPanelVersionOption,
} from '../../utils/testPanelVersion'
import type { WorkspaceScrollHandle } from '../../types/workspacePresentation'
import { useConfirmDialog } from '../../composables/ui/useConfirmDialog'
import { useTestSourcePreview } from '../../composables/workspaces/useTestSourcePreview'
import { useToast } from '../../composables/ui/useToast'
import ModelSelector from '../ModelSelector.vue'
import TestWorkspaceToolbar from '../TestWorkspaceToolbar.vue'
import TestVariantConfig from '../TestVariantConfig.vue'
import TestWorkspaceLayout from '../common/TestWorkspaceLayout.vue'
import TestSourcePreview from '../common/TestSourcePreview.vue'
import VideoResultCard from './VideoResultCard.vue'

const props = defineProps<{ compact: boolean; editSource: (view: 'original' | 'workspace') => Promise<void> }>()
const emit = defineEmits<{ scroll: [event: Event] }>()
const configExpanded = defineModel<boolean>('configExpanded', { required: true })
const layout = ref<WorkspaceScrollHandle | null>(null)
defineExpose<WorkspaceScrollHandle>({
  getScrollTop: () => layout.value?.getScrollTop() ?? 0,
  setScrollTop: top => { layout.value?.setScrollTop(top) },
})
const session = useVideoCreateSession()
const sessionManager = useSessionManager()
const state = computed(() => session.state)
const { t, locale } = useI18n()
const dialog = useConfirmDialog()
const toast = useToast()
const extension = isVideoExtension()
const openModels = inject<(tab: 'video', configId?: string) => void>('openModelManager', () => {})
const message = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e)
  return m.startsWith('video.error.') ? t(m) : m
}
const persist = async () => {
  try { if (!await sessionManager.flushSubModeSession('video-create')) throw new Error('video.error.save') }
  catch (error) { toast.error(message(error)) }
}

const deck = ref<HTMLElement>()
const { width } = useElementSize(deck)
const canUseFour = computed(() => props.compact || width.value >= 980)
const visibleIds = computed(() => VIDEO_VARIANT_IDS.slice(0, Math.min(state.value.columnCount, canUseFour.value ? 4 : 3)))
const grid = computed(() => 'repeat(' + visibleIds.value.length + ', minmax(0, 1fr))')
const setCount = (count: 2 | 3 | 4) => { state.value.columnCount = count; void persist() }
const models = ref<VideoModelSummary[]>([])
const modelsLoaded = ref(false)
const modelFor = (id: VideoVariantId) => {
  const configId = state.value.columns[id].configId
  return configId ? models.value.find(item => item.id === configId) : models.value[0]
}
const modelUnavailable = (id: VideoVariantId) => modelsLoaded.value && !!state.value.columns[id].configId && !modelFor(id)
const allPublicRates = computed(() => visibleIds.value.every(id => {
  const model = modelFor(id)
  return model && videoTokenRate(model.model, model.baseURL) !== null
}))
const modelGroups = computed(() => models.value.map(config => ({
  value: config.id, label: config.name, configurable: true, searchText: config.model,
  choices: [{ value: config.id, label: config.model }],
})))
const saving = ref(new Set<VideoVariantId>())
const setModel = async (id: VideoVariantId, configId: string) => {
  state.value.columns[id].configId = configId
  saving.value.add(id)
  try { await persist() } finally { saving.value.delete(id) }
}
const refreshModels = async () => {
  if (extension) return
  try {
    models.value = (await getVideoService().listModels()).filter(model => model.enabled)
    modelsLoaded.value = true
  } catch (e) { toast.error(message(e)) }
}
const durations = computed(() => Array.from({ length: 12 }, (_, i) => ({ value: i + 4, label: t('video.seconds', { n: i + 4 }) })))
const ratios = VIDEO_RATIOS.map(value => ({ value, label: value }))
const resolutions = VIDEO_RESOLUTIONS.map(value => ({ value, label: value }))
const specs = ({ params }: Pick<VideoRun, 'params'>) => [t('video.seconds', { n: params.duration }), params.ratio, params.resolution].join(' · ')
const date = (time: number) => new Date(time).toLocaleString(locale.value)
const roleError = computed(() => videoReferenceError(state.value.images.map(i => i.role)))
const notice = computed(() => roleError.value ? t('video.error.' + roleError.value)
  : modelsLoaded.value && !models.value.length ? t('video.noEnabled')
  : visibleIds.value.some(id => modelFor(id) && !modelFor(id)?.configured) ? t('video.error.key') : '')

const { versions, currentVersion, historyById, historyReady } = storeToRefs(session)
const versionContext = computed(() => ({
  currentVersionId: currentVersion.value?.id, workspacePrompt: state.value.optimizedPrompt, originalPrompt: state.value.originalPrompt,
}))
const versionLabels = computed(() => ({
  workspace: t('test.layout.workspace'), previous: t('test.layout.previous'), original: t('test.layout.original'),
}))
const versionOptions = computed(() => buildTestPanelVersionOptions(versions.value, versionLabels.value, versionContext.value))
const versionValue = (source: string): DynamicTestPanelVersionValue => {
  if (source === 'original') return 0
  if (source === 'workspace' || source === 'previous') return source
  return versions.value.find(record => record.id === source)?.version ?? -1
}
const resolveSource = (source: string) => {
  const selection = versionValue(source)
  if (selection === 'previous' && (!historyReady.value || (session.optimizing && !currentVersion.value))) {
    return { text: '', resolvedVersion: -1 }
  }
  if (selection === -1) {
    const pinned = historyById.value.get(source)
    return { text: pinned?.optimizedPrompt ?? '', resolvedVersion: pinned?.version ?? -1 }
  }
  return resolveTestPanelVersionSelection({ selection, versions: versions.value, ...versionContext.value })
}
const sourceLabel = (source: string, submittedVersion?: number) => {
  if (source === 'original') return t('promptOptimizer.originalPrompt')
  if (source === 'workspace') return t('workspace.optimizeWorkspace')
  if (source === 'previous') return formatPreviousVersionLabel(submittedVersion ?? resolveSource(source).resolvedVersion, versionLabels.value)
  const version = submittedVersion ?? historyById.value.get(source)?.version
  return version ? `v${version}` : t('video.savedPrompt')
}
const optionsFor = (id: VideoVariantId): TestPanelVersionOption[] => {
  const source = state.value.columns[id].source
  if (versionValue(source) !== -1) return versionOptions.value
  // Keep an explicitly pinned older selection usable without putting other chains in the menu.
  const pinned = historyById.value.get(source)
  const label = pinned ? t('video.pinnedVersion', { n: pinned.version }) : t('video.missingSource')
  return [...versionOptions.value, { value: -1, label, fullLabel: label, disabled: true }]
}
const setSource = (id: VideoVariantId, value: string | number) => {
  const source = value === 0 ? 'original' : typeof value === 'number' ? versions.value.find(record => record.version === value)?.id : value
  if (source) { state.value.columns[id].source = source; void persist() }
}
const promptFor = (id: VideoVariantId) => resolveSource(state.value.columns[id].source).text
const { show: showPreview, content: previewContent, editable: previewEditable, read: readSource, preview: previewSource, edit: editPreview } =
  useTestSourcePreview({
    mode: 'snapshot',
    readSource: id => {
      const source = state.value.columns[id].source
      return { content: promptFor(id), editable: source === 'workspace' || source === 'original',
        view: source === 'workspace' ? 'workspace' : 'original' }
    },
    onEdit: props.editSource,
  })
const results = computed(() => visibleIds.value.map(id => {
  const { runs, columns } = state.value
  const chosen = columns[id].selectedRunKey
  const run = runs.find(item => chosen && videoRunKey(item) === chosen)
    ?? runs.find(item => videoRunVariant(item) === id)
    ?? (id === 'a' ? runs.filter(item => !item.variantId)[1] : undefined)
  return { id, run }
}))
const runOptions = computed(() => state.value.runs.map(run => {
  const status = session.displayStatus(run)
  return {
    key: videoRunKey(run),
    label: [run.variantId?.toUpperCase(), sourceLabel(run.source || 'workspace', run.sourceVersion), date(run.submittedAt),
      ...(status === 'succeeded' ? [] : [t('video.status.' + status)])].filter(Boolean).join(' · '),
  }
}))
const setResult = (id: VideoVariantId, key: string) => { state.value.columns[id].selectedRunKey = key; void persist() }
const confirming = ref(false)
const disabled = (id: VideoVariantId) => extension || confirming.value || session.submitting || saving.value.has(id) ||
  !!session.activeFor(id) || !!roleError.value || !modelFor(id)?.configured || !promptFor(id).trim()
const isRunning = (id: VideoVariantId) => {
  const run = session.activeFor(id)
  return !!run && session.displayStatus(run) !== 'unknown'
}
const allDisabled = computed(() => visibleIds.value.some(disabled))
const confirmRuns = async (ids: readonly VideoVariantId[]) => {
  if (ids.some(disabled)) return
  confirming.value = true
  try {
    const drafts = ids.map(id => {
      const model = modelFor(id)!
      const source = state.value.columns[id].source
      const { text, resolvedVersion } = resolveSource(source)
      const run = session.prepareRun(model.model, model.id, model.baseURL, id, text, model.name)
      return { ...run, ...(source !== 'original' && resolvedVersion >= 0 && { sourceVersion: resolvedVersion }) }
    })
    const priced = drafts.every(run => run.cnyPerMillionTokens != null)
    const total = drafts.reduce((sum, run) => sum + (run.cnyPerMillionTokens == null ? 0 : estimateVideoCost(run.params, run.cnyPerMillionTokens)), 0)
    const accepted = await dialog.warning({
      title: t('video.confirmTitle'),
      content: () => h('div', [
        h('p', t(priced ? 'video.confirmBatchCost' : 'video.confirmBatchCustom', { count: drafts.length, price: total.toFixed(2) })),
        ...drafts.map(run => h('div', [run.variantId!.toUpperCase(), sourceLabel(run.source, run.sourceVersion), run.modelName, run.model,
          specs(run), t('video.refCount', { n: run.images.length })].join(' · '))),
      ]),
      positiveText: t('video.confirmPay'), negativeText: t('common.cancel'),
    })
    if (accepted) for (const draft of drafts) await session.submit(draft)
  } catch (e) { toast.error(message(e)) } finally { confirming.value = false }
}

const now = ref(Date.now())
const pollErrors = ref<Record<string, string>>({})
const check = async (run: VideoRun) => {
  const key = videoRunKey(run)
  delete pollErrors.value[key]
  try { await session.refresh(run); now.value = Date.now() } catch (e) { pollErrors.value[key] = message(e) }
}
const poll = () => {
  now.value = Date.now()
  if (extension) return
  for (const run of session.activeRuns) {
    if (run.id && ['queued', 'running'].includes(run.status) && !session.isQuerying(run) && !pollErrors.value[videoRunKey(run)]) void check(run)
  }
}
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void refreshModels()
  timer = setInterval(poll, 4500)
  window.addEventListener('video-workspace-refresh-models', refreshModels)
})
onUnmounted(() => {
  clearInterval(timer)
  window.removeEventListener('video-workspace-refresh-models', refreshModels)
})
const cancel = async (run: VideoRun) => {
  try { await session.cancel(run) } catch (e) { toast.error(message(e)); await check(run) }
}
const acknowledge = async (run: VideoRun) => {
  if (await dialog.warning({ title: t('video.acknowledge'), content: t('video.unknownHint'), positiveText: t('common.confirm'), negativeText: t('common.cancel') })) {
    run.status = 'untracked'
    await persist()
  }
}

</script>

<style scoped>
.parameter-heading { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.parameter-model { margin-inline-start: 8px; font-size: 12px; }
.parameters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
.parameters > div { display: grid; gap: 4px; min-width: 0; }
.parameters .n-text, .notice { font-size: 12px; }
.notice { display: block; margin-top: 6px; }
.variant-grid, .result-grid { display: grid; min-width: 0; gap: 12px; }
.variant-grid .text-model-selector { width: 100%; }
.result-grid { flex: 1; min-height: 0; }
.result-grid--compact { gap: 8px; }
</style>
