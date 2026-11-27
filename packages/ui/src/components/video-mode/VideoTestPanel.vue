<template>
  <TestWorkspaceLayout ref="layout" v-model:config-expanded="configExpanded" :compact="compact" :has-results="!!state.runs.length"
    :running="session.submitting || session.activeRuns.some(run => run.status === 'queued' || run.status === 'running')"
    data-testid="video-test" @scroll="emit('scroll', $event)">
    <template v-if="!extension" #config-actions>
      <NButton type="primary" size="small" :disabled="allDisabled" :loading="session.submitting"
        data-testid="video-run-all" @click="confirmRuns(visibleIds)">{{ t('video.generateAll') }}</NButton>
    </template>
    <template #input>
      <NAlert v-if="extension" type="info" :show-icon="false">{{ t('video.extension') }}</NAlert>
      <NCard v-else size="small">
        <div class="parameter-heading">
          <NText v-if="partition.shared.length" strong>{{ t('video.test') }}</NText>
          <NButton text size="small" data-testid="video-manage-models" @click="openModels('video')">
            <template #icon><Settings2 /></template>{{ t('video.configure') }}
          </NButton>
        </div>
        <div v-if="partition.shared.length" class="parameters">
          <VideoParamControl v-for="def in partition.shared" :key="def.key" :definition="def"
            :value="sharedValue(def.key)" :test-id="'video-param-shared-' + def.key" :disabled="confirming"
            action="split" @change="setParam(visibleIds, def.key, $event)" @action="split(def.key)" />
        </div>
        <NText v-if="notice" class="notice" depth="2">{{ notice }}</NText>
      </NCard>
    </template>
    <template v-if="!extension" #global-controls>
      <TestWorkspaceToolbar :count="visibleIds.length" :compact="compact" :embedded="compact" :can-use-four-columns="canUseFour"
        run-test-id="video-run-all" column-test-id-prefix="video-columns" :run-text="t('video.generateAll')" :running="session.submitting" :run-disabled="allDisabled"
        @update:count="setCount" @run="confirmRuns(visibleIds)" />
    </template>
    <template v-if="!extension" #config-summary>{{ describe(sharedParams) }}</template>
    <template #results>
      <div ref="deck" class="result-grid" :class="{ 'result-grid--compact': compact }" :style="{ gridTemplateColumns: compact ? 'minmax(0, 1fr)' : grid }">
        <VideoResultCard v-for="{ id, run, origin, headerModelName } in results" :key="id" :group="id" :run="run" :origin="origin"
          :header-model-name="!extension ? headerModelName : undefined"
          :extension="extension"
          :status="run ? session.displayStatus(run) : ''" :now="now" :querying="!!run && session.isQuerying(run)"
          :can-acknowledge="run && session.canAcknowledge(run)" :poll-error="run && pollError(run)" :source-label="sourceLabel(run ? run.source || 'workspace' : state.columns[id].source, run?.sourceVersion)"
          :specs="describe(run?.params ?? {})"
          @refresh="check" @cancel="cancel" @acknowledge="acknowledge">
          <template #header>
            <div v-if="extension">{{ id.toUpperCase() }} · {{ sourceLabel(state.columns[id].source) }}</div>
            <div v-else class="column-controls">
              <TestVariantConfig v-if="!compact || configExpanded" :label="id.toUpperCase()" :version="versionValue(state.columns[id].source)"
                :version-options="optionsFor(id)" model-key="" :disabled="confirming" hide-run hide-model
                :preview-source="() => readSource(id)" :version-test-id="'video-source-' + id"
                :model-test-id="'video-model-' + id" :run-test-id="'video-run-' + id"
                @preview="previewSource(id)" @update:version="setSource(id, $event)" />
              <NButton v-else text class="folded-source" :aria-label="id.toUpperCase() + ' · ' + t('workspace.viewPrompt')" @click="previewSource(id)">
                {{ id.toUpperCase() }} · {{ sourceLabel(state.columns[id].source) }}
              </NButton>
              <NButton size="small" secondary :loading="isRunning(id)" :disabled="disabled(id)"
                :data-testid="(compact ? 'mobile-result-run-' : 'video-run-') + id"
                :aria-label="id.toUpperCase() + ' · ' + t('video.generate')" @click="confirmRuns([id])">{{ t('video.generate') }}</NButton>
              <div class="column-picker">
                <ModelSelector :data-testid="'video-model-' + id" :model-value="selectionFor(id)?.key"
                  :selected-config="selectionFor(id)?.providerLabel" :selected-label="modelFor(id)?.name"
                  :aria-label="id.toUpperCase() + ' ' + t('video.models')" :groups="modelGroups" :placeholder="t('modelManager.selectModel')"
                  size="small" parameter-placement="inline" show-config-action :loading="!modelsLoaded" :disabled="saving.has(id) || confirming"
                  @update:model-value="setModel(id, $event)" @focus="refreshModels" @config="configId => openModels('video', configId)">
                  <template v-if="partition.perColumn[id]?.length" #parameters>
                    <div class="model-parameters">
                      <VideoParamControl v-for="def in partition.perColumn[id]" :key="def.key" :definition="def"
                        :value="resolvedColumns[id]?.params[def.key]" :test-id="'video-param-' + id + '-' + def.key"
                        :disabled="confirming" :action="partition.mergeableSplitKeys.includes(def.key) ? 'merge' : undefined"
                        @change="setParam([id], def.key, $event)" @action="merge(id, def.key)" />
                    </div>
                  </template>
                </ModelSelector>
                <NText v-if="modelUnavailable(id)" depth="2" class="notice">{{ t('video.selectedModelUnavailable') }}</NText>
              </div>
              <NText v-if="compatibilityReason(modelFor(id))" type="warning" class="column-note" role="status"
                :data-testid="'video-incompatible-' + id">{{ compatibilityReason(modelFor(id)) }}</NText>
            </div>
          </template>
        </VideoResultCard>
      </div>
    </template>
  </TestWorkspaceLayout>
  <TestSourcePreview v-model:show="showPreview" :title="t('workspace.viewPrompt')" :content="previewContent"
    :editable="previewEditable" @edit="editPreview" />
