<template>
  <section class="video-workspace" :class="{ 'compact-two-region': isCompact }"
    data-testid="video-workspace" data-mode="video-create" :aria-label="t('video.title')">
    <Teleport defer to="#compact-workspace-tools" :disabled="!isCompact">
      <WorkspaceUtilityMenu :compact="isCompact" test-id="video-workspace-utility-menu"
        :disabled="workspaceBusy || !!session.activeRun" :actions="evaluationActions" @action="handleUtilityAction" @clear="clearWorkspace" />
    </Teleport>

    <div ref="splitRoot" class="video-split compact-workspace-pane"
      :style="{ gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : mainSplitLeftPct + '% 12px 1fr' }">
      <div v-show="!isCompact || mobileRegion === 'optimize'" class="video-pane compact-optimize-region">
        <OptimizeWorkspaceLayout ref="optimizeLayoutRef" :compact="isCompact" @scroll="rememberOptimizeScroll">
          <template #original>
            <TestSourceLinkedCard class="compact-original-card video-original">
              <NFlex v-if="inputCollapsed" class="source-summary-heading" align="center" justify="space-between" :wrap="false">
                <NFlex class="source-summary-group" align="center" :size="8" :wrap="false">
                  <NText class="source-summary-title" depth="1">{{ t('video.promptLabel') }}</NText>
                  <NText class="source-summary-text" depth="3">{{ state.originalPrompt }}</NText>
                </NFlex>
                <NButton type="tertiary" size="small" ghost round :aria-label="t('common.expand')" @click="inputCollapsed = false">
                  <template #icon><ChevronDown /></template>
                </NButton>
              </NFlex>
              <div v-show="!inputCollapsed" class="workspace-input-panel">
                <InputPanel v-model="state.originalPrompt" test-id-prefix="video" :compact="isCompact"
                  :label="t('video.promptLabel')" :placeholder="t('video.placeholder')"
                  :selected-model="selectedTextModelKey" :model-label="t('video.textModel')" :template-label="t('promptOptimizer.templateLabel')"
                  :button-text="t('video.optimize')" :compact-button-text="t('video.shortOptimize')" :loading-text="t('common.loading')" :loading="session.optimizing"
                  :disabled="!selectedTextModelKey || !selectedTemplateId || !templateOptions.length || uploading || session.iterating" @submit="writePrompt()">
                  <template #header-extra>
                    <NButton type="tertiary" size="small" ghost round :aria-label="t('common.collapse')" @click="inputCollapsed = true">
                      <template #icon><ChevronUp /></template>
                    </NButton>
                  </template>
                  <template #input-extra>
                    <ReferenceImagePicker
                      :items="referenceItems"
                      :label="t('video.refsLabel', { count: state.images.length })"
                      :hint="state.images.length > 0 ? t('video.refsHint') : ''"
                      accept="image/png,image/jpeg,image/webp"
                      :max="4"
                      :multiple="true"
                      :reorderable="true"
                      :compact="isCompact"
                      :disabled="session.optimizing || session.iterating"
                      :loading="uploading"
                      upload-test-id="video-reference-upload"
                      list-test-id="video-reference-list"
                      card-test-id-prefix="video-reference-card"
                      upload-card-test-id="video-reference-upload-card"
                      @select-files="uploadFiles"
                      @remove="removeReference"
                      @reorder="reorderReferences"
                    >
                      <template #card-extra="{ index }">
                        <NSelect
                          :value="state.images[index]?.role"
                          :aria-label="t('video.role')"
                          :options="roles"
                          :consistent-menu-width="false"
                          size="tiny"
                          @update:value="role => updateReferenceRole(index, role)"
                        />
                      </template>
                    </ReferenceImagePicker>
                  </template>
                  <template #model-select>
                    <TextModelSelector v-model="selectedTextModelKey" :options="textModelOptions" parameters
                      :aria-label="t('video.textModel')" :disabled="session.optimizing || session.iterating" size="medium"
                      @focus="refreshTextModels" @config="id => openModels('text', id)" />
                  </template>
                  <template #template-select>
                    <SelectWithConfig data-testid="video-template-select" :model-value="selectedTemplateId" :options="templateOptions"
                      :get-primary="OptionAccessors.getPrimary" :get-secondary="OptionAccessors.getSecondary" :get-value="OptionAccessors.getValue"
                      :aria-label="t('promptOptimizer.templateLabel')" :placeholder="t('template.select')" :config-text="t('template.configure')"
                      :disabled="session.optimizing || session.iterating" size="medium" filterable show-config-action show-empty-config-c-t-a
                      @update:model-value="id => session.updateTemplate(typeof id === 'string' ? id : null)"
                      @focus="refreshTemplates" @config="openTemplates('videoOptimize')" />
                  </template>
                </InputPanel>
              </div>
            </TestSourceLinkedCard>
          </template>

          <template #workspace>
            <TestSourceLinkedCard class="compact-result-card video-editor-card"
              content-style="height: 100%; max-height: 100%; overflow: hidden;">
              <div class="video-editor">
                <PromptPanel ref="panel" v-model:optimized-prompt="state.optimizedPrompt"
                  test-id="video" initial-view-mode="source" :mobile-layout="isCompact" :enable-evaluation="false"
                  :original-prompt="state.originalPrompt" :versions="session.versions" :current-version-id="state.currentVersionId || ''"
                  :is-optimizing="session.optimizing" :is-iterating="session.iterating" optimization-mode="user"
                  iterate-template-type="videoIterate" :selected-iterate-template="iterateTemplate"
                  @update:selected-iterate-template="template => session.updateIterateTemplate(template?.id ?? null)"
                  @iterate="payload => writePrompt(payload)" @open-template-manager="openTemplates"
                  @switch-version="selectVersion" @switch-to-v0="selectOriginal" @save-local-edit="saveLocalEdit" @save-favorite="favorite" />
                <NText v-if="rolesOnly" depth="2" class="video-note" role="status">{{ t('video.warning.rolesOnly') }}</NText>
              </div>
            </TestSourceLinkedCard>
          </template>
        </OptimizeWorkspaceLayout>
      </div>

      <div v-if="!isCompact" class="split-divider" role="separator" tabindex="0"
        aria-orientation="vertical" :aria-label="t('workspace.regions')" :aria-valuemin="25" :aria-valuemax="50" :aria-valuenow="mainSplitLeftPct"
        @pointerdown="onSplitPointerDown" @keydown="onSplitKeydown" />

      <div v-show="!isCompact || mobileRegion === 'test'" class="video-pane compact-test-region">
        <VideoTestPanel ref="testLayoutRef" v-model:config-expanded="testConfigExpanded" :compact="isCompact"
          :edit-source="editTestSource" @scroll="rememberTestScroll" />
      </div>
    </div>
    <WorkspaceRegionSwitch v-if="isCompact" v-model="mobileRegion" :optimizing="session.optimizing || session.iterating" :testing="testing" />
    <TestSourcePreview v-model:show="showEvaluation" :title="t('video.viewEvaluation')" :content="currentEvaluation?.text || ''" :editable="false" />
  </section>
