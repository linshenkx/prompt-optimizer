import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import {
  createDefaultVideoCreateState, createVideoService, readVideoSession, MAX_STORED_VIDEO_REFERENCES, VIDEO_CREATE_SESSION_KEY,
  checkVideoInputCompatibility, getVideoModelSpec, resolveVideoParams, videoRunKey, videoRunVariant, videoWireModel,
  type PromptRecord, type ImageInputRef, type VideoImageRef, type VideoModelSummary, type VideoParamValue,
  type VideoReferenceRole, type VideoRun, type VideoService, type VideoVariantId,
} from '@prompt-optimizer/core'
import { getPiniaServices } from '../../plugins/pinia'
import { persistImagePayloadAsAssetId } from '../../utils/image-asset-storage'
import { pauseImageStorageGc, queueImageStorageMaintenance } from './imageStorageMaintenance'
import { createSessionSnapshotWriter, hasSessionConflict, readSessionSnapshot, runSessionWrite, type SessionWritePermit } from './sessionPersistence'

export { createDefaultVideoCreateState }
export type { VideoCreateSessionState } from '@prompt-optimizer/core'
export { VIDEO_CREATE_SESSION_KEY }
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v))
export const isVideoExtension = () => typeof location !== 'undefined' && ['chrome-extension:', 'moz-extension:'].includes(location.protocol)
export function getVideoService(): VideoService {
  const preferences = getPiniaServices()?.preferenceService
  if (!preferences || isVideoExtension()) throw new Error('video.error.unavailable')
  return window.electronAPI?.video ?? createVideoService(preferences)
}
type VideoRunDraft = Omit<VideoRun, 'submittedAt'> & { localId: string }
const runIdentity = ({ providerId, modelId, configModelId }: VideoRun) => ({ providerId, modelId, configModelId })