</template>

<script setup lang="ts">
import { computed, h, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useElementSize, useTimestamp } from '@vueuse/core'
import { NAlert, NButton, NCard, NText } from 'naive-ui'
import { Settings2 } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { buildPromptExecutionContext, checkVideoInputCompatibility, getVideoModelSpec, listVideoModelPresets, MAX_STORED_VIDEO_REFERENCES,
  partitionVideoColumnParams, resolveVideoConfigModel, totalVideoCosts, VIDEO_PROVIDERS, VIDEO_VARIANT_IDS, videoRunKey, videoRunVariant, videoWireModel,
  type VideoModelSummary, type VideoParams, type VideoParamValue, type VideoRun, type VideoVariantId } from '@prompt-optimizer/core'
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
import VideoParamControl from './VideoParamControl.vue'
import { sameVideoSettings, useVideoSettings } from './useVideoSettings'
import { useTemporaryVariables } from '../../composables/variable/useTemporaryVariables'
import type { VariableManagerHooks } from '../../composables/prompt/useVariableManager'

const props = defineProps<{ compact: boolean; inputPending: boolean; editSource: (view: 'original' | 'workspace') => Promise<void> }>()
const emit = defineEmits<{ scroll: [event: Event]; 'reference-limit': [count: number] }>()
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
const variableManager = inject<VariableManagerHooks>('variableManager')
const { temporaryVariables } = useTemporaryVariables()
const { describe, formatMoney } = useVideoSettings()
const dialog = useConfirmDialog()
const toast = useToast()
const extension = isVideoExtension()
const openModels = inject<(tab: 'video', configId?: string) => void>('openModelManager', () => {})
const message = (e: unknown) => {
  const m = (e as { message?: string } | null)?.message ?? String(e)
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
const compatibilityReason = (model?: VideoModelSummary, unsupportedOnly = false) => {
  const spec = model && getVideoModelSpec(model.modelId, model.providerId)
  if (!spec) return ''
  const { mode, images } = session.inputContext
  const result = checkVideoInputCompatibility(spec, mode, images)
  return result.compatible || (unsupportedOnly && result.kind !== 'unsupported') ? '' : t(result.reasonKey, result.params ?? {})
}
const selections = computed(() => models.value.map(config => {
  const providerLabel = t(VIDEO_PROVIDERS[config.providerId].labelKey)
  const groupLabel = config.name === getVideoModelSpec(config.modelId, config.providerId)?.name
    ? providerLabel : [providerLabel, config.name].join(' · ')
  const choices = listVideoModelPresets(config.providerId, config.modelId).flatMap(spec => {
    const model = resolveVideoConfigModel(config, spec.id)
    if (!model) return []
    const configModelId = spec.id === config.modelId ? undefined : config.modelId
    const reason = compatibilityReason(model, true)
    return [{ key: JSON.stringify([config.id, spec.id]), providerLabel, configModelId,
      model: configModelId ? { ...model, name: spec.name } : model,
      label: [videoWireModel(model), reason].filter(Boolean).join(' · '), disabled: !!reason }]
  })
  return { config, groupLabel, choices }
}))
const selectionFor = (id: VideoVariantId) => {
  const { configId, modelId } = state.value.columns[id]
  const group = configId ? selections.value.find(item => item.config.id === configId) : selections.value[0]
  const selectedModel = modelId || group?.config.modelId
  return group?.choices.find(choice => choice.model.modelId === selectedModel)
}
const modelFor = (id: VideoVariantId) => selectionFor(id)?.model
const modelUnavailable = (id: VideoVariantId) => modelsLoaded.value && !!state.value.columns[id].configId && !modelFor(id)
const modelGroups = computed(() => selections.value.map(({ config, groupLabel, choices }) => ({
  value: config.id, label: groupLabel, configurable: true,
  choices: choices.map(({ key, label, disabled, model }) => ({ value: key, label, disabled, searchText: model.name })),
})))
const referenceLimit = computed(() => Math.max(0, ...visibleIds.value.map(id => {
  const model = modelFor(id)
  return model ? getVideoModelSpec(model.modelId, model.providerId)?.capabilities.maxReferenceImages ?? 0 : 0
})) || MAX_STORED_VIDEO_REFERENCES)
watch(referenceLimit, value => emit('reference-limit', value), { immediate: true })
const resolvedColumns = computed(() => Object.fromEntries(visibleIds.value.map(id =>
  [id, session.resolveColumn(id, modelFor(id))])) as Partial<Record<VideoVariantId, ReturnType<typeof session.resolveColumn>>>)
const partition = computed(() => partitionVideoColumnParams(visibleIds.value.map(variantId =>
  ({ variantId, definitions: resolvedColumns.value[variantId]?.definitions ?? [] })), state.value.splitParams))
const sharedValue = (key: string) => {
  const value = resolvedColumns.value[visibleIds.value[0]]?.params[key]
  return visibleIds.value.every(id => resolvedColumns.value[id]?.params[key] === value) ? value : undefined
}
const sharedParams = computed(() => Object.fromEntries(partition.value.shared.flatMap(def => {
  const value = sharedValue(def.key)
  return value === undefined ? [] : [[def.key, value]]
})) as VideoParams)
const setParam = (ids: readonly VideoVariantId[], key: string, value: VideoParamValue) => {
  for (const id of ids) {
    const model = modelFor(id)
    if (model) session.setColumnParam(id, model, key, value)
  }
  void persist()
}
const split = (key: string) => {
  if (!state.value.splitParams.includes(key)) state.value.splitParams.push(key)
  void persist()
}
const merge = (id: VideoVariantId, key: string) => {
  const value = resolvedColumns.value[id]?.params[key]
  if (value === undefined) return
  state.value.splitParams = state.value.splitParams.filter(item => item !== key)
  setParam(visibleIds.value, key, value)
}
const saving = ref(new Set<VideoVariantId>())
const setModel = async (id: VideoVariantId, key: string) => {
  const choice = selections.value.flatMap(group => group.choices).find(item => item.key === key)
  if (!choice || choice.disabled) return
  session.setColumnModel(id, choice.model, choice.configModelId)
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
const date = (time: number) => new Date(time).toLocaleString(locale.value)
const notice = computed(() => {
  if (modelsLoaded.value && !models.value.length) return t('video.noEnabled')
  const blocked = visibleIds.value.filter(id => !!compatibilityReason(modelFor(id)))
  if (blocked.length) return t('video.batchBlocked', { columns: blocked.map(id => id.toUpperCase()).join(', ') })
  return visibleIds.value.some(id => modelFor(id) && !modelFor(id)?.configured) ? t('video.error.key') : ''
})

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
const renderPrompt = (text: string) => buildPromptExecutionContext(text, {
  ...variableManager?.customVariables.value,
  ...temporaryVariables.value,
  originalPrompt: state.value.originalPrompt.trim(),
  lastOptimizedPrompt: state.value.optimizedPrompt.trim(),
  currentPrompt: text.trim(),
  userQuestion: text.trim(),
})
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
const matchesInputs = (id: VideoVariantId, run: VideoRun) => {
  const column = state.value.columns[id]
  if (run.variantId !== id || run.source !== column.source || run.capabilityMode !== state.value.capabilityMode || !sameVideoSettings(run.params, resolvedColumns.value[id]?.params ?? {})) return false
  const images = session.activeImages
  const sameImages = run.images.length === images.length && run.images.every((img, i) => img.id === images[i].id && img.role === images[i].role)
  const source = resolveSource(column.source)
  if (!sameImages || (run.sourceVersion != null && run.sourceVersion !== source.resolvedVersion)) return false
  const execution = renderPrompt(source.text)
  return !execution.missingVariables.length && !execution.forbiddenTemplateSyntax.length && (run.submittedPrompt ?? run.prompt) === execution.renderedContent
}
const resultOrigin = (run: VideoRun) => {
  const origin = t(run.variantId ? 'video.previousSubmission' : 'video.singleColumnResult')
  return [origin, sourceLabel(run.source ?? 'workspace', run.sourceVersion), date(run.submittedAt)].join(' · ')
}
const results = computed(() => visibleIds.value.map(id => {
  const { runs } = state.value
  const run = session.activeFor(id) ?? runs.find(item => videoRunVariant(item) === id)
    ?? (id === 'a' ? runs.filter(item => !item.variantId)[1] : undefined)
  const model = modelFor(id)
  const sameModel = !!model && !!run && model.id === run.configId && videoWireModel(model) === run.model && model.modelId === run.modelId && model.baseURL === run.baseURL
  const origin = run && (!sameModel || !matchesInputs(id, run)) ? resultOrigin(run) : ''
  return { id, run, origin, headerModelName: sameModel ? model.name : undefined }
}))
const confirming = ref(false)
const disabled = (id: VideoVariantId) => extension || props.inputPending || confirming.value || session.submitting || saving.value.has(id) ||
  !!session.activeFor(id) || !!compatibilityReason(modelFor(id)) || !modelFor(id)?.configured || !promptFor(id).trim()
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
      const { model, configModelId } = selectionFor(id)!
      const source = state.value.columns[id].source
      const { text, resolvedVersion } = resolveSource(source)
      const execution = renderPrompt(text)
      if (execution.forbiddenTemplateSyntax.length) {
        throw new Error(id.toUpperCase() + ' · ' + t('imageWorkspace.generation.forbiddenTemplateSyntax'))
      }
      if (execution.missingVariables.length) {
        throw new Error(id.toUpperCase() + ' · ' + t('imageWorkspace.generation.missingVariables', { vars: execution.missingVariables.join(', ') }))
      }
      const run = session.prepareRun(model, id, execution.renderedContent, configModelId)
      return { ...run, ...(source !== 'original' && resolvedVersion >= 0 && { sourceVersion: resolvedVersion }) }
    })
    const total = [...totalVideoCosts(drafts.map(run => run.cost))]
      .map(([currency, amount]) => formatMoney(amount, currency)).join(' + ')
    const unpriced = drafts.some(run => !run.cost)
    const summaries = drafts.map(run => h('div', [
      run.variantId!.toUpperCase(), sourceLabel(run.source, run.sourceVersion), run.modelName, run.model,
      describe(run.params), t('video.refCount', { n: run.images.length }),
      run.cost ? formatMoney(run.cost.amount, run.cost.currency) : t('video.billAtProvider'),
    ].join(' · ')))
    const accepted = await dialog.warning({
      title: t('video.confirmTitle'),
      content: () => h('div', [
        h('p', t('video.confirmColumns', { count: drafts.length })),
        total && h('p', t('video.confirmTotal', { price: total })),
        unpriced && h('p', t('video.customEstimate')),
        ...summaries,
      ]),
      positiveText: t('video.confirmPay'), negativeText: t('common.cancel'),
    })
    if (accepted) for (const draft of drafts) await session.submit(draft)
  } catch (e) { toast.error(message(e)) } finally { confirming.value = false }
}