</template>
<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { NButton, NFlex, NSelect, NText } from 'naive-ui'
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { v4 as uuid } from 'uuid'
import { VIDEO_ROLES, type ImageInputRef, type PromptRecord, type TemplateType, type VideoImageRef } from '@prompt-optimizer/core'
import { OptionAccessors } from '../../utils/data-transformer'
import { useWorkspaceTemplatePicker } from '../../composables/workspaces/useWorkspaceTemplateSelection'
import SelectWithConfig from '../SelectWithConfig.vue'
import { useVideoCreateSession } from '../../stores/session/useVideoCreateSession'
import { getPiniaServices } from '../../plugins/pinia'
import { useImageInputPreparation } from '../../composables/image/useImageInputPreparation'
import { useToast } from '../../composables/ui/useToast'
import { useConfirmDialog } from '../../composables/ui/useConfirmDialog'
import type { SaveFavoriteData } from '../../composables/app/useAppFavorite'
import type { AppServices } from '../../types/services'
import { useWorkspaceSplit } from '../../composables/ui/useWorkspaceSplit'
import { useWorkspacePresentation } from '../../composables/ui/useWorkspacePresentation'
import { useWorkspaceTextModelSelection } from '../../composables/workspaces/useWorkspaceTextModelSelection'
import InputPanel from '../InputPanel.vue'
import PromptPanel from '../PromptPanel.vue'
import TestSourceLinkedCard from '../TestSourceLinkedCard.vue'
import WorkspaceUtilityMenu from '../common/WorkspaceUtilityMenu.vue'
import WorkspaceRegionSwitch from '../common/WorkspaceRegionSwitch.vue'
import OptimizeWorkspaceLayout from '../common/OptimizeWorkspaceLayout.vue'
import TestSourcePreview from '../common/TestSourcePreview.vue'
import TextModelSelector from '../TextModelSelector.vue'
import VideoTestPanel from './VideoTestPanel.vue'
import ReferenceImagePicker, { type ReferenceImageItem } from '../media/ReferenceImagePicker.vue'
const session = useVideoCreateSession()
const state = computed(() => session.state)
const toast = useToast()
const dialog = useConfirmDialog()
const { t } = useI18n()
const openModels = inject<(tab: 'text', id?: string) => void>('openModelManager', () => {})
const openTemplates = inject<(type: TemplateType) => void>('openTemplateManager', () => {})
const saveFavorite = inject<(data: SaveFavoriteData) => void>('handleSaveFavorite')
const {
  isCompact, mobileRegion, testConfigExpanded, inputCollapsed, optimizeLayoutRef, testLayoutRef,
  rememberOptimizeScroll, rememberTestScroll, showOptimizationSection, resetMobileView,
} = useWorkspacePresentation('video-create')
const editTestSource = async (view: 'original' | 'workspace') => {
  if (view === 'original') inputCollapsed.value = false
  await showOptimizationSection(view)
}
const splitRoot = ref<HTMLElement | null>(null)
const { mainSplitLeftPct, onSplitPointerDown, onSplitKeydown } = useWorkspaceSplit({
  root: splitRoot,
  getPercent: () => state.value.mainSplitLeftPct,
  setPercent: percent => { state.value.mainSplitLeftPct = percent },
})
const servicesRef = inject<Ref<AppServices | null>>('services', ref(null))
const { textModelOptions, selectedTextModelKey, refreshTextModels } = useWorkspaceTextModelSelection(servicesRef, {
  get selectedTextModelKey() { return state.value.selectedTextModelKey },
  updateTextModel: key => { state.value.selectedTextModelKey = key },
})
const selectedTemplateId = computed({
  get: () => state.value.selectedTemplateId ?? '',
  set: (id: string) => session.updateTemplate(id || null),
})
const { options: templateOptions, refresh: refreshTemplates } =
  useWorkspaceTemplatePicker(servicesRef, 'videoOptimize', selectedTemplateId, true)