export const useVideoCreateSession = defineStore('video-create-session', () => {
  const state = ref(createDefaultVideoCreateState())
  const history = shallowRef<PromptRecord[]>([])
  const historyReady = ref(false)
  let historyRequest = 0
  const refreshHistory = async () => {
    const request = ++historyRequest
    historyReady.value = false
    const records = await getPiniaServices()?.historyManager?.getRecords() ?? []
    if (request !== historyRequest) return
    const videoChains = new Set(records.filter(r => r.type === 'videoOptimize').map(r => r.chainId))
    history.value = records.filter(r => videoChains.has(r.chainId))
    historyReady.value = true
  }
  const historyById = computed(() => new Map(history.value.map(record => [record.id, record])))
  const currentVersion = computed(() => {
    const { currentVersionId, originalPrompt, optimizedPrompt, lastGeneratedPrompt } = state.value
    if (currentVersionId !== undefined) return currentVersionId ? historyById.value.get(currentVersionId) : undefined
    // Older sessions had no record ID. Only attach a chain when the saved text identifies it uniquely.
    const saved = (lastGeneratedPrompt || optimizedPrompt).trim()
    if (!saved) return undefined
    const matches = history.value.filter(r => r.originalPrompt.trim() === originalPrompt.trim() && r.optimizedPrompt.trim() === saved)
    return matches.length === 1 ? matches[0] : undefined
  })
  watch(currentVersion, record => {
    if (record) {
      if (state.value.currentVersionId === undefined) state.value.currentVersionId = record.id
      state.value.currentChainId = record.chainId
    }
  })
  const versions = computed(() => {
    const chainId = currentVersion.value?.chainId ?? state.value.currentChainId
    return chainId ? history.value.filter(record => record.chainId === chainId).sort((a, b) => a.version - b.version) : []
  })
  const referenceImages = computed(() => state.value.images.filter(image => image.role === 'reference_image'))
  const firstFrame = computed(() => state.value.images.find(image => image.role === 'first_frame'))
  const lastFrame = computed(() => state.value.images.find(image => image.role === 'last_frame'))
  const activeImages = computed(() => {
    if (state.value.capabilityMode === 'references') return referenceImages.value
    if (state.value.capabilityMode === 'frames') return [firstFrame.value, lastFrame.value].filter(image => image !== undefined)
    return []
  })
  const inputContext = computed(() => ({ mode: state.value.capabilityMode, images: activeImages.value }))
  const resolveColumn = (id: VideoVariantId, model?: VideoModelSummary) => {
    const spec = model && getVideoModelSpec(model.modelId, model.providerId)
    return spec ? resolveVideoParams(spec, state.value.columns[id].params, inputContext.value)
      : { params: state.value.columns[id].params, definitions: [] }
  }
  const setColumnModel = (id: VideoVariantId, model: VideoModelSummary, configModelId?: string) => {
    const column = state.value.columns[id]
    column.configId = model.id
    column.modelId = configModelId ? model.modelId : undefined
    column.params = resolveColumn(id, model).params
  }
  const setColumnParam = (id: VideoVariantId, model: VideoModelSummary, key: string, value: VideoParamValue) => {
    const column = state.value.columns[id]
    column.params = { ...resolveColumn(id, model).params, [key]: value }
    column.params = resolveColumn(id, model).params
  }
  const submittingKey = ref<string>()
  const submitting = computed(() => !!submittingKey.value)
  const queryingKeys = ref(new Set<string>())
  const querying = computed(() => queryingKeys.value.size > 0)
  const isQuerying = (run: VideoRun) => queryingKeys.value.has(videoRunKey(run))
  const displayStatus = (run: VideoRun) =>
    run.status === 'submitting' && submittingKey.value !== videoRunKey(run) ? 'unknown' : run.status
  const optimizing = ref(false)
  const iterating = ref(false)
  const busy = computed(() => submitting.value || optimizing.value || iterating.value)
  const activeRuns = computed(() => state.value.runs.filter(r => ['submitting','unknown','queued','running'].includes(r.status)))
  const activeRun = computed(() => activeRuns.value[0])
  const activeFor = (id: VideoVariantId) => activeRuns.value.find(run => videoRunVariant(run) === id)
  const writer = createSessionSnapshotWriter(() => ({ ...state.value }))
  const imageLeases = new Set<() => void>()
  const reset = () => { state.value = createDefaultVideoCreateState() }

  const restoreSession = async () => {
    const service = getPiniaServices()?.preferenceService
    if (!service || busy.value || querying.value) return
    const before = JSON.stringify(state.value)
    const raw = await readSessionSnapshot<unknown>(service, VIDEO_CREATE_SESSION_KEY, null)
    if (busy.value || querying.value || before !== JSON.stringify(state.value)) return
    if (raw) state.value = readVideoSession(typeof raw === 'string' ? JSON.parse(raw) : raw)
    else reset()
    writer.restored(service, VIDEO_CREATE_SESSION_KEY)
  }
  const saveSession = async (permit?: SessionWritePermit) => {
    const service = getPiniaServices()?.preferenceService
    if (!service) return false
    const captured = writer.capture()
    const value = { ...copy(state.value), lastActiveAt: Date.now() }
    const leases = [...imageLeases]
    return runSessionWrite(service, async () => {
      await writer.write(service, VIDEO_CREATE_SESSION_KEY, value, captured)
      for (const release of leases) { imageLeases.delete(release); release() }
    }, permit, 'video-create')
  }
  const addImages = async (images: { name: string; payload: ImageInputRef }[], role: VideoReferenceRole = 'reference_image') => {
    if (!images.length) return
    const draft = state.value
    const release = pauseImageStorageGc()
    try {
      const refs = await queueImageStorageMaintenance(async () => Promise.all(images.map(async ({ name, payload }) => {
        const id = await persistImagePayloadAsAssetId({ payload: { ...payload, mimeType: payload.mimeType || 'image/png' },
          storageService: getPiniaServices()?.imageStorageService, sourceType: 'uploaded' })
        if (!id) throw new Error('video.error.references')
        return { _type: 'image-ref', id, name, role } satisfies VideoImageRef
      })))
      if (state.value !== draft) { release(); return }
      if (role === 'reference_image') {
        if (refs.length + referenceImages.value.length > MAX_STORED_VIDEO_REFERENCES) throw new Error('video.error.references')
        draft.images.push(...refs)
      } else {
        if (refs.length !== 1 || (role === 'last_frame' && !firstFrame.value)) throw new Error('video.error.frames')
        const index = draft.images.findIndex(image => image.role === role)
        if (index < 0) draft.images.push(refs[0])
        else draft.images.splice(index, 1, refs[0])
      }
    } catch (error) { release(); throw error }
    imageLeases.add(release)
    if (!await saveSession()) throw new Error('video.error.save')
  }
  const resolveImages = async (refs: VideoImageRef[]) => Promise.all(refs.map(async ref => {
    const asset = await getPiniaServices()?.imageStorageService?.getImage(ref.id)
    if (!asset) throw new Error('video.error.missingImage')
    return { role: ref.role, b64: asset.data, mimeType: asset.metadata.mimeType }
  }))
  const prepareRun = (config: VideoModelSummary, variantId: VideoVariantId = 'b', prompt = state.value.optimizedPrompt, configModelId?: string) => {
    const spec = getVideoModelSpec(config.modelId, config.providerId)
    if (!spec || !config.enabled) throw new Error('video.error.configChanged')
    const context = inputContext.value
    const compatibility = checkVideoInputCompatibility(spec, context.mode, context.images)
    if (!compatibility.compatible) throw new Error(compatibility.reasonKey)
    if (!prompt.trim()) throw new Error('video.error.prompt')
    const { params } = resolveColumn(variantId, config)
    return copy({ localId: uuid(), variantId, source: state.value.columns[variantId].source, prompt,
      model: videoWireModel(config), modelId: config.modelId, providerId: config.providerId, modelName: config.name,
      configId: config.id, ...(configModelId && { configModelId }), baseURL: config.baseURL, capabilityMode: context.mode,
      cost: config.customModel ? null : spec.pricing.estimate(params, { ...context, baseURL: config.baseURL }),
      images: context.images, params, status: 'submitting' } satisfies VideoRunDraft)
  }
  const submit = async (draft: VideoRunDraft) => {
    const variant = draft.variantId ?? 'b'
    const key = draft.localId
    if (submitting.value || activeFor(variant) || state.value.runs.some(run => videoRunKey(run) === key)) return
    submittingKey.value = key
    try {
      const service = getVideoService()
      const references = (await resolveImages(draft.images)).map(i => ({ role: i.role, url: `data:${i.mimeType};base64,${i.b64}` }))
      const column = state.value.columns[variant]
      const previousConfigId = column.configId
      if (!column.configId && draft.configId) column.configId = draft.configId
      state.value.runs.unshift(copy({ ...draft, submittedAt: Date.now() }))
      const run = state.value.runs[0]
      try {
        if (!await saveSession()) throw new Error('video.error.save')
      } catch (error) {
        state.value.runs = state.value.runs.filter(item => videoRunKey(item) !== key)
        column.configId = previousConfigId
        throw error
      }
      try {
        run.id = await service.create({ model: run.model, providerId: run.providerId, modelId: run.modelId, configModelId: run.configModelId,
          capabilityMode: run.capabilityMode, configId: run.configId, baseURL: run.baseURL,
          params: copy(run.params), prompt: run.prompt, references })
        run.status = 'queued'
      } catch (cause) {
        const failure = cause as { message?: string; code?: string } | null
        const message = failure?.message ?? String(cause)
        run.status = failure?.code === 'VIDEO_REQUEST_REJECTED' || /^video\.error\.(?!missingId)/.test(message) ? 'failed' : 'unknown'
        run.error = message
      }
      try {
        if (!await saveSession()) throw new Error('video.error.save')
      } catch (error) {
        // A second window may edit the draft while the provider accepts the paid task.
        // Retain the returned ID without overwriting that window's draft or clearing its conflict.
        const prefs = getPiniaServices()?.preferenceService
        if (run.id && prefs?.compareAndSet && hasSessionConflict(prefs, VIDEO_CREATE_SESSION_KEY)) {
          const latest = await prefs.get(VIDEO_CREATE_SESSION_KEY, null as typeof state.value | null)
          const pending = latest?.runs?.find(item => videoRunKey(item) === key && !item.id)
          if (latest && pending) {
            const runs = latest.runs.map(item => item === pending ? { ...item, id: run.id, status: run.status } : item)
            await prefs.compareAndSet(VIDEO_CREATE_SESSION_KEY, latest, { ...latest, runs })
          }
        }
        throw error
      }
    } finally { submittingKey.value = undefined }
  }
  const refresh = async (run: VideoRun) => {
    if (!run.id || isQuerying(run)) return
    queryingKeys.value.add(videoRunKey(run))
    try {
      const result = await getVideoService().query(run.id, run.configId, run.baseURL, runIdentity(run))
      const { usage, ...task } = result
      Object.assign(run, task)
      if (usage) run.usage = { ...run.usage, ...usage }
      if (run.usage && run.baseURL && run.model === run.modelId) {
        const pricing = getVideoModelSpec(run.modelId, run.providerId)?.pricing
        run.cost = pricing?.actual?.(run.usage, run.params, { mode: run.capabilityMode, images: run.images, baseURL: run.baseURL }) ?? run.cost
      }
      if (!await saveSession()) throw new Error('video.error.save')
    } finally { queryingKeys.value.delete(videoRunKey(run)) }
  }
  const cancel = async (run: VideoRun) => {
    if (!run.id || run.status !== 'queued' || isQuerying(run) || !getVideoModelSpec(run.modelId, run.providerId)?.capabilities.supportsCancel) return
    queryingKeys.value.add(videoRunKey(run))
    try {
      await getVideoService().cancel(run.id, run.configId, run.baseURL, runIdentity(run))
      run.status = 'cancelled'
      if (!await saveSession()) throw new Error('video.error.save')
    } finally { queryingKeys.value.delete(videoRunKey(run)) }
  }
  const updateTemplate = (id: string | null) => { state.value.selectedTemplateId = id }
  const updateIterateTemplate = (id: string | null) => { state.value.selectedIterateTemplateId = id }
  const applyPrompt = (brief: string, prompt: string, currentVersionId: string | null = null, currentChainId: string | null = null) => {
    Object.assign(state.value, { originalPrompt: brief, optimizedPrompt: prompt, currentVersionId, currentChainId, lastGeneratedPrompt: currentVersionId ? prompt : '',
      evaluation: null, images: [], capabilityMode: 'text2video' })
  }
  return { state, versions, currentVersion, historyById, historyReady, activeImages, referenceImages, firstFrame, lastFrame, inputContext, resolveColumn, setColumnModel, setColumnParam, refreshHistory, reset, updateTemplate, updateIterateTemplate, applyPrompt, saveSession, restoreSession, addImages, resolveImages, prepareRun, submit, refresh, cancel,
    activeRun, activeRuns, activeFor, displayStatus, isQuerying, busy, optimizing, iterating, querying, submitting }
})
export type VideoCreateSessionApi = ReturnType<typeof useVideoCreateSession>