const now = useTimestamp({ interval: 1000 })
const pollError = (run: VideoRun) => {
  const error = session.pollErrors.get(videoRunKey(run))
  return error === undefined ? undefined : message(error)
}
const check = async (run: VideoRun) => {
  try { await session.refresh(run) } catch (error) {
    if (!session.pollErrors.has(videoRunKey(run))) toast.error(message(error))
  }
}
const poll = () => {
  if (extension) return
  for (const run of session.activeRuns) {
    if (run.id && ['queued', 'running'].includes(run.status) && !session.isQuerying(run) && !session.pollErrors.has(videoRunKey(run))) void check(run)
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
  if (await dialog.warning({ title: t('video.acknowledge'), content: t('video.untrackConfirm'),
    positiveText: t('video.acknowledge'), negativeText: t('common.cancel') })) {
    try { await session.acknowledge(run) } catch (error) { toast.error(message(error)) }
  }
}

</script>

<style scoped>
.parameter-heading { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.parameter-heading > :only-child { margin-inline-start: auto; }
.parameters { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; margin-top: 8px; }
.column-note, .column-picker { grid-column: 1 / -1; }
.column-picker { min-width: 0; margin-inline-start: 16px; }
.model-parameters { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
.parameters .n-text, .notice { font-size: 12px; }
.notice { display: block; margin-top: 6px; }
.column-controls { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; align-items: start; }
.folded-source { min-height: 32px; justify-content: start; font-size: 13px; }
.result-grid { display: grid; flex: 1; min-width: 0; min-height: 0; gap: 12px; }
.result-grid--compact { gap: 8px; }
</style>