const panel = ref<InstanceType<typeof PromptPanel> | null>(null)
const iterateTemplateId = computed({
  get: () => state.value.selectedIterateTemplateId ?? '',
  set: (id: string) => session.updateIterateTemplate(id || null),
})
const { selected: iterateTemplate, refresh: refreshIterateTemplates } =
  useWorkspaceTemplatePicker(servicesRef, 'videoIterate', iterateTemplateId, true)
const refreshAllTemplates = async () => {
  await Promise.all([refreshTemplates(), refreshIterateTemplates()])
  panel.value?.refreshIterateTemplateSelect()
}
const refreshHistory = () => session.refreshHistory().catch(report)

const roles = computed(() => VIDEO_ROLES.map(value => ({ value, label: t('video.roles.' + value) })))
const rolesOnly = ref(false)
const evaluating = ref(false)
const showEvaluation = ref(false)
const currentEvaluation = computed(() => {
  const { evaluation, optimizedPrompt } = state.value
  return evaluation?.prompt === optimizedPrompt ? evaluation : null
})
const evaluationActions = computed(() => state.value.optimizedPrompt.trim() ? [
  { key: 'evaluate-prompt', label: t('video.evaluate'), disabled: !selectedTextModelKey.value },
  ...(currentEvaluation.value ? [{ key: 'view-evaluation', label: t('video.viewEvaluation') }] : []),
] : [])
const handleUtilityAction = (key: string) => {
  if (key === 'view-evaluation') showEvaluation.value = true
  if (key === 'evaluate-prompt') void evaluate()
}
const uploading = ref(false)
const thumbnails = ref<Record<string,string>>({})
let thumbnailRevision = 0
const { prepareInputRefs } = useImageInputPreparation()
const report = (e: unknown) => { const m = e instanceof Error ? e.message : String(e); toast.error(m.startsWith('video.error.') ? t(m) : m) }
const workspaceBusy = computed(() => session.busy || evaluating.value || uploading.value)
const testing = computed(() => session.submitting || session.activeRuns.some(run => run.status === 'queued' || run.status === 'running'))
const clearWorkspace = async () => {
  if (workspaceBusy.value || session.activeRun) return
  session.applyPrompt('', '')
  state.value.runs = []
  rolesOnly.value = false
  resetMobileView()
  try { if (!await session.saveSession()) throw new Error('video.error.save') } catch (e) { report(e) }
}
onMounted(() => {
  window.addEventListener('video-workspace-refresh-models', refreshTextModels)
  void refreshHistory()
  window.addEventListener('video-workspace-refresh-templates', refreshAllTemplates)
  window.addEventListener('prompt-optimizer:history-refresh', refreshHistory)
})
onUnmounted(() => {
  window.removeEventListener('video-workspace-refresh-models', refreshTextModels)
  window.removeEventListener('video-workspace-refresh-templates', refreshAllTemplates)
  window.removeEventListener('prompt-optimizer:history-refresh', refreshHistory)
  thumbnailRevision++
})
watch(() => state.value.images.map(i => i.id), async () => {
  const revision = ++thumbnailRevision
  const imgs = [...state.value.images]
  try {
    const entries = await Promise.all(imgs.map(async i => {
      const stored = await getPiniaServices()?.imageStorageService?.getImage(i.id)
      return [i.id, stored ? `data:${stored.metadata.mimeType};base64,${stored.data}` : '']
    }))
    if (revision === thumbnailRevision) thumbnails.value = Object.fromEntries(entries)
  } catch (e) { report(e) }
}, { immediate: true })
const referenceItems = computed<ReferenceImageItem[]>(() =>
  state.value.images.map((img, index) => ({
    id: img.id,
    key: `${index}:${img.id}`,
    src: thumbnails.value[img.id] || '',
    label: t('imageWorkspace.input.imageLabel', { index: index + 1 }),
    alt: img.name,
    title: img.name,
    downloadFilename: img.name,
    removeAriaLabel: t('video.removeRef', { name: img.name }),
  })),
)
const persistReferences = async () => {
  try {
    if (!await session.saveSession()) throw new Error('video.error.save')
  } catch (e) { report(e) }
}
const uploadFiles = async (files: File[]) => {
  if (!files.length) return
  if (files.length + state.value.images.length > 4) { report(new Error('video.error.references')); return }
  uploading.value = true
  try {
    const inputs = await prepareInputRefs(files)
    if (inputs) await session.addImages(inputs.map((payload, i) => ({ payload, name: files[i].name })))
  } catch (e) { report(e) } finally { uploading.value = false }
}
const removeReference = async (index: number) => {
  if (index < 0 || index >= state.value.images.length) return
  state.value.images.splice(index, 1)
  await persistReferences()
}
const reorderReferences = async (fromIndex: number, toIndex: number) => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
  if (fromIndex >= state.value.images.length || toIndex >= state.value.images.length) return
  const [moved] = state.value.images.splice(fromIndex, 1)
  state.value.images.splice(toIndex, 0, moved)
  await persistReferences()
}
const updateReferenceRole = async (index: number, role: VideoImageRef['role']) => {
  const item = state.value.images[index]
  if (!item || item.role === role) return
  item.role = role
  await persistReferences()
}
const selectVersion = (record: PromptRecord) => {
  state.value.currentChainId = record.chainId
  state.value.currentVersionId = record.id
  state.value.optimizedPrompt = state.value.lastGeneratedPrompt = record.optimizedPrompt
  rolesOnly.value = false
}
const selectOriginal = (root: PromptRecord) => {
  state.value.currentChainId = root.chainId
  state.value.currentVersionId = null
  state.value.optimizedPrompt = state.value.lastGeneratedPrompt = root.originalPrompt
  rolesOnly.value = false
}

type Revision = { originalPrompt: string; optimizedPrompt: string; iterateInput: string }

const writePrompt = async (revision?: Revision) => {
  const services = getPiniaServices()
  if (!services || session.optimizing || session.iterating) return
  const s = state.value
  const brief = s.originalPrompt.trim()
  const previous = s.optimizedPrompt
  const base = revision?.optimizedPrompt ?? previous
  const modelKey = s.selectedTextModelKey
  const templateId = revision ? s.selectedIterateTemplateId : s.selectedTemplateId
  if (!modelKey) { report(new Error('video.error.textModel')); return }
  if (!templateId || (revision ? !base.trim() || !revision.iterateInput.trim() : !brief)) return
  if (!revision && previous && previous !== s.lastGeneratedPrompt && !await dialog.warning({
    title: t('video.replace'), content: t('video.replaceHint'), positiveText: t('video.optimize'), negativeText: t('common.cancel'),
  })) return
  if (session.optimizing || session.iterating) return
  if (revision) session.iterating = true
  else session.optimizing = true

  try {
    // Wait for legacy drafts to acquire their saved version ID before binding an iteration.
    if (revision && !session.historyReady) await session.refreshHistory()
    const selectedVersion = session.currentVersion
    const versionId = s.currentVersionId
    const chainId = selectedVersion?.chainId ?? session.versions[0]?.chainId
    const rootTemplateId = s.selectedTemplateId ?? ''
    const refs = s.images.map(image => ({ ...image }))
    const params = { ...s.params }
    const variables = {
      duration: String(params.duration), ratio: params.ratio, resolution: params.resolution,
      referenceRoles: refs.map((image, index) => `${index + 1}. ${t('video.roles.' + image.role)}`).join('\n'),
    }
    const model = await services.modelManager.getModel(modelKey)
    if (!model) throw new Error('video.error.textModel')
    const generate = (images?: ImageInputRef[]) => revision
      ? services.promptService.iteratePrompt(brief, base, revision.iterateInput, modelKey, templateId, { variables, inputImages: images })
      : services.promptService.optimizePrompt({ optimizationMode: 'user', modelKey, templateId, targetPrompt: brief,
          advancedContext: { variables }, inputImages: images })

    const images = await session.resolveImages(refs)
    let prompt: string
    let usedRolesOnly = false
    try {
      prompt = await generate(images)
    } catch (error) {
      if (!images.length || !/does not support (?:streaming )?image understanding|image input is not supported/i.test(String(error))) throw error
      usedRolesOnly = true
      prompt = await generate()
    }

    const metadata = { videoParams: params }
    const createRoot = (text: string) => services.historyManager.createNewChain({
      id: uuid(), type: 'videoOptimize', originalPrompt: brief || base, optimizedPrompt: text,
      modelKey: revision ? '' : modelKey, modelName: revision ? undefined : model.name,
      templateId: revision ? '' : rootTemplateId, timestamp: Date.now(), metadata,
    })
    let record: PromptRecord
    if (revision) {
      // A pasted draft needs a saved starting version so it can be compared with its first revision.
      const parent = selectedVersion ?? (!chainId ? (await createRoot(base)).rootRecord : undefined)
      const targetChainId = parent?.chainId ?? chainId
      if (!targetChainId) throw new Error('video.error.save')
      const fromOriginal = !parent
      const chain = await services.historyManager.addIteration({
        chainId: targetChainId, previousId: parent?.id,
        originalPrompt: brief || base, optimizedPrompt: prompt, modelKey, templateId, iterationNote: revision.iterateInput,
        metadata: { ...metadata, ...(fromOriginal ? { iterationBaseVersion: 0 } : {}),
          ...(base === parent?.optimizedPrompt ? {} : { iterationBasePrompt: base }) },
      })
      record = chain.currentRecord
    } else {
      record = (await createRoot(prompt)).currentRecord
    }

    const unchanged = s === state.value && s.optimizedPrompt === previous && s.originalPrompt.trim() === brief &&
      s.currentVersionId === versionId && JSON.stringify(s.images) === JSON.stringify(refs) && JSON.stringify(s.params) === JSON.stringify(params) &&
      (revision ? s.selectedIterateTemplateId : s.selectedTemplateId) === templateId
    window.dispatchEvent(new Event('prompt-optimizer:history-refresh'))
    if (!unchanged) { toast.info(t('video.historyOnly')); return }
    selectVersion(record)
    rolesOnly.value = usedRolesOnly
    if (!await session.saveSession()) throw new Error('video.error.save')
    if (isCompact.value && mobileRegion.value === 'optimize') {
      inputCollapsed.value = true
      await showOptimizationSection('workspace')
    }
  } catch (error) { report(error) } finally { session.optimizing = false; session.iterating = false }
}
const saveLocalEdit = async ({ note }: { note?: string }) => {
  const history = getPiniaServices()?.historyManager
  const s = state.value
  if (!history || !s.currentChainId || !s.optimizedPrompt.trim() || session.optimizing || session.iterating) return
  session.iterating = true
  const text = s.optimizedPrompt
  const versionId = s.currentVersionId
  try {
    const chain = await history.addIteration({ chainId: s.currentChainId, previousId: versionId ?? undefined,
      originalPrompt: s.originalPrompt.trim() || text, optimizedPrompt: text, templateId: '', modelKey: '', iterationNote: note,
      metadata: { videoParams: { ...s.params } } })
    window.dispatchEvent(new Event('prompt-optimizer:history-refresh'))
    if (s === state.value && s.optimizedPrompt === text && s.currentVersionId === versionId) {
      selectVersion(chain.currentRecord)
      if (!await session.saveSession()) throw new Error('video.error.save')
    }
  } catch (error) { report(error) } finally { session.iterating = false }
}
const favorite = () => saveFavorite?.({ content: state.value.optimizedPrompt, originalContent: state.value.originalPrompt,
  prefill: { functionMode: 'video', metadata: { videoParams: { ...state.value.params } } } })
const evaluate = async () => {
  const service = getPiniaServices()?.evaluationService
  if (!service || evaluating.value) return
  evaluating.value = true
  const s = state.value, prompt = s.optimizedPrompt
  try {
    const result = await service.evaluate({ type: 'prompt-only', mode: { functionMode: 'video', subMode: 'create' },
      target: { workspacePrompt: prompt, referencePrompt: s.originalPrompt }, evaluationModelKey: s.selectedTextModelKey })
    s.evaluation = { prompt, text: [`${result.score.overall}/100 · ${result.summary}`, ...result.improvements].join('\n') }
    showEvaluation.value = !!currentEvaluation.value
  } catch (e) { report(e) } finally { evaluating.value = false }
}
defineExpose({ isUpdateBusy: () => workspaceBusy.value })
</script>
<style scoped>
.video-workspace { width: 100%; height: 100%; min-height: 0; position: relative; flex: 1; }
.video-split { display: grid; width: 100%; height: 100%; min-height: 0; overflow: hidden; }
.video-pane { min-width: 0; min-height: 0; height: 100%; overflow: hidden; }
.split-divider {
  cursor: col-resize;
  margin-block: 6px;
  border-radius: 999px;
  background: var(--n-divider-color, rgba(0, 0, 0, 0.08));
  transition: background 120ms ease;
}
.split-divider:hover, .split-divider:focus-visible { background: var(--n-primary-color, rgba(59, 130, 246, 0.5)); }
.video-original { flex-shrink: 0; }
.source-summary-group { min-width: 0; }
.source-summary-title { flex: none; font-size: 18px; font-weight: 500; }
.source-summary-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-summary-text, .video-note { font-size: 12px; }
.video-editor-card { flex: 1; min-height: 200px; overflow: hidden; }
.video-editor { display: flex; flex-direction: column; height: 100%; min-height: 0; }
</style>
